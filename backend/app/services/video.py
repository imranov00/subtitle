import subprocess
from pathlib import Path

from app.config import settings


def _ffmpeg_subtitles_path(path: Path) -> str:
    """
    ffmpeg subtitles filtresi için güvenli path üretir.
    Windows'ta ters slash ve ':' karakteri escape edilmelidir.
    """
    s = str(path.resolve()).replace("\\", "/")
    s = s.replace(":", r"\:")
    s = s.replace("'", r"\'")
    return s


def burn_subtitles_to_video(video_path: Path, subtext_path: Path, output_path: Path, font: str | None = None, quality: str | None = None) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sub_path = _ffmpeg_subtitles_path(subtext_path)
    
    if subtext_path.suffix.lower() == ".ass":
        vf = f"ass='{sub_path}'"
    else:
        import json
        style_opts = {}
        font_name = font
        
        if font and font.startswith("{"):
            try:
                style_opts = json.loads(font)
                font_name = style_opts.get("family") or "Arial"
            except:
                pass
        
        vf = f"subtitles='{sub_path}'"
        styles = []
        if font_name:
            styles.append(f"Fontname={font_name}")
        
        if style_opts.get("size"):
            styles.append(f"Fontsize={style_opts['size']}")
            
        if style_opts.get("color"):
            # ASS color format is &HBBGGRR or &HAABBGGRR. 
            # We assume the user provides valid format or we could do some basic check.
            col = style_opts["color"].strip()
            styles.append(f"PrimaryColour={col}")

        if style_opts.get("alignment"):
            styles.append(f"Alignment={style_opts['alignment']}")
            
        if styles:
            vf += f":force_style='{','.join(styles)}'"
    
    if quality == "1080p":
        vf = f"scale=-2:1080,{vf}"
    elif quality == "720p":
        vf = f"scale=-2:720,{vf}"
    elif quality == "480p":
        vf = f"scale=-2:480,{vf}"

    cmd = [
        settings.ffmpeg_bin,
        "-y",
        "-i",
        str(video_path),
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        str(output_path),
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError as ex:
        raise RuntimeError(
            "FFmpeg bulunamadı. FFmpeg kurup PATH'e ekleyin veya "
            "backend/.env içinde FFMPEG_BIN ile tam yol verin."
        ) from ex

    if r.returncode != 0:
        raise RuntimeError(f"Videoya altyazı gömme başarısız: {r.stderr[:2000]}")
