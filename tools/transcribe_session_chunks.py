#!/usr/bin/env python3
"""Transcribe chunks from an ingested Craig session with resumable outputs."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import time
from pathlib import Path


def load_env(path: Path) -> dict[str, str]:
    values = {}
    if not path.exists():
        return values
    for raw in path.read_text(errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def now() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def call_openai(audio_file: Path, out_file: Path, api_key: str, model: str, language: str | None) -> tuple[int, float]:
    out_file.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "curl",
        "-sS",
        "https://api.openai.com/v1/audio/transcriptions",
        "-H",
        f"Authorization: Bearer {api_key}",
        "-F",
        f"file=@{audio_file}",
        "-F",
        f"model={model}",
        "-F",
        "response_format=json",
        "-o",
        str(out_file),
        "-w",
        "%{http_code}",
    ]
    if language:
        cmd.extend(["-F", f"language={language}"])

    started = time.monotonic()
    http_code = subprocess.check_output(cmd, text=True).strip()
    elapsed = time.monotonic() - started
    return int(http_code or 0), elapsed


def chunk_jobs(manifest: dict, track_filter: str | None, max_chunks: int | None) -> list[dict]:
    jobs = []
    for track in manifest.get("tracks", []):
        if track_filter and track.get("track_key") != track_filter:
            continue
        for chunk in track.get("chunks", []):
            jobs.append(
                {
                    "track": track,
                    "chunk": chunk,
                    "job_id": f"{track['track_key']}/chunk_{chunk['index']:03d}",
                }
            )
    if max_chunks is not None:
        return jobs[:max_chunks]
    return jobs


def build_segment(manifest: dict, track: dict, chunk: dict, response: dict, response_path: Path) -> dict:
    text = response.get("text", "")
    return {
        "session_id": manifest["session_id"],
        "track_key": track["track_key"],
        "speaker_name": track.get("person_name"),
        "default_character": track.get("default_character"),
        "role": track.get("role"),
        "participant_status": track.get("status"),
        "source_file": track.get("source_file"),
        "source_chunk": chunk.get("filename"),
        "source_chunk_path": chunk.get("path"),
        "response_path": str(response_path),
        "chunk_index": chunk.get("index"),
        "start_ms": chunk.get("start_ms"),
        "end_ms": chunk.get("end_ms"),
        "text": text,
        "text_chars": len(text),
        "text_words": len(text.split()),
        "usage": response.get("usage"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session_dir", type=Path)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--track")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--model")
    parser.add_argument("--language", default="pt")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    session_dir = args.session_dir
    manifest_path = session_dir / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit(f"manifest.json not found: {manifest_path}")

    env = load_env(args.env_file)
    api_key = env.get("OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    model = args.model or env.get("OPENAI_TRANSCRIPTION_MODEL") or "gpt-4o-transcribe"
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is missing")

    manifest = read_json(manifest_path)
    out_root = session_dir / "transcripts"
    raw_root = out_root / "raw"
    index_path = out_root / "transcription_index.json"
    segments_path = out_root / "segments.json"

    index = read_json(index_path) if index_path.exists() else {
        "schema_version": 1,
        "session_id": manifest["session_id"],
        "created_at": now(),
        "updated_at": now(),
        "model": model,
        "language": args.language,
        "jobs": {},
    }
    segments = read_json(segments_path) if segments_path.exists() else []
    segments_by_id = {f"{item['track_key']}/chunk_{item['chunk_index']:03d}": item for item in segments}

    jobs = chunk_jobs(manifest, args.track, args.limit)
    processed = 0
    skipped = 0
    failed = 0

    for job in jobs:
        track = job["track"]
        chunk = job["chunk"]
        job_id = job["job_id"]
        response_path = raw_root / track["track_key"] / f"chunk_{chunk['index']:03d}.json"
        existing = index["jobs"].get(job_id)
        if existing and existing.get("status") == "succeeded" and response_path.exists() and not args.force:
            skipped += 1
            continue

        audio_file = Path(chunk["path"])
        print(f"transcribing {job_id} {audio_file}")
        started_at = now()
        try:
            http_code, elapsed = call_openai(audio_file, response_path, api_key, model, args.language)
            response = read_json(response_path) if response_path.exists() else {}
            status = "succeeded" if http_code == 200 else "failed"
            if status == "succeeded":
                segment = build_segment(manifest, track, chunk, response, response_path)
                segments_by_id[job_id] = segment
                processed += 1
            else:
                failed += 1
            index["jobs"][job_id] = {
                "status": status,
                "http_code": http_code,
                "started_at": started_at,
                "finished_at": now(),
                "elapsed_seconds": round(elapsed, 3),
                "track_key": track["track_key"],
                "chunk_index": chunk["index"],
                "audio_file": str(audio_file),
                "response_path": str(response_path),
                "text_chars": len(response.get("text", "")),
                "text_words": len(response.get("text", "").split()),
                "usage": response.get("usage"),
            }
            print(f"  -> {status} http={http_code} chars={index['jobs'][job_id]['text_chars']} elapsed={elapsed:.2f}s")
        except Exception as exc:  # noqa: BLE001 - capture resumable job failure.
            failed += 1
            index["jobs"][job_id] = {
                "status": "failed",
                "error": type(exc).__name__,
                "message": str(exc),
                "started_at": started_at,
                "finished_at": now(),
                "track_key": track["track_key"],
                "chunk_index": chunk["index"],
                "audio_file": str(audio_file),
                "response_path": str(response_path),
            }
            print(f"  -> failed {type(exc).__name__}: {exc}")

        index["updated_at"] = now()
        write_json(index_path, index)
        write_json(segments_path, list(segments_by_id.values()))

    write_json(segments_path, sorted(segments_by_id.values(), key=lambda item: (item["start_ms"], item["track_key"])))
    index["updated_at"] = now()
    index["summary"] = {
        "requested_jobs": len(jobs),
        "processed": processed,
        "skipped": skipped,
        "failed": failed,
        "succeeded_total": sum(1 for item in index["jobs"].values() if item.get("status") == "succeeded"),
        "failed_total": sum(1 for item in index["jobs"].values() if item.get("status") == "failed"),
    }
    write_json(index_path, index)

    print(f"processed={processed} skipped={skipped} failed={failed}")
    print(f"index={index_path}")
    print(f"segments={segments_path}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
