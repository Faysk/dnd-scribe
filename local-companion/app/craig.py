from __future__ import annotations

import re
import zipfile
import hashlib
from dataclasses import dataclass
from pathlib import Path


AUDIO_EXTENSIONS = {".flac", ".wav", ".aac", ".m4a", ".ogg", ".opus"}
FORMAT_RANK = {".flac": 0, ".wav": 1, ".opus": 2, ".m4a": 3, ".aac": 3, ".ogg": 4}
RECORDING_RE = re.compile(r"^Recording\s+(.+?)\s*$", re.MULTILINE)
START_RE = re.compile(r"^Start time:\s*(.+?)\s*$", re.MULTILINE)
TRACK_RE = re.compile(r"^\s*([^\s#]+)#\d+\s+\((\d+)\)\s*$", re.MULTILINE)
SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9._-]+")


@dataclass(frozen=True)
class CraigArchive:
    path: Path
    recording_id: str
    start_time: str | None
    tracks: list[dict[str, str]]
    audio_entries: list[str]
    format: str
    size: int


def parse_info(text: str) -> tuple[str, str | None, list[dict[str, str]]]:
    recording = RECORDING_RE.search(text)
    if not recording:
        raise ValueError("info.txt não contém o ID da gravação")
    start = START_RE.search(text)
    tracks = [
        {"speaker": match.group(1), "discord_id": match.group(2)}
        for match in TRACK_RE.finditer(text)
    ]
    return recording.group(1).strip(), start.group(1).strip() if start else None, tracks


def inspect_archive(path: Path) -> CraigArchive:
    path = path.resolve()
    if path.suffix.lower() != ".zip" or not path.is_file():
        raise ValueError("O caminho precisa apontar para um ZIP existente")
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        info_name = next((name for name in names if Path(name).name.lower() == "info.txt"), None)
        if not info_name:
            raise ValueError("ZIP não parece ser uma exportação do Craig: info.txt ausente")
        info = archive.read(info_name).decode("utf-8", errors="replace")
        recording_id, start_time, tracks = parse_info(info)
        audio_entries = [
            name
            for name in names
            if not name.endswith("/") and Path(name).suffix.lower() in AUDIO_EXTENSIONS
        ]
        if not audio_entries:
            raise ValueError("ZIP do Craig não contém faixas de áudio reconhecidas")
        extensions = {Path(name).suffix.lower() for name in audio_entries}
        format_name = min(extensions, key=lambda ext: FORMAT_RANK.get(ext, 99)).lstrip(".")
    return CraigArchive(
        path=path,
        recording_id=recording_id,
        start_time=start_time,
        tracks=tracks,
        audio_entries=audio_entries,
        format=format_name,
        size=path.stat().st_size,
    )


def list_archives(download_dir: Path) -> list[CraigArchive]:
    archives: list[CraigArchive] = []
    for path in download_dir.glob("*.zip"):
        try:
            archives.append(inspect_archive(path))
        except (ValueError, zipfile.BadZipFile):
            continue
    return sorted(
        archives,
        key=lambda item: (item.recording_id, FORMAT_RANK.get(f".{item.format}", 99), item.path.name),
    )


def _safe_filename(name: str) -> str:
    cleaned = SAFE_NAME_RE.sub("-", Path(name).name).strip(".-")
    if not cleaned:
        raise ValueError("Nome de faixa inválido")
    return cleaned


def extract_archive(source: Path, destination: Path) -> CraigArchive:
    metadata = inspect_archive(source)
    destination.mkdir(parents=True, exist_ok=True)
    tracks_dir = destination / "tracks"
    tracks_dir.mkdir(exist_ok=True)

    extracted: list[dict[str, str]] = []
    with zipfile.ZipFile(metadata.path) as archive:
        for entry_name in metadata.audio_entries:
            output_name = _safe_filename(entry_name)
            output = tracks_dir / output_name
            digest = hashlib.sha256()
            byte_count = 0
            with archive.open(entry_name) as source_file, output.open("wb") as target_file:
                while chunk := source_file.read(1024 * 1024):
                    target_file.write(chunk)
                    digest.update(chunk)
                    byte_count += len(chunk)
            match = re.match(r"^(\d+)-(.+?)\.[^.]+$", output_name)
            speaker = match.group(2) if match else output.stem
            extracted.append(
                {
                    "speaker": speaker,
                    "filename": output_name,
                    "path": str(output),
                    "bytes": byte_count,
                    "sha256": digest.hexdigest(),
                }
            )

        info_entry = next(
            name for name in archive.namelist() if Path(name).name.lower() == "info.txt"
        )
        (destination / "info.txt").write_bytes(archive.read(info_entry))

    return CraigArchive(
        path=metadata.path,
        recording_id=metadata.recording_id,
        start_time=metadata.start_time,
        tracks=extracted,
        audio_entries=metadata.audio_entries,
        format=metadata.format,
        size=metadata.size,
    )
