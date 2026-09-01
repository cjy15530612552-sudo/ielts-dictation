from pathlib import Path

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.db.database import utc_now
from app.models.tts import TtsGenerateRequest, TtsSettingRequest
from app.services.speech_text_normalizer import normalize_speech_text
from app.services.tts_preset_service import VOICES, build_instruction, playground_config
from app.services.tts_service import TtsBusyError, TtsConfigurationError, TtsError


router = APIRouter(prefix="/api/tts", tags=["tts"])


def public_version(item: dict) -> dict:
    return {key: value for key, value in item.items() if key != "audio_path"}


@router.get("/playground/config")
async def get_playground_config(request: Request):
    return playground_config(request.app.state.settings.qwen_tts_model)


@router.get("/playground/versions")
async def list_playground_versions(request: Request):
    return [public_version(item) for item in await request.app.state.database.list_tts_versions()]


@router.post("/playground/generate", status_code=status.HTTP_201_CREATED)
async def generate_playground_audio(
    payload: TtsGenerateRequest,
    request: Request,
    api_key: str | None = Header(default=None, alias="X-DashScope-API-Key"),
):
    allowed_voices = {item["value"] for item in VOICES}
    if payload.voice and payload.voice not in allowed_voices:
        raise HTTPException(status_code=422, detail="Voice is not available for qwen-audio-3.0-tts-plus.")
    speech_text = normalize_speech_text(payload.text)
    instruction = build_instruction(payload.mode, payload.accent, payload.pace, payload.custom_instruction)
    service = request.app.state.tts_service
    try:
        generated = await service.generate(speech_text, payload.voice, instruction, payload.pace, api_key=api_key)
    except TtsBusyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except TtsConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TtsError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"TTS generation failed. {exc} Please check model configuration or API availability.",
        ) from exc
    item = {
        "id": generated["id"],
        "text": payload.text,
        "speech_text": speech_text,
        "model": request.app.state.settings.qwen_tts_model,
        "mode": payload.mode,
        "accent": payload.accent,
        "pace": payload.pace,
        "voice": generated["voice"],
        "instruction": instruction,
        "audio_url": f"/audio/playground/{generated['filename']}",
        "audio_path": str(service.output_dir / generated["filename"]),
        "created_at": utc_now(),
    }
    try:
        saved = await request.app.state.database.add_tts_version(item)
    except Exception:
        Path(item["audio_path"]).unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Generated audio could not be recorded.")
    return public_version(saved)


@router.delete("/playground/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playground_version(version_id: str, request: Request):
    item = await request.app.state.database.delete_tts_version(version_id)
    if not item:
        raise HTTPException(status_code=404, detail="TTS version not found")
    storage_root = request.app.state.tts_service.output_dir.resolve()
    path = Path(item["audio_path"]).resolve()
    if path.parent == storage_root:
        path.unlink(missing_ok=True)


@router.get("/settings")
async def list_tts_settings(request: Request):
    return await request.app.state.database.list_tts_settings()


@router.post("/settings/default", status_code=status.HTTP_201_CREATED)
async def save_default_tts_setting(payload: TtsSettingRequest, request: Request):
    voice = payload.voice or request.app.state.tts_service.settings.qwen_tts_default_voice
    if voice not in {item["value"] for item in VOICES}:
        raise HTTPException(status_code=422, detail="Voice is not available for qwen-audio-3.0-tts-plus.")
    return await request.app.state.database.save_default_tts_setting({**payload.model_dump(), "voice": voice})
