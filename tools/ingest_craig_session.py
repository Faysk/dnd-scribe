#!/usr/bin/env python3
"""Ingest a Craig multitrack ZIP into a local session folder."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import re
import struct
import subprocess
import wave
import zipfile
from pathlib import Path


SILENCE_DBFS_THRESHOLD = -45.0


def run(cmd: list[str]) -> None:
    print("+ " + " ".join(cmd))
    subprocess.check_call(cmd)


def slug(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9_-]+", "-", value)
    return re.sub(r"-+", "-", value).strip("-")


def track_key(filename: str) -> str:
    stem = Path(filename).stem
    return re.sub(r"^\d+-", "", stem)


def load_map(path: Path) -> dict:
    if not path.exists():
        return {"tracks": {}, "rules": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def wav_audio_stats(path: Path) -> dict:
    if path.suffix.lower() != ".wav":
        return {}
    try:
        with wave.open(str(path), "rb") as source:
            sample_width = source.getsampwidth()
            channels = source.getnchannels()
            frames_count = source.getnframes()
            raw = source.readframes(frames_count)
    except (EOFError, OSError, wave.Error):
        return {}

    if sample_width != 2 or frames_count <= 0:
        return {}

    sample_count = len(raw) // sample_width
    if not sample_count:
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
        "audio_channels_analyzed": channels,
        "audio_rms": round(rms, 2),
        "audio_peak": peak,
        "audio_dbfs": round(dbfs, 2),
        "probably_silent": dbfs < SILENCE_DBFS_THRESHOLD,
        "silence_dbfs_threshold": SILENCE_DBFS_THRESHOLD,
    }


def ffprobe(path: Path) -> dict:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration,size:stream=codec_name,sample_rate,channels",
        "-of",
        "json",
        str(path),
    ]
    return json.loads(subprocess.check_output(cmd, text=True))


def probe_summary(path: Path) -> dict:
    data = ffprobe(path)
    stream = (data.get("streams") or [{}])[0]
    fmt = data.get("format") or {}
    duration = float(fmt.get("duration") or 0)
    size = int(fmt.get("size") or path.stat().st_size)
    summary = {
        "duration_seconds": duration,
        "duration_minutes": round(duration / 60, 2),
        "size_bytes": size,
        "size_mib": round(size / 1024 / 1024, 1),
        "codec": stream.get("codec_name"),
        "sample_rate": int(stream.get("sample_rate") or 0),
        "channels": int(stream.get("channels") or 0),
        "sha256": sha256_file(path),
    }
    summary.update(wav_audio_stats(path))
    return summary


def parse_info(text: str) -> dict:
    result: dict = {"tracks": []}
    in_tracks = False
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("Recording "):
            result["recording_id"] = line.removeprefix("Recording ").strip()
            continue
        if line.startswith("Guild:"):
            result["guild"] = line.split(":", 1)[1].strip()
            continue
        if line.startswith("Channel:"):
            result["channel"] = line.split(":", 1)[1].strip()
            continue
        if line.startswith("Requester:"):
            result["requester"] = line.split(":", 1)[1].strip()
            continue
        if line.startswith("Start time:"):
            result["start_time"] = line.split(":", 1)[1].strip()
            continue
        if line == "Tracks:":
            in_tracks = True
            continue
        if in_tracks:
            match = re.match(r"(?P<handle>.+?)\s+\((?P<discord_id>\d+)\)$", line)
            if match:
                handle = match.group("handle")
                result["tracks"].append(
                    {
                        "handle": handle,
                        "track_key": handle.split("#", 1)[0],
                        "discord_id": match.group("discord_id"),
                    }
                )
    return result


def extract_zip(zip_path: Path, raw_dir: Path) -> list[dict]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    entries = []
    with zipfile.ZipFile(zip_path) as archive:
        for item in archive.infolist():
            entries.append(
                {
                    "filename": item.filename,
                    "file_size": item.file_size,
                    "compressed_size": item.compress_size,
                    "is_flac": item.filename.lower().endswith(".flac"),
                }
            )
        archive.extractall(raw_dir)
    return entries


def make_chunks(track: Path, out_dir: Path, chunk_seconds: int, sample_seconds: int | None) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    pattern = out_dir / "chunk_%03d.wav"
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(track)]
    if sample_seconds:
        cmd.extend(["-t", str(sample_seconds)])
    cmd.extend(
        [
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "segment",
            "-segment_time",
            str(chunk_seconds),
            str(pattern),
        ]
    )
    run(cmd)

    chunks = []
    for chunk in sorted(out_dir.glob("chunk_*.wav")):
        index_match = re.search(r"_(\d+)\.wav$", chunk.name)
        index = int(index_match.group(1)) if index_match else len(chunks)
        summary = probe_summary(chunk)
        start_ms = index * chunk_seconds * 1000
        end_ms = start_ms + round(summary["duration_seconds"] * 1000)
        chunks.append(
            {
                "index": index,
                "filename": chunk.name,
                "path": str(chunk),
                "start_ms": start_ms,
                "end_ms": end_ms,
                **summary,
            }
        )
    return chunks


def build_participant(track: Path, info_tracks: dict[str, dict], mapping: dict) -> dict:
    key = track_key(track.name)
    mapped = mapping.get(key, {})
    info = info_tracks.get(key, {})
    status = mapped.get("status") or "guest_or_unknown"
    return {
        "track_key": key,
        "source_file": track.name,
        "discord_handle": info.get("handle"),
        "discord_id": info.get("discord_id"),
        "person_name": mapped.get("person_name") or key,
        "default_character": mapped.get("default_character") or "Convidado / indefinido",
        "role": mapped.get("role") or "guest",
        "status": status,
        "character_aliases": mapped.get("character_aliases") or [],
        "needs_review": status != "known",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_path", type=Path)
    parser.add_argument("--session-id")
    parser.add_argument("--out-root", type=Path, default=Path("tmp/sessions"))
    parser.add_argument("--map-file", type=Path, default=Path("config/craig_user_map.json"))
    parser.add_argument("--chunk-seconds", type=int, default=600)
    parser.add_argument("--sample-seconds", type=int)
    parser.add_argument("--skip-chunks", action="store_true")
    args = parser.parse_args()

    zip_path = args.zip_path
    if not zip_path.exists():
        raise SystemExit(f"ZIP not found: {zip_path}")

    mapping_data = load_map(args.map_file)
    mapping = mapping_data.get("tracks") or {}

    temp_session_id = args.session_id or slug(zip_path.stem.replace(".flac", ""))
    session_dir = args.out_root / temp_session_id
    raw_dir = session_dir / "raw"
    chunks_dir = session_dir / "chunks"
    session_dir.mkdir(parents=True, exist_ok=True)

    entries = extract_zip(zip_path, raw_dir)
    info_path = raw_dir / "info.txt"
    info_text = info_path.read_text(errors="replace") if info_path.exists() else ""
    info = parse_info(info_text)
    if not args.session_id and info.get("recording_id"):
        session_dir = args.out_root / slug(f"craig-{info['recording_id']}")
        raw_dir = session_dir / "raw"
        chunks_dir = session_dir / "chunks"
        session_dir.mkdir(parents=True, exist_ok=True)
        entries = extract_zip(zip_path, raw_dir)

    info_path = raw_dir / "info.txt"
    info_text = info_path.read_text(errors="replace") if info_path.exists() else ""
    info = parse_info(info_text)
    info_tracks = {item["track_key"]: item for item in info.get("tracks", [])}

    tracks = sorted(raw_dir.glob("*.flac"))
    participants = []
    manifest_tracks = []
    for track in tracks:
        participant = build_participant(track, info_tracks, mapping)
        summary = probe_summary(track)
        track_chunks = []
        if not args.skip_chunks:
            track_chunks = make_chunks(
                track,
                chunks_dir / participant["track_key"],
                args.chunk_seconds,
                args.sample_seconds,
            )
        participants.append(participant)
        manifest_tracks.append(
            {
                **participant,
                "source_path": str(track),
                **summary,
                "chunks": track_chunks,
            }
        )

    manifest = {
        "schema_version": 1,
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
        "session_id": session_dir.name,
        "session_dir": str(session_dir),
        "zip_path": str(zip_path),
        "map_file": str(args.map_file),
        "chunk_seconds": args.chunk_seconds,
        "sample_seconds": args.sample_seconds,
        "chunks_enabled": not args.skip_chunks,
        "craig": info,
        "zip_entries": entries,
        "tracks": manifest_tracks,
        "rules": mapping_data.get("rules") or {},
    }

    (session_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    (session_dir / "participants.json").write_text(json.dumps(participants, ensure_ascii=False, indent=2) + "\n")

    print(f"session_dir={session_dir}")
    print(f"tracks={len(tracks)}")
    print(f"participants={len(participants)}")
    print(f"chunks={sum(len(track['chunks']) for track in manifest_tracks)}")
    print(f"manifest={session_dir / 'manifest.json'}")
    print(f"participants_file={session_dir / 'participants.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
