# One-time setup for S1 Identity. Run from this folder:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# 1) Find Python 3.12 (3.11 / 3.13 also fine). Python 3.14+ has no psycopg2 wheel yet.
$py = $null
foreach ($v in "3.12", "3.13", "3.11") {
    try { & py "-$v" --version *> $null; if ($LASTEXITCODE -eq 0) { $py = @("py", "-$v"); break } } catch {}
}
if (-not $py) {
    Write-Host "Python 3.12 not found." -ForegroundColor Red
    Write-Host "Install it: https://www.python.org/downloads/release/python-3129/  (tick 'Add python.exe to PATH'), then run this script again."
    exit 1
}
Write-Host "Using $($py -join ' ')" -ForegroundColor Green

# 2) Virtual environment + packages
if (-not (Test-Path .venv)) { & $py[0] $py[1..($py.Length - 1)] -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install --upgrade pip --quiet
& .\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt --quiet
if ($LASTEXITCODE -ne 0) { Write-Host "pip install failed" -ForegroundColor Red; exit 1 }

# 3) .env  (falls back to SQLite when PostgreSQL is not listening on 5432)
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
$pg = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue -InformationLevel Quiet
if (-not $pg) {
    Write-Host "PostgreSQL is not running on localhost:5432 -> using SQLite (db.sqlite3) for now." -ForegroundColor Yellow
    (Get-Content .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=' | Set-Content .env
} else {
    Write-Host "PostgreSQL detected on localhost:5432." -ForegroundColor Green
}

# 4) Database tables + demo data + tests
& .\.venv\Scripts\python.exe manage.py migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "migrate failed. If you use PostgreSQL: check DATABASE_URL in .env and that database auth_db exists." -ForegroundColor Red
    exit 1
}
& .\.venv\Scripts\python.exe manage.py seed
& .\.venv\Scripts\python.exe manage.py test
Write-Host "`nDone. Start the service with:  .\run.ps1" -ForegroundColor Green
