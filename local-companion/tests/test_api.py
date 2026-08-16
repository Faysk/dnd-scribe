import importlib
import json
import zipfile

from fastapi.testclient import TestClient

from app.storage import SessionStore


def write_craig_zip(path):
    info = """Recording PICKER123

Start time:\t2026-07-30T18:00:00.000Z

Tracks:
\talice#0 (123)
\tbob#0 (456)
"""
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("info.txt", info)
        archive.writestr("1-alice.flac", b"fake-flac-alice")
        archive.writestr("2-bob.flac", b"fake-flac-bob")


def test_central_local_api_flow(tmp_path, monkeypatch):
    storage = tmp_path / "archive"
    store = SessionStore(storage / "sessions")
    store.write(
        "ABC123",
        {
            "recording_id": "ABC123",
            "start_time": "2026-07-25T18:24:15.184Z",
            "source": "",
            "format": "flac",
            "tracks": [],
            "speakers": ["alice"],
            "status": "complete",
            "mode": "full",
            "transcript": [
                {
                    "id": "alice-0",
                    "speaker": "alice",
                    "track": "1-alice.flac",
                    "start": 1.0,
                    "end": 2.5,
                    "text": "Barovia",
                    "words": [],
                }
            ],
        },
    )
    monkeypatch.setenv("CRAIG_TO_TEXT_ROOT", str(storage))

    import app.main

    main = importlib.reload(app.main)
    monkeypatch.setattr(
        main,
        "build_health",
        lambda paths, session_store, catalog: {
            "status": "ok",
            "storage": {"root": str(paths.storage)},
            "cuda": {"available": True},
            "sessions": {"total": len(session_store.list())},
            "jobs": catalog.counts(),
        },
    )

    with TestClient(main.app) as client:
        health = client.get("/api/health")
        metadata = client.patch(
            "/api/sessions/ABC123",
            json={
                "title": "A memória como preço",
                "played_at": "2026-07-25",
                "arc": "Névoa",
                "notes": "Nota apenas local",
            },
        )
        review = client.patch(
            "/api/sessions/ABC123/segments/alice-0/review",
            json={
                "status": "approved",
                "text": "Baróvia",
                "speaker": "Alya",
            },
        )
        bundle = client.get("/api/sessions/ABC123/publication-bundle.json")
        jobs = client.get("/api/jobs")

    assert health.status_code == 200
    assert health.json()["companion"]["version"] == "0.4.1"
    assert metadata.json()["title"] == "A memória como preço"
    assert review.json()["segment"]["text"] == "Baróvia"
    assert review.json()["segment"]["original_text"] == "Barovia"
    assert bundle.status_code == 200
    assert bundle.json()["session"]["title"] == "A memória como preço"
    assert bundle.json()["source_manifest"]["local_only"] is True
    assert "Baróvia" not in bundle.text
    assert jobs.json() == {"jobs": []}

    raw = json.loads(
        (storage / "sessions" / "ABC123" / "session.json").read_text(encoding="utf-8")
    )
    assert raw["transcript"][0]["text"] == "Barovia"


def test_hosted_origin_can_access_local_companion(tmp_path, monkeypatch):
    storage = tmp_path / "bridge"
    monkeypatch.setenv("CRAIG_TO_TEXT_ROOT", str(storage))

    import app.main

    main = importlib.reload(app.main)
    with TestClient(main.app) as client:
        response = client.options(
            "/api/health",
            headers={
                "Origin": "https://dnd.faysk.dev",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Private-Network": "true",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://dnd.faysk.dev"
    assert response.headers["access-control-allow-private-network"] == "true"


def test_native_picker_copies_imports_and_queues_five_minute_fast_sample(tmp_path, monkeypatch):
    storage = tmp_path / "managed"
    downloads = tmp_path / "downloads"
    downloads.mkdir()
    source = downloads / "craig-session.zip"
    write_craig_zip(source)
    monkeypatch.setenv("CRAIG_TO_TEXT_ROOT", str(storage))

    import app.main

    main = importlib.reload(app.main)
    monkeypatch.setattr(main, "select_craig_archive", lambda: source)
    monkeypatch.setattr(main.executor, "submit", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        main,
        "_preflight",
        lambda profile, cpu: {
            "ready": True,
            "plan": {"profile": profile, "device": "cpu" if cpu else "cuda"},
        },
    )

    with TestClient(main.app) as client:
        response = client.post("/api/import/select")
        jobs = client.get("/api/jobs").json()["jobs"]

    payload = response.json()
    managed = storage / "inbox" / source.name
    assert response.status_code == 200
    assert payload["cancelled"] is False
    assert payload["copied"] is True
    assert payload["sample_started"] is True
    assert payload["archive"]["original_preserved"] is True
    assert payload["session"]["recording_id"] == "PICKER123"
    assert payload["session"]["status"] == "queued"
    assert jobs[0]["payload"]["profile"] == "fast"
    assert jobs[0]["payload"]["cpu"] is False
    assert jobs[0]["payload"]["sample_minutes"] == 5
    assert source.is_file()
    assert managed.is_file()
    assert source.read_bytes() == managed.read_bytes()
    assert not list((storage / "inbox").glob("*.partial"))
    assert len(list((storage / "sessions" / "PICKER123" / "tracks").glob("*.flac"))) == 2


def test_transcribe_api_uses_detailed_profile_and_keeps_cpu_explicit(tmp_path, monkeypatch):
    storage = tmp_path / "profiles"
    store = SessionStore(storage / "sessions")
    store.write(
        "ABC123",
        {
            "recording_id": "ABC123",
            "start_time": "2026-07-25T18:24:15.184Z",
            "source": "",
            "format": "flac",
            "tracks": [],
            "speakers": ["alice"],
            "status": "ready",
            "progress": None,
            "transcript": [],
            "error": None,
        },
    )
    monkeypatch.setenv("CRAIG_TO_TEXT_ROOT", str(storage))

    import app.main

    main = importlib.reload(app.main)
    monkeypatch.setattr(main.executor, "submit", lambda *args, **kwargs: None)
    monkeypatch.setattr(main, "_preflight", lambda profile, cpu: {"ready": True})

    with TestClient(main.app) as client:
        response = client.post(
            "/api/sessions/ABC123/transcribe",
            json={"profile": "detailed", "cpu": False, "glossary": "Dandelion"},
        )
        jobs = client.get("/api/jobs?recording_id=ABC123").json()["jobs"]

    assert response.status_code == 200
    assert response.json()["profile"] == "detailed"
    assert jobs[0]["payload"] == {
        "profile": "detailed",
        "cpu": False,
        "glossary": "Dandelion",
        "sample_minutes": None,
    }


def test_native_picker_cancel_does_not_change_archive(tmp_path, monkeypatch):
    storage = tmp_path / "managed"
    monkeypatch.setenv("CRAIG_TO_TEXT_ROOT", str(storage))

    import app.main

    main = importlib.reload(app.main)
    monkeypatch.setattr(main, "select_craig_archive", lambda: None)

    with TestClient(main.app) as client:
        response = client.post("/api/import/select")

    assert response.status_code == 200
    assert response.json() == {"cancelled": True}
    assert list((storage / "inbox").iterdir()) == []
