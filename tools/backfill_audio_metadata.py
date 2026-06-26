#!/usr/bin/env python3
"""Backfill local audio hashes and silence metadata into Supabase."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import struct
import subprocess
import wave
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CAMPAIGN = "yuhara-main"
SILENCE_DBFS_THRESHOLD = -45.0


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def sql_literal(value: Any) -> str:
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def sql_optional_text(value: Any) -> str:
    text = str(value or "").strip()
    return sql_literal(text) if text else "null"


def sql_optional_number(value: Any) -> str:
    if value is None or value == "":
        return "null"
    return str(value)


def sql_bool(value: Any) -> str:
    if value is None:
        return "null"
    return "true" if bool(value) else "false"


def sql_json(value: Any) -> str:
    return sql_literal(json.dumps(value, ensure_ascii=False, sort_keys=True)) + "::jsonb"


def run_json(database_url: str, sql: str) -> Any:
    output = subprocess.check_output(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
        text=True,
        encoding="utf-8",
    )
    text = output.strip()
    return json.loads(text) if text else None


def execute(database_url: str, sql: str) -> None:
    subprocess.check_call(["psql", database_url, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql])


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def wav_audio_stats(path: Path) -> dict[str, Any]:
    if path.suffix.lower() != ".wav":
        return {}
    try:
        with wave.open(str(path), "rb") as source:
            sample_width = source.getsampwidth()
            channels = source.getnchannels()
            frames_count = source.getnframes()
            raw = source.readframes(frames_count)
    except (EOFError, OSError, wave.Error):
        return {}

    if sample_width != 2 or frames_count <= 0:
        return {}

    sample_count = len(raw) // sample_width
    if not sample_count:
        return {}

    square_sum = 0
    peak = 0
    for (sample,) in struct.iter_unpack("<h", raw[: sample_count * sample_width]):
        absolute = abs(sample)
        peak = max(peak, absolute)
        square_sum += sample * sample

    rms = math.sqrt(square_sum / sample_count)
    dbfs = 20 * math.log10(rms / 32768) if rms > 0 else -120.0
    return {
        "audio_rms": round(rms, 2),
        "audio_peak": peak,
        "audio_dbfs": round(dbfs, 2),
        "probably_silent": dbfs < SILENCE_DBFS_THRESHOLD,
        "silence_dbfs_threshold": SILENCE_DBFS_THRESHOLD,
        "audio_channels_analyzed": channels,
    }


def resolve_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return ROOT / path


def fetch_targets(
    database_url: str,
    campaign_slug: str,
    source_session_id: str | None,
    record_type: str,
    limit: int,
) -> list[dict[str, Any]]:
    session_filter = ""
    if source_session_id:
        session_filter = f"and c.slug = {sql_literal(campaign_slug)} and s.source_session_id = {sql_literal(source_session_id)}"

    selects: list[str] = []
    if record_type in {"chunks", "all"}:
        selects.append(
            f"""
select
  'audio_chunk' record_type,
  ac.id::text id,
  s.source_session_id,
  ac.track_key,
  ac.chunk_index,
  ac.storage_path,
  ac.sha256,
  ac.audio_dbfs,
  ac.probably_silent
from audio_chunks ac
join sessions s on s.id = ac.session_id
join campaigns c on c.id = s.campaign_id
where ac.storage_bucket = 'local'
  and nullif(ac.storage_path, '') is not null
  and (
    nullif(ac.sha256, '') is null
    or ac.audio_dbfs is null
    or ac.probably_silent is null
  )
  {session_filter}
"""
        )
    if record_type in {"files", "all"}:
        selects.append(
            f"""
select
  'recording_file' record_type,
  rf.id::text id,
  s.source_session_id,
  rf.source_file_role track_key,
  null::integer chunk_index,
  rf.storage_path,
  rf.sha256,
  rf.audio_dbfs,
  rf.probably_silent
from recording_files rf
join sessions s on s.id = rf.session_id
join campaigns c on c.id = s.campaign_id
where rf.storage_bucket = 'local'
  and nullif(rf.storage_path, '') is not null
  and nullif(rf.sha256, '') is null
  {session_filter}
"""
        )

    sql = "select coalesce(json_agg(row_to_json(row)), '[]'::json) from (\n"
    sql += "\nunion all\n".join(selects)
    sql += f"\norder by record_type, source_session_id, track_key, chunk_index nulls first\nlimit {int(limit)}\n) row;"
    return run_json(database_url, sql) or []


def build_metadata(path: Path, stats: dict[str, Any]) -> dict[str, Any]:
    return {
        "backfilled_at": dt.datetime.now(dt.UTC).isoformat(),
        "backfilled_by": "tools/backfill_audio_metadata.py",
        "backfill_source_path": str(path),
        "audio_channels_analyzed": stats.get("audio_channels_analyzed"),
    }


def update_chunk(database_url: str, target: dict[str, Any], path: Path, stats: dict[str, Any]) -> None:
    metadata = build_metadata(path, stats)
    execute(
        database_url,
        f"""
update audio_chunks
set sha256 = {sql_optional_text(stats.get('sha256'))},
    audio_rms = {sql_optional_number(stats.get('audio_rms'))},
    audio_peak = {sql_optional_number(stats.get('audio_peak'))},
    audio_dbfs = {sql_optional_number(stats.get('audio_dbfs'))},
    probably_silent = {sql_bool(stats.get('probably_silent'))},
    silence_dbfs_threshold = {sql_optional_number(stats.get('silence_dbfs_threshold'))},
    transcription_status = case
      when {sql_bool(stats.get('probably_silent'))} is true then 'skipped_silence'
      when transcription_status = 'skipped_silence' then 'pending'
      else transcription_status
    end,
    metadata = coalesce(metadata, '{{}}'::jsonb) || {sql_json(metadata)}
where id = {sql_literal(target['id'])}::uuid;
""",
    )


def update_recording_file(database_url: str, target: dict[str, Any], path: Path, stats: dict[str, Any]) -> None:
    metadata = build_metadata(path, stats)
    execute(
        database_url,
        f"""
update recording_files
set sha256 = {sql_optional_text(stats.get('sha256'))},
    audio_rms = coalesce({sql_optional_number(stats.get('audio_rms'))}, audio_rms),
    audio_peak = coalesce({sql_optional_number(stats.get('audio_peak'))}, audio_peak),
    audio_dbfs = coalesce({sql_optional_number(stats.get('audio_dbfs'))}, audio_dbfs),
    probably_silent = coalesce({sql_bool(stats.get('probably_silent'))}, probably_silent),
    silence_dbfs_threshold = coalesce({sql_optional_number(stats.get('silence_dbfs_threshold'))}, silence_dbfs_threshold),
    metadata = coalesce(metadata, '{{}}'::jsonb) || {sql_json(metadata)}
where id = {sql_literal(target['id'])}::uuid;
""",
    )


def process_target(database_url: str, target: dict[str, Any], write: bool) -> dict[str, Any]:
    path = resolve_path(target["storage_path"])
    result = {
        "recordType": target["record_type"],
        "id": target["id"],
        "sourceSessionId": target.get("source_session_id"),
        "trackKey": target.get("track_key"),
        "chunkIndex": target.get("chunk_index"),
        "path": str(path),
        "exists": path.exists(),
        "updated": False,
    }
    if not path.exists():
        return result

    stats: dict[str, Any] = {"sha256": sha256_file(path)}
    stats.update(wav_audio_stats(path))
    result.update(
        {
            "sha256": stats.get("sha256"),
            "audioDbfs": stats.get("audio_dbfs"),
            "probablySilent": stats.get("probably_silent"),
        }
    )

    if write:
        if target["record_type"] == "audio_chunk":
            update_chunk(database_url, target, path, stats)
        elif target["record_type"] == "recording_file":
            update_recording_file(database_url, target, path, stats)
        result["updated"] = True
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env.local")
    parser.add_argument("--campaign", default=DEFAULT_CAMPAIGN)
    parser.add_argument("--source-session-id")
    parser.add_argument("--record-type", choices=["chunks", "files", "all"], default="chunks")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--write", action="store_true", help="Persist computed metadata into Supabase")
    parser.add_argument("--strict", action="store_true", help="Return non-zero when local files are missing")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    env = load_env(args.env_file)
    database_url = env.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")

    targets = fetch_targets(database_url, args.campaign, args.source_session_id, args.record_type, args.limit)
    results = [process_target(database_url, target, args.write) for target in targets]
    payload = {
        "write": args.write,
        "recordType": args.record_type,
        "sourceSessionId": args.source_session_id,
        "targets": len(targets),
        "updated": sum(1 for item in results if item.get("updated")),
        "missingFiles": sum(1 for item in results if not item.get("exists")),
        "results": results,
    }

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"write={str(args.write).lower()}")
        print(f"targets={payload['targets']}")
        print(f"updated={payload['updated']}")
        print(f"missing_files={payload['missingFiles']}")
        for item in results[:20]:
            status = "updated" if item.get("updated") else "dry_run"
            if not item.get("exists"):
                status = "missing"
            print(
                f"{status} {item['recordType']} {item.get('sourceSessionId')} "
                f"{item.get('trackKey')}#{item.get('chunkIndex')} {item['path']}"
            )
    return 1 if args.strict and payload["missingFiles"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
