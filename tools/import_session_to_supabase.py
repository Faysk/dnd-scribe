#!/usr/bin/env python3
"""Import a local Craig session folder into Supabase/Postgres."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any


NAMESPACE = uuid.UUID("0e5b216d-7b46-48dd-83dd-6e5b4f27a614")


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def stable_uuid(*parts: Any) -> str:
    value = "/".join(str(part) for part in parts)
    return str(uuid.uuid5(NAMESPACE, value))


def q(value: Any, cast: str | None = None) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    text = str(value).replace("'", "''")
    literal = f"'{text}'"
    return f"{literal}::{cast}" if cast else literal


def q_json(value: Any) -> str:
    text = json.dumps(value, ensure_ascii=False, sort_keys=True).replace("'", "''")
    return f"'{text}'::jsonb"


def q_text_array(values: list[str] | None) -> str:
    values = values or []
    if not values:
        return "array[]::text[]"
    return "array[" + ", ".join(q(value) for value in values) + "]::text[]"


def start_date(started_at: str | None) -> str | None:
    if not started_at:
        return None
    try:
        parsed = dt.datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.date().isoformat()


def file_size(path: Path) -> int | None:
    try:
        return path.stat().st_size
    except FileNotFoundError:
        return None


def duration_ms(seconds: float | int | None) -> int | None:
    if seconds is None:
        return None
    return round(float(seconds) * 1000)


def upsert(table: str, values: dict[str, str], update_columns: list[str] | None = None) -> str:
    columns = list(values.keys())
    update_columns = update_columns if update_columns is not None else [col for col in columns if col != "id"]
    assignments = ", ".join(f"{col} = excluded.{col}" for col in update_columns)
    sql = f"insert into {table} ({', '.join(columns)}) values ({', '.join(values[col] for col in columns)})"
    if assignments:
        sql += f" on conflict (id) do update set {assignments};"
    else:
        sql += " on conflict (id) do nothing;"
    return sql


def build_sql(session_dir: Path, campaign_slug: str, campaign_name: str, session_title: str | None) -> tuple[str, dict[str, int]]:
    manifest = read_json(session_dir / "manifest.json")
    participants = read_json(session_dir / "participants.json")
    master = read_json(session_dir / "transcripts" / "transcript_master.json")

    source_session_id = manifest["session_id"]
    campaign_id = stable_uuid("campaign", campaign_slug)
    session_id = stable_uuid("session", campaign_slug, source_session_id)
    started_at = (manifest.get("craig") or {}).get("start_time")
    session_date = start_date(started_at)
    title = session_title or f"Sessao Craig {source_session_id}"
    summary = master.get("summary") or {}

    lines = [
        "begin;",
        "set local lock_timeout = '10s';",
        "set local statement_timeout = '120s';",
    ]

    lines.append(
        upsert(
            "campaigns",
            {
                "id": q(campaign_id, "uuid"),
                "name": q(campaign_name),
                "slug": q(campaign_slug),
                "description": q("Campanha principal importada pelo pipeline local."),
                "metadata": q_json({"source": "local_import"}),
            },
        )
    )

    profile_ids: dict[str, str] = {}
    participant_ids: dict[str, str] = {}
    track_file_ids: dict[str, str] = {}
    chunk_ids: dict[tuple[str, int], str] = {}

    for participant in participants:
        track_key = participant["track_key"]
        discord_id = participant.get("discord_id")
        profile_id = stable_uuid("profile", discord_id or track_key)
        profile_ids[track_key] = profile_id
        participant_ids[track_key] = stable_uuid("participant", session_id, track_key)
        source_key = discord_id or track_key

        lines.append(
            upsert(
                "profiles",
                {
                    "id": q(profile_id, "uuid"),
                    "display_name": q(participant.get("person_name") or track_key),
                    "discord_id": q(discord_id),
                    "roll20_name": q(track_key),
                    "default_character_name": q(participant.get("default_character")),
                    "source_system": q("discord"),
                    "source_key": q(source_key),
                    "metadata": q_json(
                        {
                            "discord_handle": participant.get("discord_handle"),
                            "participant_status": participant.get("status"),
                            "source_file": participant.get("source_file"),
                        }
                    ),
                },
            )
        )

        if participant.get("status") == "known":
            member_role = "master" if participant.get("role") == "dm" else "player"
            lines.append(
                upsert(
                    "campaign_members",
                    {
                        "id": q(stable_uuid("campaign_member", campaign_id, profile_id), "uuid"),
                        "campaign_id": q(campaign_id, "uuid"),
                        "profile_id": q(profile_id, "uuid"),
                        "role": q(member_role),
                    },
                )
            )

    lines.append(
        upsert(
            "sessions",
            {
                "id": q(session_id, "uuid"),
                "campaign_id": q(campaign_id, "uuid"),
                "title": q(title),
                "slug": q(source_session_id),
                "session_date": q(session_date, "date") if session_date else "null",
                "status": q("ready_for_review"),
                "summary_short": q(
                    f"{summary.get('segments_with_text', 0)} segmentos com texto em {summary.get('duration', 'duracao desconhecida')}."
                ),
                "consent_confirmed": "false",
                "source_system": q("craig"),
                "source_session_id": q(source_session_id),
                "started_at": q(started_at, "timestamptz") if started_at else "null",
                "duration_ms": q(summary.get("duration_ms")),
                "metadata": q_json(
                    {
                        "craig": manifest.get("craig"),
                        "zip_path": manifest.get("zip_path"),
                        "session_dir": str(session_dir),
                        "transcript_summary": summary,
                    }
                ),
            },
        )
    )

    for participant in participants:
        track_key = participant["track_key"]
        lines.append(
            upsert(
                "participants",
                {
                    "id": q(participant_ids[track_key], "uuid"),
                    "session_id": q(session_id, "uuid"),
                    "profile_id": q(profile_ids[track_key], "uuid"),
                    "player_name": q(participant.get("person_name")),
                    "character_name": q(participant.get("default_character")),
                    "role": q(participant.get("role")),
                    "audio_track_label": q(participant.get("source_file")),
                    "source_track_key": q(track_key),
                    "discord_handle": q(participant.get("discord_handle")),
                    "discord_id": q(participant.get("discord_id")),
                    "participant_status": q(participant.get("status")),
                    "character_aliases": q_text_array(participant.get("character_aliases") or []),
                    "needs_review": q(bool(participant.get("needs_review"))),
                    "metadata": q_json(participant),
                },
            )
        )

    def recording_file(
        role: str,
        file_type: str,
        path: Path,
        original_filename: str | None = None,
        participant_id: str | None = None,
        mime_type: str | None = None,
        size: int | None = None,
        file_duration_ms: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        file_id = stable_uuid("recording_file", session_id, role, str(path))
        lines.append(
            upsert(
                "recording_files",
                {
                    "id": q(file_id, "uuid"),
                    "session_id": q(session_id, "uuid"),
                    "participant_id": q(participant_id, "uuid") if participant_id else "null",
                    "file_type": q(file_type),
                    "storage_bucket": q("local"),
                    "storage_path": q(str(path)),
                    "original_filename": q(original_filename or path.name),
                    "mime_type": q(mime_type),
                    "size_bytes": q(size if size is not None else file_size(path)),
                    "duration_ms": q(file_duration_ms),
                    "source_system": q("local"),
                    "source_file_role": q(role),
                    "metadata": q_json(metadata or {}),
                },
            )
        )
        return file_id

    zip_path = Path(manifest.get("zip_path") or "")
    if str(zip_path):
        recording_file("craig_zip", "other", zip_path, mime_type="application/zip")

    info_path = session_dir / "raw" / "info.txt"
    recording_file("craig_info", "craig_info", info_path, mime_type="text/plain", metadata=manifest.get("craig") or {})

    for track in manifest.get("tracks") or []:
        track_key = track["track_key"]
        track_path = Path(track.get("source_path") or session_dir / "raw" / track["source_file"])
        track_file_ids[track_key] = recording_file(
            f"craig_track_{track_key}",
            "craig_track",
            track_path,
            original_filename=track.get("source_file"),
            participant_id=participant_ids.get(track_key),
            mime_type="audio/flac",
            size=track.get("size_bytes"),
            file_duration_ms=duration_ms(track.get("duration_seconds")),
            metadata={k: v for k, v in track.items() if k != "chunks"},
        )

    artifact_specs = [
        ("manifest", "processed_json", session_dir / "manifest.json", "application/json"),
        ("participants", "processed_json", session_dir / "participants.json", "application/json"),
        ("transcription_index", "processed_json", session_dir / "transcripts" / "transcription_index.json", "application/json"),
        ("segments_raw", "transcript_raw", session_dir / "transcripts" / "segments.json", "application/json"),
        ("transcript_tracks", "transcript_raw", session_dir / "transcripts" / "transcript_tracks.json", "application/json"),
        ("track_summaries", "processed_json", session_dir / "transcripts" / "track_summaries.json", "application/json"),
        ("transcript_master_json", "processed_json", session_dir / "transcripts" / "transcript_master.json", "application/json"),
        ("transcript_master_md", "other", session_dir / "transcripts" / "transcript_master.md", "text/markdown"),
    ]
    for role, file_type, path, mime_type in artifact_specs:
        if path.exists():
            recording_file(role, file_type, path, mime_type=mime_type)

    for track in manifest.get("tracks") or []:
        track_key = track["track_key"]
        source_file_id = track_file_ids[track_key]
        for chunk in track.get("chunks") or []:
            chunk_index = int(chunk["index"])
            chunk_id = stable_uuid("audio_chunk", session_id, track_key, chunk_index)
            chunk_ids[(track_key, chunk_index)] = chunk_id
            response_path = session_dir / "transcripts" / "raw" / track_key / f"chunk_{chunk_index:03d}.json"
            lines.append(
                upsert(
                    "audio_chunks",
                    {
                        "id": q(chunk_id, "uuid"),
                        "session_id": q(session_id, "uuid"),
                        "source_file_id": q(source_file_id, "uuid"),
                        "chunk_index": q(chunk_index),
                        "start_ms": q(chunk.get("start_ms")),
                        "end_ms": q(chunk.get("end_ms")),
                        "storage_bucket": q("local"),
                        "storage_path": q(chunk.get("path")),
                        "transcription_status": q("succeeded" if response_path.exists() else "pending"),
                        "track_key": q(track_key),
                        "source_chunk_name": q(chunk.get("filename")),
                        "duration_ms": q(duration_ms(chunk.get("duration_seconds"))),
                        "size_bytes": q(chunk.get("size_bytes")),
                        "metadata": q_json(chunk),
                    },
                )
            )

    for segment in master.get("segments") or []:
        track_key = segment["track_key"]
        chunk_index = int(segment["chunk_index"])
        participant_id = participant_ids.get(track_key)
        profile_id = profile_ids.get(track_key)
        source_file_id = track_file_ids.get(track_key)
        source_chunk_id = chunk_ids.get((track_key, chunk_index))
        segment_id = stable_uuid("transcript_segment", session_id, segment["id"])
        lines.append(
            upsert(
                "transcript_segments",
                {
                    "id": q(segment_id, "uuid"),
                    "session_id": q(session_id, "uuid"),
                    "speaker_profile_id": q(profile_id, "uuid") if profile_id else "null",
                    "participant_id": q(participant_id, "uuid") if participant_id else "null",
                    "character_name": q(segment.get("character_name")),
                    "source_file_id": q(source_file_id, "uuid") if source_file_id else "null",
                    "source_chunk_id": q(source_chunk_id, "uuid") if source_chunk_id else "null",
                    "start_ms": q(segment.get("timeline_start_ms")),
                    "end_ms": q(segment.get("timeline_end_ms")),
                    "text": q(segment.get("text") or ""),
                    "language": q("pt"),
                    "source_segment_id": q(segment.get("id")),
                    "source_sequence": q(segment.get("source_sequence")),
                    "track_key": q(track_key),
                    "speaker_name": q(segment.get("speaker_name")),
                    "speaker_role": q(segment.get("speaker_role")),
                    "source_chunk_path": q(segment.get("source_chunk_path")),
                    "response_path": q(segment.get("response_path")),
                    "chunk_index": q(chunk_index),
                    "text_chars": q(segment.get("text_chars")),
                    "text_words": q(segment.get("text_words")),
                    "is_empty": q(bool(segment.get("is_empty"))),
                    "needs_review": q(bool(segment.get("needs_review"))),
                    "review_status": q(segment.get("review_status") or "pending"),
                    "tags": q_text_array(segment.get("tags") or []),
                    "metadata": q_json(
                        {
                            "timeline_start": segment.get("timeline_start"),
                            "timeline_end": segment.get("timeline_end"),
                            "participant_status": segment.get("participant_status"),
                            "default_character": segment.get("default_character"),
                            "character_needs_review": segment.get("character_needs_review"),
                            "source_file": segment.get("source_file"),
                            "source_chunk": segment.get("source_chunk"),
                        }
                    ),
                },
            )
        )

    lines.append(
        upsert(
            "processing_jobs",
            {
                "id": q(stable_uuid("processing_job", session_id, "local_import"), "uuid"),
                "session_id": q(session_id, "uuid"),
                "job_type": q("local_craig_session_import"),
                "status": q("succeeded"),
                "attempts": q(1),
                "input": q_json({"session_dir": str(session_dir), "source_session_id": source_session_id}),
                "output": q_json(
                    {
                        "participants": len(participants),
                        "recording_files": len([line for line in lines if line.startswith("insert into recording_files")]),
                        "audio_chunks": sum(len(track.get("chunks") or []) for track in manifest.get("tracks") or []),
                        "transcript_segments": len(master.get("segments") or []),
                    }
                ),
                "started_at": q(dt.datetime.now(dt.UTC).isoformat(), "timestamptz"),
                "finished_at": q(dt.datetime.now(dt.UTC).isoformat(), "timestamptz"),
            },
        )
    )

    lines.append("commit;")

    counts = {
        "participants": len(participants),
        "known_campaign_members": sum(1 for participant in participants if participant.get("status") == "known"),
        "recording_files": len([line for line in lines if line.startswith("insert into recording_files")]),
        "audio_chunks": sum(len(track.get("chunks") or []) for track in manifest.get("tracks") or []),
        "transcript_segments": len(master.get("segments") or []),
    }
    return "\n".join(lines) + "\n", counts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session_dir", type=Path)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--campaign-slug", default="dnd-main")
    parser.add_argument("--campaign-name", default="DnD Campaign")
    parser.add_argument("--session-title")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--write-sql", type=Path, help="Write generated SQL to this path.")
    args = parser.parse_args()

    if not args.session_dir.exists():
        raise SystemExit(f"Session dir not found: {args.session_dir}")

    sql, counts = build_sql(args.session_dir, args.campaign_slug, args.campaign_name, args.session_title)
    if args.write_sql:
        args.write_sql.parent.mkdir(parents=True, exist_ok=True)
        args.write_sql.write_text(sql, encoding="utf-8")

    print("prepared=true")
    for key, value in counts.items():
        print(f"{key}={value}")

    if args.dry_run:
        return 0

    values = load_env(args.env_file)
    database_url = values.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")

    with tempfile.NamedTemporaryFile("w", suffix=".sql", encoding="utf-8", delete=False) as handle:
        handle.write(sql)
        temp_sql = Path(handle.name)
    try:
        subprocess.check_call(["psql", database_url, "-v", "ON_ERROR_STOP=1", "-f", str(temp_sql)])
    finally:
        temp_sql.unlink(missing_ok=True)

    print("imported=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
