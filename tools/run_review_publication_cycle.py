#!/usr/bin/env python3
"""Run the local review decision -> publication -> Review Board refresh cycle."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
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


def run_step(label: str, cmd: list[str]) -> str:
    print(f"== {label} ==")
    print("cmd=" + " ".join(cmd))
    output = subprocess.check_output(cmd, text=True, encoding="utf-8")
    if output.strip():
        print(output.strip())
    return output


def fetch_summary(database_url: str, campaign_slug: str, source_session_id: str, source_run_id: str) -> dict[str, Any]:
    campaign_q = sql_literal(campaign_slug)
    session_q = sql_literal(source_session_id)
    run_q = sql_literal(source_run_id)
    sql = f"""
with target as (
  select s.id session_id
  from sessions s join campaigns c on c.id = s.campaign_id
  where c.slug = {campaign_q} and s.source_session_id = {session_q}
),
canon_status as (
  select status, count(*) count from canon_candidates cc join target t on t.session_id = cc.session_id
  where cc.source_run_id = {run_q}
  group by status
),
quote_status as (
  select status, count(*) count from quote_candidates qc join target t on t.session_id = qc.session_id
  where qc.source_run_id = {run_q}
  group by status
),
outtake_status as (
  select status, count(*) count from outtake_candidates oc join target t on t.session_id = oc.session_id
  where oc.source_run_id = {run_q}
  group by status
),
publication_rows as (
  select visibility, status, count(*) count from publications p join target t on t.session_id = p.session_id
  where p.source_run_id = {run_q}
  group by visibility, status
)
select json_build_object(
  'canon_status', coalesce((select json_object_agg(status, count) from canon_status), '{{}}'::json),
  'quote_status', coalesce((select json_object_agg(status, count) from quote_status), '{{}}'::json),
  'outtake_status', coalesce((select json_object_agg(status, count) from outtake_status), '{{}}'::json),
  'publication_status', coalesce((select json_agg(json_build_object('visibility', visibility, 'status', status, 'count', count) order by visibility, status) from publication_rows), '[]'::json),
  'approved_publications', (
    select count(*) from publications p join target t on t.session_id = p.session_id
    where p.source_run_id = {run_q} and p.visibility <> 'review_only'
  ),
  'review_decisions', (
    select count(*) from review_decisions rd join target t on t.session_id = rd.session_id
    where rd.source_run_id = {run_q}
  )
) from target;
"""
    return run_json(database_url, sql) or {}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--campaign-slug", default="yuhara-main")
    parser.add_argument("--source-session-id", default="craig-AdabEqbzngmT-stage1-full")
    parser.add_argument("--source-run-id", default="classify_candidates_v2_gpt-5.4-mini")
    parser.add_argument("--decisions-file", type=Path)
    parser.add_argument("--update-db", action="store_true")
    parser.add_argument("--publications-out-dir", type=Path)
    parser.add_argument("--review-board-out", type=Path, default=Path("data/review_session.generated.js"))
    parser.add_argument("--skip-publications", action="store_true")
    parser.add_argument("--skip-review-board-export", action="store_true")
    args = parser.parse_args()

    values = load_env(args.env_file)
    database_url = values.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")

    if args.decisions_file:
        decision_cmd = [
            sys.executable,
            "tools/apply_review_decisions.py",
            str(args.decisions_file),
            "--env-file",
            str(args.env_file),
            "--campaign-slug",
            args.campaign_slug,
            "--source-session-id",
            args.source_session_id,
            "--source-run-id",
            args.source_run_id,
        ]
        if args.update_db:
            decision_cmd.append("--update-db")
        else:
            decision_cmd.extend(["--sql-out", "tmp/review_decisions_cycle.sql"])
        run_step("apply_review_decisions", decision_cmd)

    if not args.skip_publications:
        publication_cmd = [
            sys.executable,
            "tools/build_session_publications.py",
            "--env-file",
            str(args.env_file),
            "--campaign-slug",
            args.campaign_slug,
            "--source-session-id",
            args.source_session_id,
            "--source-run-id",
            args.source_run_id,
        ]
        if args.publications_out_dir:
            publication_cmd.extend(["--out-dir", str(args.publications_out_dir)])
        if args.update_db:
            publication_cmd.append("--update-db")
        run_step("build_session_publications", publication_cmd)

    if not args.skip_review_board_export:
        export_cmd = [
            sys.executable,
            "tools/export_review_board_data.py",
            "--env-file",
            str(args.env_file),
            "--campaign-slug",
            args.campaign_slug,
            "--source-session-id",
            args.source_session_id,
            "--ai-run-id",
            args.source_run_id,
            "--out",
            str(args.review_board_out),
        ]
        run_step("export_review_board_data", export_cmd)

    summary = fetch_summary(database_url, args.campaign_slug, args.source_session_id, args.source_run_id)
    print("== summary ==")
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
