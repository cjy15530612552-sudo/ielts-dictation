from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.services.speech_text_normalizer import normalize_speech_text


class FakeTtsService:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.settings = type("FakeSettings", (), {"qwen_tts_default_voice": "longanlingxin"})()
        self.received = None

    async def generate(self, speech_text: str, voice: str | None, instruction: str, pace: str, api_key: str | None = None):
        self.received = (speech_text, voice, instruction, pace, api_key)
        filename = "playground_test-id.mp3"
        (self.output_dir / filename).write_bytes(b"ID3test-audio")
        return {"id": "test-id", "filename": filename, "voice": voice or "longanlingxin", "characters": len(speech_text)}


def make_client(tmp_path: Path):
    settings = Settings(
        data_dir=tmp_path / "data",
        tts_storage_dir=tmp_path / "audio",
        env_write_path=tmp_path / ".env",
        dashscope_api_key=None,
        allow_server_api_key_fallback=False,
    )
    app = create_app(settings)
    fake = FakeTtsService(settings.tts_storage_dir / "playground")
    app.state.tts_service = fake
    return TestClient(app), fake


def test_speech_text_normalizer_keeps_display_text_separate():
    source = "The fee is £15.50 at 10:30 on 21st May. Email john.smith@gmail.com; postcode SW1A 1AA."
    normalized = normalize_speech_text(source)
    assert source == "The fee is £15.50 at 10:30 on 21st May. Email john.smith@gmail.com; postcode SW1A 1AA."
    assert "fifteen pounds fifty" in normalized
    assert "ten thirty" in normalized
    assert "the twenty-first of May" in normalized
    assert "john dot smith at gmail dot com" in normalized
    assert "S W one A, one A A" in normalized


def test_phone_and_year_normalization():
    assert normalize_speech_text("Call 07700 900123.") == "Call zero seven seven zero zero, nine zero zero one two three."
    assert normalize_speech_text("It happened in 1998.") == "It happened in nineteen ninety-eight."


def test_generate_list_play_delete_and_save_default(tmp_path: Path):
    client, fake = make_client(tmp_path)
    payload = {
        "text": "The fee is £15.50.", "mode": "part1", "accent": "british",
        "pace": "normal", "voice": "longanlingxin", "custom_instruction": None,
    }
    response = client.post(
        "/api/tts/playground/generate",
        json=payload,
        headers={"X-DashScope-API-Key": "test-session-key"},
    )
    assert response.status_code == 201, response.text
    item = response.json()
    assert item["speech_text"] == "The fee is fifteen pounds fifty."
    assert item["audio_url"] == "/audio/playground/playground_test-id.mp3"
    assert "audio_path" not in item
    assert "natural British English" in fake.received[2]
    assert fake.received[4] == "test-session-key"
    assert client.get(item["audio_url"]).content == b"ID3test-audio"
    assert len(client.get("/api/tts/playground/versions").json()) == 1

    setting = client.post("/api/tts/settings/default", json={
        "name": "Part 1 Default", "mode": "part1", "accent": "british", "pace": "normal",
        "voice": "longanlingxin", "instruction": item["instruction"],
    })
    assert setting.status_code == 201
    assert setting.json()["is_default"] is True
    assert len(client.get("/api/tts/settings").json()) == 1

    assert client.delete(f"/api/tts/playground/versions/{item['id']}").status_code == 204
    assert client.get("/api/tts/playground/versions").json() == []
    assert not (fake.output_dir / "playground_test-id.mp3").exists()


def test_rejects_unofficial_voice(tmp_path: Path):
    client, _ = make_client(tmp_path)
    response = client.post("/api/tts/playground/generate", json={
        "text": "Hello", "mode": "part1", "accent": "british", "pace": "normal", "voice": "Voice A",
    })
    assert response.status_code == 422


def test_locked_ai_config_does_not_return_api_key(tmp_path: Path):
    client, _ = make_client(tmp_path)
    response = client.get("/api/ai/config")
    assert response.status_code == 200
    body = response.json()
    assert body["models"]["text"]["name"] == "qwen3.6-flash"
    assert body["models"]["vision"]["name"] == "qwen3-vl-plus"
    assert body["models"]["tts"]["name"] == "qwen-audio-3.0-tts-plus"
    assert "api_key" not in str(body).lower()


def test_local_ai_key_setup_persists_env_without_returning_key(tmp_path: Path):
    client, _ = make_client(tmp_path)
    headers = {"Origin": "http://127.0.0.1:4173"}
    response = client.post("/api/ai/key", json={"api_key": "test-local-setup-key"}, headers=headers)
    assert response.status_code == 200, response.text
    assert response.json() == {"configured": True, "saved_to": "backend/.env"}
    content = (tmp_path / ".env").read_text(encoding="utf-8")
    assert "DASHSCOPE_API_KEY=test-local-setup-key" in content
    assert "ALLOW_SERVER_API_KEY_FALLBACK=true" in content
    assert client.app.state.settings.dashscope_api_key == "test-local-setup-key"

    cleared = client.delete("/api/ai/key", headers=headers)
    assert cleared.status_code == 200
    content = (tmp_path / ".env").read_text(encoding="utf-8")
    assert "test-local-setup-key" not in content
    assert "ALLOW_SERVER_API_KEY_FALLBACK=false" in content


def test_remote_origin_cannot_write_backend_env(tmp_path: Path):
    client, _ = make_client(tmp_path)
    response = client.post(
        "/api/ai/key",
        json={"api_key": "test-remote-key"},
        headers={"Origin": "https://public.example"},
    )
    assert response.status_code == 403
    assert not (tmp_path / ".env").exists()
