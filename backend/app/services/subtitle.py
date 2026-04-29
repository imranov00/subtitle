from dataclasses import dataclass


def _fmt_ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")


def _fmt_ts_vtt(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"


@dataclass
class Segment:
    start: float
    end: float
    text: str


def segments_to_srt(segments: list[Segment]) -> str:
    lines: list[str] = []
    for i, seg in enumerate(segments, start=1):
        lines.append(str(i))
        lines.append(f"{_fmt_ts(seg.start)} --> {_fmt_ts(seg.end)}")
        lines.append(seg.text.strip())
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def segments_to_vtt(segments: list[Segment]) -> str:
    lines = ["WEBVTT", ""]
    for seg in segments:
        lines.append(f"{_fmt_ts_vtt(seg.start)} --> {_fmt_ts_vtt(seg.end)}")
        lines.append(seg.text.strip())
    return "\n".join(lines)


def segments_to_ass(segments: list[Segment], font: str | None = None, word_level: bool = False, style_template: str = "standard") -> str:
    import json
    
    style_opts = {}
    if font and font.startswith("{"):
        try:
            style_opts = json.loads(font)
        except Exception:
            pass

    font_family = style_opts.get("family") or font or ("Impact" if style_template == "hormozi" else "Arial")
    if font_family and font_family.startswith("{"):
        font_family = "Arial" # Fallback if parsing failed but it was JSON

    if style_template == "mrbeast":
        fontsize = 160
        primary_col = "&H0000FFFF" # Yellow
        outline_col = "&H00000000"
        shadow_col = "&H80000000"
        outline = 15
        shadow = 0
        alignment = 5
        margin_v = 0
    elif style_template == "hormozi":
        fontsize = 150
        primary_col = "&H0000FF00" # Green
        outline_col = "&H00000000"
        shadow_col = "&H80000000"
        outline = 10
        shadow = 5
        alignment = 5
        margin_v = 0
    else: # standard
        fontsize = 130 if word_level else 80
        primary_col = "&H00FFFFFF"
        outline_col = "&H00000000"
        shadow_col = "&H80000000"
        outline = 10
        shadow = 5
        alignment = 5 if word_level else 2
        margin_v = 0 if word_level else 80

    # Apply Custom Overrides
    if style_opts.get("size"):
        try:
            fontsize = int(style_opts["size"])
        except ValueError:
            pass
            
    if style_opts.get("color"):
        primary_col = str(style_opts["color"]).strip()
        # Basic validation: ensure it's ASS format or try to construct it. If user provides Hex, we just pass it to ASS (they need to provide ASS hex like &H0000FFFF)

    if style_opts.get("alignment"):
        try:
            alignment = int(style_opts["alignment"])
        except ValueError:
            pass

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_family},{fontsize},{primary_col},&H000000FF,{outline_col},{shadow_col},-1,0,0,0,100,100,0,0,1,{outline},{shadow},{alignment},10,10,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    lines = [header]
    
    def get_emoji(word: str) -> str:
        w = word.lower().strip(".,!?\"'")
        emoji_map = {
            "para": "💸", "harika": "🚀", "roket": "🚀", "gelişim": "📈",
            "üzgün": "😢", "kötü": "⬇️", "iyi": "✅", "bomba": "💣",
            "mükemmel": "✨", "ateş": "🔥", "fire": "🔥", "para": "💵",
            "dikkat": "⚠️", "zaman": "⏱️", "time": "⏱️", "ödül": "🏆",
            "para": "💰", "mutlu": "😊", "şaşkın": "😮", "beyin": "🧠"
        }
        return emoji_map.get(w, "")

    for seg in segments:
        def to_ass_time(sec: float) -> str:
            h = int(sec // 3600)
            m = int((sec % 3600) // 60)
            s = int(sec % 60)
            cs = int((sec - int(sec)) * 100)
            return f"{h}:{m:02d}:{s:02d}.{cs:02d}"
        
        text = seg.text.strip()
        em = get_emoji(text)
        if em:
            text = f"{text} {em}"

        lines.append(f"Dialogue: 0,{to_ass_time(seg.start)},{to_ass_time(seg.end)},Default,,0,0,0,,{text}")
        
    return "\n".join(lines)
