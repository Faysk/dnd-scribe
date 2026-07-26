#!/usr/bin/env python3
"""Keep Funk Quack ComfyUI jobs moving one at a time."""

from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error

from comfy_ltx23_batch import (
    DEFAULT_STORYBOARD,
    DEFAULT_WORKFLOW,
    PROJECT,
    append_log,
    collect_outputs,
    configure_prompt,
    download_output,
    http_json,
    positive_prompt,
    queue_prompt,
    read_json,
    read_storyboard,
    upload_image,
    wait_for_output,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Watch ComfyUI and queue the next Funk Quack clip only when idle."
    )
    parser.add_argument("--server", default="http://127.0.0.1:8188")
    parser.add_argument("--workflow", default=str(DEFAULT_WORKFLOW))
    parser.add_argument("--storyboard", default=str(DEFAULT_STORYBOARD))
    parser.add_argument("--orientation", choices=("horizontal", "vertical"), default="horizontal")
    parser.add_argument("--start-id", type=int, default=1)
    parser.add_argument("--end-id", type=int, default=147)
    parser.add_argument(
        "--output-set",
        default="prompt_direto_v4_sem_audio",
        help="Suffix for remake output folders/prefixes. Use an empty value to target legacy folders.",
    )
    parser.add_argument(
        "--recover-history",
        action="store_true",
        help="Copy matching finished videos from ComfyUI history before queuing. Keep disabled for clean remakes.",
    )
    parser.add_argument("--poll-interval", type=float, default=5.0)
    parser.add_argument("--idle-interval", type=float, default=20.0)
    parser.add_argument("--timeout", type=float, default=60.0 * 60.0)
    parser.add_argument("--history-items", type=int, default=80)
    parser.add_argument("--once", action="store_true")
    return parser.parse_args()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def orientation_paths(orientation: str, output_set: str) -> tuple[Path, Path, str, str]:
    suffix = f"_{output_set}" if output_set else ""
    if orientation == "horizontal":
        return (
            PROJECT / "imagens" / "finais_4k" / "16x9",
            PROJECT / "videos_animados_ltx23" / f"16x9_1280x720{suffix}",
            "filename_16x9",
            f"video/FunkQuack_16x9{suffix}",
        )
    return (
        PROJECT / "imagens" / "finais_4k" / "9x16",
        PROJECT / "videos_animados_ltx23" / f"9x16_720x1280{suffix}",
        "filename_9x16",
        f"video/FunkQuack_9x16{suffix}",
    )


def destination_for(output_dir: Path, row: dict[str, str], source_name: str) -> Path:
    line_id = int(row["id"])
    source_stem = Path(source_name).stem
    suffix = source_stem.removeprefix(f"linha_{line_id:03d}_")
    return output_dir / f"linha_{line_id:03d}_{suffix}.mp4"


def output_prefix_for(prefix_folder: str, row: dict[str, str], source_name: str) -> str:
    line_id = int(row["id"])
    source_stem = Path(source_name).stem
    suffix = source_stem.removeprefix(f"linha_{line_id:03d}_")
    return f"{prefix_folder}/linha_{line_id:03d}_{suffix}"


def queue_has_work(server: str) -> bool:
    state = http_json("GET", server.rstrip("/") + "/queue") or {}
    return bool(state.get("queue_running") or state.get("queue_pending"))


def recent_history(server: str, max_items: int) -> dict[str, Any]:
    return http_json("GET", f"{server.rstrip()}/history?max_items={max_items}") or {}


def find_history_output(history: dict[str, Any], prefix_base: str) -> tuple[str, dict[str, Any]] | None:
    matches: list[tuple[int, str, dict[str, Any]]] = []
    for prompt_id, item in history.items():
        if not isinstance(item, dict):
            continue
        outputs = [
            output
            for output in collect_outputs(item.get("outputs", {}))
            if str(output.get("filename", "")).lower().endswith((".mp4", ".webm", ".mov", ".mkv"))
            and str(output.get("filename", "")).startswith(prefix_base)
        ]
        if not outputs:
            continue

        timestamp = 0
        for message in item.get("status", {}).get("messages", []):
            if isinstance(message, list) and len(message) > 1 and isinstance(message[1], dict):
                timestamp = max(timestamp, int(message[1].get("timestamp") or 0))
        matches.append((timestamp, prompt_id, outputs[-1]))

    if not matches:
        return None
    matches.sort(key=lambda entry: entry[0])
    _, prompt_id, output = matches[-1]
    return prompt_id, output


def log_status(path: Path, entry: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


def planned_rows(rows: list[dict[str, str]], start_id: int, end_id: int) -> list[dict[str, str]]:
    return [row for row in rows if start_id <= int(row["id"]) <= end_id]


def main() -> int:
    args = parse_args()
    server = args.server.rstrip("/")
    workflow = read_json(Path(args.workflow))
    rows = planned_rows(read_storyboard(Path(args.storyboard)), args.start_id, args.end_id)
    source_dir, output_dir, filename_column, prefix_folder = orientation_paths(
        args.orientation,
        args.output_set,
    )
    log_suffix = f"_{args.output_set}" if args.output_set else ""
    main_log = PROJECT / "videos_animados_ltx23" / "logs" / f"{args.orientation}{log_suffix}.jsonl"
    watch_log = PROJECT / "videos_animados_ltx23" / "logs" / f"{args.orientation}{log_suffix}_watch.jsonl"
    client_id = "funk-quack-watch-" + uuid.uuid4().hex

    print(f"Watching ComfyUI server: {server}", flush=True)
    print(f"Orientation: {args.orientation}", flush=True)
    print("Prompt enhance: disabled, using direct per-line prompts", flush=True)
    print("Final MP4 audio: stripped/muted for editing with the original song", flush=True)
    print(f"Output set: {args.output_set or 'legacy'}", flush=True)
    print(f"Range: {args.start_id:03d}-{args.end_id:03d}", flush=True)

    while True:
        if queue_has_work(server):
            log_status(watch_log, {"at": utc_now(), "status": "waiting_queue"})
            if args.once:
                return 0
            time.sleep(args.idle_interval)
            continue

        pending: tuple[dict[str, str], Path, Path, str] | None = None
        for row in rows:
            source_name = row[filename_column]
            src = source_dir / source_name
            dest = destination_for(output_dir, row, source_name)
            output_prefix = output_prefix_for(prefix_folder, row, source_name)
            if not dest.exists():
                pending = row, src, dest, output_prefix
                break

        if pending is None:
            log_status(watch_log, {"at": utc_now(), "status": "complete"})
            print("All requested videos are present.", flush=True)
            return 0

        row, src, dest, output_prefix = pending
        line_id = int(row["id"])
        prefix_base = Path(output_prefix).name

        recovered = (
            find_history_output(recent_history(server, args.history_items), prefix_base)
            if args.recover_history
            else None
        )
        if recovered:
            prompt_id, output = recovered
            download_output(server, output, dest)
            append_log(
                main_log,
                {
                    "line_id": line_id,
                    "source": str(src),
                    "destination": str(dest),
                    "prompt_id": prompt_id,
                    "comfy_output": output,
                    "started": utc_now(),
                    "finished": utc_now(),
                    "status": "recovered",
                },
            )
            print(f"RECOVERED {line_id:03d}: {dest}", flush=True)
            if args.once:
                return 0
            continue

        if not src.exists():
            log_status(
                watch_log,
                {
                    "at": utc_now(),
                    "status": "waiting_source",
                    "line_id": line_id,
                    "source": str(src),
                },
            )
            print(f"WAIT source {line_id:03d}: {src}", flush=True)
            if args.once:
                return 0
            time.sleep(args.idle_interval)
            continue

        print(f"QUEUE {line_id:03d}: {src.name}", flush=True)
        print(f"  Prompt: {positive_prompt(row, args.orientation)}", flush=True)
        started = utc_now()
        try:
            uploaded = upload_image(server, src)
            prompt = configure_prompt(workflow, row, uploaded, output_prefix, args.orientation)
            prompt_id = queue_prompt(server, prompt, client_id)
            output = wait_for_output(server, prompt_id, args.poll_interval, args.timeout)
            download_output(server, output, dest)
            finished = utc_now()
            append_log(
                main_log,
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
            print(f"SAVED {line_id:03d}: {dest}", flush=True)
        except (error.URLError, TimeoutError, RuntimeError, OSError) as exc:
            finished = utc_now()
            append_log(
                main_log,
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
            print(f"ERROR line {line_id:03d}: {exc}", file=sys.stderr, flush=True)
            if args.once:
                return 1
            time.sleep(args.idle_interval)


if __name__ == "__main__":
    raise SystemExit(main())
