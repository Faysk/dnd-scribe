#!/usr/bin/env python3
"""Run an economy-first transcription job for one Craig session."""

from __future__ import annotations

import argparse
import json
import mimetypes
import re
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any

from validate_ai_cost_pipeline import apply_env_cost_overrides, load_env, load_json, policy_model


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_POLICY = ROOT / "config" / "ai_cost_policy.json"
DEFAULT_CAMPAIGN = "yuhara-main"
DEFAULT_PROMPT_VERSION = "transcribe_v1"
DEFAULT_LIMIT = 3
DEFAULT_MAX_FILE_MIB = 24
DEFAULT_LANGUAGE = "pt"
DEFAULT_PROMPT = (
    "Audio de mesa de RPG em portugues do Brasil. Preserve nomes proprios, "
    "personagens e termos de D&D quando reconheciveis."
)
OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions"


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


def resolve_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return ROOT / path


def run_validator(args: argparse.Namespace, execute_mode: bool) -> None:
    cmd = [
        sys.executable,
        str(ROOT / "tools" / "validate_ai_cost_pipeline.py"),
        args.source_session_id,
        "--env-file",
        str(args.env_file),
        "--policy",
        str(args.policy),
        "--campaign",
        args.campaign,
        "--model",
        args.model,
        "--prompt-version",
        args.prompt_version,
    ]
    if execute_mode:
        cmd.extend(["--require-openai-key", "--require-prices"])
    subprocess.check_call(cmd)


def fetch_work(database_url: str, campaign_slug: str, source_session_id: str, model: str, prompt_version: str, limit: int) -> dict[str, Any]:
    sql = f"""
with target_session as (
  select s.id, s.campaign_id, s.source_session_id, s.title, c.slug campaign_slug
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = {sql_literal(campaign_slug)}
    and s.source_session_id = {sql_literal(source_session_id)}
  limit 1
), candidates as (
  select
    wu.id::text work_unit_id,
    wu.unit_type,
    wu.source_chunk_id::text audio_chunk_id,
    wu.session_id::text session_id,
    wu.source_file_id::text source_file_id,
    wu.track_key,
    wu.unit_index,
    wu.start_ms,
    wu.end_ms,
    coalesce(wu.duration_ms, greatest(0, coalesce(wu.end_ms, 0) - coalesce(wu.start_ms, 0)), 0)::int duration_ms,
    wu.sha256,
    wu.storage_path,
    wu.audio_dbfs,
    rf.original_filename,
    p.id::text participant_id,
    p.player_name,
    p.character_name,
    p.role speaker_role
  from audio_transcription_work_units wu
  join recording_files rf on rf.id = wu.source_file_id
  left join participants p on p.id = rf.participant_id
  where wu.session_id = (select id from target_session)
    and nullif(wu.sha256, '') is not null
    and nullif(wu.storage_path, '') is not null
    and coalesce(wu.probably_silent, false) is false
    and coalesce(wu.transcription_status, 'pending') not in ('skipped_silence', 'transcribed', 'cached')
    and not exists (
      select 1
      from transcription_cache tc
      where tc.audio_sha256 = wu.sha256
        and tc.provider = 'openai'
        and tc.model = {sql_literal(model)}
        and tc.prompt_version = {sql_literal(prompt_version)}
        and tc.status = 'succeeded'
    )
  order by wu.track_key, wu.start_ms, wu.unit_type, wu.unit_index
), stats as (
  select
    count(*)::int total_candidates,
    count(*) filter (where unit_type = 'speech_slice')::int speech_slice_candidates,
    count(*) filter (where unit_type = 'chunk')::int chunk_fallback_candidates,
    round((coalesce(sum(duration_ms), 0) / 60000.0)::numeric, 3) candidate_audio_minutes
  from candidates
)
select json_build_object(
  'session', (select row_to_json(target_session) from target_session),
  'stats', (select row_to_json(stats) from stats),
  'chunks', coalesce((
    select json_agg(row_to_json(row) order by row.track_key, row.start_ms, row.unit_type, row.unit_index)
    from (select * from candidates limit {int(limit)}) row
  ), '[]'::json)
);
"""
    return run_json(database_url, sql) or {"session": None, "stats": {}, "chunks": []}


def cache_entry(database_url: str, unit: dict[str, Any], model: str, prompt_version: str) -> dict[str, Any] | None:
    sql = f"""
select row_to_json(row) from (
  select id::text, transcript_text, raw_response, provider_request_id
  from transcription_cache
  where audio_sha256 = {sql_literal(unit['sha256'])}
    and provider = 'openai'
    and model = {sql_literal(model)}
    and prompt_version = {sql_literal(prompt_version)}
    and status = 'succeeded'
  limit 1
) row;
"""
    return run_json(database_url, sql)


def create_job(database_url: str, session: dict[str, Any], input_payload: dict[str, Any]) -> str:
    return run_scalar(
        database_url,
        f"""
insert into processing_jobs (session_id, job_type, status, attempts, input, started_at, created_at)
values (
  {sql_literal(session['id'])}::uuid,
  'transcription_execute',
  'running',
  1,
  {sql_json(input_payload)},
  now(),
  now()
)
returning id::text;
""",
    ) or ""


def finish_job(database_url: str, job_id: str, status: str, output: dict[str, Any], error: str | None = None) -> None:
    execute(
        database_url,
        f"""
update processing_jobs
set status = {sql_literal(status)},
    output = {sql_json(output)},
    error = {sql_optional_text(error)},
    finished_at = now()
where id = {sql_literal(job_id)}::uuid;
""",
    )


def estimate_cost(unit: dict[str, Any], policy: dict[str, Any]) -> float | None:
    per_minute = unit_cost(policy, "transcriptionAudioMinute")
    if per_minute is None:
        return None
    minutes = (int(unit.get("duration_ms") or 0) / 60000.0)
    return round(minutes * per_minute, 6)


def write_ledger(
    database_url: str,
    session: dict[str, Any],
    job_id: str,
    unit: dict[str, Any],
    model: str,
    status: str,
    estimated_cost: float | None,
    actual_cost: float | None,
    metadata: dict[str, Any],
    provider_request_id: str | None = None,
) -> None:
    minutes = round((int(unit.get("duration_ms") or 0) / 60000.0), 6)
    execute(
        database_url,
        f"""
insert into ai_usage_ledger (
  campaign_id, session_id, job_id, provider, model, operation_type, status,
  source_hash, provider_request_id, input_audio_minutes, estimated_cost_usd,
  actual_cost_usd, metadata
) values (
  {sql_literal(session['campaign_id'])}::uuid,
  {sql_literal(session['id'])}::uuid,
  {sql_literal(job_id)}::uuid,
  'openai',
  {sql_literal(model)},
  'transcription',
  {sql_literal(status)},
  {sql_optional_text(unit.get('sha256'))},
  {sql_optional_text(provider_request_id)},
  {sql_optional_number(minutes if status != 'cached' else 0)},
  {sql_optional_number(estimated_cost)},
  {sql_optional_number(actual_cost)},
  {sql_json(metadata)}
);
""",
    )


def upsert_cache(
    database_url: str,
    unit: dict[str, Any],
    model: str,
    prompt_version: str,
    language: str | None,
    transcript_text: str,
    raw_response: dict[str, Any],
    provider_request_id: str | None,
    estimated_cost: float | None,
) -> str:
    usage = raw_response.get("usage") if isinstance(raw_response.get("usage"), dict) else {}
    metadata = {
        "workUnitId": unit.get("work_unit_id"),
        "unitType": unit.get("unit_type"),
        "audioChunkId": unit.get("audio_chunk_id"),
        "sourceFileId": unit.get("source_file_id"),
        "trackKey": unit.get("track_key"),
        "unitIndex": unit.get("unit_index"),
        "storagePath": unit.get("storage_path"),
        "executor": "tools/run_transcription_job.py",
    }
    segments = raw_response.get("segments") if isinstance(raw_response.get("segments"), list) else []
    return run_scalar(
        database_url,
        f"""
insert into transcription_cache (
  audio_sha256, audio_duration_ms, provider, model, prompt_version, language,
  status, transcript_text, segments, raw_response, provider_request_id,
  input_audio_minutes, input_tokens, output_tokens, estimated_cost_usd, metadata,
  created_at, updated_at
) values (
  {sql_literal(unit['sha256'])},
  {sql_optional_number(unit.get('duration_ms'))},
  'openai',
  {sql_literal(model)},
  {sql_literal(prompt_version)},
  {sql_optional_text(language)},
  'succeeded',
  {sql_literal(transcript_text)},
  {sql_json(segments)},
  {sql_json(raw_response)},
  {sql_optional_text(provider_request_id)},
  {sql_optional_number(round((int(unit.get('duration_ms') or 0) / 60000.0), 6))},
  {sql_optional_number(usage.get('input_tokens'))},
  {sql_optional_number(usage.get('output_tokens'))},
  {sql_optional_number(estimated_cost)},
  {sql_json(metadata)},
  now(),
  now()
)
on conflict (provider, model, prompt_version, audio_sha256)
do update set
  audio_duration_ms = excluded.audio_duration_ms,
  language = excluded.language,
  status = excluded.status,
  transcript_text = excluded.transcript_text,
  segments = excluded.segments,
  raw_response = excluded.raw_response,
  provider_request_id = excluded.provider_request_id,
  input_audio_minutes = excluded.input_audio_minutes,
  input_tokens = excluded.input_tokens,
  output_tokens = excluded.output_tokens,
  estimated_cost_usd = excluded.estimated_cost_usd,
  metadata = coalesce(transcription_cache.metadata, '{{}}'::jsonb) || excluded.metadata,
  updated_at = now()
returning id::text;
""",
    ) or ""


def materialize_segment(
    database_url: str,
    session: dict[str, Any],
    unit: dict[str, Any],
    model: str,
    prompt_version: str,
    language: str,
    transcript_text: str,
    cache_id: str | None,
) -> None:
    text = transcript_text.strip()
    segment_id = f"openai:{model}:{prompt_version}:{unit['work_unit_id']}"
    metadata = {
        "transcriptionCacheId": cache_id,
        "workUnitId": unit.get("work_unit_id"),
        "unitType": unit.get("unit_type"),
        "model": model,
        "promptVersion": prompt_version,
        "source": "transcription_executor",
    }
    participant_sql = sql_literal(unit["participant_id"]) + "::uuid" if unit.get("participant_id") else "null"
    execute(
        database_url,
        f"""
insert into transcript_segments (
  session_id, participant_id, character_name, source_file_id, source_chunk_id,
  start_ms, end_ms, text, language, source_segment_id, source_sequence,
  track_key, speaker_name, speaker_role, source_chunk_path, chunk_index,
  text_chars, text_words, is_empty, needs_review, review_status, metadata
) values (
  {sql_literal(session['id'])}::uuid,
  {participant_sql},
  {sql_optional_text(unit.get('character_name'))},
  {sql_literal(unit['source_file_id'])}::uuid,
  {sql_literal(unit['audio_chunk_id'])}::uuid,
  {int(unit.get('start_ms') or 0)},
  {int(unit.get('end_ms') or 0)},
  {sql_literal(text)},
  {sql_optional_text(language)},
  {sql_literal(segment_id)},
  {int(unit.get('unit_index') or 0)},
  {sql_optional_text(unit.get('track_key'))},
  {sql_optional_text(unit.get('player_name'))},
  {sql_optional_text(unit.get('speaker_role'))},
  {sql_optional_text(unit.get('storage_path'))},
  {int(unit.get('unit_index') or 0)},
  {len(text)},
  {len(re.findall(r'\S+', text))},
  {'true' if not text else 'false'},
  {sql_literal('true' if not text else 'false')}::boolean,
  'pending',
  {sql_json(metadata)}
)
on conflict (session_id, source_segment_id) where source_segment_id is not null
do update set
  text = excluded.text,
  text_chars = excluded.text_chars,
  text_words = excluded.text_words,
  is_empty = excluded.is_empty,
  needs_review = excluded.needs_review,
  metadata = coalesce(transcript_segments.metadata, '{{}}'::jsonb) || excluded.metadata;
""",
    )


def update_work_unit_status(database_url: str, unit: dict[str, Any], status: str, metadata: dict[str, Any] | None = None) -> None:
    metadata_sql = "metadata"
    if metadata:
        metadata_sql = f"coalesce(metadata, '{{}}'::jsonb) || {sql_json(metadata)}"
    if unit.get("unit_type") == "speech_slice":
        table = "audio_speech_slices"
        key = "work_unit_id"
    else:
        table = "audio_chunks"
        key = "audio_chunk_id"
    execute(
        database_url,
        f"""
update {table}
set transcription_status = {sql_literal(status)},
    metadata = {metadata_sql},
    updated_at = now()
where id = {sql_literal(unit[key])}::uuid;
""",
    )


def encode_multipart(fields: dict[str, str], file_path: Path) -> tuple[bytes, str]:
    boundary = "----dndscribe" + uuid.uuid4().hex
    body = bytearray()
    for name, value in fields.items():
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.extend(str(value).encode("utf-8"))
        body.extend(b"\r\n")

    mime_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{file_path.name}"\r\n'.encode())
    body.extend(f"Content-Type: {mime_type}\r\n\r\n".encode())
    body.extend(file_path.read_bytes())
    body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode())
    return bytes(body), boundary


def openai_transcribe(
    api_key: str,
    file_path: Path,
    model: str,
    language: str | None,
    prompt: str | None,
    timeout: int,
) -> tuple[dict[str, Any], str | None]:
    fields = {"model": model, "response_format": "json", "temperature": "0"}
    if language:
        fields["language"] = language
    if prompt:
        fields["prompt"] = prompt

    body, boundary = encode_multipart(fields, file_path)
    request = urllib.request.Request(
        OPENAI_TRANSCRIPTION_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))
        request_id = response.headers.get("x-request-id")
    return payload, request_id


def openai_error_message(error: urllib.error.HTTPError) -> str:
    try:
        body = error.read().decode("utf-8", errors="replace")
        payload = json.loads(body)
        if isinstance(payload.get("error"), dict):
            return str(payload["error"].get("message") or body)
        return body
    except Exception:
        return str(error)


def response_actual_cost(raw_response: dict[str, Any]) -> float | None:
    usage = raw_response.get("usage") if isinstance(raw_response.get("usage"), dict) else {}
    for key in ("cost_usd", "total_cost_usd"):
        if usage.get(key) is not None:
            return float(usage[key])
    return None


def handle_cache_hit(
    database_url: str,
    session: dict[str, Any],
    job_id: str,
    unit: dict[str, Any],
    model: str,
    prompt_version: str,
    language: str,
    cache: dict[str, Any],
) -> dict[str, Any]:
    transcript_text = str(cache.get("transcript_text") or "")
    materialize_segment(database_url, session, unit, model, prompt_version, language, transcript_text, cache.get("id"))
    update_work_unit_status(database_url, unit, "cached", {"transcriptionCacheId": cache.get("id")})
    write_ledger(
        database_url,
        session,
        job_id,
        unit,
        model,
        "cached",
        0,
        0,
        {"workUnitId": unit.get("work_unit_id"), "unitType": unit.get("unit_type"), "cacheId": cache.get("id"), "reason": "cache_hit_before_call"},
        cache.get("provider_request_id"),
    )
    return {"workUnitId": unit.get("work_unit_id"), "unitType": unit.get("unit_type"), "action": "cache_hit", "cacheId": cache.get("id")}


def transcribe_unit(
    database_url: str,
    session: dict[str, Any],
    job_id: str,
    unit: dict[str, Any],
    policy: dict[str, Any],
    api_key: str,
    model: str,
    prompt_version: str,
    language: str,
    prompt: str | None,
    max_file_bytes: int,
    timeout: int,
    execute_mode: bool,
) -> dict[str, Any]:
    path = resolve_path(unit["storage_path"])
    base = {
        "workUnitId": unit.get("work_unit_id"),
        "unitType": unit.get("unit_type"),
        "audioChunkId": unit.get("audio_chunk_id"),
        "trackKey": unit.get("track_key"),
        "unitIndex": unit.get("unit_index"),
        "path": str(path),
    }

    if not path.exists():
        message = f"Local audio file not found: {path}"
        if execute_mode:
            update_work_unit_status(database_url, unit, "failed", {"error": message})
            write_ledger(database_url, session, job_id, unit, model, "failed", estimate_cost(unit, policy), None, {**base, "error": message})
        return {**base, "action": "missing_file", "error": message}

    size = path.stat().st_size
    if size > max_file_bytes:
        message = f"Audio work unit exceeds max file size: {size} bytes"
        if execute_mode:
            update_work_unit_status(database_url, unit, "failed", {"error": message, "sizeBytes": size})
            write_ledger(database_url, session, job_id, unit, model, "failed", estimate_cost(unit, policy), None, {**base, "error": message, "sizeBytes": size})
        return {**base, "action": "too_large", "sizeBytes": size, "error": message}

    cache = cache_entry(database_url, unit, model, prompt_version)
    if cache:
        if execute_mode:
            return handle_cache_hit(database_url, session, job_id, unit, model, prompt_version, language, cache)
        return {**base, "action": "cache_hit", "cacheId": cache.get("id")}

    estimated = estimate_cost(unit, policy)
    if not execute_mode:
        return {**base, "action": "would_transcribe", "durationMs": unit.get("duration_ms"), "estimatedCostUsd": estimated}

    try:
        raw_response, request_id = openai_transcribe(api_key, path, model, language, prompt, timeout)
        transcript_text = str(raw_response.get("text") or "")
        cache_id = upsert_cache(database_url, unit, model, prompt_version, language, transcript_text, raw_response, request_id, estimated)
        materialize_segment(database_url, session, unit, model, prompt_version, language, transcript_text, cache_id)
        update_work_unit_status(database_url, unit, "transcribed", {"transcriptionCacheId": cache_id, "providerRequestId": request_id})
        actual = response_actual_cost(raw_response)
        write_ledger(
            database_url,
            session,
            job_id,
            unit,
            model,
            "succeeded",
            estimated,
            actual,
            {**base, "cacheId": cache_id, "textChars": len(transcript_text)},
            request_id,
        )
        return {**base, "action": "transcribed", "cacheId": cache_id, "providerRequestId": request_id, "textChars": len(transcript_text)}
    except urllib.error.HTTPError as error:
        message = openai_error_message(error)
    except Exception as error:
        message = str(error)

    update_work_unit_status(database_url, unit, "failed", {"error": message})
    write_ledger(database_url, session, job_id, unit, model, "failed", estimated, None, {**base, "error": message})
    return {**base, "action": "failed", "error": message}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_session_id")
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env.local")
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--campaign", default=DEFAULT_CAMPAIGN)
    parser.add_argument("--model")
    parser.add_argument("--prompt-version", default=DEFAULT_PROMPT_VERSION)
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    parser.add_argument("--language", default=DEFAULT_LANGUAGE)
    parser.add_argument("--prompt", default=DEFAULT_PROMPT)
    parser.add_argument("--no-prompt", action="store_true")
    parser.add_argument("--max-file-mib", type=int, default=DEFAULT_MAX_FILE_MIB)
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--execute", action="store_true", help="Actually call OpenAI. Default is dry-run.")
    parser.add_argument("--skip-validation", action="store_true")
    parser.add_argument("--continue-on-error", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    env = load_env(args.env_file)
    database_url = env.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")

    policy = load_json(args.policy)
    apply_env_cost_overrides(policy, env, [])
    model = policy_model(policy, args.model)
    args.model = model

    if not args.skip_validation:
        run_validator(args, args.execute)

    api_key = env.get("OPENAI_API_KEY") or ""
    if args.execute and not api_key:
        raise SystemExit(f"OPENAI_API_KEY not found in {args.env_file}")

    work = fetch_work(database_url, args.campaign, args.source_session_id, model, args.prompt_version, args.limit)
    session = work.get("session")
    if not session:
        raise SystemExit(f"Session not found: {args.campaign}/{args.source_session_id}")

    units = work.get("chunks") or []
    job_id = ""
    if args.execute:
        job_id = create_job(
            database_url,
            session,
            {
                "sourceSessionId": args.source_session_id,
                "model": model,
                "promptVersion": args.prompt_version,
                "limit": args.limit,
                "language": args.language,
                "maxFileMiB": args.max_file_mib,
                "workUnitMode": "audio_transcription_work_units",
            },
        )

    results: list[dict[str, Any]] = []
    max_file_bytes = int(args.max_file_mib * 1024 * 1024)
    prompt = None if args.no_prompt else args.prompt
    failed = False
    for unit in units:
        result = transcribe_unit(
            database_url,
            session,
            job_id,
            unit,
            policy,
            api_key,
            model,
            args.prompt_version,
            args.language,
            prompt,
            max_file_bytes,
            args.timeout,
            args.execute,
        )
        results.append(result)
        if result.get("action") in {"failed", "missing_file", "too_large"}:
            failed = True
            if args.execute and not args.continue_on_error:
                break

    output = {
        "execute": args.execute,
        "jobId": job_id or None,
        "session": session,
        "stats": work.get("stats") or {},
        "limit": args.limit,
        "processed": len(results),
        "results": results,
    }
    if args.execute:
        finish_job(database_url, job_id, "failed" if failed else "succeeded", output, "one_or_more_units_failed" if failed else None)

    if args.json:
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        stats = work.get("stats") or {}
        print(f"execute={str(args.execute).lower()}")
        print(f"session={session['source_session_id']}")
        print(f"model={model}")
        print(f"total_candidates={stats.get('total_candidates') or 0}")
        print(f"speech_slice_candidates={stats.get('speech_slice_candidates') or 0}")
        print(f"chunk_fallback_candidates={stats.get('chunk_fallback_candidates') or 0}")
        print(f"candidate_audio_minutes={stats.get('candidate_audio_minutes') or 0}")
        print(f"processed={len(results)}")
        if job_id:
            print(f"processing_job_id={job_id}")
        for result in results:
            print(
                f"{result.get('action')} {result.get('unitType')} {result.get('trackKey')}#{result.get('unitIndex')} "
                f"unit={result.get('workUnitId')} cost={result.get('estimatedCostUsd')}"
            )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
