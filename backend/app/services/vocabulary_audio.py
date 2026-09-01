from typing import Any

from app.services.speech_text_normalizer import normalize_speech_text
from app.services.tts_preset_service import DEFAULT_VOICE
from app.services.tts_service import TtsBusyError, TtsConfigurationError, TtsError


VOCABULARY_INSTRUCTION = (
    "Pronounce this English vocabulary item once in a clear, natural British English accent. "
    "Do not add a definition, spelling, introduction, repetition, or any extra words."
)


async def generate_vocabulary_pronunciation(
    tts_service,
    settings,
    word: str,
    api_key: str | None = None,
) -> dict[str, Any]:
    speech_text = normalize_speech_text(word)
    generated = await tts_service.generate(
        speech_text,
        settings.qwen_tts_default_voice or DEFAULT_VOICE,
        VOCABULARY_INSTRUCTION,
        "normal",
        api_key=api_key,
    )
    return {
        "audio_url": f"/audio/playground/{generated['filename']}",
        "filename": generated["filename"],
    }


async def ensure_vocabulary_pronunciation(
    database,
    tts_service,
    settings,
    item: dict[str, Any],
    api_key: str | None = None,
) -> dict[str, Any]:
    if item.get("audio_url") and item.get("audio_status") == "ready":
        return item
    generating = await database.update_favorite_audio(item["id"], audio_status="generating")
    try:
        generated = await generate_vocabulary_pronunciation(tts_service, settings, item["word"], api_key)
    except (TtsConfigurationError, TtsBusyError, TtsError) as exc:
        return await database.update_favorite_audio(
            item["id"], audio_status="failed", audio_error=str(exc)
        ) or generating
    return await database.update_favorite_audio(
        item["id"], audio_url=generated["audio_url"], audio_status="ready"
    ) or generating


async def backfill_vocabulary_pronunciations(database, tts_service, settings) -> None:
    for item in await database.list_favorites():
        if not item.get("audio_url") or item.get("audio_status") != "ready":
            await ensure_vocabulary_pronunciation(database, tts_service, settings, item)
