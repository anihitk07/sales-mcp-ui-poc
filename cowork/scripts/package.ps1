[CmdletBinding()]
param([string]$Output = "sales-companion-cowork.zip")

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $root $Output

Push-Location $root
try {
  foreach ($item in @('manifest.json', 'color.png', 'outline.png', 'README.md', 'tools/server-tools.json', 'skills')) {
    if (-not (Test-Path $item)) { throw "Missing required package item: $item" }
  }
  Get-Content 'manifest.json' -Raw | ConvertFrom-Json | Out-Null
  Get-Content 'tools/server-tools.json' -Raw | ConvertFrom-Json | Out-Null

  Get-ChildItem 'skills' -Directory | ForEach-Object {
    $skillFile = Join-Path $_.FullName 'SKILL.md'
    if (-not (Test-Path $skillFile)) { throw "Skill folder '$($_.Name)' is missing SKILL.md" }
    $match = Select-String -Path $skillFile -Pattern '^name:\s*(.+)$' | Select-Object -First 1
    if (-not $match -or $match.Matches[0].Groups[1].Value.Trim() -ne $_.Name) {
      throw "Skill name must match folder: $($_.Name)"
    }
  }

  if (Test-Path $destination) { Remove-Item $destination -Force }
  Compress-Archive -Path 'manifest.json', 'color.png', 'outline.png', 'README.md', 'tools', 'skills' -DestinationPath $destination -Force

  $archive = [System.IO.Compression.ZipFile]::OpenRead($destination)
  try {
    $entries = @($archive.Entries.FullName -replace '\\', '/')
    foreach ($required in @('manifest.json', 'color.png', 'outline.png', 'README.md', 'tools/server-tools.json')) {
      if ($required -notin $entries) { throw "Package archive is missing: $required" }
    }
    if ($entries | Where-Object { $_ -match '^cowork/' }) { throw 'Package contains an unexpected cowork/ parent folder' }
  }
  finally {
    $archive.Dispose()
  }

  Write-Output (Resolve-Path $destination).Path
}
finally {
  Pop-Location
}
