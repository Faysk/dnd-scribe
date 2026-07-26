from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .artifacts import sha256_file, write_session_manifest
from .catalog import LocalCatalog
from .config import load_paths
from .craig import extract_archive, inspect_archive, list_archives
from .health import build_health
from .publication import build_publication_bundle
from .reviews import apply_reviews, read_reviews, write_review
from .storage import SessionStore
from .transcriber import markdown_export, transcribe_session


PATHS = load_paths()
store = SessionStore(PATHS.sessions)
catalog = LocalCatalog(PATHS.storage / "craig-to-text.sqlite3")
executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="transcription")


@asynccontextmanager
async def lifespan(_: FastAPI):
    catalog.fail_interrupted_jobs()
    for interrupted in store.list():
        catalog.ensure_session(
            interrupted["recording_id"],
            played_at=(interrupted.get("start_time") or "")[:10] or None,
        )
        if interrupted.get("status") in {"loading_model", "transcribing"}:
            interrupted["status"] = "error"
            interrupted["error"] = (
                "O aplicativo foi fechado durante o processamento. "
                "As faixas e resultados já salvos foram preservados; inicie novamente."
            )
            store.write(interrupted["recording_id"], interrupted)
    for queued in catalog.queued_jobs():
        try:
            request = TranscribeRequest.model_validate(queued["payload"])
            executor.submit(
                _run_transcription_job,
                queued["id"],
                queued["recording_id"],
                request,
            )
        except Exception as error:
            catalog.finish_job(
                queued["id"],
                status="failed",
                error=f"{type(error).__name__}: {error}",
            )
    yield


app = FastAPI(title="Craig to Text", version="0.1.0", lifespan=lifespan)

HOSTED_ORIGINS = (
    "https://dnd.faysk.dev",
    "https://dnd-scribe-amber.vercel.app",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(HOSTED_ORIGINS),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    allow_private_network=True,
    expose_headers=["Content-Disposition", "Content-Length", "Content-Range"],
)


@app.middleware("http")
async def allow_private_network_bridge(request: Request, call_next):
    response = await call_next(request)
    origin = request.headers.get("origin")
    if (
        origin in HOSTED_ORIGINS
        and request.headers.get("access-control-request-private-network") == "true"
    ):
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


class ImportRequest(BaseModel):
    path: str


class TranscribeRequest(BaseModel):
    model: str = "large-v3-turbo"
    device: str = "cuda"
    compute_type: str = "float16"
    glossary: str = ""
    sample_minutes: int | None = None


class SessionMetadataRequest(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    played_at: str | None = Field(default=None, max_length=10)
    arc: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=4000)


class ReviewRequest(BaseModel):
    status: str = "unreviewed"
    text: str | None = Field(default=None, max_length=10000)
    speaker: str | None = Field(default=None, max_length=160)


def enriched_session(session: dict) -> dict:
    value = apply_reviews(
        session,
        read_reviews(store.session_dir(session["recording_id"])),
    )
    metadata = catalog.get_session(session["recording_id"]) or {}
    value["title"] = metadata.get("title")
    value["played_at"] = metadata.get("played_at")
    value["arc"] = metadata.get("arc")
    value["notes"] = metadata.get("notes")
    return value


def public_session(session: dict) -> dict:
    value = enriched_session(session)
    for track in value.get("tracks", []):
        track.pop("path", None)
    for track in value.get("transcribed_tracks", []):
        track.pop("path", None)
    return value


def ensure_manifest(session: dict) -> dict:
    session_dir = store.session_dir(session["recording_id"])
    return write_session_manifest(session, session_dir, inbox=PATHS.inbox)


@app.get("/api/health")
def health() -> dict:
    return build_health(PATHS, store, catalog)


@app.get("/api/candidates")
def candidates() -> list[dict]:
    imported_sessions = {
        session["recording_id"]: session
        for session in store.list()
        if session.get("recording_id")
    }
    grouped: dict[str, list] = {}
    for archive in list_archives(PATHS.inbox):
        grouped.setdefault(archive.recording_id, []).append(archive)
    result = []
    for recording_id, archives in grouped.items():
        imported = imported_sessions.get(recording_id)
        choices = [
            {
                "path": str(item.path),
                "filename": item.path.name,
                "format": item.format,
                "size": item.size,
                "recommended": item.format == "flac",
            }
            for item in archives
        ]
        result.append(
            {
                "recording_id": recording_id,
                "start_time": archives[0].start_time,
                "speakers": [track["speaker"] for track in archives[0].tracks],
                "choices": choices,
                "imported": imported is not None,
                "session_status": imported.get("status") if imported else None,
                "session_mode": imported.get("mode") if imported else None,
            }
        )
    return result


@app.get("/api/sessions")
def sessions() -> list[dict]:
    return [public_session(session) for session in store.list()]


@app.get("/api/sessions/{recording_id}")
def session(recording_id: str) -> dict:
    try:
        return public_session(store.read(recording_id))
    except FileNotFoundError as error:
        raise HTTPException(404, "Sessão não encontrada") from error


@app.post("/api/import")
def import_archive(request: ImportRequest) -> dict:
    source = Path(request.path).resolve()
    try:
        source.relative_to(PATHS.inbox.resolve())
    except ValueError as error:
        raise HTTPException(
            400,
            f"O ZIP precisa estar dentro da pasta de entrada: {PATHS.inbox}",
        ) from error

    try:
        archive_info = inspect_archive(source)
        try:
            existing = store.read(archive_info.recording_id)
            return public_session(existing)
        except FileNotFoundError:
            pass

        destination = store.session_dir(archive_info.recording_id)
        with TemporaryDirectory(
            prefix=".craig-import-",
            dir=PATHS.sessions,
        ) as temporary_name:
            temporary = Path(temporary_name)
            metadata = extract_archive(source, temporary)
            destination.mkdir(parents=True, exist_ok=True)
            tracks_dir = destination / "tracks"
            tracks_dir.mkdir(exist_ok=True)
            for track in metadata.tracks:
                old_path = Path(track["path"])
                new_path = tracks_dir / old_path.name
                old_path.replace(new_path)
                track["path"] = str(new_path)
            info = temporary / "info.txt"
            if info.exists():
                info.replace(destination / "info.txt")
    except (ValueError, OSError) as error:
        raise HTTPException(400, str(error)) from error

    value = {
        "recording_id": metadata.recording_id,
        "start_time": metadata.start_time,
        "source": str(metadata.path),
        "source_sha256": sha256_file(metadata.path),
        "format": metadata.format,
        "tracks": metadata.tracks,
        "speakers": [track["speaker"] for track in metadata.tracks],
        "status": "ready",
        "progress": None,
        "transcript": [],
        "error": None,
    }
    store.write(metadata.recording_id, value)
    catalog.ensure_session(
        metadata.recording_id,
        played_at=(metadata.start_time or "")[:10] or None,
    )
    ensure_manifest(value)
    return public_session(value)


def _run_transcription_job(
    job_id: str,
    recording_id: str,
    request: TranscribeRequest,
) -> None:
    value = store.read(recording_id)

    def update(updated: dict) -> None:
        store.write(recording_id, updated)

    try:
        catalog.mark_running(job_id)
        transcribe_session(
            value,
            store.session_dir(recording_id),
            update,
            model_name=request.model,
            device=request.device,
            compute_type=request.compute_type,
            glossary=request.glossary.strip(),
            sample_minutes=request.sample_minutes,
            model_root=PATHS.models,
        )
        value = store.read(recording_id)
        ensure_manifest(value)
        catalog.finish_job(job_id, status="succeeded")
    except Exception as error:
        value["status"] = "error"
        value["error"] = f"{type(error).__name__}: {error}"
        update(value)
        catalog.finish_job(job_id, status="failed", error=value["error"])


@app.post("/api/sessions/{recording_id}/transcribe")
def transcribe(recording_id: str, request: TranscribeRequest) -> dict:
    try:
        value = store.read(recording_id)
    except FileNotFoundError as error:
        raise HTTPException(404, "Sessão não encontrada") from error
    if value.get("status") in {"loading_model", "transcribing"}:
        raise HTTPException(409, "A sessão já está sendo processada")
    if request.sample_minutes is not None and not 1 <= request.sample_minutes <= 30:
        raise HTTPException(400, "A amostra deve ter entre 1 e 30 minutos")
    try:
        job = catalog.create_job(
            recording_id,
            "transcribe",
            request.model_dump(),
        )
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
    value["status"] = "queued"
    value["error"] = None
    store.write(recording_id, value)
    executor.submit(
        _run_transcription_job,
        job["id"],
        recording_id,
        request,
    )
    response = public_session(value)
    response["job_id"] = job["id"]
    return response


@app.patch("/api/sessions/{recording_id}")
def update_session_metadata(
    recording_id: str,
    request: SessionMetadataRequest,
) -> dict:
    try:
        value = store.read(recording_id)
    except FileNotFoundError as error:
        raise HTTPException(404, "Sessão não encontrada") from error
    current = catalog.get_session(recording_id) or {}
    fields = request.model_fields_set
    catalog.update_session(
        recording_id,
        title=(
            request.title.strip() if request.title else None
        ) if "title" in fields else current.get("title"),
        played_at=(
            request.played_at
            if "played_at" in fields
            else current.get("played_at")
        ),
        arc=(
            request.arc.strip() if request.arc else None
        ) if "arc" in fields else current.get("arc"),
        notes=(
            request.notes.strip() if request.notes else None
        ) if "notes" in fields else current.get("notes"),
    )
    return public_session(value)


@app.patch("/api/sessions/{recording_id}/segments/{segment_id}/review")
def update_segment_review(
    recording_id: str,
    segment_id: str,
    request: ReviewRequest,
) -> dict:
    try:
        value = store.read(recording_id)
    except FileNotFoundError as error:
        raise HTTPException(404, "Sessão não encontrada") from error
    if not any(item.get("id") == segment_id for item in value.get("transcript") or []):
        raise HTTPException(404, "Segmento não encontrado")
    try:
        decision = write_review(
            store.session_dir(recording_id),
            segment_id,
            status=request.status,
            text=request.text,
            speaker=request.speaker,
        )
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    reviewed = enriched_session(value)
    segment = next(
        item for item in reviewed.get("transcript") or []
        if item.get("id") == segment_id
    )
    return {
        "decision": decision,
        "segment": segment,
        "review_summary": reviewed["review_summary"],
    }


@app.get("/api/jobs")
def list_jobs(recording_id: str | None = None, limit: int = 50) -> dict:
    return {
        "jobs": catalog.list_jobs(recording_id=recording_id, limit=limit),
    }


@app.post("/api/jobs/{job_id}/retry")
def retry_job(job_id: str) -> dict:
    try:
        job = catalog.retry_job(job_id)
    except FileNotFoundError as error:
        raise HTTPException(404, "Job não encontrado") from error
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
    try:
        value = store.read(job["recording_id"])
        value["status"] = "queued"
        value["error"] = None
        store.write(job["recording_id"], value)
        request = TranscribeRequest.model_validate(job["payload"])
    except Exception as error:
        catalog.finish_job(
            job_id,
            status="failed",
            error=f"{type(error).__name__}: {error}",
        )
        raise HTTPException(400, "Payload do job inválido") from error
    executor.submit(
        _run_transcription_job,
        job_id,
        job["recording_id"],
        request,
    )
    return job


@app.get("/api/sessions/{recording_id}/tracks/{filename}")
def audio(recording_id: str, filename: str) -> FileResponse:
    path = store.session_dir(recording_id) / "tracks" / Path(filename).name
    if not path.is_file():
        raise HTTPException(404, "Faixa não encontrada")
    return FileResponse(path)


@app.get("/api/sessions/{recording_id}/export.md")
def export_markdown(recording_id: str) -> PlainTextResponse:
    try:
        value = store.read(recording_id)
    except FileNotFoundError as error:
        raise HTTPException(404, "Sessão não encontrada") from error
    return PlainTextResponse(
        markdown_export(enriched_session(value)),
        headers={"Content-Disposition": f'attachment; filename="{recording_id}.md"'},
    )


@app.get("/api/sessions/{recording_id}/publication-bundle.json")
def export_publication_bundle(recording_id: str) -> JSONResponse:
    try:
        value = store.read(recording_id)
    except FileNotFoundError as error:
        raise HTTPException(404, "Sessão não encontrada") from error
    if not value.get("transcript"):
        raise HTTPException(409, "A sessão ainda não possui transcrição")
    manifest = ensure_manifest(value)
    payload = build_publication_bundle(
        enriched_session(value),
        manifest,
        manifest_path=store.session_dir(recording_id) / "manifest.json",
    )
    return JSONResponse(
        payload,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{recording_id}-publication-bundle-v1.json"'
            )
        },
    )


app.mount("/", StaticFiles(directory=PATHS.static, html=True), name="static")
