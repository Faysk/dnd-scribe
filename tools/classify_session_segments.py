#!/usr/bin/env python3
"""Classify transcript segments and extract reviewable AI candidates."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any


NAMESPACE = uuid.UUID("0e5b216d-7b46-48dd-83dd-6e5b4f27a614")
PROMPT_VERSION = "classify_candidates_v2"

SEGMENT_TYPES = [
    "dm_narration",
    "in_character",
    "player_action",
    "mechanics",
    "roll_result",
    "table_planning",
    "lore_discussion",
    "ooc_chatter",
    "joke",
    "break",
    "technical",
    "private_journal",
    "character_secret",
    "shared_secret",
    "dm_secret",
    "quote_candidate",
    "canon_candidate",
    "outtake_candidate",
]


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


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def stable_uuid(*parts: object) -> str:
    return str(uuid.uuid5(NAMESPACE, "/".join(str(part) for part in parts)))


def q(value: Any, cast: str | None = None) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).replace("'", "''")
    literal = f"'{text}'"
    return f"{literal}::{cast}" if cast else literal


def q_json(value: Any) -> str:
    return "'" + json.dumps(value, ensure_ascii=False, sort_keys=True).replace("'", "''") + "'::jsonb"


def q_text_array(values: list[str]) -> str:
    if not values:
        return "array[]::text[]"
    return "array[" + ", ".join(q(value) for value in values) + "]::text[]"


def clamp_confidence(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.5
    return max(0.0, min(1.0, number))


def segment_schema() -> dict:
    return {
        "name": "dnd_scribe_ai_candidates",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["summary", "classifications", "canon_candidates", "quote_candidates", "outtake_candidates"],
            "properties": {
                "summary": {"type": "string"},
                "classifications": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": [
                            "segment_id",
                            "segment_type",
                            "canon_relevance",
                            "confidence",
                            "needs_review",
                            "reason",
                            "tags",
                            "privacy",
                            "quote_candidate",
                            "canon_candidate",
                            "outtake_candidate",
                        ],
                        "properties": {
                            "segment_id": {"type": "string"},
                            "segment_type": {"type": "string", "enum": SEGMENT_TYPES},
                            "canon_relevance": {"type": "string", "enum": ["none", "low", "medium", "high"]},
                            "confidence": {"type": "number"},
                            "needs_review": {"type": "boolean"},
                            "reason": {"type": "string"},
                            "tags": {"type": "array", "items": {"type": "string"}},
                            "privacy": {"type": "string", "enum": ["party", "dm_only", "owner_dm", "shared", "private", "public_review"]},
                            "quote_candidate": {"type": "boolean"},
                            "canon_candidate": {"type": "boolean"},
                            "outtake_candidate": {"type": "boolean"},
                        },
                    },
                },
                "canon_candidates": {
                    "type": "array",
                    "items": candidate_schema(
                        {
                            "title": {"type": "string"},
                            "claim": {"type": "string"},
                            "candidate_type": {"type": "string"},
                            "entities": {"type": "array", "items": {"type": "string"}},
                            "who_knows_fiction": {"type": "array", "items": {"type": "string"}},
                            "visibility": {"type": "string"},
                        }
                    ),
                },
                "quote_candidates": {
                    "type": "array",
                    "items": candidate_schema(
                        {
                            "quote_text": {"type": "string"},
                            "character_name": {"type": "string"},
                            "speaker_name": {"type": "string"},
                            "context": {"type": "string"},
                            "visibility": {"type": "string"},
                        }
                    ),
                },
                "outtake_candidates": {
                    "type": "array",
                    "items": candidate_schema(
                        {
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "sensitivity_level": {
                                "type": "string",
                                "enum": ["normal", "needs_speaker_approval", "private", "sensitive"],
                            },
                        }
                    ),
                },
            },
        },
    }


def candidate_schema(extra: dict[str, Any]) -> dict:
    props = {
        "candidate_id": {"type": "string"},
        "confidence": {"type": "number"},
        "source_segment_ids": {"type": "array", "items": {"type": "string"}},
        "reason": {"type": "string"},
    }
    props.update(extra)
    return {
        "type": "object",
        "additionalProperties": False,
        "required": list(props.keys()),
        "properties": props,
    }


def build_prompt(master: dict) -> list[dict[str, str]]:
    segments = [
        {
            "id": item["id"],
            "start": item["timeline_start"],
            "end": item["timeline_end"],
            "speaker": item.get("speaker_name"),
            "speaker_role": item.get("speaker_role"),
            "character": item.get("character_name"),
            "track_key": item.get("track_key"),
            "text": item.get("text"),
        }
        for item in master.get("segments") or []
    ]
    system = (
        "Você é um arquivista de uma campanha longa de DnD. "
        "Seu trabalho é classificar trechos e propor candidatos revisáveis, não aprovar canon. "
        "Responda em pt-BR e somente JSON válido no schema solicitado."
    )
    rules = """
Regras obrigatórias:
1. Não invente evento, nome ou consequência.
2. Não transforme piada, especulação ou conversa técnica em canon.
3. Canon candidato precisa ser algo ficcional que aconteceu, foi revelado pelo DM/NPC, ou teve consequência mecânica/narrativa.
4. Falas marcantes podem ser em personagem ou fora de personagem, mas devem ser curtas e revisáveis.
5. Bastidor é sempre não canon e precisa revisão antes de publicar.
6. Se estiver ambíguo, use needs_review=true e confiança menor.
7. Use apenas source_segment_ids existentes.
8. Retorne uma classificação para todo segmento recebido.
9. Use candidate_id estável no formato canon_001, quote_001, outtake_001.
10. Candidatos devem ser atômicos: um fato, uma fala ou um bastidor por item.
11. Não crie candidato genérico como "a sessão trata de..." ou "vários bastidores".
12. Cada canon candidato deve usar no máximo 3 source_segment_ids, exceto se for inevitável.
13. Cada quote candidato deve apontar para a fala exata ou para o segmento que contém a fala.
14. Cada outtake candidato deve ser publicável/revisável individualmente; não agrupe muitos segmentos.
15. Se não houver candidato bom de uma categoria, retorne array vazio para essa categoria.
16. Escreva summary, title, claim, context, description e reason em português do Brasil.
"""
    user = {
        "session_id": master.get("session_id"),
        "summary": master.get("summary"),
        "segments": segments,
    }
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": rules + "\n\nTranscrição:\n" + json.dumps(user, ensure_ascii=False)},
    ]


def call_openai(values: dict[str, str], messages: list[dict[str, str]], model: str) -> tuple[dict, dict]:
    api_key = values.get("OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is missing")

    base_payload = {
        "model": model,
        "temperature": 0.1,
        "messages": messages,
    }
    payload = {
        **base_payload,
        "response_format": {"type": "json_schema", "json_schema": segment_schema()},
    }
    raw = post_chat_completion(api_key, payload)
    content = raw["choices"][0]["message"]["content"]
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        fallback_payload = {**base_payload, "response_format": {"type": "json_object"}}
        raw = post_chat_completion(api_key, fallback_payload)
        parsed = json.loads(raw["choices"][0]["message"]["content"])
    return parsed, raw


def post_chat_completion(api_key: str, payload: dict) -> dict:
    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        if "json_schema" in json.dumps(payload):
            fallback = dict(payload)
            fallback["response_format"] = {"type": "json_object"}
            with urllib.request.urlopen(
                urllib.request.Request(
                    "https://api.openai.com/v1/chat/completions",
                    data=json.dumps(fallback).encode("utf-8"),
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    method="POST",
                ),
                timeout=180,
            ) as response:
                return json.loads(response.read().decode("utf-8"))
        raise SystemExit(f"OpenAI API error status={exc.code} body={body[:500]}")


def normalize_result(result: dict, master: dict) -> dict:
    valid_ids = {item["id"] for item in master.get("segments") or []}
    by_id = {item["id"]: item for item in master.get("segments") or []}
    classifications = []
    seen = set()
    for item in result.get("classifications") or []:
        segment_id = item.get("segment_id")
        if segment_id not in valid_ids or segment_id in seen:
            continue
        seen.add(segment_id)
        classifications.append(
            {
                "segment_id": segment_id,
                "segment_type": item.get("segment_type") if item.get("segment_type") in SEGMENT_TYPES else "ooc_chatter",
                "canon_relevance": item.get("canon_relevance") if item.get("canon_relevance") in {"none", "low", "medium", "high"} else "none",
                "confidence": clamp_confidence(item.get("confidence")),
                "needs_review": bool(item.get("needs_review")),
                "reason": str(item.get("reason") or ""),
                "tags": [str(tag)[:40] for tag in item.get("tags") or []][:8],
                "privacy": str(item.get("privacy") or "party"),
                "quote_candidate": bool(item.get("quote_candidate")),
                "canon_candidate": bool(item.get("canon_candidate")),
                "outtake_candidate": bool(item.get("outtake_candidate")),
            }
        )
    for segment_id in sorted(valid_ids - seen):
        segment = by_id[segment_id]
        classifications.append(
            {
                "segment_id": segment_id,
                "segment_type": "ooc_chatter",
                "canon_relevance": "none",
                "confidence": 0.25,
                "needs_review": True,
                "reason": "Fallback local: a IA não retornou classificação para este segmento.",
                "tags": [],
                "privacy": "party",
                "quote_candidate": False,
                "canon_candidate": False,
                "outtake_candidate": False,
            }
        )
    classifications.sort(key=lambda item: int(item["segment_id"].split("_")[-1]))

    def valid_source_ids(values: list[str]) -> list[str]:
        return [value for value in values if value in valid_ids]

    normalized = {
        "summary": str(result.get("summary") or ""),
        "classifications": classifications,
        "canon_candidates": [],
        "quote_candidates": [],
        "outtake_candidates": [],
    }
    for index, item in enumerate(result.get("canon_candidates") or [], start=1):
        source_ids = valid_source_ids(item.get("source_segment_ids") or [])
        if not source_ids:
            continue
        normalized["canon_candidates"].append(
            {
                "candidate_id": item.get("candidate_id") or f"canon_{index:03d}",
                "title": str(item.get("title") or "Canon candidato")[:160],
                "claim": str(item.get("claim") or "")[:4000],
                "candidate_type": str(item.get("candidate_type") or "event")[:80],
                "confidence": clamp_confidence(item.get("confidence")),
                "source_segment_ids": source_ids,
                "entities": [str(value)[:120] for value in item.get("entities") or []],
                "who_knows_fiction": [str(value)[:120] for value in item.get("who_knows_fiction") or []],
                "visibility": str(item.get("visibility") or "review_only")[:80],
                "reason": str(item.get("reason") or "")[:2000],
            }
        )
    for index, item in enumerate(result.get("quote_candidates") or [], start=1):
        source_ids = valid_source_ids(item.get("source_segment_ids") or [])
        if not source_ids:
            continue
        normalized["quote_candidates"].append(
            {
                "candidate_id": item.get("candidate_id") or f"quote_{index:03d}",
                "quote_text": str(item.get("quote_text") or "")[:4000],
                "character_name": str(item.get("character_name") or "")[:160],
                "speaker_name": str(item.get("speaker_name") or "")[:160],
                "context": str(item.get("context") or "")[:2000],
                "visibility": str(item.get("visibility") or "review_only")[:80],
                "confidence": clamp_confidence(item.get("confidence")),
                "source_segment_ids": source_ids,
                "reason": str(item.get("reason") or "")[:2000],
            }
        )
    for index, item in enumerate(result.get("outtake_candidates") or [], start=1):
        source_ids = valid_source_ids(item.get("source_segment_ids") or [])
        if not source_ids:
            continue
        normalized["outtake_candidates"].append(
            {
                "candidate_id": item.get("candidate_id") or f"outtake_{index:03d}",
                "title": str(item.get("title") or "Bastidor candidato")[:160],
                "description": str(item.get("description") or "")[:4000],
                "sensitivity_level": item.get("sensitivity_level")
                if item.get("sensitivity_level") in {"normal", "needs_speaker_approval", "private", "sensitive"}
                else "needs_speaker_approval",
                "confidence": clamp_confidence(item.get("confidence")),
                "source_segment_ids": source_ids,
                "reason": str(item.get("reason") or "")[:2000],
            }
        )
    return normalized


def segment_bounds(master: dict, source_ids: list[str]) -> tuple[int | None, int | None]:
    segments = [item for item in master.get("segments") or [] if item["id"] in set(source_ids)]
    if not segments:
        return None, None
    return min(int(item.get("timeline_start_ms") or 0) for item in segments), max(int(item.get("timeline_end_ms") or 0) for item in segments)


def source_segment_array(source_ids: list[str]) -> str:
    if not source_ids:
        return "array[]::uuid[]"
    source_array = q_text_array(source_ids)
    return f"array(select ts.id from transcript_segments ts where ts.session_id = s.id and ts.source_segment_id = any({source_array}))"


def build_db_sql(
    result: dict,
    master: dict,
    *,
    campaign_slug: str,
    source_session_id: str,
    source_run_id: str,
    model: str,
    prompt_version: str,
    raw_path: str,
    normalized_path: str,
) -> str:
    session_cte = (
        "with target_session as ("
        "select s.id from sessions s join campaigns c on c.id = s.campaign_id "
        f"where c.slug = {q(campaign_slug)} and s.source_session_id = {q(source_session_id)}"
        ")"
    )
    lines = [
        "begin;",
        f"{session_cte} delete from segment_classifications sc using transcript_segments ts, target_session s where sc.segment_id = ts.id and ts.session_id = s.id and sc.source_run_id = {q(source_run_id)};",
        f"{session_cte} delete from canon_candidates cc using target_session s where cc.session_id = s.id and cc.source_run_id = {q(source_run_id)};",
        f"{session_cte} delete from quote_candidates qc using target_session s where qc.session_id = s.id and qc.source_run_id = {q(source_run_id)};",
        f"{session_cte} delete from outtake_candidates oc using target_session s where oc.session_id = s.id and oc.source_run_id = {q(source_run_id)};",
    ]

    for item in result["classifications"]:
        row_id = stable_uuid("segment_classification", source_session_id, source_run_id, item["segment_id"])
        lines.append(
            f"""
{session_cte}
insert into segment_classifications (
  id, segment_id, segment_type, canon_relevance, confidence, needs_review, reason,
  model, prompt_version, source_run_id, raw_output, metadata
)
select
  {q(row_id, "uuid")},
  ts.id,
  {q(item["segment_type"])},
  {q(item["canon_relevance"])},
  {q(item["confidence"])},
  {q(item["needs_review"])},
  {q(item["reason"])},
  {q(model)},
  {q(prompt_version)},
  {q(source_run_id)},
  {q_json(item)},
  {q_json({"tags": item["tags"], "privacy": item["privacy"], "candidate_flags": {"quote": item["quote_candidate"], "canon": item["canon_candidate"], "outtake": item["outtake_candidate"]}})}
from transcript_segments ts
join target_session s on s.id = ts.session_id
where ts.source_segment_id = {q(item["segment_id"])};
""".strip()
        )

    for item in result["canon_candidates"]:
        row_id = stable_uuid("canon_candidate", source_session_id, source_run_id, item["candidate_id"])
        lines.append(
            f"""
{session_cte}
insert into canon_candidates (
  id, session_id, title, claim, candidate_type, status, confidence, source_segment_ids,
  reviewer_notes, source_system, source_run_id, source_candidate_id, metadata
)
select
  {q(row_id, "uuid")},
  s.id,
  {q(item["title"])},
  {q(item["claim"])},
  {q(item["candidate_type"])},
  'candidate',
  {q(item["confidence"])},
  {source_segment_array(item["source_segment_ids"])},
  {q(item["reason"])},
  'openai',
  {q(source_run_id)},
  {q(item["candidate_id"])},
  {q_json({"entities": item["entities"], "who_knows_fiction": item["who_knows_fiction"], "visibility": item["visibility"], "source_segment_ids": item["source_segment_ids"]})}
from target_session s;
""".strip()
        )

    for item in result["quote_candidates"]:
        row_id = stable_uuid("quote_candidate", source_session_id, source_run_id, item["candidate_id"])
        lines.append(
            f"""
{session_cte}
insert into quote_candidates (
  id, session_id, quote_text, character_name, context, status, approved_for_public,
  source_segment_ids, source_system, source_run_id, source_candidate_id, metadata
)
select
  {q(row_id, "uuid")},
  s.id,
  {q(item["quote_text"])},
  {q(item["character_name"])},
  {q(item["context"])},
  'candidate',
  false,
  {source_segment_array(item["source_segment_ids"])},
  'openai',
  {q(source_run_id)},
  {q(item["candidate_id"])},
  {q_json({"speaker_name": item["speaker_name"], "visibility": item["visibility"], "reason": item["reason"], "confidence": item["confidence"], "source_segment_ids": item["source_segment_ids"]})}
from target_session s;
""".strip()
        )

    for item in result["outtake_candidates"]:
        row_id = stable_uuid("outtake_candidate", source_session_id, source_run_id, item["candidate_id"])
        start_ms, end_ms = segment_bounds(master, item["source_segment_ids"])
        lines.append(
            f"""
{session_cte}
insert into outtake_candidates (
  id, session_id, title, description, start_ms, end_ms, sensitivity_level, status,
  source_segment_ids, source_system, source_run_id, source_candidate_id, metadata
)
select
  {q(row_id, "uuid")},
  s.id,
  {q(item["title"])},
  {q(item["description"])},
  {q(start_ms)},
  {q(end_ms)},
  {q(item["sensitivity_level"])},
  'candidate',
  {source_segment_array(item["source_segment_ids"])},
  'openai',
  {q(source_run_id)},
  {q(item["candidate_id"])},
  {q_json({"reason": item["reason"], "confidence": item["confidence"], "source_segment_ids": item["source_segment_ids"]})}
from target_session s;
""".strip()
        )

    output = {
        "source_run_id": source_run_id,
        "prompt_version": prompt_version,
        "model": model,
        "raw_path": raw_path,
        "normalized_path": normalized_path,
        "classifications": len(result["classifications"]),
        "canon_candidates": len(result["canon_candidates"]),
        "quote_candidates": len(result["quote_candidates"]),
        "outtake_candidates": len(result["outtake_candidates"]),
    }
    job_id = stable_uuid("processing_job", source_session_id, source_run_id)
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
  'ai_classification_candidates',
  'succeeded',
  1,
  {q_json({"source_run_id": source_run_id, "prompt_version": prompt_version})},
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
    parser.add_argument("session_dir", type=Path)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--campaign-slug", default="yuhara-main")
    parser.add_argument("--source-session-id")
    parser.add_argument("--model")
    parser.add_argument("--prompt-version", default=PROMPT_VERSION)
    parser.add_argument("--source-run-id")
    parser.add_argument("--update-db", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    master_path = args.session_dir / "transcripts" / "transcript_master.json"
    if not master_path.exists():
        raise SystemExit(f"transcript_master.json not found: {master_path}")
    master = read_json(master_path)
    source_session_id = args.source_session_id or master["session_id"]

    values = load_env(args.env_file)
    model = args.model or values.get("OPENAI_TEXT_MODEL") or "gpt-4o"
    source_run_id = args.source_run_id or f"{args.prompt_version}_{model.replace('/', '_').replace(':', '_')}"
    out_dir = args.session_dir / "ai" / source_run_id
    raw_path = out_dir / "openai_raw_response.json"
    normalized_path = out_dir / "classification_candidates.json"
    prompt_path = out_dir / "prompt_payload.json"

    messages = build_prompt(master)
    prompt_payload = {
        "prompt_version": args.prompt_version,
        "model": model,
        "source_run_id": source_run_id,
        "messages": messages,
    }
    write_json(prompt_path, prompt_payload)

    if args.dry_run:
        print(f"prompt={prompt_path}")
        print(f"segments={len(master.get('segments') or [])}")
        print(f"model={model}")
        print(f"source_run_id={source_run_id}")
        return 0

    result, raw = call_openai(values, messages, model)
    normalized = normalize_result(result, master)
    write_json(raw_path, raw)
    write_json(normalized_path, normalized)

    print(f"raw={raw_path}")
    print(f"normalized={normalized_path}")
    print(f"classifications={len(normalized['classifications'])}")
    print(f"canon_candidates={len(normalized['canon_candidates'])}")
    print(f"quote_candidates={len(normalized['quote_candidates'])}")
    print(f"outtake_candidates={len(normalized['outtake_candidates'])}")

    if args.update_db:
        database_url = values.get("DATABASE_URL")
        if not database_url:
            raise SystemExit(f"DATABASE_URL not found in {args.env_file}")
        sql = build_db_sql(
            normalized,
            master,
            campaign_slug=args.campaign_slug,
            source_session_id=source_session_id,
            source_run_id=source_run_id,
            model=model,
            prompt_version=args.prompt_version,
            raw_path=str(raw_path),
            normalized_path=str(normalized_path),
        )
        apply_db_update(database_url, sql)
        print("db_updated=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
