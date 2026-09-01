import asyncio
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, File, Form, Header, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse

from app.db.database import prepare_transcript_sentences
from app.models.transcript import (
    AnalyzeRequest,
    ImageInfo,
    TranscriptSession,
    TranscriptUpdateRequest,
)
from app.services.qwen_vision import QwenVisionError
from app.services.practice_audio import generate_practice_sentence
from app.services.session_store import SessionNotFoundError, SessionStore
from app.services.tts_service import TtsBusyError, TtsConfigurationError, TtsError
from app.services.transcript_normalizer import normalize_transcript_segments


router = APIRouter(prefix="/api/transcript", tags=["transcript"])

ALLOWED_SUFFIXES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


def get_store(request: Request) -> SessionStore:
    return request.app.state.session_store


def public_session(raw: dict) -> TranscriptSession:
    session_id = raw["session_id"]
    images = [
        ImageInfo(
            id=image["id"],
            original_name=image["original_name"],
            content_type=image["content_type"],
            order=image["order"],
            size_bytes=image["size_bytes"],
            url=f"/api/transcript/{session_id}/images/{image['id']}",
        )
        for image in sorted(raw["images"], key=lambda item: item["order"])
    ]
    return TranscriptSession.model_validate({**raw, "images": images})


def validate_image_content(data: bytes, content_type: str) -> bool:
    if content_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP"
    return False


@router.post("/upload", response_model=TranscriptSession, status_code=status.HTTP_201_CREATED)
async def upload_transcript_images(
    request: Request,
    files: Annotated[list[UploadFile], File(description="One to six ordered transcript screenshots")],
    practice_id: Annotated[str | None, Form()] = None,
) -> TranscriptSession:
    if not 1 <= len(files) <= 6:
        raise HTTPException(status_code=400, detail="每次必须上传 1-6 张图片")

    settings = request.app.state.settings
    max_bytes = settings.max_image_size_mb * 1024 * 1024
    validated: list[tuple[UploadFile, bytes, str, str]] = []
    for upload in files:
        original_name = Path(upload.filename or "image").name
        suffix = Path(original_name).suffix.lower()
        expected_type = ALLOWED_SUFFIXES.get(suffix)
        if not expected_type:
            raise HTTPException(status_code=400, detail=f"不支持的图片格式：{original_name}")
        data = await upload.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"图片 {original_name} 超过 {settings.max_image_size_mb} MB",
            )
        if not validate_image_content(data, expected_type):
            raise HTTPException(status_code=400, detail=f"图片内容与格式不匹配：{original_name}")
        validated.append((upload, data, original_name, expected_type))

    if practice_id and not await request.app.state.database.get_practice(practice_id):
        raise HTTPException(status_code=400, detail="Practice not found")

    store = get_store(request)
    session = await store.create([], practice_id=practice_id)
    session_id = session["session_id"]
    upload_dir = store.upload_dir(session_id)
    image_records = []
    for order, (_, data, original_name, content_type) in enumerate(validated, start=1):
        image_id = str(uuid4())
        suffix = Path(original_name).suffix.lower()
        stored_name = f"{order:02d}-{image_id}{suffix}"
        await asyncio.to_thread((upload_dir / stored_name).write_bytes, data)
        image_records.append(
            {
                "id": image_id,
                "original_name": original_name,
                "content_type": content_type,
                "order": order,
                "size_bytes": len(data),
                "stored_name": stored_name,
            }
        )

    session = await store.update(session_id, images=image_records)
    return public_session(session)


@router.post("/analyze", response_model=TranscriptSession)
async def analyze_transcript(
    payload: AnalyzeRequest,
    request: Request,
    api_key: Annotated[str | None, Header(alias="X-DashScope-API-Key")] = None,
) -> TranscriptSession:
    store = get_store(request)
    try:
        session = await store.get(payload.session_id)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Transcript session not found") from exc

    if session["status"] == "analyzing":
        raise HTTPException(status_code=409, detail="该 transcript 正在识别中")
    if not session["images"]:
        raise HTTPException(status_code=400, detail="该 session 没有可识别的图片")

    await store.update(payload.session_id, status="analyzing", error=None)
    ordered_images = sorted(session["images"], key=lambda item: item["order"])
    image_inputs = [
        (store.upload_dir(payload.session_id) / image["stored_name"], image["content_type"])
        for image in ordered_images
    ]

    try:
        transcript = normalize_transcript_segments(
            await request.app.state.qwen_vision_service.analyze(image_inputs, api_key=api_key)
        )
    except QwenVisionError as exc:
        await store.update(payload.session_id, status="error", error=str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    session = await store.update(
        payload.session_id,
        status="completed",
        transcript=transcript.model_dump(mode="json"),
        error=None,
    )
    return public_session(session)


@router.get("/{session_id}", response_model=TranscriptSession)
async def get_transcript_session(session_id: str, request: Request) -> TranscriptSession:
    try:
        return public_session(await get_store(request).get(session_id))
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Transcript session not found") from exc


@router.put("/{session_id}", response_model=TranscriptSession)
async def update_transcript_session(
    session_id: str,
    payload: TranscriptUpdateRequest,
    request: Request,
    api_key: Annotated[str | None, Header(alias="X-DashScope-API-Key")] = None,
) -> TranscriptSession:
    store = get_store(request)
    try:
        current_session = await store.get(session_id)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Transcript session not found") from exc

    normalized_transcript = normalize_transcript_segments(payload.transcript)
    normalized_data = normalized_transcript.model_dump(mode="json")
    prepared = prepare_transcript_sentences(normalized_data)
    if payload.confirmed and not prepared:
        raise HTTPException(status_code=422, detail="没有可用于练习的完整句子")

    if payload.confirmed and current_session.get("practice_id"):
        practice = await request.app.state.database.get_practice(current_session["practice_id"])
        if not practice:
            raise HTTPException(status_code=404, detail="Practice not found")
        generated_files: list[Path] = []
        try:
            for item in prepared:
                generated = await generate_practice_sentence(
                    request.app.state.database,
                    request.app.state.tts_service,
                    request.app.state.settings,
                    item["display_text"],
                    practice.get("part") or "part1",
                    api_key,
                )
                item.update({"speech_text": generated["speech_text"], "audio_url": generated["audio_url"]})
                generated_files.append(request.app.state.tts_service.output_dir / generated["filename"])
        except TtsConfigurationError as exc:
            for path in generated_files:
                path.unlink(missing_ok=True)
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except TtsBusyError as exc:
            for path in generated_files:
                path.unlink(missing_ok=True)
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except TtsError as exc:
            for path in generated_files:
                path.unlink(missing_ok=True)
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    session = await store.update(
        session_id,
        transcript=normalized_data,
        status="confirmed" if payload.confirmed else "completed",
        error=None,
    )
    if payload.confirmed and session.get("practice_id"):
        await request.app.state.database.set_transcript(
            session["practice_id"], normalized_data, prepared
        )
    return public_session(session)


@router.get("/{session_id}/images/{image_id}", response_class=FileResponse)
async def get_transcript_image(session_id: str, image_id: str, request: Request) -> FileResponse:
    store = get_store(request)
    try:
        session = await store.get(session_id)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Transcript session not found") from exc

    image = next((item for item in session["images"] if item["id"] == image_id), None)
    if not image:
        raise HTTPException(status_code=404, detail="Transcript image not found")
    image_path = store.upload_dir(session_id) / image["stored_name"]
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Transcript image file not found")
    return FileResponse(image_path, media_type=image["content_type"], filename=image["original_name"])
