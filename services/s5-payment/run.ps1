# Start S5 Payment on all interfaces (port from .env, default 4005).
Set-Location $PSScriptRoot
$port = "4005"
if (Test-Path ".env") {
    $line = Select-String -Path ".env" -Pattern '^PORT=(\d+)' | Select-Object -First 1
    if ($line) { $port = $line.Matches[0].Groups[1].Value }
}
& .\.venv\Scripts\python.exe manage.py runserver "0.0.0.0:$port"
