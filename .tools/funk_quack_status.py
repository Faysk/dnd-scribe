#!/usr/bin/env python3
"""Report Funk Quack production coverage without changing project files."""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(r"D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha")
LINE_RE = re.compile(r"^linha_(\d{3})_", re.IGNORECASE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def expected_ids(root: Path) -> list[int]:
    path = root / "docs" / "storyboard_linha_a_linha.csv"
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [int(row["id"]) for row in csv.DictReader(handle, delimiter=";")]


def scan(path: Path, suffix: str, expected: list[int], *, coverage: bool = True) -> dict[str, object]:
    files = sorted(path.glob(f"*{suffix}")) if path.exists() else []
    ids: list[int] = []
    unrecognized: list[str] = []
    for file in files:
        match = LINE_RE.match(file.name)
        if match:
            ids.append(int(match.group(1)))
        else:
            unrecognized.append(file.name)
    counts = Counter(ids)
    expected_set = set(expected)
    return {
        "path": str(path),
        "files": len(files),
        "unique_ids": len(set(ids) & expected_set),
        "last_id": max(ids) if ids else None,
        "coverage": coverage,
        "present_ids": sorted(set(ids) & expected_set),
        "missing": [item for item in expected if item not in counts] if coverage else [],
        "duplicates": {str(item): count for item, count in sorted(counts.items()) if count > 1},
        "out_of_range": sorted(item for item in counts if item not in expected_set),
        "unrecognized": unrecognized,
    }


def master_status(root: Path) -> dict[str, bool]:
    paths = {
        "static_16x9": root / "videos" / "16x9" / "funk_quack_do_dandi_16x9_4k_sync.mp4",
        "static_9x16": root / "videos" / "9x16" / "funk_quack_do_dandi_9x16_4k_sync_nvenc.mp4",
        "animated_16x9": root / "videos" / "16x9" / "animado_sync" / "funk_quack_do_dandi_16x9_4k_animado_sync.mp4",
        "animated_9x16": root / "videos" / "9x16" / "animado_sync" / "funk_quack_do_dandi_9x16_4k_animado_sync.mp4",
    }
    return {name: path.exists() and path.stat().st_size > 1024 for name, path in paths.items()}


def build_report(root: Path) -> dict[str, object]:
    expected = expected_ids(root)
    animated = root / "videos_animados_ltx23"
    assets = {
        "images_16x9": scan(root / "imagens" / "finais_4k" / "16x9", ".png", expected),
        "images_9x16": scan(root / "imagens" / "finais_4k" / "9x16", ".png", expected),
        "videos_16x9": scan(animated / "16x9_1280x720_prompt_direto_v4_sem_audio", ".mp4", expected),
        "videos_9x16": scan(animated / "9x16_720x1280_prompt_direto_v4_sem_audio", ".mp4", expected),
        "review_16x9": scan(
            animated / "16x9_1280x720_prompt_direto_v4_sem_audio_revisar",
            ".mp4",
            expected,
            coverage=False,
        ),
        "review_9x16": scan(
            animated / "9x16_720x1280_prompt_direto_v4_sem_audio_revisar",
            ".mp4",
            expected,
            coverage=False,
        ),
    }
    return {
        "root": str(root),
        "expected_lines": len(expected),
        "assets": assets,
        "masters": master_status(root),
    }


def print_human(report: dict[str, object]) -> None:
    print(f"Funk Quack status - {report['expected_lines']} storyboard lines")
    print()
    for name, status in report["assets"].items():
        duplicates = status["duplicates"]
        duplicate_text = "none" if not duplicates else ",".join(
            f"{int(item):03d}x{count}" for item, count in duplicates.items()
        )
        if status["coverage"]:
            missing = status["missing"]
            missing_text = "none" if not missing else ",".join(f"{item:03d}" for item in missing)
            print(
                f"{name:14} files={status['files']:3} unique={status['unique_ids']:3} "
                f"last={str(status['last_id'] or '-'):>3} missing={missing_text} duplicates={duplicate_text}"
            )
        else:
            present_text = "none" if not status["present_ids"] else ",".join(
                f"{item:03d}" for item in status["present_ids"]
            )
            print(
                f"{name:14} files={status['files']:3} ids={present_text} duplicates={duplicate_text}"
            )
    print()
    for name, ready in report["masters"].items():
        print(f"{name:14} {'ready' if ready else 'pending'}")


def main() -> int:
    args = parse_args()
    report = build_report(args.root)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_human(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
