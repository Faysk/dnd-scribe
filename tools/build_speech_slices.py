#!/usr/bin/env python3
"""Build speech-only audio slices from local Craig chunks."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from typing import Any

from backfill_audio_metadata import (
    ROOT,
    execute,
    load_env,
    resolve_path,
    run_json,
    sha256_file,
    sql_bool,
    sql_json,
    sql_literal,
    sql_optional_number,
    sql_optional_text,
    wav_audio_stats,
)


DEFAULT_CAMPAIGN = "yuhara-main"
DEFAULT_NOISE_DB = -45.0
DEFAULT_MIN_SILENCE_SECONDS = 1.0
DEFAULT_MIN_SPEECH_SECONDS = 2.0
DEFAULT_PADDING_MS = 250
DEFAULT_MERGE_GAP_SECONDS = 2.5
DEFAULT_MIN_UNIT_SECONDS = 12.0
DEFAULT_MAX_UNIT_SECONDS = 90.0


def fetch_chunks(database_url: str, campaign_slug: str, source_session_id: str, limit: int, replace: bool) -> list[dict[str, Any]]:
    existing_filter = ""
    if not replace:
        existing_filter = """
    and not exists (
      select 1
      from audio_speech_slices ss
      where ss.source_chunk_id = ac.id
    )
"""
    sql = f"""
select coalesce(json_agg(row_to_json(row) order by row.track_key, row.chunk_index), '[]'::json) from (
  select
    ac.id::text audio_chunk_id,
    ac.session_id::text session_id,
    ac.source_file_id::text source_file_id,
    s.source_session_id,
    ac.track_key,
    ac.chunk_index,
    ac.start_ms,
    ac.end_ms,
    coalesce(ac.duration_ms, greatest(0, coalesce(ac.end_ms, 0) - coalesce(ac.start_ms, 0)), 0)::int duration_ms,
    ac.storage_path,
    ac.sha256,
    ac.audio_dbfs,
    ac.probably_silent
  from audio_chunks ac
  join sessions s on s.id = ac.session_id
  join campaigns c on c.id = s.campaign_id
  where c.slug = {sql_literal(campaign_slug)}
    and s.source_session_id = {sql_literal(source_session_id)}
    and ac.storage_bucket = 'local'
    and nullif(ac.storage_path, '') is not null
    and coalesce(ac.probably_silent, false) is false
    {existing_filter}
  order by ac.track_key, ac.chunk_index
  limit {int(limit)}
) row;
"""
    return run_json(database_url, sql) or []


def ffprobe_duration_ms(path: Path) -> int | None:
    try:
        output = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
            text=True,
            encoding="utf-8",
        )
        duration = float((json.loads(output).get("format") or {}).get("duration") or 0)
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError, json.JSONDecodeError):
        return None
    return round(duration * 1000) if duration > 0 else None


def detect_silences(path: Path, noise_db: float, min_silence_seconds: float) -> list[tuple[int, int | None]]:
    process = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(path),
            "-af",
            f"silencedetect=n={noise_db}dB:d={min_silence_seconds}",
            "-f",
            "null",
            "-",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
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


def speech_intervals(
    duration_ms: int,
    silences: list[tuple[int, int | None]],
    min_speech_ms: int,
    padding_ms: int,
) -> list[tuple[int, int]]:
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
    for start_ms, end_ms in raw:
        padded_start = max(0, start_ms - padding_ms)
        padded_end = min(duration_ms, end_ms + padding_ms)
        if not padded or padded_start > padded[-1][1]:
            padded.append((padded_start, padded_end))
        else:
            padded[-1] = (padded[-1][0], max(padded[-1][1], padded_end))
    return padded


def merge_transcription_units(
    intervals: list[tuple[int, int]],
    merge_gap_ms: int,
    min_unit_ms: int,
    max_unit_ms: int,
) -> list[tuple[int, int]]:
    """Merge nearby speech intervals into context-friendly transcription units.

    Very small phrase-sized files create many paid requests and weak context.
    This keeps the silence trimming benefit while avoiding word/phrase-sized
    uploads to the transcription provider.
    """
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


def slice_output_path(source_session_id: str, track_key: str | None, chunk_index: int, slice_index: int) -> Path:
    track = track_key or "unknown"
    return (
        ROOT
        / "tmp"
        / "sessions"
        / source_session_id
        / "speech_slices"
        / track
        / f"chunk_{chunk_index:03d}"
        / f"slice_{slice_index:03d}.wav"
    )


def export_slice(source_path: Path, output_path: Path, start_ms: int, end_ms: int) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    duration_seconds = max(0.001, (end_ms - start_ms) / 1000.0)
    subprocess.check_call(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source_path),
            "-ss",
            f"{start_ms / 1000.0:.3f}",
            "-t",
            f"{duration_seconds:.3f}",
            "-ac",
            "1",
            "-ar",
            "16000",
            str(output_path),
        ]
    )


def delete_existing_slices(database_url: str, chunk_id: str) -> None:
    execute(database_url, f"delete from audio_speech_slices where source_chunk_id = {sql_literal(chunk_id)}::uuid;")


def upsert_slice(
    database_url: str,
    chunk: dict[str, Any],
    slice_index: int,
    start_ms: int,
    end_ms: int,
    output_path: Path,
    stats: dict[str, Any],
    detection_params: dict[str, Any],
) -> None:
    duration_ms = max(0, end_ms - start_ms)
    metadata = {
        "sourceChunkPath": chunk.get("storage_path"),
        "sourceChunkSha256": chunk.get("sha256"),
        "builder": "tools/build_speech_slices.py",
    }
    execute(
        database_url,
        f"""
insert into audio_speech_slices (
  session_id, source_file_id, source_chunk_id, track_key, slice_index,
  start_ms, end_ms, duration_ms, storage_bucket, storage_path, sha256,
  audio_rms, audio_peak, audio_dbfs, probably_silent, silence_dbfs_threshold,
  detection_method, detection_params, transcription_status, metadata, created_at, updated_at
) values (
  {sql_literal(chunk['session_id'])}::uuid,
  {sql_literal(chunk['source_file_id'])}::uuid,
  {sql_literal(chunk['audio_chunk_id'])}::uuid,
  {sql_optional_text(chunk.get('track_key'))},
  {int(slice_index)},
  {int(start_ms)},
  {int(end_ms)},
  {int(duration_ms)},
  'local',
  {sql_literal(str(output_path.relative_to(ROOT)))},
  {sql_optional_text(stats.get('sha256'))},
  {sql_optional_number(stats.get('audio_rms'))},
  {sql_optional_number(stats.get('audio_peak'))},
  {sql_optional_number(stats.get('audio_dbfs'))},
  {sql_bool(stats.get('probably_silent'))},
  {sql_optional_number(stats.get('silence_dbfs_threshold'))},
  'ffmpeg_silencedetect',
  {sql_json(detection_params)},
  case when {sql_bool(stats.get('probably_silent'))} then 'skipped_silence' else 'pending' end,
  {sql_json(metadata)},
  now(),
  now()
)
on conflict (source_chunk_id, slice_index)
do update set
  start_ms = excluded.start_ms,
  end_ms = excluded.end_ms,
  duration_ms = excluded.duration_ms,
  storage_path = excluded.storage_path,
  sha256 = excluded.sha256,
  audio_rms = excluded.audio_rms,
  audio_peak = excluded.audio_peak,
  audio_dbfs = excluded.audio_dbfs,
  probably_silent = excluded.probably_silent,
  silence_dbfs_threshold = excluded.silence_dbfs_threshold,
  detection_params = excluded.detection_params,
  metadata = coalesce(audio_speech_slices.metadata, '{{}}'::jsonb) || excluded.metadata,
  transcription_status = case
    when excluded.probably_silent is true then 'skipped_silence'
    when audio_speech_slices.transcription_status = 'skipped_silence' then 'pending'
    else audio_speech_slices.transcription_status
  end,
  updated_at = now();
""",
    )


def process_chunk(
    database_url: str,
    chunk: dict[str, Any],
    args: argparse.Namespace,
) -> dict[str, Any]:
    source_path = resolve_path(chunk["storage_path"])
    result: dict[str, Any] = {
        "audioChunkId": chunk["audio_chunk_id"],
        "trackKey": chunk.get("track_key"),
        "chunkIndex": chunk.get("chunk_index"),
        "sourcePath": str(source_path),
        "exists": source_path.exists(),
        "slices": [],
    }
    if not source_path.exists():
        result["error"] = "source_file_missing"
        return result

    duration_ms = int(chunk.get("duration_ms") or 0) or ffprobe_duration_ms(source_path) or 0
    if duration_ms <= 0:
        result["error"] = "duration_missing"
        return result

    silences = detect_silences(source_path, args.noise_db, args.min_silence_seconds)
    intervals = speech_intervals(
        duration_ms,
        silences,
        round(args.min_speech_seconds * 1000),
        args.padding_ms,
    )
    merged_intervals = merge_transcription_units(
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
        "rawSpeechIntervals": [{"startMs": start, "endMs": end} for start, end in intervals],
        "rawSpeechIntervalCount": len(intervals),
        "mergedSpeechIntervalCount": len(merged_intervals),
    }

    if args.write and args.replace:
        delete_existing_slices(database_url, chunk["audio_chunk_id"])

    speech_ms = 0
    for index, (start_ms, end_ms) in enumerate(merged_intervals):
        speech_ms += end_ms - start_ms
        output_path = slice_output_path(
            chunk["source_session_id"],
            chunk.get("track_key"),
            int(chunk.get("chunk_index") or 0),
            index,
        )
        slice_result: dict[str, Any] = {
            "sliceIndex": index,
            "startMs": start_ms,
            "endMs": end_ms,
            "durationMs": end_ms - start_ms,
            "path": str(output_path),
        }
        if args.write:
            export_slice(source_path, output_path, start_ms, end_ms)
            stats: dict[str, Any] = {"sha256": sha256_file(output_path)}
            stats.update(wav_audio_stats(output_path))
            upsert_slice(database_url, chunk, index, start_ms, end_ms, output_path, stats, detection_params)
            slice_result.update(
                {
                    "sha256": stats.get("sha256"),
                    "audioDbfs": stats.get("audio_dbfs"),
                    "probablySilent": stats.get("probably_silent"),
                    "written": True,
                }
            )
        result["slices"].append(slice_result)

    result["sourceDurationMs"] = duration_ms
    result["speechDurationMs"] = speech_ms
    result["rawSpeechIntervals"] = len(intervals)
    result["mergedSpeechIntervals"] = len(merged_intervals)
    result["reductionPercent"] = round((1 - (speech_ms / duration_ms)) * 100, 2) if duration_ms else 0
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_session_id")
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env.local")
    parser.add_argument("--campaign", default=DEFAULT_CAMPAIGN)
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--noise-db", type=float, default=DEFAULT_NOISE_DB)
    parser.add_argument("--min-silence-seconds", type=float, default=DEFAULT_MIN_SILENCE_SECONDS)
    parser.add_argument("--min-speech-seconds", type=float, default=DEFAULT_MIN_SPEECH_SECONDS)
    parser.add_argument("--padding-ms", type=int, default=DEFAULT_PADDING_MS)
    parser.add_argument("--merge-gap-seconds", type=float, default=DEFAULT_MERGE_GAP_SECONDS)
    parser.add_argument("--min-unit-seconds", type=float, default=DEFAULT_MIN_UNIT_SECONDS)
    parser.add_argument("--max-unit-seconds", type=float, default=DEFAULT_MAX_UNIT_SECONDS)
    parser.add_argument("--replace", action="store_true")
    parser.add_argument("--write", action="store_true", help="Write slice WAV files and upsert Supabase rows")
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    env = load_env(args.env_file)
    database_url = env.get("DATABASE_URL")
    if not database_url:
        raise SystemExit(f"DATABASE_URL not found in {args.env_file}")

    chunks = fetch_chunks(database_url, args.campaign, args.source_session_id, args.limit, args.replace)
    results = [process_chunk(database_url, chunk, args) for chunk in chunks]
    source_ms = sum(int(item.get("sourceDurationMs") or 0) for item in results)
    speech_ms = sum(int(item.get("speechDurationMs") or 0) for item in results)
    missing = sum(1 for item in results if not item.get("exists"))
    payload = {
        "write": args.write,
        "sourceSessionId": args.source_session_id,
        "chunks": len(chunks),
        "sourceAudioMinutes": round(source_ms / 60000, 3),
        "speechAudioMinutes": round(speech_ms / 60000, 3),
        "estimatedReductionPercent": round((1 - (speech_ms / source_ms)) * 100, 2) if source_ms else 0,
        "missingFiles": missing,
        "results": results,
    }

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"write={str(args.write).lower()}")
        print(f"chunks={payload['chunks']}")
        print(f"source_audio_minutes={payload['sourceAudioMinutes']}")
        print(f"speech_audio_minutes={payload['speechAudioMinutes']}")
        print(f"estimated_reduction_percent={payload['estimatedReductionPercent']}")
        print(f"missing_files={payload['missingFiles']}")
        for item in results:
            print(
                f"{item.get('trackKey')}#{item.get('chunkIndex')} "
                f"slices={len(item.get('slices') or [])} raw={item.get('rawSpeechIntervals')} "
                f"merged={item.get('mergedSpeechIntervals')} reduction={item.get('reductionPercent')}%"
            )
    return 1 if args.strict and missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
