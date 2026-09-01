from dataclasses import dataclass


@dataclass(frozen=True)
class TtsOption:
    value: str
    label: str


MODE_INSTRUCTIONS = {
    "part1": (
        "Speak in natural British English at a normal IELTS Listening test pace. "
        "Use natural connected speech, weak forms, contractions, sentence stress and realistic conversational pauses. "
        "Sound like a normal person having a real conversation. Do not speak like an English teacher. "
        "Do not separate every word clearly. Do not exaggerate pronunciation. Keep the speech clear but natural."
    ),
    "part2": (
        "Speak in natural British English at a normal IELTS Listening test pace. "
        "Use a calm, natural monologue style. Maintain natural connected speech, sentence stress, weak forms and realistic pauses. "
        "Sound like a guide, presenter or person giving practical information. Do not speak slowly for learners."
    ),
    "part3": (
        "Speak in natural British English at a normal IELTS Listening test pace. "
        "Use natural conversational rhythm and connected speech. Use weak forms, contractions and realistic hesitation where appropriate. "
        "Sound like university students or academic participants discussing a topic naturally. Do not sound scripted or teacher-like."
    ),
    "part4": (
        "Speak in natural British English at a normal IELTS Listening test pace. "
        "Use a clear but natural academic lecture style. Maintain connected speech, natural sentence stress, weak forms and realistic pauses. "
        "Do not over-articulate individual words. Sound like a university lecturer speaking naturally to an audience."
    ),
    "custom": "Speak clearly and naturally in English.",
}

ACCENT_INSTRUCTIONS = {
    "british": "Use a natural British English accent.",
    "australian": "Use a natural Australian English accent.",
    "neutral": "Use a natural neutral English accent.",
}

PACE_INSTRUCTIONS = {
    "slow": "Speak slightly slower than a normal IELTS Listening test, while keeping natural connected speech.",
    "normal": "Speak at a natural IELTS Listening test pace.",
    "fast": "Speak slightly faster than a normal IELTS Listening test while remaining natural and intelligible.",
}

MODES = [
    TtsOption("part1", "Part 1 Conversation"),
    TtsOption("part2", "Part 2 Monologue"),
    TtsOption("part3", "Part 3 Discussion"),
    TtsOption("part4", "Part 4 Academic Lecture"),
    TtsOption("custom", "Custom"),
]

ACCENTS = [
    TtsOption("british", "British English"),
    TtsOption("australian", "Australian English"),
    TtsOption("neutral", "Neutral English"),
]

PACES = [
    TtsOption("slow", "Slightly Slow"),
    TtsOption("normal", "IELTS Normal"),
    TtsOption("fast", "Slightly Fast"),
]

# Official qwen-audio-3.0-tts-plus system voices documented by Alibaba Cloud.
VOICES = [
    {"value": "longanlingxin", "label": "Longan Lingxin · Female", "description": "Warm, attentive; Chinese and English"},
    {"value": "longanlufeng", "label": "Longan Lufeng · Male", "description": "Bright, open; Chinese and English"},
]

DEFAULT_VOICE = "longanlingxin"


def build_instruction(mode: str, accent: str, pace: str, custom_instruction: str | None = None) -> str:
    mode_text = custom_instruction.strip() if custom_instruction and custom_instruction.strip() else MODE_INSTRUCTIONS[mode]
    parts = [mode_text]
    accent_text = ACCENT_INSTRUCTIONS[accent]
    pace_text = PACE_INSTRUCTIONS[pace]
    if accent_text.casefold() not in mode_text.casefold():
        parts.append(accent_text)
    if pace_text.casefold() not in mode_text.casefold():
        parts.append(pace_text)
    return " ".join(parts)


def playground_config(model: str) -> dict:
    return {
        "model": model,
        "modes": [{"value": item.value, "label": item.label, "instruction": MODE_INSTRUCTIONS[item.value]} for item in MODES],
        "accents": [{"value": item.value, "label": item.label, "instruction": ACCENT_INSTRUCTIONS[item.value]} for item in ACCENTS],
        "paces": [{"value": item.value, "label": item.label, "instruction": PACE_INSTRUCTIONS[item.value]} for item in PACES],
        "voices": VOICES,
        "default_voice": DEFAULT_VOICE,
    }
