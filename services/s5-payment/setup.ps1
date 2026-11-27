# One-time setup for S5 Payment: venv + packages + .env + database + seed.
# Run:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Run($exe, $arguments) {
    & $exe @arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $exe $arguments" }
}

if (-not (Test-Path ".venv\Scripts\python.exe")) { Run "py" @("-3.12", "-m", "venv", ".venv") }
$py = ".\.venv\Scripts\python.exe"
Run $py @("-m", "pip", "install", "-r", "requirements.txt")
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env"; Write-Host ".env created" }
Run $py @("manage.py", "makemigrations", "payments")
Run $py @("manage.py", "migrate")
Run $py @("manage.py", "seed")
Write-Host ""
Write-Host "S5 is ready. Next:  powershell -ExecutionPolicy Bypass -File .\run.ps1" -ForegroundColor Green
