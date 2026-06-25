#!/usr/bin/env python3
"""Extract Craig FLAC tracks and prepare mono 16 kHz chunks for transcription tests."""

from __future__ import annotations

import argparse
import subprocess
import zipfile
from pathlib import Path


def run(cmd: list[str]) -> None:
    print("+ " + " ".join(cmd))
    subprocess.check_call(cmd)


def extract(zip_path: Path, extract_dir: Path) -> None:
    extract_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(extract_dir)


def make_chunks(track: Path, out_dir: Path, chunk_seconds: int, sample_seconds: int | None) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    pattern = out_dir / f"{track.stem}_%03d.wav"
    cmd = ["ffmpeg", "-hide_banner", "-y", "-i", str(track)]
    if sample_seconds:
        cmd.extend(["-t", str(sample_seconds)])
    cmd.extend([
        "-ac", "1",
        "-ar", "16000",
        "-f", "segment",
        "-segment_time", str(chunk_seconds),
        str(pattern),
    ])
    run(cmd)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_path", type=Path)
    parser.add_argument("--work-dir", type=Path, default=Path("tmp/craig-work"))
    parser.add_argument("--chunk-seconds", type=int, default=600)
    parser.add_argument("--sample-seconds", type=int, help="Only process the first N seconds of each track for a quick test.")
    parser.add_argument("--track", help="Only process one extracted track filename.")
    args = parser.parse_args()

    extract_dir = args.work_dir / "raw"
    chunks_dir = args.work_dir / "chunks"
    extract(args.zip_path, extract_dir)

    tracks = sorted(extract_dir.glob("*.flac"))
    if args.track:
        tracks = [track for track in tracks if track.name == args.track]
    if not tracks:
        raise SystemExit("No FLAC tracks found.")

    for track in tracks:
        make_chunks(track, chunks_dir, args.chunk_seconds, args.sample_seconds)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
