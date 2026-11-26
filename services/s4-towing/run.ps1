# Start S4 Towing on http://localhost:4004   (Ctrl+C to stop)
Set-Location $PSScriptRoot
& .\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:4004
