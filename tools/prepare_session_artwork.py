#!/usr/bin/env python3
"""Build lightweight public session artwork from local PNG sources."""

from __future__ import annotations

import json
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError as exc:  # pragma: no cover - local operator dependency
    raise SystemExit("Pillow is required: python -m pip install Pillow") from exc


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "config" / "session_artwork.json"
PUBLIC_ROOT = ROOT / "web" / "assets" / "sessions"
CARD_MAX_SIZE = (900, 1350)
HERO_MAX_SIZE = (1800, 1013)
WEBP_QUALITY = 88


def build_image(source: Path, target: Path, max_size: tuple[int, int]) -> tuple[int, int]:
    if not source.is_file():
        raise FileNotFoundError(f"source image not found: {source}")

    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.name}.tmp")

    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        image.save(temporary, "WEBP", quality=WEBP_QUALITY, method=6)
        dimensions = image.size

    temporary.replace(target)
    return dimensions


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    sessions = manifest.get("sessions") or []
    if not sessions:
        raise SystemExit("session artwork manifest is empty")

    total_source_bytes = 0
    total_public_bytes = 0

    for session in sessions:
        date = str(session["date"])
        output_dir = PUBLIC_ROOT / date
        pairs = (
            ("cardSource", output_dir / "card.webp", CARD_MAX_SIZE),
            ("heroSource", output_dir / "hero.webp", HERO_MAX_SIZE),
        )

        print(f"{date} · {session['title']}")
        for source_key, target, max_size in pairs:
            source = ROOT / session[source_key]
            source_bytes = source.stat().st_size if source.is_file() else 0
            dimensions = build_image(source, target, max_size)
            public_bytes = target.stat().st_size
            total_source_bytes += source_bytes
            total_public_bytes += public_bytes
            print(
                f"  {target.name}: {dimensions[0]}x{dimensions[1]} "
                f"· {source_bytes:,} -> {public_bytes:,} bytes"
            )

    reduction = 100 * (1 - total_public_bytes / total_source_bytes)
    print(
        f"Artwork ready: {len(sessions)} sessions · "
        f"{total_source_bytes:,} -> {total_public_bytes:,} bytes "
        f"({reduction:.1f}% smaller)"
    )


if __name__ == "__main__":
    main()
