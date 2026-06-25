#!/usr/bin/env python3
"""Build a master timeline from transcribed Craig session chunks."""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path


def read_json(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fmt_time(ms: int | float | None) -> str:
    total = int((ms or 0) // 1000)
    hours, rem = divmod(total, 3600)
    minutes, seconds = divmod(rem, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def normalize_segment(segment: dict, source_sequence: int, export_sequence: int | None = None) -> dict:
    text = (segment.get("text") or "").strip()
    track_key = segment["track_key"]
    chunk_index = int(segment["chunk_index"])
    return {
        "id": f"seg_{(export_sequence or source_sequence):04d}",
        "source_sequence": source_sequence,
        "session_id": segment["session_id"],
        "timeline_start_ms": segment.get("start_ms"),
        "timeline_end_ms": segment.get("end_ms"),
        "timeline_start": fmt_time(segment.get("start_ms")),
        "timeline_end": fmt_time(segment.get("end_ms")),
        "track_key": track_key,
        "speaker_name": segment.get("speaker_name"),
        "speaker_role": segment.get("role"),
        "participant_status": segment.get("participant_status"),
        "default_character": segment.get("default_character"),
        "character_name": segment.get("default_character"),
        "character_needs_review": segment.get("participant_status") != "known",
        "source_file": segment.get("source_file"),
        "source_chunk": segment.get("source_chunk"),
        "source_chunk_path": segment.get("source_chunk_path"),
        "response_path": segment.get("response_path"),
        "chunk_index": chunk_index,
        "text": text,
        "text_chars": len(text),
        "text_words": len(text.split()),
        "is_empty": not bool(text),
        "needs_review": segment.get("participant_status") != "known",
        "review_status": "pending",
        "tags": [],
    }


def build_markdown(master: dict) -> str:
    lines = [
        f"# Transcript Master — {master['session_id']}",
        "",
        "Gerado automaticamente a partir das faixas Craig transcritas.",
        "",
        "## Resumo",
        "",
        f"- Segmentos: {master['summary']['segments_total']}",
        f"- Segmentos com texto: {master['summary']['segments_with_text']}",
        f"- Segmentos vazios: {master['summary']['segments_empty']}",
        "",
        "## Timeline",
        "",
    ]
    for item in master["segments"]:
        if item["is_empty"]:
            continue
        speaker = item.get("speaker_name") or item["track_key"]
        character = item.get("character_name") or "-"
        lines.append(f"### {item['timeline_start']} — {speaker} / {character}")
        lines.append("")
        lines.append(item["text"])
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session_dir", type=Path)
    parser.add_argument("--include-empty", action="store_true", help="Keep empty chunks in transcript_master.json.")
    args = parser.parse_args()

    session_dir = args.session_dir
    manifest_path = session_dir / "manifest.json"
    segments_path = session_dir / "transcripts" / "segments.json"
    if not manifest_path.exists():
        raise SystemExit(f"manifest.json not found: {manifest_path}")
    if not segments_path.exists():
        raise SystemExit(f"segments.json not found: {segments_path}")

    manifest = read_json(manifest_path)
    raw_segments = read_json(segments_path)
    sorted_segments = sorted(
        raw_segments,
        key=lambda item: (
            int(item.get("start_ms") or 0),
            str(item.get("track_key") or ""),
            int(item.get("chunk_index") or 0),
        ),
    )

    normalized_all = [normalize_segment(segment, index + 1) for index, segment in enumerate(sorted_segments)]
    export_source = normalized_all if args.include_empty else [segment for segment in normalized_all if not segment["is_empty"]]
    normalized = [
        {
            **segment,
            "id": f"seg_{index + 1:04d}",
        }
        for index, segment in enumerate(export_source)
    ]

    by_track: dict[str, dict] = {}
    for item in normalized_all:
        track = item["track_key"]
        stats = by_track.setdefault(
            track,
            {
                "track_key": track,
                "speaker_name": item.get("speaker_name"),
                "default_character": item.get("default_character"),
                "participant_status": item.get("participant_status"),
                "segments_total": 0,
                "segments_with_text": 0,
                "segments_empty": 0,
                "text_chars": 0,
                "text_words": 0,
            },
        )
        stats["segments_total"] += 1
        if item["is_empty"]:
            stats["segments_empty"] += 1
        else:
            stats["segments_with_text"] += 1
        stats["text_chars"] += item["text_chars"]
        stats["text_words"] += item["text_words"]

    master = {
        "schema_version": 1,
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
        "session_id": manifest["session_id"],
        "source_manifest": str(manifest_path),
        "source_segments": str(segments_path),
        "include_empty": args.include_empty,
        "summary": {
            "segments_total": len(normalized_all),
            "segments_exported": len(normalized),
            "segments_with_text": sum(1 for item in normalized_all if not item["is_empty"]),
            "segments_empty": sum(1 for item in normalized_all if item["is_empty"]),
            "tracks_total": len(by_track),
            "duration_ms": max((item.get("timeline_end_ms") or 0 for item in normalized_all), default=0),
            "duration": fmt_time(max((item.get("timeline_end_ms") or 0 for item in normalized_all), default=0)),
        },
        "tracks": sorted(by_track.values(), key=lambda item: item["track_key"]),
        "segments": normalized,
    }

    out_json = session_dir / "transcripts" / "transcript_master.json"
    out_md = session_dir / "transcripts" / "transcript_master.md"
    write_json(out_json, master)
    out_md.write_text(build_markdown(master), encoding="utf-8")

    print(f"master={out_json}")
    print(f"markdown={out_md}")
    print(f"segments_total={master['summary']['segments_total']}")
    print(f"segments_exported={master['summary']['segments_exported']}")
    print(f"segments_empty={master['summary']['segments_empty']}")
    print(f"duration={master['summary']['duration']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
