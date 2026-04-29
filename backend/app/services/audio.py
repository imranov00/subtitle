import subprocess
from pathlib import Path

from app.config import settings


def extract_wav_16k_mono(video_path: Path, wav_out: Path) -> None:
    wav_out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        settings.ffmpeg_bin,
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        str(wav_out),
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError as ex:
        raise RuntimeError(
            "FFmpeg bulunamadı. FFmpeg kurup PATH'e ekleyin veya "
            "backend/.env içinde FFMPEG_BIN ile tam yol verin "
            "(ör: C:\\ffmpeg\\bin\\ffmpeg.exe)."
        ) from ex
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg başarısız: {r.stderr[:2000]}")
