#!/usr/bin/env python3
"""Small psql wrapper for production workers.

The worker logs are stored as GitHub Actions artifacts, so failures must not
echo database URLs. Sending SQL through stdin also avoids OS argument limits for
large JSON/Markdown payloads.
"""

from __future__ import annotations

import json
import re
import subprocess
import time
from pathlib import Path


TRANSIENT_MARKERS = (
    "max clients reached",
    "remaining connection slots are reserved",
    "too many clients",
    "server closed the connection unexpectedly",
    "terminating connection",
    "connection timed out",
    "connection refused",
    "could not connect to server",
    "ssl syscall error",
    "timeout expired",
)


def sanitize_error_text(text: object, database_url: str | None = None) -> str:
    value = str(text or "")
    if database_url:
        value = value.replace(database_url, "[DATABASE_URL]")
    return re.sub(r"postgres(?:ql)?://[^\s'\"),]+", "[DATABASE_URL]", value, flags=re.IGNORECASE)


def is_transient_psql_error(text: str) -> bool:
    lower = text.lower()
    return any(marker in lower for marker in TRANSIENT_MARKERS)


def run_psql(
    database_url: str,
    *,
    sql: str | None = None,
    sql_file: Path | None = None,
    tuples_only: bool = False,
    quiet: bool = False,
    attempts: int = 3,
) -> str:
    cmd = ["psql", database_url, "-v", "ON_ERROR_STOP=1"]
    if tuples_only:
        cmd.append("-tA")
    if quiet:
        cmd.append("-q")
    if sql_file is not None:
        cmd.extend(["-f", str(sql_file)])

    last_error = ""
    for attempt in range(1, max(1, attempts) + 1):
        result = subprocess.run(
            cmd,
            input=sql if sql_file is None else None,
            text=True,
            encoding="utf-8",
            capture_output=True,
            check=False,
        )
        if result.returncode == 0:
            return result.stdout

        combined = sanitize_error_text((result.stdout or "") + "\n" + (result.stderr or ""), database_url)
        last_error = combined.strip()
        if attempt < attempts and is_transient_psql_error(combined):
            time.sleep(min(20, attempt * 3))
            continue
        break

    raise RuntimeError(f"psql failed after {attempt} attempt(s): {last_error[:4000]}")


def run_json_query(database_url: str, sql: str):
    output = run_psql(database_url, sql=sql, tuples_only=True)
    text = output.strip()
    return json.loads(text) if text else None


def execute_sql(database_url: str, sql: str, *, quiet: bool = True) -> None:
    run_psql(database_url, sql=sql, quiet=quiet)


def execute_sql_file(database_url: str, path: Path, *, quiet: bool = False) -> None:
    run_psql(database_url, sql_file=path, quiet=quiet)
