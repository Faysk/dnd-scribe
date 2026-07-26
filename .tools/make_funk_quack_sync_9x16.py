#!/usr/bin/env python3
"""Create the 9:16 ffconcat timeline from the Whisper-synced Funk Quack CSV."""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(r"D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha")
STORYBOARD = ROOT / "docs" / "storyboard_linha_a_linha.csv"
SYNC_CSV = ROOT / "docs" / "sync_linha_a_linha_whisper.csv"
IMG_DIR = ROOT / "imagens" / "finais_4k" / "9x16"
OUT_DIR = ROOT / "videos" / "9x16"
FFCONCAT = OUT_DIR / "timeline_9x16_whisper_sync.ffconcat"


def load_storyboard_names() -> dict[str, str]:
    with STORYBOARD.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        return {row["id"]: row["filename_9x16"] for row in reader}


def load_sync_rows() -> list[dict[str, str]]:
    with SYNC_CSV.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def main() -> int:
    names = load_storyboard_names()
    rows = load_sync_rows()
    if len(rows) != 147:
        raise SystemExit(f"expected 147 sync rows, got {len(rows)}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    concat_lines = ["ffconcat version 1.0"]
    missing: list[str] = []

    for row in rows:
        filename = names[row["id"]]
        image = IMG_DIR / filename
        if not image.exists():
            missing.append(str(image))
            continue
        concat_lines.append(f"file '{image.as_posix()}'")
        concat_lines.append(f"duration {float(row['duration_s']):.6f}")

    if missing:
        raise SystemExit("missing 9x16 image(s):\n" + "\n".join(missing))

    last_image = IMG_DIR / names[rows[-1]["id"]]
    concat_lines.append(f"file '{last_image.as_posix()}'")
    FFCONCAT.write_text("\n".join(concat_lines) + "\n", encoding="ascii")

    summary = {
        "rows": len(rows),
        "start_s": rows[0]["start_s"],
        "end_s": rows[-1]["end_s"],
        "duration_s": rows[-1]["end_s"],
        "image_dir": str(IMG_DIR),
        "ffconcat": str(FFCONCAT),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
