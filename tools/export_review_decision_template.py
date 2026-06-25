#!/usr/bin/env python3
"""Export a Review Board decision template for DM/manual review."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
from pathlib import Path
from typing import Any


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


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def run_json(database_url: str, sql: str) -> Any:
    output = subprocess.check_output(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
        text=True,
        encoding="utf-8",
    )
    text = output.strip()
    return json.loads(text) if text else None


def build_payload(
    database_url: str,
    campaign_slug: str,
    source_session_id: str,
    source_run_id: str,
    actor_track_key: str,
    include_all_segments: bool,
) -> dict[str, Any]:
    campaign_q = sql_literal(campaign_slug)
    session_q = sql_literal(source_session_id)
    run_q = sql_literal(source_run_id)
    segment_filter = "true" if include_all_segments else "(ts.needs_review = true or ts.review_status <> 'pending')"
    common = (
        "with target as ("
        "select c.slug campaign_slug, c.name campaign_name, s.id session_id, "
        "s.source_session_id, s.title session_title, s.status session_status "
        "from sessions s join campaigns c on c.id = s.campaign_id "
        f"where c.slug = {campaign_q} and s.source_session_id = {session_q}"
        ")"
    )
    session = run_json(database_url, f"{common} select row_to_json(target) from target;")
    if not session:
        raise SystemExit(f"Session not found: {campaign_slug}/{source_session_id}")

    segments = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'sourceSegmentId'), '[]'::json) from (
  select json_build_object(
    'sourceSegmentId', ts.source_segment_id,
    'decision', case when ts.review_status is null or ts.review_status = 'pending' then 'needs_review' else ts.review_status end,
    'characterName', ts.character_name,
    'speakerName', ts.speaker_name,
    'trackKey', ts.track_key,
    'startMs', ts.start_ms,
    'endMs', ts.end_ms,
    'textPreview', left(ts.text, 600),
    'note', ''
  ) item
  from transcript_segments ts
  join target t on t.session_id = ts.session_id
  where ts.source_segment_id is not null
    and {segment_filter}
) rows;
""",
    )

    canon = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'sourceCandidateId'), '[]'::json) from (
  select json_build_object(
    'targetType', 'canon_candidates',
    'sourceCandidateId', cc.source_candidate_id,
    'decision', cc.status,
    'currentStatus', cc.status,
    'title', cc.title,
    'bodyPreview', left(cc.claim, 1000),
    'confidence', cc.confidence,
    'sourceSegmentIds', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(cc.source_segment_ids) order by ts.source_sequence),
    'note', ''
  ) item
  from canon_candidates cc
  join target t on t.session_id = cc.session_id
  where cc.source_run_id = {run_q}
) rows;
""",
    )
    quotes = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'sourceCandidateId'), '[]'::json) from (
  select json_build_object(
    'targetType', 'quote_candidates',
    'sourceCandidateId', qc.source_candidate_id,
    'decision', qc.status,
    'currentStatus', qc.status,
    'title', coalesce(qc.character_name, 'Fala candidata'),
    'bodyPreview', left(qc.quote_text, 1000),
    'context', qc.context,
    'approvedForPublic', qc.approved_for_public,
    'sourceSegmentIds', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(qc.source_segment_ids) order by ts.source_sequence),
    'note', ''
  ) item
  from quote_candidates qc
  join target t on t.session_id = qc.session_id
  where qc.source_run_id = {run_q}
) rows;
""",
    )
    outtakes = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'sourceCandidateId'), '[]'::json) from (
  select json_build_object(
    'targetType', 'outtake_candidates',
    'sourceCandidateId', oc.source_candidate_id,
    'decision', oc.status,
    'currentStatus', oc.status,
    'title', oc.title,
    'bodyPreview', left(oc.description, 1000),
    'sensitivityLevel', oc.sensitivity_level,
    'sourceSegmentIds', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(oc.source_segment_ids) order by ts.source_sequence),
    'note', ''
  ) item
  from outtake_candidates oc
  join target t on t.session_id = oc.session_id
  where oc.source_run_id = {run_q}
) rows;
""",
    )
    candidate_decisions = (canon or []) + (quotes or []) + (outtakes or [])
    return {
        "schemaVersion": 1,
        "sourceSessionId": source_session_id,
        "aiRunId": source_run_id,
        "exportedAt": dt.datetime.now(dt.UTC).isoformat(),
        "campaign": {
            "slug": session["campaign_slug"],
            "name": session["campaign_name"],
        },
        "session": {
            "sourceSessionId": session["source_session_id"],
            "title": session["session_title"],
            "status": session["session_status"],
        },
        "actor": {
            "trackKey": actor_track_key,
            "role": "dm",
            "note": "DM bate o martelo final de canon/publicacao.",
        },
        "segmentDecisions": segments or [],
        "candidateDecisions": sorted(
            candidate_decisions,
            key=lambda item: (item.get("targetType") or "", item.get("sourceCandidateId") or ""),
        ),
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--campaign-slug", default="yuhara-main")
    parser.add_argument("--source-session-id", default="craig-AdabEqbzngmT-stage1-full")
    parser.add_argument("--source-run-id", default="classify_candidates_v2_gpt-4o")
    parser.add_argument("--actor-track-key", default="renanyuhara")
    parser.add_argument("--include-all-segments", action="store_true")
    parser.add_argument("--out", type=Path, default=Path("tmp/review_decisions_template.json"))
    args = parser.parse_args()

    values = load_env(args.env_file)
    database_url = values.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")

    payload = build_payload(
        database_url,
        args.campaign_slug,
        args.source_session_id,
        args.source_run_id,
        args.actor_track_key,
        args.include_all_segments,
    )
    write_json(args.out, payload)
    print(f"out={args.out}")
    print(f"session={payload['sourceSessionId']}")
    print(f"source_run_id={payload['aiRunId']}")
    print(f"segment_decisions={len(payload['segmentDecisions'])}")
    print(f"candidate_decisions={len(payload['candidateDecisions'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
