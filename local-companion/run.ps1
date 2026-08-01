param(
    [Parameter(Position = 0)]
    [string]$DataRoot
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'

if ($DataRoot) {
    $configuredRoot = [System.IO.Path]::GetFullPath($DataRoot)
    New-Item -ItemType Directory -Force -Path $configuredRoot | Out-Null
    $env:CRAIG_TO_TEXT_ROOT = $configuredRoot
}

if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw 'Ambiente ausente. Execute: py -m venv .venv; .\.venv\Scripts\python -m pip install -e ".[dev]"'
}

& $pythonPath -m uvicorn app.main:app --host 127.0.0.1 --port 8765
