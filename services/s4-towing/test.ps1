# S4 Towing self-contained tests (no other service needs to run).
Set-Location $PSScriptRoot
& .\.venv\Scripts\python.exe manage.py test -v 2
