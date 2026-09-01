from typing import Any

from app.services.speech_text_normalizer import normalize_speech_text
from app.services.tts_preset_service import DEFAULT_VOICE, build_instruction


async def resolve_practice_voice(database, settings, part: str) -> dict[str, str]:
    saved = next(
        (item for item in await database.list_tts_settings() if item["mode"] == part and item["is_default"]),
        None,
    )
    accent = saved["accent"] if saved else "british"
    pace = saved["pace"] if saved else "normal"
    voice = saved["voice"] if saved else (settings.qwen_tts_default_voice or DEFAULT_VOICE)
    instruction = build_instruction(part, accent, pace, saved["instruction"] if saved else None)
    return {"accent": accent, "pace": pace, "voice": voice, "instruction": instruction}


async def generate_practice_sentence(
    database,
    tts_service,
    settings,
    text: str,
    part: str,
    api_key: str | None = None,
) -> dict[str, Any]:
    options = await resolve_practice_voice(database, settings, part)
    speech_text = normalize_speech_text(text)
    generated = await tts_service.generate(
        speech_text,
        options["voice"],
        options["instruction"],
        options["pace"],
        api_key=api_key,
    )
    return {
        "speech_text": speech_text,
        "audio_url": f"/audio/playground/{generated['filename']}",
        "filename": generated["filename"],
    }
