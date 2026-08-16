from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Any

from .fs import atomic_write_json


class SessionStore:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()

    def session_dir(self, recording_id: str) -> Path:
        safe_id = "".join(char for char in recording_id if char.isalnum() or char in "-_")
        if not safe_id:
            raise ValueError("ID de gravação inválido")
        return self.root / safe_id

    def read(self, recording_id: str) -> dict[str, Any]:
        path = self.session_dir(recording_id) / "session.json"
        if not path.exists():
            raise FileNotFoundError(recording_id)
        return json.loads(path.read_text(encoding="utf-8"))

    def write(self, recording_id: str, data: dict[str, Any]) -> None:
        session_dir = self.session_dir(recording_id)
        session_dir.mkdir(parents=True, exist_ok=True)
        path = session_dir / "session.json"
        with self._lock:
            atomic_write_json(path, data)

    def list(self) -> list[dict[str, Any]]:
        sessions = []
        for path in self.root.glob("*/session.json"):
            try:
                sessions.append(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                continue
        return sorted(sessions, key=lambda item: item.get("start_time") or "", reverse=True)
