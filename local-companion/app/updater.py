from __future__ import annotations

import hashlib
import os
import subprocess
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from uuid import uuid4


MAX_INSTALLER_BYTES = 10 * 1024 * 1024
TRUSTED_RELEASE_HOST = "dmrqnbdvbkfqzctcerbx.supabase.co"
TRUSTED_RELEASE_PATH = (
    "/storage/v1/object/sign/companion-releases/"
    "windows/DnDScribeCompanionSetup.exe"
)


def _stable_version(value: str) -> tuple[int, int, int]:
    parts = str(value or "").strip().split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        raise ValueError("Versão do Companion inválida.")
    return tuple(int(part) for part in parts)


def validate_release_url(url: str) -> str:
    value = str(url or "").strip()
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname != TRUSTED_RELEASE_HOST:
        raise ValueError("A atualização não veio do servidor oficial do DnD Scribe.")
    if parsed.path != TRUSTED_RELEASE_PATH:
        raise ValueError("O link de atualização não aponta para o instalador oficial.")
    if not parsed.query:
        raise ValueError("O link privado de atualização está incompleto ou expirado.")
    return value


def update_root(storage_root: Path) -> Path:
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        return Path(local_app_data) / "DnDScribe" / "Updates"
    return Path(storage_root) / ".updates"


def download_installer(
    url: str,
    destination_root: Path,
    *,
    expected_sha256: str | None = None,
) -> tuple[Path, str, int]:
    trusted_url = validate_release_url(url)
    destination_root.mkdir(parents=True, exist_ok=True)
    temporary = destination_root / f".companion-update-{uuid4().hex}.partial"
    digest = hashlib.sha256()
    total = 0
    try:
        request = Request(
            trusted_url,
            headers={"User-Agent": "DnDScribe-Companion-Updater/1"},
        )
        with urlopen(request, timeout=45) as response, temporary.open("wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_INSTALLER_BYTES:
                    raise ValueError("O instalador recebido ultrapassa o limite de 10 MB.")
                digest.update(chunk)
                handle.write(chunk)
            handle.flush()
            os.fsync(handle.fileno())

        if total < 1024:
            raise ValueError("O instalador recebido está vazio ou incompleto.")
        with temporary.open("rb") as handle:
            if handle.read(2) != b"MZ":
                raise ValueError("O arquivo recebido não é um executável Windows válido.")

        sha256 = digest.hexdigest()
        if expected_sha256:
            expected = expected_sha256.strip().lower()
            if len(expected) != 64 or any(char not in "0123456789abcdef" for char in expected):
                raise ValueError("SHA-256 esperado inválido.")
            if sha256 != expected:
                raise ValueError("A atualização falhou na verificação SHA-256.")

        final_path = destination_root / f"DnDScribeCompanionSetup-{sha256[:12]}.exe"
        os.replace(temporary, final_path)
        return final_path, sha256, total
    finally:
        temporary.unlink(missing_ok=True)


def verify_installer(path: Path) -> None:
    creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    result = subprocess.run(
        [str(path), "/verify"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=45,
        check=False,
        creationflags=creation_flags,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "O instalador baixado não passou na verificação interna do DnD Scribe."
        )


def launch_installer(path: Path) -> None:
    if os.name != "nt":
        raise RuntimeError("A atualização automática só está disponível no Windows.")
    creation_flags = (
        getattr(subprocess, "DETACHED_PROCESS", 0)
        | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    )
    subprocess.Popen(
        [str(path)],
        cwd=str(path.parent),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
        creationflags=creation_flags,
    )


def prepare_update(
    *,
    current_version: str,
    target_version: str,
    url: str,
    storage_root: Path,
    expected_sha256: str | None = None,
    verify=verify_installer,
    launch=launch_installer,
) -> dict:
    current = _stable_version(current_version)
    target = _stable_version(target_version)
    if target <= current:
        return {
            "status": "current",
            "current_version": current_version,
            "target_version": target_version,
        }

    installer, sha256, size = download_installer(
        url,
        update_root(storage_root),
        expected_sha256=expected_sha256,
    )
    verify(installer)
    launch(installer)
    return {
        "status": "installer_started",
        "current_version": current_version,
        "target_version": target_version,
        "sha256": sha256,
        "bytes": size,
        "installer": str(installer),
    }
