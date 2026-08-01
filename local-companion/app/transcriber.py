from __future__ import annotations

import json
import os
import sys
import time
from io import BytesIO
from pathlib import Path
from typing import Any, Callable


_DLL_HANDLES: list[Any] = []


def configure_cuda_dlls() -> list[str]:
    """Expose pip-installed NVIDIA DLLs to CTranslate2 on Windows."""
    if sys.platform != "win32" or not hasattr(os, "add_dll_directory"):
        return []
    site_packages = Path(sys.prefix) / "Lib" / "site-packages" / "nvidia"
    candidates = [
        site_packages / "cublas" / "bin",
        site_packages / "cudnn" / "bin",
        site_packages / "cuda_nvrtc" / "bin",
    ]
    configured = []
    for directory in candidates:
        if directory.is_dir():
            _DLL_HANDLES.append(os.add_dll_directory(str(directory)))
            configured.append(str(directory))
    if configured:
        os.environ["PATH"] = os.pathsep.join(configured + [os.environ.get("PATH", "")])
    return configured


def decode_audio_prefix(path: str, seconds: int, sampling_rate: int = 16000):
    """Decode only the requested prefix instead of expanding a multi-hour track."""
    import av
    import numpy as np

    max_samples = seconds * sampling_rate
    raw = BytesIO()
    resampler = av.audio.resampler.AudioResampler(
        format="s16",
        layout="mono",
        rate=sampling_rate,
    )
    with av.open(path, mode="r", metadata_errors="ignore") as container:
        for frame in container.decode(audio=0):
            for resampled in resampler.resample(frame):
                raw.write(resampled.to_ndarray().tobytes())
                if raw.tell() // 2 >= max_samples:
                    break
            if raw.tell() // 2 >= max_samples:
                break
    samples = np.frombuffer(raw.getbuffer(), dtype=np.int16, count=min(max_samples, raw.tell() // 2))
    return samples.astype(np.float32) / 32768.0


def merge_segments(tracks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    timeline: list[dict[str, Any]] = []
    for track in tracks:
        speaker = track["speaker"]
        filename = track["filename"]
        for segment in track.get("segments", []):
            text = segment.get("text", "").strip()
            if not text:
                continue
            timeline.append(
                {
                    "id": f"{speaker}-{segment['id']}",
                    "speaker": speaker,
                    "track": filename,
                    "start": round(float(segment["start"]), 3),
                    "end": round(float(segment["end"]), 3),
                    "text": text,
                    "words": segment.get("words", []),
                }
            )
    timeline.sort(key=lambda item: (item["start"], item["end"], item["speaker"]))
    return timeline


def transcribe_session(
    session: dict[str, Any],
    session_dir: Path,
    update: Callable[[dict[str, Any]], None],
    *,
    model_name: str,
    device: str,
    compute_type: str,
    glossary: str,
    sample_minutes: int | None,
    model_root: Path | None = None,
) -> dict[str, Any]:
    configure_cuda_dlls()
    from faster_whisper import WhisperModel
    from faster_whisper.utils import download_model

    started = time.time()
    session["status"] = "loading_model"
    session["error"] = None
    session["progress"] = {"stage": "checking_model"}
    update(session)

    model_root = model_root or session_dir.parent.parent / "model_files"
    model_path = model_root / model_name.replace("/", "--")
    required_files = ("config.json", "model.bin", "tokenizer.json")
    if not all((model_path / filename).is_file() for filename in required_files):
        session["progress"] = {"stage": "downloading_model"}
        update(session)
        model_path.mkdir(parents=True, exist_ok=True)
        download_model(model_name, output_dir=str(model_path))

    session["progress"] = {"stage": "loading_cuda" if device == "cuda" else "loading_cpu"}
    update(session)
    model = WhisperModel(
        str(model_path),
        device=device,
        compute_type=compute_type,
    )

    output_tracks: list[dict[str, Any]] = []
    track_count = len(session["tracks"])
    for index, track in enumerate(session["tracks"]):
        session["status"] = "transcribing"
        session["progress"] = {
            "track": index + 1,
            "total_tracks": track_count,
            "speaker": track["speaker"],
        }
        update(session)

        kwargs: dict[str, Any] = {
            "language": "pt",
            "task": "transcribe",
            "beam_size": 5,
            "vad_filter": True,
            "vad_parameters": {
                "min_silence_duration_ms": 500,
                "speech_pad_ms": 300,
            },
            "word_timestamps": True,
            "condition_on_previous_text": False,
            "hotwords": glossary or None,
        }
        if glossary:
            kwargs["initial_prompt"] = (
                "Sessão de RPG Dungeons & Dragons em português. "
                f"Nomes e termos importantes: {glossary}"
            )
        audio_input: Any = track["path"]
        if sample_minutes:
            audio_input = decode_audio_prefix(track["path"], sample_minutes * 60)

        segments, info = model.transcribe(audio_input, **kwargs)
        serialized_segments = []
        for segment in segments:
            words = [
                {
                    "start": round(float(word.start), 3),
                    "end": round(float(word.end), 3),
                    "word": word.word,
                    "probability": round(float(word.probability), 4),
                }
                for word in (segment.words or [])
            ]
            serialized_segments.append(
                {
                    "id": segment.id,
                    "start": round(float(segment.start), 3),
                    "end": round(float(segment.end), 3),
                    "text": segment.text.strip(),
                    "avg_logprob": round(float(segment.avg_logprob), 4),
                    "words": words,
                }
            )

        track_result = {
            **track,
            "language": info.language,
            "language_probability": round(float(info.language_probability), 4),
            "duration": round(float(info.duration), 3),
            "duration_after_vad": round(float(info.duration_after_vad), 3),
            "segments": serialized_segments,
        }
        output_tracks.append(track_result)
        (session_dir / f"transcript-{track['speaker']}.json").write_text(
            json.dumps(track_result, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    session["transcript"] = merge_segments(output_tracks)
    session["transcribed_tracks"] = output_tracks
    session["status"] = "complete"
    session["mode"] = "sample" if sample_minutes else "full"
    session["model"] = model_name
    session["device"] = device
    session["elapsed_seconds"] = round(time.time() - started, 1)
    session["progress"] = {"track": track_count, "total_tracks": track_count}
    update(session)
    return session


def markdown_export(session: dict[str, Any]) -> str:
    def timestamp(seconds: float) -> str:
        value = int(seconds)
        return f"{value // 3600:02d}:{(value % 3600) // 60:02d}:{value % 60:02d}"

    lines = [
        f"# Sessão {session['recording_id']}",
        "",
        f"- Início: {session.get('start_time') or 'desconhecido'}",
        f"- Modelo: {session.get('model') or '—'}",
        f"- Formato-fonte: {session.get('format', '').upper()} multi-track",
        "",
        "## Transcrição",
        "",
    ]
    for item in session.get("transcript", []):
        lines.append(f"**[{timestamp(item['start'])}] {item['speaker']}:** {item['text']}")
        lines.append("")
    return "\n".join(lines)
