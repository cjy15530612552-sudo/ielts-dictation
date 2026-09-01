import asyncio
import json
import re
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def split_sentences(text: str) -> list[str]:
    """Split OCR text at sentence-ending punctuation while retaining punctuation."""
    compact = re.sub(r"\s+", " ", text).strip()
    if not compact:
        return []
    parts = re.findall(r".*?(?:[.!?。！？]+[\"'”’)]*(?=\s|$)|$)", compact)
    return [part.strip() for part in parts if part.strip()]


def prepare_transcript_sentences(transcript: dict[str, Any]) -> list[dict[str, str]]:
    prepared: list[dict[str, str]] = []
    for segment in transcript.get("segments") or []:
        speaker = segment.get("speaker", "")
        for sentence in split_sentences(segment.get("text", "")):
            prepared.append({"speaker": speaker, "display_text": sentence, "speech_text": sentence, "audio_url": None})
    if prepared:
        return prepared
    return [
        {"speaker": "", "display_text": sentence, "speech_text": sentence, "audio_url": None}
        for sentence in split_sentences(transcript.get("full_text", ""))
    ]


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    async def initialize(self) -> None:
        await asyncio.to_thread(self._initialize)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _initialize(self) -> None:
        with self._connect() as db:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS practice (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    part TEXT NOT NULL DEFAULT 'part1',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_completed_at TEXT,
                    current_sentence INTEGER NOT NULL DEFAULT 1,
                    total_sentences INTEGER NOT NULL DEFAULT 0,
                    completed INTEGER NOT NULL DEFAULT 0,
                    transcript TEXT
                );
                CREATE TABLE IF NOT EXISTS sentence (
                    id TEXT PRIMARY KEY,
                    practice_id TEXT NOT NULL REFERENCES practice(id) ON DELETE CASCADE,
                    sentence_index INTEGER NOT NULL,
                    speaker TEXT NOT NULL DEFAULT '',
                    display_text TEXT NOT NULL,
                    speech_text TEXT NOT NULL,
                    audio_url TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    UNIQUE(practice_id, sentence_index)
                );
                CREATE TABLE IF NOT EXISTS favorite_word (
                    id TEXT PRIMARY KEY,
                    word TEXT NOT NULL,
                    lemma TEXT NOT NULL,
                    phonetic_uk TEXT NOT NULL,
                    part_of_speech TEXT NOT NULL,
                    meaning_zh TEXT NOT NULL,
                    meaning_in_context TEXT NOT NULL,
                    source_sentence TEXT NOT NULL,
                    practice_id TEXT REFERENCES practice(id) ON DELETE SET NULL,
                    created_at TEXT NOT NULL,
                    dedupe_key TEXT NOT NULL UNIQUE
                );
                CREATE TABLE IF NOT EXISTS tts_playground_version (
                    id TEXT PRIMARY KEY,
                    text TEXT NOT NULL,
                    speech_text TEXT NOT NULL,
                    model TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    accent TEXT NOT NULL,
                    pace TEXT NOT NULL,
                    voice TEXT NOT NULL,
                    instruction TEXT NOT NULL,
                    audio_url TEXT NOT NULL,
                    audio_path TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS tts_setting (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    accent TEXT NOT NULL,
                    pace TEXT NOT NULL,
                    voice TEXT NOT NULL,
                    instruction TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    is_default INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_practice_updated ON practice(updated_at DESC);
                CREATE INDEX IF NOT EXISTS idx_favorite_created ON favorite_word(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_tts_version_created ON tts_playground_version(created_at DESC);
                CREATE UNIQUE INDEX IF NOT EXISTS idx_tts_setting_default ON tts_setting(mode) WHERE is_default=1;
                """
            )
            practice_columns = {row["name"] for row in db.execute("PRAGMA table_info(practice)").fetchall()}
            if "part" not in practice_columns:
                db.execute("ALTER TABLE practice ADD COLUMN part TEXT NOT NULL DEFAULT 'part1'")

    async def create_practice(self, name: str, part: str = "part1") -> dict[str, Any]:
        return await asyncio.to_thread(self._create_practice, name, part)

    def _create_practice(self, name: str, part: str) -> dict[str, Any]:
        practice_id, now = str(uuid4()), utc_now()
        with self._connect() as db:
            db.execute(
                "INSERT INTO practice (id,name,part,created_at,updated_at) VALUES (?,?,?,?,?)",
                (practice_id, name.strip(), part, now, now),
            )
        return self._get_practice(practice_id)

    async def list_practices(self) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._list_practices)

    def _list_practices(self) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute(
                "SELECT p.*, (SELECT COUNT(*) FROM favorite_word f WHERE f.practice_id=p.id) favorite_count, "
                "(SELECT COUNT(*) FROM sentence s WHERE s.practice_id=p.id AND s.audio_url IS NOT NULL) audio_ready_count "
                "FROM practice p ORDER BY updated_at DESC, created_at DESC"
            ).fetchall()
        return [self._practice_dict(row) for row in rows]

    async def get_practice(self, practice_id: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._get_practice, practice_id)

    def _get_practice(self, practice_id: str) -> dict[str, Any] | None:
        with self._connect() as db:
            row = db.execute(
                "SELECT p.*, (SELECT COUNT(*) FROM favorite_word f WHERE f.practice_id=p.id) favorite_count, "
                "(SELECT COUNT(*) FROM sentence s WHERE s.practice_id=p.id AND s.audio_url IS NOT NULL) audio_ready_count "
                "FROM practice p WHERE p.id=?", (practice_id,),
            ).fetchone()
            if not row:
                return None
            sentences = db.execute(
                "SELECT * FROM sentence WHERE practice_id=? ORDER BY sentence_index", (practice_id,),
            ).fetchall()
        result = self._practice_dict(row)
        result["sentences"] = [dict(item) for item in sentences]
        return result

    async def update_practice(self, practice_id: str, **changes: Any) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._update_practice, practice_id, changes)

    def _update_practice(self, practice_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        allowed = {"name", "part", "current_sentence", "completed", "last_completed_at"}
        values = {key: value for key, value in changes.items() if key in allowed and value is not None}
        if not values:
            return self._get_practice(practice_id)
        values["updated_at"] = utc_now()
        assignments = ", ".join(f"{key}=?" for key in values)
        with self._connect() as db:
            cursor = db.execute(
                f"UPDATE practice SET {assignments} WHERE id=?",
                (*values.values(), practice_id),
            )
            if cursor.rowcount == 0:
                return None
        return self._get_practice(practice_id)

    async def delete_practice(self, practice_id: str) -> bool:
        return await asyncio.to_thread(self._delete_practice, practice_id)

    def _delete_practice(self, practice_id: str) -> bool:
        with self._connect() as db:
            return db.execute("DELETE FROM practice WHERE id=?", (practice_id,)).rowcount > 0

    async def set_transcript(
        self,
        practice_id: str,
        transcript: dict[str, Any],
        prepared_sentences: list[dict[str, str]] | None = None,
    ) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._set_transcript, practice_id, transcript, prepared_sentences)

    def _set_transcript(
        self,
        practice_id: str,
        transcript: dict[str, Any],
        prepared_sentences: list[dict[str, str]] | None = None,
    ) -> dict[str, Any] | None:
        prepared = prepared_sentences or prepare_transcript_sentences(transcript)
        now = utc_now()
        with self._connect() as db:
            if not db.execute("SELECT 1 FROM practice WHERE id=?", (practice_id,)).fetchone():
                return None
            db.execute("DELETE FROM sentence WHERE practice_id=?", (practice_id,))
            db.executemany(
                "INSERT INTO sentence (id,practice_id,sentence_index,speaker,display_text,speech_text,audio_url,status) "
                "VALUES (?,?,?,?,?,?,?,?)",
                [
                    (
                        str(uuid4()), practice_id, index, item.get("speaker", ""), item["display_text"],
                        item.get("speech_text") or item["display_text"], item.get("audio_url"), "pending",
                    )
                    for index, item in enumerate(prepared, start=1)
                ],
            )
            db.execute(
                "UPDATE practice SET transcript=?,total_sentences=?,current_sentence=1,completed=0,updated_at=? WHERE id=?",
                (json.dumps(transcript, ensure_ascii=False), len(prepared), now, practice_id),
            )
        return self._get_practice(practice_id)

    async def update_sentence_audio(
        self, practice_id: str, sentence_id: str, speech_text: str, audio_url: str
    ) -> dict[str, Any] | None:
        return await asyncio.to_thread(
            self._update_sentence_audio, practice_id, sentence_id, speech_text, audio_url
        )

    def _update_sentence_audio(
        self, practice_id: str, sentence_id: str, speech_text: str, audio_url: str
    ) -> dict[str, Any] | None:
        with self._connect() as db:
            cursor = db.execute(
                "UPDATE sentence SET speech_text=?,audio_url=? WHERE id=? AND practice_id=?",
                (speech_text, audio_url, sentence_id, practice_id),
            )
            if cursor.rowcount == 0:
                return None
            row = db.execute("SELECT * FROM sentence WHERE id=?", (sentence_id,)).fetchone()
        return dict(row)

    async def complete_practice(self, practice_id: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._complete_practice, practice_id)

    def _complete_practice(self, practice_id: str) -> dict[str, Any] | None:
        now = utc_now()
        with self._connect() as db:
            cursor = db.execute(
                "UPDATE practice SET current_sentence=total_sentences,completed=1,last_completed_at=?,updated_at=? WHERE id=?",
                (now, now, practice_id),
            )
            if cursor.rowcount == 0:
                return None
            db.execute("UPDATE sentence SET status='completed' WHERE practice_id=?", (practice_id,))
        return self._get_practice(practice_id)

    async def restart_practice(self, practice_id: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._restart_practice, practice_id)

    def _restart_practice(self, practice_id: str) -> dict[str, Any] | None:
        now = utc_now()
        with self._connect() as db:
            cursor = db.execute(
                "UPDATE practice SET current_sentence=1,completed=0,updated_at=? WHERE id=?",
                (now, practice_id),
            )
            if cursor.rowcount == 0:
                return None
            db.execute("UPDATE sentence SET status='pending' WHERE practice_id=?", (practice_id,))
        return self._get_practice(practice_id)

    async def end_session(self, practice_id: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._end_session, practice_id)

    def _end_session(self, practice_id: str) -> dict[str, Any] | None:
        now = utc_now()
        with self._connect() as db:
            cursor = db.execute(
                "UPDATE practice SET last_completed_at=?,updated_at=? WHERE id=?", (now, now, practice_id)
            )
            if cursor.rowcount == 0:
                return None
        return self._get_practice(practice_id)

    async def list_favorites(self, limit: int | None = None) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._list_favorites, limit)

    def _list_favorites(self, limit: int | None) -> list[dict[str, Any]]:
        sql = (
            "SELECT f.*, p.name practice_name FROM favorite_word f LEFT JOIN practice p ON p.id=f.practice_id "
            "ORDER BY f.created_at DESC"
        )
        params: tuple[Any, ...] = ()
        if limit:
            sql += " LIMIT ?"
            params = (limit,)
        with self._connect() as db:
            return [dict(row) for row in db.execute(sql, params).fetchall()]

    async def get_favorite(self, favorite_id: str) -> dict[str, Any] | None:
        items = await self.list_favorites()
        return next((item for item in items if item["id"] == favorite_id), None)

    async def add_favorite(self, data: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        return await asyncio.to_thread(self._add_favorite, data)

    def _add_favorite(self, data: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        key = f"{data['lemma'].strip().casefold()}::{data['meaning_zh'].strip().casefold()}"
        with self._connect() as db:
            existing = db.execute("SELECT id FROM favorite_word WHERE dedupe_key=?", (key,)).fetchone()
            if existing:
                item = db.execute(
                    "SELECT f.*, p.name practice_name FROM favorite_word f LEFT JOIN practice p ON p.id=f.practice_id WHERE f.id=?",
                    (existing["id"],),
                ).fetchone()
                return dict(item), False
            favorite_id, now = str(uuid4()), utc_now()
            db.execute(
                "INSERT INTO favorite_word (id,word,lemma,phonetic_uk,part_of_speech,meaning_zh,meaning_in_context,source_sentence,practice_id,created_at,dedupe_key) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (favorite_id, data["word"], data["lemma"], data["phonetic_uk"], data["part_of_speech"],
                 data["meaning_zh"], data["meaning_in_context"], data["source_sentence"], data.get("practice_id"), now, key),
            )
        return self._get_favorite_sync(favorite_id), True

    def _get_favorite_sync(self, favorite_id: str) -> dict[str, Any]:
        with self._connect() as db:
            row = db.execute(
                "SELECT f.*, p.name practice_name FROM favorite_word f LEFT JOIN practice p ON p.id=f.practice_id WHERE f.id=?",
                (favorite_id,),
            ).fetchone()
        return dict(row)

    async def delete_favorite(self, favorite_id: str) -> bool:
        return await asyncio.to_thread(self._delete_favorite, favorite_id)

    def _delete_favorite(self, favorite_id: str) -> bool:
        with self._connect() as db:
            return db.execute("DELETE FROM favorite_word WHERE id=?", (favorite_id,)).rowcount > 0

    async def add_tts_version(self, data: dict[str, Any]) -> dict[str, Any]:
        return await asyncio.to_thread(self._add_tts_version, data)

    def _add_tts_version(self, data: dict[str, Any]) -> dict[str, Any]:
        with self._connect() as db:
            db.execute(
                "INSERT INTO tts_playground_version "
                "(id,text,speech_text,model,mode,accent,pace,voice,instruction,audio_url,audio_path,created_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                tuple(data[key] for key in (
                    "id", "text", "speech_text", "model", "mode", "accent", "pace", "voice",
                    "instruction", "audio_url", "audio_path", "created_at",
                )),
            )
        return self._get_tts_version(data["id"])

    async def list_tts_versions(self) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._list_tts_versions)

    def _list_tts_versions(self) -> list[dict[str, Any]]:
        with self._connect() as db:
            return [dict(row) for row in db.execute(
                "SELECT * FROM tts_playground_version ORDER BY created_at DESC"
            ).fetchall()]

    def _get_tts_version(self, version_id: str) -> dict[str, Any] | None:
        with self._connect() as db:
            row = db.execute("SELECT * FROM tts_playground_version WHERE id=?", (version_id,)).fetchone()
        return dict(row) if row else None

    async def delete_tts_version(self, version_id: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._delete_tts_version, version_id)

    def _delete_tts_version(self, version_id: str) -> dict[str, Any] | None:
        item = self._get_tts_version(version_id)
        if not item:
            return None
        with self._connect() as db:
            db.execute("DELETE FROM tts_playground_version WHERE id=?", (version_id,))
        return item

    async def list_tts_settings(self) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._list_tts_settings)

    def _list_tts_settings(self) -> list[dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute("SELECT * FROM tts_setting ORDER BY mode, updated_at DESC").fetchall()
        return [self._tts_setting_dict(row) for row in rows]

    async def save_default_tts_setting(self, data: dict[str, Any]) -> dict[str, Any]:
        return await asyncio.to_thread(self._save_default_tts_setting, data)

    def _save_default_tts_setting(self, data: dict[str, Any]) -> dict[str, Any]:
        now = utc_now()
        with self._connect() as db:
            existing = db.execute(
                "SELECT id,created_at FROM tts_setting WHERE mode=? AND is_default=1", (data["mode"],)
            ).fetchone()
            if existing:
                setting_id = existing["id"]
                db.execute(
                    "UPDATE tts_setting SET name=?,accent=?,pace=?,voice=?,instruction=?,updated_at=? WHERE id=?",
                    (data["name"], data["accent"], data["pace"], data["voice"], data["instruction"], now, setting_id),
                )
            else:
                setting_id = str(uuid4())
                db.execute(
                    "INSERT INTO tts_setting (id,name,mode,accent,pace,voice,instruction,created_at,updated_at,is_default) "
                    "VALUES (?,?,?,?,?,?,?,?,?,1)",
                    (setting_id, data["name"], data["mode"], data["accent"], data["pace"], data["voice"], data["instruction"], now, now),
                )
            row = db.execute("SELECT * FROM tts_setting WHERE id=?", (setting_id,)).fetchone()
        return self._tts_setting_dict(row)

    @staticmethod
    def _tts_setting_dict(row: sqlite3.Row) -> dict[str, Any]:
        result = dict(row)
        result["is_default"] = bool(result["is_default"])
        return result

    @staticmethod
    def _practice_dict(row: sqlite3.Row) -> dict[str, Any]:
        result = dict(row)
        result["completed"] = bool(result["completed"])
        result["transcript"] = json.loads(result["transcript"]) if result.get("transcript") else None
        ready_count = int(result.get("audio_ready_count") or 0)
        total = int(result.get("total_sentences") or 0)
        result["audio_ready_count"] = ready_count
        result["audio_ready"] = total > 0 and ready_count == total
        return result
