#!/usr/bin/env python3
"""Sync the private lore library to Cloudflare R2 without committing it."""

from __future__ import annotations

import argparse
from pathlib import Path

from sync_session_to_r2 import R2Client, guess_content_type, load_env, sha256_file


def normalized_prefix(value: str) -> str:
    text = (value or "lore/").strip().strip("/")
    return f"{text}/" if text else "lore/"


def object_key(prefix: str, source_root: Path, file_path: Path) -> str:
    relative = file_path.relative_to(source_root).as_posix()
    return f"{normalized_prefix(prefix)}{relative}"


def iter_files(source: Path) -> list[Path]:
    return sorted(path for path in source.rglob("*") if path.is_file())


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync private lore files to R2.")
    parser.add_argument("--env", default=".env.local", help="Env file with R2 credentials.")
    parser.add_argument("--source", default="lore", help="Local lore directory.")
    parser.add_argument("--prefix", default="", help="R2 prefix. Defaults to DND_LORE_R2_PREFIX or lore/.")
    parser.add_argument("--write", action="store_true", help="Actually upload files. Default is dry run.")
    parser.add_argument("--limit", type=int, default=0, help="Optional max files for a controlled run.")
    args = parser.parse_args()

    env_path = Path(args.env)
    source = Path(args.source)
    if not env_path.exists():
        raise SystemExit(f"env file not found: {env_path}")
    if not source.exists() or not source.is_dir():
        raise SystemExit(f"source lore directory not found: {source}")

    values = load_env(env_path)
    prefix = normalized_prefix(args.prefix or values.get("DND_LORE_R2_PREFIX") or "lore/")
    client = R2Client(values)
    files = iter_files(source)
    if args.limit > 0:
        files = files[: args.limit]

    uploaded = 0
    skipped = 0
    failed = 0
    bytes_total = 0

    print(f"write={str(args.write).lower()}")
    print(f"source={source}")
    print(f"bucket={client.bucket}")
    print(f"prefix={prefix}")
    print(f"files={len(files)}")

    for file_path in files:
        key = object_key(prefix, source, file_path)
        size = file_path.stat().st_size
        bytes_total += size
        content_type = guess_content_type(file_path)
        sha256 = sha256_file(file_path)
        if not args.write:
            print(f"dry {key} size={size} sha256={sha256[:12]} type={content_type}")
            skipped += 1
            continue
        response = client.put_file(key, file_path, content_type)
        if 200 <= response.status < 300:
            uploaded += 1
            print(f"uploaded {key} size={size} sha256={sha256[:12]} status={response.status}")
        else:
            failed += 1
            body = response.body.decode("utf-8", errors="replace")[:240]
            print(f"failed {key} status={response.status} body={body}")

    print(f"bytes={bytes_total}")
    print(f"uploaded={uploaded}")
    print(f"skipped={skipped}")
    print(f"failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
