#!/usr/bin/env python3
"""Run Craig ingest and immediately import the manifest into Supabase."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


def parse_key_values(text: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or "=" not in line:
            continue
        key, value = line.split("=", 1)
        result[key.strip()] = value.strip()
    return result


def run_capture(cmd: list[str], timeout: int = 3600) -> tuple[dict[str, str], str]:
    proc = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, timeout=timeout)
    output = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode != 0:
        raise RuntimeError(output[-4000:] or f"Command failed: {' '.join(cmd)}")
    return parse_key_values(output), output


def ingest(args: argparse.Namespace) -> tuple[dict[str, str], str]:
    cmd = [
        sys.executable,
        str(ROOT / "tools" / "ingest_craig_session.py"),
        str(args.zip_path),
        "--out-root",
        str(args.out_root),
        "--map-file",
        str(args.map_file),
        "--chunk-seconds",
        str(args.chunk_seconds),
    ]
    if args.source_session_id:
        cmd.extend(["--session-id", args.source_session_id])
    if args.sample_seconds:
        cmd.extend(["--sample-seconds", str(args.sample_seconds)])
    if args.skip_chunks:
        cmd.append("--skip-chunks")
    return run_capture(cmd, timeout=args.ingest_timeout)


def import_manifest(args: argparse.Namespace, manifest_path: Path) -> tuple[dict[str, str], str]:
    cmd = [
        sys.executable,
        str(ROOT / "tools" / "import_craig_manifest.py"),
        str(manifest_path),
        "--env-file",
        str(args.env_file),
        "--campaign",
        args.campaign,
    ]
    if args.source_session_id:
        cmd.extend(["--source-session-id", args.source_session_id])
    if args.title:
        cmd.extend(["--title", args.title])
    return run_capture(cmd, timeout=args.import_timeout)


def result_payload(ingest_details: dict[str, str], import_details: dict[str, str], ingest_output: str, import_output: str) -> dict[str, Any]:
    return {
        "ok": True,
        "ingest": ingest_details,
        "dbImport": import_details,
        "logTail": {
            "ingest": ingest_output[-2000:],
            "import": import_output[-2000:],
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_path", type=Path)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env.local")
    parser.add_argument("--campaign", default="yuhara-main")
    parser.add_argument("--source-session-id")
    parser.add_argument("--title")
    parser.add_argument("--out-root", type=Path, default=ROOT / "tmp" / "sessions")
    parser.add_argument("--map-file", type=Path, default=ROOT / "config" / "craig_user_map.json")
    parser.add_argument("--chunk-seconds", type=int, default=300)
    parser.add_argument("--sample-seconds", type=int)
    parser.add_argument("--skip-chunks", action="store_true")
    parser.add_argument("--ingest-timeout", type=int, default=3600)
    parser.add_argument("--import-timeout", type=int, default=600)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    if not args.zip_path.exists():
        raise SystemExit(f"ZIP not found: {args.zip_path}")

    ingest_details, ingest_output = ingest(args)
    manifest_raw = ingest_details.get("manifest")
    if not manifest_raw:
        raise SystemExit("Ingest did not return manifest=...")

    import_details, import_output = import_manifest(args, Path(manifest_raw))
    payload = result_payload(ingest_details, import_details, ingest_output, import_output)
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        for key, value in payload["ingest"].items():
            print(f"ingest_{key}={value}")
        for key, value in payload["dbImport"].items():
            print(f"import_{key}={value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
