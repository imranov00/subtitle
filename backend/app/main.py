import json
import threading
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, init_db
from app.models import Job, JobStatus
from app.schemas import JobCreateResponse, JobStatusResponse
from app.tasks import process_video_job, process_video_job_core

app = FastAPI(title="Altyazı", version="1.0.0")


@app.on_event("startup")
def startup() -> None:
    init_db()


def _cors_origins() -> list[str]:
    return [o.strip() for o in settings.cors_origins.split(",") if o.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins() or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/upload", response_model=JobCreateResponse)
async def upload(
    file: UploadFile = File(...),
    target_languages: str = Form(default="[]"),
    word_level: bool = Form(default=False),
    editor_mode: bool = Form(default=False),
    smart_mode: bool = Form(default=False),
    font: str = Form(default=""),
    db: Session = Depends(get_db),
) -> JobCreateResponse:
    try:
        targets = json.loads(target_languages)
        if not isinstance(targets, list):
            targets = []
        targets = [str(t).lower().strip() for t in targets if str(t).strip()]
    except json.JSONDecodeError:
        targets = []

    suffix = Path(file.filename or "video").suffix.lower()
    if suffix not in {".mp4", ".mkv", ".mov", ".webm", ".avi", ".m4v"}:
        raise HTTPException(400, "Desteklenen formatlar: mp4, mkv, mov, webm, avi, m4v")

    job_id = None
    try:
        job = Job(
            original_filename=file.filename or "video",
            video_path="",
            target_languages_json=json.dumps(targets),
            word_level=word_level,
            editor_mode=editor_mode,
            smart_mode=smart_mode,
            font=font.strip() if font.strip() else None,
        )
        db.add(job)
        db.flush()
        job_id = job.id

        safe_name = f"{job_id}{suffix}"
        dest = settings.upload_dir / safe_name
        dest.parent.mkdir(parents=True, exist_ok=True)

        content = await file.read()
        dest.write_bytes(content)

        job.video_path = str(dest.resolve())
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Yükleme hatası: {e}") from e

    _dispatch_job(job_id)
    return JobCreateResponse(job_id=job_id)


def _run_local_job(job_id: str) -> None:
    process_video_job_core(job_id)

from app.tasks import render_video_job_core
def _run_local_render_job(job_id: str) -> None:
    render_video_job_core(job_id)

def _dispatch_job(job_id: str) -> None:
    mode = settings.task_mode.strip().lower()
    if mode == "local":
        threading.Thread(target=_run_local_job, args=(job_id,), daemon=True).start()
        return
    if mode == "celery":
        process_video_job.delay(job_id)
        return

    # auto: önce celery dene, erişilemiyorsa local fallback
    try:
        process_video_job.delay(job_id)
    except Exception:
        threading.Thread(target=_run_local_job, args=(job_id,), daemon=True).start()


def _dispatch_render_job(job_id: str) -> None:
    from app.tasks import process_render_job
    mode = settings.task_mode.strip().lower()
    if mode == "local":
        threading.Thread(target=_run_local_render_job, args=(job_id,), daemon=True).start()
        return
    if mode == "celery":
        process_render_job.delay(job_id)
        return
    try:
        process_render_job.delay(job_id)
    except Exception:
        threading.Thread(target=_run_local_render_job, args=(job_id,), daemon=True).start()


def _downloads_for_job(job_id: str) -> dict[str, dict[str, str]]:
    root = settings.output_dir / job_id
    if not root.is_dir():
        return {}
    out: dict[str, dict[str, str]] = {}
    for p in root.glob("*.srt"):
        key = p.stem
        vtt = root / f"{key}.vtt"
        video = root / f"{key}.burned.mp4"
        rel = {}
        if p.exists():
            rel["srt"] = f"/api/jobs/{job_id}/file/{key}.srt"
        if vtt.exists():
            rel["vtt"] = f"/api/jobs/{job_id}/file/{key}.vtt"
        if video.exists():
            rel["video"] = f"/api/jobs/{job_id}/file/{key}.burned.mp4"
        if rel:
            out[key] = rel
    return out


@app.get("/api/jobs/{job_id}", response_model=JobStatusResponse)
def job_status(job_id: str, db: Session = Depends(get_db)) -> JobStatusResponse:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "İş bulunamadı")
    targets = json.loads(job.target_languages_json or "[]")
    if not isinstance(targets, list):
        targets = []
    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        source_language=job.source_language,
        transcription_data=job.transcription_data,
        ai_analysis=job.ai_analysis_json,
        target_languages=targets,
        error_message=job.error_message,
        created_at=job.created_at,
        downloads=_downloads_for_job(job_id) if job.status == JobStatus.completed else {},
    )


@app.get("/api/jobs/{job_id}/raw_video")
def get_raw_video(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job or not job.video_path:
        raise HTTPException(404, "İş veya video bulunamadı")
    
    path = Path(job.video_path)
    if not path.is_file():
        raise HTTPException(404, "Orijinal dosya silinmiş veya bulunamıyor")
        
    return FileResponse(path, media_type="video/mp4")


from pydantic import BaseModel
class RenderRequest(BaseModel):
    transcription_data: str
    video_quality: str | None = None
    target_languages: list[str] = []
    font: str | None = None
    style_template: str = "standard"

@app.post("/api/jobs/{job_id}/render")
def trigger_render(job_id: str, req: RenderRequest, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "İş bulunamadı")
        
    job.transcription_data = req.transcription_data
    job.target_languages_json = json.dumps(req.target_languages)
    job.video_quality = req.video_quality
    # Style şablonunu font sütununda tutabiliriz veya DB'ye extra column eklemek yerine geçici olarak `font` üzerinden "mrbeast|Arial" gibi paslayabiliriz.
    # En temizi font sütununu (fontname|styleTemplate) mantığında birleştirmek.
    combined_style = f"{req.font or ''}|{req.style_template}"
    job.font = combined_style
    job.status = JobStatus.processing
    db.commit()
    
    _dispatch_render_job(job_id)
    return {"ok": True, "job_id": job_id}


@app.post("/api/jobs/{job_id}/ai-analyze")
def trigger_ai_analysis(job_id: str, db: Session = Depends(get_db)):
    """Editörde iken AI'dan yeniden analiz iste."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "İş bulunamadı")

    if not job.transcription_data:
        raise HTTPException(400, "Transkript verisi yok, önce video işlenmeli")

    from app.services.ai_analyzer import analyze_video_content
    from app.services.subtitle import Segment

    segs_data = json.loads(job.transcription_data or "[]")
    segments = [Segment(**s) for s in segs_data]
    video_path = Path(job.video_path) if job.video_path else None

    analysis = analyze_video_content(
        segments=segments,
        video_path=video_path,
        source_language=job.source_language or "unknown",
    )

    job.ai_analysis_json = json.dumps(analysis.to_dict(), ensure_ascii=False)
    db.commit()

    return {"ok": True, "analysis": analysis.to_dict()}


@app.get("/api/jobs/{job_id}/file/{filename}")
def download_file(job_id: str, filename: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "İş bulunamadı")
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Geçersiz dosya adı")
    path = settings.output_dir / job_id / filename
    if not path.is_file():
        raise HTTPException(404, "Dosya yok")
    media = "application/octet-stream"
    if filename.endswith(".vtt"):
        media = "text/vtt"
    elif filename.endswith(".srt"):
        media = "application/x-subrip"
    elif filename.endswith(".mp4"):
        media = "video/mp4"
    return FileResponse(path, filename=filename, media_type=media)


_static_root = Path(__file__).resolve().parent.parent / "static"
if _static_root.is_dir():
    app.mount("/", StaticFiles(directory=str(_static_root), html=True), name="static")
