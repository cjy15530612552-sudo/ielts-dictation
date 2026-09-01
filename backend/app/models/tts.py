from typing import Literal

from pydantic import BaseModel, Field, field_validator


TtsMode = Literal["part1", "part2", "part3", "part4", "custom"]
TtsAccent = Literal["british", "australian", "neutral"]
TtsPace = Literal["slow", "normal", "fast"]


class TtsGenerateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=600)
    mode: TtsMode = "part1"
    accent: TtsAccent = "british"
    pace: TtsPace = "normal"
    voice: str | None = None
    custom_instruction: str | None = Field(default=None, max_length=1600)

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Text must not be blank")
        return value.strip()


class TtsSettingRequest(BaseModel):
    name: str = Field(default="IELTS Default", min_length=1, max_length=120)
    mode: TtsMode
    accent: TtsAccent = "british"
    pace: TtsPace = "normal"
    voice: str | None = None
    instruction: str = Field(min_length=1, max_length=1600)


class ApiKeySaveRequest(BaseModel):
    api_key: str = Field(min_length=8, max_length=512)

    @field_validator("api_key")
    @classmethod
    def validate_api_key(cls, value: str) -> str:
        key = value.strip()
        if "\n" in key or "\r" in key:
            raise ValueError("API Key contains invalid characters")
        return key
