import asyncio
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.models.practice import WordExplanation
from app.services.tts_service import TtsError


PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"test-image"


class FakeTextService:
    def __init__(self):
        self.received = None

    async def explain(self, word: str, sentence: str, api_key: str | None = None) -> WordExplanation:
        self.received = (word, sentence, api_key)
        return WordExplanation(
            word=word, lemma="bank", phonetic_uk="/bæŋk/", part_of_speech="noun",
            meaning_zh="河岸", meaning_in_context="这里表示河流旁边的岸边",
        )


class FakeTtsService:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.settings = type("FakeSettings", (), {"qwen_tts_default_voice": "longanlingxin"})()
        self.calls = []

    async def generate(self, speech_text, voice, instruction, pace, api_key=None):
        self.calls.append(speech_text)
        filename = f"practice-test-{len(self.calls)}.mp3"
        (self.output_dir / filename).write_bytes(b"ID3practice-audio")
        return {"id": str(len(self.calls)), "filename": filename, "voice": voice, "characters": len(speech_text)}


class FailingTtsService(FakeTtsService):
    async def generate(self, speech_text, voice, instruction, pace, api_key=None):
        if self.calls:
            raise TtsError("temporary generation failure")
        return await super().generate(speech_text, voice, instruction, pace, api_key)


class AlwaysFailingTtsService(FakeTtsService):
    async def generate(self, speech_text, voice, instruction, pace, api_key=None):
        raise TtsError("temporary generation failure")


def make_client(tmp_path: Path):
    settings = Settings(data_dir=tmp_path / "data", tts_storage_dir=tmp_path / "audio")
    app = create_app(settings)
    fake = FakeTextService()
    app.state.qwen_text_service = fake
    app.state.tts_service = FakeTtsService(settings.tts_storage_dir / "playground")
    return TestClient(app), fake


def test_practice_transcript_progress_and_completion(tmp_path: Path):
    client, _ = make_client(tmp_path)
    created = client.post("/api/practices", json={"name": "剑雅18 Test 1 Part 4", "part": "part4"}).json()
    assert created["part"] == "part4"
    assert created["audio_ready"] is False
    assert created["audio_ready_count"] == 0
    practice_id = created["id"]
    uploaded = client.post(
        "/api/transcript/upload",
        data={"practice_id": practice_id},
        files=[("files", ("page.png", PNG_BYTES, "image/png"))],
    ).json()
    transcript = {
        "title": "Test", "type": "dialogue", "speakers": ["A", "B"],
        "full_text": "Hello there. The bank is beside the river.",
        "segments": [
            {"id": 1, "speaker": "A", "text": "Hello there. How are you?", "confidence": 1, "uncertain": False},
            {"id": 2, "speaker": "B", "text": "The bank is beside the river.", "confidence": 1, "uncertain": False},
        ], "uncertain_tokens": [],
    }
    confirmed = client.put(
        f"/api/transcript/{uploaded['session_id']}", json={"transcript": transcript, "confirmed": True},
    )
    assert confirmed.status_code == 200
    practice = client.get(f"/api/practices/{practice_id}").json()
    assert practice["name"] == "剑雅18 Test 1 Part 4"
    assert practice["part"] == "part4"
    assert practice["total_sentences"] == 3
    assert practice["audio_ready"] is True
    assert practice["audio_ready_count"] == 3
    assert [item["display_text"] for item in practice["sentences"]] == [
        "Hello there.", "How are you?", "The bank is beside the river.",
    ]
    assert all(item["audio_url"] for item in practice["sentences"])
    assert practice["transcript_session_id"] == uploaded["session_id"]
    assert len(practice["transcript"]["segments"]) == 3
    assert all(len(item["text"].split(". ")) == 1 for item in practice["transcript"]["segments"])
    assert client.post(f"/api/practices/{practice_id}/progress", json={"current_sentence": 2}).json()["current_sentence"] == 2
    completed = client.post(f"/api/practices/{practice_id}/complete").json()
    assert completed["completed"] is True
    assert completed["last_completed_at"] is not None

    restarted_app = create_app(Settings(data_dir=tmp_path / "data"))
    restarted_client = TestClient(restarted_app)
    persisted = restarted_client.get(f"/api/practices/{practice_id}").json()
    assert persisted["completed"] is True
    assert persisted["part"] == "part4"
    assert persisted["transcript"]["full_text"].startswith("Hello")

    restarted = restarted_client.post(f"/api/practices/{practice_id}/restart").json()
    assert restarted["completed"] is False
    assert restarted["current_sentence"] == 1
    assert all(item["status"] == "pending" for item in restarted["sentences"])


def test_word_explain_and_context_deduplication(tmp_path: Path):
    client, fake = make_client(tmp_path)
    sentence = "The path continues along the bank of the river."
    explanation = client.post(
        "/api/word/explain",
        json={"word": "bank", "sentence": sentence},
        headers={"X-DashScope-API-Key": "test-session-key"},
    ).json()
    assert fake.received == ("bank", sentence, "test-session-key")
    assert explanation["meaning_zh"] == "河岸"
    payload = {**explanation, "source_sentence": sentence, "practice_id": None}
    first = client.post("/api/vocabulary", json=payload).json()
    second = client.post("/api/vocabulary", json=payload).json()
    assert first["created"] is True
    assert second["created"] is False
    assert first["item"]["id"] == second["item"]["id"]
    assert first["item"]["audio_status"] == "ready"
    assert first["item"]["audio_url"].endswith("practice-test-1.mp3")
    assert client.get(first["item"]["audio_url"]).content == b"ID3practice-audio"
    assert client.app.state.tts_service.calls == ["bank"]
    assert len(client.get("/api/vocabulary").json()) == 1
    assert client.delete(f"/api/vocabulary/{first['item']['id']}").status_code == 204


def test_practices_are_sorted_by_updated_at(tmp_path: Path):
    client, _ = make_client(tmp_path)
    first = client.post("/api/practices", json={"name": "First"}).json()
    second = client.post("/api/practices", json={"name": "Second"}).json()
    client.put(f"/api/practices/{first['id']}", json={"name": "First updated"})
    items = client.get("/api/practices").json()
    assert items[0]["id"] == first["id"]
    assert items[1]["id"] == second["id"]

    ended = client.post(f"/api/practices/{second['id']}/end-session").json()
    assert ended["completed"] is False
    assert ended["last_completed_at"] is not None


def test_vocabulary_is_grouped_and_filtered_per_practice(tmp_path: Path):
    client, _ = make_client(tmp_path)
    first_practice = client.post("/api/practices", json={"name": "New Zealand Architecture"}).json()
    second_practice = client.post("/api/practices", json={"name": "Library Tour"}).json()
    base = {
        "word": "design", "lemma": "design", "phonetic_uk": "/dɪˈzaɪn/",
        "part_of_speech": "noun", "meaning_zh": "设计", "meaning_in_context": "建筑设计",
        "source_sentence": "The design reflects local conditions.",
    }
    first = client.post("/api/vocabulary", json={**base, "practice_id": first_practice["id"]}).json()
    second = client.post("/api/vocabulary", json={**base, "practice_id": second_practice["id"]}).json()
    duplicate = client.post("/api/vocabulary", json={**base, "practice_id": first_practice["id"]}).json()
    assert first["created"] is True
    assert second["created"] is True
    assert first["item"]["id"] != second["item"]["id"]
    assert duplicate["created"] is False

    filtered = client.get("/api/vocabulary", params={"practice_id": first_practice["id"]}).json()
    assert len(filtered) == 1
    assert filtered[0]["practice_name"] == "New Zealand Architecture"
    groups = client.get("/api/vocabulary/groups").json()
    assert {(item["practice_name"], item["word_count"]) for item in groups} == {
        ("New Zealand Architecture", 1), ("Library Tour", 1),
    }
    assert client.get(
        "/api/vocabulary", params={"practice_id": first_practice["id"], "unassigned": True}
    ).status_code == 400


def test_failed_vocabulary_audio_keeps_favorite_and_can_retry(tmp_path: Path):
    client, _ = make_client(tmp_path)
    output_dir = client.app.state.tts_service.output_dir
    client.app.state.tts_service = AlwaysFailingTtsService(output_dir)
    payload = {
        "word": "concern", "lemma": "concern", "phonetic_uk": "/kənˈsɜːn/",
        "part_of_speech": "noun", "meaning_zh": "担忧", "meaning_in_context": "这里表示担心",
        "source_sentence": "Cost is the main concern.", "practice_id": None,
    }
    created = client.post("/api/vocabulary", json=payload)
    assert created.status_code == 201
    favorite = created.json()["item"]
    assert favorite["audio_status"] == "failed"
    assert favorite["audio_url"] is None
    assert "temporary generation failure" in favorite["audio_error"]
    assert len(client.get("/api/vocabulary").json()) == 1

    client.app.state.tts_service = FakeTtsService(output_dir)
    retried = client.post(f"/api/vocabulary/{favorite['id']}/audio")
    assert retried.status_code == 200
    assert retried.json()["audio_status"] == "ready"
    assert retried.json()["audio_url"].endswith("practice-test-1.mp3")


def test_legacy_sentence_audio_is_generated_on_first_play_request(tmp_path: Path):
    client, _ = make_client(tmp_path)
    practice = client.post("/api/practices", json={"name": "Legacy", "part": "part2"}).json()
    transcript = {
        "title": "Legacy", "type": "monologue", "speakers": [],
        "full_text": "This sentence had no audio.", "segments": [], "uncertain_tokens": [],
    }
    asyncio.run(client.app.state.database.set_transcript(practice["id"], transcript))
    sentence = client.get(f"/api/practices/{practice['id']}").json()["sentences"][0]
    assert sentence["audio_url"] is None
    assert client.get(f"/api/practices/{practice['id']}").json()["audio_ready"] is False

    generated = client.post(f"/api/practices/{practice['id']}/sentences/{sentence['id']}/audio")
    assert generated.status_code == 200, generated.text
    assert generated.json()["audio_url"].endswith("practice-test-1.mp3")
    persisted = client.get(f"/api/practices/{practice['id']}").json()["sentences"][0]
    assert persisted["audio_url"] == generated.json()["audio_url"]
    assert client.get(f"/api/practices/{practice['id']}").json()["audio_ready"] is True


def test_failed_batch_generation_does_not_open_incomplete_practice(tmp_path: Path):
    client, _ = make_client(tmp_path)
    output_dir = client.app.state.tts_service.output_dir
    client.app.state.tts_service = FailingTtsService(output_dir)
    practice = client.post("/api/practices", json={"name": "Needs complete audio"}).json()
    uploaded = client.post(
        "/api/transcript/upload",
        data={"practice_id": practice["id"]},
        files=[("files", ("page.png", PNG_BYTES, "image/png"))],
    ).json()
    transcript = {
        "title": "", "type": "monologue", "speakers": [],
        "full_text": "First sentence. Second sentence.",
        "segments": [{"id": 1, "speaker": "", "text": "First sentence. Second sentence.", "confidence": 1, "uncertain": False}],
        "uncertain_tokens": [],
    }
    response = client.put(
        f"/api/transcript/{uploaded['session_id']}",
        json={"transcript": transcript, "confirmed": True},
    )
    assert response.status_code == 502
    blocked = client.get(f"/api/practices/{practice['id']}").json()
    assert blocked["audio_ready"] is False
    assert blocked["total_sentences"] == 0
    assert list(output_dir.glob("*.mp3")) == []
