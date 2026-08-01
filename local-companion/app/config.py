from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping


DATA_ROOT_ENV = "CRAIG_TO_TEXT_ROOT"


@dataclass(frozen=True)
class AppPaths:
    project: Path
    storage: Path
    inbox: Path
    sessions: Path
    models: Path
    static: Path
    configured_root: bool

    def ensure(self) -> None:
        for directory in (self.storage, self.inbox, self.sessions, self.models):
            directory.mkdir(parents=True, exist_ok=True)


def load_paths(
    environment: Mapping[str, str] | None = None,
    *,
    project_root: Path | None = None,
) -> AppPaths:
    values = os.environ if environment is None else environment
    project = (project_root or Path(__file__).resolve().parent.parent).resolve()
    configured = values.get(DATA_ROOT_ENV, "").strip()

    if configured:
        storage = Path(configured).expanduser().resolve()
        paths = AppPaths(
            project=project,
            storage=storage,
            inbox=storage / "inbox",
            sessions=storage / "sessions",
            models=storage / "models",
            static=project / "static",
            configured_root=True,
        )
    else:
        paths = AppPaths(
            project=project,
            storage=project / "data",
            inbox=project / "downs",
            sessions=project / "data" / "sessions",
            models=project / "data" / "model_files",
            static=project / "static",
            configured_root=False,
        )

    paths.ensure()
    return paths
