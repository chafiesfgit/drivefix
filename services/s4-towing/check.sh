#!/usr/bin/env bash
# Contract check on Linux/macOS. S1 must be running (the checker logs in there for tokens;
# S4 itself never calls S1). Usage: ./check.sh [--write]
# --write runs the "Done when" scenario, then re-seeds the demo data.
set -euo pipefail
cd "$(dirname "$0")"

root="$(cd ../.. && pwd)"
checker="$root/tools/contract-check"
if [ ! -d "$checker/node_modules" ]; then
  (cd "$checker" && npm install)
fi

args=(--service s4 --url "${S4_URL:-http://localhost:4004/api/v1}" \
      --s1 "${S1_URL:-http://localhost:4001/api/v1}")
write=0
for arg in "$@"; do
  case "$arg" in
    --write) write=1; args+=(--write) ;;
    *) echo "Unknown argument: $arg (only --write is supported)" >&2; exit 2 ;;
  esac
done

if (cd "$checker" && node bin/contract-check.mjs "${args[@]}"); then
  code=0
else
  code=$?
fi

if [ "$write" -eq 1 ]; then
  .venv/bin/python manage.py seed --reset
fi
exit "$code"
