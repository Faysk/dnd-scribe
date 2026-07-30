from __future__ import annotations

import subprocess
import sys
from pathlib import Path


_PICKER_SCRIPT = r"""
import tkinter as tk
from tkinter import filedialog

root = tk.Tk()
root.withdraw()
root.attributes("-topmost", True)
root.update()
selected = filedialog.askopenfilename(
    parent=root,
    title="Selecione o ZIP FLAC Multi-track do Craig",
    filetypes=[
        ("ZIP do Craig", "*.zip"),
        ("Todos os arquivos", "*.*"),
    ],
)
root.destroy()
if selected:
    print(selected)
"""


def select_craig_archive() -> Path | None:
    """Open the native Windows file picker in an isolated GUI process."""
    if sys.platform != "win32":
        raise RuntimeError("O seletor nativo está disponível apenas no Windows.")
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    try:
        result = subprocess.run(
            [sys.executable, "-c", _PICKER_SCRIPT],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=300,
            creationflags=flags,
        )
    except subprocess.TimeoutExpired as error:
        raise RuntimeError("O seletor de arquivos expirou após cinco minutos.") from error
    if result.returncode != 0:
        detail = result.stderr.strip() or "falha desconhecida"
        raise RuntimeError(f"Não foi possível abrir o seletor do Windows: {detail}")
    selected = result.stdout.strip()
    return Path(selected).resolve() if selected else None
