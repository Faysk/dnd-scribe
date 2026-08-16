from __future__ import annotations

import os
import platform
import shutil
import sys
import tempfile
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any

from .catalog import LocalCatalog
from .config import AppPaths
from .fs import atomic_replace_probe
from .runtime import probe_cuda, public_profiles
from .storage import SessionStore


def _writable(directory: Path) -> tuple[bool, str | None]:
    try:
        descriptor, temporary = tempfile.mkstemp(dir=directory, prefix=".health-", suffix=".tmp")
        os.close(descriptor)
        os.unlink(temporary)
        return True, None
    except OSError as error:
        return False, f"{type(error).__name__}: {error}"


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
) -> dict[str, Any]:
    writable, write_error = _writable(paths.storage)
    atomic_replace = atomic_replace_probe(paths.sessions)
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
    healthy_storage = writable and atomic_replace["ok"]
    return {
        "status": "ok" if healthy_storage else "degraded",
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
            "writable": writable,
            "write_error": write_error,
            "atomic_replace": atomic_replace,
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
