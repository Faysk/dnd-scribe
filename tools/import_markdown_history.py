#!/usr/bin/env python3
"""Import historical Markdown files conservatively into Supabase."""

from __future__ import annotations

import argparse
import hashlib
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


def title_from_markdown(path: Path, content: str) -> str:
    for raw in content.splitlines():
        match = re.match(r"^#\s+(.+)$", raw.strip())
        if match:
            return match.group(1).strip()[:180]
    return path.stem.replace("_", " ").replace("-", " ").strip().title()[:180] or path.name


def collect_documents(input_dir: Path) -> list[dict[str, Any]]:
    docs = []
    for path in sorted(input_dir.rglob("*.md")):
        if path.is_dir():
            continue
        content = path.read_text(encoding="utf-8", errors="replace")
        digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
        rel = str(path.relative_to(input_dir))
        docs.append(
            {
                "source_path": rel,
                "title": title_from_markdown(path, content),
                "content": content,
                "content_hash": digest,
                "metadata": {
                    "importer": "tools/import_markdown_history.py",
                    "input_root": str(input_dir),
                    "bytes": len(content.encode("utf-8")),
                },
            }
        )
    return docs


def build_sql(campaign_slug: str, docs: list[dict[str, Any]]) -> str:
    lines = [
        "begin;",
        "set local lock_timeout = '10s';",
        "set local statement_timeout = '120s';",
        "do $$ begin",
        f"  if not exists (select 1 from campaigns where slug = {q(campaign_slug)}) then",
        "    raise exception 'campaign not found';",
        "  end if;",
        "end $$;",
    ]
    for doc in docs:
        lines.append(
            """
insert into historical_documents (
  id, campaign_id, source_path, title, content, content_hash, status, metadata, updated_at
)
select gen_random_uuid(), c.id, {source_path}, {title}, {content}, {content_hash},
       'historical_import', {metadata}, now()
from campaigns c
where c.slug = {campaign_slug}
on conflict (campaign_id, source_path)
do update set
  title = excluded.title,
  content = excluded.content,
  content_hash = excluded.content_hash,
  status = 'historical_import',
  metadata = excluded.metadata,
  updated_at = now();
""".format(
                campaign_slug=q(campaign_slug),
                source_path=q(doc["source_path"]),
                title=q(doc["title"]),
                content=q(doc["content"]),
                content_hash=q(doc["content_hash"]),
                metadata=q_json(doc["metadata"]),
            )
        )
    lines.append("commit;")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_dir", type=Path)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--campaign-slug", default="yuhara-main")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.input_dir.exists() or not args.input_dir.is_dir():
        raise SystemExit(f"input_dir not found: {args.input_dir}")
    docs = collect_documents(args.input_dir)
    print(f"documents={len(docs)}")
    print(f"bytes={sum(item['metadata']['bytes'] for item in docs)}")
    if docs:
        print(f"first={docs[0]['source_path']}")
    if args.dry_run:
        print(json.dumps([{k: v for k, v in doc.items() if k != "content"} for doc in docs], ensure_ascii=False, indent=2))
        return 0

    values = load_env(args.env_file)
    database_url = values.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")
    sql = build_sql(args.campaign_slug, docs)
    subprocess.check_call(["psql", database_url, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql])
    print("imported=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
