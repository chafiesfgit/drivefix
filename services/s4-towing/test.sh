#!/usr/bin/env bash
# S4's self-contained tests: no other service needs to run.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  echo "Missing .venv. Run ./setup.sh first." >&2
  exit 1
fi
exec .venv/bin/python manage.py test -v 2
