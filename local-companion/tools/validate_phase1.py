from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.artifacts import write_session_manifest
from app.config import load_paths
from app.publication import serialized_size, write_publication_bundle
from app.storage import SessionStore


def folder_size(path: Path) -> int:
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("recording_id")
    arguments = parser.parse_args()

    paths = load_paths()
    store = SessionStore(paths.sessions)
    session = store.read(arguments.recording_id)
    session_dir = store.session_dir(arguments.recording_id)
    manifest = write_session_manifest(session, session_dir, inbox=paths.inbox)
    output, bundle = write_publication_bundle(session, manifest, session_dir)

    local_bytes = folder_size(session_dir)
    bundle_bytes = output.stat().st_size
    result = {
        "recording_id": arguments.recording_id,
        "session_dir": str(session_dir),
        "local_bytes": local_bytes,
        "bundle_path": str(output),
        "bundle_bytes": bundle_bytes,
        "bundle_compact_bytes": serialized_size(bundle),
        "ratio_percent": round((bundle_bytes / local_bytes) * 100, 6),
        "transcript_segments": manifest["transcript"]["segments"],
        "transcript_sha256": manifest["transcript"]["sha256"],
        "publication_id": bundle["publication_id"],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
