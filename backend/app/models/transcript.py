from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


SessionStatus = Literal["uploaded", "analyzing", "completed", "confirmed", "error"]
TranscriptType = Literal["dialogue", "monologue", "unknown"]


class UncertainToken(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str
    reason: str
    segment_id: int | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)


class TranscriptSegment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    speaker: str = ""
    text: str
    confidence: float = Field(default=1, ge=0, le=1)
    uncertain: bool = False


class TranscriptData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = ""
    type: TranscriptType = "unknown"
    speakers: list[str] = Field(default_factory=list)
    full_text: str
    segments: list[TranscriptSegment] = Field(default_factory=list)
    uncertain_tokens: list[UncertainToken] = Field(default_factory=list)


class ImageInfo(BaseModel):
    id: str
    original_name: str
    content_type: str
    order: int
    size_bytes: int
    url: str


class TranscriptSession(BaseModel):
    session_id: str
    practice_id: str | None = None
    status: SessionStatus
    created_at: datetime
    updated_at: datetime
    images: list[ImageInfo]
    transcript: TranscriptData | None = None
    error: str | None = None


class AnalyzeRequest(BaseModel):
    session_id: str


class TranscriptUpdateRequest(BaseModel):
    transcript: TranscriptData
    confirmed: bool = True
