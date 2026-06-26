#!/usr/bin/env python3
"""Report AI usage and cost ledger totals."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
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


def run_json(database_url: str, sql: str) -> Any:
    output = subprocess.check_output(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
        text=True,
        encoding="utf-8",
    )
    text = output.strip()
    return json.loads(text) if text else None


def session_report(database_url: str, campaign_slug: str, limit: int) -> list[dict[str, Any]]:
    sql = f"""
select coalesce(json_agg(row_to_json(row) order by row.last_usage_at desc nulls last, row.source_session_id desc), '[]'::json) from (
  select
    s.source_session_id,
    s.title,
    coalesce(v.ledger_entries, 0) ledger_entries,
    coalesce(v.estimated_cost_usd, 0) estimated_cost_usd,
    coalesce(v.actual_cost_usd, 0) actual_cost_usd,
    coalesce(v.input_audio_minutes, 0) input_audio_minutes,
    coalesce(v.input_tokens, 0) input_tokens,
    coalesce(v.cached_input_tokens, 0) cached_input_tokens,
    coalesce(v.output_tokens, 0) output_tokens,
    v.last_usage_at
  from sessions s
  join campaigns c on c.id = s.campaign_id
  left join ai_usage_session_summary v on v.session_id = s.id
  where c.slug = {sql_literal(campaign_slug)}
  order by v.last_usage_at desc nulls last, s.created_at desc
  limit {int(limit)}
) row;
"""
    return run_json(database_url, sql) or []


def model_report(database_url: str, campaign_slug: str) -> list[dict[str, Any]]:
    sql = f"""
select coalesce(json_agg(row_to_json(row) order by row.actual_cost_usd desc, row.estimated_cost_usd desc), '[]'::json) from (
  select
    l.provider,
    l.model,
    l.operation_type,
    l.status,
    count(*) entries,
    coalesce(sum(l.input_audio_minutes), 0)::numeric(12, 3) input_audio_minutes,
    coalesce(sum(l.input_tokens), 0)::bigint input_tokens,
    coalesce(sum(l.cached_input_tokens), 0)::bigint cached_input_tokens,
    coalesce(sum(l.output_tokens), 0)::bigint output_tokens,
    coalesce(sum(l.estimated_cost_usd), 0)::numeric(12, 6) estimated_cost_usd,
    coalesce(sum(l.actual_cost_usd), 0)::numeric(12, 6) actual_cost_usd
  from ai_usage_ledger l
  left join campaigns c on c.id = l.campaign_id
  where c.slug = {sql_literal(campaign_slug)} or l.campaign_id is null
  group by l.provider, l.model, l.operation_type, l.status
) row;
"""
    return run_json(database_url, sql) or []


def print_table(title: str, rows: list[dict[str, Any]], columns: list[str]) -> None:
    print(title)
    if not rows:
        print("  sem dados")
        return
    widths = {column: len(column) for column in columns}
    for row in rows:
        for column in columns:
            widths[column] = max(widths[column], len(str(row.get(column, ""))))
    header = "  " + "  ".join(column.ljust(widths[column]) for column in columns)
    print(header)
    print("  " + "  ".join("-" * widths[column] for column in columns))
    for row in rows:
        print("  " + "  ".join(str(row.get(column, "")).ljust(widths[column]) for column in columns))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env.local")
    parser.add_argument("--campaign", default=DEFAULT_CAMPAIGN)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    env = load_env(args.env_file)
    database_url = env.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")

    payload = {
        "campaign": args.campaign,
        "sessions": session_report(database_url, args.campaign, args.limit),
        "models": model_report(database_url, args.campaign),
    }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print_table(
            "Sessoes",
            payload["sessions"],
            ["source_session_id", "ledger_entries", "input_audio_minutes", "estimated_cost_usd", "actual_cost_usd"],
        )
        print()
        print_table(
            "Modelos",
            payload["models"],
            ["provider", "model", "operation_type", "status", "entries", "input_audio_minutes", "estimated_cost_usd", "actual_cost_usd"],
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
