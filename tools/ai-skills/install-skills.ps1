# Installs the design / animation / React skills for Claude Code into %USERPROFILE%\.claude\skills
# Run:  powershell -ExecutionPolicy Bypass -File .\install-skills.ps1
$ErrorActionPreference = "Stop"
$dest = Join-Path $env:USERPROFILE ".claude\skills"
$tmp  = Join-Path $env:TEMP "drivefix-skills"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$repos = @(
  @{ url = "https://github.com/vercel-labs/agent-skills";   skills = "skills" },   # react-best-practices, composition-patterns, react-view-transitions, web-design-guidelines
  @{ url = "https://github.com/emilkowalski/skills";        skills = "skills" },   # Emil Kowalski animation / design-engineering skills
  @{ url = "https://github.com/greensock/gsap-skills";      skills = "skills" },   # official GSAP skills
  @{ url = "https://github.com/heydamir/unslop";            skills = "skills" }    # unslop (anti AI-looking UI)
)
foreach ($r in $repos) {
  $name = Split-Path $r.url -Leaf
  git clone --depth 1 --quiet $r.url (Join-Path $tmp $name)
  if ($LASTEXITCODE -ne 0) { Write-Host "clone failed: $($r.url)" -ForegroundColor Red; continue }
  $src = Join-Path (Join-Path $tmp $name) $r.skills
  # emilkowalski/skills keeps skills one level deeper
  if (-not (Get-ChildItem $src -Directory | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") })) {
    $deeper = Join-Path $src "skills"; if (Test-Path $deeper) { $src = $deeper }
  }
  Get-ChildItem $src -Directory | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") } | ForEach-Object {
    $target = Join-Path $dest $_.Name
    if (Test-Path $target) { Remove-Item -Recurse -Force $target }
    Copy-Item -Recurse -Force $_.FullName $target
    Write-Host "installed $($_.Name)" -ForegroundColor Green
  }
}
Remove-Item -Recurse -Force $tmp
Write-Host "`nDone. Restart Claude Code to load them. Folder: $dest" -ForegroundColor Cyan
