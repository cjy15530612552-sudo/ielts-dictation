from typing import Any, Literal

from pydantic import BaseModel, Field


class PracticeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    part: Literal["part1", "part2", "part3", "part4"] = "part1"


class PracticeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    part: Literal["part1", "part2", "part3", "part4"] | None = None


class ProgressUpdate(BaseModel):
    current_sentence: int = Field(ge=1)


class WordExplainRequest(BaseModel):
    word: str = Field(min_length=1, max_length=100)
    sentence: str = Field(min_length=1, max_length=2000)


class WordExplanation(BaseModel):
    word: str
    lemma: str
    phonetic_uk: str
    part_of_speech: str
    meaning_zh: str
    meaning_in_context: str


class FavoriteWordCreate(WordExplanation):
    source_sentence: str
    practice_id: str | None = None


class FavoriteWordResponse(FavoriteWordCreate):
    id: str
    created_at: str
    practice_name: str | None = None
    dedupe_key: str | None = None


class FavoriteCreateResponse(BaseModel):
    item: FavoriteWordResponse
    created: bool


PracticeResponse = dict[str, Any]
