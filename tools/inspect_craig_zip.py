#!/usr/bin/env python3
"""Inspect a Craig multitrack ZIP and optionally extract/probe FLAC tracks."""

from __future__ import annotations

import argparse
import json
import subprocess
import zipfile
import re
from pathlib import Path


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


def load_map(path: Path | None) -> dict:
    if not path or not path.exists():
        return {}
    return json.loads(path.read_text()).get("tracks", {})


def track_key(filename: str) -> str:
    stem = Path(filename).stem
    return re.sub(r"^\d+-", "", stem)


def inspect_zip(zip_path: Path) -> list[dict]:
    with zipfile.ZipFile(zip_path) as archive:
        rows = []
        for item in archive.infolist():
            rows.append(
                {
                    "filename": item.filename,
                    "file_size": item.file_size,
                    "compressed_size": item.compress_size,
                    "is_flac": item.filename.lower().endswith(".flac"),
                }
            )
        return rows


def extract(zip_path: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(out_dir)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_path", type=Path)
    parser.add_argument("--extract-dir", type=Path)
    parser.add_argument("--map-file", type=Path, default=Path("config/craig_user_map.json"))
    parser.add_argument("--probe", action="store_true", help="Probe extracted FLAC files with ffprobe.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    args = parser.parse_args()

    zip_path = args.zip_path
    rows = inspect_zip(zip_path)
    user_map = load_map(args.map_file)
    result = {"zip_path": str(zip_path), "map_file": str(args.map_file) if args.map_file else None, "entries": rows, "tracks": []}

    if args.extract_dir:
        extract(zip_path, args.extract_dir)
        info_path = args.extract_dir / "info.txt"
        if info_path.exists():
            result["info_txt"] = info_path.read_text(errors="replace")

    if args.probe:
        if not args.extract_dir:
            raise SystemExit("--probe requires --extract-dir")
        for track in sorted(args.extract_dir.glob("*.flac")):
            data = ffprobe(track)
            stream = (data.get("streams") or [{}])[0]
            fmt = data.get("format") or {}
            duration = float(fmt.get("duration") or 0)
            size = int(fmt.get("size") or track.stat().st_size)
            mapped = user_map.get(track_key(track.name), {})
            result["tracks"].append(
                {
                    "filename": track.name,
                    "track_key": track_key(track.name),
                    "person_name": mapped.get("person_name"),
                    "default_character": mapped.get("default_character"),
                    "role": mapped.get("role"),
                    "status": mapped.get("status"),
                    "duration_seconds": duration,
                    "duration_minutes": round(duration / 60, 2),
                    "size_mib": round(size / 1024 / 1024, 1),
                    "codec": stream.get("codec_name"),
                    "sample_rate": stream.get("sample_rate"),
                    "channels": stream.get("channels"),
                }
            )

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"ZIP: {zip_path}")
        for entry in rows:
            print(f"- {entry['filename']} ({entry['file_size']} bytes)")
        if result.get("tracks"):
            print("\nTracks:")
            for track in result["tracks"]:
                who = ""
                if track.get("person_name"):
                    who = f" -> {track['person_name']} / {track.get('default_character') or 'indefinido'}"
                print(
                    "- {filename}: {duration_minutes} min, {size_mib} MiB, {codec}, {sample_rate} Hz, {channels} ch{who}".format(
                        who=who, **track
                    )
                )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
