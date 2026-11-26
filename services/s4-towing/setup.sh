#!/usr/bin/env bash
# One-time setup for S4 Towing on Linux/macOS. Run:  ./setup.sh
# Override the interpreter with:  PYTHON=python3.12 ./setup.sh
set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON:-python3}"
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "Python 3 not found ('$PY'). Install python3 (3.12 recommended) and try again." >&2
  exit 1
fi

if [ ! -d .venv ]; then
  if ! "$PY" -m venv .venv; then
    echo "Could not create .venv. On Debian/Ubuntu install: sudo apt install python3-venv" >&2
    exit 1
  fi
fi

.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt

# Shared demo secrets; empty DATABASE_URL -> Django's built-in SQLite (no external DB).
if [ ! -f .env ]; then cp .env.example .env; fi
sed -i 's/^DATABASE_URL=.*/DATABASE_URL=/' .env

.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed --reset
.venv/bin/python manage.py test
echo "Done. Start the service with: ./run.sh"
