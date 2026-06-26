#!/usr/bin/env python3
"""Import a local Craig manifest into Supabase recording_files and audio_chunks."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
from pathlib import Path
from typing import Any


DEFAULT_CAMPAIGN = "yuhara-main"


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


def sql_text_array(values: Any) -> str:
    if not values:
        return "array[]::text[]"
    return "array[" + ",".join(sql_literal(str(item)) for item in values) + "]::text[]"


def slug(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return re.sub(r"-+", "-", value).strip("-") or "sessao"


def duration_ms(value: Any) -> int | None:
    try:
        seconds = float(value or 0)
    except (TypeError, ValueError):
        return None
    return round(seconds * 1000) if seconds > 0 else None


def run_scalar(database_url: str, sql: str) -> str | None:
    output = subprocess.check_output(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
        text=True,
        encoding="utf-8",
    )
    text = output.strip()
    return text or None


def execute(database_url: str, sql: str) -> None:
    subprocess.check_call(["psql", database_url, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql])


def campaign_id(database_url: str, campaign_slug: str) -> str:
    value = run_scalar(
        database_url,
        f"select id::text from campaigns where slug = {sql_literal(campaign_slug)} limit 1;",
    )
    if not value:
        raise SystemExit(f"Campaign not found: {campaign_slug}")
    return value


def max_track_duration_ms(manifest: dict[str, Any]) -> int | None:
    values = [duration_ms(track.get("duration_seconds")) for track in manifest.get("tracks") or []]
    values = [item for item in values if item]
    return max(values) if values else None


def upsert_session(
    database_url: str,
    campaign: str,
    manifest: dict[str, Any],
    source_session_id: str,
    title: str | None,
) -> str:
    existing = run_scalar(
        database_url,
        f"""
select id::text
from sessions
where campaign_id = {sql_literal(campaign)}::uuid
  and source_session_id = {sql_literal(source_session_id)}
limit 1;
""",
    )
    craig = manifest.get("craig") or {}
    session_title = title or f"Craig {craig.get('recording_id') or source_session_id}"
    metadata = {
        "craig": craig,
        "manifest": {
            "session_id": manifest.get("session_id"),
            "session_dir": manifest.get("session_dir"),
            "zip_path": manifest.get("zip_path"),
            "chunks_enabled": manifest.get("chunks_enabled"),
            "chunk_seconds": manifest.get("chunk_seconds"),
            "imported_at": dt.datetime.now(dt.UTC).isoformat(),
        },
    }
    session_duration = max_track_duration_ms(manifest)
    if existing:
        execute(
            database_url,
            f"""
update sessions
set title = {sql_literal(session_title)},
    slug = coalesce(slug, {sql_literal(slug(session_title))}),
    status = case when status = 'planned' then 'uploaded' else status end,
    source_system = coalesce(source_system, 'craig'),
    duration_ms = coalesce(duration_ms, {sql_optional_number(session_duration)}),
    metadata = coalesce(metadata, '{{}}'::jsonb) || {sql_json(metadata)},
    updated_at = now()
where id = {sql_literal(existing)}::uuid;
""",
        )
        return existing

    return run_scalar(
        database_url,
        f"""
insert into sessions (
  campaign_id, title, slug, status, source_system, source_session_id, duration_ms, metadata
) values (
  {sql_literal(campaign)}::uuid,
  {sql_literal(session_title)},
  {sql_literal(slug(session_title))},
  'uploaded',
  'craig',
  {sql_literal(source_session_id)},
  {sql_optional_number(session_duration)},
  {sql_json(metadata)}
)
returning id::text;
""",
    ) or ""


def upsert_participant(database_url: str, session_id: str, track: dict[str, Any]) -> str:
    track_key = track.get("track_key") or "unknown"
    existing = run_scalar(
        database_url,
        f"""
select id::text
from participants
where session_id = {sql_literal(session_id)}::uuid
  and source_track_key = {sql_literal(track_key)}
order by created_at nulls last
limit 1;
""",
    )
    metadata = {
        "source_file": track.get("source_file"),
        "source_path": track.get("source_path"),
        "sha256": track.get("sha256"),
        "imported_from": "craig_manifest",
    }
    values = {
        "player": track.get("person_name") or track_key,
        "character": track.get("default_character"),
        "role": track.get("role") or "guest",
        "discord_handle": track.get("discord_handle"),
        "discord_id": track.get("discord_id"),
        "status": track.get("status") or "guest_or_unknown",
        "needs_review": track.get("needs_review"),
        "aliases": track.get("character_aliases") or [],
    }
    if existing:
        execute(
            database_url,
            f"""
update participants
set player_name = {sql_optional_text(values['player'])},
    character_name = {sql_optional_text(values['character'])},
    role = {sql_optional_text(values['role'])},
    audio_track_label = {sql_optional_text(track.get('source_file'))},
    discord_handle = {sql_optional_text(values['discord_handle'])},
    discord_id = {sql_optional_text(values['discord_id'])},
    participant_status = {sql_optional_text(values['status'])},
    character_aliases = {sql_text_array(values['aliases'])},
    needs_review = coalesce({sql_bool(values['needs_review'])}, needs_review),
    metadata = coalesce(metadata, '{{}}'::jsonb) || {sql_json(metadata)}
where id = {sql_literal(existing)}::uuid;
""",
        )
        return existing

    return run_scalar(
        database_url,
        f"""
insert into participants (
  session_id, player_name, character_name, role, audio_track_label, source_track_key,
  discord_handle, discord_id, participant_status, character_aliases, needs_review, metadata
) values (
  {sql_literal(session_id)}::uuid,
  {sql_optional_text(values['player'])},
  {sql_optional_text(values['character'])},
  {sql_optional_text(values['role'])},
  {sql_optional_text(track.get('source_file'))},
  {sql_literal(track_key)},
  {sql_optional_text(values['discord_handle'])},
  {sql_optional_text(values['discord_id'])},
  {sql_optional_text(values['status'])},
  {sql_text_array(values['aliases'])},
  coalesce({sql_bool(values['needs_review'])}, false),
  {sql_json(metadata)}
)
returning id::text;
""",
    ) or ""


def upsert_recording_file(database_url: str, session_id: str, participant_id: str, track: dict[str, Any]) -> str:
    track_key = track.get("track_key") or "unknown"
    existing = run_scalar(
        database_url,
        f"""
select id::text
from recording_files
where session_id = {sql_literal(session_id)}::uuid
  and source_file_role = {sql_literal(track_key)}
order by created_at nulls last
limit 1;
""",
    )
    metadata = {
        "codec": track.get("codec"),
        "sample_rate": track.get("sample_rate"),
        "channels": track.get("channels"),
        "duration_minutes": track.get("duration_minutes"),
        "size_mib": track.get("size_mib"),
        "imported_from": "craig_manifest",
    }
    values_sql = f"""
participant_id = {sql_literal(participant_id)}::uuid,
file_type = 'craig_track',
storage_bucket = 'local',
storage_path = {sql_literal(track.get('source_path') or track.get('source_file') or track_key)},
original_filename = {sql_optional_text(track.get('source_file'))},
mime_type = 'audio/flac',
size_bytes = {sql_optional_number(track.get('size_bytes'))},
duration_ms = {sql_optional_number(duration_ms(track.get('duration_seconds')))},
source_system = 'craig',
source_file_role = {sql_literal(track_key)},
metadata = coalesce(metadata, '{{}}'::jsonb) || {sql_json(metadata)},
sha256 = {sql_optional_text(track.get('sha256'))},
audio_rms = {sql_optional_number(track.get('audio_rms'))},
audio_peak = {sql_optional_number(track.get('audio_peak'))},
audio_dbfs = {sql_optional_number(track.get('audio_dbfs'))},
probably_silent = {sql_bool(track.get('probably_silent'))},
silence_dbfs_threshold = {sql_optional_number(track.get('silence_dbfs_threshold'))}
"""
    if existing:
        execute(
            database_url,
            f"""
update recording_files
set {values_sql}
where id = {sql_literal(existing)}::uuid;
""",
        )
        return existing

    return run_scalar(
        database_url,
        f"""
insert into recording_files (
  session_id, participant_id, file_type, storage_bucket, storage_path, original_filename,
  mime_type, size_bytes, duration_ms, source_system, source_file_role, metadata,
  sha256, audio_rms, audio_peak, audio_dbfs, probably_silent, silence_dbfs_threshold
) values (
  {sql_literal(session_id)}::uuid,
  {sql_literal(participant_id)}::uuid,
  'craig_track',
  'local',
  {sql_literal(track.get('source_path') or track.get('source_file') or track_key)},
  {sql_optional_text(track.get('source_file'))},
  'audio/flac',
  {sql_optional_number(track.get('size_bytes'))},
  {sql_optional_number(duration_ms(track.get('duration_seconds')))},
  'craig',
  {sql_literal(track_key)},
  {sql_json(metadata)},
  {sql_optional_text(track.get('sha256'))},
  {sql_optional_number(track.get('audio_rms'))},
  {sql_optional_number(track.get('audio_peak'))},
  {sql_optional_number(track.get('audio_dbfs'))},
  {sql_bool(track.get('probably_silent'))},
  {sql_optional_number(track.get('silence_dbfs_threshold'))}
)
returning id::text;
""",
    ) or ""


def upsert_chunk(database_url: str, session_id: str, recording_file_id: str, track_key: str, chunk: dict[str, Any]) -> str:
    existing = run_scalar(
        database_url,
        f"""
select id::text
from audio_chunks
where source_file_id = {sql_literal(recording_file_id)}::uuid
  and chunk_index = {int(chunk.get('index') or 0)}
limit 1;
""",
    )
    is_silent = chunk.get("probably_silent") is True
    transcription_status = "skipped_silence" if is_silent else "pending"
    metadata = {
        "codec": chunk.get("codec"),
        "sample_rate": chunk.get("sample_rate"),
        "channels": chunk.get("channels"),
        "duration_minutes": chunk.get("duration_minutes"),
        "size_mib": chunk.get("size_mib"),
        "audio_rms": chunk.get("audio_rms"),
        "audio_peak": chunk.get("audio_peak"),
        "audio_dbfs": chunk.get("audio_dbfs"),
        "probably_silent": chunk.get("probably_silent"),
        "imported_from": "craig_manifest",
    }
    values_sql = f"""
session_id = {sql_literal(session_id)}::uuid,
source_file_id = {sql_literal(recording_file_id)}::uuid,
chunk_index = {int(chunk.get('index') or 0)},
start_ms = {int(chunk.get('start_ms') or 0)},
end_ms = {int(chunk.get('end_ms') or 0)},
storage_bucket = 'local',
storage_path = {sql_literal(chunk.get('path') or chunk.get('filename') or '')},
transcription_status = {sql_literal(transcription_status)},
track_key = {sql_literal(track_key)},
source_chunk_name = {sql_optional_text(chunk.get('filename'))},
duration_ms = {sql_optional_number(duration_ms(chunk.get('duration_seconds')))},
size_bytes = {sql_optional_number(chunk.get('size_bytes'))},
metadata = coalesce(metadata, '{{}}'::jsonb) || {sql_json(metadata)},
sha256 = {sql_optional_text(chunk.get('sha256'))},
audio_rms = {sql_optional_number(chunk.get('audio_rms'))},
audio_peak = {sql_optional_number(chunk.get('audio_peak'))},
audio_dbfs = {sql_optional_number(chunk.get('audio_dbfs'))},
probably_silent = {sql_bool(chunk.get('probably_silent'))},
silence_dbfs_threshold = {sql_optional_number(chunk.get('silence_dbfs_threshold'))}
"""
    if existing:
        execute(
            database_url,
            f"""
update audio_chunks
set {values_sql}
where id = {sql_literal(existing)}::uuid;
""",
        )
        return existing

    return run_scalar(
        database_url,
        f"""
insert into audio_chunks (
  session_id, source_file_id, chunk_index, start_ms, end_ms, storage_bucket, storage_path,
  transcription_status, track_key, source_chunk_name, duration_ms, size_bytes, metadata,
  sha256, audio_rms, audio_peak, audio_dbfs, probably_silent, silence_dbfs_threshold
) values (
  {sql_literal(session_id)}::uuid,
  {sql_literal(recording_file_id)}::uuid,
  {int(chunk.get('index') or 0)},
  {int(chunk.get('start_ms') or 0)},
  {int(chunk.get('end_ms') or 0)},
  'local',
  {sql_literal(chunk.get('path') or chunk.get('filename') or '')},
  {sql_literal(transcription_status)},
  {sql_literal(track_key)},
  {sql_optional_text(chunk.get('filename'))},
  {sql_optional_number(duration_ms(chunk.get('duration_seconds')))},
  {sql_optional_number(chunk.get('size_bytes'))},
  {sql_json(metadata)},
  {sql_optional_text(chunk.get('sha256'))},
  {sql_optional_number(chunk.get('audio_rms'))},
  {sql_optional_number(chunk.get('audio_peak'))},
  {sql_optional_number(chunk.get('audio_dbfs'))},
  {sql_bool(chunk.get('probably_silent'))},
  {sql_optional_number(chunk.get('silence_dbfs_threshold'))}
)
returning id::text;
""",
    ) or ""


def import_manifest(database_url: str, manifest_path: Path, campaign_slug: str, source_session_id: str | None, title: str | None) -> dict[str, int | str]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    campaign = campaign_id(database_url, campaign_slug)
    source_id = source_session_id or str(manifest.get("session_id") or manifest_path.parent.name)
    session = upsert_session(database_url, campaign, manifest, source_id, title)

    participants = 0
    files = 0
    chunks = 0
    silent_chunks = 0
    for track in manifest.get("tracks") or []:
        participant = upsert_participant(database_url, session, track)
        recording_file = upsert_recording_file(database_url, session, participant, track)
        participants += 1
        files += 1
        for chunk in track.get("chunks") or []:
            upsert_chunk(database_url, session, recording_file, track.get("track_key") or "unknown", chunk)
            chunks += 1
            if chunk.get("probably_silent") is True:
                silent_chunks += 1

    return {
        "session_id": session,
        "source_session_id": source_id,
        "participants": participants,
        "recording_files": files,
        "chunks": chunks,
        "silent_chunks": silent_chunks,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="Path to tmp/sessions/<id>/manifest.json")
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--campaign", default=DEFAULT_CAMPAIGN)
    parser.add_argument("--source-session-id")
    parser.add_argument("--title")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    values = load_env(args.env_file)
    database_url = values.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")
    if not args.manifest.exists():
        raise SystemExit(f"Manifest not found: {args.manifest}")

    result = import_manifest(database_url, args.manifest, args.campaign, args.source_session_id, args.title)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        for key, value in result.items():
            print(f"{key}={value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
