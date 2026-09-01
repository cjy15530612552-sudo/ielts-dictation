import asyncio
import json
from pathlib import Path

import httpx
from pydantic import ValidationError

from app.core.config import Settings
from app.models.practice import WordExplanation


class QwenTextError(RuntimeError):
    pass


class QwenTextService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.prompt_path = Path(__file__).resolve().parents[1] / "prompts" / "word_explain_prompt.txt"

    async def explain(self, word: str, sentence: str, api_key: str | None = None) -> WordExplanation:
        fallback_key = self.settings.dashscope_api_key if self.settings.allow_server_api_key_fallback else None
        active_api_key = (api_key or fallback_key or "").strip()
        if not active_api_key:
            raise QwenTextError("DashScope API Key is not configured. Open AI 配置 or configure the backend environment.")
        prompt = await asyncio.to_thread(self.prompt_path.read_text, encoding="utf-8")
        payload = {
            "model": self.settings.qwen_text_model,
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"WORD: {word}\nSOURCE SENTENCE: {sentence}\nReturn JSON only."},
            ],
            "response_format": {"type": "json_object"},
            "enable_thinking": False,
            "temperature": 0,
        }
        try:
            async with httpx.AsyncClient(timeout=self.settings.qwen_request_timeout_seconds) as client:
                response = await client.post(
                    f"{self.settings.dashscope_base_url.rstrip('/')}/chat/completions",
                    headers={"Authorization": f"Bearer {active_api_key}"},
                    json=payload,
                )
                response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            if isinstance(content, list):
                content = "".join(item.get("text", "") for item in content if isinstance(item, dict))
            return WordExplanation.model_validate(json.loads(self._strip_fence(content)))
        except httpx.HTTPStatusError as exc:
            try:
                message = exc.response.json().get("error", {}).get("message", "upstream error")
            except ValueError:
                message = "upstream error"
            raise QwenTextError(f"Qwen text request failed ({exc.response.status_code}): {message}") from exc
        except httpx.HTTPError as exc:
            raise QwenTextError("Unable to reach the Qwen text endpoint") from exc
        except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError) as exc:
            raise QwenTextError("Qwen returned invalid word explanation JSON") from exc

    @staticmethod
    def _strip_fence(value: str) -> str:
        stripped = value.strip()
        if stripped.startswith("```"):
            lines = stripped.splitlines()[1:]
            if lines and lines[-1].strip() == "```":
                lines.pop()
            return "\n".join(lines).strip()
        return stripped
