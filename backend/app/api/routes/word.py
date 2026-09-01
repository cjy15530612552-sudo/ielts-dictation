from fastapi import APIRouter, Header, HTTPException, Request

from app.models.practice import WordExplainRequest, WordExplanation
from app.services.qwen_text import QwenTextError


router = APIRouter(prefix="/api/word", tags=["word"])


@router.post("/explain", response_model=WordExplanation)
async def explain_word(
    payload: WordExplainRequest,
    request: Request,
    api_key: str | None = Header(default=None, alias="X-DashScope-API-Key"),
):
    try:
        return await request.app.state.qwen_text_service.explain(payload.word, payload.sentence, api_key=api_key)
    except QwenTextError as exc:
        raise HTTPException(502, str(exc)) from exc
