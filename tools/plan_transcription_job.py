#!/usr/bin/env python3
"""Plan a transcription job before any paid OpenAI calls."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_POLICY = ROOT / "config" / "ai_cost_policy.json"
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


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def sql_literal(value: Any) -> str:
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def sql_optional_text(value: Any) -> str:
    text = str(value or "").strip()
    return sql_literal(text) if text else "null"


def sql_json(value: Any) -> str:
    return sql_literal(json.dumps(value, ensure_ascii=False, sort_keys=True)) + "::jsonb"


def sql_optional_number(value: Any) -> str:
    if value is None or value == "":
        return "null"
    return str(value)


def run_json(database_url: str, sql: str) -> Any:
    output = subprocess.check_output(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
        text=True,
        encoding="utf-8",
    )
    text = output.strip()
    return json.loads(text) if text else None


def run_scalar(database_url: str, sql: str) -> str | None:
    output = subprocess.check_output(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
        text=True,
        encoding="utf-8",
    )
    return output.strip() or None


def execute(database_url: str, sql: str) -> None:
    subprocess.check_call(["psql", database_url, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql])


def unit_cost(policy: dict[str, Any], key: str) -> float | None:
    value = ((policy.get("estimation") or {}).get("unitCostsUsd") or {}).get(key)
    return float(value) if value is not None else None


def transcription_model(policy: dict[str, Any], override: str | None) -> str:
    if override:
        return override
    return (((policy.get("modelRouting") or {}).get("transcription") or {}).get("defaultModel") or "gpt-4o-mini-transcribe")


def find_session(database_url: str, campaign_slug: str, source_session_id: str) -> dict[str, Any]:
    sql = f"""
select row_to_json(row) from (
  select s.id::text id, s.source_session_id, s.title, c.id::text campaign_id, c.slug campaign_slug
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = {sql_literal(campaign_slug)}
    and s.source_session_id = {sql_literal(source_session_id)}
  limit 1
) row;
"""
    session = run_json(database_url, sql)
    if not session:
        raise SystemExit(f"Session not found: {campaign_slug}/{source_session_id}")
    return session


def fetch_chunks(database_url: str, session_id: str, model: str, prompt_version: str) -> list[dict[str, Any]]:
    sql = f"""
select coalesce(json_agg(row_to_json(row) order by row.track_key, row.chunk_index), '[]'::json) from (
  select
    ac.id::text audio_chunk_id,
    ac.source_file_id::text source_file_id,
    ac.track_key,
    ac.chunk_index,
    ac.start_ms,
    ac.end_ms,
    ac.duration_ms,
    ac.sha256,
    ac.probably_silent,
    ac.audio_dbfs,
    ac.storage_path,
    ac.source_chunk_name,
    ac.transcription_status,
    rf.original_filename,
    tc.id::text cache_id,
    tc.status cache_status,
    length(tc.transcript_text) > 0 cache_has_text,
    tc.model cache_model,
    tc.prompt_version cache_prompt_version
  from audio_chunks ac
  join recording_files rf on rf.id = ac.source_file_id
  left join transcription_cache tc
    on tc.audio_sha256 = ac.sha256
   and tc.provider = 'openai'
   and tc.model = {sql_literal(model)}
   and tc.prompt_version = {sql_literal(prompt_version)}
   and tc.status = 'succeeded'
  where ac.session_id = {sql_literal(session_id)}::uuid
) row;
"""
    return run_json(database_url, sql) or []


def estimate_cost(minutes: float, policy: dict[str, Any]) -> float | None:
    per_minute = unit_cost(policy, "transcriptionAudioMinute")
    if per_minute is None:
        return None
    return round(minutes * per_minute, 6)


def build_plan(session: dict[str, Any], chunks: list[dict[str, Any]], policy: dict[str, Any], model: str, prompt_version: str) -> dict[str, Any]:
    planned_chunks: list[dict[str, Any]] = []
    counts = {"total": 0, "skipSilence": 0, "cacheHit": 0, "transcribe": 0, "missingHash": 0, "blockedMissingHash": 0}
    billable_ms = 0

    for chunk in chunks:
        counts["total"] += 1
        reason = "transcribe_missing_cache"
        action = "transcribe"
        if not chunk.get("sha256"):
            action = "blocked"
            counts["missingHash"] += 1
            counts["blockedMissingHash"] += 1
            reason = "missing_sha256"
        elif chunk.get("probably_silent") is True:
            action = "skip"
            reason = "probably_silent"
            counts["skipSilence"] += 1
        elif chunk.get("cache_id"):
            action = "cache_hit"
            reason = "transcription_cache_hit"
            counts["cacheHit"] += 1
        else:
            counts["transcribe"] += 1

        if action == "transcribe":
            billable_ms += int(chunk.get("duration_ms") or max(0, int(chunk.get("end_ms") or 0) - int(chunk.get("start_ms") or 0)))

        planned_chunks.append(
            {
                "audioChunkId": chunk.get("audio_chunk_id"),
                "sourceFileId": chunk.get("source_file_id"),
                "trackKey": chunk.get("track_key"),
                "chunkIndex": chunk.get("chunk_index"),
                "sha256": chunk.get("sha256"),
                "durationMs": chunk.get("duration_ms"),
                "audioDbfs": chunk.get("audio_dbfs"),
                "cacheId": chunk.get("cache_id"),
                "action": action,
                "reason": reason,
            }
        )

    billable_minutes = round(billable_ms / 60000, 3)
    return {
        "session": session,
        "provider": "openai",
        "model": model,
        "promptVersion": prompt_version,
        "createdAt": dt.datetime.now(dt.UTC).isoformat(),
        "counts": counts,
        "billableAudioMinutes": billable_minutes,
        "estimatedCostUsd": estimate_cost(billable_minutes, policy),
        "requiresPriceConfig": unit_cost(policy, "transcriptionAudioMinute") is None,
        "batchRecommended": bool((policy.get("guards") or {}).get("preferBatchForAsyncJobs", True)),
        "chunks": planned_chunks,
    }


def write_processing_job(database_url: str, plan: dict[str, Any]) -> str:
    return run_scalar(
        database_url,
        f"""
insert into processing_jobs (session_id, job_type, status, input, output, created_at)
values (
  {sql_literal(plan['session']['id'])}::uuid,
  'transcription_plan',
  'queued',
  {sql_json({'model': plan['model'], 'promptVersion': plan['promptVersion'], 'counts': plan['counts']})},
  {sql_json(plan)},
  now()
)
returning id::text;
""",
    ) or ""


def write_ledger(database_url: str, plan: dict[str, Any], job_id: str, policy: dict[str, Any]) -> None:
    rows = []
    for chunk in plan["chunks"]:
        duration_ms = int(chunk.get("durationMs") or 0)
        minutes = round(duration_ms / 60000, 6) if chunk["action"] == "transcribe" else 0
        if chunk["action"] in {"skip", "blocked"}:
            status = "skipped"
            estimated = "null"
        elif chunk["action"] == "cache_hit":
            status = "cached"
            estimated = "0"
        else:
            status = "estimated"
            estimated = sql_optional_number(estimate_cost(minutes, policy))
        metadata = {
            "audioChunkId": chunk.get("audioChunkId"),
            "sourceFileId": chunk.get("sourceFileId"),
            "trackKey": chunk.get("trackKey"),
            "chunkIndex": chunk.get("chunkIndex"),
            "action": chunk.get("action"),
            "reason": chunk.get("reason"),
            "cacheId": chunk.get("cacheId"),
        }
        rows.append(
            "(" + ", ".join(
                [
                    sql_literal(plan["session"]["campaign_id"]) + "::uuid",
                    sql_literal(plan["session"]["id"]) + "::uuid",
                    sql_literal(job_id) + "::uuid",
                    "'openai'",
                    sql_literal(plan["model"]),
                    "'transcription'",
                    sql_literal(status),
                    sql_optional_text(chunk.get("sha256")),
                    sql_optional_number(minutes),
                    estimated,
                    sql_json(metadata),
                ]
            ) + ")"
        )
    if not rows:
        return
    execute(
        database_url,
        """
insert into ai_usage_ledger (
  campaign_id, session_id, job_id, provider, model, operation_type, status,
  source_hash, input_audio_minutes, estimated_cost_usd, metadata
) values
""" + ",\n".join(rows) + ";",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_session_id")
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env.local")
    parser.add_argument("--campaign", default=DEFAULT_CAMPAIGN)
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--model")
    parser.add_argument("--prompt-version", default="transcribe_v1")
    parser.add_argument("--write-ledger", action="store_true", help="Create processing job and ledger rows")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    env = load_env(args.env_file)
    database_url = env.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")

    policy = load_json(args.policy)
    model = transcription_model(policy, args.model)
    session = find_session(database_url, args.campaign, args.source_session_id)
    chunks = fetch_chunks(database_url, session["id"], model, args.prompt_version)
    plan = build_plan(session, chunks, policy, model, args.prompt_version)

    if args.write_ledger:
        job_id = write_processing_job(database_url, plan)
        plan["processingJobId"] = job_id
        write_ledger(database_url, plan, job_id, policy)

    if args.json:
        print(json.dumps(plan, ensure_ascii=False, indent=2))
    else:
        print(f"session={plan['session']['source_session_id']}")
        print(f"model={plan['model']}")
        print(f"chunks_total={plan['counts']['total']}")
        print(f"chunks_skip_silence={plan['counts']['skipSilence']}")
        print(f"chunks_cache_hit={plan['counts']['cacheHit']}")
        print(f"chunks_blocked_missing_hash={plan['counts']['blockedMissingHash']}")
        print(f"chunks_transcribe={plan['counts']['transcribe']}")
        print(f"billable_audio_minutes={plan['billableAudioMinutes']}")
        if plan.get("estimatedCostUsd") is None:
            print("estimated_cost_usd=pending_price_config")
        else:
            print(f"estimated_cost_usd={plan['estimatedCostUsd']}")
        if args.write_ledger:
            print(f"processing_job_id={plan['processingJobId']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
