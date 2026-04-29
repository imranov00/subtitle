from pathlib import Path

from faster_whisper import WhisperModel

from app.config import settings
from app.services.subtitle import Segment

_model: WhisperModel | None = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(
            settings.whisper_model,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )
    return _model


def transcribe_wav(wav_path: Path, language: str | None = None, word_level: bool = False) -> tuple[list[Segment], str, float]:
    """language: ISO 639-1 veya None (otomatik). Dönüş: segmentler, algılanan dil kodu, süre."""
    model = get_model()
    # word_timestamps HER ZAMAN True diyoruz, böylece word objelerini alabilelim.
    segments_iter, info = model.transcribe(
        str(wav_path),
        language=language if language and language != "auto" else None,
        vad_filter=True,
        beam_size=5,
        word_timestamps=True,
    )
    detected = (info.language or "unknown").lower()
    segs: list[Segment] = []
    
    for s in segments_iter:
        if word_level and hasattr(s, "words") and s.words:
            # Kullanıcı TikTok tarzı tek tek kelimeler istediğinde, cümleyi kelimelere parçala.
            for w in s.words:
                clean_word = w.word.strip()
                if clean_word:
                    segs.append(Segment(start=float(w.start), end=float(w.end), text=clean_word))
        else:
            segs.append(Segment(start=float(s.start), end=float(s.end), text=s.text.strip()))
            
    duration = float(info.duration) if info.duration else (segs[-1].end if segs else 0.0)
    return segs, detected, duration
