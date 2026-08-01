from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from .artifacts import atomic_write_json, utc_now


REVIEW_STATUSES = {
    "unreviewed",
    "approved",
    "needs_review",
    "discarded",
}


def review_path(session_dir: Path) -> Path:
    return session_dir / "review" / "decisions.json"


def read_reviews(session_dir: Path) -> dict[str, Any]:
    path = review_path(session_dir)
    if not path.is_file():
        return {
            "schema_version": 1,
            "updated_at": None,
            "segments": {},
        }
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {
            "schema_version": 1,
            "updated_at": None,
            "segments": {},
        }
    value.setdefault("segments", {})
    return value


def write_review(
    session_dir: Path,
    segment_id: str,
    *,
    status: str,
    text: str | None,
    speaker: str | None,
) -> dict[str, Any]:
    if status not in REVIEW_STATUSES:
        raise ValueError("Status de revisão inválido")
    reviews = read_reviews(session_dir)
    decision = {
        "segment_id": segment_id,
        "status": status,
        "text": text.strip() if text and text.strip() else None,
        "speaker": speaker.strip() if speaker and speaker.strip() else None,
        "updated_at": utc_now(),
    }
    if (
        decision["status"] == "unreviewed"
        and decision["text"] is None
        and decision["speaker"] is None
    ):
        reviews["segments"].pop(segment_id, None)
    else:
        reviews["segments"][segment_id] = decision
    reviews["updated_at"] = utc_now()
    atomic_write_json(review_path(session_dir), reviews)
    return decision


def apply_reviews(
    session: dict[str, Any],
    reviews: dict[str, Any],
) -> dict[str, Any]:
    value = copy.deepcopy(session)
    decisions = reviews.get("segments", {})
    counts = {status: 0 for status in REVIEW_STATUSES}
    counts["unreviewed"] = len(value.get("transcript") or [])

    for segment in value.get("transcript") or []:
        decision = decisions.get(segment.get("id"))
        segment["review_status"] = "unreviewed"
        if not decision:
            continue
        status = decision.get("status", "unreviewed")
        segment["review_status"] = status
        counts["unreviewed"] -= 1
        counts[status] = counts.get(status, 0) + 1
        if decision.get("text"):
            segment["original_text"] = segment.get("text")
            segment["text"] = decision["text"]
        if decision.get("speaker"):
            segment["original_speaker"] = segment.get("speaker")
            segment["speaker"] = decision["speaker"]

    value["review_summary"] = {
        **counts,
        "updated_at": reviews.get("updated_at"),
    }
    return value
