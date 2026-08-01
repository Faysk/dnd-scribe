#!/usr/bin/env python3
"""Extract a musical beat grid from the Funk Quack master audio."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from bisect import bisect_left
from pathlib import Path


ROOT = Path(r"D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha")
LOCAL_DEPS = Path(r"D:\Projects\dnd\.tools\python_audio")
if LOCAL_DEPS.exists():
    sys.path.insert(0, str(LOCAL_DEPS))

import librosa  # noqa: E402
import numpy as np  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--audio", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--sample-rate", type=int, default=22050)
    parser.add_argument("--hop-length", type=int, default=512)
    return parser.parse_args()


def default_audio(root: Path) -> Path:
    candidates = (
        root.parent / "producao_funk_quack" / "audio" / "Funk Quack do Dandi.mp3",
        root.parent / "Funk Quack do Dandi.mp3",
    )
    for path in candidates:
        if path.exists():
            return path
    raise SystemExit("audio not found; pass --audio")


def load_sync(root: Path) -> list[dict[str, str]]:
    path = root / "docs" / "sync_linha_a_linha_whisper.csv"
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle, delimiter=";"))


def nearest_line(starts: list[float], time_s: float) -> int:
    index = bisect_left(starts, time_s)
    candidates = [value for value in (index - 1, index) if 0 <= value < len(starts)]
    return min(candidates, key=lambda value: abs(starts[value] - time_s))


def main() -> int:
    args = parse_args()
    audio = args.audio or default_audio(args.root)
    output = args.output or (args.root / "docs" / "beat_grid_funk_quack.csv")
    sync_rows = load_sync(args.root)
    starts = [float(row["start_s"]) for row in sync_rows]
    ends = [float(row["end_s"]) for row in sync_rows]

    print(f"Loading audio: {audio}", flush=True)
    signal, sample_rate = librosa.load(audio, sr=args.sample_rate, mono=True)
    _, percussive = librosa.effects.hpss(signal)
    envelope = librosa.onset.onset_strength(
        y=percussive,
        sr=sample_rate,
        hop_length=args.hop_length,
        aggregate=np.median,
    )
    tempo_value, beat_frames = librosa.beat.beat_track(
        onset_envelope=envelope,
        sr=sample_rate,
        hop_length=args.hop_length,
        units="frames",
        trim=False,
    )
    tempo = float(np.asarray(tempo_value).reshape(-1)[0])
    beat_frames = np.asarray(beat_frames, dtype=int)
    beat_times = librosa.frames_to_time(
        beat_frames,
        sr=sample_rate,
        hop_length=args.hop_length,
    )
    strengths = envelope[np.clip(beat_frames, 0, len(envelope) - 1)]
    low, high = np.percentile(strengths, [10, 95])
    normalized = np.clip((strengths - low) / max(1e-9, high - low), 0.0, 1.0)

    phase_scores = [float(np.mean(normalized[phase::4])) for phase in range(4)]
    downbeat_phase = int(np.argmax(phase_scores))
    rows: list[dict[str, object]] = []
    bar = 0
    for index, (time_s, strength, strength_norm) in enumerate(
        zip(beat_times, strengths, normalized),
        start=1,
    ):
        beat_in_bar = ((index - 1 - downbeat_phase) % 4) + 1
        if beat_in_bar == 1:
            bar += 1
        line_index = nearest_line(starts, float(time_s))
        section_index = next(
            (
                item
                for item, (start, end) in enumerate(zip(starts, ends))
                if start <= time_s < end
            ),
            len(sync_rows) - 1,
        )
        if beat_in_bar == 1 or strength_norm >= 0.78:
            accent = "strong"
        elif strength_norm >= 0.48:
            accent = "medium"
        else:
            accent = "light"
        rows.append(
            {
                "beat_index": index,
                "bar": max(1, bar),
                "beat_in_bar": beat_in_bar,
                "time_s": f"{float(time_s):.6f}",
                "strength": f"{float(strength):.6f}",
                "strength_norm": f"{float(strength_norm):.4f}",
                "accent": accent,
                "section": sync_rows[section_index]["section"],
                "active_line_id": sync_rows[section_index]["id"],
                "nearest_line_id": sync_rows[line_index]["id"],
                "nearest_line_offset_ms": round((float(time_s) - starts[line_index]) * 1000),
            }
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys(), delimiter=";")
        writer.writeheader()
        writer.writerows(rows)
    intervals = np.diff(beat_times)
    summary = {
        "tempo_bpm": round(tempo, 3),
        "beats": len(rows),
        "median_interval_s": round(float(np.median(intervals)), 6),
        "estimated_bars": max(row["bar"] for row in rows),
        "downbeat_phase": downbeat_phase,
        "output": str(output),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
