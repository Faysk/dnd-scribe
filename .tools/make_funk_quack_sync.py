import csv
import json
from pathlib import Path


ROOT = Path(r"D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha")
CSV_PATH = ROOT / "docs" / "storyboard_linha_a_linha.csv"
IMG_DIR = ROOT / "imagens" / "finais_4k" / "16x9"
OUT_DIR = ROOT / "videos" / "16x9"
SYNC_CSV = ROOT / "docs" / "sync_linha_a_linha_whisper.csv"
FFCONCAT = OUT_DIR / "timeline_16x9_whisper_sync.ffconcat"


# Whisper segment boundaries from the local small model pass.
# Rows are inclusive storyboard ids assigned to that real audio interval.
SEGMENTS = [
    (0.000, 6.200, 1, 3),
    (6.200, 13.120, 4, 5),
    (13.120, 20.460, 6, 7),
    (20.460, 27.560, 8, 10),
    (27.560, 33.560, 11, 12),
    (33.560, 41.560, 13, 14),
    (41.560, 48.560, 15, 16),
    (48.560, 53.560, 17, 20),
    (53.560, 59.560, 21, 23),
    (59.560, 66.560, 24, 27),
    (66.560, 73.560, 28, 31),
    (73.560, 83.560, 32, 34),
    (83.560, 88.560, 35, 38),
    (88.560, 95.560, 39, 44),
    (95.560, 105.560, 45, 54),
    (105.560, 117.560, 55, 57),
    (117.560, 121.560, 58, 59),
    (121.560, 126.560, 60, 62),
    (126.560, 131.560, 63, 65),
    (131.560, 135.560, 66, 67),
    (135.560, 142.560, 68, 71),
    (142.560, 150.560, 72, 75),
    (150.560, 157.560, 76, 77),
    (157.560, 161.560, 78, 80),
    (161.560, 168.560, 81, 86),
    (168.560, 175.560, 87, 92),
    (175.560, 182.560, 93, 96),
    (182.560, 187.560, 97, 98),
    (187.560, 191.560, 99, 103),
    (191.560, 198.560, 104, 107),
    (198.560, 204.560, 108, 109),
    (204.560, 213.560, 110, 114),
    (213.560, 218.560, 115, 119),
    (218.560, 225.560, 120, 125),
    (225.560, 231.560, 126, 129),
    (231.560, 234.560, 130, 132),
    (234.560, 238.560, 133, 134),
    (238.560, 243.560, 135, 136),
    (243.560, 249.560, 137, 139),
    (249.560, 256.560, 140, 141),
    (256.560, 262.560, 142, 145),
    (262.560, 277.000, 146, 147),
]


def row_weight(row: dict[str, str]) -> float:
    text = row["lyric_or_beat"].strip()
    if text.startswith("[") and text.endswith("]"):
        return 0.25
    try:
        return max(0.2, float(row["duration_s"].replace(",", ".")))
    except ValueError:
        return 1.0


def main() -> None:
    rows: list[dict[str, str]] = []
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            row["id_int"] = int(row["id"])
            rows.append(row)

    by_id = {row["id_int"]: row for row in rows}
    covered: list[int] = []
    timeline: list[dict[str, object]] = []

    for start, end, first_id, last_id in SEGMENTS:
        group = [by_id[i] for i in range(first_id, last_id + 1)]
        weights = [row_weight(row) for row in group]
        total_weight = sum(weights)
        duration = end - start
        cursor = start

        for idx, (row, weight) in enumerate(zip(group, weights)):
            next_time = end if idx == len(group) - 1 else cursor + duration * (weight / total_weight)
            timeline.append(
                {
                    "id": row["id"],
                    "section": row["section"],
                    "lyric_or_beat": row["lyric_or_beat"],
                    "start_s": cursor,
                    "end_s": next_time,
                    "duration_s": next_time - cursor,
                    "filename_16x9": row["filename_16x9"],
                    "source": "whisper_segment_weighted",
                }
            )
            covered.append(row["id_int"])
            cursor = next_time

    expected = list(range(1, 148))
    missing = [i for i in expected if i not in covered]
    duplicate = sorted({i for i in covered if covered.count(i) > 1})
    if missing or duplicate:
        raise SystemExit(f"timeline coverage error missing={missing} duplicate={duplicate}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    SYNC_CSV.parent.mkdir(parents=True, exist_ok=True)

    with SYNC_CSV.open("w", encoding="utf-8", newline="") as f:
        fieldnames = [
            "id",
            "section",
            "lyric_or_beat",
            "start_s",
            "end_s",
            "duration_s",
            "filename_16x9",
            "source",
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        for item in timeline:
            writer.writerow(
                {
                    **item,
                    "start_s": f"{item['start_s']:.3f}",
                    "end_s": f"{item['end_s']:.3f}",
                    "duration_s": f"{item['duration_s']:.3f}",
                }
            )

    concat_lines = ["ffconcat version 1.0"]
    for item in timeline:
        img = IMG_DIR / str(item["filename_16x9"])
        if not img.exists():
            raise SystemExit(f"missing image: {img}")
        concat_lines.append(f"file '{img.as_posix()}'")
        concat_lines.append(f"duration {float(item['duration_s']):.6f}")
    concat_lines.append(f"file '{(IMG_DIR / str(timeline[-1]['filename_16x9'])).as_posix()}'")
    FFCONCAT.write_text("\n".join(concat_lines) + "\n", encoding="ascii")

    summary = {
        "rows": len(timeline),
        "start": timeline[0]["start_s"],
        "end": timeline[-1]["end_s"],
        "duration": timeline[-1]["end_s"],
        "sync_csv": str(SYNC_CSV),
        "ffconcat": str(FFCONCAT),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
