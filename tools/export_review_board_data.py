#!/usr/bin/env python3
"""Export Supabase session data to a local JS file for the static Review Board."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
from pathlib import Path
from typing import Any


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = dict(os.environ)
    if not path.exists():
        return values
    for raw in path.read_text(errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def run_json(database_url: str, sql: str) -> Any:
    output = subprocess.check_output(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
        text=True,
        encoding="utf-8",
    )
    text = output.strip()
    if not text:
        return None
    return json.loads(text)


def build_payload(database_url: str, campaign_slug: str, source_session_id: str, ai_run_id: str) -> dict:
    campaign_q = sql_literal(campaign_slug)
    session_q = sql_literal(source_session_id)
    common = (
        "with target as ("
        "select c.id campaign_id, c.slug campaign_slug, c.name campaign_name, "
        "s.id session_id, s.title session_title, s.source_session_id, s.session_date, "
        "s.arc, s.status, s.duration_ms, s.summary_short, s.started_at "
        "from sessions s join campaigns c on c.id = s.campaign_id "
        f"where c.slug = {campaign_q} and s.source_session_id = {session_q}"
        ")"
    )

    session = run_json(
        database_url,
        f"""
{common}
select row_to_json(target) from target;
""",
    )
    if not session:
        raise SystemExit(f"Session not found: campaign={campaign_slug} source_session_id={source_session_id}")

    participants = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'track_key'), '[]'::json) from (
  select json_build_object(
    'id', p.id,
    'track_key', p.source_track_key,
    'player_name', p.player_name,
    'character_name', p.character_name,
    'role', p.role,
    'audio_track_label', p.audio_track_label,
    'participant_status', p.participant_status,
    'needs_review', p.needs_review,
    'discord_handle', p.discord_handle
  ) item
  from participants p
  join target t on t.session_id = p.session_id
) rows;
""",
    )

    segments = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by (item->>'start_ms')::int, item->>'track_key', (item->>'chunk_index')::int), '[]'::json) from (
  select json_build_object(
    'id', ts.source_segment_id,
    'db_id', ts.id,
    'source_sequence', ts.source_sequence,
    'track_key', ts.track_key,
    'speaker_name', ts.speaker_name,
    'speaker_role', ts.speaker_role,
    'character_name', ts.character_name,
    'start_ms', ts.start_ms,
    'end_ms', ts.end_ms,
    'chunk_index', ts.chunk_index,
    'text', ts.text,
    'text_chars', ts.text_chars,
    'text_words', ts.text_words,
    'needs_review', ts.needs_review,
    'review_status', ts.review_status,
    'tags', ts.tags,
    'source_chunk_path', ts.source_chunk_path,
    'response_path', ts.response_path,
    'metadata', ts.metadata
  ) item
  from transcript_segments ts
  join target t on t.session_id = ts.session_id
  where ts.is_empty = false
) rows;
""",
    )

    recording_files = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'source_file_role'), '[]'::json) from (
  select json_build_object(
    'source_file_role', rf.source_file_role,
    'file_type', rf.file_type,
    'storage_bucket', rf.storage_bucket,
    'storage_path', rf.storage_path,
    'original_filename', rf.original_filename,
    'mime_type', rf.mime_type,
    'size_bytes', rf.size_bytes,
    'duration_ms', rf.duration_ms
  ) item
  from recording_files rf
  join target t on t.session_id = rf.session_id
) rows;
""",
    )

    jobs = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'job_type'), '[]'::json) from (
  select json_build_object(
    'job_type', pj.job_type,
    'status', pj.status,
    'attempts', pj.attempts,
    'started_at', pj.started_at,
    'finished_at', pj.finished_at,
    'output', pj.output
  ) item
  from processing_jobs pj
  join target t on t.session_id = pj.session_id
) rows;
""",
    )

    roll20_events = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by coalesce((item->>'approx_start_ms')::int, 2147483647), item->>'created_at'), '[]'::json) from (
  select json_build_object(
    'id', re.id,
    'event_type', re.event_type,
    'roll20_who', re.roll20_who,
    'character_name', re.character_name,
    'approx_start_ms', re.approx_start_ms,
    'text', re.text,
    'source_system', re.source_system,
    'source_event_id', re.source_event_id,
    'created_at_roll20', re.created_at_roll20,
    'created_at', re.created_at,
    'payload', re.payload
  ) item
  from roll20_events re
  join target t on t.session_id = re.session_id
) rows;
""",
    )

    classifications = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'segment_id'), '[]'::json) from (
  select json_build_object(
    'segment_id', ts.source_segment_id,
    'segment_type', sc.segment_type,
    'canon_relevance', sc.canon_relevance,
    'confidence', sc.confidence,
    'needs_review', sc.needs_review,
    'reason', sc.reason,
    'source_run_id', sc.source_run_id,
    'metadata', sc.metadata
  ) item
  from segment_classifications sc
  join transcript_segments ts on ts.id = sc.segment_id
  join target t on t.session_id = ts.session_id
  where sc.source_run_id = {sql_literal(ai_run_id)}
) rows;
""",
    )

    canon_candidates = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'source_candidate_id'), '[]'::json) from (
  select json_build_object(
    'id', cc.id,
    'source_candidate_id', cc.source_candidate_id,
    'title', cc.title,
    'claim', cc.claim,
    'candidate_type', cc.candidate_type,
    'status', cc.status,
    'confidence', cc.confidence,
    'source_segment_ids', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(cc.source_segment_ids) order by ts.source_sequence),
    'metadata', cc.metadata
  ) item
  from canon_candidates cc
  join target t on t.session_id = cc.session_id
  where cc.source_run_id = {sql_literal(ai_run_id)}
) rows;
""",
    )

    quote_candidates = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'source_candidate_id'), '[]'::json) from (
  select json_build_object(
    'id', qc.id,
    'source_candidate_id', qc.source_candidate_id,
    'quote_text', qc.quote_text,
    'character_name', qc.character_name,
    'context', qc.context,
    'status', qc.status,
    'approved_for_public', qc.approved_for_public,
    'source_segment_ids', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(qc.source_segment_ids) order by ts.source_sequence),
    'metadata', qc.metadata
  ) item
  from quote_candidates qc
  join target t on t.session_id = qc.session_id
  where qc.source_run_id = {sql_literal(ai_run_id)}
) rows;
""",
    )

    outtake_candidates = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'source_candidate_id'), '[]'::json) from (
  select json_build_object(
    'id', oc.id,
    'source_candidate_id', oc.source_candidate_id,
    'title', oc.title,
    'description', oc.description,
    'start_ms', oc.start_ms,
    'end_ms', oc.end_ms,
    'sensitivity_level', oc.sensitivity_level,
    'status', oc.status,
    'source_segment_ids', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(oc.source_segment_ids) order by ts.source_sequence),
    'metadata', oc.metadata
  ) item
  from outtake_candidates oc
  join target t on t.session_id = oc.session_id
  where oc.source_run_id = {sql_literal(ai_run_id)}
) rows;
""",
    )

    publications = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'source_publication_id'), '[]'::json) from (
  select json_build_object(
    'id', p.id,
    'publication_type', p.publication_type,
    'source_publication_id', p.source_publication_id,
    'title', p.title,
    'content', p.content,
    'format', p.format,
    'visibility', p.visibility,
    'status', p.status,
    'source_run_id', p.source_run_id,
    'metadata', p.metadata,
    'updated_at', p.updated_at
  ) item
  from publications p
  join target t on t.session_id = p.session_id
  where p.source_run_id = {sql_literal(ai_run_id)}
) rows;
""",
    )

    tracks: dict[str, dict] = {}
    for participant in participants:
        tracks[participant["track_key"]] = {
            "track_key": participant["track_key"],
            "speaker_name": participant["player_name"],
            "character_name": participant["character_name"],
            "role": participant["role"],
            "participant_status": participant["participant_status"],
            "needs_review": participant["needs_review"],
            "segments": 0,
            "words": 0,
        }
    for segment in segments:
        segment["ai"] = None
        track = tracks.setdefault(
            segment["track_key"],
            {
                "track_key": segment["track_key"],
                "speaker_name": segment.get("speaker_name"),
                "character_name": segment.get("character_name"),
                "role": segment.get("speaker_role"),
                "participant_status": "unknown",
                "needs_review": True,
                "segments": 0,
                "words": 0,
            },
        )
        track["segments"] += 1
        track["words"] += int(segment.get("text_words") or 0)

    classification_by_segment = {item["segment_id"]: item for item in classifications}
    for segment in segments:
        segment["ai"] = classification_by_segment.get(segment["id"])

    storage_summary: dict[str, dict[str, int]] = {}
    for file in recording_files:
        bucket = file.get("storage_bucket") or "unknown"
        summary = storage_summary.setdefault(bucket, {"files": 0, "bytes": 0})
        summary["files"] += 1
        summary["bytes"] += int(file.get("size_bytes") or 0)

    return {
        "schemaVersion": 1,
        "exportedAt": dt.datetime.now(dt.UTC).isoformat(),
        "campaign": {
            "slug": session["campaign_slug"],
            "name": session["campaign_name"],
        },
        "session": {
            "id": session["session_id"],
            "sourceSessionId": session["source_session_id"],
            "title": session["session_title"],
            "date": session["session_date"],
            "arc": session.get("arc"),
            "status": session["status"],
            "durationMs": session["duration_ms"],
            "startedAt": session["started_at"],
            "summary": session["summary_short"],
        },
        "participants": participants,
        "tracks": sorted(tracks.values(), key=lambda item: item["track_key"]),
        "segments": segments,
        "recordingFiles": recording_files,
        "jobs": jobs,
        "roll20Events": roll20_events,
        "ai": {
            "runId": ai_run_id,
            "classifications": classifications,
            "canonCandidates": canon_candidates,
            "quoteCandidates": quote_candidates,
            "outtakeCandidates": outtake_candidates,
            "publications": publications,
            "summary": {
                "classifications": len(classifications),
                "canonCandidates": len(canon_candidates),
                "quoteCandidates": len(quote_candidates),
                "outtakeCandidates": len(outtake_candidates),
                "publications": len(publications),
            },
        },
        "summary": {
            "segments": len(segments),
            "participants": len(participants),
            "recordingFiles": len(recording_files),
            "roll20Events": len(roll20_events),
            "words": sum(int(segment.get("text_words") or 0) for segment in segments),
            "durationMs": session["duration_ms"],
            "needsReview": sum(1 for segment in segments if segment.get("needs_review")),
            "storage": storage_summary,
        },
    }


def write_js(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, ensure_ascii=False, indent=2)
    path.write_text(
        "// Generated by tools/export_review_board_data.py. Do not commit real session data.\n"
        f"window.DND_SCRIBE_REAL_REVIEW = {serialized};\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--campaign-slug", default="yuhara-main")
    parser.add_argument("--source-session-id", default="craig-AdabEqbzngmT-stage1-full")
    parser.add_argument("--ai-run-id", default="classify_candidates_v2_gpt-5.4-mini")
    parser.add_argument("--out", type=Path, default=Path("data/review_session.generated.js"))
    args = parser.parse_args()

    values = load_env(args.env_file)
    database_url = values.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")

    payload = build_payload(database_url, args.campaign_slug, args.source_session_id, args.ai_run_id)
    write_js(args.out, payload)
    print(f"out={args.out}")
    print(f"session={payload['session']['sourceSessionId']}")
    print(f"segments={payload['summary']['segments']}")
    print(f"participants={payload['summary']['participants']}")
    print(f"recording_files={payload['summary']['recordingFiles']}")
    print(f"words={payload['summary']['words']}")
    print(f"ai_run_id={payload['ai']['runId']}")
    print(f"ai_classifications={payload['ai']['summary']['classifications']}")
    print(f"ai_candidates={payload['ai']['summary']['canonCandidates'] + payload['ai']['summary']['quoteCandidates'] + payload['ai']['summary']['outtakeCandidates']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
