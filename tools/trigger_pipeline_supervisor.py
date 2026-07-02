#!/usr/bin/env python3
"""Call the production pipeline supervisor from GitHub Actions.

The script intentionally prints only sanitized execution summaries. Secrets are
read from environment variables and are never echoed.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def parse_bool(value: str | bool | None) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def compact_session(item: dict) -> dict:
    autopilot = item.get("autopilot") or {}
    return {
        "sourceSessionId": item.get("sourceSessionId"),
        "runs": len(item.get("runs") or []),
        "autopilot": {
            key: autopilot.get(key)
            for key in (
                "stage",
                "action",
                "processed",
                "dispatched",
                "skipped",
                "reason",
                "estimatedBatchCostUsd",
            )
            if key in autopilot
        },
    }


def request_supervisor(args: argparse.Namespace) -> dict:
    base_url = (args.site_url or os.environ.get("DND_PUBLIC_SITE_URL") or "https://dnd.faysk.dev").rstrip("/")
    secret = args.cron_secret or os.environ.get("CRON_SECRET") or os.environ.get("DND_CRON_SECRET") or ""
    if not secret:
        return {
            "ok": False,
            "skipped": True,
            "reason": "CRON_SECRET missing; supervisor callback skipped.",
        }

    query = {
        "campaignSlug": args.campaign,
        "sourceSessionId": args.source_session_id,
        "maxSessions": "1",
        "maxRuns": str(args.max_runs),
    }
    if args.dry_run:
        query["dryRun"] = "true"
    if args.approve_autopilot_paid:
        query["approveAutopilotPaid"] = "true"
    if args.paid_enabled is not None:
        query["paidEnabled"] = "true" if args.paid_enabled else "false"
    if args.cleanup_enabled is not None:
        query["cleanupEnabled"] = "true" if args.cleanup_enabled else "false"

    url = f"{base_url}/api/pipeline-supervisor?{urllib.parse.urlencode(query)}"
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {secret}"})
    with urllib.request.urlopen(request, timeout=args.timeout_seconds) as response:
        raw = response.read().decode("utf-8")
    return json.loads(raw)


def main() -> int:
    parser = argparse.ArgumentParser(description="Trigger DnD Scribe pipeline supervisor.")
    parser.add_argument("--source-session-id", required=True)
    parser.add_argument("--campaign", default="yuhara-main")
    parser.add_argument("--site-url", default=os.environ.get("DND_PUBLIC_SITE_URL") or "https://dnd.faysk.dev")
    parser.add_argument("--cron-secret", default="")
    parser.add_argument("--max-runs", type=int, default=1)
    parser.add_argument("--timeout-seconds", type=int, default=45)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--retry-delay-seconds", type=int, default=10)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--approve-autopilot-paid", action="store_true")
    parser.add_argument("--paid-enabled", type=parse_bool, default=None)
    parser.add_argument("--cleanup-enabled", type=parse_bool, default=None)
    args = parser.parse_args()

    last_error = None
    for attempt in range(1, max(1, args.retries) + 1):
        try:
            payload = request_supervisor(args)
            summary = {
                "ok": payload.get("ok"),
                "skipped": payload.get("skipped"),
                "reason": payload.get("reason"),
                "mode": payload.get("mode"),
                "dryRun": payload.get("dryRun"),
                "processed": payload.get("processed"),
                "zeroCostProcessed": payload.get("zeroCostProcessed"),
                "workflowsDispatched": payload.get("workflowsDispatched"),
                "sessions": [compact_session(item) for item in payload.get("sessions") or []],
            }
            print(json.dumps(summary, ensure_ascii=True, indent=2))
            return 0 if payload.get("ok") is True or payload.get("skipped") is True else 1
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            print(f"supervisor callback attempt {attempt} failed: {error}", file=sys.stderr)
            if attempt < args.retries:
                time.sleep(args.retry_delay_seconds)

    print(f"supervisor callback failed after retries: {last_error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
