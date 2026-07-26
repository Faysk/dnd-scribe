import importlib
import json

from fastapi.testclient import TestClient

from app.storage import SessionStore


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
