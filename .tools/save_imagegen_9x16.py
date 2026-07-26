#!/usr/bin/env python3
"""Save the latest built-in imagegen output as a Funk Quack 9:16 final."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageOps


GENERATED_ROOT = Path(r"C:\Users\Faysk\.codex\generated_images")
PROJECT = Path(r"D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha")
RAW_DIR = PROJECT / "imagens" / "brutas" / "9x16"
FINAL_DIR = PROJECT / "imagens" / "finais_4k" / "9x16"
TARGET_SIZE = (2160, 3840)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("filename", help="Canonical PNG filename, for example linha_070_slug.png")
    parser.add_argument("--source", help="Generated source PNG. Defaults to newest file in generated_images.")
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def newest_generated() -> Path:
    files = [path for path in GENERATED_ROOT.rglob("*.png") if path.is_file()]
    if not files:
        raise FileNotFoundError(f"No generated PNG files found under {GENERATED_ROOT}")
    return max(files, key=lambda path: path.stat().st_mtime)


def main() -> int:
    args = parse_args()
    source = Path(args.source) if args.source else newest_generated()
    raw = RAW_DIR / args.filename
    final = FINAL_DIR / args.filename

    if not source.exists():
        raise FileNotFoundError(source)
    if not args.overwrite:
        existing = [str(path) for path in (raw, final) if path.exists()]
        if existing:
            raise FileExistsError("Refusing to overwrite: " + ", ".join(existing))

    raw.parent.mkdir(parents=True, exist_ok=True)
    final.parent.mkdir(parents=True, exist_ok=True)

    image = Image.open(source).convert("RGB")
    image.save(raw)
    fitted = ImageOps.fit(
        image,
        TARGET_SIZE,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    fitted.save(final, compress_level=4)

    print(
        json.dumps(
            {
                "source": str(source),
                "raw": str(raw),
                "raw_size": list(image.size),
                "final": str(final),
                "final_size": list(fitted.size),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
