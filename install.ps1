param(
  [string]$Profile = (Join-Path $env:USERPROFILE '.dsh\profiles\desktop'),
  [string]$Source = $PSScriptRoot
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Profile)) { throw "profile not found: $Profile" }
$patch = Join-Path $Profile 'cordis.patch.yml'
if (-not (Test-Path $patch)) { throw "profile patch not found: $patch (run DeepSeek Harness once first)" }

$target = Join-Path $Profile 'node_modules\dsh-skin-qq2007'
New-Item -ItemType Directory -Force -Path (Join-Path $target 'lib'), (Join-Path $target 'assets') | Out-Null
Copy-Item (Join-Path $Source 'package.json') $target -Force
Copy-Item (Join-Path $Source 'lib\index.js') (Join-Path $target 'lib') -Force
Copy-Item (Join-Path $Source 'lib\client.js') (Join-Path $target 'lib') -Force
Copy-Item (Join-Path $Source 'assets\qq-avatar.png') (Join-Path $target 'assets') -Force
Write-Host "installed package -> $target"

$yaml = Get-Content $patch -Raw
if ($yaml -notmatch 'dsh-skin-qq2007') {
  $block = "- insert:`n    - id: skin-qq2007`n      name: dsh-skin-qq2007`n"
  Set-Content -Path $patch -Value ($yaml.TrimEnd() + "`n" + $block) -Encoding utf8 -NoNewline
  Write-Host "registered loader row skin-qq2007 in $patch"
} else {
  Write-Host "loader row already present in $patch"
}

Write-Host ''
Write-Host 'Done. The running Harness hot-loads the new row; if the window does not recolor, restart DeepSeek Harness.'
Write-Host 'Switch between QQ and native with the penguin pill at the bottom-right of the window.'
