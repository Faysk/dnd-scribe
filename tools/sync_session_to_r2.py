#!/usr/bin/env python3
"""Sync a processed local Craig session to Cloudflare R2."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import hmac
import json
import mimetypes
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote, urlparse


NAMESPACE = uuid.UUID("0e5b216d-7b46-48dd-83dd-6e5b4f27a614")


@dataclass
class S3Response:
    status: int
    headers: dict[str, str]
    body: bytes


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def read_json(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def stable_uuid(*parts: object) -> str:
    value = "/".join(str(part) for part in parts)
    return str(uuid.uuid5(NAMESPACE, value))


def q(value: object, cast: str | None = None) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    text = str(value).replace("'", "''")
    literal = f"'{text}'"
    return f"{literal}::{cast}" if cast else literal


def q_json(value: object) -> str:
    text = json.dumps(value, ensure_ascii=False, sort_keys=True).replace("'", "''")
    return f"'{text}'::jsonb"


def sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def signing_key(secret: str, date_stamp: str) -> bytes:
    k_date = sign(("AWS4" + secret).encode("utf-8"), date_stamp)
    k_region = sign(k_date, "auto")
    k_service = sign(k_region, "s3")
    return sign(k_service, "aws4_request")


def guess_content_type(path: Path) -> str:
    if path.suffix == ".flac":
        return "audio/flac"
    if path.suffix == ".wav":
        return "audio/wav"
    if path.suffix == ".md":
        return "text/markdown; charset=utf-8"
    if path.suffix == ".json":
        return "application/json"
    if path.suffix == ".zip":
        return "application/zip"
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class R2Client:
    def __init__(self, values: dict[str, str]) -> None:
        endpoint = values.get("R2_S3_ENDPOINT") or values.get("R2_ENDPOINT")
        if not endpoint:
            raise SystemExit("R2_S3_ENDPOINT or R2_ENDPOINT not found in env file")
        parsed = urlparse(endpoint)
        self.scheme = parsed.scheme or "https"
        self.host = parsed.netloc
        self.bucket = values["R2_BUCKET"]
        self.access_key = values["R2_ACCESS_KEY_ID"]
        self.secret_key = values["R2_SECRET_ACCESS_KEY"]

    def request(self, method: str, key: str, payload: bytes = b"", content_type: str | None = None) -> S3Response:
        now = dt.datetime.now(dt.UTC)
        amz_date = now.strftime("%Y%m%dT%H%M%SZ")
        date_stamp = now.strftime("%Y%m%d")
        canonical_uri = "/" + quote(self.bucket, safe="") + "/" + quote(key, safe="/")
        url = f"{self.scheme}://{self.host}{canonical_uri}"
        payload_hash = hashlib.sha256(payload).hexdigest()
        headers = {
            "host": self.host,
            "x-amz-content-sha256": payload_hash,
            "x-amz-date": amz_date,
        }
        if method == "PUT":
            headers["content-type"] = content_type or "application/octet-stream"

        signed_header_keys = sorted(headers)
        canonical_headers = "".join(f"{name}:{headers[name]}\n" for name in signed_header_keys)
        signed_headers = ";".join(signed_header_keys)
        canonical_request = "\n".join([method, canonical_uri, "", canonical_headers, signed_headers, payload_hash])
        credential_scope = f"{date_stamp}/auto/s3/aws4_request"
        string_to_sign = "\n".join(
            [
                "AWS4-HMAC-SHA256",
                amz_date,
                credential_scope,
                hashlib.sha256(canonical_request.encode()).hexdigest(),
            ]
        )
        signature = hmac.new(signing_key(self.secret_key, date_stamp), string_to_sign.encode(), hashlib.sha256).hexdigest()
        authorization = (
            f"AWS4-HMAC-SHA256 Credential={self.access_key}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )
        req_headers = {k: v for k, v in headers.items() if k != "host"}
        req_headers["Authorization"] = authorization
        request = urllib.request.Request(
            url,
            data=payload if method in {"PUT", "POST"} else None,
            headers=req_headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return S3Response(response.status, dict(response.headers.items()), response.read())
        except urllib.error.HTTPError as exc:
            return S3Response(exc.code, dict(exc.headers.items()), exc.read())

    def head(self, key: str) -> S3Response:
        return self.request("HEAD", key)

    def put_file(self, key: str, path: Path, content_type: str) -> S3Response:
        return self.request("PUT", key, path.read_bytes(), content_type)


def object_key(prefix: str, suffix: str) -> str:
    return "/".join(part.strip("/") for part in [prefix, suffix] if part.strip("/"))


def add_object(
    objects: list[dict],
    *,
    role: str,
    path: Path,
    key: str,
    category: str,
    db_table: str | None = None,
    db_role: str | None = None,
    track_key: str | None = None,
    chunk_index: int | None = None,
) -> None:
    if not path.exists() or not path.is_file():
        return
    objects.append(
        {
            "role": role,
            "category": category,
            "local_path": str(path),
            "key": key,
            "size_bytes": path.stat().st_size,
            "sha256": sha256_file(path),
            "content_type": guess_content_type(path),
            "db_table": db_table,
            "db_role": db_role,
            "track_key": track_key,
            "chunk_index": chunk_index,
        }
    )


def build_plan(
    session_dir: Path,
    *,
    campaign_slug: str,
    prefix: str | None,
    include_chunks: bool,
    include_raw_tracks: bool,
) -> dict:
    manifest = read_json(session_dir / "manifest.json")
    source_session_id = manifest["session_id"]
    base_prefix = prefix or f"campaigns/{campaign_slug}/sessions/{source_session_id}"
    objects: list[dict] = []

    zip_path_value = manifest.get("zip_path")
    if zip_path_value:
        zip_path = Path(zip_path_value)
        add_object(
            objects,
            role="craig_zip",
            path=zip_path,
            key=object_key(base_prefix, f"raw/source/{zip_path.name}"),
            category="raw",
            db_table="recording_files",
            db_role="craig_zip",
        )

    add_object(
        objects,
        role="craig_info",
        path=session_dir / "raw" / "info.txt",
        key=object_key(base_prefix, "raw/craig/info.txt"),
        category="raw",
        db_table="recording_files",
        db_role="craig_info",
    )

    if include_raw_tracks:
        for track in manifest.get("tracks") or []:
            track_key = track["track_key"]
            track_path = Path(track.get("source_path") or session_dir / "raw" / track["source_file"])
            add_object(
                objects,
                role=f"craig_track_{track_key}",
                path=track_path,
                key=object_key(base_prefix, f"raw/tracks/{track_path.name}"),
                category="raw",
                db_table="recording_files",
                db_role=f"craig_track_{track_key}",
                track_key=track_key,
            )

    artifacts = [
        ("manifest", session_dir / "manifest.json", "processed/manifest.json"),
        ("participants", session_dir / "participants.json", "processed/participants.json"),
        ("transcription_index", session_dir / "transcripts" / "transcription_index.json", "processed/transcripts/transcription_index.json"),
        ("segments_raw", session_dir / "transcripts" / "segments.json", "processed/transcripts/segments.json"),
        ("transcript_tracks", session_dir / "transcripts" / "transcript_tracks.json", "processed/transcripts/transcript_tracks.json"),
        ("track_summaries", session_dir / "transcripts" / "track_summaries.json", "processed/transcripts/track_summaries.json"),
        ("transcript_master_json", session_dir / "transcripts" / "transcript_master.json", "processed/transcripts/transcript_master.json"),
        ("transcript_master_md", session_dir / "transcripts" / "transcript_master.md", "processed/transcripts/transcript_master.md"),
    ]
    for role, path, suffix in artifacts:
        add_object(
            objects,
            role=role,
            path=path,
            key=object_key(base_prefix, suffix),
            category="processed",
            db_table="recording_files",
            db_role=role,
        )

    raw_transcripts = sorted((session_dir / "transcripts" / "raw").glob("*/*.json"))
    for path in raw_transcripts:
        track_key = path.parent.name
        add_object(
            objects,
            role=f"transcription_response_{track_key}_{path.stem}",
            path=path,
            key=object_key(base_prefix, f"processed/transcripts/raw/{track_key}/{path.name}"),
            category="processed",
            track_key=track_key,
        )

    if include_chunks:
        for track in manifest.get("tracks") or []:
            track_key = track["track_key"]
            for chunk in track.get("chunks") or []:
                chunk_path = Path(chunk["path"])
                add_object(
                    objects,
                    role=f"chunk_{track_key}_{chunk['index']:03d}",
                    path=chunk_path,
                    key=object_key(base_prefix, f"chunks/{track_key}/{chunk_path.name}"),
                    category="chunks",
                    db_table="audio_chunks",
                    track_key=track_key,
                    chunk_index=int(chunk["index"]),
                )

    return {
        "schema_version": 1,
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
        "campaign_slug": campaign_slug,
        "source_session_id": source_session_id,
        "prefix": base_prefix,
        "include_chunks": include_chunks,
        "include_raw_tracks": include_raw_tracks,
        "objects": objects,
        "summary": {
            "objects": len(objects),
            "bytes": sum(item["size_bytes"] for item in objects),
            "chunks_included": sum(1 for item in objects if item["category"] == "chunks"),
            "raw_transcription_responses": len(raw_transcripts),
        },
    }


def content_length(headers: dict[str, str]) -> int | None:
    for key, value in headers.items():
        if key.lower() == "content-length":
            try:
                return int(value)
            except ValueError:
                return None
    return None


def sync_objects(client: R2Client, plan: dict, force: bool) -> list[dict]:
    results: list[dict] = []
    total = len(plan["objects"])
    for index, item in enumerate(plan["objects"], start=1):
        path = Path(item["local_path"])
        head = client.head(item["key"])
        existing_size = content_length(head.headers)
        if head.status == 200 and existing_size == item["size_bytes"] and not force:
            status = "skipped"
            final_head = head
        else:
            put = client.put_file(item["key"], path, item["content_type"])
            if put.status not in {200, 201, 204}:
                raise SystemExit(f"upload failed status={put.status} key={item['key']} body={put.body[:300]!r}")
            final_head = client.head(item["key"])
            if final_head.status != 200:
                raise SystemExit(f"head after upload failed status={final_head.status} key={item['key']}")
            status = "uploaded"

        result = {
            **item,
            "sync_status": status,
            "remote_size_bytes": content_length(final_head.headers),
            "etag": final_head.headers.get("ETag") or final_head.headers.get("etag"),
            "synced_at": dt.datetime.now(dt.UTC).isoformat(),
        }
        results.append(result)
        print(f"{index:03d}/{total:03d} {status} {item['size_bytes']} {item['key']}")
    return results


def build_db_sql(plan: dict, results: list[dict], bucket: str, started_at: str, finished_at: str) -> str:
    campaign_slug = plan["campaign_slug"]
    source_session_id = plan["source_session_id"]
    job_id = stable_uuid("processing_job", campaign_slug, source_session_id, "r2_storage_sync")
    recording_files = [item for item in results if item.get("db_table") == "recording_files" and item.get("db_role")]
    audio_chunks = [item for item in results if item.get("db_table") == "audio_chunks"]
    summary = {
        "bucket": bucket,
        "prefix": plan["prefix"],
        "objects": len(results),
        "uploaded": sum(1 for item in results if item["sync_status"] == "uploaded"),
        "skipped": sum(1 for item in results if item["sync_status"] == "skipped"),
        "bytes": sum(item["size_bytes"] for item in results),
        "recording_files_updated": len(recording_files),
        "audio_chunks_updated": len(audio_chunks),
    }

    session_cte = (
        "with target_session as ("
        "select s.id from sessions s join campaigns c on c.id = s.campaign_id "
        f"where c.slug = {q(campaign_slug)} and s.source_session_id = {q(source_session_id)}"
        ")"
    )

    lines = ["begin;"]
    for item in recording_files:
        metadata = {
            "bucket": bucket,
            "key": item["key"],
            "etag": item.get("etag"),
            "size_bytes": item["size_bytes"],
            "sha256": item["sha256"],
            "sync_status": item["sync_status"],
            "synced_at": item["synced_at"],
            "content_type": item["content_type"],
        }
        lines.append(
            f"""
{session_cte}
update recording_files rf
set
  storage_bucket = {q(bucket)},
  storage_path = {q(item["key"])},
  mime_type = coalesce(rf.mime_type, {q(item["content_type"])}),
  size_bytes = {q(item["size_bytes"])},
  source_system = 'r2',
  metadata = jsonb_set(
    coalesce(rf.metadata, '{{}}'::jsonb),
    '{{local_storage_path}}',
    to_jsonb(coalesce(rf.metadata->>'local_storage_path', rf.storage_path)),
    true
  ) || jsonb_build_object('r2', {q_json(metadata)})
from target_session s
where rf.session_id = s.id
  and rf.source_file_role = {q(item["db_role"])};
""".strip()
        )

    for item in audio_chunks:
        metadata = {
            "bucket": bucket,
            "key": item["key"],
            "etag": item.get("etag"),
            "size_bytes": item["size_bytes"],
            "sha256": item["sha256"],
            "sync_status": item["sync_status"],
            "synced_at": item["synced_at"],
            "content_type": item["content_type"],
        }
        lines.append(
            f"""
{session_cte}
update audio_chunks ac
set
  storage_bucket = {q(bucket)},
  storage_path = {q(item["key"])},
  size_bytes = {q(item["size_bytes"])},
  metadata = jsonb_set(
    coalesce(ac.metadata, '{{}}'::jsonb),
    '{{local_storage_path}}',
    to_jsonb(coalesce(ac.metadata->>'local_storage_path', ac.storage_path)),
    true
  ) || jsonb_build_object('r2', {q_json(metadata)})
from target_session s
where ac.session_id = s.id
  and ac.track_key = {q(item["track_key"])}
  and ac.chunk_index = {q(item["chunk_index"])};
""".strip()
        )

    lines.append(
        f"""
{session_cte}
insert into processing_jobs (
  id, session_id, job_type, status, attempts, input, output, started_at, finished_at
)
select
  {q(job_id, "uuid")},
  s.id,
  'r2_storage_sync',
  'succeeded',
  1,
  {q_json({"campaign_slug": campaign_slug, "source_session_id": source_session_id, "prefix": plan["prefix"]})},
  {q_json(summary)},
  {q(started_at, "timestamptz")},
  {q(finished_at, "timestamptz")}
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
    parser.add_argument("--prefix")
    parser.add_argument("--include-chunks", action="store_true")
    parser.add_argument("--skip-raw-tracks", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--update-db", action="store_true")
    parser.add_argument("--manifest-out", type=Path)
    args = parser.parse_args()

    if not args.session_dir.exists():
        raise SystemExit(f"Session dir not found: {args.session_dir}")

    values = load_env(args.env_file)
    client = R2Client(values)
    plan = build_plan(
        args.session_dir,
        campaign_slug=args.campaign_slug,
        prefix=args.prefix,
        include_chunks=args.include_chunks,
        include_raw_tracks=not args.skip_raw_tracks,
    )
    print(f"bucket={client.bucket}")
    print(f"prefix={plan['prefix']}")
    print(f"objects={plan['summary']['objects']}")
    print(f"bytes={plan['summary']['bytes']}")
    print(f"chunks_included={plan['summary']['chunks_included']}")

    if args.dry_run:
        if args.manifest_out:
            write_json(args.manifest_out, plan)
        return 0

    started_at = dt.datetime.now(dt.UTC).isoformat()
    results = sync_objects(client, plan, force=args.force)
    finished_at = dt.datetime.now(dt.UTC).isoformat()
    sync_manifest = {
        **plan,
        "bucket": client.bucket,
        "synced_at": finished_at,
        "results": results,
        "sync_summary": {
            "objects": len(results),
            "uploaded": sum(1 for item in results if item["sync_status"] == "uploaded"),
            "skipped": sum(1 for item in results if item["sync_status"] == "skipped"),
            "bytes": sum(item["size_bytes"] for item in results),
            "recording_files": sum(1 for item in results if item.get("db_table") == "recording_files"),
            "audio_chunks": sum(1 for item in results if item.get("db_table") == "audio_chunks"),
        },
    }

    manifest_out = args.manifest_out or args.session_dir / "storage" / "r2_manifest.json"
    write_json(manifest_out, sync_manifest)
    print(f"manifest={manifest_out}")

    if args.update_db:
        database_url = values.get("DATABASE_URL")
        if not database_url:
            raise SystemExit(f"DATABASE_URL not found in {args.env_file}")
        sql = build_db_sql(plan, results, client.bucket, started_at, finished_at)
        apply_db_update(database_url, sql)
        print("db_updated=true")

    print("sync_complete=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
