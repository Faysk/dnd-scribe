#!/usr/bin/env python3
"""Serve the local DnD Scribe web app with safe server-side Supabase access."""

from __future__ import annotations

import argparse
import json
import mimetypes
import subprocess
import sys
from time import monotonic
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from typing import Any
from urllib.parse import parse_qs, urlparse

from apply_review_decisions import apply_db_update as apply_decision_sql
from apply_review_decisions import build_sql as build_decision_sql
from apply_review_decisions import resolve_context as resolve_decision_context
from build_session_publications import apply_db_update as apply_publication_sql
from build_session_publications import build_db_sql as build_publication_sql
from build_session_publications import fetch_publication_context, write_outputs
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
    'sessionDate', s.session_date,
    'status', s.status,
    'durationMs', s.duration_ms,
    'summary', s.summary_short,
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


class AppServer(ThreadingHTTPServer):
    def __init__(self, server_address: tuple[str, int], handler_class: type[BaseHTTPRequestHandler], env_file: Path):
        super().__init__(server_address, handler_class)
        self.env_file = env_file
        self.cache: dict[tuple[str, ...], tuple[float, Any]] = {}
        self.cache_lock = Lock()
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
            if path == "/api/health":
                self.send_json({"ok": True, "app": "dnd-scribe-local", "campaignSlug": campaign})
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
            body = self.read_body()
            campaign = body.get("campaignSlug") or DEFAULT_CAMPAIGN
            source_session = body.get("sourceSessionId") or body.get("decisions", {}).get("sourceSessionId") or DEFAULT_SOURCE_SESSION
            run_id = body.get("runId") or body.get("decisions", {}).get("aiRunId") or DEFAULT_RUN
            if path == "/api/review-decisions/apply":
                self.apply_review_decisions(body, campaign, source_session, run_id)
            elif path == "/api/publications/rebuild":
                self.rebuild_publications(body, campaign, source_session, run_id)
            else:
                self.send_error_json(HTTPStatus.NOT_FOUND, "Unknown API route")
        except Exception as exc:
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))

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
