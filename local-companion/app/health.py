from __future__ import annotations

import os
import platform
import shutil
import sys
import tempfile
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any

from .config import AppPaths
from .catalog import LocalCatalog
from .storage import SessionStore
from .transcriber import configure_cuda_dlls


def _writable(directory: Path) -> tuple[bool, str | None]:
    try:
        descriptor, temporary = tempfile.mkstemp(dir=directory, prefix=".health-", suffix=".tmp")
        os.close(descriptor)
        os.unlink(temporary)
        return True, None
    except OSError as error:
        return False, f"{type(error).__name__}: {error}"


def _cuda_status() -> dict[str, Any]:
    try:
        configured_dlls = configure_cuda_dlls()
        import ctranslate2

        count = ctranslate2.get_cuda_device_count()
        return {
            "available": count > 0,
            "device_count": count,
            "dll_directories": configured_dlls,
            "error": None,
        }
    except Exception as error:
        return {
            "available": False,
            "device_count": 0,
            "dll_directories": [],
            "error": f"{type(error).__name__}: {error}",
        }


def _installed_models(models: Path) -> list[str]:
    required = ("config.json", "model.bin", "tokenizer.json")
    return sorted(
        directory.name
        for directory in models.iterdir()
        if directory.is_dir()
        and all((directory / filename).is_file() for filename in required)
    )


def build_health(
    paths: AppPaths,
    store: SessionStore,
    catalog: LocalCatalog | None = None,
) -> dict[str, Any]:
    writable, write_error = _writable(paths.storage)
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

    return {
        "status": "ok" if writable else "degraded",
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
            "free_bytes": disk.free,
            "total_bytes": disk.total,
        },
        "cuda": _cuda_status(),
        "models": {
            "installed": _installed_models(paths.models),
        },
        "sessions": {
            "total": len(sessions),
            "active": active,
        },
        "jobs": catalog.counts() if catalog else {},
    }
