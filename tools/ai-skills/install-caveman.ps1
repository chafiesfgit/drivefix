# Installs the caveman skills (caveman, ultracave, megacave) into %USERPROFILE%\.claude\skills
# Skills only: no hooks, no settings changes.
# Run:  powershell -ExecutionPolicy Bypass -File .\install-caveman.ps1
$ErrorActionPreference = "Stop"
$dest = Join-Path $env:USERPROFILE ".claude\skills"
$tmp  = Join-Path $env:TEMP "caveman-skill"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
git clone --depth 1 --quiet https://github.com/JuliusBrussee/caveman.git $tmp
if ($LASTEXITCODE -ne 0) { Write-Host "clone failed" -ForegroundColor Red; exit 1 }
foreach ($s in "caveman","ultracave","megacave") {
  $src = Join-Path $tmp "skills\$s"
  $target = Join-Path $dest $s
  if (Test-Path $target) { Remove-Item -Recurse -Force $target }
  Copy-Item -Recurse -Force $src $target
  Write-Host "installed $s" -ForegroundColor Green
}
Remove-Item -Recurse -Force $tmp
Write-Host "`nDone. Restart Claude Code, then type /caveman. Folder: $dest" -ForegroundColor Cyan
