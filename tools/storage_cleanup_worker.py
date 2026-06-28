#!/usr/bin/env python3
"""Delete only R2 objects already marked delete_ready by the DB cleanup policy."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import psycopg
from psycopg.rows import dict_row


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CAMPAIGN = "yuhara-main"
CONFIRM_TOKEN = "DELETE_READY_R2"


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


def json_default(value: Any) -> str:
    return str(value)


def optional_env(env: dict[str, str], *names: str) -> str:
    for name in names:
        value = str(env.get(name) or "").strip()
        if value:
            return value
    return ""


def r2_client(env: dict[str, str]):
    endpoint = optional_env(env, "R2_S3_ENDPOINT", "R2_ENDPOINT")
    if not endpoint:
        raise RuntimeError("R2_S3_ENDPOINT or R2_ENDPOINT is required")
    parsed = urlparse(endpoint)
    if not parsed.scheme or not parsed.netloc:
        raise RuntimeError("R2 endpoint must include scheme and host")
    endpoint = f"{parsed.scheme}://{parsed.netloc}"

    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=env.get("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=env.get("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def refresh_readiness(conn: psycopg.Connection, campaign: str, actor: str) -> dict[str, Any]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
with ready as (
  select cleanup.artifact_id, cleanup.reclaimable_bytes
  from audio_storage_cleanup_candidates cleanup
  join sessions s on s.id = cleanup.session_id
  join campaigns c on c.id = s.campaign_id
  where c.slug = %s
    and cleanup.readiness_status = 'delete_ready'
    and cleanup.lifecycle_status in ('active', 'superseded')
), updated as (
  update audio_artifacts aa
  set lifecycle_status = 'delete_ready',
      delete_reason = coalesce(aa.delete_reason, 'cleanup_readiness_policy'),
      metadata = coalesce(aa.metadata, '{}'::jsonb) || jsonb_build_object(
        'marked_delete_ready_by', 'tools/storage_cleanup_worker.py',
        'marked_delete_ready_at', now(),
        'marked_delete_ready_actor', %s::text
      ),
      updated_at = now()
  from ready
  where aa.id = ready.artifact_id
  returning aa.id, ready.reclaimable_bytes
), event_rows as (
  insert into audio_artifact_events (artifact_id, event_type, note, payload)
  select
    updated.id,
    'marked_delete_ready',
    'Marked delete_ready by storage cleanup worker refresh; no R2 object was deleted.',
    jsonb_build_object(
      'source', 'tools/storage_cleanup_worker.py',
      'actor', %s::text,
      'reclaimable_bytes', updated.reclaimable_bytes
    )
  from updated
  returning artifact_id
)
select count(*)::int objects, coalesce(sum(reclaimable_bytes), 0)::bigint bytes
from updated;
""",
            (campaign, actor, actor),
        )
        row = cur.fetchone() or {}
    return {"objects": int(row.get("objects") or 0), "bytes": int(row.get("bytes") or 0)}


def select_candidates(
    conn: psycopg.Connection,
    campaign: str,
    source_session_id: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    session_clause = "and (%s::text is null or cleanup.source_session_id = %s::text)"
    params: tuple[Any, ...] = (campaign, source_session_id, source_session_id, limit)
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
select cleanup.*
from audio_storage_cleanup_candidates cleanup
join sessions s on s.id = cleanup.session_id
join campaigns c on c.id = s.campaign_id
where c.slug = %s
  {session_clause}
  and cleanup.readiness_status = 'delete_ready'
  and cleanup.lifecycle_status = 'delete_ready'
order by cleanup.reclaimable_bytes desc, cleanup.updated_at asc
limit %s::integer;
""",
            params,
        )
        return [dict(row) for row in cur.fetchall()]


def mark_failed(conn: psycopg.Connection, artifact_id: str, error: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
update audio_artifacts
set lifecycle_status = 'failed',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'delete_failed_at', now(),
      'delete_error', %s::text
    ),
    updated_at = now()
where id = %s::uuid;
""",
            (error[:1000], artifact_id),
        )
        cur.execute(
            """
insert into audio_artifact_events (artifact_id, event_type, note, payload)
values (%s::uuid, 'note', 'R2 deletion failed; artifact moved to failed lifecycle.', %s::jsonb);
""",
            (artifact_id, json.dumps({"source": "tools/storage_cleanup_worker.py", "error": error}, ensure_ascii=False)),
        )


def delete_candidate(conn: psycopg.Connection, client: Any, item: dict[str, Any], actor: str) -> dict[str, Any]:
    artifact_id = str(item["artifact_id"])
    bucket = str(item["storage_bucket"])
    key = str(item["storage_path"])
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
update audio_artifacts
set lifecycle_status = 'delete_queued',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'delete_queued_by', %s::text,
      'delete_queued_at', now()
    ),
    updated_at = now()
where id = %s::uuid
  and lifecycle_status = 'delete_ready'
returning id::text;
""",
            (actor, artifact_id),
        )
        if not cur.fetchone():
            return {**item, "action": "skipped_claim_lost"}
        cur.execute(
            """
insert into audio_artifact_events (artifact_id, event_type, note, payload)
values (%s::uuid, 'delete_queued', 'Queued for R2 deletion by storage cleanup worker.', %s::jsonb);
""",
            (
                artifact_id,
                json.dumps({"source": "tools/storage_cleanup_worker.py", "storage_path": key}, ensure_ascii=False),
            ),
        )
    try:
        client.delete_object(Bucket=bucket, Key=key)
    except Exception as error:  # noqa: BLE001
        mark_failed(conn, artifact_id, str(error))
        return {**item, "action": "failed", "error": str(error)}
    with conn.cursor() as cur:
        cur.execute(
            """
update audio_artifacts
set lifecycle_status = 'deleted',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'deleted_by', %s::text,
      'deleted_at', now(),
      'delete_runner', 'tools/storage_cleanup_worker.py'
    ),
    updated_at = now()
where id = %s::uuid;
""",
            (actor, artifact_id),
        )
        cur.execute(
            """
insert into audio_artifact_events (artifact_id, event_type, note, payload)
values (%s::uuid, 'deleted', 'Deleted R2 object through storage cleanup worker.', %s::jsonb);
""",
            (
                artifact_id,
                json.dumps(
                    {
                        "source": "tools/storage_cleanup_worker.py",
                        "storage_bucket": bucket,
                        "storage_path": key,
                        "size_bytes": int(item.get("size_bytes") or 0),
                    },
                    ensure_ascii=False,
                ),
            ),
        )
    return {**item, "action": "deleted"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env.local")
    parser.add_argument("--campaign", default=DEFAULT_CAMPAIGN)
    parser.add_argument("--source-session-id")
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--confirm", default="")
    parser.add_argument("--actor", default="github-actions-storage-cleanup")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    env = load_env(args.env_file)
    database_url = env.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required")
    limit = max(1, min(50, int(args.limit or 5)))
    if args.execute and args.confirm != CONFIRM_TOKEN:
        raise SystemExit(f"--execute requires --confirm {CONFIRM_TOKEN}")

    with psycopg.connect(database_url, autocommit=False) as conn:
        readiness = refresh_readiness(conn, args.campaign, args.actor) if args.execute else {"objects": 0, "bytes": 0, "dryRunSkipped": True}
        candidates = select_candidates(conn, args.campaign, args.source_session_id, limit)
        output: dict[str, Any] = {
            "execute": args.execute,
            "campaign": args.campaign,
            "sourceSessionId": args.source_session_id,
            "limit": limit,
            "readinessRefresh": readiness,
            "candidateObjects": len(candidates),
            "candidateBytes": sum(int(item.get("reclaimable_bytes") or item.get("size_bytes") or 0) for item in candidates),
            "deletedObjects": 0,
            "deletedBytes": 0,
            "failedObjects": 0,
            "objects": [
                {
                    "artifactId": str(item["artifact_id"]),
                    "sourceSessionId": item.get("source_session_id"),
                    "artifactType": item.get("artifact_type"),
                    "storageBucket": item.get("storage_bucket"),
                    "storagePath": item.get("storage_path"),
                    "sizeBytes": int(item.get("size_bytes") or 0),
                    "reclaimableBytes": int(item.get("reclaimable_bytes") or 0),
                    "readinessStatus": item.get("readiness_status"),
                    "lifecycleStatus": item.get("lifecycle_status"),
                }
                for item in candidates
            ],
            "failures": [],
        }
        if args.execute:
            client = r2_client(env)
            results = []
            for item in candidates:
                result = delete_candidate(conn, client, item, args.actor)
                results.append(result)
                if result.get("action") == "deleted":
                    output["deletedObjects"] += 1
                    output["deletedBytes"] += int(item.get("reclaimable_bytes") or item.get("size_bytes") or 0)
                elif result.get("action") == "failed":
                    output["failedObjects"] += 1
                    output["failures"].append(
                        {
                            "artifactId": str(item.get("artifact_id")),
                            "storagePath": item.get("storage_path"),
                            "error": result.get("error"),
                        }
                    )
            conn.commit()
            output["objects"] = [
                {
                    "artifactId": str(item["artifact_id"]),
                    "sourceSessionId": item.get("source_session_id"),
                    "artifactType": item.get("artifact_type"),
                    "storagePath": item.get("storage_path"),
                    "sizeBytes": int(item.get("size_bytes") or 0),
                    "reclaimableBytes": int(item.get("reclaimable_bytes") or 0),
                    "action": item.get("action"),
                }
                for item in results
            ]
        else:
            conn.rollback()

    if args.json:
        print(json.dumps(output, ensure_ascii=False, indent=2, default=json_default))
    else:
        print(f"execute={str(output['execute']).lower()}")
        print(f"campaign={output['campaign']}")
        print(f"source_session_id={output.get('sourceSessionId') or '*'}")
        print(f"candidate_objects={output['candidateObjects']}")
        print(f"candidate_bytes={output['candidateBytes']}")
        print(f"deleted_objects={output['deletedObjects']}")
        print(f"deleted_bytes={output['deletedBytes']}")
        print(f"failed_objects={output['failedObjects']}")
        for item in output["objects"]:
            print(f"{item.get('action') or 'candidate'} {item['artifactType']} {item['sizeBytes']} {item['storagePath']}")
    return 1 if output.get("failedObjects") else 0


if __name__ == "__main__":
    raise SystemExit(main())
