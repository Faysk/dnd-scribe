#!/usr/bin/env python3
"""Build consolidated canon entries from approved canon candidates."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from typing import Any


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def q(value: Any, cast: str | None = None) -> str:
    if value is None:
        return "null"
    text = str(value).replace("'", "''")
    literal = f"'{text}'"
    return f"{literal}::{cast}" if cast else literal


def q_json(value: Any) -> str:
    text = json.dumps(value, ensure_ascii=False, sort_keys=True).replace("'", "''")
    return f"'{text}'::jsonb"


def slugify(value: str) -> str:
    text = value.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:120] or "entidade"


def run_json(database_url: str, sql: str) -> Any:
    output = subprocess.check_output(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
        text=True,
        encoding="utf-8",
    )
    text = output.strip()
    return json.loads(text) if text else None


def fetch_approved(database_url: str, campaign_slug: str, source_run_id: str | None) -> list[dict[str, Any]]:
    run_filter = f"and cc.source_run_id = {q(source_run_id)}" if source_run_id else ""
    return run_json(
        database_url,
        f"""
select coalesce(json_agg(item order by item->>'title'), '[]'::json) from (
  select json_build_object(
    'campaign_id', c.id,
    'candidate_id', cc.id,
    'source_candidate_id', cc.source_candidate_id,
    'source_run_id', cc.source_run_id,
    'title', cc.title,
    'claim', cc.claim,
    'candidate_type', cc.candidate_type,
    'metadata', cc.metadata
  ) item
  from canon_candidates cc
  join sessions s on s.id = cc.session_id
  join campaigns c on c.id = s.campaign_id
  where c.slug = {q(campaign_slug)}
    and cc.status = 'approved_canon'
    {run_filter}
) rows;
""",
    ) or []


def build_sql(campaign_slug: str, items: list[dict[str, Any]]) -> str:
    lines = [
        "begin;",
        "set local lock_timeout = '10s';",
        "set local statement_timeout = '120s';",
    ]
    for item in items:
        entities = ((item.get("metadata") or {}).get("entities") or [])[:1]
        entity_name = str(entities[0]).strip() if entities else item["title"]
        lines.append(
            """
with campaign_row as (
  select id from campaigns where slug = {campaign_slug}
), entity_row as (
  insert into entities (id, campaign_id, name, slug, entity_type, status, visibility, summary, updated_at)
  select gen_random_uuid(), c.id, {entity_name}, {entity_slug}, 'other', 'active', 'private_players', null, now()
  from campaign_row c
  on conflict (campaign_id, name)
  do update set updated_at = now()
  returning id
), selected_entity as (
  select id from entity_row
  union all
  select e.id from entities e join campaign_row c on c.id = e.campaign_id where e.name = {entity_name}
  limit 1
)
insert into canon_entries (
  id, campaign_id, entity_id, source_candidate_id, title, content, entry_type,
  visibility, status, source_run_id, metadata, updated_at
)
select gen_random_uuid(), c.id, se.id, {candidate_id}, {title}, {claim}, {candidate_type},
       'private_players', 'active', {source_run_id}, {metadata}, now()
from campaign_row c, selected_entity se
on conflict (campaign_id, source_candidate_id)
do update set
  entity_id = excluded.entity_id,
  title = excluded.title,
  content = excluded.content,
  entry_type = excluded.entry_type,
  visibility = excluded.visibility,
  status = excluded.status,
  source_run_id = excluded.source_run_id,
  metadata = excluded.metadata,
  updated_at = now();
""".format(
                campaign_slug=q(campaign_slug),
                entity_name=q(entity_name),
                entity_slug=q(slugify(entity_name)),
                candidate_id=q(item["candidate_id"], "uuid"),
                title=q(item["title"]),
                claim=q(item["claim"]),
                candidate_type=q(item.get("candidate_type") or "event"),
                source_run_id=q(item.get("source_run_id")),
                metadata=q_json({"source": "approved_canon_candidate", "source_candidate_id": item.get("source_candidate_id")}),
            )
        )
    lines.append("commit;")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--campaign-slug", default="yuhara-main")
    parser.add_argument("--source-run-id")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    values = load_env(args.env_file)
    database_url = values.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")
    items = fetch_approved(database_url, args.campaign_slug, args.source_run_id)
    print(f"approved_canon={len(items)}")
    if args.dry_run:
        print(json.dumps(items, ensure_ascii=False, indent=2))
        return 0
    sql = build_sql(args.campaign_slug, items)
    subprocess.check_call(["psql", database_url, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql])
    print("canon_entries_built=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
