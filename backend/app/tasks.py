import json
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.config import settings
from app.database import SessionLocal
from app.models import Job, JobStatus
from app.services.audio import extract_wav_16k_mono
from app.services.subtitle import segments_to_srt, segments_to_vtt, segments_to_ass
from app.services.translate_segments import translate_segments
from app.services.transcribe import transcribe_wav
from app.services.video import burn_subtitles_to_video


def _write_outputs(job_dir: Path, lang_key: str, srt_body: str, vtt_body: str, ass_body: str = "") -> dict[str, str]:
    job_dir.mkdir(parents=True, exist_ok=True)
    srt_path = job_dir / f"{lang_key}.srt"
    vtt_path = job_dir / f"{lang_key}.vtt"
    srt_path.write_text(srt_body, encoding="utf-8")
    vtt_path.write_text(vtt_body, encoding="utf-8")
    resp = {"srt": str(srt_path.resolve()), "vtt": str(vtt_path.resolve())}
    if ass_body:
        ass_path = job_dir / f"{lang_key}.ass"
        ass_path.write_text(ass_body, encoding="utf-8")
        resp["ass"] = str(ass_path.resolve())
    return resp


def _try_burned_video(
    source_video: Path,
    job_dir: Path,
    lang_key: str,
    subtext_path: Path,
    warnings: list[str],
    font: str | None = None,
    quality: str | None = None,
) -> str | None:
    out_video = job_dir / f"{lang_key}.burned.mp4"
    try:
        burn_subtitles_to_video(source_video, subtext_path, out_video, font=font, quality=quality)
        return str(out_video.resolve())
    except Exception as ex:
        warnings.append(f"{lang_key} video: {ex!s}")
        return None


@celery_app.task(bind=True, name="app.tasks.process_video_job")
def process_video_job(self, job_id: str) -> dict:
    reporter = self if self else SimpleNamespace(update_state=lambda **kwargs: None)
    return process_video_job_core(job_id, reporter)


def process_video_job_core(job_id: str, reporter=None) -> dict:
    if reporter is None:
        reporter = SimpleNamespace(update_state=lambda **kwargs: None)
    db: Session = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {"ok": False, "error": "job not found"}

        job.status = JobStatus.processing
        db.commit()

        video_path = Path(job.video_path)
        job_out = settings.output_dir / job_id
        job_out.mkdir(parents=True, exist_ok=True)
        wav_path = job_out / "audio_16k.wav"

        extract_wav_16k_mono(video_path, wav_path)

        target_langs: list[str] = json.loads(job.target_languages_json or "[]")
        word_level = getattr(job, "word_level", False)
        font_choice = getattr(job, "font", None)

        reporter.update_state(state="PROGRESS", meta={"step": "transcribe", "detail": "Ses tanınıyor..."})
        segments, detected, _duration = transcribe_wav(wav_path, language=None, word_level=word_level)

        job.source_language = detected
        
        segs_dicts = [{"start": s.start, "end": s.end, "text": s.text} for s in segments]
        job.transcription_data = json.dumps(segs_dicts)
        db.commit()

        # AI Akıllı Mod: Gemini ile video içerik analizi
        if getattr(job, "smart_mode", False):
            try:
                reporter.update_state(state="PROGRESS", meta={"step": "ai_analysis", "detail": "AI videoyu analiz ediyor..."})
                from app.services.ai_analyzer import analyze_video_content
                analysis = analyze_video_content(
                    segments=segments,
                    video_path=video_path,
                    source_language=detected,
                )
                job.ai_analysis_json = json.dumps(analysis.to_dict(), ensure_ascii=False)
                db.commit()
            except Exception as ai_err:
                # AI analizi başarısız olursa devam et, hata logla
                job.ai_analysis_json = json.dumps({
                    "topic": "Analiz başarısız",
                    "summary": str(ai_err)[:500],
                    "recommended_style": "standard",
                    "editing_notes": ["AI analizi sırasında hata oluştu, standart ayarlar kullanılıyor."],
                })
                db.commit()

        if getattr(job, "editor_mode", False) or getattr(job, "smart_mode", False):
            job.status = JobStatus.needs_review
            db.commit()
            return {"ok": True, "job_id": job_id, "status": "needs_review", "source_language": detected}

        return render_video_job_core(job_id, reporter)

    except Exception as e:
        j = db.query(Job).filter(Job.id == job_id).first()
        if j:
            j.status = JobStatus.failed
            j.error_message = str(e)[:4000]
            db.commit()
        raise
    finally:
        db.close()


@celery_app.task(bind=True, name="app.tasks.process_render_job")
def process_render_job(self, job_id: str) -> dict:
    reporter = self if self else SimpleNamespace(update_state=lambda **kwargs: None)
    return render_video_job_core(job_id, reporter)


def render_video_job_core(job_id: str, reporter=None) -> dict:
    if reporter is None:
        reporter = SimpleNamespace(update_state=lambda **kwargs: None)
    db: Session = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {"ok": False, "error": "job not found"}

        job.status = JobStatus.processing
        db.commit()

        video_path = Path(job.video_path)
        job_out = settings.output_dir / job_id
        job_out.mkdir(parents=True, exist_ok=True)
        
        target_langs: list[str] = json.loads(job.target_languages_json or "[]")
        
        font_data = getattr(job, "font", None) or "|"
        font_parts = font_data.split("|")
        font_choice = font_parts[0] if font_parts[0] else None
        style_template = font_parts[1] if len(font_parts) > 1 else "standard"
        video_quality = getattr(job, "video_quality", None)
        detected = job.source_language or "unknown"
        translate_warnings = []
        
        from app.services.subtitle import Segment
        segs_data = json.loads(job.transcription_data or "[]")
        segments = [Segment(**s) for s in segs_data]

        out_manifest: dict[str, dict[str, str]] = {}

        src_srt = segments_to_srt(segments)
        src_vtt = segments_to_vtt(segments)
        src_ass = segments_to_ass(segments, font_choice, True, style_template)
        out_manifest["original"] = _write_outputs(job_out, "original", src_srt, src_vtt, src_ass)
        src_ass_path = job_out / "original.ass"
        
        burned = _try_burned_video(video_path, job_out, "original", src_ass_path, translate_warnings, font=font_choice, quality=video_quality)
        if burned:
            out_manifest["original"]["video"] = burned

        seen: set[str] = set()
        for tgt in target_langs:
            code = (tgt or "").strip().lower()
            if not code or code in seen:
                continue
            seen.add(code)
            if code == detected:
                continue

            reporter.update_state(
                state="PROGRESS",
                meta={"step": "translate", "detail": f"{detected} → {code}", "lang": code},
            )

            try:
                translated = translate_segments(segments, detected, code)
                out_manifest[code] = _write_outputs(
                    job_out,
                    code,
                    segments_to_srt(translated),
                    segments_to_vtt(translated),
                )
                srt_path = job_out / f"{code}.srt"
                
                burned_lang = _try_burned_video(video_path, job_out, code, srt_path, translate_warnings, font=font_choice, quality=video_quality)
                if burned_lang:
                    out_manifest[code]["video"] = burned_lang
            except Exception as ex:
                translate_warnings.append(f"{code}: {ex!s}")

        job_row = db.query(Job).filter(Job.id == job_id).first()
        if job_row:
            job_row.status = JobStatus.completed
            job_row.error_message = (
                "\n".join(translate_warnings)[:4000] if translate_warnings else None
            )
            db.commit()

        return {"ok": True, "job_id": job_id, "outputs": out_manifest, "source_language": detected}

    except Exception as e:
        j = db.query(Job).filter(Job.id == job_id).first()
        if j:
            j.status = JobStatus.failed
            j.error_message = str(e)[:4000]
            db.commit()
        raise
    finally:
        db.close()
