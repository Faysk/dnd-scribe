#!/usr/bin/env python3
"""Cloud worker for Craig speech slices.

This runner is designed for GitHub Actions or another Linux worker with ffmpeg.
It downloads extracted Craig FLAC tracks from R2, detects non-silent speech
inside planned audio_chunks, uploads only speech slice WAV files back to R2,
and updates Supabase tables used by audio_transcription_work_units.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import struct
import subprocess
import tempfile
import traceback
import wave
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import boto3
import psycopg
from botocore.config import Config
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


DEFAULT_CAMPAIGN = "yuhara-main"
DEFAULT_NOISE_DB = -45.0
DEFAULT_MIN_SILENCE_SECONDS = 1.0
DEFAULT_MIN_SPEECH_SECONDS = 2.0
DEFAULT_PADDING_MS = 250
DEFAULT_MERGE_GAP_SECONDS = 2.5
DEFAULT_MIN_UNIT_SECONDS = 12.0
DEFAULT_MAX_UNIT_SECONDS = 90.0
DEFAULT_MAX_CHUNKS = 8
DEFAULT_MAX_TRACKS = 1


def clean_text(value: Any, max_length: int = 500) -> str:
    text = str(value or "").strip()
    return text[:max_length] if text else ""


def require_env(name: str) -> str:
    value = clean_text(os.environ.get(name), 4000)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def optional_env(*names: str) -> str:
    for name in names:
        value = clean_text(os.environ.get(name), 4000)
        if value:
            return value
    return ""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def wav_audio_stats(path: Path, silence_threshold: float) -> dict[str, Any]:
    try:
        with wave.open(str(path), "rb") as source:
            sample_width = source.getsampwidth()
            frame_count = source.getnframes()
            raw = source.readframes(frame_count)
    except (EOFError, OSError, wave.Error):
        return {}

    if sample_width != 2 or frame_count <= 0:
        return {}
    sample_count = len(raw) // sample_width
    if sample_count <= 0:
        return {}

    square_sum = 0
    peak = 0
    for (sample,) in struct.iter_unpack("<h", raw[: sample_count * sample_width]):
        absolute = abs(sample)
        peak = max(peak, absolute)
        square_sum += sample * sample
    rms = math.sqrt(square_sum / sample_count)
    dbfs = 20 * math.log10(rms / 32768) if rms > 0 else -120.0
    return {
        "audio_rms": round(rms, 2),
        "audio_peak": peak,
        "audio_dbfs": round(dbfs, 2),
        "probably_silent": dbfs < silence_threshold,
        "silence_dbfs_threshold": silence_threshold,
    }


def db_connect() -> psycopg.Connection:
    database_url = require_env("DATABASE_URL")
    connection = psycopg.connect(database_url, row_factory=dict_row)
    connection.autocommit = True
    return connection


def query_one(conn: psycopg.Connection, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    with conn.cursor() as cursor:
        cursor.execute(sql, params)
        return cursor.fetchone()


def query_all(conn: psycopg.Connection, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with conn.cursor() as cursor:
        cursor.execute(sql, params)
        return list(cursor.fetchall())


def execute(conn: psycopg.Connection, sql: str, params: tuple[Any, ...] = ()) -> None:
    with conn.cursor() as cursor:
        cursor.execute(sql, params)


def r2_client():
    endpoint = optional_env("R2_S3_ENDPOINT", "R2_ENDPOINT")
    if not endpoint:
        raise RuntimeError("Missing R2_S3_ENDPOINT or R2_ENDPOINT")
    parsed = urlparse(endpoint)
    if not parsed.scheme or not parsed.netloc:
        raise RuntimeError("R2 endpoint must include scheme and host")
    # Some local tooling accepts an endpoint with the bucket in the path.
    # boto3 expects the account-level S3 endpoint and adds the bucket itself.
    endpoint = f"{parsed.scheme}://{parsed.netloc}"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=require_env("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=require_env("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def download_object(s3, bucket: str, key: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    s3.download_file(bucket, key, str(target))


def upload_file(s3, bucket: str, key: str, path: Path, content_type: str) -> None:
    s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": content_type})


def mark_job_step(conn: psycopg.Connection, job_id: str, status: str, progress: dict[str, Any], error: str | None = None) -> None:
    execute(
        conn,
        """
insert into processing_job_steps (
  id, job_id, step_key, label, status, attempts, retryable, order_index,
  progress, error, started_at, finished_at, created_at, updated_at
)
values (
  gen_random_uuid(), %s::uuid, 'detect_speech_slices', 'Detectar fala', %s,
  case when %s = 'running' then 1 else 0 end,
  %s::boolean, 50, %s::jsonb, %s,
  case when %s in ('running','succeeded','failed','retrying','blocked') then now() else null end,
  case when %s in ('succeeded','failed','skipped','blocked') then now() else null end,
  now(), now()
)
on conflict (job_id, step_key) do update set
  label = excluded.label,
  status = excluded.status,
  attempts = case
    when excluded.status = 'running'
     and processing_job_steps.status <> 'running'
      then processing_job_steps.attempts + 1
    else processing_job_steps.attempts
  end,
  retryable = excluded.retryable,
  order_index = excluded.order_index,
  progress = coalesce(processing_job_steps.progress, '{}'::jsonb) || excluded.progress,
  error = excluded.error,
  started_at = case
    when excluded.status in ('running','succeeded','failed','retrying','blocked')
      then coalesce(processing_job_steps.started_at, now())
    else processing_job_steps.started_at
  end,
  finished_at = case
    when excluded.status in ('succeeded','failed','skipped','blocked') then now()
    when excluded.status in ('running','retrying') then null
    else processing_job_steps.finished_at
  end,
  updated_at = now();
""",
        (
            job_id,
            status,
            status,
            status not in {"succeeded", "skipped"},
            Jsonb(progress),
            clean_text(error, 4000) or None,
            status,
            status,
        ),
    )


def ensure_detect_job(conn: psycopg.Connection, campaign: str, source_session_id: str) -> None:
    if not source_session_id:
        return
    execute(
        conn,
        """
with target as (
  select s.id session_id
  from sessions s
  join campaigns c on c.id = s.campaign_id
  where c.slug = %s::text
    and s.source_session_id = %s::text
), inserted as (
  insert into processing_jobs (id, session_id, job_type, status, attempts, input, output, created_at)
  select gen_random_uuid(), target.session_id, 'cloud_detect_speech_slices', 'queued', 0,
         jsonb_build_object('sourceSessionId', %s::text, 'createdBy', 'cloud_speech_slices_worker'),
         jsonb_build_object('workerStatus', 'ready_to_run', 'paidAiCostUsd', 0),
         now()
  from target
  where not exists (
    select 1 from processing_jobs pj
    where pj.session_id = target.session_id
      and pj.job_type = 'cloud_detect_speech_slices'
      and pj.status in ('queued','retrying','running','succeeded')
  )
  returning id
)
select count(*) from inserted;
""",
        (campaign, source_session_id, source_session_id),
    )


def select_job(conn: psycopg.Connection, campaign: str, source_session_id: str, job_id: str | None) -> dict[str, Any] | None:
    return query_one(
        conn,
        """
select pj.*, s.source_session_id, s.title session_title, c.slug campaign_slug
from processing_jobs pj
join sessions s on s.id = pj.session_id
join campaigns c on c.id = s.campaign_id
where c.slug = %s
  and pj.job_type = 'cloud_detect_speech_slices'
  and (%s::uuid is null or pj.id = %s::uuid)
  and (%s::text = '' or s.source_session_id = %s::text)
order by case pj.status
    when 'queued' then 10
    when 'retrying' then 20
    when 'running' then 30
    when 'succeeded' then 40
    else 90
  end,
  pj.created_at
limit 1;
""",
        (campaign, job_id, job_id, source_session_id, source_session_id),
    )


def claim_job(conn: psycopg.Connection, campaign: str, source_session_id: str, job_id: str | None) -> dict[str, Any] | None:
    return query_one(
        conn,
        """
with candidate as (
  select pj.id
  from processing_jobs pj
  join sessions s on s.id = pj.session_id
  join campaigns c on c.id = s.campaign_id
  where c.slug = %s
    and pj.job_type = 'cloud_detect_speech_slices'
    and pj.status in ('queued','retrying')
    and (%s::uuid is null or pj.id = %s::uuid)
    and (%s::text = '' or s.source_session_id = %s::text)
  order by case when %s::uuid is not null and pj.id = %s::uuid then 0 else 1 end, pj.created_at
  limit 1
  for update skip locked
), updated as (
  update processing_jobs pj
  set status = 'running',
      attempts = coalesce(pj.attempts, 0) + 1,
      started_at = now(),
      finished_at = null,
      error = null,
      output = coalesce(pj.output, '{}'::jsonb) || jsonb_build_object(
        'workerStatus', 'speech_slices_running',
        'worker', 'github_actions_ffmpeg',
        'paidAiCostUsd', 0
      )
  from candidate
  where pj.id = candidate.id
  returning pj.*
)
select updated.*, s.source_session_id, s.title session_title, c.slug campaign_slug
from updated
join sessions s on s.id = updated.session_id
join campaigns c on c.id = s.campaign_id;
""",
        (campaign, job_id, job_id, source_session_id, source_session_id, job_id, job_id),
    )


def fetch_candidate_chunks(conn: psycopg.Connection, job: dict[str, Any], replace: bool) -> list[dict[str, Any]]:
    return query_all(
        conn,
        """
select ac.id::text audio_chunk_id,
       ac.session_id::text session_id,
       ac.source_file_id::text source_file_id,
       s.source_session_id,
       ac.track_key,
       ac.chunk_index,
       ac.start_ms,
       ac.end_ms,
       coalesce(ac.duration_ms, greatest(0, coalesce(ac.end_ms, 0) - coalesce(ac.start_ms, 0)), 0)::int duration_ms,
       ac.metadata chunk_metadata,
       rf.storage_bucket source_bucket,
       rf.storage_path source_path,
       rf.original_filename source_filename,
       rf.size_bytes source_size_bytes,
       rf.duration_ms source_duration_ms
from audio_chunks ac
join recording_files rf on rf.id = ac.source_file_id
join sessions s on s.id = ac.session_id
where ac.session_id = %s::uuid
  and rf.file_type = 'craig_track'
  and nullif(rf.storage_bucket, '') is not null
  and nullif(rf.storage_path, '') is not null
  and (%s::boolean or not exists (
    select 1 from audio_speech_slices ss where ss.source_chunk_id = ac.id
  ))
  and (%s::boolean or coalesce(ac.probably_silent, false) is false)
order by ac.track_key, ac.chunk_index;
""",
        (job["session_id"], replace, replace),
    )


def detect_silences(path: Path, start_ms: int, duration_ms: int, noise_db: float, min_silence_seconds: float) -> list[tuple[int, int | None]]:
    command = [
        "ffmpeg",
        "-hide_banner",
        "-nostats",
        "-ss",
        f"{start_ms / 1000.0:.3f}",
        "-t",
        f"{max(0.001, duration_ms / 1000.0):.3f}",
        "-i",
        str(path),
        "-af",
        f"silencedetect=n={noise_db}dB:d={min_silence_seconds}",
        "-f",
        "null",
        "-",
    ]
    process = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if process.returncode != 0:
        raise RuntimeError(process.stderr.strip() or "ffmpeg silencedetect failed")

    silences: list[tuple[int, int | None]] = []
    open_start: int | None = None
    for line in process.stderr.splitlines():
        start_match = re.search(r"silence_start:\s*([0-9.]+)", line)
        if start_match:
            open_start = round(float(start_match.group(1)) * 1000)
            continue
        end_match = re.search(r"silence_end:\s*([0-9.]+)", line)
        if end_match and open_start is not None:
            silences.append((open_start, round(float(end_match.group(1)) * 1000)))
            open_start = None
    if open_start is not None:
        silences.append((open_start, None))
    return silences


def speech_intervals(duration_ms: int, silences: list[tuple[int, int | None]], min_speech_ms: int, padding_ms: int) -> list[tuple[int, int]]:
    raw: list[tuple[int, int]] = []
    cursor = 0
    for silence_start, maybe_silence_end in sorted(silences):
        silence_start = max(0, min(duration_ms, silence_start))
        silence_end = duration_ms if maybe_silence_end is None else max(0, min(duration_ms, maybe_silence_end))
        if silence_start > cursor and silence_start - cursor >= min_speech_ms:
            raw.append((cursor, silence_start))
        cursor = max(cursor, silence_end)
    if duration_ms > cursor and duration_ms - cursor >= min_speech_ms:
        raw.append((cursor, duration_ms))

    padded: list[tuple[int, int]] = []
    for start, end in raw:
        padded_start = max(0, start - padding_ms)
        padded_end = min(duration_ms, end + padding_ms)
        if not padded or padded_start > padded[-1][1]:
            padded.append((padded_start, padded_end))
        else:
            padded[-1] = (padded[-1][0], max(padded[-1][1], padded_end))
    return padded


def merge_units(intervals: list[tuple[int, int]], merge_gap_ms: int, min_unit_ms: int, max_unit_ms: int) -> list[tuple[int, int]]:
    if not intervals:
        return []
    units: list[tuple[int, int]] = []
    current_start, current_end = intervals[0]
    for next_start, next_end in intervals[1:]:
        gap_ms = max(0, next_start - current_end)
        current_duration = current_end - current_start
        proposed_duration = next_end - current_start
        should_merge = (
            gap_ms <= merge_gap_ms
            or current_duration < min_unit_ms
            or (proposed_duration <= min_unit_ms and gap_ms <= max(merge_gap_ms * 3, merge_gap_ms))
        )
        if should_merge and proposed_duration <= max_unit_ms:
            current_end = next_end
            continue
        units.append((current_start, current_end))
        current_start, current_end = next_start, next_end
    if units and (current_end - current_start) < min_unit_ms:
        previous_start, previous_end = units[-1]
        if current_end - previous_start <= max_unit_ms:
            units[-1] = (previous_start, current_end)
        else:
            units.append((current_start, current_end))
    else:
        units.append((current_start, current_end))
    return units


def export_slice(source_path: Path, output_path: Path, global_start_ms: int, duration_ms: int) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            f"{global_start_ms / 1000.0:.3f}",
            "-i",
            str(source_path),
            "-t",
            f"{max(0.001, duration_ms / 1000.0):.3f}",
            "-ac",
            "1",
            "-ar",
            "16000",
            str(output_path),
        ]
    )


def export_compact_track(source_path: Path, output_path: Path, bitrate_kbps: int) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source_path),
            "-vn",
            "-ac",
            "1",
            "-c:a",
            "libopus",
            "-b:a",
            f"{bitrate_kbps}k",
            "-application",
            "voip",
            str(output_path),
        ]
    )


def upsert_audio_artifact(
    conn: psycopg.Connection,
    job: dict[str, Any],
    artifact: dict[str, Any],
) -> str | None:
    row = query_one(
        conn,
        """
insert into audio_artifacts (
  id, session_id, source_file_id, source_chunk_id, created_by_job_id, parent_artifact_id,
  artifact_type, retention_class, lifecycle_status, storage_bucket, storage_path,
  original_filename, mime_type, codec, sample_rate_hz, channels, size_bytes, duration_ms,
  sha256, source_system, source_role, track_key, start_ms, end_ms,
  delete_after_job_type, metadata, created_at, updated_at
)
values (
  gen_random_uuid(), %s::uuid, %s::uuid, %s::uuid, %s::uuid, null,
  %s, %s, 'active', %s, %s,
  %s, %s, %s, %s::integer, %s::integer, %s::bigint, %s::integer,
  %s, 'craig', %s, %s, %s::integer, %s::integer,
  %s, %s::jsonb, now(), now()
)
on conflict (storage_bucket, storage_path) do update set
  source_file_id = coalesce(excluded.source_file_id, audio_artifacts.source_file_id),
  source_chunk_id = coalesce(excluded.source_chunk_id, audio_artifacts.source_chunk_id),
  created_by_job_id = excluded.created_by_job_id,
  artifact_type = excluded.artifact_type,
  retention_class = excluded.retention_class,
  lifecycle_status = 'active',
  original_filename = excluded.original_filename,
  mime_type = excluded.mime_type,
  codec = excluded.codec,
  sample_rate_hz = excluded.sample_rate_hz,
  channels = excluded.channels,
  size_bytes = excluded.size_bytes,
  duration_ms = excluded.duration_ms,
  sha256 = excluded.sha256,
  source_role = excluded.source_role,
  track_key = excluded.track_key,
  start_ms = excluded.start_ms,
  end_ms = excluded.end_ms,
  delete_after_job_type = excluded.delete_after_job_type,
  metadata = coalesce(audio_artifacts.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now()
returning id::text;
""",
        (
            job["session_id"],
            artifact.get("source_file_id"),
            artifact.get("source_chunk_id"),
            job["id"],
            artifact["artifact_type"],
            artifact["retention_class"],
            artifact["storage_bucket"],
            artifact["storage_path"],
            artifact.get("original_filename"),
            artifact.get("mime_type"),
            artifact.get("codec"),
            artifact.get("sample_rate_hz"),
            artifact.get("channels"),
            artifact.get("size_bytes") or 0,
            artifact.get("duration_ms"),
            artifact.get("sha256"),
            artifact.get("source_role"),
            artifact.get("track_key"),
            artifact.get("start_ms"),
            artifact.get("end_ms"),
            artifact.get("delete_after_job_type"),
            Jsonb(artifact.get("metadata") or {}),
        ),
    )
    return row["id"] if row else None


def upsert_slice_row(
    conn: psycopg.Connection,
    chunk: dict[str, Any],
    slice_index: int,
    start_ms: int,
    end_ms: int,
    bucket: str,
    storage_path: str,
    stats: dict[str, Any],
    detection_params: dict[str, Any],
) -> None:
    execute(
        conn,
        """
insert into audio_speech_slices (
  session_id, source_file_id, source_chunk_id, track_key, slice_index,
  start_ms, end_ms, duration_ms, storage_bucket, storage_path, sha256,
  audio_rms, audio_peak, audio_dbfs, probably_silent, silence_dbfs_threshold,
  detection_method, detection_params, transcription_status, metadata, created_at, updated_at
)
values (
  %s::uuid, %s::uuid, %s::uuid, %s, %s::integer,
  %s::integer, %s::integer, %s::integer, %s, %s, %s,
  %s::numeric, %s::integer, %s::numeric, %s::boolean, %s::numeric,
  'ffmpeg_silencedetect', %s::jsonb, 'pending', %s::jsonb, now(), now()
)
on conflict (source_chunk_id, slice_index) do update set
  start_ms = excluded.start_ms,
  end_ms = excluded.end_ms,
  duration_ms = excluded.duration_ms,
  storage_bucket = excluded.storage_bucket,
  storage_path = excluded.storage_path,
  sha256 = excluded.sha256,
  audio_rms = excluded.audio_rms,
  audio_peak = excluded.audio_peak,
  audio_dbfs = excluded.audio_dbfs,
  probably_silent = excluded.probably_silent,
  silence_dbfs_threshold = excluded.silence_dbfs_threshold,
  detection_params = excluded.detection_params,
  metadata = coalesce(audio_speech_slices.metadata, '{}'::jsonb) || excluded.metadata,
  transcription_status = case
    when audio_speech_slices.transcription_status = 'skipped_silence' then 'pending'
    else audio_speech_slices.transcription_status
  end,
  updated_at = now();
""",
        (
            chunk["session_id"],
            chunk["source_file_id"],
            chunk["audio_chunk_id"],
            chunk.get("track_key"),
            slice_index,
            start_ms,
            end_ms,
            max(0, end_ms - start_ms),
            bucket,
            storage_path,
            stats.get("sha256"),
            stats.get("audio_rms"),
            stats.get("audio_peak"),
            stats.get("audio_dbfs"),
            stats.get("probably_silent"),
            stats.get("silence_dbfs_threshold"),
            Jsonb(detection_params),
            Jsonb({"builder": "tools/cloud_speech_slices_worker.py"}),
        ),
    )


def update_chunk_detection(conn: psycopg.Connection, chunk: dict[str, Any], has_speech: bool, detection_params: dict[str, Any]) -> None:
    execute(
        conn,
        """
update audio_chunks
set probably_silent = %s::boolean,
    silence_dbfs_threshold = %s::numeric,
    transcription_status = case when %s::boolean then 'pending' else 'skipped_silence' end,
    metadata = coalesce(metadata, '{}'::jsonb) || %s::jsonb,
    updated_at = now()
where id = %s::uuid;
""",
        (
            not has_speech,
            detection_params.get("noiseDb"),
            has_speech,
            Jsonb({"speechDetection": detection_params, "speechDetected": has_speech}),
            chunk["audio_chunk_id"],
        ),
    )


def delete_existing_slices(conn: psycopg.Connection, chunk_id: str) -> None:
    execute(conn, "delete from audio_speech_slices where source_chunk_id = %s::uuid;", (chunk_id,))


def choose_workset(chunks: list[dict[str, Any]], max_tracks: int, max_chunks: int) -> list[dict[str, Any]]:
    selected_tracks: list[str] = []
    output: list[dict[str, Any]] = []
    for chunk in chunks:
        track = clean_text(chunk.get("track_key"), 120) or "unknown"
        if track not in selected_tracks:
            if len(selected_tracks) >= max_tracks:
                continue
            selected_tracks.append(track)
        if len(output) >= max_chunks:
            break
        output.append(chunk)
    return output


def compact_path(campaign: str, source_session_id: str, track_key: str) -> str:
    return f"campaigns/{campaign}/sessions/{source_session_id}/compact/tracks/{track_key}.opus"


def slice_path(campaign: str, source_session_id: str, track_key: str, chunk_index: int, slice_index: int) -> str:
    return (
        f"campaigns/{campaign}/sessions/{source_session_id}/speech-slices/"
        f"{track_key}/chunk_{chunk_index:04d}/slice_{slice_index:03d}.wav"
    )


def process_compact_track(
    conn: psycopg.Connection,
    s3,
    job: dict[str, Any],
    track_chunks: list[dict[str, Any]],
    track_path: Path,
    tmp_dir: Path,
    args: argparse.Namespace,
) -> dict[str, Any]:
    first = track_chunks[0]
    track_key = clean_text(first.get("track_key"), 120) or "unknown"
    bucket = require_env("R2_BUCKET")
    target_key = compact_path(args.campaign, first["source_session_id"], track_key)
    existing = query_one(
        conn,
        """
select id::text from audio_artifacts
where session_id = %s::uuid
  and artifact_type = 'compact_track_opus'
  and storage_bucket = %s
  and storage_path = %s
  and lifecycle_status in ('active','planned')
limit 1;
""",
        (job["session_id"], bucket, target_key),
    )
    if existing and not args.replace:
        return {"trackKey": track_key, "skipped": True, "reason": "compact_exists", "storagePath": target_key}

    output_path = tmp_dir / "compact" / f"{track_key}.opus"
    if not args.dry_run:
        export_compact_track(track_path, output_path, args.compact_bitrate_kbps)
        upload_file(s3, bucket, target_key, output_path, "audio/ogg")
        upsert_audio_artifact(
            conn,
            job,
            {
                "artifact_type": "compact_track_opus",
                "retention_class": "permanent_compact",
                "storage_bucket": bucket,
                "storage_path": target_key,
                "original_filename": f"{track_key}.opus",
                "mime_type": "audio/ogg",
                "codec": "opus",
                "sample_rate_hz": 48000,
                "channels": 1,
                "size_bytes": output_path.stat().st_size,
                "duration_ms": first.get("source_duration_ms"),
                "sha256": sha256_file(output_path),
                "source_file_id": first["source_file_id"],
                "source_chunk_id": None,
                "source_role": "compact_track",
                "track_key": track_key,
                "delete_after_job_type": None,
                "metadata": {
                    "builder": "tools/cloud_speech_slices_worker.py",
                    "bitrateKbps": args.compact_bitrate_kbps,
                    "sourceTrackPath": first.get("source_path"),
                },
            },
        )
    return {"trackKey": track_key, "storagePath": target_key, "written": not args.dry_run}


def process_chunk(
    conn: psycopg.Connection,
    s3,
    job: dict[str, Any],
    chunk: dict[str, Any],
    track_path: Path,
    tmp_dir: Path,
    args: argparse.Namespace,
) -> dict[str, Any]:
    duration_ms = int(chunk.get("duration_ms") or max(0, int(chunk.get("end_ms") or 0) - int(chunk.get("start_ms") or 0)))
    if duration_ms <= 0:
        return {"chunkId": chunk["audio_chunk_id"], "error": "duration_missing"}

    silences = detect_silences(track_path, int(chunk["start_ms"]), duration_ms, args.noise_db, args.min_silence_seconds)
    intervals = speech_intervals(duration_ms, silences, round(args.min_speech_seconds * 1000), args.padding_ms)
    merged = merge_units(
        intervals,
        round(args.merge_gap_seconds * 1000),
        round(args.min_unit_seconds * 1000),
        round(args.max_unit_seconds * 1000),
    )
    detection_params = {
        "noiseDb": args.noise_db,
        "minSilenceSeconds": args.min_silence_seconds,
        "minSpeechSeconds": args.min_speech_seconds,
        "paddingMs": args.padding_ms,
        "mergeGapSeconds": args.merge_gap_seconds,
        "minUnitSeconds": args.min_unit_seconds,
        "maxUnitSeconds": args.max_unit_seconds,
        "sourceDurationMs": duration_ms,
        "rawSpeechIntervalCount": len(intervals),
        "mergedSpeechIntervalCount": len(merged),
        "worker": "github_actions_ffmpeg",
    }

    if args.replace and not args.dry_run:
        delete_existing_slices(conn, chunk["audio_chunk_id"])

    track_key = clean_text(chunk.get("track_key"), 120) or "unknown"
    bucket = require_env("R2_BUCKET")
    result = {
        "chunkId": chunk["audio_chunk_id"],
        "trackKey": track_key,
        "chunkIndex": chunk.get("chunk_index"),
        "sourceDurationMs": duration_ms,
        "rawSpeechIntervals": len(intervals),
        "mergedSpeechIntervals": len(merged),
        "slices": [],
    }

    if not args.dry_run:
        update_chunk_detection(conn, chunk, bool(merged), detection_params)

    for index, (start_ms, end_ms) in enumerate(merged):
        global_start_ms = int(chunk["start_ms"]) + start_ms
        slice_duration_ms = max(0, end_ms - start_ms)
        target_key = slice_path(args.campaign, chunk["source_session_id"], track_key, int(chunk["chunk_index"]), index)
        local_output = tmp_dir / "speech-slices" / track_key / f"chunk_{int(chunk['chunk_index']):04d}" / f"slice_{index:03d}.wav"
        item = {
            "sliceIndex": index,
            "startMs": start_ms,
            "endMs": end_ms,
            "durationMs": slice_duration_ms,
            "storagePath": target_key,
        }
        if not args.dry_run:
            export_slice(track_path, local_output, global_start_ms, slice_duration_ms)
            stats = {"sha256": sha256_file(local_output)}
            stats.update(wav_audio_stats(local_output, args.noise_db))
            upload_file(s3, bucket, target_key, local_output, "audio/wav")
            upsert_slice_row(conn, chunk, index, start_ms, end_ms, bucket, target_key, stats, detection_params)
            upsert_audio_artifact(
                conn,
                job,
                {
                    "artifact_type": "speech_slice_wav",
                    "retention_class": "delete_after_success",
                    "storage_bucket": bucket,
                    "storage_path": target_key,
                    "original_filename": local_output.name,
                    "mime_type": "audio/wav",
                    "codec": "pcm_s16le",
                    "sample_rate_hz": 16000,
                    "channels": 1,
                    "size_bytes": local_output.stat().st_size,
                    "duration_ms": slice_duration_ms,
                    "sha256": stats.get("sha256"),
                    "source_file_id": chunk["source_file_id"],
                    "source_chunk_id": chunk["audio_chunk_id"],
                    "source_role": "speech_slice",
                    "track_key": track_key,
                    "start_ms": int(chunk["start_ms"]) + start_ms,
                    "end_ms": int(chunk["start_ms"]) + end_ms,
                    "delete_after_job_type": "transcribe_audio",
                    "metadata": {
                        "builder": "tools/cloud_speech_slices_worker.py",
                        "sourceTrackPath": chunk.get("source_path"),
                        "sourceChunkId": chunk["audio_chunk_id"],
                    },
                },
            )
            item.update({"sha256": stats.get("sha256"), "audioDbfs": stats.get("audio_dbfs"), "written": True})
        result["slices"].append(item)

    speech_ms = sum(item["durationMs"] for item in result["slices"])
    result["speechDurationMs"] = speech_ms
    result["reductionPercent"] = round((1 - (speech_ms / duration_ms)) * 100, 2) if duration_ms else 0
    return result


def remaining_chunks(conn: psycopg.Connection, session_id: str) -> int:
    row = query_one(
        conn,
        """
select count(*)::int remaining
from audio_chunks ac
where ac.session_id = %s::uuid
  and coalesce(ac.probably_silent, false) is false
  and not exists (
    select 1 from audio_speech_slices ss where ss.source_chunk_id = ac.id
  );
""",
        (session_id,),
    )
    return int((row or {}).get("remaining") or 0)


def finish_job(conn: psycopg.Connection, job: dict[str, Any], summary: dict[str, Any], failed: bool = False) -> None:
    status = "failed" if failed else ("retrying" if summary.get("remainingChunks", 0) else "succeeded")
    worker_status = "speech_slices_failed" if failed else ("speech_slices_partial" if status == "retrying" else "speech_slices_succeeded")
    execute(
        conn,
        """
update processing_jobs
set status = %s,
    output = coalesce(output, '{}'::jsonb) || %s::jsonb,
    error = %s,
    finished_at = case when %s in ('succeeded','failed') then now() else null end
where id = %s::uuid;
""",
        (
            status,
            Jsonb({"workerStatus": worker_status, "paidAiCostUsd": 0, "summary": summary}),
            clean_text(summary.get("error"), 4000) or None,
            status,
            job["id"],
        ),
    )
    mark_job_step(conn, job["id"], "failed" if failed else ("retrying" if status == "retrying" else "succeeded"), summary, summary.get("error"))


def run(args: argparse.Namespace) -> dict[str, Any]:
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg is required on the worker")
    if not shutil.which("ffprobe"):
        raise RuntimeError("ffprobe is required on the worker")

    conn = db_connect()
    s3 = r2_client()
    source_session_id = clean_text(args.source_session_id, 180)
    job_id = clean_text(args.job_id, 80) or None

    ensure_detect_job(conn, args.campaign, source_session_id)
    job = select_job(conn, args.campaign, source_session_id, job_id) if args.dry_run else claim_job(conn, args.campaign, source_session_id, job_id)
    if not job:
        return {"ok": True, "processed": False, "message": "No cloud_detect_speech_slices job is ready."}

    if not args.dry_run:
        mark_job_step(conn, job["id"], "running", {"worker": "github_actions_ffmpeg", "paidAiCostUsd": 0})

    try:
        all_chunks = fetch_candidate_chunks(conn, job, args.replace)
        workset = choose_workset(all_chunks, args.max_tracks, args.max_chunks)
        chunks_by_track: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for chunk in workset:
            chunks_by_track[clean_text(chunk.get("track_key"), 120) or "unknown"].append(chunk)

        summary: dict[str, Any] = {
            "ok": True,
            "dryRun": args.dry_run,
            "campaignSlug": args.campaign,
            "sourceSessionId": job.get("source_session_id"),
            "jobId": job["id"],
            "candidateChunks": len(all_chunks),
            "processedChunks": 0,
            "processedTracks": len(chunks_by_track),
            "sourceAudioMinutes": 0,
            "speechAudioMinutes": 0,
            "slices": 0,
            "tracks": [],
            "chunks": [],
            "compactTracks": [],
        }

        with tempfile.TemporaryDirectory(prefix="dnd-speech-") as temp_name:
            tmp_dir = Path(temp_name)
            for track_key, track_chunks in chunks_by_track.items():
                first = track_chunks[0]
                local_track = tmp_dir / "tracks" / f"{track_key}.flac"
                download_object(s3, first["source_bucket"], first["source_path"], local_track)
                if args.make_compact:
                    summary["compactTracks"].append(process_compact_track(conn, s3, job, track_chunks, local_track, tmp_dir, args))
                for chunk in track_chunks:
                    chunk_result = process_chunk(conn, s3, job, chunk, local_track, tmp_dir, args)
                    summary["chunks"].append(chunk_result)
                    summary["processedChunks"] += 1
                    summary["sourceAudioMinutes"] += round((chunk_result.get("sourceDurationMs") or 0) / 60000, 3)
                    summary["speechAudioMinutes"] += round((chunk_result.get("speechDurationMs") or 0) / 60000, 3)
                    summary["slices"] += len(chunk_result.get("slices") or [])
                summary["tracks"].append({"trackKey": track_key, "chunks": len(track_chunks)})

        summary["sourceAudioMinutes"] = round(float(summary["sourceAudioMinutes"]), 3)
        summary["speechAudioMinutes"] = round(float(summary["speechAudioMinutes"]), 3)
        summary["estimatedReductionPercent"] = (
            round((1 - (summary["speechAudioMinutes"] / summary["sourceAudioMinutes"])) * 100, 2)
            if summary["sourceAudioMinutes"] else 0
        )
        summary["remainingChunks"] = remaining_chunks(conn, job["session_id"]) if not args.dry_run else max(0, len(all_chunks) - len(workset))
        if not args.dry_run:
            finish_job(conn, job, summary, failed=False)
        return summary
    except Exception as error:  # noqa: BLE001
        summary = {
            "ok": False,
            "dryRun": args.dry_run,
            "jobId": job["id"],
            "sourceSessionId": job.get("source_session_id"),
            "error": str(error),
        }
        if not args.dry_run:
            finish_job(conn, job, summary, failed=True)
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--campaign", default=DEFAULT_CAMPAIGN)
    parser.add_argument("--source-session-id", required=True)
    parser.add_argument("--job-id", default="")
    parser.add_argument("--max-chunks", type=int, default=DEFAULT_MAX_CHUNKS)
    parser.add_argument("--max-tracks", type=int, default=DEFAULT_MAX_TRACKS)
    parser.add_argument("--noise-db", type=float, default=DEFAULT_NOISE_DB)
    parser.add_argument("--min-silence-seconds", type=float, default=DEFAULT_MIN_SILENCE_SECONDS)
    parser.add_argument("--min-speech-seconds", type=float, default=DEFAULT_MIN_SPEECH_SECONDS)
    parser.add_argument("--padding-ms", type=int, default=DEFAULT_PADDING_MS)
    parser.add_argument("--merge-gap-seconds", type=float, default=DEFAULT_MERGE_GAP_SECONDS)
    parser.add_argument("--min-unit-seconds", type=float, default=DEFAULT_MIN_UNIT_SECONDS)
    parser.add_argument("--max-unit-seconds", type=float, default=DEFAULT_MAX_UNIT_SECONDS)
    parser.add_argument("--compact-bitrate-kbps", type=int, default=32)
    parser.add_argument("--make-compact", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--replace", action="store_true")
    parser.add_argument("--write", action="store_true", help="Write R2 objects and Supabase rows")
    args = parser.parse_args()
    args.max_chunks = max(1, min(200, int(args.max_chunks or DEFAULT_MAX_CHUNKS)))
    args.max_tracks = max(1, min(20, int(args.max_tracks or DEFAULT_MAX_TRACKS)))
    args.compact_bitrate_kbps = max(16, min(96, int(args.compact_bitrate_kbps or 32)))
    args.dry_run = not args.write
    return args


def main() -> int:
    args = parse_args()
    try:
        payload = run(args)
        print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True, default=str))
        return 0
    except Exception as error:  # noqa: BLE001
        print(
            json.dumps(
                {"ok": False, "error": str(error), "traceback": traceback.format_exc().splitlines()},
                ensure_ascii=False,
                indent=2,
                default=str,
            ),
            flush=True,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
