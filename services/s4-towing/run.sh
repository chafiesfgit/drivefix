#!/usr/bin/env bash
# Start S4 Towing on http://localhost:4004 (Ctrl+C to stop). Run ./setup.sh once first.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  echo "Missing .venv. Run ./setup.sh first." >&2
  exit 1
fi
exec .venv/bin/python manage.py runserver 0.0.0.0:4004
