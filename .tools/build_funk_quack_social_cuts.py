#!/usr/bin/env python3
"""Render reusable Shorts/TikTok cuts from a synchronized vertical master."""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
from pathlib import Path


ROOT = Path(r"D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha")
TOOLS = Path(r"D:\Projects\dnd\.tools")
DEFAULT_PLAN = ROOT / "docs" / "cortes_short_funk_quack.csv"
DEFAULT_MASTER = ROOT / "videos" / "9x16" / "animado_sync" / "funk_quack_do_dandi_9x16_4k_animado_sync.mp4"
DEFAULT_FFMPEG = TOOLS / "ffmpeg" / "ffmpeg-8.1.2-essentials_build" / "bin" / "ffmpeg.exe"
DEFAULT_FFPROBE = DEFAULT_FFMPEG.with_name("ffprobe.exe")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--master", type=Path)
    parser.add_argument("--plan", type=Path)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--profile", choices=("master4k", "delivery1080"), default="delivery1080")
    parser.add_argument("--encoder", choices=("auto", "h264_nvenc", "libx264"), default="auto")
    parser.add_argument("--only", help="Comma-separated cut ids or slugs")
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def tool(path: Path, name: str) -> Path:
    if path.exists():
        return path
    found = shutil.which(name)
    if found:
        return Path(found)
    raise SystemExit(f"{name} not found")


def run(command: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(
        command,
        check=False,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    if result.returncode:
        details = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"command failed ({result.returncode}): {' '.join(command)}\n{details}")
    return result.stdout or ""


def load_plan(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter=";"))
    errors: list[str] = []
    for row in rows:
        start = float(row["start_s"])
        end = float(row["end_s"])
        declared = float(row["duration_s"])
        if start < 0 or end <= start:
            errors.append(f"{row['id']}: invalid range {start}-{end}")
        if abs((end - start) - declared) > 0.002:
            errors.append(f"{row['id']}: duration does not match range")
        if declared > 60:
            errors.append(f"{row['id']}: default social cut exceeds 60 seconds")
    if errors:
        raise SystemExit("invalid cut plan:\n" + "\n".join(errors))
    return rows


def select_rows(rows: list[dict[str, str]], selected: str | None) -> list[dict[str, str]]:
    if not selected:
        return rows
    wanted = {value.strip().lower() for value in selected.split(",") if value.strip()}
    result = [row for row in rows if row["id"].lower() in wanted or row["slug"].lower() in wanted]
    missing = wanted - {row["id"].lower() for row in result} - {row["slug"].lower() for row in result}
    if missing:
        raise SystemExit(f"unknown cut selection: {', '.join(sorted(missing))}")
    return result


def probe(ffprobe: Path, path: Path) -> dict[str, object]:
    output = run(
        [
            str(ffprobe),
            "-v",
            "error",
            "-show_entries",
            "stream=index,codec_type,width,height:format=duration",
            "-of",
            "json",
            str(path),
        ],
        capture=True,
    )
    return json.loads(output)


def choose_encoder(ffmpeg: Path, requested: str) -> str:
    encoders = run([str(ffmpeg), "-hide_banner", "-encoders"], capture=True)
    if requested == "auto":
        return "h264_nvenc" if "h264_nvenc" in encoders else "libx264"
    if requested not in encoders:
        raise SystemExit(f"encoder not available: {requested}")
    return requested


def encoder_options(encoder: str) -> list[str]:
    if encoder == "h264_nvenc":
        return [
            "-c:v",
            "h264_nvenc",
            "-preset",
            "p6",
            "-tune",
            "hq",
            "-rc:v",
            "vbr",
            "-cq:v",
            "18",
            "-b:v",
            "0",
            "-spatial-aq",
            "1",
        ]
    return ["-c:v", "libx264", "-preset", "slow", "-crf", "18"]


def output_is_valid(ffprobe: Path, path: Path, width: int, height: int, duration: float) -> bool:
    if not path.exists() or path.stat().st_size < 1024:
        return False
    try:
        data = probe(ffprobe, path)
        video = next(stream for stream in data["streams"] if stream["codec_type"] == "video")
        audio = next((stream for stream in data["streams"] if stream["codec_type"] == "audio"), None)
        return (
            int(video["width"]) == width
            and int(video["height"]) == height
            and audio is not None
            and abs(float(data["format"]["duration"]) - duration) <= 0.08
        )
    except (OSError, RuntimeError, ValueError, KeyError, StopIteration, json.JSONDecodeError):
        return False


def main() -> int:
    args = parse_args()
    ffmpeg = tool(DEFAULT_FFMPEG, "ffmpeg")
    ffprobe = tool(DEFAULT_FFPROBE, "ffprobe")
    master = args.master or DEFAULT_MASTER
    plan = args.plan or DEFAULT_PLAN
    rows = select_rows(load_plan(plan), args.only)
    width, height = (2160, 3840) if args.profile == "master4k" else (1080, 1920)
    output_dir = args.output_dir or (
        args.root / "videos" / "9x16" / f"cortes_sociais_{args.profile}"
    )

    summary = {
        "master": str(master),
        "plan": str(plan),
        "cuts": len(rows),
        "profile": args.profile,
        "canvas": f"{width}x{height}",
        "output_dir": str(output_dir),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if not master.exists():
        print("MASTER PENDING")
        if args.validate_only:
            print("PLAN PRECHECK OK")
            return 0
        return 2
    source_info = probe(ffprobe, master)
    if float(source_info["format"]["duration"]) + 0.05 < max(float(row["end_s"]) for row in rows):
        raise SystemExit("master is shorter than the cut plan")
    if args.validate_only:
        print("PRECHECK OK")
        return 0

    encoder = choose_encoder(ffmpeg, args.encoder)
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_rows: list[dict[str, str]] = []
    for row in rows:
        duration = float(row["duration_s"])
        destination = output_dir / f"{row['id']}_{row['slug']}.mp4"
        manifest_rows.append({**row, "arquivo": str(destination)})
        if not args.force and output_is_valid(ffprobe, destination, width, height, duration):
            print(f"SKIP {row['id']}: {destination.name}")
            continue
        temporary = destination.with_name(destination.stem + ".tmp.mp4")
        temporary.unlink(missing_ok=True)
        run(
            [
                str(ffmpeg),
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-ss",
                row["start_s"],
                "-i",
                str(master),
                "-t",
                row["duration_s"],
                "-vf",
                f"scale={width}:{height}:flags=lanczos,setsar=1",
                "-map",
                "0:v:0",
                "-map",
                "0:a:0",
                *encoder_options(encoder),
                "-c:a",
                "aac",
                "-b:a",
                "256k",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                str(temporary),
            ]
        )
        if not output_is_valid(ffprobe, temporary, width, height, duration):
            raise RuntimeError(f"cut failed validation: {temporary}")
        temporary.replace(destination)
        print(f"SAVED {row['id']}: {destination.name}")

    manifest = output_dir / "manifest_cortes.csv"
    with manifest.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=manifest_rows[0].keys(), delimiter=";")
        writer.writeheader()
        writer.writerows(manifest_rows)
    print(f"CUTS READY: {output_dir}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
    except RuntimeError as exc:
        print(str(exc))
        raise SystemExit(1)
