from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Request, Response, status

from app.models.practice import PracticeCreate, PracticeUpdate, ProgressUpdate
from app.services.practice_audio import generate_practice_sentence
from app.services.tts_service import TtsBusyError, TtsConfigurationError, TtsError


router = APIRouter(prefix="/api/practices", tags=["practices"])


async def with_transcript_session(practice: dict, request: Request) -> dict:
    session = await request.app.state.session_store.latest_for_practice(practice["id"])
    return {**practice, "transcript_session_id": session["session_id"] if session else None}


@router.get("")
async def list_practices(request: Request):
    practices = await request.app.state.database.list_practices()
    return [await with_transcript_session(practice, request) for practice in practices]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_practice(payload: PracticeCreate, request: Request):
    return await request.app.state.database.create_practice(payload.name, payload.part)


@router.get("/{practice_id}")
async def get_practice(practice_id: str, request: Request):
    practice = await request.app.state.database.get_practice(practice_id)
    if not practice:
        raise HTTPException(404, "Practice not found")
    return await with_transcript_session(practice, request)


@router.put("/{practice_id}")
async def update_practice(practice_id: str, payload: PracticeUpdate, request: Request):
    practice = await request.app.state.database.update_practice(practice_id, **payload.model_dump(exclude_none=True))
    if not practice:
        raise HTTPException(404, "Practice not found")
    return practice


@router.delete("/{practice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_practice(practice_id: str, request: Request):
    if not await request.app.state.database.delete_practice(practice_id):
        raise HTTPException(404, "Practice not found")
    return Response(status_code=204)


@router.post("/{practice_id}/progress")
async def update_progress(practice_id: str, payload: ProgressUpdate, request: Request):
    practice = await request.app.state.database.get_practice(practice_id)
    if not practice:
        raise HTTPException(404, "Practice not found")
    current = min(payload.current_sentence, max(practice["total_sentences"], 1))
    updated = await request.app.state.database.update_practice(practice_id, current_sentence=current)
    return updated


@router.post("/{practice_id}/complete")
async def complete_practice(practice_id: str, request: Request):
    practice = await request.app.state.database.complete_practice(practice_id)
    if not practice:
        raise HTTPException(404, "Practice not found")
    return practice


@router.post("/{practice_id}/restart")
async def restart_practice(practice_id: str, request: Request):
    practice = await request.app.state.database.restart_practice(practice_id)
    if not practice:
        raise HTTPException(404, "Practice not found")
    return practice


@router.post("/{practice_id}/end-session")
async def end_practice_session(practice_id: str, request: Request):
    practice = await request.app.state.database.end_session(practice_id)
    if not practice:
        raise HTTPException(404, "Practice not found")
    return practice


@router.post("/{practice_id}/sentences/{sentence_id}/audio")
async def generate_sentence_audio(
    practice_id: str,
    sentence_id: str,
    request: Request,
    api_key: Annotated[str | None, Header(alias="X-DashScope-API-Key")] = None,
):
    practice = await request.app.state.database.get_practice(practice_id)
    if not practice:
        raise HTTPException(404, "Practice not found")
    sentence = next((item for item in practice["sentences"] if item["id"] == sentence_id), None)
    if not sentence:
        raise HTTPException(404, "Sentence not found")
    if sentence.get("audio_url"):
        return sentence
    try:
        generated = await generate_practice_sentence(
            request.app.state.database,
            request.app.state.tts_service,
            request.app.state.settings,
            sentence["display_text"],
            practice.get("part") or "part1",
            api_key,
        )
    except TtsConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TtsBusyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except TtsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    updated = await request.app.state.database.update_sentence_audio(
        practice_id, sentence_id, generated["speech_text"], generated["audio_url"]
    )
    if not updated:
        raise HTTPException(404, "Sentence not found")
    return updated
