#!/usr/bin/env python3
"""Serve the local DnD Scribe web app with safe server-side Supabase access."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import mimetypes
import re
import subprocess
import sys
import uuid
from email.parser import BytesParser
from email.policy import default as email_policy
from time import monotonic
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock, Thread
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

from apply_review_decisions import apply_db_update as apply_decision_sql
from apply_review_decisions import build_sql as build_decision_sql
from apply_review_decisions import resolve_context as resolve_decision_context
from build_session_publications import apply_db_update as apply_publication_sql
from build_session_publications import build_db_sql as build_publication_sql
from build_session_publications import fetch_publication_context, write_outputs
from create_r2_presigned_url import create_url as create_r2_signed_url
from export_review_board_data import build_payload as build_review_payload
from export_review_decision_template import build_payload as build_decision_template


ROOT = Path(__file__).resolve().parents[1]
WEB_ROOT = ROOT / "web"
DEFAULT_CAMPAIGN = "yuhara-main"
DEFAULT_SOURCE_SESSION = "craig-AdabEqbzngmT-stage1-full"
DEFAULT_RUN = "classify_candidates_v2_gpt-4o"
DEFAULT_ACTOR = "renanyuhara"
SESSION_CACHE_SECONDS = 60
SESSION_LIST_CACHE_SECONDS = 15
SESSION_STATUSES = {
    "planned",
    "recording",
    "uploaded",
    "processing",
    "ready_for_review",
    "reviewing",
    "approved",
    "published",
    "archived",
    "failed",
}


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


def sql_optional(value: str | None, cast: str | None = None) -> str:
    if value is None:
        return "null"
    literal = sql_literal(value)
    return f"{literal}::{cast}" if cast else literal


def sql_json(value: Any) -> str:
    return sql_literal(json.dumps(value, ensure_ascii=False, sort_keys=True)) + "::jsonb"


def clean_text(value: Any, max_len: int = 500) -> str:
    text = str(value or "").strip()
    return text[:max_len] if text else ""


def slugify(value: Any) -> str:
    text = clean_text(value, 120).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")[:80]
    return text or "sessao"


def normalize_date(value: Any) -> str | None:
    text = clean_text(value, 20)
    if not text:
        return None
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        raise ValueError("sessionDate precisa estar em YYYY-MM-DD.")
    return text


def normalize_status(value: Any, fallback: str = "planned") -> str:
    status = clean_text(value or fallback, 40)
    if status not in SESSION_STATUSES:
        raise ValueError(f"status invalido: {status}")
    return status


def generated_source_session_id(title: str, session_date: str | None) -> str:
    date = session_date or dt.datetime.now(dt.UTC).date().isoformat()
    stamp = dt.datetime.now(dt.UTC).strftime("%H%M%S")
    return f"manual-{date}-{slugify(title)}-{stamp}"


def safe_filename(value: str) -> str:
    name = Path(value or "craig.zip").name
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-")
    return name or "craig.zip"


def truthy(value: Any) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on", "sim"}


def parse_key_values(text: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or "=" not in line:
            continue
        key, value = line.split("=", 1)
        result[key.strip()] = value.strip()
    return result


def run_json(database_url: str, sql: str) -> Any:
    output = subprocess.check_output(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
        text=True,
        encoding="utf-8",
    )
    text = output.strip()
    return json.loads(text) if text else None


def auth_public_config(env: dict[str, str]) -> dict[str, str]:
    return {
        "supabaseUrl": env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL") or "",
        "publishableKey": env.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
        or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        or env.get("SUPABASE_PUBLISHABLE_KEY")
        or env.get("SUPABASE_ANON_KEY")
        or "",
    }


def bearer_token(auth_header: str | None) -> str:
    value = auth_header or ""
    if not value.lower().startswith("bearer "):
        return ""
    return value[7:].strip()


def auth_name(user: dict[str, Any]) -> str:
    metadata = user.get("user_metadata") or {}
    return metadata.get("full_name") or metadata.get("name") or user.get("email") or "Usuario Google"


def auth_avatar(user: dict[str, Any]) -> str | None:
    metadata = user.get("user_metadata") or {}
    return metadata.get("avatar_url") or metadata.get("picture")


def capabilities_for_role(role: str | None) -> dict[str, Any]:
    is_dm = role in {"owner", "master"}
    return {
        "openTestMode": True,
        "canReadCampaign": bool(role),
        "canReviewOwnMaterial": bool(role),
        "canReviewTableMaterial": role in {"owner", "master", "reviewer"},
        "canApproveCanon": is_dm,
        "canManageCampaign": is_dm,
    }


def verify_supabase_user(env: dict[str, str], token: str) -> dict[str, Any]:
    config = auth_public_config(env)
    if not config["supabaseUrl"] or not config["publishableKey"]:
        raise RuntimeError("Supabase auth config publica ausente.")
    request = Request(
        config["supabaseUrl"].rstrip("/") + "/auth/v1/user",
        headers={
            "apikey": config["publishableKey"],
            "Authorization": f"Bearer {token}",
        },
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code in {401, 403}:
            raise PermissionError("Sessao Google invalida ou expirada.") from exc
        raise RuntimeError(f"Falha ao validar sessao Google ({exc.code}).") from exc
    except URLError as exc:
        raise RuntimeError("Nao foi possivel chamar o Supabase Auth.") from exc


def sync_auth_profile(database_url: str, user: dict[str, Any]) -> None:
    user_id = user.get("id")
    if not user_id:
        return
    email = user.get("email")
    avatar = auth_avatar(user)
    sql = f"""
update profiles
set email = coalesce({sql_literal(email) if email else 'null'}, email),
    avatar_url = coalesce({sql_literal(avatar) if avatar else 'null'}, avatar_url),
    last_sign_in_at = now()
where auth_user_id = {sql_literal(user_id)}::uuid;
"""
    subprocess.check_call(["psql", database_url, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql])


def linked_profile_for_user(database_url: str, user_id: str, campaign_slug: str) -> dict[str, Any]:
    user_q = sql_literal(user_id)
    campaign_q = sql_literal(campaign_slug)
    sql = f"""
with selected_profile as (
  select p.id, p.display_name, p.roll20_name, p.default_character_name, p.avatar_url, p.last_sign_in_at
  from profiles p
  where p.auth_user_id = {user_q}::uuid
  limit 1
),
memberships as (
  select c.slug campaign_slug, c.name campaign_name, cm.role
  from selected_profile p
  join campaign_members cm on cm.profile_id = p.id
  join campaigns c on c.id = cm.campaign_id
)
select json_build_object(
  'profile', (
    select json_build_object(
      'id', id,
      'displayName', display_name,
      'roll20Name', roll20_name,
      'defaultCharacterName', default_character_name,
      'avatarUrl', avatar_url,
      'lastSignInAt', last_sign_in_at
    )
    from selected_profile
  ),
  'memberships', coalesce((
    select json_agg(json_build_object(
      'campaignSlug', campaign_slug,
      'campaignName', campaign_name,
      'role', role
    ) order by campaign_slug)
    from memberships
  ), '[]'::json),
  'campaignRole', (
    select role from memberships where campaign_slug = {campaign_q} limit 1
  )
);
"""
    return run_json(database_url, sql) or {"profile": None, "memberships": [], "campaignRole": None}


def auth_me_payload(database_url: str, env: dict[str, str], auth_header: str | None, campaign_slug: str) -> dict[str, Any]:
    token = bearer_token(auth_header)
    if not token:
        return {
            "ok": True,
            "mode": "open_test",
            "authenticated": False,
            "user": None,
            "profile": None,
            "memberships": [],
            "campaignRole": None,
            "capabilities": capabilities_for_role(None),
            "note": "API aberta para testes; login Google e opcional nesta fase.",
        }
    user = verify_supabase_user(env, token)
    sync_auth_profile(database_url, user)
    linked = linked_profile_for_user(database_url, user["id"], campaign_slug)
    role = linked.get("campaignRole")
    return {
        "ok": True,
        "mode": "open_test",
        "authenticated": True,
        "user": {
            "id": user.get("id"),
            "displayName": auth_name(user),
            "avatarUrl": auth_avatar(user),
        },
        "profile": linked.get("profile"),
        "memberships": linked.get("memberships") or [],
        "campaignRole": role,
        "capabilities": capabilities_for_role(role),
        "note": "Perfil autenticado; as rotas continuam abertas temporariamente para teste.",
    }


def audio_url_payload(
    database_url: str,
    env: dict[str, str],
    campaign_slug: str,
    source_session_id: str,
    track_key: str,
    expires_raw: str | None,
) -> dict[str, Any]:
    normalized_track_key = (track_key or "").strip()
    if not normalized_track_key:
        raise ValueError("trackKey obrigatorio.")
    expires = max(60, min(3600, int(expires_raw or "900")))
    source_file_role = normalized_track_key if normalized_track_key.startswith("craig_track_") else f"craig_track_{normalized_track_key}"
    campaign_q = sql_literal(campaign_slug)
    session_q = sql_literal(source_session_id)
    role_q = sql_literal(source_file_role)
    sql = f"""
with target as (
  select s.id session_id
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = {campaign_q} and s.source_session_id = {session_q}
)
select row_to_json(file_row) from (
  select rf.id, rf.source_file_role, rf.storage_bucket, rf.storage_path, rf.original_filename,
         rf.mime_type, rf.size_bytes, rf.duration_ms
  from recording_files rf
  join target t on t.session_id = rf.session_id
  where rf.source_file_role = {role_q}
    and rf.file_type = 'craig_track'
    and rf.storage_path is not null
  limit 1
) file_row;
"""
    file = run_json(database_url, sql)
    if not file:
        raise FileNotFoundError(f"Audio nao encontrado para trackKey {normalized_track_key}.")
    return {
        "ok": True,
        "trackKey": normalized_track_key.removeprefix("craig_track_"),
        "sourceFileRole": file["source_file_role"],
        "expiresSeconds": expires,
        "file": {
            "originalFilename": file.get("original_filename"),
            "mimeType": file.get("mime_type") or "audio/flac",
            "sizeBytes": file.get("size_bytes"),
            "durationMs": file.get("duration_ms"),
        },
        "url": create_r2_signed_url({**env, "R2_BUCKET": file.get("storage_bucket") or env.get("R2_BUCKET", "")}, file["storage_path"], expires),
    }


def response_summary(database_url: str, campaign_slug: str, source_session_id: str, source_run_id: str) -> dict[str, Any]:
    campaign_q = sql_literal(campaign_slug)
    session_q = sql_literal(source_session_id)
    run_q = sql_literal(source_run_id)
    sql = f"""
with target as (
  select s.id session_id
  from sessions s join campaigns c on c.id = s.campaign_id
  where c.slug = {campaign_q} and s.source_session_id = {session_q}
),
publication_rows as (
  select visibility, status, count(*) count from publications p join target t on t.session_id = p.session_id
  where p.source_run_id = {run_q}
  group by visibility, status
)
select json_build_object(
  'reviewDecisions', (
    select count(*) from review_decisions rd join target t on t.session_id = rd.session_id
    where rd.source_run_id = {run_q}
  ),
  'canonApproved', (
    select count(*) from canon_candidates cc join target t on t.session_id = cc.session_id
    where cc.source_run_id = {run_q} and cc.status = 'approved_canon'
  ),
  'quoteApproved', (
    select count(*) from quote_candidates qc join target t on t.session_id = qc.session_id
    where qc.source_run_id = {run_q} and qc.status = 'approved'
  ),
  'outtakeApprovedAll', (
    select count(*) from outtake_candidates oc join target t on t.session_id = oc.session_id
    where oc.source_run_id = {run_q} and oc.status = 'approved_by_all'
  ),
  'approvedPublications', (
    select count(*) from publications p join target t on t.session_id = p.session_id
    where p.source_run_id = {run_q} and p.visibility <> 'review_only'
  ),
  'publications', coalesce((
    select json_agg(json_build_object('visibility', visibility, 'status', status, 'count', count) order by visibility, status)
    from publication_rows
  ), '[]'::json)
) from target;
"""
    return run_json(database_url, sql) or {}


def list_sessions(database_url: str, campaign_slug: str, source_run_id: str) -> list[dict[str, Any]]:
    campaign_q = sql_literal(campaign_slug)
    run_q = sql_literal(source_run_id)
    sql = f"""
select coalesce(json_agg(item order by item->>'sessionDate' desc nulls last, item->>'sourceSessionId'), '[]'::json) from (
  select json_build_object(
    'id', s.id,
    'title', s.title,
    'sourceSessionId', s.source_session_id,
    'sourceSystem', s.source_system,
    'sessionDate', s.session_date,
    'startedAt', s.started_at,
    'arc', s.arc,
    'status', s.status,
    'durationMs', s.duration_ms,
    'summary', s.summary_short,
    'createdAt', s.created_at,
    'updatedAt', s.updated_at,
    'segments', (select count(*) from transcript_segments ts where ts.session_id = s.id and ts.is_empty = false),
    'participants', (select count(*) from participants p where p.session_id = s.id),
    'recordingFiles', (select count(*) from recording_files rf where rf.session_id = s.id),
    'aiCandidates', (
      (select count(*) from canon_candidates cc where cc.session_id = s.id and cc.source_run_id = {run_q}) +
      (select count(*) from quote_candidates qc where qc.session_id = s.id and qc.source_run_id = {run_q}) +
      (select count(*) from outtake_candidates oc where oc.session_id = s.id and oc.source_run_id = {run_q})
    ),
    'reviewDecisions', (select count(*) from review_decisions rd where rd.session_id = s.id and rd.source_run_id = {run_q}),
    'publications', (select count(*) from publications p where p.session_id = s.id and p.source_run_id = {run_q}),
    'approvedPublications', (
      select count(*) from publications p
      where p.session_id = s.id and p.source_run_id = {run_q} and p.visibility <> 'review_only'
    )
  ) item
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = {campaign_q}
) rows;
"""
    return run_json(database_url, sql) or []


def session_response(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id"),
        "title": row.get("title"),
        "sourceSessionId": row.get("source_session_id"),
        "sourceSystem": row.get("source_system"),
        "sessionDate": row.get("session_date"),
        "startedAt": row.get("started_at"),
        "arc": row.get("arc"),
        "status": row.get("status"),
        "durationMs": row.get("duration_ms"),
        "summary": row.get("summary_short"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def create_session(database_url: str, campaign_slug: str, raw: dict[str, Any]) -> dict[str, Any]:
    title = clean_text(raw.get("title"), 180)
    if not title:
        raise ValueError("title obrigatorio.")
    session_date = normalize_date(raw.get("sessionDate") or raw.get("session_date"))
    status = normalize_status(raw.get("status"), "planned")
    arc = clean_text(raw.get("arc"), 120) or None
    summary = clean_text(raw.get("summary") or raw.get("summaryShort") or raw.get("summary_short"), 2000) or None
    requested_source_id = clean_text(raw.get("sourceSessionId") or raw.get("source_session_id"), 180)
    source_session_id = slugify(requested_source_id) if requested_source_id else generated_source_session_id(title, session_date)
    slug = slugify(f"{session_date or 'sem-data'}-{title}")
    metadata = {
        "created_by": "local_frontend",
        "created_from": "session_manager",
        "open_test_mode": True,
    }
    sql = f"""
with campaign_row as (
  select id from campaigns where slug = {sql_literal(campaign_slug)}
), inserted as (
  insert into sessions (
    id, campaign_id, title, slug, session_date, arc, status, summary_short,
    source_system, source_session_id, metadata, created_at, updated_at
  )
  select gen_random_uuid(), campaign_row.id, {sql_literal(title)}, {sql_literal(slug)},
         {sql_optional(session_date, 'date')}, {sql_optional(arc)}, {sql_literal(status)},
         {sql_optional(summary)}, 'manual', {sql_literal(source_session_id)}, {sql_json(metadata)}, now(), now()
  from campaign_row
  returning *
)
select row_to_json(inserted) from inserted;
"""
    row = run_json(database_url, sql)
    if not row:
        raise FileNotFoundError(f"Campanha nao encontrada: {campaign_slug}")
    return session_response(row)


def update_session(database_url: str, campaign_slug: str, source_session_id: str, raw: dict[str, Any]) -> dict[str, Any]:
    source_id = clean_text(source_session_id or raw.get("sourceSessionId") or raw.get("source_session_id"), 180)
    if not source_id:
        raise ValueError("sourceSessionId obrigatorio.")
    title = clean_text(raw.get("title"), 180)
    if not title:
        raise ValueError("title obrigatorio.")
    session_date = normalize_date(raw.get("sessionDate") or raw.get("session_date"))
    status = normalize_status(raw.get("status"), "planned")
    arc = clean_text(raw.get("arc"), 120) or None
    summary = clean_text(raw.get("summary") or raw.get("summaryShort") or raw.get("summary_short"), 2000) or None
    metadata = {
        "updated_by": "local_frontend",
        "updated_from": "session_manager",
        "open_test_mode": True,
    }
    sql = f"""
update sessions s
set title = {sql_literal(title)},
    session_date = {sql_optional(session_date, 'date')},
    arc = {sql_optional(arc)},
    status = {sql_literal(status)},
    summary_short = {sql_optional(summary)},
    metadata = coalesce(s.metadata, '{{}}'::jsonb) || {sql_json(metadata)},
    updated_at = now()
from campaigns c
where c.id = s.campaign_id
  and c.slug = {sql_literal(campaign_slug)}
  and s.source_session_id = {sql_literal(source_id)}
returning row_to_json(s);
"""
    row = run_json(database_url, sql)
    if not row:
        raise FileNotFoundError(f"Sessao nao encontrada: {source_id}")
    return session_response(row)


def craig_map_path() -> Path:
    return ROOT / "config" / "craig_user_map.json"


def load_craig_map() -> dict[str, Any]:
    path = craig_map_path()
    if not path.exists():
        return {
            "version": 1,
            "notes": "Mapeamento Craig/Discord.",
            "tracks": {},
            "rules": {
                "allow_multiple_characters_per_person": True,
                "allow_guest_tracks": True,
                "unknown_track_policy": "import_as_guest_pending_review",
                "dm_has_full_lore_access": True,
            },
        }
    return json.loads(path.read_text(encoding="utf-8"))


def save_craig_map(data: dict[str, Any]) -> None:
    path = craig_map_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%SZ")
        backup = path.with_suffix(f".backup-{stamp}.json")
        backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_craig_track(raw: dict[str, Any]) -> dict[str, Any]:
    raw_track_key = clean_text(raw.get("trackKey") or raw.get("track_key"), 120)
    if not raw_track_key:
        raise ValueError("trackKey obrigatorio.")
    track_key = slugify(raw_track_key)
    aliases_raw = raw.get("characterAliases") or raw.get("character_aliases") or []
    if isinstance(aliases_raw, str):
        aliases = [item.strip() for item in aliases_raw.split(",") if item.strip()]
    else:
        aliases = [str(item).strip() for item in aliases_raw if str(item).strip()]
    role = clean_text(raw.get("role"), 40) or "guest"
    status = clean_text(raw.get("status"), 40) or "guest_or_unknown"
    data = load_craig_map()
    data.setdefault("tracks", {})[track_key] = {
        "person_name": clean_text(raw.get("personName") or raw.get("person_name"), 120) or track_key,
        "default_character": clean_text(raw.get("defaultCharacter") or raw.get("default_character"), 120) or "Convidado / indefinido",
        "role": role,
        "status": status,
        "character_aliases": aliases,
    }
    save_craig_map(data)
    return data


def run_craig_ingest(
    upload_path: Path,
    source_session_id: str,
    chunk_seconds: int,
    sample_seconds_raw: str,
    skip_chunks: bool,
) -> dict[str, Any]:
    cmd = [
        sys.executable,
        str(ROOT / "tools" / "ingest_craig_session.py"),
        str(upload_path),
        "--out-root",
        str(ROOT / "tmp" / "sessions"),
        "--map-file",
        str(ROOT / "config" / "craig_user_map.json"),
        "--chunk-seconds",
        str(chunk_seconds),
    ]
    if source_session_id:
        cmd.extend(["--session-id", source_session_id])
    if sample_seconds_raw:
        cmd.extend(["--sample-seconds", sample_seconds_raw])
    if skip_chunks:
        cmd.append("--skip-chunks")

    proc = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, timeout=3600)
    output = (proc.stdout or "") + (proc.stderr or "")
    details = parse_key_values(output)
    if proc.returncode != 0:
        raise RuntimeError(output[-4000:] or "Falha na ingestao Craig.")
    return {
        "sessionDir": details.get("session_dir"),
        "tracks": int(details.get("tracks", "0") or 0),
        "participants": int(details.get("participants", "0") or 0),
        "chunks": int(details.get("chunks", "0") or 0),
        "manifest": details.get("manifest"),
        "participantsFile": details.get("participants_file"),
        "skipChunks": skip_chunks,
        "chunkSeconds": chunk_seconds,
        "logTail": output[-4000:],
    }


class AppServer(ThreadingHTTPServer):
    def __init__(self, server_address: tuple[str, int], handler_class: type[BaseHTTPRequestHandler], env_file: Path):
        super().__init__(server_address, handler_class)
        self.env_file = env_file
        self.cache: dict[tuple[str, ...], tuple[float, Any]] = {}
        self.cache_lock = Lock()
        self.jobs: dict[str, dict[str, Any]] = {}
        self.jobs_lock = Lock()
        self.jobs_dir = ROOT / "tmp" / "jobs"
        self.jobs_dir.mkdir(parents=True, exist_ok=True)
        self.load_jobs()
        values = load_env(env_file)
        self.database_url = values.get("DATABASE_URL")
        if not self.database_url:
            raise SystemExit(f"DATABASE_URL not found in {env_file}")

    def cache_get(self, key: tuple[str, ...]) -> Any | None:
        with self.cache_lock:
            item = self.cache.get(key)
            if not item:
                return None
            expires_at, value = item
            if expires_at <= monotonic():
                self.cache.pop(key, None)
                return None
            return value

    def cache_set(self, key: tuple[str, ...], value: Any, ttl_seconds: int) -> None:
        with self.cache_lock:
            self.cache[key] = (monotonic() + ttl_seconds, value)

    def cache_invalidate_session(self, campaign: str, source_session: str, run_id: str) -> None:
        prefixes = [
            ("session", campaign, source_session, run_id),
            ("sessions", campaign, run_id),
        ]
        with self.cache_lock:
            for key in list(self.cache):
                if any(key[: len(prefix)] == prefix for prefix in prefixes):
                    self.cache.pop(key, None)

    def load_jobs(self) -> None:
        for path in sorted(self.jobs_dir.glob("*.json")):
            try:
                job = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if job.get("status") == "running":
                job["status"] = "failed"
                job["error"] = "Servidor local reiniciou durante execucao."
                job["finishedAt"] = dt.datetime.now(dt.UTC).isoformat()
            self.jobs[job["id"]] = job

    def save_job(self, job: dict[str, Any]) -> None:
        path = self.jobs_dir / f"{job['id']}.json"
        path.write_text(json.dumps(job, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def create_job(self, job_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        job = {
            "id": str(uuid.uuid4()),
            "type": job_type,
            "status": "queued",
            "createdAt": dt.datetime.now(dt.UTC).isoformat(),
            "startedAt": None,
            "finishedAt": None,
            "input": payload,
            "output": None,
            "error": None,
        }
        with self.jobs_lock:
            self.jobs[job["id"]] = job
            self.save_job(job)
        return job

    def update_job(self, job_id: str, **updates: Any) -> dict[str, Any]:
        with self.jobs_lock:
            job = self.jobs[job_id]
            job.update(updates)
            self.save_job(job)
            return dict(job)

    def list_jobs(self) -> list[dict[str, Any]]:
        with self.jobs_lock:
            return sorted((dict(job) for job in self.jobs.values()), key=lambda item: item.get("createdAt") or "", reverse=True)[:50]

    def start_ingest_job(self, job_id: str) -> None:
        thread = Thread(target=self.run_ingest_job, args=(job_id,), daemon=True)
        thread.start()

    def run_ingest_job(self, job_id: str) -> None:
        job = self.update_job(job_id, status="running", startedAt=dt.datetime.now(dt.UTC).isoformat())
        try:
            payload = job["input"]
            result = run_craig_ingest(
                Path(payload["uploadPath"]),
                payload.get("sourceSessionId") or "",
                int(payload.get("chunkSeconds") or 600),
                payload.get("sampleSeconds") or "",
                bool(payload.get("skipChunks")),
            )
            self.update_job(
                job_id,
                status="succeeded",
                output=result,
                finishedAt=dt.datetime.now(dt.UTC).isoformat(),
                error=None,
            )
        except Exception as exc:
            self.update_job(
                job_id,
                status="failed",
                error=str(exc),
                finishedAt=dt.datetime.now(dt.UTC).isoformat(),
            )


class Handler(BaseHTTPRequestHandler):
    server: AppServer

    def log_message(self, format: str, *args: Any) -> None:
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))

    def send_json(self, value: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        payload = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_error_json(self, status: HTTPStatus, message: str) -> None:
        self.send_json({"ok": False, "error": message}, status)

    def query(self) -> dict[str, str]:
        parsed = urlparse(self.path)
        values = parse_qs(parsed.query)
        return {key: value[-1] for key, value in values.items() if value}

    def read_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if not length:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api_get(parsed.path)
            return
        self.serve_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found")
            return
        self.handle_api_post(parsed.path)

    def handle_api_get(self, path: str) -> None:
        try:
            params = self.query()
            campaign = params.get("campaignSlug") or DEFAULT_CAMPAIGN
            source_session = params.get("sourceSessionId") or DEFAULT_SOURCE_SESSION
            run_id = params.get("runId") or DEFAULT_RUN
            if path == "/api/auth-config":
                env = load_env(self.server.env_file)
                config = auth_public_config(env)
                self.send_json(
                    {
                        "ok": True,
                        "mode": "open_test",
                        "supabaseUrl": config["supabaseUrl"],
                        "publishableKey": config["publishableKey"],
                    }
                )
            elif path == "/api/auth/me":
                env = load_env(self.server.env_file)
                try:
                    payload = auth_me_payload(self.server.database_url, env, self.headers.get("Authorization"), campaign)
                    self.send_json(payload)
                except PermissionError as exc:
                    self.send_error_json(HTTPStatus.UNAUTHORIZED, str(exc))
            elif path == "/api/audio-url":
                env = load_env(self.server.env_file)
                payload = audio_url_payload(
                    self.server.database_url,
                    env,
                    campaign,
                    source_session,
                    params.get("trackKey") or params.get("sourceFileRole") or "",
                    params.get("expires"),
                )
                self.send_json(payload)
            elif path == "/api/health":
                self.send_json({"ok": True, "app": "dnd-scribe-local", "campaignSlug": campaign})
            elif path == "/api/jobs":
                self.send_json({"ok": True, "jobs": self.server.list_jobs()})
            elif path == "/api/craig-map":
                self.send_json({"ok": True, "map": load_craig_map()})
            elif path == "/api/sessions":
                cache_key = ("sessions", campaign, run_id)
                sessions = self.server.cache_get(cache_key)
                cached = sessions is not None
                if sessions is None:
                    sessions = list_sessions(self.server.database_url, campaign, run_id)
                    self.server.cache_set(cache_key, sessions, SESSION_LIST_CACHE_SECONDS)
                self.send_json({"ok": True, "cached": cached, "sessions": sessions})
            elif path == "/api/session":
                cache_key = ("session", campaign, source_session, run_id)
                session_payload = self.server.cache_get(cache_key)
                cached = session_payload is not None
                if session_payload is None:
                    session_payload = {
                        "review": build_review_payload(self.server.database_url, campaign, source_session, run_id),
                        "summary": response_summary(self.server.database_url, campaign, source_session, run_id),
                    }
                    self.server.cache_set(cache_key, session_payload, SESSION_CACHE_SECONDS)
                self.send_json({"ok": True, "cached": cached, **session_payload})
            elif path == "/api/review-template":
                include_all = params.get("includeAllSegments") == "true"
                actor = params.get("actorTrackKey") or DEFAULT_ACTOR
                payload = build_decision_template(self.server.database_url, campaign, source_session, run_id, actor, include_all)
                self.send_json({"ok": True, "template": payload})
            else:
                self.send_error_json(HTTPStatus.NOT_FOUND, "Unknown API route")
        except Exception as exc:
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))

    def handle_api_post(self, path: str) -> None:
        try:
            if path == "/api/ingest/craig":
                self.ingest_craig_upload()
                return
            body = self.read_body()
            campaign = body.get("campaignSlug") or DEFAULT_CAMPAIGN
            source_session = body.get("sourceSessionId") or body.get("decisions", {}).get("sourceSessionId") or DEFAULT_SOURCE_SESSION
            run_id = body.get("runId") or body.get("decisions", {}).get("aiRunId") or DEFAULT_RUN
            if path == "/api/sessions/create":
                session = create_session(self.server.database_url, campaign, body)
                self.server.cache_invalidate_session(campaign, session["sourceSessionId"], run_id)
                sessions = list_sessions(self.server.database_url, campaign, run_id)
                self.send_json({"ok": True, "session": session, "sessions": sessions})
            elif path == "/api/sessions/update":
                session = update_session(self.server.database_url, campaign, body.get("sourceSessionId") or body.get("source_session_id") or "", body)
                self.server.cache_invalidate_session(campaign, session["sourceSessionId"], run_id)
                sessions = list_sessions(self.server.database_url, campaign, run_id)
                self.send_json({"ok": True, "session": session, "sessions": sessions})
            elif path == "/api/craig-map/update":
                updated = update_craig_track(body)
                self.send_json({"ok": True, "map": updated})
            elif path == "/api/review-decisions/apply":
                self.apply_review_decisions(body, campaign, source_session, run_id)
            elif path == "/api/publications/rebuild":
                self.rebuild_publications(body, campaign, source_session, run_id)
            else:
                self.send_error_json(HTTPStatus.NOT_FOUND, "Unknown API route")
        except Exception as exc:
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))

    def ingest_craig_upload(self) -> None:
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Use multipart/form-data.")
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw_body = self.rfile.read(length)
        message = BytesParser(policy=email_policy).parsebytes(
            f"Content-Type: {content_type}\nMIME-Version: 1.0\n\n".encode("utf-8") + raw_body
        )
        fields: dict[str, str] = {}
        uploaded: tuple[str, bytes] | None = None
        for part in message.iter_parts():
            name = part.get_param("name", header="content-disposition")
            filename_value = part.get_filename()
            payload = part.get_payload(decode=True) or b""
            if name == "zip" and filename_value:
                uploaded = (filename_value, payload)
            elif name:
                fields[name] = payload.decode("utf-8", errors="replace")
        if uploaded is None:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Arquivo ZIP ausente.")
            return
        filename = safe_filename(uploaded[0])
        if not filename.lower().endswith(".zip"):
            self.send_error_json(HTTPStatus.BAD_REQUEST, "Arquivo precisa ser .zip.")
            return

        upload_dir = ROOT / "tmp" / "uploads" / "craig"
        upload_dir.mkdir(parents=True, exist_ok=True)
        stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%SZ")
        upload_path = upload_dir / f"{stamp}-{filename}"
        upload_path.write_bytes(uploaded[1])

        source_session_id = clean_text(fields.get("sourceSessionId"), 180)
        chunk_seconds = int(fields.get("chunkSeconds") or "600")
        sample_seconds_raw = clean_text(fields.get("sampleSeconds"), 20)
        skip_chunks = truthy(fields.get("skipChunks"))
        async_job = truthy(fields.get("async"))

        job_payload = {
            "uploadPath": str(upload_path),
            "uploadPathRelative": str(upload_path.relative_to(ROOT)),
            "filename": filename,
            "sizeBytes": upload_path.stat().st_size,
            "sourceSessionId": source_session_id,
            "chunkSeconds": chunk_seconds,
            "sampleSeconds": sample_seconds_raw,
            "skipChunks": skip_chunks,
        }
        if async_job:
            job = self.server.create_job("ingest_craig", job_payload)
            self.server.start_ingest_job(job["id"])
            self.send_json({"ok": True, "queued": True, "job": job}, HTTPStatus.ACCEPTED)
            return
        try:
            result = run_craig_ingest(upload_path, source_session_id, chunk_seconds, sample_seconds_raw, skip_chunks)
        except Exception as exc:
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
            return
        self.send_json(
            {
                "ok": True,
                "upload": {
                    "filename": filename,
                    "savedPath": str(upload_path.relative_to(ROOT)),
                    "sizeBytes": upload_path.stat().st_size,
                },
                "ingest": {
                    "sessionDir": result.get("sessionDir"),
                    "tracks": result.get("tracks"),
                    "participants": result.get("participants"),
                    "chunks": result.get("chunks"),
                    "manifest": result.get("manifest"),
                    "participantsFile": result.get("participantsFile"),
                    "skipChunks": skip_chunks,
                    "chunkSeconds": chunk_seconds,
                },
                "logTail": result.get("logTail", "")[-2000:],
            }
        )

    def apply_review_decisions(self, body: dict[str, Any], campaign: str, source_session: str, run_id: str) -> None:
        decisions = body.get("decisions") or body
        actor = decisions.get("actor") or {}
        actor_key = actor.get("trackKey") or actor.get("track_key") or DEFAULT_ACTOR
        tmp_path = ROOT / "tmp" / "frontend_review_decisions.json"
        tmp_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path.write_text(json.dumps(decisions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        context = resolve_decision_context(self.server.database_url, campaign, source_session, run_id, actor_key)
        sql, decision_summary = build_decision_sql(decisions, context, source_run_id=run_id, payload_path=tmp_path)
        dry_run = bool(body.get("dryRun"))
        if not dry_run:
            apply_decision_sql(self.server.database_url, sql)
            self.server.cache_invalidate_session(campaign, source_session, run_id)
        publication_result = None
        if body.get("rebuildPublications", True) and not dry_run:
            publication_result = self.rebuild_publications_payload(campaign, source_session, run_id)
            self.server.cache_invalidate_session(campaign, source_session, run_id)
        review = build_review_payload(self.server.database_url, campaign, source_session, run_id)
        summary = response_summary(self.server.database_url, campaign, source_session, run_id)
        if not dry_run:
            self.server.cache_set(("session", campaign, source_session, run_id), {"review": review, "summary": summary}, SESSION_CACHE_SECONDS)
        self.send_json(
            {
                "ok": True,
                "dryRun": dry_run,
                "decisionSummary": decision_summary,
                "publicationResult": publication_result,
                "summary": summary,
                "review": review,
            }
        )

    def rebuild_publications(self, body: dict[str, Any], campaign: str, source_session: str, run_id: str) -> None:
        dry_run = bool(body.get("dryRun"))
        result = self.rebuild_publications_payload(campaign, source_session, run_id, update_db=not dry_run)
        if not dry_run:
            self.server.cache_invalidate_session(campaign, source_session, run_id)
        review = build_review_payload(self.server.database_url, campaign, source_session, run_id)
        summary = response_summary(self.server.database_url, campaign, source_session, run_id)
        if not dry_run:
            self.server.cache_set(("session", campaign, source_session, run_id), {"review": review, "summary": summary}, SESSION_CACHE_SECONDS)
        self.send_json(
            {
                "ok": True,
                "dryRun": dry_run,
                "publicationResult": result,
                "summary": summary,
                "review": review,
            }
        )

    def rebuild_publications_payload(
        self,
        campaign: str,
        source_session: str,
        run_id: str,
        update_db: bool = True,
    ) -> dict[str, Any]:
        out_dir = ROOT / "tmp" / "sessions" / source_session / "publications" / run_id
        context = fetch_publication_context(self.server.database_url, campaign, source_session, run_id)
        publications = write_outputs(context, out_dir)
        if update_db:
            apply_publication_sql(self.server.database_url, build_publication_sql(context, publications))
        return {
            "outDir": str(out_dir.relative_to(ROOT)),
            "publications": len(publications),
            "reviewOnly": sum(1 for item in publications if item["visibility"] == "review_only"),
            "approvedPublications": sum(1 for item in publications if item["visibility"] != "review_only"),
        }

    def serve_static(self, path: str) -> None:
        target = WEB_ROOT / "index.html" if path in {"", "/"} else WEB_ROOT / path.lstrip("/")
        try:
            resolved = target.resolve()
            if not str(resolved).startswith(str(WEB_ROOT.resolve())) or not resolved.exists() or not resolved.is_file():
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            content = resolved.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", mimetypes.guess_type(str(resolved))[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env.local")
    args = parser.parse_args()

    mimetypes.add_type("text/javascript; charset=utf-8", ".js")
    mimetypes.add_type("text/css; charset=utf-8", ".css")
    server = AppServer((args.host, args.port), Handler, args.env_file)
    print(f"DnD Scribe local app: http://{args.host}:{args.port}")
    print("Press Ctrl-C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping local app.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
