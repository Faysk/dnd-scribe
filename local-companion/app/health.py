from __future__ import annotations

import os
import platform
import shutil
import sys
import tempfile
import time
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from threading import Lock
from typing import Any

from .catalog import LocalCatalog
from .config import AppPaths
from .fs import atomic_replace_probe
from .runtime import probe_cuda, public_profiles
from .storage import SessionStore


_STORAGE_PROBE_TTL_SECONDS = 60.0
_STORAGE_PROBE_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_STORAGE_PROBE_LOCK = Lock()


def _writable(directory: Path) -> tuple[bool, str | None]:
    try:
        descriptor, temporary = tempfile.mkstemp(dir=directory, prefix=".health-", suffix=".tmp")
        os.close(descriptor)
        os.unlink(temporary)
        return True, None
    except OSError as error:
        return False, f"{type(error).__name__}: {error}"


def _storage_probe(directory: Path, *, force: bool = False) -> dict[str, Any]:
    key = str(directory.resolve())
    with _STORAGE_PROBE_LOCK:
        now = time.monotonic()
        cached = _STORAGE_PROBE_CACHE.get(key)
        if not force and cached and now - cached[0] < _STORAGE_PROBE_TTL_SECONDS:
            return dict(cached[1])
        writable, write_error = _writable(directory)
        atomic_replace = atomic_replace_probe(directory) if writable else {
            "ok": False,
            "error": write_error,
        }
        result = {
            "writable": writable,
            "write_error": write_error,
            "atomic_replace": atomic_replace,
            "checked_at_monotonic": now,
        }
        _STORAGE_PROBE_CACHE[key] = (now, result)
        return dict(result)


def _cuda_status() -> dict[str, Any]:
    return probe_cuda()


def _installed_models(models: Path) -> list[str]:
    required = ("config.json", "model.bin", "tokenizer.json")
    return sorted(
        directory.name
        for directory in models.iterdir()
        if directory.is_dir()
        and not directory.name.startswith(".")
        and all((directory / filename).is_file() for filename in required)
    )


def build_health(
    paths: AppPaths,
    store: SessionStore,
    catalog: LocalCatalog | None = None,
    *,
    force_storage_probe: bool = False,
) -> dict[str, Any]:
    storage_probe = _storage_probe(paths.sessions, force=force_storage_probe)
    disk = shutil.disk_usage(paths.storage)
    sessions = store.list()
    active = [
        session["recording_id"]
        for session in sessions
        if session.get("status") in {"queued", "loading_model", "transcribing"}
    ]
    try:
        app_version = version("craig-to-text")
    except PackageNotFoundError:
        app_version = "development"

    cuda = _cuda_status()
    healthy_storage = storage_probe["writable"] and storage_probe["atomic_replace"]["ok"]
    gpu_ready = bool(cuda.get("available")) and bool(cuda.get("supported_compute_types"))
    ready_for_default_processing = healthy_storage and gpu_ready
    return {
        "status": "ok" if ready_for_default_processing else "degraded",
        "readiness": {
            "storage": healthy_storage,
            "gpu": gpu_ready,
            "default_processing": ready_for_default_processing,
            "cpu_manual_available": True,
        },
        "app": {
            "name": "craig-to-text",
            "version": app_version,
            "python": sys.version.split()[0],
            "platform": platform.platform(),
        },
        "storage": {
            "mode": "configured" if paths.configured_root else "legacy_default",
            "root": str(paths.storage),
            "inbox": str(paths.inbox),
            "sessions": str(paths.sessions),
            "models": str(paths.models),
            "writable": storage_probe["writable"],
            "write_error": storage_probe["write_error"],
            "atomic_replace": storage_probe["atomic_replace"],
            "free_bytes": disk.free,
            "total_bytes": disk.total,
        },
        "cuda": cuda,
        "profiles": public_profiles(),
        "models": {
            "installed": _installed_models(paths.models),
        },
        "sessions": {
            "total": len(sessions),
            "active": active,
        },
        "jobs": catalog.counts() if catalog else {},
    }
