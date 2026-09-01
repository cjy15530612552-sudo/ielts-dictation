import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4


class SessionNotFoundError(FileNotFoundError):
    pass


class SessionStore:
    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.sessions_dir = data_dir / "sessions"
        self.uploads_dir = data_dir / "uploads"
        self.sessions_dir.mkdir(parents=True, exist_ok=True)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()

    def _session_path(self, session_id: str) -> Path:
        return self.sessions_dir / f"{session_id}.json"

    def upload_dir(self, session_id: str) -> Path:
        directory = self.uploads_dir / session_id
        directory.mkdir(parents=True, exist_ok=True)
        return directory

    async def create(self, images: list[dict[str, Any]], practice_id: str | None = None) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        session = {
            "session_id": str(uuid4()),
            "practice_id": practice_id,
            "status": "uploaded",
            "created_at": now,
            "updated_at": now,
            "images": images,
            "transcript": None,
            "error": None,
        }
        async with self._lock:
            await asyncio.to_thread(self._write, session)
        return session

    async def get(self, session_id: str) -> dict[str, Any]:
        path = self._session_path(session_id)
        if not path.exists():
            raise SessionNotFoundError(session_id)
        return await asyncio.to_thread(self._read, path)

    async def update(self, session_id: str, **changes: Any) -> dict[str, Any]:
        async with self._lock:
            session = await self.get(session_id)
            session.update(changes)
            session["updated_at"] = datetime.now(UTC).isoformat()
            await asyncio.to_thread(self._write, session)
        return session

    async def latest_for_practice(self, practice_id: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._latest_for_practice, practice_id)

    def _latest_for_practice(self, practice_id: str) -> dict[str, Any] | None:
        matches: list[dict[str, Any]] = []
        for path in self.sessions_dir.glob("*.json"):
            try:
                session = self._read(path)
            except (OSError, json.JSONDecodeError):
                continue
            if session.get("practice_id") == practice_id:
                matches.append(session)
        return max(matches, key=lambda item: item.get("updated_at", ""), default=None)

    def _write(self, session: dict[str, Any]) -> None:
        path = self._session_path(session["session_id"])
        temp_path = path.with_suffix(".tmp")
        temp_path.write_text(json.dumps(session, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(path)

    @staticmethod
    def _read(path: Path) -> dict[str, Any]:
        return json.loads(path.read_text(encoding="utf-8"))
