import asyncio
from pathlib import Path
from uuid import uuid4

import httpx

from app.core.config import Settings
from app.services.tts_preset_service import DEFAULT_VOICE, VOICES


class TtsError(RuntimeError):
    pass


class TtsConfigurationError(TtsError):
    pass


class TtsBusyError(TtsError):
    pass


class TtsService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.output_dir = settings.tts_storage_dir / "playground"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()

    async def generate(self, speech_text: str, voice: str | None, instruction: str, pace: str, api_key: str | None = None) -> dict:
        if self._lock.locked():
            raise TtsBusyError("Another TTS generation is already in progress.")
        fallback_key = self.settings.dashscope_api_key if self.settings.allow_server_api_key_fallback else None
        active_api_key = (api_key or fallback_key or "").strip()
        if not active_api_key:
            raise TtsConfigurationError("DashScope API Key is not configured. Open AI 配置 or configure the backend environment.")
        selected_voice = voice or self.settings.qwen_tts_default_voice or DEFAULT_VOICE
        allowed = {item["value"] for item in VOICES}
        if selected_voice not in allowed:
            raise TtsConfigurationError("The selected voice is not supported by the configured TTS model.")
        rate = {"slow": 0.9, "normal": 1.0, "fast": 1.1}[pace]
        payload = {
            "model": self.settings.qwen_tts_model,
            "input": {
                "text": speech_text,
                "voice": selected_voice,
                "format": "mp3",
                "sample_rate": 24000,
                "rate": rate,
                "language_hints": ["en"],
                "instruction": instruction,
            },
        }
        headers = {"Authorization": f"Bearer {active_api_key}", "Content-Type": "application/json"}
        async with self._lock:
            try:
                async with httpx.AsyncClient(timeout=self.settings.qwen_request_timeout_seconds) as client:
                    response = await client.post(self.settings.qwen_tts_endpoint, headers=headers, json=payload)
                    self._raise_for_status(response)
                    body = response.json()
                    audio_url = ((body.get("output") or {}).get("audio") or {}).get("url")
                    if not audio_url or not audio_url.startswith(("http://", "https://")):
                        raise TtsError("TTS returned an invalid audio URL.")
                    audio_response = await client.get(audio_url)
                    if audio_response.status_code != 200 or not audio_response.content:
                        raise TtsError("The generated audio could not be downloaded.")
            except httpx.TimeoutException as exc:
                raise TtsError("TTS request timed out.") from exc
            except httpx.RequestError as exc:
                raise TtsError("TTS service or audio download is unavailable.") from exc
            audio_id = str(uuid4())
            filename = f"playground_{audio_id}.mp3"
            path = self.output_dir / filename
            try:
                await asyncio.to_thread(path.write_bytes, audio_response.content)
            except OSError as exc:
                raise TtsError("Generated audio could not be saved.") from exc
        return {"id": audio_id, "filename": filename, "voice": selected_voice, "characters": (body.get("usage") or {}).get("characters")}

    @staticmethod
    def _raise_for_status(response: httpx.Response) -> None:
        if response.status_code == 429:
            raise TtsError("TTS rate limit reached. Please try again shortly.")
        if response.status_code in {400, 404, 422}:
            raise TtsError("TTS rejected the model, voice, or instruction parameters.")
        if response.status_code in {401, 403}:
            raise TtsConfigurationError("TTS API authentication or regional access failed.")
        if response.status_code >= 400:
            raise TtsError(f"TTS generation failed with HTTP {response.status_code}.")
