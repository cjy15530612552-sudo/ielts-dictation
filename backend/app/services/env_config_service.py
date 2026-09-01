import asyncio
import os
import tempfile
from pathlib import Path


class EnvConfigError(RuntimeError):
    pass


class EnvConfigService:
    def __init__(self, env_path: Path) -> None:
        self.env_path = env_path
        self._lock = asyncio.Lock()

    async def save_dashscope_key(self, api_key: str) -> None:
        async with self._lock:
            await asyncio.to_thread(self._write_values, {
                "DASHSCOPE_API_KEY": api_key,
                "ALLOW_SERVER_API_KEY_FALLBACK": "true",
            })

    async def clear_dashscope_key(self) -> None:
        async with self._lock:
            await asyncio.to_thread(self._write_values, {
                "DASHSCOPE_API_KEY": "",
                "ALLOW_SERVER_API_KEY_FALLBACK": "false",
            })

    def _write_values(self, values: dict[str, str]) -> None:
        try:
            existing = self.env_path.read_text(encoding="utf-8") if self.env_path.exists() else ""
            lines = existing.splitlines()
            found: set[str] = set()
            output: list[str] = []
            for line in lines:
                key = line.split("=", 1)[0].strip() if "=" in line and not line.lstrip().startswith("#") else ""
                if key in values:
                    output.append(f"{key}={values[key]}")
                    found.add(key)
                else:
                    output.append(line)
            for key, value in values.items():
                if key not in found:
                    output.append(f"{key}={value}")
            self.env_path.parent.mkdir(parents=True, exist_ok=True)
            handle, temporary_name = tempfile.mkstemp(prefix=".env-", dir=self.env_path.parent, text=True)
            try:
                with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
                    stream.write("\n".join(output).rstrip() + "\n")
                try:
                    os.chmod(temporary_name, 0o600)
                except OSError:
                    pass
                os.replace(temporary_name, self.env_path)
            finally:
                if os.path.exists(temporary_name):
                    os.unlink(temporary_name)
        except OSError as exc:
            raise EnvConfigError("Unable to update the backend environment file.") from exc
