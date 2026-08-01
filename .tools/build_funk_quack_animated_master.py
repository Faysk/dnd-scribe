#!/usr/bin/env python3
"""Build a frame-accurate 4K Funk Quack master from the animated clips.

The build is intentionally resumable. Each storyboard line is trimmed to the
Whisper timeline, normalized to the final canvas, and encoded as one segment.
The segments are then concatenated without another video encode and the
original song is muxed into the final master.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


ROOT = Path(r"D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha")
TOOLS = Path(r"D:\Projects\dnd\.tools")
DEFAULT_FFMPEG = TOOLS / "ffmpeg" / "ffmpeg-8.1.2-essentials_build" / "bin" / "ffmpeg.exe"
DEFAULT_FFPROBE = DEFAULT_FFMPEG.with_name("ffprobe.exe")


@dataclass(frozen=True)
class Orientation:
    source_dir: Path
    output_dir: Path
    width: int
    height: int
    master_name: str


@dataclass
class TimelineItem:
    id: int
    section: str
    lyric: str
    start_s: float
    end_s: float
    duration_s: float
    frames: int
    motion_hint: str
    camera: str
    source: str = ""
    source_duration_s: float = 0.0
    source_width: int = 0
    source_height: int = 0
    source_offset_s: float = 0.0
    segment: str = ""
    playback_speed: float = 1.0
    crop_zoom: float = 1.0
    saturation: float = 1.0
    contrast: float = 1.0
    brightness: float = 0.0
    transition_in: str = "none"
    transition_s: float = 0.0
    fade_out_s: float = 0.0
    emphasis: str = "none"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--orientation", choices=("horizontal", "vertical"), required=True)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--source-dir", type=Path)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--audio", type=Path)
    parser.add_argument("--ffmpeg", type=Path)
    parser.add_argument("--ffprobe", type=Path)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--encoder", choices=("auto", "h264_nvenc", "libx264"), default="auto")
    parser.add_argument("--scaler", choices=("auto", "cuda", "cpu"), default="auto")
    parser.add_argument("--cq", type=int, default=17, help="NVENC constant-quality value")
    parser.add_argument("--crf", type=int, default=17, help="libx264 CRF value")
    parser.add_argument("--style", choices=("dynamic", "clean"), default="dynamic")
    parser.add_argument("--edit-map", type=Path)
    parser.add_argument("--only", help="Render only comma-separated scene ids, without assembling a master")
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--force", action="store_true", help="Rebuild valid cached segments")
    return parser.parse_args()


def executable(explicit: Path | None, bundled: Path, name: str) -> Path:
    if explicit:
        path = explicit.resolve()
    elif bundled.exists():
        path = bundled
    else:
        found = shutil.which(name)
        if not found:
            raise SystemExit(f"{name} not found; pass --{name}")
        path = Path(found)
    if not path.exists():
        raise SystemExit(f"missing executable: {path}")
    return path


def orientation_config(args: argparse.Namespace) -> Orientation:
    videos = args.root / "videos_animados_ltx23"
    outputs = args.root / "videos"
    if args.orientation == "horizontal":
        config = Orientation(
            source_dir=videos / "16x9_1280x720_prompt_direto_v4_sem_audio",
            output_dir=outputs / "16x9" / "animado_sync",
            width=3840,
            height=2160,
            master_name="funk_quack_do_dandi_16x9_4k_animado_sync.mp4",
        )
    else:
        config = Orientation(
            source_dir=videos / "9x16_720x1280_prompt_direto_v4_sem_audio",
            output_dir=outputs / "9x16" / "animado_sync",
            width=2160,
            height=3840,
            master_name="funk_quack_do_dandi_9x16_4k_animado_sync.mp4",
        )
    return Orientation(
        source_dir=args.source_dir or config.source_dir,
        output_dir=args.output_dir or config.output_dir,
        width=config.width,
        height=config.height,
        master_name=config.master_name,
    )


def default_audio(root: Path) -> Path:
    candidates = (
        root.parent / "producao_funk_quack" / "audio" / "Funk Quack do Dandi.mp3",
        root.parent / "Funk Quack do Dandi.mp3",
    )
    for path in candidates:
        if path.exists():
            return path
    raise SystemExit("Funk Quack audio not found; pass --audio")


def run(command: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(
        command,
        check=False,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    if result.returncode:
        details = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"command failed ({result.returncode}): {' '.join(command)}\n{details}")
    return result.stdout or ""


def probe_video(ffprobe: Path, path: Path) -> dict[str, float | int]:
    output = run(
        [
            str(ffprobe),
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,avg_frame_rate,nb_frames:format=duration",
            "-of",
            "json",
            str(path),
        ],
        capture=True,
    )
    data = json.loads(output)
    if not data.get("streams"):
        raise RuntimeError(f"no video stream: {path}")
    stream = data["streams"][0]
    return {
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "duration": float(data["format"]["duration"]),
        "nb_frames": int(stream["nb_frames"]) if str(stream.get("nb_frames", "")).isdigit() else 0,
    }


def load_timeline(root: Path, fps: int) -> list[TimelineItem]:
    sync_path = root / "docs" / "sync_linha_a_linha_whisper.csv"
    storyboard_path = root / "docs" / "storyboard_linha_a_linha.csv"
    with storyboard_path.open("r", encoding="utf-8-sig", newline="") as handle:
        storyboard = {int(row["id"]): row for row in csv.DictReader(handle, delimiter=";")}
    with sync_path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter=";"))
    if len(rows) != 147:
        raise SystemExit(f"expected 147 sync rows, got {len(rows)}")

    result: list[TimelineItem] = []
    previous_end_frame = 0
    for row in rows:
        item_id = int(row["id"])
        start_s = float(row["start_s"].replace(",", "."))
        end_s = float(row["end_s"].replace(",", "."))
        end_frame = math.floor(end_s * fps + 0.5)
        frames = end_frame - previous_end_frame
        if frames < 1:
            raise SystemExit(f"timeline row {item_id:03d} has no output frame")
        story = storyboard[item_id]
        result.append(
            TimelineItem(
                id=item_id,
                section=row["section"],
                lyric=row["lyric_or_beat"],
                start_s=start_s,
                end_s=end_s,
                duration_s=frames / fps,
                frames=frames,
                motion_hint=story.get("motion_hint", ""),
                camera=story.get("camera", ""),
            )
        )
        previous_end_frame = end_frame

    expected_frames = math.floor(float(rows[-1]["end_s"]) * fps + 0.5)
    if sum(item.frames for item in result) != expected_frames:
        raise SystemExit("frame allocation does not cover the complete timeline")
    return result


def resolve_sources(source_dir: Path, timeline: list[TimelineItem]) -> list[str]:
    errors: list[str] = []
    for item in timeline:
        matches = sorted(source_dir.glob(f"linha_{item.id:03d}_*.mp4"))
        if not matches:
            errors.append(f"missing {item.id:03d}")
            continue
        if len(matches) > 1:
            errors.append(f"duplicate {item.id:03d}: {', '.join(path.name for path in matches)}")
            continue
        item.source = str(matches[0])
    return errors


def apply_edit_map(args: argparse.Namespace, timeline: list[TimelineItem]) -> Path | None:
    if args.style == "clean":
        return None
    path = args.edit_map or (args.root / "docs" / "edit_map_funk_quack.csv")
    if not path.exists():
        raise SystemExit(f"dynamic edit map not found: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = {int(row["id"]): row for row in csv.DictReader(handle, delimiter=";")}
    if sorted(rows) != list(range(1, 148)):
        raise SystemExit("dynamic edit map must contain exactly ids 001-147")
    allowed_transitions = {"none", "flash", "portal_glow", "dip_black"}
    for item in timeline:
        row = rows[item.id]
        item.playback_speed = float(row["playback_speed"])
        item.crop_zoom = float(row["crop_zoom"])
        item.saturation = float(row["saturation"])
        item.contrast = float(row["contrast"])
        item.brightness = float(row["brightness"])
        item.transition_in = row["transition_in"].strip()
        item.transition_s = float(row["transition_s"])
        item.fade_out_s = float(row["fade_out_s"])
        item.emphasis = row["emphasis"].strip() or "none"
        if not 0.5 <= item.playback_speed <= 2.0:
            raise SystemExit(f"invalid playback speed for {item.id:03d}")
        if not 1.0 <= item.crop_zoom <= 1.15:
            raise SystemExit(f"invalid crop zoom for {item.id:03d}")
        if item.transition_in not in allowed_transitions:
            raise SystemExit(f"invalid transition for {item.id:03d}: {item.transition_in}")
    return path


def choose_offset(item: TimelineItem) -> float:
    source_window = item.duration_s * item.playback_speed
    available = max(0.0, item.source_duration_s - source_window)
    if available <= 0:
        return 0.0
    motion = item.motion_hint.lower()
    slow_markers = ("fade", "dissolve", "slow", "hold", "soft")
    impact_markers = ("impact", "pop", "quick", "flash", "beat", "punch", "bounce")
    if any(marker in motion for marker in slow_markers):
        ratio = 0.05
    elif item.duration_s <= 0.9 or any(marker in motion for marker in impact_markers):
        ratio = 0.45
    else:
        ratio = 0.22
    return min(available, max(0.0, available * ratio))


def encoder_available(ffmpeg: Path, encoder: str) -> bool:
    output = run([str(ffmpeg), "-hide_banner", "-encoders"], capture=True)
    return encoder in output


def filter_available(ffmpeg: Path, filter_name: str) -> bool:
    output = run([str(ffmpeg), "-hide_banner", "-filters"], capture=True)
    return filter_name in output


def select_encoder(ffmpeg: Path, requested: str) -> str:
    if requested == "auto":
        return "h264_nvenc" if encoder_available(ffmpeg, "h264_nvenc") else "libx264"
    if requested == "h264_nvenc" and not encoder_available(ffmpeg, "h264_nvenc"):
        raise SystemExit("this FFmpeg build does not provide h264_nvenc")
    return requested


def select_scaler(ffmpeg: Path, requested: str) -> str:
    if requested == "auto":
        return "cuda" if filter_available(ffmpeg, "scale_cuda") else "cpu"
    if requested == "cuda" and not filter_available(ffmpeg, "scale_cuda"):
        raise SystemExit("this FFmpeg build does not provide scale_cuda")
    return requested


def encoder_options(args: argparse.Namespace, encoder: str) -> list[str]:
    if encoder == "h264_nvenc":
        return [
            "-c:v",
            "h264_nvenc",
            "-preset",
            "p6",
            "-tune",
            "hq",
            "-rc:v",
            "vbr",
            "-cq:v",
            str(args.cq),
            "-b:v",
            "0",
            "-spatial-aq",
            "1",
            "-aq-strength",
            "8",
        ]
    return ["-c:v", "libx264", "-preset", "slow", "-crf", str(args.crf)]


def segment_is_valid(ffprobe: Path, path: Path, item: TimelineItem, config: Orientation, fps: int) -> bool:
    if not path.exists() or path.stat().st_size < 1024:
        return False
    try:
        info = probe_video(ffprobe, path)
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError):
        return False
    expected_duration = item.frames / fps
    return (
        info["width"] == config.width
        and info["height"] == config.height
        and abs(float(info["duration"]) - expected_duration) <= (1.5 / fps)
    )


def render_segment(
    ffmpeg: Path,
    ffprobe: Path,
    args: argparse.Namespace,
    config: Orientation,
    item: TimelineItem,
    encoder: str,
    scaler: str,
    segment_dir: Path,
) -> None:
    segment = segment_dir / f"linha_{item.id:03d}.mp4"
    item.segment = str(segment)
    if not args.force and segment_is_valid(ffprobe, segment, item, config, args.fps):
        print(f"SKIP {item.id:03d}: cached segment is valid", flush=True)
        return

    temporary = segment.with_name(segment.stem + ".tmp.mp4")
    temporary.unlink(missing_ok=True)
    scaled_width = math.ceil((config.width * item.crop_zoom) / 2) * 2
    scaled_height = math.ceil((config.height * item.crop_zoom) / 2) * 2
    filters = [
        f"setpts=(PTS-STARTPTS)/{item.playback_speed:.6f}",
        f"fps={args.fps}",
    ]
    if scaler == "cuda":
        filters.extend(
            [
                "format=nv12",
                "hwupload_cuda",
                (
                    f"scale_cuda={scaled_width}:{scaled_height}:interp_algo=lanczos:"
                    "force_original_aspect_ratio=increase:reset_sar=1"
                ),
                "hwdownload",
                "format=nv12",
            ]
        )
    else:
        filters.append(
            f"scale={scaled_width}:{scaled_height}:"
            "force_original_aspect_ratio=increase:flags=lanczos"
        )
    filters.extend(
        [
            f"crop={scaled_width}:{scaled_height}",
            f"crop={config.width}:{config.height}",
            "setsar=1",
            "tpad=stop_mode=clone:stop_duration=30",
            (
                f"eq=saturation={item.saturation:.4f}:contrast={item.contrast:.4f}:"
                f"brightness={item.brightness:.4f}"
            ),
            "unsharp=5:5:0.35:5:5:0",
        ]
    )
    if item.transition_in != "none" and item.transition_s > 0:
        transition_duration = min(item.transition_s, item.duration_s * 0.60)
        transition_frames = max(1, round(transition_duration * args.fps))
        color = "black" if item.transition_in == "dip_black" else "white"
        filters.append(f"fade=t=in:s=0:n={transition_frames}:color={color}")
    if item.fade_out_s > 0:
        fade_duration = min(item.fade_out_s, item.duration_s)
        fade_frames = max(1, round(fade_duration * args.fps))
        fade_start_frame = max(0, item.frames - fade_frames)
        filters.append(f"fade=t=out:s={fade_start_frame}:n={fade_frames}:color=black")
    filters.append("format=yuv420p")
    video_filter = ",".join(filters)
    command = [
        str(ffmpeg),
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{item.source_offset_s:.6f}",
        "-i",
        item.source,
        "-vf",
        video_filter,
        "-frames:v",
        str(item.frames),
        "-fps_mode",
        "cfr",
        "-an",
        *encoder_options(args, encoder),
        "-profile:v",
        "high",
        "-g",
        str(args.fps * 2),
        "-pix_fmt",
        "yuv420p",
        "-video_track_timescale",
        "90000",
        "-movflags",
        "+faststart",
        str(temporary),
    ]
    run(command)
    if not segment_is_valid(ffprobe, temporary, item, config, args.fps):
        raise RuntimeError(f"rendered segment failed validation: {temporary}")
    temporary.replace(segment)
    print(
        f"SAVED {item.id:03d}: {item.frames} frames, source offset {item.source_offset_s:.3f}s",
        flush=True,
    )


def write_manifest(path: Path, timeline: list[TimelineItem]) -> None:
    fields = list(asdict(timeline[0]).keys())
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, delimiter=";")
        writer.writeheader()
        for item in timeline:
            writer.writerow(asdict(item))


def concat_segments(
    ffmpeg: Path,
    config: Orientation,
    timeline: list[TimelineItem],
    master_name: str,
    style: str,
) -> Path:
    concat_path = config.output_dir / f"timeline_animada_{style}.ffconcat"
    silent_master = config.output_dir / master_name.replace(".mp4", "_sem_audio.mp4")
    lines = ["ffconcat version 1.0"]
    for item in timeline:
        path = Path(item.segment).as_posix().replace("'", "'\\''")
        lines.append(f"file '{path}'")
    concat_path.write_text("\n".join(lines) + "\n", encoding="ascii")
    temporary = silent_master.with_name(silent_master.stem + ".tmp.mp4")
    temporary.unlink(missing_ok=True)
    run(
        [
            str(ffmpeg),
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_path),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(temporary),
        ]
    )
    temporary.replace(silent_master)
    return silent_master


def mux_audio(ffmpeg: Path, silent_master: Path, audio: Path, final_master: Path, duration_s: float) -> None:
    temporary = final_master.with_name(final_master.stem + ".tmp.mp4")
    temporary.unlink(missing_ok=True)
    run(
        [
            str(ffmpeg),
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(silent_master),
            "-i",
            str(audio),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "320k",
            "-t",
            f"{duration_s:.6f}",
            "-metadata",
            "title=Funk Quack do Dandi",
            "-metadata",
            "artist=faysk",
            "-movflags",
            "+faststart",
            str(temporary),
        ]
    )
    temporary.replace(final_master)


def main() -> int:
    args = parse_args()
    if args.fps < 1:
        raise SystemExit("--fps must be positive")
    config = orientation_config(args)
    ffmpeg = executable(args.ffmpeg, DEFAULT_FFMPEG, "ffmpeg")
    ffprobe = executable(args.ffprobe, DEFAULT_FFPROBE, "ffprobe")
    audio = args.audio or default_audio(args.root)
    timeline = load_timeline(args.root, args.fps)
    edit_map = apply_edit_map(args, timeline)

    source_errors = resolve_sources(config.source_dir, timeline)
    if source_errors:
        print(f"PRECHECK FAILED: {len(source_errors)} source issue(s)")
        for error in source_errors:
            print(f"  {error}")
        return 2

    probe_errors: list[str] = []
    for item in timeline:
        try:
            info = probe_video(ffprobe, Path(item.source))
            item.source_duration_s = float(info["duration"])
            item.source_width = int(info["width"])
            item.source_height = int(info["height"])
            item.source_offset_s = choose_offset(item)
        except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as exc:
            probe_errors.append(f"{item.id:03d}: {exc}")
    if probe_errors:
        print(f"PRECHECK FAILED: {len(probe_errors)} invalid clip(s)")
        for error in probe_errors:
            print(f"  {error}")
        return 2

    total_frames = sum(item.frames for item in timeline)
    duration_s = total_frames / args.fps
    print(
        json.dumps(
            {
                "orientation": args.orientation,
                "clips": len(timeline),
                "frames": total_frames,
                "fps": args.fps,
                "duration_s": duration_s,
                "canvas": f"{config.width}x{config.height}",
                "source_dir": str(config.source_dir),
                "style": args.style,
                "edit_map": str(edit_map) if edit_map else None,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    if args.validate_only:
        print("PRECHECK OK")
        return 0

    encoder = select_encoder(ffmpeg, args.encoder)
    scaler = select_scaler(ffmpeg, args.scaler)
    config.output_dir.mkdir(parents=True, exist_ok=True)
    segment_dir = config.output_dir / f"segmentos_{args.style}"
    segment_dir.mkdir(parents=True, exist_ok=True)
    print(f"Encoder: {encoder}")
    print(f"Scaler: {scaler}")

    selected = timeline
    if args.only:
        wanted = {int(value.strip()) for value in args.only.split(",") if value.strip()}
        invalid = sorted(item for item in wanted if item < 1 or item > 147)
        if invalid:
            raise SystemExit(f"invalid --only ids: {invalid}")
        selected = [item for item in timeline if item.id in wanted]
        if not selected:
            raise SystemExit("--only did not select any scene")

    for item in selected:
        render_segment(ffmpeg, ffprobe, args, config, item, encoder, scaler, segment_dir)

    if args.only:
        partial_manifest = config.output_dir / f"manifest_segmentos_{args.style}_parcial.csv"
        write_manifest(partial_manifest, selected)
        print(f"SEGMENTS READY: {','.join(f'{item.id:03d}' for item in selected)}")
        return 0

    manifest = config.output_dir / f"manifest_timeline_animada_{args.style}.csv"
    write_manifest(manifest, timeline)
    master_name = (
        config.master_name
        if args.style == "dynamic"
        else config.master_name.replace(".mp4", "_limpo.mp4")
    )
    silent_master = concat_segments(ffmpeg, config, timeline, master_name, args.style)
    final_master = config.output_dir / master_name
    mux_audio(ffmpeg, silent_master, audio, final_master, duration_s)

    final_info = probe_video(ffprobe, final_master)
    if final_info["width"] != config.width or final_info["height"] != config.height:
        raise SystemExit(f"final master has invalid dimensions: {final_info}")
    if abs(float(final_info["duration"]) - duration_s) > (2 / args.fps):
        raise SystemExit(f"final master has invalid duration: {final_info}")
    print(f"MASTER READY: {final_master}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted; completed segments remain available for resume.", file=sys.stderr)
        raise SystemExit(130)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
