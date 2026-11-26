# One-time setup for S4 Towing. Run from this folder: powershell -ExecutionPolicy Bypass -File .\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Django 5 runs on Python 3.11+. Prefer 3.12 (the version used by S1).
$py = $null
foreach ($v in "3.12", "3.13", "3.11", "3.14") {
    try { & py "-$v" --version *> $null; if ($LASTEXITCODE -eq 0) { $py = @("py", "-$v"); break } } catch {}
}
if (-not $py) {
    try { & python --version *> $null; if ($LASTEXITCODE -eq 0) { $py = @("python") } } catch {}
}
if (-not $py) {
    Write-Host "Python 3.11+ not found. Install it: https://www.python.org/downloads/ (tick 'Add python.exe to PATH'), then run this script again." -ForegroundColor Red
    exit 1
}
Write-Host "Using $($py -join ' ')" -ForegroundColor Green

# 1) Virtual environment + packages (all local to this service folder).
if (-not (Test-Path .venv)) { & $py[0] $py[1..($py.Length - 1)] -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install --upgrade pip --quiet
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt --quiet
if ($LASTEXITCODE -ne 0) { Write-Host "pip install failed" -ForegroundColor Red; exit 1 }

# 2) .env: shared demo secrets; DATABASE_URL stays empty -> SQLite, no external DB.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
(Get-Content .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=' | Set-Content .env

# 3) Tables, seed data, and the self-contained test suite.
& .\.venv\Scripts\python.exe manage.py migrate
if ($LASTEXITCODE -ne 0) { Write-Host "migrate failed" -ForegroundColor Red; exit 1 }
& .\.venv\Scripts\python.exe manage.py seed --reset
& .\.venv\Scripts\python.exe manage.py test
Write-Host "`nDone. Start the service with:  .\run.ps1" -ForegroundColor Green
