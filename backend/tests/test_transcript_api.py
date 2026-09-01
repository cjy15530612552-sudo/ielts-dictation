from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.models.transcript import TranscriptData


PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"test-image"


class FakeQwenVisionService:
    def __init__(self) -> None:
        self.received: list[tuple[Path, str]] = []

    async def analyze(self, images: list[tuple[Path, str]], api_key: str | None = None) -> TranscriptData:
        self.received = images
        self.api_key = api_key
        return TranscriptData.model_validate(
            {
                "title": "Library tour",
                "type": "monologue",
                "speakers": ["GUIDE"],
                "full_text": "The library is located on the second floor. It closes at six.",
                "segments": [
                    {
                        "id": 1,
                        "speaker": "GUIDE",
                        "text": "The library is located on the second floor. It closes at six.",
                        "confidence": 0.98,
                        "uncertain": False,
                    }
                ],
                "uncertain_tokens": [],
            }
        )


def make_client(tmp_path: Path) -> tuple[TestClient, FakeQwenVisionService]:
    settings = Settings(data_dir=tmp_path / "data")
    app = create_app(settings)
    fake_qwen = FakeQwenVisionService()
    app.state.qwen_vision_service = fake_qwen
    return TestClient(app), fake_qwen


def upload_two_images(client: TestClient) -> dict:
    response = client.post(
        "/api/transcript/upload",
        files=[
            ("files", ("page-1.png", PNG_BYTES, "image/png")),
            ("files", ("page-2.png", PNG_BYTES, "image/png")),
        ],
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_upload_analyze_get_update_and_image(tmp_path: Path) -> None:
    client, fake_qwen = make_client(tmp_path)
    uploaded = upload_two_images(client)
    session_id = uploaded["session_id"]

    assert uploaded["status"] == "uploaded"
    assert [image["order"] for image in uploaded["images"]] == [1, 2]
    assert [image["original_name"] for image in uploaded["images"]] == ["page-1.png", "page-2.png"]

    analyzed_response = client.post(
        "/api/transcript/analyze",
        json={"session_id": session_id},
        headers={"X-DashScope-API-Key": "test-session-key"},
    )
    assert analyzed_response.status_code == 200, analyzed_response.text
    analyzed = analyzed_response.json()
    assert analyzed["status"] == "completed"
    assert analyzed["transcript"]["type"] == "monologue"
    assert analyzed["transcript"]["full_text"].startswith("The library")
    assert [item["text"] for item in analyzed["transcript"]["segments"]] == [
        "The library is located on the second floor.", "It closes at six.",
    ]
    assert [item["id"] for item in analyzed["transcript"]["segments"]] == [1, 2]
    assert [path.name[:2] for path, _ in fake_qwen.received] == ["01", "02"]
    assert fake_qwen.api_key == "test-session-key"

    get_response = client.get(f"/api/transcript/{session_id}")
    assert get_response.status_code == 200
    assert get_response.json()["transcript"] == analyzed["transcript"]

    updated_transcript = analyzed["transcript"]
    updated_transcript["full_text"] = "The library is on the second floor."
    update_response = client.put(
        f"/api/transcript/{session_id}",
        json={"transcript": updated_transcript, "confirmed": True},
    )
    assert update_response.status_code == 200, update_response.text
    assert update_response.json()["status"] == "confirmed"
    assert update_response.json()["transcript"]["full_text"] == "The library is on the second floor."

    image_response = client.get(uploaded["images"][0]["url"])
    assert image_response.status_code == 200
    assert image_response.content == PNG_BYTES


def test_upload_rejects_more_than_six_images(tmp_path: Path) -> None:
    client, _ = make_client(tmp_path)
    response = client.post(
        "/api/transcript/upload",
        files=[("files", (f"page-{index}.png", PNG_BYTES, "image/png")) for index in range(7)],
    )
    assert response.status_code == 400
    assert "1-6" in response.json()["detail"]


def test_upload_accepts_exactly_six_images_in_order(tmp_path: Path) -> None:
    client, _ = make_client(tmp_path)
    response = client.post(
        "/api/transcript/upload",
        files=[("files", (f"page-{index}.png", PNG_BYTES, "image/png")) for index in range(1, 7)],
    )
    assert response.status_code == 201, response.text
    images = response.json()["images"]
    assert [image["order"] for image in images] == [1, 2, 3, 4, 5, 6]
    assert [image["original_name"] for image in images] == [f"page-{index}.png" for index in range(1, 7)]


def test_upload_rejects_unsupported_or_spoofed_files(tmp_path: Path) -> None:
    client, _ = make_client(tmp_path)
    unsupported = client.post(
        "/api/transcript/upload",
        files=[("files", ("transcript.pdf", b"%PDF", "application/pdf"))],
    )
    assert unsupported.status_code == 400

    spoofed = client.post(
        "/api/transcript/upload",
        files=[("files", ("fake.png", b"not-a-png", "image/png"))],
    )
    assert spoofed.status_code == 400


def test_missing_session_returns_404(tmp_path: Path) -> None:
    client, _ = make_client(tmp_path)
    assert client.get("/api/transcript/missing").status_code == 404
    assert client.put(
        "/api/transcript/missing",
        json={
            "transcript": {
                "title": "",
                "type": "unknown",
                "speakers": [],
                "full_text": "",
                "segments": [],
                "uncertain_tokens": [],
            }
        },
    ).status_code == 404
