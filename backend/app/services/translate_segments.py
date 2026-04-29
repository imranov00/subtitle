import time
from typing import Callable

from deep_translator import GoogleTranslator

from app.services.subtitle import Segment

# googletrans tabanlı paketler için güvenli küçük batchler
BATCH_SIZE = 40
SLEEP_BETWEEN_BATCHES = 0.5


def _google_lang(code: str) -> str:
    """Whisper / ISO kodlarını Google Translate uyumlu forma çeker."""
    if not code:
        return code
    c = code.strip().lower()
    fixes = {
        "zh": "zh-CN",
        "zh-cn": "zh-CN",
        "he": "iw",
        "jw": "jv",
    }
    return fixes.get(c, c)


def translate_segments(
    segments: list[Segment],
    source_lang: str,
    target_lang: str,
    progress: Callable[[str], None] | None = None,
) -> list[Segment]:
    """Segment zaman kodlarını koruyarak metinleri çevirir."""
    src = _google_lang(source_lang)
    tgt = _google_lang(target_lang)
    if src == tgt:
        return segments
    texts = [s.text for s in segments]
    out_texts: list[str] = []

    for i in range(0, len(texts), BATCH_SIZE):
        chunk = texts[i : i + BATCH_SIZE]
        try:
            translator = GoogleTranslator(source=src, target=tgt)
            # deep-translator tek tek veya liste destekler
            translated = translator.translate_batch(chunk) if len(chunk) > 1 else [translator.translate(chunk[0])]
            out_texts.extend(translated)
        except Exception:
            # Tek tek dene
            for t in chunk:
                try:
                    translator = GoogleTranslator(source=src, target=tgt)
                    out_texts.append(translator.translate(t))
                except Exception:
                    out_texts.append(t)
                time.sleep(0.05)
        if progress:
            progress(f"Çeviri {min(i + BATCH_SIZE, len(texts))}/{len(texts)}")
        time.sleep(SLEEP_BETWEEN_BATCHES)

    result: list[Segment] = []
    for seg, txt in zip(segments, out_texts):
        result.append(Segment(start=seg.start, end=seg.end, text=txt))
    return result
