import asyncio
from pathlib import Path

import httpx

from app.core.config import Settings
from app.services import tts_service as tts_module
from app.services.tts_service import TtsService


def make_service(tmp_path: Path) -> TtsService:
    settings = Settings(
        data_dir=tmp_path / "data",
        tts_storage_dir=tmp_path / "audio",
        env_write_path=tmp_path / ".env",
        dashscope_api_key="test-key",
        allow_server_api_key_fallback=True,
    )
    service = TtsService(settings)
    service.retry_base_delay_seconds = 0
    return service


def install_mock_client(monkeypatch, handler):
    real_async_client = httpx.AsyncClient
    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(
        tts_module.httpx,
        "AsyncClient",
        lambda **kwargs: real_async_client(transport=transport, **kwargs),
    )


def generate(service: TtsService):
    return asyncio.run(
        service.generate(
            "Network test.",
            "longanlingxin",
            "Read clearly.",
            "normal",
        )
    )


def test_retries_tts_request_after_transient_connection_error(tmp_path: Path, monkeypatch):
    calls = {"post": 0, "get": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            calls["post"] += 1
            if calls["post"] == 1:
                raise httpx.ConnectError("temporary connection failure", request=request)
            return httpx.Response(
                200,
                json={
                    "output": {"audio": {"url": "https://audio.example/test.mp3"}},
                    "usage": {"characters": 13},
                },
            )
        calls["get"] += 1
        return httpx.Response(200, content=b"ID3test-audio", headers={"content-type": "audio/mpeg"})

    install_mock_client(monkeypatch, handler)
    service = make_service(tmp_path)

    result = generate(service)

    assert calls == {"post": 2, "get": 1}
    assert (service.output_dir / result["filename"]).read_bytes() == b"ID3test-audio"


def test_retries_audio_download_without_regenerating(tmp_path: Path, monkeypatch):
    calls = {"post": 0, "get": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            calls["post"] += 1
            return httpx.Response(
                200,
                json={"output": {"audio": {"url": "https://audio.example/test.mp3"}}},
            )
        calls["get"] += 1
        if calls["get"] == 1:
            raise httpx.ReadError("temporary download failure", request=request)
        return httpx.Response(200, content=b"ID3test-audio")

    install_mock_client(monkeypatch, handler)
    service = make_service(tmp_path)

    generate(service)

    assert calls == {"post": 1, "get": 2}
