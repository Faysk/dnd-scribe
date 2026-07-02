#!/usr/bin/env python3
"""Generate AI review candidates for a transcribed session in resumable batches."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any

from safe_psql import execute_sql, run_json_query, sanitize_error_text


ROOT = Path(__file__).resolve().parents[1]
NAMESPACE = uuid.UUID("0e5b216d-7b46-48dd-83dd-6e5b4f27a614")
DEFAULT_CAMPAIGN = "yuhara-main"
DEFAULT_MODEL = "gpt-5.4-mini"
DEFAULT_PROMPT_VERSION = "classify_candidates_v2"
DEFAULT_SOURCE_RUN_ID = "classify_candidates_v2_gpt-5.4-mini"


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


def stable_uuid(*parts: object) -> str:
    return str(uuid.uuid5(NAMESPACE, "/".join(str(part) for part in parts)))


def sql_literal(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def sql_json(value: Any) -> str:
    return sql_literal(json.dumps(value, ensure_ascii=False, sort_keys=True)) + "::jsonb"


def run_json(database_url: str, sql: str) -> Any:
    return run_json_query(database_url, sql)


def execute(database_url: str, sql: str) -> None:
    execute_sql(database_url, sql)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_command(label: str, cmd: list[str]) -> str:
    print(f"== {label} ==")
    print("cmd=" + " ".join(cmd))
    result = subprocess.run(cmd, text=True, encoding="utf-8", capture_output=True, check=False)
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.stderr.strip():
        print(result.stderr.strip(), file=sys.stderr)
    if result.returncode != 0:
        details = sanitize_error_text(result.stderr or result.stdout)
        raise RuntimeError(f"{label} failed with exit code {result.returncode}: {details[:2000]}")
    return result.stdout


def timeline(ms: Any) -> str:
    value = max(0, int(ms or 0))
    hours = value // 3_600_000
    value %= 3_600_000
    minutes = value // 60_000
    value %= 60_000
    seconds = value // 1000
    millis = value % 1000
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{millis:03d}"


def chunks(values: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [values[index : index + size] for index in range(0, len(values), size)]


def batch_candidate_prefix(source_session_id: str, source_run_id: str, batch: list[dict[str, Any]], fallback: int) -> str:
    if batch:
        segment_id = str(batch[0].get("id") or "")
        if segment_id:
            return f"h{stable_uuid(source_session_id, source_run_id, segment_id)[:8]}_"
    return f"b{fallback:04d}_"


def fetch_session(database_url: str, campaign: str, source_session_id: str) -> dict[str, Any]:
    data = run_json(
        database_url,
        f"""
select row_to_json(row) from (
  select
    s.id::text id,
    s.source_session_id,
    s.title,
    s.status,
    s.session_date::text session_date,
    s.started_at,
    s.ended_at,
    s.duration_ms,
    s.summary_short,
    c.slug campaign_slug,
    c.name campaign_name
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = {sql_literal(campaign)}
    and s.source_session_id = {sql_literal(source_session_id)}
  limit 1
) row;
""",
    )
    if not data:
        raise SystemExit(f"Session not found: {campaign}/{source_session_id}")
    return data


def fetch_stats(database_url: str, campaign: str, source_session_id: str, source_run_id: str) -> dict[str, Any]:
    return run_json(
        database_url,
        f"""
with target as (
  select s.id
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = {sql_literal(campaign)}
    and s.source_session_id = {sql_literal(source_session_id)}
  limit 1
), segments as (
  select ts.id
  from transcript_segments ts
  join target t on t.id = ts.session_id
  where ts.is_empty is false
    and nullif(ts.source_segment_id, '') is not null
), classified as (
  select distinct sc.segment_id
  from segment_classifications sc
  join segments s on s.id = sc.segment_id
  where sc.source_run_id = {sql_literal(source_run_id)}
), candidates as (
  select
    (select count(*) from canon_candidates cc join target t on t.id = cc.session_id where cc.source_run_id = {sql_literal(source_run_id)})::int canon,
    (select count(*) from quote_candidates qc join target t on t.id = qc.session_id where qc.source_run_id = {sql_literal(source_run_id)})::int quotes,
    (select count(*) from outtake_candidates oc join target t on t.id = oc.session_id where oc.source_run_id = {sql_literal(source_run_id)})::int outtakes,
    (select count(*) from publications p join target t on t.id = p.session_id where p.source_run_id = {sql_literal(source_run_id)})::int publications,
    (select count(*) from publications p join target t on t.id = p.session_id where p.source_run_id = {sql_literal(source_run_id)} and p.source_publication_id = 'ai_review_packet')::int review_packets
)
select json_build_object(
  'segments', (select count(*) from segments),
  'classified', (select count(*) from classified),
  'pending', greatest((select count(*) from segments) - (select count(*) from classified), 0),
  'canon_candidates', (select canon from candidates),
  'quote_candidates', (select quotes from candidates),
  'outtake_candidates', (select outtakes from candidates),
  'publications', (select publications from candidates),
  'review_packets', (select review_packets from candidates)
);
""",
    ) or {}


def fetch_pending_segments(
    database_url: str,
    campaign: str,
    source_session_id: str,
    source_run_id: str,
    limit: int,
) -> list[dict[str, Any]]:
    return run_json(
        database_url,
        f"""
with target as (
  select s.id
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = {sql_literal(campaign)}
    and s.source_session_id = {sql_literal(source_session_id)}
  limit 1
), rows as (
  select
    ts.source_segment_id id,
    ts.source_sequence,
    ts.track_key,
    ts.speaker_name,
    ts.speaker_role,
    ts.character_name,
    ts.start_ms timeline_start_ms,
    ts.end_ms timeline_end_ms,
    ts.chunk_index,
    ts.text,
    coalesce(ts.text_chars, length(ts.text)) text_chars,
    coalesce(ts.text_words, array_length(regexp_split_to_array(trim(ts.text), '\\s+'), 1), 0) text_words,
    ts.needs_review,
    ts.review_status,
    ts.tags,
    ts.metadata
  from transcript_segments ts
  join target t on t.id = ts.session_id
  where ts.is_empty is false
    and nullif(ts.source_segment_id, '') is not null
    and not exists (
      select 1
      from segment_classifications sc
      where sc.segment_id = ts.id
        and sc.source_run_id = {sql_literal(source_run_id)}
    )
  order by coalesce(ts.source_sequence, 2147483647), ts.start_ms, ts.track_key, ts.chunk_index, ts.id
  limit {int(limit)}
)
select coalesce(json_agg(row_to_json(rows)), '[]'::json) from rows;
""",
    ) or []


def build_master(
    session: dict[str, Any],
    batch_segments: list[dict[str, Any]],
    batch_number: int,
    candidate_prefix: str,
) -> dict[str, Any]:
    segments = []
    for index, item in enumerate(batch_segments, start=1):
        start_ms = int(item.get("timeline_start_ms") or 0)
        end_ms = int(item.get("timeline_end_ms") or start_ms)
        segments.append(
            {
                **item,
                "source_sequence": item.get("source_sequence") or index,
                "timeline_start_ms": start_ms,
                "timeline_end_ms": end_ms,
                "timeline_start": timeline(start_ms),
                "timeline_end": timeline(end_ms),
                "is_empty": False,
            }
        )
    return {
        "session_id": session["source_session_id"],
        "source_session_id": session["source_session_id"],
        "campaign_slug": session["campaign_slug"],
        "title": session.get("title"),
        "summary": {
            "mode": "production_review_batch",
            "batch_number": batch_number,
            "candidate_prefix": candidate_prefix,
            "segment_count": len(segments),
            "session_status": session.get("status"),
        },
        "segments": segments,
    }


def start_job(
    database_url: str,
    session: dict[str, Any],
    source_run_id: str,
    payload: dict[str, Any],
) -> str:
    job_id = stable_uuid("processing_job", session["source_session_id"], source_run_id, dt.datetime.now(dt.UTC).isoformat())
    execute(
        database_url,
        f"""
insert into processing_jobs (id, session_id, job_type, status, attempts, input, output, started_at, created_at)
values (
  {sql_literal(job_id)}::uuid,
  {sql_literal(session['id'])}::uuid,
  'ai_review_generation',
  'running',
  1,
  {sql_json(payload)},
  {sql_json({"workerStatus": "running", "source_run_id": source_run_id})},
  now(),
  now()
);
""",
    )
    return job_id


def finish_job(database_url: str, job_id: str, status: str, output: dict[str, Any], error: str | None = None) -> None:
    execute(
        database_url,
        f"""
update processing_jobs
set status = {sql_literal(status)},
    output = coalesce(output, '{{}}'::jsonb) || {sql_json(output)},
    error = {sql_literal(error) if error else "null"},
    finished_at = now()
where id = {sql_literal(job_id)}::uuid;
""",
    )


def supersede_failed_review_jobs(
    database_url: str,
    session: dict[str, Any],
    source_run_id: str,
    winning_job_id: str,
) -> int:
    data = run_json(
        database_url,
        f"""
with updated as (
  update processing_jobs
  set status = 'cancelled',
      output = coalesce(output, '{{}}'::jsonb) || {sql_json({
          "workerStatus": "superseded_by_success",
          "supersededByJobId": winning_job_id,
          "supersededAt": dt.datetime.now(dt.UTC).isoformat(),
          "source_run_id": source_run_id,
      })},
      finished_at = coalesce(finished_at, now())
  where session_id = {sql_literal(session['id'])}::uuid
    and job_type = 'ai_review_generation'
    and status = 'failed'
    and id <> {sql_literal(winning_job_id)}::uuid
    and (
      input->>'source_run_id' = {sql_literal(source_run_id)}
      or output->>'source_run_id' = {sql_literal(source_run_id)}
    )
  returning id
)
select json_build_object('superseded', count(*)) from updated;
""",
    ) or {}
    return int(data.get("superseded") or 0)


def update_session_review_state(
    database_url: str,
    session: dict[str, Any],
    source_run_id: str,
    stats: dict[str, Any],
    complete: bool,
) -> None:
    target_status = "ready_for_review" if complete else "processing"
    terminal_guard = "('approved','published','archived')"
    payload = {
        "review_generation": {
            "source_run_id": source_run_id,
            "updated_at": dt.datetime.now(dt.UTC).isoformat(),
            "complete": complete,
            "stats": stats,
        }
    }
    execute(
        database_url,
        f"""
update sessions
set status = case
      when status in {terminal_guard} then status
      else {sql_literal(target_status)}
    end,
    metadata = coalesce(metadata, '{{}}'::jsonb) || {sql_json(payload)},
    updated_at = now()
where id = {sql_literal(session['id'])}::uuid;
""",
    )


def build_publications(
    env_file: Path,
    campaign: str,
    source_session_id: str,
    source_run_id: str,
    out_dir: Path,
) -> None:
    cmd = [
        sys.executable,
        str(ROOT / "tools" / "build_session_publications.py"),
        "--env-file",
        str(env_file),
        "--campaign-slug",
        campaign,
        "--source-session-id",
        source_session_id,
        "--source-run-id",
        source_run_id,
        "--out-dir",
        str(out_dir),
        "--update-db",
    ]
    run_command("build_session_publications", cmd)


def classify_batch(
    env_file: Path,
    campaign: str,
    source_session_id: str,
    source_run_id: str,
    model: str,
    prompt_version: str,
    batch_dir: Path,
    batch_number: int,
    candidate_prefix: str,
) -> None:
    cmd = [
        sys.executable,
        str(ROOT / "tools" / "classify_session_segments.py"),
        str(batch_dir),
        "--env-file",
        str(env_file),
        "--campaign-slug",
        campaign,
        "--source-session-id",
        source_session_id,
        "--source-run-id",
        source_run_id,
        "--prompt-version",
        prompt_version,
        "--model",
        model,
        "--candidate-prefix",
        candidate_prefix,
        "--append-db",
        "--update-db",
    ]
    run_command(f"classify_batch_{batch_number:04d}", cmd)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_session_id")
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--campaign", default=DEFAULT_CAMPAIGN)
    parser.add_argument("--model")
    parser.add_argument("--prompt-version", default=DEFAULT_PROMPT_VERSION)
    parser.add_argument("--source-run-id", default=DEFAULT_SOURCE_RUN_ID)
    parser.add_argument("--batch-size", type=int, default=80)
    parser.add_argument("--max-batches", type=int, default=1)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--skip-publications", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    batch_size = max(1, min(200, int(args.batch_size or 80)))
    max_batches = max(1, min(20, int(args.max_batches or 1)))
    model = args.model or os.environ.get("OPENAI_TEXT_MODEL") or DEFAULT_MODEL
    source_run_id = args.source_run_id or f"{args.prompt_version}_{model.replace('/', '_').replace(':', '_')}"
    env = load_env(args.env_file)
    database_url = env.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file} or environment")
    if args.execute and not env.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is required for execute=true")

    session = fetch_session(database_url, args.campaign, args.source_session_id)
    before_stats = fetch_stats(database_url, args.campaign, args.source_session_id, source_run_id)
    limit = batch_size * max_batches
    pending = fetch_pending_segments(database_url, args.campaign, args.source_session_id, source_run_id, limit)
    selected_batches = chunks(pending, batch_size)
    selected_chars = sum(int(item.get("text_chars") or len(item.get("text") or "")) for item in pending)
    dry_payload = {
        "ok": True,
        "execute": args.execute,
        "source_session_id": args.source_session_id,
        "campaign": args.campaign,
        "source_run_id": source_run_id,
        "model": model,
        "batch_size": batch_size,
        "max_batches": max_batches,
        "before": before_stats,
        "selected_segments": len(pending),
        "selected_batches": len(selected_batches),
        "selected_text_chars": selected_chars,
    }
    if not args.execute:
        print(json.dumps(dry_payload, ensure_ascii=False, indent=2 if args.json else None))
        return 0

    job_id = start_job(
        database_url,
        session,
        source_run_id,
        {
            **dry_payload,
            "env_file_exists": args.env_file.exists(),
        },
    )

    base_dir = ROOT / "tmp" / "review-generation" / args.source_session_id / source_run_id
    processed_batches = 0
    try:
        for batch_number, batch in enumerate(selected_batches, start=1):
            candidate_prefix = batch_candidate_prefix(args.source_session_id, source_run_id, batch, batch_number)
            batch_dir = base_dir / f"batch_{dt.datetime.now(dt.UTC).strftime('%Y%m%dT%H%M%S')}_{batch_number:04d}"
            master = build_master(session, batch, batch_number, candidate_prefix)
            write_json(batch_dir / "transcripts" / "transcript_master.json", master)
            classify_batch(
                args.env_file,
                args.campaign,
                args.source_session_id,
                source_run_id,
                model,
                args.prompt_version,
                batch_dir,
                batch_number,
                candidate_prefix,
            )
            processed_batches += 1

        after_stats = fetch_stats(database_url, args.campaign, args.source_session_id, source_run_id)
        complete = int(after_stats.get("pending") or 0) == 0 and int(after_stats.get("segments") or 0) > 0
        publications_built = False
        if complete and not args.skip_publications:
            build_publications(
                args.env_file,
                args.campaign,
                args.source_session_id,
                source_run_id,
                base_dir / "publications",
            )
            publications_built = True
            after_stats = fetch_stats(database_url, args.campaign, args.source_session_id, source_run_id)

        update_session_review_state(database_url, session, source_run_id, after_stats, complete)
        superseded_failed_jobs = 0
        if complete:
            superseded_failed_jobs = supersede_failed_review_jobs(database_url, session, source_run_id, job_id)
        output = {
            **dry_payload,
            "processed_batches": processed_batches,
            "after": after_stats,
            "complete": complete,
            "publications_built": publications_built,
            "superseded_failed_jobs": superseded_failed_jobs,
            "workerStatus": "succeeded",
        }
        finish_job(database_url, job_id, "succeeded", output)
        print(json.dumps(output, ensure_ascii=False, indent=2 if args.json else None))
    except Exception as exc:
        after_stats = fetch_stats(database_url, args.campaign, args.source_session_id, source_run_id)
        output = {
            **dry_payload,
            "processed_batches": processed_batches,
            "after": after_stats,
            "workerStatus": "failed",
        }
        finish_job(database_url, job_id, "failed", output, str(exc)[:2000])
        raise
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
