import hashlib
import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import updater


OFFICIAL_URL = (
    "https://dmrqnbdvbkfqzctcerbx.supabase.co/storage/v1/object/sign/"
    "companion-releases/windows/DnDScribeCompanionSetup.exe?token=signed-test"
)


class FakeResponse:
    def __init__(self, payload: bytes):
        self.payload = payload
        self.offset = 0

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, size: int) -> bytes:
        if self.offset >= len(self.payload):
            return b""
        chunk = self.payload[self.offset : self.offset + size]
        self.offset += len(chunk)
        return chunk


def test_release_url_is_restricted_to_private_companion_object():
    assert updater.validate_release_url(OFFICIAL_URL) == OFFICIAL_URL
    with pytest.raises(ValueError):
        updater.validate_release_url("https://example.com/DnDScribeCompanionSetup.exe?token=x")
    with pytest.raises(ValueError):
        updater.validate_release_url(
            "https://dmrqnbdvbkfqzctcerbx.supabase.co/storage/v1/object/sign/"
            "companion-releases/windows/other.exe?token=x"
        )


def test_prepare_update_downloads_verifies_and_launches(tmp_path, monkeypatch):
    payload = b"MZ" + (b"dnd-scribe-update" * 200)
    sha256 = hashlib.sha256(payload).hexdigest()
    monkeypatch.setattr(updater, "urlopen", lambda *_args, **_kwargs: FakeResponse(payload))
    monkeypatch.delenv("LOCALAPPDATA", raising=False)
    calls = []

    result = updater.prepare_update(
        current_version="0.4.1",
        target_version="0.5.0",
        url=OFFICIAL_URL,
        storage_root=tmp_path,
        expected_sha256=sha256,
        verify=lambda path: calls.append(("verify", Path(path))),
        launch=lambda path: calls.append(("launch", Path(path))),
    )

    assert result["status"] == "installer_started"
    assert result["sha256"] == sha256
    assert result["bytes"] == len(payload)
    assert calls[0][0] == "verify"
    assert calls[1][0] == "launch"
    assert calls[0][1] == calls[1][1]
    assert calls[0][1].read_bytes() == payload
    assert not list((tmp_path / ".updates").glob("*.partial"))


def test_prepare_update_never_downgrades_or_reinstalls(tmp_path):
    result = updater.prepare_update(
        current_version="0.4.1",
        target_version="0.4.1",
        url=OFFICIAL_URL,
        storage_root=tmp_path,
        verify=lambda _path: pytest.fail("verify should not run"),
        launch=lambda _path: pytest.fail("launch should not run"),
    )
    assert result == {
        "status": "current",
        "current_version": "0.4.1",
        "target_version": "0.4.1",
    }


def test_update_api_delegates_to_trusted_updater(tmp_path, monkeypatch):
    monkeypatch.setenv("CRAIG_TO_TEXT_ROOT", str(tmp_path))
    import app.main

    main = importlib.reload(app.main)
    captured = {}

    def fake_prepare_update(**kwargs):
        captured.update(kwargs)
        return {
            "status": "installer_started",
            "current_version": kwargs["current_version"],
            "target_version": kwargs["target_version"],
            "sha256": "a" * 64,
            "bytes": 1234,
            "installer": "C:/fake/update.exe",
        }

    monkeypatch.setattr(main, "prepare_update", fake_prepare_update)
    with TestClient(main.app) as client:
        response = client.post(
            "/api/update",
            json={"version": "0.5.0", "url": OFFICIAL_URL, "sha256": "a" * 64},
            headers={"Origin": "https://dnd.faysk.dev"},
        )

    assert response.status_code == 200
    assert response.json()["status"] == "installer_started"
    assert captured["current_version"] == "0.4.1"
    assert captured["target_version"] == "0.5.0"
    assert captured["storage_root"] == main.PATHS.storage
