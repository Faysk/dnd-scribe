import json

from app.artifacts import write_session_manifest
from app.catalog import LocalCatalog
from app.config import load_paths
from app.craig import parse_info
from app.fs import atomic_write_json
from app.health import build_health
from app.publication import build_publication_bundle, write_publication_bundle
from app.reviews import apply_reviews, read_reviews, write_review
from app.runtime import resolve_plan
from app.storage import SessionStore
from app.transcriber import merge_segments


def test_parse_craig_info():
    text = """Recording ABC123

Start time:\t2026-07-25T18:24:15.184Z

Tracks:
\talice#0 (123)
\tbob#0 (456)
"""
    recording_id, start, tracks = parse_info(text)
    assert recording_id == "ABC123"
    assert start == "2026-07-25T18:24:15.184Z"
    assert [track["speaker"] for track in tracks] == ["alice", "bob"]


def test_merge_segments_is_chronological_and_keeps_overlap():
    tracks = [
        {
            "speaker": "alice",
            "filename": "1-alice.flac",
            "segments": [{"id": 0, "start": 2, "end": 4, "text": "dois"}],
        },
        {
            "speaker": "bob",
            "filename": "2-bob.flac",
            "segments": [
                {"id": 0, "start": 1, "end": 3, "text": "um"},
                {"id": 1, "start": 5, "end": 6, "text": "três"},
            ],
        },
    ]
    result = merge_segments(tracks)
    assert [item["speaker"] for item in result] == ["bob", "alice", "bob"]
    assert result[0]["end"] > result[1]["start"]


def test_configured_root_creates_portable_layout(tmp_path):
    project = tmp_path / "project"
    storage = tmp_path / "archive"
    project.mkdir()
    paths = load_paths(
        {"CRAIG_TO_TEXT_ROOT": str(storage)},
        project_root=project,
    )

    assert paths.configured_root is True
    assert paths.inbox == storage / "inbox"
    assert paths.sessions == storage / "sessions"
    assert paths.models == storage / "models"
    assert all(path.is_dir() for path in (paths.inbox, paths.sessions, paths.models))


def test_atomic_write_retries_transient_windows_permission_error(tmp_path, monkeypatch):
    import app.fs as fs

    destination = tmp_path / "session.json"
    real_replace = fs.os.replace
    attempts = {"count": 0}

    def flaky_replace(source, target):
        attempts["count"] += 1
        if attempts["count"] <= 2:
            error = PermissionError("temporariamente bloqueado")
            error.winerror = 5
            raise error
        return real_replace(source, target)

    monkeypatch.setattr(fs.os, "replace", flaky_replace)
    monkeypatch.setattr(fs.time, "sleep", lambda _: None)

    atomic_write_json(destination, {"status": "complete"})

    assert attempts["count"] == 3
    assert json.loads(destination.read_text(encoding="utf-8"))["status"] == "complete"
    assert not list(tmp_path.glob("*.tmp"))


def test_runtime_prefers_gpu_fp16_and_cpu_stays_manual():
    cuda_status = {
        "available": True,
        "supported_compute_types": ["float16", "int8_float16"],
    }
    gpu = resolve_plan("detailed", cuda_status=cuda_status)
    cpu = resolve_plan(
        "detailed",
        cpu=True,
        cuda_status={"available": False, "supported_compute_types": []},
    )

    assert gpu.model_name == "large-v3"
    assert gpu.device == "cuda"
    assert gpu.compute_type == "float16"
    assert gpu.fallback_compute_type == "int8_float16"
    assert gpu.cpu_requested is False
    assert cpu.device == "cpu"
    assert cpu.compute_type == "int8"
    assert cpu.fallback_compute_type is None
    assert cpu.cpu_requested is True


def test_manifest_and_publication_exclude_heavy_content(tmp_path):
    paths = load_paths(
        {"CRAIG_TO_TEXT_ROOT": str(tmp_path / "archive")},
        project_root=tmp_path / "project",
    )
    source = paths.inbox / "craig.zip"
    source.write_bytes(b"zip-original")
    session_dir = paths.sessions / "ABC123"
    tracks_dir = session_dir / "tracks"
    tracks_dir.mkdir(parents=True)
    track = tracks_dir / "1-alice.flac"
    track.write_bytes(b"audio-local")
    session = {
        "recording_id": "ABC123",
        "start_time": "2026-07-25T18:24:15.184Z",
        "source": str(source),
        "format": "flac",
        "tracks": [
            {
                "speaker": "alice",
                "filename": track.name,
                "path": str(track),
            }
        ],
        "speakers": ["alice"],
        "status": "complete",
        "mode": "full",
        "transcript": [
            {
                "id": "alice-0",
                "speaker": "alice",
                "track": track.name,
                "start": 1.0,
                "end": 2.5,
                "text": "Olá, Baróvia.",
                "words": [{"word": "Olá"}],
            }
        ],
    }

    manifest = write_session_manifest(session, session_dir, inbox=paths.inbox)
    output, bundle = write_publication_bundle(session, manifest, session_dir)
    encoded = output.read_text(encoding="utf-8")

    assert manifest["source"]["inbox_path"] == "craig.zip"
    assert manifest["source"]["sha256"]
    assert manifest["tracks"][0]["sha256"]
    assert manifest["transcript"]["sha256"]
    assert bundle["schema_version"] == "publication_bundle_v1"
    assert bundle["source_manifest"]["local_only"] is True
    assert "Olá, Baróvia." not in encoded
    assert str(tmp_path) not in encoded
    assert "words" not in encoded


def test_publication_id_is_stable_for_same_content(tmp_path):
    session = {
        "recording_id": "ABC123",
        "start_time": "2026-07-25T18:24:15.184Z",
        "speakers": ["alice"],
        "format": "flac",
        "transcript": [{"end": 2.5}],
    }
    manifest = {"transcript": {"sha256": "abc"}}

    first = build_publication_bundle(session, manifest)
    second = build_publication_bundle(session, manifest)

    assert first["publication_id"] == second["publication_id"]


def test_health_reports_storage_without_exposing_session_content(tmp_path, monkeypatch):
    paths = load_paths(
        {"CRAIG_TO_TEXT_ROOT": str(tmp_path / "archive")},
        project_root=tmp_path / "project",
    )
    store = SessionStore(paths.sessions)
    store.write(
        "ABC123",
        {
            "recording_id": "ABC123",
            "start_time": "2026-07-25T18:24:15.184Z",
            "status": "ready",
            "transcript": [{"text": "segredo"}],
        },
    )
    monkeypatch.setattr(
        "app.health._cuda_status",
        lambda: {
            "available": False,
            "device_count": 0,
            "supported_compute_types": [],
            "devices": [],
            "dll_directories": [],
            "ctranslate2_version": "test",
            "error": None,
        },
    )

    result = build_health(paths, store, force_storage_probe=True)
    serialized = json.dumps(result, ensure_ascii=False)

    assert result["status"] == "ok"
    assert result["storage"]["mode"] == "configured"
    assert result["storage"]["atomic_replace"]["ok"] is True
    assert result["sessions"]["total"] == 1
    assert "segredo" not in serialized


def test_catalog_persists_metadata_and_enforces_one_active_job(tmp_path):
    database = tmp_path / "catalog.sqlite3"
    catalog = LocalCatalog(database)
    catalog.ensure_session("ABC123", played_at="2026-07-25")
    catalog.update_session(
        "ABC123",
        title="A memória como preço",
        played_at="2026-07-25",
        arc="Névoa",
        notes="Revisar nome do mestre.",
    )
    job = catalog.create_job("ABC123", "transcribe", {"device": "cuda"})
    catalog.update_job_progress(job["id"], {"stage": "transcribing", "percent": 42})

    assert LocalCatalog(database).get_session("ABC123")["title"] == "A memória como preço"
    assert catalog.get_job(job["id"])["payload"]["device"] == "cuda"
    assert catalog.get_job(job["id"])["progress"]["percent"] == 42
    try:
        catalog.create_job("ABC123", "transcribe", {"device": "cpu"})
    except ValueError as error:
        assert "job ativo" in str(error)
    else:
        raise AssertionError("O catálogo aceitou dois jobs ativos iguais")

    catalog.mark_running(job["id"])
    assert catalog.get_job(job["id"])["attempts"] == 1
    assert catalog.fail_interrupted_jobs() == 1
    assert catalog.get_job(job["id"])["status"] == "failed"
    catalog.retry_job(job["id"])
    assert catalog.get_job(job["id"])["status"] == "queued"
    assert catalog.get_job(job["id"])["progress"]["percent"] == 0


def test_review_overlay_preserves_raw_transcript(tmp_path):
    session = {
        "recording_id": "ABC123",
        "transcript": [
            {
                "id": "alice-0",
                "speaker": "alice",
                "text": "Barovia",
            },
            {
                "id": "bob-0",
                "speaker": "bob",
                "text": "Original",
            },
        ],
    }
    write_review(
        tmp_path,
        "alice-0",
        status="approved",
        text="Baróvia",
        speaker="Alya",
    )
    reviews = read_reviews(tmp_path)
    result = apply_reviews(session, reviews)

    assert session["transcript"][0]["text"] == "Barovia"
    assert session["transcript"][0]["speaker"] == "alice"
    assert result["transcript"][0]["text"] == "Baróvia"
    assert result["transcript"][0]["speaker"] == "Alya"
    assert result["transcript"][0]["original_text"] == "Barovia"
    assert result["review_summary"]["approved"] == 1
    assert result["review_summary"]["unreviewed"] == 1
