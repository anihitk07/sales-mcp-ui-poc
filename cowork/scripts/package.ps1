param([string]$Output = "sales-companion-cowork.zip")
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $root $Output
Compress-Archive -Path (Join-Path $root 'manifest.json'), (Join-Path $root 'README.md'), (Join-Path $root 'tools'), (Join-Path $root 'skills') -DestinationPath $destination -Force
Write-Output $destination
