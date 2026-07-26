#!/usr/bin/env python3
"""Generate the per-line dynamic edit map for Funk Quack."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


ROOT = Path(r"D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha")


MANUAL: dict[int, dict[str, str | float]] = {
    2: {"transition_in": "flash", "transition_s": 0.10, "crop_zoom": 1.035, "emphasis": "attention"},
    7: {"transition_in": "flash", "transition_s": 0.08, "crop_zoom": 1.040, "emphasis": "group_hit"},
    35: {"crop_zoom": 1.020, "emphasis": "chorus_setup"},
    36: {"transition_in": "flash", "transition_s": 0.08, "crop_zoom": 1.045, "emphasis": "chorus_entry"},
    48: {"emphasis": "instrumental_setup"},
    49: {"transition_in": "flash", "transition_s": 0.08, "emphasis": "instrumental_entry"},
    77: {"crop_zoom": 1.020, "emphasis": "chorus_setup"},
    78: {"transition_in": "flash", "transition_s": 0.08, "crop_zoom": 1.045, "emphasis": "chorus_entry"},
    90: {"transition_in": "portal_glow", "transition_s": 0.14, "emphasis": "portal_entry"},
    92: {"playback_speed": 1.12, "crop_zoom": 1.035, "emphasis": "portal_spin"},
    95: {"playback_speed": 0.94, "crop_zoom": 1.015, "emphasis": "comedy_hold"},
    96: {"playback_speed": 0.94, "crop_zoom": 1.015, "emphasis": "comedy_hold"},
    97: {"crop_zoom": 1.045, "emphasis": "tum_tum"},
    100: {"transition_in": "flash", "transition_s": 0.10, "crop_zoom": 1.060, "emphasis": "vai_impact"},
    101: {"transition_in": "dip_black", "transition_s": 0.14, "emphasis": "scene_change"},
    114: {"crop_zoom": 1.020, "emphasis": "final_chorus_setup"},
    115: {"transition_in": "flash", "transition_s": 0.08, "crop_zoom": 1.050, "emphasis": "final_chorus_entry"},
    137: {"transition_in": "dip_black", "transition_s": 0.20, "playback_speed": 0.92, "emphasis": "outro_entry"},
    142: {"transition_in": "dip_black", "transition_s": 0.12, "playback_speed": 0.92, "emphasis": "comedy_setup"},
    143: {"playback_speed": 0.90, "crop_zoom": 1.015, "emphasis": "comedy_hold"},
    145: {"crop_zoom": 1.035, "emphasis": "punchline"},
    146: {"playback_speed": 0.90, "emphasis": "soft_fade"},
    147: {"playback_speed": 0.88, "fade_out_s": 2.00, "emphasis": "final_fade"},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def color_profile(section: str) -> tuple[float, float, float]:
    if section == "final_chorus":
        return 1.11, 1.035, 0.006
    if section.startswith("chorus"):
        return 1.08, 1.025, 0.004
    if section in {"pre_chorus_1", "pre_chorus_2", "instrumental", "shout"}:
        return 1.05, 1.018, 0.003
    if section in {"outro", "dandi_spoken", "fade", "end"}:
        return 0.97, 0.99, 0.004
    return 1.02, 1.01, 0.0


def base_treatment(row: dict[str, str], duration: float) -> dict[str, str | float]:
    motion = row["motion_hint"].lower()
    camera = row["camera"].lower()
    fast = ("impact", "pop", "quick", "flash", "beat", "punch", "bounce", "clap")
    travel = ("spin", "arc", "pan", "rotate", "spiral")
    slow = ("fade", "dissolve", "slow", "hold", "soft", "pause")

    speed = 1.0
    zoom = 1.0
    emphasis = "none"
    if any(marker in motion for marker in fast):
        speed = 1.28 if duration <= 1.65 else 1.12
        zoom = 1.020 if "close" in camera or "detail" in camera else 1.035
        emphasis = "beat"
    elif any(marker in motion for marker in travel):
        speed = 1.10 if duration <= 2.6 else 1.04
        zoom = 1.020
        emphasis = "travel"
    elif any(marker in motion for marker in slow):
        speed = 0.94
        zoom = 1.010
        emphasis = "soft"
    elif "push" in motion or "zoom" in motion:
        speed = 1.04
        zoom = 1.020 if "close" in camera else 1.030
        emphasis = "push"

    saturation, contrast, brightness = color_profile(row["section"])
    return {
        "cut": "hard",
        "playback_speed": speed,
        "crop_zoom": zoom,
        "saturation": saturation,
        "contrast": contrast,
        "brightness": brightness,
        "transition_in": "none",
        "transition_s": 0.0,
        "fade_out_s": 0.0,
        "emphasis": emphasis,
    }


def main() -> int:
    args = parse_args()
    storyboard_path = args.root / "docs" / "storyboard_linha_a_linha.csv"
    sync_path = args.root / "docs" / "sync_linha_a_linha_whisper.csv"
    output = args.output or (args.root / "docs" / "edit_map_funk_quack.csv")
    with storyboard_path.open("r", encoding="utf-8-sig", newline="") as handle:
        storyboard = {int(row["id"]): row for row in csv.DictReader(handle, delimiter=";")}
    with sync_path.open("r", encoding="utf-8-sig", newline="") as handle:
        sync_rows = list(csv.DictReader(handle, delimiter=";"))
    if len(sync_rows) != 147:
        raise SystemExit(f"expected 147 sync rows, got {len(sync_rows)}")

    rows: list[dict[str, str | float | int]] = []
    for sync in sync_rows:
        item_id = int(sync["id"])
        story = storyboard[item_id]
        duration = float(sync["duration_s"])
        treatment = base_treatment(story, duration)
        treatment.update(MANUAL.get(item_id, {}))
        rows.append(
            {
                "id": f"{item_id:03d}",
                "section": sync["section"],
                "start_s": sync["start_s"],
                "end_s": sync["end_s"],
                "duration_s": sync["duration_s"],
                "lyric_or_beat": sync["lyric_or_beat"],
                "camera": story["camera"],
                "motion_hint": story["motion_hint"],
                **treatment,
            }
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys(), delimiter=";")
        writer.writeheader()
        writer.writerows(rows)
    print(f"EDIT MAP READY: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
