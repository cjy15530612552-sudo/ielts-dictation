from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "IELTS Transcript API"
    dashscope_api_key: str | None = Field(default=None, alias="DASHSCOPE_API_KEY")
    allow_server_api_key_fallback: bool = Field(default=False, alias="ALLOW_SERVER_API_KEY_FALLBACK")
    qwen_vision_model: str = Field(default="qwen3-vl-plus", alias="QWEN_VISION_MODEL")
    qwen_text_model: str = Field(default="qwen3.6-flash", alias="QWEN_TEXT_MODEL")
    qwen_tts_model: str = Field(default="qwen-audio-3.0-tts-plus", alias="QWEN_TTS_MODEL")
    qwen_tts_endpoint: str = Field(
        default="https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer",
        alias="QWEN_TTS_ENDPOINT",
    )
    qwen_tts_default_voice: str = Field(default="longanlingxin", alias="QWEN_TTS_DEFAULT_VOICE")
    dashscope_base_url: str = Field(
        default="https://dashscope.aliyuncs.com/compatible-mode/v1",
        alias="DASHSCOPE_BASE_URL",
    )
    qwen_request_timeout_seconds: float = Field(default=180, alias="QWEN_REQUEST_TIMEOUT_SECONDS")
    max_image_size_mb: int = Field(default=20, alias="MAX_IMAGE_SIZE_MB")
    frontend_origins: str = Field(
        default="http://localhost:4173,http://127.0.0.1:4173",
        alias="FRONTEND_ORIGINS",
    )
    data_dir: Path = BACKEND_DIR / "data"
    tts_storage_dir: Path = BACKEND_DIR / "storage" / "audio"
    env_write_path: Path = ENV_PATH

    @property
    def database_path(self) -> Path:
        return self.data_dir / "ielts_dictation.sqlite3"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
