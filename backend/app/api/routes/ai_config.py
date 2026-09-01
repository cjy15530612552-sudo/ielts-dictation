from ipaddress import ip_address
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request, status

from app.models.tts import ApiKeySaveRequest
from app.services.env_config_service import EnvConfigError


router = APIRouter(prefix="/api/ai", tags=["ai-config"])


def _is_loopback(host: str | None) -> bool:
    if not host:
        return False
    if host in {"localhost", "testclient"}:
        return True
    try:
        return ip_address(host).is_loopback
    except ValueError:
        return False


def local_env_setup_allowed(request: Request) -> bool:
    client_host = request.client.host if request.client else None
    origin = request.headers.get("origin")
    origin_host = urlparse(origin).hostname if origin else None
    return _is_loopback(client_host) and _is_loopback(origin_host)


@router.get("/config")
async def get_ai_config(request: Request):
    settings = request.app.state.settings
    return {
        "models": {
            "text": {"name": settings.qwen_text_model, "base_url": settings.dashscope_base_url},
            "vision": {"name": settings.qwen_vision_model, "base_url": settings.dashscope_base_url},
            "tts": {"name": settings.qwen_tts_model, "base_url": settings.qwen_tts_endpoint},
        },
        "server_key_configured": bool(settings.dashscope_api_key and settings.allow_server_api_key_fallback),
        "key_storage": "backend-env",
        "env_setup_available": local_env_setup_allowed(request),
    }


@router.post("/key", status_code=status.HTTP_200_OK)
async def save_api_key(payload: ApiKeySaveRequest, request: Request):
    if not local_env_setup_allowed(request):
        raise HTTPException(status_code=403, detail="Writing backend/.env is only available from this machine.")
    try:
        await request.app.state.env_config_service.save_dashscope_key(payload.api_key)
    except EnvConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    request.app.state.settings.dashscope_api_key = payload.api_key
    request.app.state.settings.allow_server_api_key_fallback = True
    return {"configured": True, "saved_to": "backend/.env"}


@router.delete("/key", status_code=status.HTTP_200_OK)
async def clear_api_key(request: Request):
    if not local_env_setup_allowed(request):
        raise HTTPException(status_code=403, detail="Writing backend/.env is only available from this machine.")
    try:
        await request.app.state.env_config_service.clear_dashscope_key()
    except EnvConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    request.app.state.settings.dashscope_api_key = None
    request.app.state.settings.allow_server_api_key_fallback = False
    return {"configured": False, "saved_to": "backend/.env"}
