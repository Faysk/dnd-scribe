#!/usr/bin/env python3
"""Parse Roll20 [DND_EVENT] exports and import them into Supabase."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import re
import subprocess
from pathlib import Path
from typing import Any


EVENT_RE = re.compile(r"\[DND_EVENT\]\s*(\{.*\})")


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


def parse_time_ms(value: Any) -> int | None:
    if not value:
        return None
    text = str(value).strip()
    match = re.match(r"^(?:(\d+):)?(\d{1,2}):(\d{2})$", text)
    if not match:
        return None
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2))
    seconds = int(match.group(3))
    return ((hours * 60 + minutes) * 60 + seconds) * 1000


def normalize_timestamp(value: Any) -> str | None:
    if value in {None, ""}:
        return None
    if isinstance(value, (int, float)):
        seconds = float(value) / 1000 if value > 10_000_000_000 else float(value)
        return dt.datetime.fromtimestamp(seconds, dt.UTC).isoformat()
    text = str(value).strip()
    if text.isdigit():
        seconds = float(text) / 1000 if len(text) > 10 else float(text)
        return dt.datetime.fromtimestamp(seconds, dt.UTC).isoformat()
    return text


def source_event_id(event: dict[str, Any], raw_line: str) -> str:
    if event.get("source_event_id"):
        return str(event["source_event_id"])
    if event.get("session_id") and event.get("n") is not None:
        return f"{event['session_id']}:{event['n']}"
    digest = hashlib.sha1(raw_line.encode("utf-8")).hexdigest()[:16]
    return f"roll20:{digest}"


def normalize_event(event: dict[str, Any], raw_line: str) -> dict[str, Any]:
    payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
    text = event.get("content") or payload.get("text") or event.get("payload") or ""
    event_type = event.get("type") or event.get("command") or "note"
    character_name = payload.get("character") or payload.get("character_name")
    if not character_name and event_type in {"quote_marker", "quote"} and isinstance(text, str) and ":" in text:
        character_name = text.split(":", 1)[0].strip()
    approx_start_ms = parse_time_ms(payload.get("t") or payload.get("time") or event.get("t"))
    return {
        "source_event_id": source_event_id(event, raw_line),
        "event_type": str(event_type),
        "roll20_who": event.get("who") or event.get("roll20_who"),
        "character_name": character_name,
        "approx_start_ms": approx_start_ms,
        "text": str(text or ""),
        "payload": event,
        "raw_line": raw_line.strip(),
        "created_at_roll20": normalize_timestamp(event.get("created_at_roll20") or event.get("timestamp")),
    }


def extract_events(path: Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = html.unescape(raw)
        match = EVENT_RE.search(line)
        if not match:
            continue
        try:
            parsed = json.loads(match.group(1))
        except json.JSONDecodeError:
            continue
        events.append(normalize_event(parsed, line))
    return events


def build_sql(campaign_slug: str, source_session_id: str, events: list[dict[str, Any]]) -> str:
    lines = [
        "begin;",
        "set local lock_timeout = '10s';",
        "set local statement_timeout = '120s';",
        "do $$ begin",
        "  if not exists (",
        "    select 1 from sessions s join campaigns c on c.id = s.campaign_id",
        f"    where c.slug = {q(campaign_slug)} and s.source_session_id = {q(source_session_id)}",
        "  ) then",
        "    raise exception 'session not found';",
        "  end if;",
        "end $$;",
    ]
    for event in events:
        lines.append(
            """
insert into roll20_events (
  id, session_id, event_type, roll20_who, character_name, approx_start_ms, text,
  payload, raw_line, source_system, source_event_id, created_at_roll20, created_at
)
select gen_random_uuid(), t.session_id, {event_type}, {roll20_who}, {character_name}, {approx_start_ms}, {text},
       {payload}, {raw_line}, 'roll20', {source_event_id}, {created_at_roll20}, now()
from (
  select s.id session_id
  from sessions s join campaigns c on c.id = s.campaign_id
  where c.slug = {campaign_slug} and s.source_session_id = {source_session_id}
) t
on conflict (session_id, source_system, source_event_id)
where source_system is not null and source_event_id is not null
do update set
  event_type = excluded.event_type,
  roll20_who = excluded.roll20_who,
  character_name = excluded.character_name,
  approx_start_ms = excluded.approx_start_ms,
  text = excluded.text,
  payload = excluded.payload,
  raw_line = excluded.raw_line,
  created_at_roll20 = excluded.created_at_roll20;
""".format(
                campaign_slug=q(campaign_slug),
                source_session_id=q(source_session_id),
                event_type=q(event["event_type"]),
                roll20_who=q(event["roll20_who"]),
                character_name=q(event["character_name"]),
                approx_start_ms="null" if event["approx_start_ms"] is None else str(event["approx_start_ms"]),
                text=q(event["text"]),
                payload=q_json(event["payload"]),
                raw_line=q(event["raw_line"]),
                source_event_id=q(event["source_event_id"]),
                created_at_roll20=q(event["created_at_roll20"], "timestamptz") if event["created_at_roll20"] else "null",
            )
        )
    lines.append("commit;")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--campaign-slug", default="yuhara-main")
    parser.add_argument("--source-session-id", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    events = extract_events(args.input)
    print(f"events={len(events)}")
    if events:
        print(f"first_event_type={events[0]['event_type']}")
    if args.dry_run:
        print(json.dumps(events, ensure_ascii=False, indent=2))
        return 0

    values = load_env(args.env_file)
    database_url = values.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")
    sql = build_sql(args.campaign_slug, args.source_session_id, events)
    subprocess.check_call(["psql", database_url, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql])
    print("imported=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
