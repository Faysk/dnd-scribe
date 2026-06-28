#!/usr/bin/env python3
"""Validate the no-surprise AI cost pipeline before paid OpenAI calls."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_POLICY = ROOT / "config" / "ai_cost_policy.json"
DEFAULT_CAMPAIGN = "yuhara-main"
DEFAULT_PROMPT_VERSION = "transcribe_v1"

REQUIRED_RELATIONS = [
    "sessions",
    "recording_files",
    "audio_chunks",
    "audio_speech_slices",
    "audio_transcription_work_units",
    "transcription_cache",
    "ai_usage_ledger",
    "ai_usage_session_summary",
    "processing_jobs",
]

REQUIRED_COLUMNS = {
    "recording_files": ["session_id", "sha256", "audio_dbfs", "probably_silent", "storage_path"],
    "audio_chunks": [
        "session_id",
        "source_file_id",
        "duration_ms",
        "sha256",
        "audio_dbfs",
        "probably_silent",
        "transcription_status",
        "storage_path",
    ],
    "audio_speech_slices": [
        "session_id",
        "source_file_id",
        "source_chunk_id",
        "duration_ms",
        "sha256",
        "probably_silent",
        "transcription_status",
        "storage_path",
    ],
    "transcription_cache": [
        "audio_sha256",
        "provider",
        "model",
        "prompt_version",
        "status",
        "transcript_text",
        "raw_response",
    ],
    "ai_usage_ledger": [
        "campaign_id",
        "session_id",
        "job_id",
        "provider",
        "model",
        "operation_type",
        "status",
        "source_hash",
        "input_audio_minutes",
        "estimated_cost_usd",
        "actual_cost_usd",
        "metadata",
    ],
    "processing_jobs": ["session_id", "job_type", "status", "input", "output"],
}

ENV_COST_OVERRIDES = {
    "DND_COST_TRANSCRIPTION_AUDIO_MINUTE_USD": "transcriptionAudioMinute",
    "DND_COST_CLASSIFICATION_INPUT_MTOK_USD": "classificationInputMillionTokens",
    "DND_COST_CLASSIFICATION_OUTPUT_MTOK_USD": "classificationOutputMillionTokens",
    "DND_COST_SUMMARY_INPUT_MTOK_USD": "summaryInputMillionTokens",
    "DND_COST_SUMMARY_OUTPUT_MTOK_USD": "summaryOutputMillionTokens",
}


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


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def sql_literal(value: Any) -> str:
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def sql_values(rows: list[tuple[Any, ...]]) -> str:
    return ",\n".join("(" + ", ".join(sql_literal(value) for value in row) + ")" for row in rows)


def run_json(database_url: str, sql: str) -> Any:
    output = subprocess.check_output(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
        text=True,
        encoding="utf-8",
    )
    text = output.strip()
    return json.loads(text) if text else None


def add_issue(issues: list[dict[str, Any]], level: str, code: str, message: str, **details: Any) -> None:
    issue: dict[str, Any] = {"level": level, "code": code, "message": message}
    if details:
        issue["details"] = details
    issues.append(issue)


def apply_env_cost_overrides(policy: dict[str, Any], env: dict[str, str], issues: list[dict[str, Any]]) -> None:
    estimation = policy.setdefault("estimation", {})
    unit_costs = estimation.setdefault("unitCostsUsd", {})
    for env_key, policy_key in ENV_COST_OVERRIDES.items():
        value = env.get(env_key)
        if value in (None, ""):
            continue
        try:
            unit_costs[policy_key] = float(value)
        except ValueError:
            add_issue(
                issues,
                "error",
                "invalid_cost_env_value",
                f"{env_key} precisa ser numerico.",
                envKey=env_key,
            )


def policy_model(policy: dict[str, Any], override: str | None) -> str:
    if override:
        return override
    return (((policy.get("modelRouting") or {}).get("transcription") or {}).get("defaultModel") or "gpt-4o-mini-transcribe")


def validate_policy(
    policy: dict[str, Any],
    issues: list[dict[str, Any]],
    require_prices: bool,
    required_cost_keys: list[str] | None = None,
) -> None:
    guards = policy.get("guards") or {}
    preprocessing = policy.get("audioPreprocessing") or {}
    unit_costs = ((policy.get("estimation") or {}).get("unitCostsUsd") or {})

    if policy.get("mode") != "economy_first":
        add_issue(issues, "warning", "policy_mode", "A politica nao esta marcada como economy_first.")
    if guards.get("requireEstimateBeforeRun") is not True:
        add_issue(issues, "error", "missing_estimate_guard", "A politica deve exigir estimativa antes de executar.")
    if guards.get("preferBatchForAsyncJobs") is not True:
        add_issue(issues, "warning", "batch_not_preferred", "Jobs assincronos deveriam preferir Batch API quando aplicavel.")
    if preprocessing.get("deduplicateChunksBySha256") is not True:
        add_issue(issues, "error", "dedupe_disabled", "Deduplicacao por sha256 precisa estar ativa.")
    if preprocessing.get("reuseTranscriptByAudioHash") is not True:
        add_issue(issues, "error", "cache_reuse_disabled", "Reuso de transcript por hash precisa estar ativo.")
    if preprocessing.get("skipSilentChunks") is not True:
        add_issue(issues, "warning", "silence_skip_disabled", "Pular silencio reduz custo e deveria estar ativo.")

    missing_prices = [key for key, value in unit_costs.items() if value is None]
    required_missing_prices = [
        key
        for key in (required_cost_keys or [])
        if unit_costs.get(key) is None
    ]
    if required_missing_prices:
        add_issue(
            issues,
            "error",
            "missing_required_unit_costs",
            "Custos unitarios obrigatorios para esta execucao ainda estao vazios.",
            keys=required_missing_prices,
        )
    if missing_prices:
        level = "error" if require_prices else "warning"
        add_issue(
            issues,
            level,
            "missing_unit_costs",
            "Custos unitarios ainda estao vazios. Use env privado antes de rodar cobranca real.",
            keys=missing_prices,
        )


def schema_report(database_url: str) -> dict[str, Any]:
    relation_rows = [(name,) for name in REQUIRED_RELATIONS]
    column_rows = [(table, column) for table, columns in REQUIRED_COLUMNS.items() for column in columns]
    sql = f"""
with required_relations(name) as (
  values {sql_values(relation_rows)}
), required_columns(table_name, column_name) as (
  values {sql_values(column_rows)}
)
select json_build_object(
  'relations', coalesce((
    select json_agg(json_build_object(
      'name', rr.name,
      'exists', to_regclass('public.' || quote_ident(rr.name)) is not null
    ) order by rr.name)
    from required_relations rr
  ), '[]'::json),
  'columns', coalesce((
    select json_agg(json_build_object(
      'table', rc.table_name,
      'column', rc.column_name,
      'exists', c.column_name is not null
    ) order by rc.table_name, rc.column_name)
    from required_columns rc
    left join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name = rc.table_name
     and c.column_name = rc.column_name
  ), '[]'::json)
);
"""
    return run_json(database_url, sql) or {"relations": [], "columns": []}


def validate_schema(report: dict[str, Any], issues: list[dict[str, Any]]) -> None:
    for relation in report.get("relations") or []:
        if not relation.get("exists"):
            add_issue(issues, "error", "missing_relation", f"Relacao public.{relation['name']} nao existe.", relation=relation["name"])
    for column in report.get("columns") or []:
        if not column.get("exists"):
            add_issue(
                issues,
                "error",
                "missing_column",
                f"Coluna public.{column['table']}.{column['column']} nao existe.",
                table=column["table"],
                column=column["column"],
            )


def session_report(
    database_url: str,
    campaign_slug: str,
    source_session_id: str,
    model: str,
    prompt_version: str,
    planned_limit: int | None = None,
) -> dict[str, Any] | None:
    planned_limit_sql = "null" if planned_limit is None or planned_limit <= 0 else str(int(planned_limit))
    planned_limit_clause = "" if planned_limit is None or planned_limit <= 0 else f"limit {int(planned_limit)}"
    sql = f"""
with target_session as (
  select s.id, s.source_session_id, s.title, c.id campaign_id, c.slug campaign_slug
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = {sql_literal(campaign_slug)}
    and s.source_session_id = {sql_literal(source_session_id)}
  limit 1
), file_stats as (
  select
    count(*)::int total_files,
    count(*) filter (where nullif(rf.sha256, '') is null)::int missing_file_hashes
  from recording_files rf
  where rf.session_id = (select id from target_session)
), chunk_stats as (
  select
    count(*)::int total_chunks,
    count(*) filter (where ac.probably_silent is true)::int silent_chunks
  from audio_chunks ac
  where ac.session_id = (select id from target_session)
), work_units as (
  select wu.*, tc.id cache_id
  from audio_transcription_work_units wu
  left join transcription_cache tc
    on tc.audio_sha256 = wu.sha256
   and tc.provider = 'openai'
   and tc.model = {sql_literal(model)}
   and tc.prompt_version = {sql_literal(prompt_version)}
   and tc.status = 'succeeded'
  where wu.session_id = (select id from target_session)
), workable_units as (
  select *
  from work_units
  where nullif(sha256, '') is not null
    and coalesce(probably_silent, false) is false
    and coalesce(transcription_status, 'pending') not in ('skipped_silence', 'transcribed', 'cached')
  order by (cache_id is not null) desc, track_key, start_ms, unit_type, unit_index
), paid_candidate_work_units as (
  select *
  from workable_units
  where cache_id is null
), planned_work_units as (
  select *
  from workable_units
  {planned_limit_clause}
), work_unit_stats as (
  select
    count(*)::int total_work_units,
    count(*) filter (where unit_type = 'speech_slice')::int speech_slice_work_units,
    count(*) filter (where unit_type = 'chunk')::int chunk_fallback_work_units,
    count(*) filter (where nullif(sha256, '') is null)::int missing_hash_work_units,
    count(distinct id) filter (where cache_id is not null)::int cache_hit_work_units
  from work_units
), candidate_stats as (
  select
    count(*)::int transcribe_candidate_work_units,
    round((coalesce(sum(coalesce(duration_ms, greatest(0, coalesce(end_ms, 0) - coalesce(start_ms, 0)), 0)), 0) / 60000.0)::numeric, 3) billable_audio_minutes
  from paid_candidate_work_units
), planned_stats as (
  select
    count(*) filter (where cache_id is null)::int planned_transcribe_work_units,
    round((coalesce(sum(coalesce(duration_ms, greatest(0, coalesce(end_ms, 0) - coalesce(start_ms, 0)), 0)) filter (where cache_id is null), 0) / 60000.0)::numeric, 3) planned_billable_audio_minutes
  from planned_work_units
)
select row_to_json(row) from (
  select
    ts.id::text session_id,
    ts.source_session_id,
    ts.title,
    ts.campaign_slug,
    fs.total_files,
    fs.missing_file_hashes,
    cs.total_chunks,
    cs.silent_chunks,
    wus.total_work_units,
    wus.speech_slice_work_units,
    wus.chunk_fallback_work_units,
    wus.missing_hash_work_units,
    wus.cache_hit_work_units,
    cands.transcribe_candidate_work_units,
    cands.billable_audio_minutes,
    {planned_limit_sql}::int planned_limit,
    ps.planned_transcribe_work_units,
    ps.planned_billable_audio_minutes
  from target_session ts
  cross join file_stats fs
  cross join chunk_stats cs
  cross join work_unit_stats wus
  cross join candidate_stats cands
  cross join planned_stats ps
) row;
"""
    return run_json(database_url, sql)


def validate_session(report: dict[str, Any] | None, policy: dict[str, Any], issues: list[dict[str, Any]], source_session_id: str) -> None:
    if not report:
        add_issue(issues, "error", "session_not_found", "Sessao nao encontrada para validacao.", sourceSessionId=source_session_id)
        return

    max_units = int(((policy.get("guards") or {}).get("defaultMaxChunksPerRun") or 0))
    max_minutes = float(((policy.get("guards") or {}).get("defaultMaxAudioMinutesPerRun") or 0))

    total_chunks = int(report.get("total_chunks") or 0)
    total_units = int(report.get("total_work_units") or 0)
    missing_hash = int(report.get("missing_hash_work_units") or 0)
    missing_file_hashes = int(report.get("missing_file_hashes") or 0)
    candidate_units = int(report.get("transcribe_candidate_work_units") or 0)
    billable_minutes = float(report.get("billable_audio_minutes") or 0)
    planned_limit = report.get("planned_limit")
    planned_scope = planned_limit is not None
    planned_units = int(report.get("planned_transcribe_work_units") or 0)
    planned_minutes = float(report.get("planned_billable_audio_minutes") or 0)
    limit_units = planned_units if planned_scope else candidate_units
    limit_minutes = planned_minutes if planned_scope else billable_minutes

    if total_chunks == 0:
        add_issue(issues, "error", "no_chunks", "Sessao ainda nao tem chunks importados.", sourceSessionId=source_session_id)
    if total_units == 0:
        add_issue(issues, "warning", "no_work_units", "Sessao nao tem work units de transcricao depois dos filtros de custo.")
    if missing_hash:
        level = "error" if candidate_units == 0 else "warning"
        add_issue(
            issues,
            level,
            "work_units_missing_hash",
            "Existem work units sem sha256; elas ficam fora do lote pago ate reprocessar metadados.",
            count=missing_hash,
            transcribeCandidates=candidate_units,
        )
    if missing_file_hashes:
        add_issue(issues, "warning", "files_missing_hash", "Existem arquivos de gravacao sem sha256.", count=missing_file_hashes)
    if max_units and limit_units > max_units:
        add_issue(
            issues,
            "error",
            "work_unit_limit_exceeded",
            "Numero de work units planejadas passa o limite por rodada.",
            candidates=limit_units,
            totalCandidates=candidate_units,
            max=max_units,
            plannedLimit=planned_limit,
        )
    if max_minutes and limit_minutes > max_minutes:
        add_issue(
            issues,
            "error",
            "audio_limit_exceeded",
            "Minutos cobraveis planejados passam o limite por rodada.",
            billableMinutes=limit_minutes,
            totalBillableMinutes=billable_minutes,
            max=max_minutes,
            plannedLimit=planned_limit,
        )
    if total_chunks and candidate_units == 0:
        add_issue(issues, "warning", "nothing_to_transcribe", "Nenhuma work unit nova precisa de transcricao para esse modelo/prompt.")


def print_human(payload: dict[str, Any], strict: bool) -> None:
    issues = payload["issues"]
    blocking = [issue for issue in issues if issue["level"] == "error" or (strict and issue["level"] == "warning")]
    print("AI cost pipeline validation")
    print(f"status={'blocked' if blocking else 'ok'}")
    print(f"errors={sum(1 for issue in issues if issue['level'] == 'error')}")
    print(f"warnings={sum(1 for issue in issues if issue['level'] == 'warning')}")

    session = payload.get("session")
    if session:
        print(f"session={session['source_session_id']}")
        print(f"chunks_total={session['total_chunks']}")
        print(f"chunks_silent={session['silent_chunks']}")
        print(f"work_units_total={session['total_work_units']}")
        print(f"work_units_speech_slices={session['speech_slice_work_units']}")
        print(f"work_units_chunk_fallbacks={session['chunk_fallback_work_units']}")
        print(f"work_units_missing_hash={session['missing_hash_work_units']}")
        print(f"work_units_cache_hit={session['cache_hit_work_units']}")
        print(f"work_units_transcribe_candidates={session['transcribe_candidate_work_units']}")
        print(f"billable_audio_minutes={session['billable_audio_minutes']}")
        if session.get("planned_limit") is not None:
            print(f"planned_limit={session['planned_limit']}")
            print(f"planned_work_units_transcribe={session['planned_transcribe_work_units']}")
            print(f"planned_billable_audio_minutes={session['planned_billable_audio_minutes']}")

    if issues:
        print("issues:")
        for issue in issues:
            prefix = "ERROR" if issue["level"] == "error" else "WARN"
            print(f"- {prefix} {issue['code']}: {issue['message']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_session_id", nargs="?", help="Craig/source session id to validate")
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env.local")
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--campaign", default=DEFAULT_CAMPAIGN)
    parser.add_argument("--model")
    parser.add_argument("--prompt-version", default=DEFAULT_PROMPT_VERSION)
    parser.add_argument("--planned-limit", type=int, help="Validate only the next limited transcription run for run-level guards.")
    parser.add_argument("--policy-only", action="store_true", help="Skip database checks")
    parser.add_argument("--require-openai-key", action="store_true")
    parser.add_argument("--require-prices", action="store_true", help="Treat missing local price config as an error")
    parser.add_argument(
        "--required-cost-key",
        action="append",
        default=[],
        help="Treat a specific unitCostsUsd key as required for this run. Can be repeated.",
    )
    parser.add_argument("--strict", action="store_true", help="Return non-zero for warnings too")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    issues: list[dict[str, Any]] = []
    env = load_env(args.env_file)
    policy = load_json(args.policy)
    apply_env_cost_overrides(policy, env, issues)
    model = policy_model(policy, args.model)

    validate_policy(policy, issues, args.require_prices, args.required_cost_key)

    if args.require_openai_key and not env.get("OPENAI_API_KEY"):
        add_issue(issues, "error", "missing_openai_key", f"OPENAI_API_KEY nao encontrado em {args.env_file}.")

    schema: dict[str, Any] | None = None
    session: dict[str, Any] | None = None
    if args.policy_only:
        add_issue(issues, "warning", "db_not_checked", "Banco nao foi verificado porque --policy-only foi usado.")
    else:
        database_url = env.get("DATABASE_URL")
        if not database_url:
            add_issue(issues, "error", "missing_database_url", f"DATABASE_URL nao encontrado em {args.env_file}.")
        else:
            try:
                schema = schema_report(database_url)
                validate_schema(schema, issues)
                if args.source_session_id:
                    session = session_report(database_url, args.campaign, args.source_session_id, model, args.prompt_version, args.planned_limit)
                    validate_session(session, policy, issues, args.source_session_id)
            except FileNotFoundError:
                add_issue(issues, "error", "psql_not_found", "psql nao esta disponivel no PATH local.")
            except subprocess.CalledProcessError as exc:
                add_issue(issues, "error", "psql_failed", "Consulta de validacao falhou.", returnCode=exc.returncode)

    payload = {
        "ok": not any(issue["level"] == "error" for issue in issues) and not (args.strict and issues),
        "strict": args.strict,
        "campaign": args.campaign,
        "model": model,
        "promptVersion": args.prompt_version,
        "schema": schema,
        "session": session,
        "issues": issues,
    }

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print_human(payload, args.strict)

    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
