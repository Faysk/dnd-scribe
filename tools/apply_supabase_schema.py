#!/usr/bin/env python3
"""Apply the local Supabase schema files using DATABASE_URL from .env.local."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


DEFAULT_SCHEMA_FILES = [
    Path("schemas/database_schema.sql"),
    Path("schemas/20260625_001_local_ingest_extensions.sql"),
    Path("schemas/20260625_002_ai_candidates_extensions.sql"),
    Path("schemas/20260625_003_publication_extensions.sql"),
    Path("schemas/20260625_004_review_decisions_extensions.sql"),
    Path("schemas/20260626_005_auth_profiles_extensions.sql"),
    Path("schemas/20260626_006_roll20_event_extensions.sql"),
    Path("schemas/20260626_007_historical_import.sql"),
    Path("schemas/20260626_008_canon_entries.sql"),
    Path("schemas/20260626_009_ai_cost_cache.sql"),
    Path("schemas/20260626_010_audio_speech_slices.sql"),
    Path("schemas/20260626_011_audio_work_units_absolute_times.sql"),
    Path("schemas/20260626_012_audio_chunks_updated_at.sql"),
    Path("schemas/20260627_013_exclude_silent_work_units.sql"),
]


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--schema", type=Path, action="append", help="SQL file to apply, in order.")
    args = parser.parse_args()

    values = load_env(args.env_file)
    database_url = values.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")

    schema_files = args.schema or DEFAULT_SCHEMA_FILES
    for schema_file in schema_files:
        if not schema_file.exists():
            raise SystemExit(f"Schema file not found: {schema_file}")

    cmd = ["psql", database_url, "-v", "ON_ERROR_STOP=1"]
    for schema_file in schema_files:
        cmd.extend(["-f", str(schema_file)])

    subprocess.check_call(cmd)
    print("schema_applied=true")
    for schema_file in schema_files:
        print(f"applied={schema_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
