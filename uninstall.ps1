param(
  [string]$Profile = (Join-Path $env:USERPROFILE '.dsh\profiles\desktop')
)
$ErrorActionPreference = 'Stop'

$patch = Join-Path $Profile 'cordis.patch.yml'
$target = Join-Path $Profile 'node_modules\dsh-skin-qq2007'

if (Test-Path $patch) {
  $yaml = Get-Content $patch -Raw
  $pattern = '(?ms)\r?\n?- insert:\r?\n    - id: skin-qq2007\r?\n      name: dsh-skin-qq2007[^\r\n]*'
  $next = [regex]::Replace($yaml, $pattern, '')
  if ($next -ne $yaml) {
    Set-Content -Path $patch -Value ($next.TrimEnd() + "`n") -Encoding utf8 -NoNewline
    Write-Host "removed loader row skin-qq2007 from $patch"
  } else {
    Write-Host "loader row not present in $patch"
  }
}

if (Test-Path $target) {
  Remove-Item -Recurse -Force $target
  Write-Host "removed $target"
}

Write-Host 'Done. Refresh or restart DeepSeek Harness to return to the official look.'
