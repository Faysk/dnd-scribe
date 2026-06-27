#!/usr/bin/env python3
"""Parse Roll20 chat text for DnD Scribe commands.

The parser is intentionally conservative: it extracts lines containing the
configured command prefix, keeps the raw line, and never discards unknown
commands. This makes copied/exported Roll20 chat usable before deeper browser
or API automation exists.
"""

from __future__ import annotations

import argparse
import json
import re
import shlex
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


DEFAULT_PREFIX = "!dnd"


@dataclass
class Roll20Command:
    line_no: int
    speaker: str | None
    command: str
    args: dict[str, str]
    positional: list[str]
    raw_command: str
    raw_line: str
    valid: bool
    error: str | None = None


def split_speaker(line: str) -> tuple[str | None, str]:
    """Best-effort speaker extraction for copied Roll20 chat lines."""
    match = re.match(r"^\s*(?:\[[^\]]+\]\s*)?([^:]{1,80}):\s*(.+)$", line)
    if not match:
        return None, line.strip()

    speaker = match.group(1).strip()
    message = match.group(2).strip()
    if DEFAULT_PREFIX not in message:
        return None, line.strip()

    return speaker or None, message


def parse_args(tokens: list[str]) -> tuple[dict[str, str], list[str]]:
    args: dict[str, str] = {}
    positional: list[str] = []

    for token in tokens:
        if ":" not in token:
            positional.append(token)
            continue

        key, value = token.split(":", 1)
        key = key.strip()
        if not key:
            positional.append(token)
            continue

        args[key] = value.strip()

    return args, positional


def parse_command(line: str, line_no: int, prefix: str = DEFAULT_PREFIX) -> Roll20Command | None:
    if prefix not in line:
        return None

    speaker, message = split_speaker(line)
    raw_command = message[message.index(prefix) + len(prefix) :].strip()
    if not raw_command:
        return Roll20Command(
            line_no=line_no,
            speaker=speaker,
            command="",
            args={},
            positional=[],
            raw_command="",
            raw_line=line.rstrip("\n"),
            valid=False,
            error="missing command after prefix",
        )

    try:
        tokens = shlex.split(raw_command, posix=True)
    except ValueError as exc:
        return Roll20Command(
            line_no=line_no,
            speaker=speaker,
            command="",
            args={},
            positional=[],
            raw_command=raw_command,
            raw_line=line.rstrip("\n"),
            valid=False,
            error=str(exc),
        )

    if not tokens:
        return Roll20Command(
            line_no=line_no,
            speaker=speaker,
            command="",
            args={},
            positional=[],
            raw_command=raw_command,
            raw_line=line.rstrip("\n"),
            valid=False,
            error="empty command",
        )

    args, positional = parse_args(tokens[1:])
    return Roll20Command(
        line_no=line_no,
        speaker=speaker,
        command=tokens[0],
        args=args,
        positional=positional,
        raw_command=raw_command,
        raw_line=line.rstrip("\n"),
        valid=True,
    )


def parse_text(text: str, prefix: str = DEFAULT_PREFIX) -> list[Roll20Command]:
    events: list[Roll20Command] = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        parsed = parse_command(line, line_no, prefix=prefix)
        if parsed is not None:
            events.append(parsed)
    return events


def summarize(events: list[Roll20Command]) -> dict[str, Any]:
    by_command: dict[str, int] = {}
    invalid = 0

    for event in events:
        if not event.valid:
            invalid += 1
            continue
        by_command[event.command] = by_command.get(event.command, 0) + 1

    return {
        "total": len(events),
        "valid": len(events) - invalid,
        "invalid": invalid,
        "by_command": by_command,
    }


def read_input(path: str | None) -> str:
    if not path or path == "-":
        return sys.stdin.read()
    return Path(path).read_text(encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse Roll20 chat commands for DnD Scribe.")
    parser.add_argument("input", nargs="?", help="Roll20 chat text file. Reads stdin when omitted.")
    parser.add_argument("--prefix", default=DEFAULT_PREFIX, help="Command prefix. Default: !dnd")
    parser.add_argument("--summary", action="store_true", help="Only print command counts.")
    args = parser.parse_args()

    events = parse_text(read_input(args.input), prefix=args.prefix)
    payload: Any = summarize(events) if args.summary else [asdict(event) for event in events]
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
