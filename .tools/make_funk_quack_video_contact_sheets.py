#!/usr/bin/env python3
"""Create three-frame contact sheets for fast Funk Quack video QA."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha")
TOOLS = Path(r"D:\Projects\dnd\.tools")
DEFAULT_FFMPEG = TOOLS / "ffmpeg" / "ffmpeg-8.1.2-essentials_build" / "bin" / "ffmpeg.exe"
DEFAULT_FFPROBE = DEFAULT_FFMPEG.with_name("ffprobe.exe")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--orientation", choices=("horizontal", "vertical"), required=True)
    parser.add_argument("--start-id", type=int, default=1)
    parser.add_argument("--end-id", type=int, default=147)
    parser.add_argument("--rows-per-sheet", type=int, default=6)
    parser.add_argument("--clip-dir", type=Path)
    parser.add_argument("--output-dir", type=Path)
    return parser.parse_args()


def tool(path: Path, name: str) -> Path:
    if path.exists():
        return path
    found = shutil.which(name)
    if not found:
        raise SystemExit(f"{name} not found")
    return Path(found)


def probe_duration(ffprobe: Path, path: Path) -> float:
    result = subprocess.run(
        [
            str(ffprobe),
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
    )
    return float(json.loads(result.stdout)["format"]["duration"])


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        Path(r"C:\Windows\Fonts\arial.ttf"),
        Path(r"C:\Windows\Fonts\segoeui.ttf"),
    )
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def extract_frame(
    ffmpeg: Path,
    video: Path,
    timestamp: float,
    destination: Path,
    width: int,
    height: int,
) -> Image.Image:
    subprocess.run(
        [
            str(ffmpeg),
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            f"{timestamp:.3f}",
            "-i",
            str(video),
            "-vf",
            f"scale={width}:{height}",
            "-frames:v",
            "1",
            str(destination),
        ],
        check=True,
    )
    with Image.open(destination) as image:
        return image.convert("RGB")


def main() -> int:
    args = parse_args()
    if args.start_id < 1 or args.end_id < args.start_id or args.rows_per_sheet < 1:
        raise SystemExit("invalid id range or rows-per-sheet")
    ffmpeg = tool(DEFAULT_FFMPEG, "ffmpeg")
    ffprobe = tool(DEFAULT_FFPROBE, "ffprobe")
    animated = ROOT / "videos_animados_ltx23"
    if args.orientation == "vertical":
        clip_dir = animated / "9x16_720x1280_prompt_direto_v4_sem_audio"
        thumb_width, thumb_height = 240, 426
    else:
        clip_dir = animated / "16x9_1280x720_prompt_direto_v4_sem_audio"
        thumb_width, thumb_height = 320, 176
    clip_dir = args.clip_dir or clip_dir
    output_dir = args.output_dir or (
        ROOT / "revisao" / "folhas_contato" / f"videos_{args.orientation}"
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    videos: list[tuple[int, Path]] = []
    missing: list[int] = []
    for item_id in range(args.start_id, args.end_id + 1):
        matches = sorted(clip_dir.glob(f"linha_{item_id:03d}_*.mp4"))
        if len(matches) == 1:
            videos.append((item_id, matches[0]))
        else:
            missing.append(item_id)
    if missing:
        print("Missing or duplicate ids: " + ",".join(f"{item:03d}" for item in missing))

    label_height = 38
    text_font = font(18)
    sheets: list[Path] = []
    with tempfile.TemporaryDirectory(prefix="funk_quack_contact_") as temp_name:
        temp = Path(temp_name)
        for page_index in range(0, len(videos), args.rows_per_sheet):
            page = videos[page_index : page_index + args.rows_per_sheet]
            canvas = Image.new(
                "RGB",
                (thumb_width * 3, (thumb_height + label_height) * len(page)),
                (20, 20, 24),
            )
            draw = ImageDraw.Draw(canvas)
            for row_index, (item_id, video) in enumerate(page):
                duration = probe_duration(ffprobe, video)
                times = (duration * 0.17, duration * 0.50, duration * 0.83)
                top = row_index * (thumb_height + label_height)
                for column, timestamp in enumerate(times):
                    frame_path = temp / f"{item_id:03d}_{column}.png"
                    frame = extract_frame(
                        ffmpeg,
                        video,
                        timestamp,
                        frame_path,
                        thumb_width,
                        thumb_height,
                    )
                    canvas.paste(frame, (column * thumb_width, top + label_height))
                draw.text(
                    (8, top + 8),
                    f"{item_id:03d}  {video.name}  frames: 17% / 50% / 83%",
                    fill=(245, 245, 245),
                    font=text_font,
                )
            first_id, last_id = page[0][0], page[-1][0]
            destination = output_dir / f"contato_{first_id:03d}_{last_id:03d}.jpg"
            canvas.save(destination, quality=92, optimize=True)
            sheets.append(destination)
            print(f"SAVED {destination}")

    print(f"SHEETS READY: {len(sheets)}")
    return 0 if not missing else 2


if __name__ == "__main__":
    raise SystemExit(main())
