#!/usr/bin/env python3
"""Batch ComfyUI LTX 2.3 image-to-video jobs for Funk Quack."""

from __future__ import annotations

import argparse
import csv
import json
import mimetypes
import os
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error, parse, request


PROJECT = Path(r"D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha")
DEFAULT_WORKFLOW = PROJECT / "Confyui" / "video_ltx2_3_i2v (1).json"
DEFAULT_STORYBOARD = PROJECT / "docs" / "storyboard_linha_a_linha.csv"
DEFAULT_FFMPEG = Path(
    r"D:\Projects\dnd\.tools\ffmpeg\ffmpeg-8.1.2-essentials_build\bin\ffmpeg.exe"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Queue Funk Quack still images as 5s LTX 2.3 ComfyUI clips."
    )
    parser.add_argument("--server", default="http://127.0.0.1:8188")
    parser.add_argument("--workflow", default=str(DEFAULT_WORKFLOW))
    parser.add_argument("--storyboard", default=str(DEFAULT_STORYBOARD))
    parser.add_argument("--orientation", choices=("horizontal", "vertical"), default="horizontal")
    parser.add_argument("--start-id", type=int, default=1)
    parser.add_argument("--end-id", type=int, default=147)
    parser.add_argument("--limit", type=int)
    parser.add_argument(
        "--output-set",
        default="prompt_direto_v4_sem_audio",
        help="Suffix for remake output folders/prefixes. Use an empty value to target legacy folders.",
    )
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--poll-interval", type=float, default=5.0)
    parser.add_argument("--timeout", type=float, default=60.0 * 60.0)
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_storyboard(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        return list(reader)


def http_json(method: str, url: str, payload: dict[str, Any] | None = None) -> Any:
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = request.Request(url, data=body, headers=headers, method=method)
    with request.urlopen(req, timeout=60) as response:
        raw = response.read()
    if not raw:
        return None
    return json.loads(raw.decode("utf-8"))


def upload_image(server: str, image_path: Path) -> str:
    boundary = "----CodexBoundary" + uuid.uuid4().hex
    mime = mimetypes.guess_type(str(image_path))[0] or "application/octet-stream"
    data = image_path.read_bytes()

    parts: list[bytes] = []

    def add_field(name: str, value: str) -> None:
        parts.append(f"--{boundary}\r\n".encode("ascii"))
        parts.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("ascii"))
        parts.append(value.encode("utf-8"))
        parts.append(b"\r\n")

    add_field("type", "input")
    add_field("overwrite", "true")

    parts.append(f"--{boundary}\r\n".encode("ascii"))
    disposition = f'Content-Disposition: form-data; name="image"; filename="{image_path.name}"\r\n'
    parts.append(disposition.encode("utf-8"))
    parts.append(f"Content-Type: {mime}\r\n\r\n".encode("ascii"))
    parts.append(data)
    parts.append(b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode("ascii"))

    req = request.Request(
        server.rstrip("/") + "/upload/image",
        data=b"".join(parts),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with request.urlopen(req, timeout=120) as response:
        result = json.loads(response.read().decode("utf-8"))

    name = result.get("name") or image_path.name
    subfolder = result.get("subfolder") or ""
    return f"{subfolder}/{name}" if subfolder else name


def positive_prompt(row: dict[str, str], orientation: str) -> str:
    lyric = row["lyric_or_beat"].strip()
    visual = row["visual_direction"].strip()
    camera = row["camera"].strip()
    motion = row["motion_hint"].strip()
    framing = (
        "horizontal 16:9 music-video framing"
        if orientation == "horizontal"
        else "vertical 9:16 shorts framing, phone-readable characters"
    )
    return (
        "Use the input image as the exact visual reference. Preserve the same characters, "
        "costumes, colors, composition, lighting, and family-friendly 3D storybook style. "
        f"Animate a smooth 5 second moment for the beat or lyric: {lyric}. "
        f"Scene direction: {visual}. Camera style: {camera}. Motion cue: {motion}. "
        f"Keep {framing}. Add gentle musical energy: floating notes, soft sparkles, "
        "friendly smiles, subtle fabric and feather movement, warm magical glow, and smooth "
        "cinematic movement. Focus only on visual animation for later editing with the original song; "
        "no speech or narration is needed. No text, no captions, no logo, no watermark, no scary tone, no weapons."
    )


def configure_prompt(
    workflow: dict[str, Any],
    row: dict[str, str],
    uploaded_image: str,
    output_prefix: str,
    orientation: str,
) -> dict[str, Any]:
    prompt = json.loads(json.dumps(workflow))

    if orientation == "horizontal":
        width, height = 1280, 720
    else:
        width, height = 720, 1280

    line_id = int(row["id"])
    prompt["269"]["inputs"]["image"] = uploaded_image
    prompt["320:319"]["inputs"]["value"] = positive_prompt(row, orientation)
    prompt["320:312"]["inputs"]["value"] = width
    prompt["320:299"]["inputs"]["value"] = height
    prompt["320:301"]["inputs"]["value"] = 5
    prompt["320:300"]["inputs"]["value"] = 25
    prompt["320:277"]["inputs"]["noise_seed"] = 478647080165676 + line_id
    if "320:328" in prompt:
        prompt["320:328"]["inputs"]["value"] = False
    prompt["75"]["inputs"]["filename_prefix"] = output_prefix
    return prompt


def queue_prompt(server: str, prompt: dict[str, Any], client_id: str) -> str:
    payload = {"prompt": prompt, "client_id": client_id}
    result = http_json("POST", server.rstrip("/") + "/prompt", payload)
    return result["prompt_id"]


def collect_outputs(value: Any) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(value, dict):
        if "filename" in value and "type" in value:
            found.append(value)
        for child in value.values():
            found.extend(collect_outputs(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(collect_outputs(child))
    return found


def wait_for_output(server: str, prompt_id: str, poll_interval: float, timeout: float) -> dict[str, Any]:
    start = time.monotonic()
    history_url = server.rstrip("/") + "/history/" + parse.quote(prompt_id)
    while True:
        if time.monotonic() - start > timeout:
            raise TimeoutError(f"Timed out waiting for ComfyUI prompt {prompt_id}")

        result = http_json("GET", history_url)
        item = result.get(prompt_id) if isinstance(result, dict) else None
        if item:
            status = item.get("status", {})
            if status.get("status_str") in {"error", "failed"}:
                raise RuntimeError(json.dumps(status, ensure_ascii=False, indent=2))
            outputs = collect_outputs(item.get("outputs", {}))
            video_outputs = [
                output
                for output in outputs
                if str(output.get("filename", "")).lower().endswith((".mp4", ".webm", ".mov", ".mkv"))
            ]
            if video_outputs:
                return video_outputs[-1]
        time.sleep(poll_interval)


def strip_audio(source: Path, destination: Path) -> None:
    ffmpeg = DEFAULT_FFMPEG if DEFAULT_FFMPEG.exists() else "ffmpeg"
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            str(ffmpeg),
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-map",
            "0:v:0",
            "-c:v",
            "copy",
            "-an",
            "-movflags",
            "+faststart",
            str(destination),
        ],
        check=True,
        capture_output=True,
        text=True,
    )


def download_output(server: str, output: dict[str, Any], destination: Path) -> None:
    query = parse.urlencode(
        {
            "filename": output.get("filename", ""),
            "subfolder": output.get("subfolder", ""),
            "type": output.get("type", "output"),
        }
    )
    url = server.rstrip("/") + "/view?" + query
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_destination = destination.with_name(destination.stem + ".comfy_audio_tmp" + destination.suffix)
    with request.urlopen(url, timeout=300) as response:
        temp_destination.write_bytes(response.read())
    strip_audio(temp_destination, destination)
    try:
        temp_destination.unlink()
    except OSError:
        pass


def append_log(log_path: Path, entry: dict[str, Any]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


def planned_jobs(rows: list[dict[str, str]], args: argparse.Namespace) -> list[dict[str, str]]:
    jobs = [
        row
        for row in rows
        if args.start_id <= int(row["id"]) <= args.end_id
    ]
    if args.limit is not None:
        jobs = jobs[: args.limit]
    return jobs


def main() -> int:
    args = parse_args()
    server = args.server.rstrip("/")
    workflow = read_json(Path(args.workflow))
    rows = read_storyboard(Path(args.storyboard))
    jobs = planned_jobs(rows, args)

    suffix = f"_{args.output_set}" if args.output_set else ""

    if args.orientation == "horizontal":
        source_dir = PROJECT / "imagens" / "finais_4k" / "16x9"
        output_dir = PROJECT / "videos_animados_ltx23" / f"16x9_1280x720{suffix}"
        filename_column = "filename_16x9"
        prefix_folder = f"video/FunkQuack_16x9{suffix}"
    else:
        source_dir = PROJECT / "imagens" / "finais_4k" / "9x16"
        output_dir = PROJECT / "videos_animados_ltx23" / f"9x16_720x1280{suffix}"
        filename_column = "filename_9x16"
        prefix_folder = f"video/FunkQuack_9x16{suffix}"

    log_suffix = f"_{args.output_set}" if args.output_set else ""
    log_path = PROJECT / "videos_animados_ltx23" / "logs" / f"{args.orientation}{log_suffix}.jsonl"
    client_id = "funk-quack-codex-" + uuid.uuid4().hex

    print(f"ComfyUI server: {server}")
    print(f"Orientation: {args.orientation}")
    print("Prompt enhance: disabled, using direct per-line prompts")
    print("Final MP4 audio: stripped/muted for editing with the original song")
    print(f"Output set: {args.output_set or 'legacy'}")
    print(f"Jobs: {len(jobs)}")

    for row in jobs:
        line_id = int(row["id"])
        src = source_dir / row[filename_column]
        dest = output_dir / f"linha_{line_id:03d}_{src.stem.removeprefix(f'linha_{line_id:03d}_')}.mp4"
        output_prefix = f"{prefix_folder}/linha_{line_id:03d}_{src.stem.removeprefix(f'linha_{line_id:03d}_')}"

        if not src.exists():
            print(f"SKIP missing source: {src}")
            continue
        if dest.exists() and not args.overwrite:
            print(f"SKIP existing: {dest}")
            continue

        print(f"QUEUE {line_id:03d}: {src.name}")
        print(f"  Prompt: {positive_prompt(row, args.orientation)}")
        if args.dry_run:
            continue

        started = datetime.now(timezone.utc).isoformat()
        try:
            uploaded = upload_image(server, src)
            prompt = configure_prompt(workflow, row, uploaded, output_prefix, args.orientation)
            prompt_id = queue_prompt(server, prompt, client_id)
            output = wait_for_output(server, prompt_id, args.poll_interval, args.timeout)
            download_output(server, output, dest)
            finished = datetime.now(timezone.utc).isoformat()
            append_log(
                log_path,
                {
                    "line_id": line_id,
                    "source": str(src),
                    "destination": str(dest),
                    "prompt_id": prompt_id,
                    "comfy_output": output,
                    "started": started,
                    "finished": finished,
                    "status": "ok",
                },
            )
            print(f"  SAVED {dest}")
        except (error.URLError, TimeoutError, RuntimeError, OSError) as exc:
            finished = datetime.now(timezone.utc).isoformat()
            append_log(
                log_path,
                {
                    "line_id": line_id,
                    "source": str(src),
                    "destination": str(dest),
                    "started": started,
                    "finished": finished,
                    "status": "error",
                    "error": str(exc),
                },
            )
            print(f"ERROR line {line_id:03d}: {exc}", file=sys.stderr)
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
