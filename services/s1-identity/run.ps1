# Start S1 Identity on http://localhost:4001   (Ctrl+C to stop)
Set-Location $PSScriptRoot
& .\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:4001
