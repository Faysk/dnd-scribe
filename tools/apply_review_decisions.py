#!/usr/bin/env python3
"""Apply exported Review Board decisions to Supabase/Postgres."""

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

SEGMENT_STATUSES = {
    "pending",
    "needs_review",
    "approved",
    "canon_candidate",
    "quote_candidate",
    "outtake",
    "private_note",
    "rejected",
}

CANON_STATUS_MAP = {
    "candidate": "candidate",
    "approved": "approved_canon",
    "approved_canon": "approved_canon",
    "rejected": "rejected",
    "private": "private",
    "interpretation": "interpretation",
    "possible_hook": "possible_hook",
    "retcon_pending": "retcon_pending",
}

QUOTE_STATUS_MAP = {
    "candidate": "candidate",
    "approved": "approved",
    "rejected": "rejected",
    "private": "private",
}

OUTTAKE_STATUS_MAP = {
    "candidate": "candidate",
    "approved": "approved_by_speaker",
    "approved_by_speaker": "approved_by_speaker",
    "approved_by_all": "approved_by_all",
    "rejected": "rejected",
    "private": "private",
}

TARGET_TABLES = {
    "canon_candidates": CANON_STATUS_MAP,
    "quote_candidates": QUOTE_STATUS_MAP,
    "outtake_candidates": OUTTAKE_STATUS_MAP,
}


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


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def stable_uuid(*parts: object) -> str:
    return str(uuid.uuid5(NAMESPACE, "/".join(str(part) for part in parts)))


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
    return "'" + json.dumps(value, ensure_ascii=False, sort_keys=True).replace("'", "''") + "'::jsonb"


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


def apply_db_update(database_url: str, sql: str) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".sql", encoding="utf-8", delete=False) as handle:
        handle.write(sql)
        temp_sql = Path(handle.name)
    try:
        subprocess.check_call(["psql", database_url, "-v", "ON_ERROR_STOP=1", "-f", str(temp_sql)])
    finally:
        temp_sql.unlink(missing_ok=True)


def resolve_context(
    database_url: str,
    campaign_slug: str,
    source_session_id: str,
    source_run_id: str,
    actor_key: str | None,
) -> dict[str, Any]:
    campaign_q = sql_literal(campaign_slug)
    session_q = sql_literal(source_session_id)
    run_q = sql_literal(source_run_id)
    common = (
        "with target as ("
        "select c.id campaign_id, c.slug campaign_slug, s.id session_id, s.source_session_id "
        "from sessions s join campaigns c on c.id = s.campaign_id "
        f"where c.slug = {campaign_q} and s.source_session_id = {session_q}"
        ")"
    )
    session = run_json(database_url, f"{common} select row_to_json(target) from target;")
    if not session:
        raise SystemExit(f"Session not found: {campaign_slug}/{source_session_id}")

    actor = None
    if actor_key:
        actor_q = sql_literal(actor_key)
        actor = run_json(
            database_url,
            f"""
{common}
select row_to_json(actor_row) from (
  select p.id, p.display_name, p.roll20_name, p.source_key, p.discord_id
  from profiles p
  left join participants pt on pt.profile_id = p.id
  left join target t on t.session_id = pt.session_id
  where pt.source_track_key = {actor_q}
     or p.roll20_name = {actor_q}
     or p.source_key = {actor_q}
     or p.discord_id = {actor_q}
     or lower(p.display_name) = lower({actor_q})
  order by case when pt.source_track_key = {actor_q} then 0 else 1 end
  limit 1
) actor_row;
""",
        )

    segments = run_json(
        database_url,
        f"""
{common}
select coalesce(json_object_agg(source_segment_id, item), '{{}}'::json) from (
  select ts.source_segment_id, json_build_object(
    'id', ts.id,
    'source_segment_id', ts.source_segment_id,
    'character_name', ts.character_name,
    'text', ts.text,
    'review_status', ts.review_status
  ) item
  from transcript_segments ts
  join target t on t.session_id = ts.session_id
  where ts.source_segment_id is not null
) rows;
""",
    )

    def candidates(table: str) -> dict[str, Any]:
        return run_json(
            database_url,
            f"""
{common}
select coalesce(json_object_agg(source_candidate_id, item), '{{}}'::json) from (
  select source_candidate_id, json_build_object(
    'id', id,
    'source_candidate_id', source_candidate_id,
    'status', status
  ) item
  from {table} item
  join target t on t.session_id = item.session_id
  where item.source_run_id = {run_q}
    and item.source_candidate_id is not null
) rows;
""",
        )

    return {
        "session": session,
        "actor": actor,
        "segments": segments or {},
        "candidates": {
            "canon_candidates": candidates("canon_candidates") or {},
            "quote_candidates": candidates("quote_candidates") or {},
            "outtake_candidates": candidates("outtake_candidates") or {},
        },
    }


def normalize_segment_decision(raw: dict[str, Any]) -> dict[str, Any]:
    source_id = str(raw.get("sourceSegmentId") or raw.get("source_segment_id") or raw.get("id") or "").strip()
    decision = str(raw.get("decision") or raw.get("status") or "").strip()
    if not source_id:
        raise ValueError("segment decision missing sourceSegmentId")
    if decision not in SEGMENT_STATUSES:
        raise ValueError(f"invalid segment decision for {source_id}: {decision}")
    return {
        "source_segment_id": source_id,
        "decision": decision,
        "character_name": raw.get("characterName") if "characterName" in raw else raw.get("character_name"),
        "text_override": raw.get("textOverride") if "textOverride" in raw else raw.get("text_override"),
        "note": raw.get("note") or raw.get("notes") or "",
        "updated_at": raw.get("updatedAt") or raw.get("updated_at"),
        "raw": raw,
    }


def normalize_candidate_decision(raw: dict[str, Any]) -> dict[str, Any]:
    target_table = str(raw.get("targetType") or raw.get("target_table") or raw.get("targetTable") or "").strip()
    source_id = str(raw.get("sourceCandidateId") or raw.get("source_candidate_id") or raw.get("id") or "").strip()
    decision = str(raw.get("decision") or raw.get("status") or "").strip()
    if target_table not in TARGET_TABLES:
        raise ValueError(f"invalid candidate target table: {target_table}")
    if not source_id:
        raise ValueError(f"candidate decision missing sourceCandidateId for {target_table}")
    status_map = TARGET_TABLES[target_table]
    if decision not in status_map:
        raise ValueError(f"invalid candidate decision for {target_table}/{source_id}: {decision}")
    return {
        "target_table": target_table,
        "source_candidate_id": source_id,
        "decision": decision,
        "status": status_map[decision],
        "note": raw.get("note") or raw.get("notes") or "",
        "approved_for_public": bool(raw.get("approvedForPublic") or raw.get("approved_for_public")),
        "updated_at": raw.get("updatedAt") or raw.get("updated_at"),
        "raw": raw,
    }


def load_payload(path: Path) -> dict[str, Any]:
    payload = read_json(path)
    if not isinstance(payload, dict):
        raise SystemExit("Decision payload must be a JSON object")
    if payload.get("schemaVersion") not in (1, "1", None):
        raise SystemExit(f"Unsupported schemaVersion: {payload.get('schemaVersion')}")
    return payload


def metadata(kind: str, payload: dict[str, Any], previous: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "kind": kind,
        "source_payload": payload,
        "previous": previous or {},
        "applied_by": "tools/apply_review_decisions.py",
    }


def insert_review_decision_sql(
    *,
    row_id: str,
    session_id: str,
    target_table: str,
    target_id: str,
    decision: str,
    note: str,
    actor_id: str | None,
    source_run_id: str,
    source_decision_id: str,
    target_source_id: str,
    metadata_value: dict[str, Any],
) -> str:
    return f"""
insert into review_decisions (
  id, session_id, target_table, target_id, decision, notes, decided_by,
  source_system, source_run_id, source_decision_id, target_source_id, metadata, updated_at
)
values (
  {q(row_id, "uuid")},
  {q(session_id, "uuid")},
  {q(target_table)},
  {q(target_id, "uuid")},
  {q(decision)},
  {q(note or None)},
  {q(actor_id, "uuid") if actor_id else "null"},
  'local_review_board',
  {q(source_run_id)},
  {q(source_decision_id)},
  {q(target_source_id)},
  {q_json(metadata_value)},
  now()
)
on conflict (session_id, source_run_id, source_decision_id)
where source_run_id is not null and source_decision_id is not null
do update set
  target_table = excluded.target_table,
  target_id = excluded.target_id,
  decision = excluded.decision,
  notes = excluded.notes,
  decided_by = excluded.decided_by,
  source_system = excluded.source_system,
  target_source_id = excluded.target_source_id,
  metadata = excluded.metadata,
  updated_at = now();
""".strip()


def build_sql(
    payload: dict[str, Any],
    context: dict[str, Any],
    *,
    source_run_id: str,
    payload_path: Path,
) -> tuple[str, dict[str, Any]]:
    session_id = context["session"]["session_id"]
    source_session_id = context["session"]["source_session_id"]
    actor = context.get("actor")
    actor_id = actor["id"] if actor else None
    lines = [
        "begin;",
        "set local lock_timeout = '10s';",
        "set local statement_timeout = '120s';",
    ]
    summary = {
        "segment_decisions": 0,
        "candidate_decisions": 0,
        "missing_segments": [],
        "missing_candidates": [],
        "actor_resolved": bool(actor_id),
    }

    segment_decisions = [normalize_segment_decision(item) for item in payload.get("segmentDecisions") or []]
    candidate_decisions = [normalize_candidate_decision(item) for item in payload.get("candidateDecisions") or []]

    for item in segment_decisions:
        source_id = item["source_segment_id"]
        current = context["segments"].get(source_id)
        if not current:
            summary["missing_segments"].append(source_id)
            continue
        source_decision_id = f"transcript_segments:{source_id}"
        row_id = stable_uuid("review_decision", source_session_id, source_run_id, source_decision_id)
        lines.append(
            insert_review_decision_sql(
                row_id=row_id,
                session_id=session_id,
                target_table="transcript_segments",
                target_id=current["id"],
                decision=item["decision"],
                note=item["note"],
                actor_id=actor_id,
                source_run_id=source_run_id,
                source_decision_id=source_decision_id,
                target_source_id=source_id,
                metadata_value=metadata("segment", item["raw"], current),
            )
        )

        updates = [f"review_status = {q(item['decision'])}", f"metadata = coalesce(metadata, '{{}}'::jsonb) || {q_json({'review': metadata('segment', item['raw'], current)})}"]
        character_name = item.get("character_name")
        if character_name is not None and str(character_name).strip():
            updates.append(f"character_name = {q(str(character_name).strip())}")
        text_override = item.get("text_override")
        if text_override is not None and str(text_override).strip() and str(text_override) != current.get("text"):
            text = str(text_override).strip()
            updates.extend(
                [
                    f"text = {q(text)}",
                    f"text_chars = {len(text)}",
                    f"text_words = {len(text.split())}",
                ]
            )
        lines.append(f"update transcript_segments set {', '.join(updates)} where id = {q(current['id'], 'uuid')};")
        summary["segment_decisions"] += 1

    for item in candidate_decisions:
        target_table = item["target_table"]
        source_id = item["source_candidate_id"]
        current = context["candidates"][target_table].get(source_id)
        if not current:
            summary["missing_candidates"].append(f"{target_table}:{source_id}")
            continue
        source_decision_id = f"{target_table}:{source_id}"
        row_id = stable_uuid("review_decision", source_session_id, source_run_id, source_decision_id)
        lines.append(
            insert_review_decision_sql(
                row_id=row_id,
                session_id=session_id,
                target_table=target_table,
                target_id=current["id"],
                decision=item["decision"],
                note=item["note"],
                actor_id=actor_id,
                source_run_id=source_run_id,
                source_decision_id=source_decision_id,
                target_source_id=source_id,
                metadata_value=metadata("candidate", item["raw"], current),
            )
        )
        review_metadata = q_json({"review": metadata("candidate", item["raw"], current)})
        if target_table == "canon_candidates":
            approved_by = q(actor_id, "uuid") if actor_id and item["status"] == "approved_canon" else "approved_by"
            approved_at = "now()" if item["status"] == "approved_canon" else "approved_at"
            reviewer_notes = q(item["note"]) if item["note"] else "reviewer_notes"
            lines.append(
                f"""
update canon_candidates
set status = {q(item["status"])},
    reviewer_notes = {reviewer_notes},
    approved_by = {approved_by},
    approved_at = {approved_at},
    metadata = coalesce(metadata, '{{}}'::jsonb) || {review_metadata},
    updated_at = now()
where id = {q(current["id"], "uuid")};
""".strip()
            )
        elif target_table == "quote_candidates":
            approved_by = q(actor_id, "uuid") if actor_id and item["status"] == "approved" else "approved_by"
            approved_at = "now()" if item["status"] == "approved" else "approved_at"
            approved_public = q(item["approved_for_public"]) if item["status"] == "approved" else "approved_for_public"
            lines.append(
                f"""
update quote_candidates
set status = {q(item["status"])},
    approved_for_public = {approved_public},
    approved_by = {approved_by},
    approved_at = {approved_at},
    metadata = coalesce(metadata, '{{}}'::jsonb) || {review_metadata}
where id = {q(current["id"], "uuid")};
""".strip()
            )
        elif target_table == "outtake_candidates":
            if actor_id and item["status"] in {"approved_by_speaker", "approved_by_all"}:
                approved_by = f"array(select distinct unnest(coalesce(approved_by, '{{}}'::uuid[]) || array[{q(actor_id, 'uuid')}]))"
            else:
                approved_by = "approved_by"
            lines.append(
                f"""
update outtake_candidates
set status = {q(item["status"])},
    approved_by = {approved_by},
    metadata = coalesce(metadata, '{{}}'::jsonb) || {review_metadata}
where id = {q(current["id"], "uuid")};
""".strip()
            )
        summary["candidate_decisions"] += 1

    job_id = stable_uuid("processing_job", source_session_id, source_run_id, "review_decisions")
    now = dt.datetime.now(dt.UTC).isoformat()
    job_input = {
        "source_run_id": source_run_id,
        "payload_path": str(payload_path),
        "payload_exported_at": payload.get("exportedAt"),
        "actor": payload.get("actor"),
    }
    lines.append(
        f"""
insert into processing_jobs (
  id, session_id, job_type, status, attempts, input, output, started_at, finished_at
)
values (
  {q(job_id, "uuid")},
  {q(session_id, "uuid")},
  'apply_review_decisions',
  'succeeded',
  1,
  {q_json(job_input)},
  {q_json(summary)},
  {q(now, "timestamptz")},
  {q(now, "timestamptz")}
)
on conflict (id) do update set
  status = excluded.status,
  attempts = processing_jobs.attempts + 1,
  input = excluded.input,
  output = excluded.output,
  started_at = excluded.started_at,
  finished_at = excluded.finished_at;
""".strip()
    )
    lines.append("commit;")
    return "\n".join(lines) + "\n", summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("decisions_file", type=Path)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--campaign-slug", default="yuhara-main")
    parser.add_argument("--source-session-id")
    parser.add_argument("--source-run-id")
    parser.add_argument("--actor-track-key")
    parser.add_argument("--sql-out", type=Path)
    parser.add_argument("--update-db", action="store_true")
    args = parser.parse_args()

    payload = load_payload(args.decisions_file)
    source_session_id = args.source_session_id or payload.get("sourceSessionId")
    source_run_id = args.source_run_id or payload.get("aiRunId") or payload.get("sourceRunId")
    actor_payload = payload.get("actor") or {}
    actor_track_key = args.actor_track_key or actor_payload.get("trackKey") or actor_payload.get("track_key") or "renanyuhara"
    if not source_session_id:
        raise SystemExit("source session id missing; use --source-session-id or sourceSessionId in JSON")
    if not source_run_id:
        raise SystemExit("source run id missing; use --source-run-id or aiRunId in JSON")

    values = load_env(args.env_file)
    database_url = values.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")

    context = resolve_context(database_url, args.campaign_slug, str(source_session_id), str(source_run_id), actor_track_key)
    sql, summary = build_sql(payload, context, source_run_id=str(source_run_id), payload_path=args.decisions_file)
    if args.sql_out:
        args.sql_out.parent.mkdir(parents=True, exist_ok=True)
        args.sql_out.write_text(sql, encoding="utf-8")
        print(f"sql_out={args.sql_out}")
    if args.update_db:
        apply_db_update(database_url, sql)
        print("db_updated=true")
    else:
        print("dry_run=true")
    print(f"session={source_session_id}")
    print(f"source_run_id={source_run_id}")
    print(f"actor_resolved={summary['actor_resolved']}")
    print(f"segment_decisions={summary['segment_decisions']}")
    print(f"candidate_decisions={summary['candidate_decisions']}")
    print(f"missing_segments={len(summary['missing_segments'])}")
    print(f"missing_candidates={len(summary['missing_candidates'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
