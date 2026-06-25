#!/usr/bin/env python3
"""Transcribe one audio chunk with OpenAI using curl and .env.local."""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
from pathlib import Path


def load_env(path: Path) -> dict[str, str]:
    env = {}
    if not path.exists():
        return env
    for raw in path.read_text(errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        env[key.strip()] = value
    return env


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio_file", type=Path)
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--model", default=None)
    parser.add_argument("--print-summary", action="store_true")
    args = parser.parse_args()

    values = load_env(args.env_file)
    api_key = values.get("OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    model = args.model or values.get("OPENAI_TRANSCRIPTION_MODEL") or "gpt-4o-transcribe"
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is missing")
    if not args.audio_file.exists():
        raise SystemExit(f"Audio file not found: {args.audio_file}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "curl",
        "-sS",
        "https://api.openai.com/v1/audio/transcriptions",
        "-H",
        f"Authorization: Bearer {api_key}",
        "-F",
        f"file=@{args.audio_file}",
        "-F",
        f"model={model}",
        "-F",
        "response_format=json",
        "-o",
        str(args.out),
        "-w",
        "%{http_code}",
    ]
    safe_cmd = [part if api_key not in part else "Authorization: Bearer <redacted>" for part in cmd]
    print("+ " + " ".join(shlex.quote(part) for part in safe_cmd))
    http_code = subprocess.check_output(cmd, text=True).strip()
    print(f"http_status={http_code}")

    if http_code != "200":
        print(f"response_file={args.out}")
        return 1

    if args.print_summary:
        data = json.loads(args.out.read_text(errors="replace"))
        text = data.get("text", "")
        usage = data.get("usage", {})
        usage_keys = list(usage.keys()) if isinstance(usage, dict) else []
        print(f"chars={len(text)} words={len(text.split())} usage_keys={usage_keys}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
