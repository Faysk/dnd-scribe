#!/usr/bin/env python3
"""Build safe publication drafts from reviewed session data."""

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


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


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


def fetch_publication_context(database_url: str, campaign_slug: str, source_session_id: str, source_run_id: str) -> dict:
    campaign_q = sql_literal(campaign_slug)
    session_q = sql_literal(source_session_id)
    run_q = sql_literal(source_run_id)
    common = (
        "with target as ("
        "select c.slug campaign_slug, c.name campaign_name, s.id session_id, s.title session_title, "
        "s.source_session_id, s.session_date, s.status, s.duration_ms, s.summary_short "
        "from sessions s join campaigns c on c.id = s.campaign_id "
        f"where c.slug = {campaign_q} and s.source_session_id = {session_q}"
        ")"
    )
    session = run_json(database_url, f"{common} select row_to_json(target) from target;")
    if not session:
        raise SystemExit(f"Session not found: {campaign_slug}/{source_session_id}")

    canon = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'source_candidate_id'), '[]'::json) from (
  select json_build_object(
    'source_candidate_id', cc.source_candidate_id,
    'title', cc.title,
    'claim', cc.claim,
    'candidate_type', cc.candidate_type,
    'status', cc.status,
    'confidence', cc.confidence,
    'source_segment_ids', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(cc.source_segment_ids) order by ts.source_sequence),
    'metadata', cc.metadata
  ) item
  from canon_candidates cc join target t on t.session_id = cc.session_id
  where cc.source_run_id = {run_q}
) rows;
""",
    )
    quotes = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'source_candidate_id'), '[]'::json) from (
  select json_build_object(
    'source_candidate_id', qc.source_candidate_id,
    'quote_text', qc.quote_text,
    'character_name', qc.character_name,
    'context', qc.context,
    'status', qc.status,
    'approved_for_public', qc.approved_for_public,
    'source_segment_ids', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(qc.source_segment_ids) order by ts.source_sequence),
    'metadata', qc.metadata
  ) item
  from quote_candidates qc join target t on t.session_id = qc.session_id
  where qc.source_run_id = {run_q}
) rows;
""",
    )
    outtakes = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(item order by item->>'source_candidate_id'), '[]'::json) from (
  select json_build_object(
    'source_candidate_id', oc.source_candidate_id,
    'title', oc.title,
    'description', oc.description,
    'sensitivity_level', oc.sensitivity_level,
    'status', oc.status,
    'source_segment_ids', array(select ts.source_segment_id from transcript_segments ts where ts.id = any(oc.source_segment_ids) order by ts.source_sequence),
    'metadata', oc.metadata
  ) item
  from outtake_candidates oc join target t on t.session_id = oc.session_id
  where oc.source_run_id = {run_q}
) rows;
""",
    )
    existing_publications = run_json(
        database_url,
        f"""
{common}
select coalesce(json_agg(json_build_object(
  'publication_type', p.publication_type,
  'source_publication_id', p.source_publication_id,
  'visibility', p.visibility,
  'status', p.status
) order by p.source_publication_id), '[]'::json)
from publications p join target t on t.session_id = p.session_id
where p.source_run_id = {run_q};
""",
    )
    return {
        "session": session,
        "source_run_id": source_run_id,
        "canon": canon,
        "quotes": quotes,
        "outtakes": outtakes,
        "existing_publications": existing_publications,
    }


def lines_for_candidates(title: str, items: list[dict], body_key: str) -> list[str]:
    lines = [f"## {title}", ""]
    if not items:
        return lines + ["Nenhum item nesta categoria.", ""]
    for item in items:
        name = item.get("title") or item.get("character_name") or item.get("source_candidate_id")
        lines.append(f"### {name}")
        lines.append("")
        lines.append(f"- Status: `{item.get('status')}`")
        lines.append(f"- Confiança IA: `{item.get('confidence', item.get('metadata', {}).get('confidence', '-'))}`")
        lines.append(f"- Fontes: `{', '.join(item.get('source_segment_ids') or [])}`")
        if item.get("sensitivity_level"):
            lines.append(f"- Sensibilidade: `{item['sensitivity_level']}`")
        lines.append("")
        lines.append(str(item.get(body_key) or ""))
        if item.get("metadata", {}).get("reason"):
            lines.append("")
            lines.append(f"Motivo IA: {item['metadata']['reason']}")
        lines.append("")
    return lines


def build_review_packet(context: dict) -> str:
    session = context["session"]
    lines = [
        f"# Pacote de Revisão — {session['session_title']}",
        "",
        "> Documento interno. Não publicar. Nada aqui é canon aprovado até decisão do DM.",
        "",
        "## Sessão",
        "",
        f"- Campanha: `{session['campaign_name']}`",
        f"- Session source: `{session['source_session_id']}`",
        f"- Data: `{session.get('session_date') or 'sem data'}`",
        f"- Run IA: `{context['source_run_id']}`",
        "",
        "## Trava de publicação",
        "",
        "Este pacote contém candidatos e material de revisão. Para gerar publicação final, primeiro aprove itens como canon, fala ou bastidor publicável.",
        "",
    ]
    lines += lines_for_candidates("Canon candidato", context["canon"], "claim")
    lines += lines_for_candidates("Falas candidatas", context["quotes"], "quote_text")
    lines += lines_for_candidates("Bastidores candidatos", context["outtakes"], "description")
    return "\n".join(lines).rstrip() + "\n"


def build_approved_publications(context: dict) -> list[dict]:
    approved_canon = [item for item in context["canon"] if item.get("status") == "approved_canon"]
    approved_quotes = [item for item in context["quotes"] if item.get("status") == "approved"]
    approved_outtakes = [item for item in context["outtakes"] if item.get("status") == "approved_by_all"]
    publications = []
    if approved_canon:
        content = ["# Mudanças de Canon", ""]
        for item in approved_canon:
            content.extend([f"## {item['title']}", "", item["claim"], "", f"Fontes: `{', '.join(item.get('source_segment_ids') or [])}`", ""])
        publications.append(
            {
                "source_publication_id": "canon_changes_approved",
                "publication_type": "canon_changes",
                "title": "Mudanças de canon aprovadas",
                "content": "\n".join(content).rstrip() + "\n",
                "visibility": "private_players",
                "status": "draft",
                "metadata": {"approved_items": len(approved_canon)},
            }
        )
        recap = ["# Recap curto", "", "Fatos aprovados desta sessão:", ""]
        for item in approved_canon:
            recap.append(f"- {item['claim']}")
        publications.append(
            {
                "source_publication_id": "recap_short_approved",
                "publication_type": "recap_short",
                "title": "Recap curto aprovado",
                "content": "\n".join(recap).rstrip() + "\n",
                "visibility": "private_players",
                "status": "draft",
                "metadata": {"approved_items": len(approved_canon)},
            }
        )
    if approved_quotes:
        content = ["# Falas aprovadas", ""]
        for item in approved_quotes:
            character = item.get("character_name") or "Mesa"
            content.extend([f"- **{character}:** {item['quote_text']}", f"  - Fontes: `{', '.join(item.get('source_segment_ids') or [])}`"])
        publications.append(
            {
                "source_publication_id": "quotes_approved",
                "publication_type": "quotes",
                "title": "Falas aprovadas",
                "content": "\n".join(content).rstrip() + "\n",
                "visibility": "private_players",
                "status": "draft",
                "metadata": {"approved_items": len(approved_quotes)},
            }
        )
    if approved_outtakes:
        content = ["# Bastidores aprovados", ""]
        for item in approved_outtakes:
            content.extend([f"## {item['title']}", "", item["description"], ""])
        publications.append(
            {
                "source_publication_id": "outtakes_approved",
                "publication_type": "outtakes_public",
                "title": "Bastidores aprovados",
                "content": "\n".join(content).rstrip() + "\n",
                "visibility": "private_players",
                "status": "draft",
                "metadata": {"approved_items": len(approved_outtakes)},
            }
        )
    return publications


def write_outputs(context: dict, out_dir: Path) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    publications = [
        {
            "source_publication_id": "ai_review_packet",
            "publication_type": "master_notes",
            "title": "Pacote de revisão IA",
            "content": build_review_packet(context),
            "visibility": "review_only",
            "status": "draft",
            "metadata": {
                "warning": "review_only_not_public",
                "canon_candidates": len(context["canon"]),
                "quote_candidates": len(context["quotes"]),
                "outtake_candidates": len(context["outtakes"]),
            },
        }
    ]
    publications.extend(build_approved_publications(context))
    for item in publications:
        path = out_dir / f"{item['source_publication_id']}.md"
        path.write_text(item["content"], encoding="utf-8")
        item["local_path"] = str(path)
    summary = {
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
        "source_run_id": context["source_run_id"],
        "publication_count": len(publications),
        "publications": [
            {
                "source_publication_id": item["source_publication_id"],
                "publication_type": item["publication_type"],
                "title": item["title"],
                "visibility": item["visibility"],
                "status": item["status"],
                "local_path": item["local_path"],
            }
            for item in publications
        ],
    }
    (out_dir / "publication_manifest.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return publications


def build_db_sql(context: dict, publications: list[dict]) -> str:
    session = context["session"]
    source_run_id = context["source_run_id"]
    session_cte = (
        "with target_session as ("
        "select s.id from sessions s join campaigns c on c.id = s.campaign_id "
        f"where c.slug = {q(session['campaign_slug'])} and s.source_session_id = {q(session['source_session_id'])}"
        ")"
    )
    lines = ["begin;"]
    for item in publications:
        row_id = stable_uuid("publication", session["source_session_id"], source_run_id, item["source_publication_id"])
        metadata = {**item.get("metadata", {}), "local_path": item.get("local_path"), "generated_by": "build_session_publications.py"}
        lines.append(
            f"""
{session_cte}
insert into publications (
  id, session_id, publication_type, title, content, format, visibility, status,
  source_system, source_run_id, source_publication_id, metadata, updated_at
)
select
  {q(row_id, "uuid")},
  s.id,
  {q(item["publication_type"])},
  {q(item["title"])},
  {q(item["content"])},
  'markdown',
  {q(item["visibility"])},
  {q(item["status"])},
  'local_publication_pipeline',
  {q(source_run_id)},
  {q(item["source_publication_id"])},
  {q_json(metadata)},
  now()
from target_session s
on conflict (session_id, source_run_id, source_publication_id)
where source_run_id is not null and source_publication_id is not null
do update set
  publication_type = excluded.publication_type,
  title = excluded.title,
  content = excluded.content,
  format = excluded.format,
  visibility = excluded.visibility,
  status = excluded.status,
  source_system = excluded.source_system,
  metadata = excluded.metadata,
  updated_at = now();
""".strip()
        )
    job_id = stable_uuid("processing_job", session["source_session_id"], source_run_id, "publications")
    output = {
        "source_run_id": source_run_id,
        "publication_count": len(publications),
        "review_only": sum(1 for item in publications if item["visibility"] == "review_only"),
        "private_players": sum(1 for item in publications if item["visibility"] == "private_players"),
        "public_campaign": sum(1 for item in publications if item["visibility"] == "public_campaign"),
        "public_web": sum(1 for item in publications if item["visibility"] == "public_web"),
    }
    now = dt.datetime.now(dt.UTC).isoformat()
    lines.append(
        f"""
{session_cte}
insert into processing_jobs (
  id, session_id, job_type, status, attempts, input, output, started_at, finished_at
)
select
  {q(job_id, "uuid")},
  s.id,
  'build_publications',
  'succeeded',
  1,
  {q_json({"source_run_id": source_run_id})},
  {q_json(output)},
  {q(now, "timestamptz")},
  {q(now, "timestamptz")}
from target_session s
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
    return "\n".join(lines) + "\n"


def apply_db_update(database_url: str, sql: str) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".sql", encoding="utf-8", delete=False) as handle:
        handle.write(sql)
        temp_sql = Path(handle.name)
    try:
        subprocess.check_call(["psql", database_url, "-v", "ON_ERROR_STOP=1", "-f", str(temp_sql)])
    finally:
        temp_sql.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--campaign-slug", default="yuhara-main")
    parser.add_argument("--source-session-id", default="craig-AdabEqbzngmT-stage1-full")
    parser.add_argument("--source-run-id", default="classify_candidates_v2_gpt-4o")
    parser.add_argument("--out-dir", type=Path, default=Path("tmp/sessions/craig-AdabEqbzngmT-stage1-full/publications/classify_candidates_v2_gpt-4o"))
    parser.add_argument("--update-db", action="store_true")
    args = parser.parse_args()

    values = load_env(args.env_file)
    database_url = values.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")

    context = fetch_publication_context(database_url, args.campaign_slug, args.source_session_id, args.source_run_id)
    publications = write_outputs(context, args.out_dir)
    if args.update_db:
        apply_db_update(database_url, build_db_sql(context, publications))
        print("db_updated=true")
    approved_publications = [item for item in publications if item["visibility"] != "review_only"]
    print(f"out_dir={args.out_dir}")
    print(f"publications={len(publications)}")
    print(f"review_only={sum(1 for item in publications if item['visibility'] == 'review_only')}")
    print(f"approved_publications={len(approved_publications)}")
    print(f"manifest={args.out_dir / 'publication_manifest.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
