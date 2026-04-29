"""
AI Video Analyzer — Gemini 2.5 Flash ile video içerik analizi.

Transkripti (ve opsiyonel video karelerini) analiz ederek
akıllı düzenleme önerileri üretir.
"""

import json
import subprocess
import tempfile
from dataclasses import dataclass, field, asdict
from pathlib import Path

from google import genai
from google.genai import types

from app.config import settings


@dataclass
class HighlightMoment:
    start: float
    end: float
    reason: str
    importance: str = "medium"  # low, medium, high


@dataclass
class AIAnalysisResult:
    topic: str = ""
    summary: str = ""
    tone: str = ""
    audience: str = ""
    content_type: str = ""  # "motivasyon", "eğitim", "eğlence", "haber", "vlog", etc.
    recommended_style: str = "standard"
    recommended_font: str = "Arial"
    recommended_font_size: int = 130
    highlight_moments: list[HighlightMoment] = field(default_factory=list)
    crop_suggestion: str = "keep_original"  # keep_original, vertical_9_16, square_1_1
    color_palette: dict = field(default_factory=lambda: {
        "primary": "&H00FFFFFF",
        "outline": "&H00000000",
        "shadow": "&H80000000",
    })
    emoji_suggestions: dict = field(default_factory=dict)
    editing_notes: list[str] = field(default_factory=list)
    confidence: float = 0.0

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


_client = None


def _get_gemini_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _extract_frames(video_path: Path, count: int = 4) -> list[bytes]:
    """Videodan eşit aralıklı frame'ler çıkar (JPEG bytes)."""
    frames = []
    try:
        # Önce video süresini al
        probe_cmd = [
            settings.ffmpeg_bin.replace("ffmpeg", "ffprobe"),
            "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "json",
            str(video_path),
        ]
        result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=10)
        duration = float(json.loads(result.stdout)["format"]["duration"])

        for i in range(count):
            timestamp = (duration / (count + 1)) * (i + 1)
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                tmp_path = tmp.name

            cmd = [
                settings.ffmpeg_bin,
                "-y",
                "-ss", str(timestamp),
                "-i", str(video_path),
                "-vframes", "1",
                "-q:v", "5",
                "-vf", "scale=512:-1",
                tmp_path,
            ]
            subprocess.run(cmd, capture_output=True, timeout=15)
            frame_path = Path(tmp_path)
            if frame_path.is_file() and frame_path.stat().st_size > 0:
                frames.append(frame_path.read_bytes())
            frame_path.unlink(missing_ok=True)

    except Exception:
        pass  # Frame çıkarma başarısız olursa sadece transkript ile devam
    return frames


ANALYSIS_PROMPT = """Sen profesyonel bir video editörü ve içerik analisti yapay zekasısın.

Sana bir videonun transkriptini (ve varsa bazı karelerini) veriyorum. Bu videoyu analiz et ve aşağıdaki bilgileri JSON formatında dön:

{
  "topic": "Videonun ana konusu (kısa, 2-5 kelime)",
  "summary": "Videonun içeriğinin kısa özeti (2-3 cümle)",
  "tone": "Videonun genel tonu. Seçenekler: enerjik, ciddi, eğlenceli, dramatik, sakin, motivasyonel, eğitici, romantik",
  "audience": "Hedef kitle. Seçenekler: gençler, profesyoneller, genel, çocuklar, oyuncular",
  "content_type": "İçerik türü. Seçenekler: motivasyon, eğitim, eğlence, haber, vlog, gaming, müzik, spor, teknoloji, yemek, seyahat",
  "recommended_style": "Altyazı stil şablonu. Seçenekler: mrbeast (enerjik/eğlence içerikleri), hormozi (motivasyon/iş), standard (genel/eğitim), cinematic (sinematik/drama)",
  "recommended_font": "Önerilen font. Seçenekler: Impact, Arial, Montserrat, Roboto",
  "recommended_font_size": 130,
  "highlight_moments": [
    {
      "start": 0.0,
      "end": 5.0,
      "reason": "Bu anın neden önemli olduğu",
      "importance": "high/medium/low"
    }
  ],
  "crop_suggestion": "Kırpma önerisi. keep_original (orijinal bırak), vertical_9_16 (TikTok/Reels dikey), square_1_1 (Instagram kare)",
  "color_palette": {
    "primary": "Ana renk ASS formatında (örn: &H0000FFFF sarı, &H00FFFFFF beyaz, &H000000FF kırmızı)",
    "outline": "Çerçeve rengi ASS formatında",
    "shadow": "Gölge rengi ASS formatında"
  },
  "emoji_suggestions": {
    "anahtar_kelime": "emoji",
    "başka_kelime": "emoji"
  },
  "editing_notes": [
    "Genel düzenleme önerisi 1",
    "Genel düzenleme önerisi 2"
  ],
  "confidence": 0.85
}

ÖNEMLİ KURALLAR:
1. highlight_moments içindeki start/end değerleri transkriptteki zaman damgalarıyla uyumlu olmalı
2. Videonun TAMAMINI analiz et, sadece başını değil
3. emoji_suggestions: videodaki anahtar kelimelere uygun emojiler öner (en az 5-10 tane)
4. En az 3 editing_notes önerisi ver
5. confidence: analiz güvenilirliğini 0.0-1.0 arası değerlendir
6. color_palette renkleri ASS subtitle formatında olmalı (&HAABBGGRR)
7. Yanıtı SADECE JSON olarak dön, başka metin ekleme

TRANSCRIPT (zamanlanmış segmentler):
{transcript}

Kaynak dil: {source_language}
"""


def _segments_to_transcript_text(segments: list) -> str:
    """Segment listesini okunabilir transkript metnine çevir."""
    lines = []
    for seg in segments:
        start = seg.start if hasattr(seg, 'start') else seg.get('start', 0)
        end = seg.end if hasattr(seg, 'end') else seg.get('end', 0)
        text = seg.text if hasattr(seg, 'text') else seg.get('text', '')
        lines.append(f"[{start:.1f}s - {end:.1f}s] {text}")
    return "\n".join(lines)


def analyze_video_content(
    segments: list,
    video_path: Path | None = None,
    source_language: str = "unknown",
) -> AIAnalysisResult:
    """
    Video içeriğini Gemini AI ile analiz eder.

    Args:
        segments: Transkript segment listesi
        video_path: Opsiyonel — frame analizi için video dosyası
        source_language: Algılanan kaynak dil kodu

    Returns:
        AIAnalysisResult — Tüm analiz sonuçlarını içerir
    """
    if not settings.gemini_api_key:
        return AIAnalysisResult(
            topic="API key eksik",
            summary="Gemini API anahtarı ayarlanmamış.",
            editing_notes=["GEMINI_API_KEY .env dosyasına eklenmeli."],
        )

    client = _get_gemini_client()
    transcript_text = _segments_to_transcript_text(segments)

    prompt = ANALYSIS_PROMPT.format(
        transcript=transcript_text,
        source_language=source_language,
    )

    # Multimodal: video karelerini de gönder
    content_parts = []

    if video_path and video_path.is_file():
        frames = _extract_frames(video_path, count=4)
        for i, frame_bytes in enumerate(frames):
            content_parts.append(
                types.Part.from_bytes(
                    data=frame_bytes,
                    mime_type="image/jpeg",
                )
            )
            content_parts.append(f"[Video Karesi {i+1}/{len(frames)}]")

    content_parts.append(prompt)

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-04-17",
            contents=content_parts,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=4096,
            ),
        )

        # JSON yanıtını parse et
        raw = response.text.strip()
        # Bazen markdown code block içinde gelir
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        data = json.loads(raw)
        return _parse_analysis_response(data)

    except json.JSONDecodeError as e:
        return AIAnalysisResult(
            topic="Analiz Tamamlandı",
            summary=f"AI yanıtı parse edilemedi: {str(e)[:200]}",
            editing_notes=["AI yanıtı beklenmeyen formatta geldi, standart ayarlar kullanılıyor."],
            recommended_style="standard",
        )
    except Exception as e:
        return AIAnalysisResult(
            topic="Analiz Hatası",
            summary=f"AI analizi sırasında hata: {str(e)[:200]}",
            editing_notes=[f"Hata detayı: {str(e)[:500]}"],
            recommended_style="standard",
        )


def _parse_analysis_response(data: dict) -> AIAnalysisResult:
    """Gemini JSON yanıtını AIAnalysisResult'a dönüştür."""
    highlights = []
    for h in data.get("highlight_moments", []):
        highlights.append(HighlightMoment(
            start=float(h.get("start", 0)),
            end=float(h.get("end", 0)),
            reason=str(h.get("reason", "")),
            importance=str(h.get("importance", "medium")),
        ))

    return AIAnalysisResult(
        topic=str(data.get("topic", "")),
        summary=str(data.get("summary", "")),
        tone=str(data.get("tone", "")),
        audience=str(data.get("audience", "")),
        content_type=str(data.get("content_type", "")),
        recommended_style=str(data.get("recommended_style", "standard")),
        recommended_font=str(data.get("recommended_font", "Arial")),
        recommended_font_size=int(data.get("recommended_font_size", 130)),
        highlight_moments=highlights,
        crop_suggestion=str(data.get("crop_suggestion", "keep_original")),
        color_palette=data.get("color_palette", {
            "primary": "&H00FFFFFF",
            "outline": "&H00000000",
            "shadow": "&H80000000",
        }),
        emoji_suggestions=data.get("emoji_suggestions", {}),
        editing_notes=data.get("editing_notes", []),
        confidence=float(data.get("confidence", 0.0)),
    )
