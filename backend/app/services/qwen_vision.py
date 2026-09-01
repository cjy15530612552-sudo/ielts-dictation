import asyncio
import base64
import json
from pathlib import Path

import httpx
from pydantic import ValidationError

from app.core.config import Settings
from app.models.transcript import TranscriptData


class QwenVisionError(RuntimeError):
    pass


class QwenConfigurationError(QwenVisionError):
    pass


class QwenVisionService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.prompt_path = Path(__file__).resolve().parents[1] / "prompts" / "ielts_ocr_prompt.txt"

    async def analyze(self, images: list[tuple[Path, str]], api_key: str | None = None) -> TranscriptData:
        fallback_key = self.settings.dashscope_api_key if self.settings.allow_server_api_key_fallback else None
        active_api_key = (api_key or fallback_key or "").strip()
        if not active_api_key:
            raise QwenConfigurationError(
                "DashScope API Key is not configured. Open AI 配置 or configure the backend environment."
            )
        if not images:
            raise QwenVisionError("No ordered images were provided for analysis.")

        system_prompt = await asyncio.to_thread(self.prompt_path.read_text, encoding="utf-8")
        image_content = []
        for image_path, content_type in images:
            encoded = await asyncio.to_thread(self._data_uri, image_path, content_type)
            image_content.append({"type": "image_url", "image_url": {"url": encoded}})

        payload = {
            "model": self.settings.qwen_vision_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                f"These {len(images)} screenshots are ordered consecutive parts of one "
                                "IELTS Listening transcript. Process them strictly as Image 1 through "
                                f"Image {len(images)} and return the requested JSON only."
                            ),
                        },
                        *image_content,
                    ],
                },
            ],
            "response_format": {"type": "json_object"},
            "enable_thinking": False,
            "temperature": 0,
        }

        endpoint = f"{self.settings.dashscope_base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {active_api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=self.settings.qwen_request_timeout_seconds) as client:
                response = await client.post(endpoint, headers=headers, json=payload)
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise QwenVisionError("Qwen Vision request timed out.") from exc
        except httpx.HTTPStatusError as exc:
            detail = self._safe_error_detail(exc.response)
            raise QwenVisionError(f"Qwen Vision request failed ({exc.response.status_code}): {detail}") from exc
        except httpx.HTTPError as exc:
            raise QwenVisionError("Unable to reach the Qwen Vision endpoint.") from exc

        try:
            body = response.json()
            content = body["choices"][0]["message"]["content"]
            raw_json = self._content_text(content)
            parsed = json.loads(self._strip_code_fence(raw_json))
            return TranscriptData.model_validate(parsed)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError) as exc:
            raise QwenVisionError("Qwen returned JSON that did not match the transcript schema.") from exc

    @staticmethod
    def _data_uri(path: Path, content_type: str) -> str:
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        return f"data:{content_type};base64,{encoded}"

    @staticmethod
    def _content_text(content: object) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = [item.get("text", "") for item in content if isinstance(item, dict)]
            return "".join(parts)
        raise TypeError("Unsupported Qwen response content")

    @staticmethod
    def _strip_code_fence(content: str) -> str:
        stripped = content.strip()
        if stripped.startswith("```"):
            lines = stripped.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            return "\n".join(lines).strip()
        return stripped

    @staticmethod
    def _safe_error_detail(response: httpx.Response) -> str:
        try:
            body = response.json()
            return str(body.get("error", {}).get("message") or body.get("message") or "Upstream error")[:500]
        except (ValueError, TypeError):
            return "Upstream error"
