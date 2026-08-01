param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\dist\companion-installer')
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$companionRoot = Join-Path $repoRoot 'local-companion'
$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("dnd-scribe-installer-" + [guid]::NewGuid().ToString('N'))
$payloadRoot = Join-Path $temporaryRoot 'payload'
$payloadZip = Join-Path $temporaryRoot 'companion-payload.zip'
$trayExecutable = Join-Path $temporaryRoot 'DnDScribeCompanion.exe'
$executable = Join-Path $outputRoot 'DnDScribeCompanionSetup.exe'

New-Item -ItemType Directory -Force -Path $payloadRoot, $outputRoot | Out-Null
try {
    Copy-Item -LiteralPath (Join-Path $companionRoot 'app') -Destination $payloadRoot -Recurse
    Copy-Item -LiteralPath (Join-Path $companionRoot 'static') -Destination $payloadRoot -Recurse
    foreach ($name in @('pyproject.toml', 'run.ps1', 'README.md')) {
        Copy-Item -LiteralPath (Join-Path $companionRoot $name) -Destination (Join-Path $payloadRoot $name)
    }
    Compress-Archive -Path (Join-Path $payloadRoot '*') -DestinationPath $payloadZip -CompressionLevel Optimal

    $compilerCandidates = @(
        'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe',
        'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
    )
    $compiler = $compilerCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $compiler) { throw 'Compilador .NET Framework não encontrado.' }

    & $compiler /nologo /target:winexe /platform:anycpu /optimize+ `
        "/out:$trayExecutable" `
        /reference:System.dll `
        /reference:System.Core.dll `
        /reference:System.Drawing.dll `
        /reference:System.Windows.Forms.dll `
        /reference:System.Web.Extensions.dll `
        (Join-Path $PSScriptRoot 'CompanionTray.cs')
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $trayExecutable)) {
        throw 'Falha ao compilar o controlador da bandeja.'
    }

    & $compiler /nologo /target:winexe /platform:anycpu /optimize+ `
        "/out:$executable" `
        "/resource:$payloadZip,DnDScribe.CompanionPayload.zip" `
        "/resource:$trayExecutable,DnDScribe.CompanionTray.exe" `
        /reference:System.dll `
        /reference:System.Core.dll `
        /reference:System.Drawing.dll `
        /reference:System.Windows.Forms.dll `
        /reference:System.IO.Compression.dll `
        /reference:System.IO.Compression.FileSystem.dll `
        (Join-Path $PSScriptRoot 'CompanionSetup.cs')
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $executable)) {
        throw 'Falha ao compilar o instalador.'
    }
    Copy-Item -LiteralPath $trayExecutable -Destination (Join-Path $outputRoot 'DnDScribeCompanion.exe') -Force

    $file = Get-Item -LiteralPath $executable
    $hash = Get-FileHash -LiteralPath $executable -Algorithm SHA256
    [pscustomobject]@{
        path = $file.FullName
        bytes = $file.Length
        sha256 = $hash.Hash.ToLowerInvariant()
        version = '0.3.0'
    } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $outputRoot 'release.json') -Encoding utf8
    Get-Content -Raw -LiteralPath (Join-Path $outputRoot 'release.json')
}
finally {
    $resolvedTemporary = [System.IO.Path]::GetFullPath($temporaryRoot)
    $allowedTemporary = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    if ($resolvedTemporary.StartsWith($allowedTemporary, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedTemporary)) {
        Remove-Item -LiteralPath $resolvedTemporary -Recurse -Force
    }
}
