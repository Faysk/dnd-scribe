[CmdletBinding()]
param(
    [ValidateSet('status', 'watch-vertical', 'qa', 'preflight', 'finish')]
    [string]$Stage = 'status',

    [ValidateSet('dynamic', 'clean')]
    [string]$Style = 'dynamic',

    [int]$QaStart = 1,
    [int]$QaEnd = 147,

    [switch]$AlsoClean
)

$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $PSScriptRoot
$Python = 'python'

function Invoke-ProjectPython {
    param(
        [Parameter(Mandatory)]
        [string]$Script,

        [string[]]$Arguments = @()
    )

    $path = Join-Path $PSScriptRoot $Script
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing script: $path"
    }
    & $Python $path @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Script failed with exit code $LASTEXITCODE"
    }
}

function Get-ProductionStatus {
    $script = Join-Path $PSScriptRoot 'funk_quack_status.py'
    $json = & $Python $script --json
    if ($LASTEXITCODE -ne 0) {
        throw "funk_quack_status.py failed with exit code $LASTEXITCODE"
    }
    return ($json | ConvertFrom-Json)
}

function Assert-ComfyIdle {
    try {
        $queue = Invoke-RestMethod -Uri 'http://127.0.0.1:8188/queue' -Method Get -TimeoutSec 15
    }
    catch {
        Write-Host 'ComfyUI API is not responding; assuming it is stopped.'
        return
    }
    if ($queue.queue_running.Count -gt 0 -or $queue.queue_pending.Count -gt 0) {
        throw 'ComfyUI is still busy. Wait for the video watcher before rendering 4K masters.'
    }
}

function Assert-AllVideosReady {
    $status = Get-ProductionStatus
    $horizontalMissing = @($status.assets.videos_16x9.missing)
    $verticalMissing = @($status.assets.videos_9x16.missing)
    if ($horizontalMissing.Count -gt 0 -or $verticalMissing.Count -gt 0) {
        throw (
            'Animated videos are incomplete. Horizontal missing: {0}; vertical missing: {1}' -f
            ($horizontalMissing -join ','),
            ($verticalMissing -join ',')
        )
    }
}

switch ($Stage) {
    'status' {
        Invoke-ProjectPython -Script 'funk_quack_status.py'
    }

    'watch-vertical' {
        Invoke-ProjectPython -Script 'comfy_ltx23_watch_strict.py' -Arguments @(
            '--orientation', 'vertical',
            '--start-id', '1',
            '--end-id', '147',
            '--output-set', 'prompt_direto_v4_sem_audio',
            '--poll-interval', '15',
            '--idle-interval', '20'
        )
    }

    'qa' {
        Invoke-ProjectPython -Script 'make_funk_quack_video_contact_sheets.py' -Arguments @(
            '--orientation', 'vertical',
            '--start-id', $QaStart.ToString(),
            '--end-id', $QaEnd.ToString()
        )
    }

    'preflight' {
        Invoke-ProjectPython -Script 'build_funk_quack_animated_master.py' -Arguments @(
            '--orientation', 'horizontal', '--style', $Style, '--validate-only'
        )
        Invoke-ProjectPython -Script 'build_funk_quack_animated_master.py' -Arguments @(
            '--orientation', 'vertical', '--style', $Style, '--validate-only'
        )
        Invoke-ProjectPython -Script 'build_funk_quack_social_cuts.py' -Arguments @('--validate-only')
    }

    'finish' {
        Assert-ComfyIdle
        Assert-AllVideosReady

        Invoke-ProjectPython -Script 'make_funk_quack_video_contact_sheets.py' -Arguments @(
            '--orientation', 'horizontal', '--start-id', '1', '--end-id', '147'
        )
        Invoke-ProjectPython -Script 'make_funk_quack_video_contact_sheets.py' -Arguments @(
            '--orientation', 'vertical', '--start-id', '1', '--end-id', '147'
        )

        foreach ($orientation in @('horizontal', 'vertical')) {
            Invoke-ProjectPython -Script 'build_funk_quack_animated_master.py' -Arguments @(
                '--orientation', $orientation, '--style', 'dynamic'
            )
            if ($AlsoClean) {
                Invoke-ProjectPython -Script 'build_funk_quack_animated_master.py' -Arguments @(
                    '--orientation', $orientation, '--style', 'clean'
                )
            }
        }

        Invoke-ProjectPython -Script 'build_funk_quack_social_cuts.py'
        Invoke-ProjectPython -Script 'funk_quack_status.py'
        Write-Host "Pipeline complete: $Project"
    }
}
