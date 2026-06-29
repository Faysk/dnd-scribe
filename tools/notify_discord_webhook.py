#!/usr/bin/env python3
"""Send a small Discord webhook notification from CI.

This script is intentionally dependency-free and best-effort. If the webhook URL
is missing, it exits successfully so workers do not fail only because ops
notifications are not configured yet.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone


def clean(value: object, limit: int = 1000) -> str:
    text = str(value or "").strip()
    return text[: max(0, limit - 3)] + "..." if len(text) > limit else text


def status_color(status: str) -> int:
    normalized = (status or "").lower()
    if normalized in {"success", "succeeded", "ok"}:
        return 0x2F855A
    if normalized in {"cancelled", "skipped", "neutral"}:
        return 0xD69E2E
    return 0xC53030


def parse_field(raw: str) -> dict[str, object] | None:
    if "=" not in raw:
        return None
    name, value = raw.split("=", 1)
    name = clean(name, 120)
    value = clean(value, 1000)
    if not name or not value:
        return None
    return {"name": name, "value": value, "inline": True}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--title", required=True)
    parser.add_argument("--status", required=True)
    parser.add_argument("--session", default="")
    parser.add_argument("--campaign", default="")
    parser.add_argument("--workflow", default="")
    parser.add_argument("--run-url", default="")
    parser.add_argument("--field", action="append", default=[])
    args = parser.parse_args()

    webhook_url = os.environ.get("DND_DISCORD_WEBHOOK_URL") or os.environ.get("DISCORD_WEBHOOK_URL")
    if not webhook_url:
        print("discord webhook secret missing; notification skipped")
        return 0

    fields = [item for item in (parse_field(raw) for raw in args.field) if item]
    if args.session:
        fields.insert(0, {"name": "sessao", "value": clean(args.session, 180), "inline": True})
    if args.campaign:
        fields.insert(1, {"name": "campanha", "value": clean(args.campaign, 120), "inline": True})
    if args.workflow:
        fields.append({"name": "workflow", "value": clean(args.workflow, 180), "inline": True})
    if args.run_url:
        fields.append({"name": "run", "value": clean(args.run_url, 1000), "inline": False})

    title = clean(args.title, 240)
    status = clean(args.status, 80)
    pieces = [title, f"status: {status}"]
    if args.session:
      pieces.append(f"sessao: {clean(args.session, 180)}")

    payload = {
        "content": clean(" | ".join(pieces), 1800),
        "allowed_mentions": {"parse": []},
        "embeds": [
            {
                "title": title,
                "description": clean(f"Status: {status}", 3500),
                "color": status_color(status),
                "fields": fields[:10],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
        "username": os.environ.get("DND_DISCORD_WEBHOOK_NAME") or "DnD Scribe",
    }

    request = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "DnD-Scribe-GitHub-Actions"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            print(f"discord notification sent: {response.status}")
            return 0
    except urllib.error.HTTPError as error:
        body = error.read(200).decode("utf-8", "replace")
        print(f"discord notification failed: {error.code} {body}", file=sys.stderr)
        return 0
    except Exception as error:  # noqa: BLE001 - notification must stay best-effort.
        print(f"discord notification failed: {error}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
