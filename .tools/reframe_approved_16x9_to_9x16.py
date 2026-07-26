#!/usr/bin/env python3
"""Reframe approved 16:9 Funk Quack stills into 9:16 fallback frames.

This is a deterministic fallback for when live image generation is unavailable
or produces unrelated content. It only writes missing files unless --overwrite is
passed.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from PIL import Image, ImageOps


PROJECT = Path(r"D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha")
STORYBOARD = PROJECT / "docs" / "storyboard_linha_a_linha.csv"
SRC_DIR = PROJECT / "imagens" / "finais_4k" / "16x9"
RAW_DIR = PROJECT / "imagens" / "brutas" / "9x16"
FINAL_DIR = PROJECT / "imagens" / "finais_4k" / "9x16"
TARGET_SIZE = (2160, 3840)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=int, required=True)
    parser.add_argument("--end", type=int, required=True)
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def load_rows() -> list[dict[str, str]]:
    with STORYBOARD.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        return list(reader)


def reframe(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGB")
    return ImageOps.fit(
        image,
        TARGET_SIZE,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )


def main() -> int:
    args = parse_args()
    rows = load_rows()
    selected = [
        row for row in rows if args.start <= int(row["id"]) <= args.end
    ]

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    FINAL_DIR.mkdir(parents=True, exist_ok=True)

    written: list[dict[str, object]] = []
    skipped: list[str] = []

    for row in selected:
        source = SRC_DIR / row["filename_16x9"]
        raw = RAW_DIR / row["filename_9x16"]
        final = FINAL_DIR / row["filename_9x16"]

        if not source.exists():
            raise FileNotFoundError(source)
        if not args.overwrite and (raw.exists() or final.exists()):
            skipped.append(row["id"])
            continue

        framed = reframe(source)
        framed.save(raw, compress_level=4)
        framed.save(final, compress_level=4)
        written.append(
            {
                "id": row["id"],
                "source": str(source),
                "raw": str(raw),
                "final": str(final),
                "size": list(framed.size),
                "method": "center_crop_from_approved_16x9",
            }
        )

    print(
        json.dumps(
            {
                "written_count": len(written),
                "skipped_existing": skipped,
                "written": written,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
