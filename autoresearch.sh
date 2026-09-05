#!/usr/bin/env bash
set -euo pipefail

# Canonical benchmark entrypoint for RNT Launcher audit harness
# Deterministic: no network, no time-of-day, fixed arithmetic.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

# Validate required inventories exist
for f in "$ROOT_DIR/autoresearch/taxonomy.json" "$ROOT_DIR/autoresearch/ref_inventory.json" "$ROOT_DIR/autoresearch/rnt_inventory.json"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: missing required file $f" >&2
    exit 1
  fi
done

# Resolve python interpreter (python3 preferred)
PYTHON=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON="python"
else
  echo "ERROR: no python interpreter found (need python3 or python)" >&2
  exit 1
fi

# Run scorer; capture both stdout and check METRIC presence
set +e
OUTPUT="$("$PYTHON" "$ROOT_DIR/autoresearch/score.py" 2>&1)"
STATUS=$?
set -e

if [[ $STATUS -ne 0 ]]; then
  echo "$OUTPUT" >&2
  echo "ERROR: scorer failed with exit $STATUS" >&2
  exit $STATUS
fi

# Verify at least one METRIC line
if ! echo "$OUTPUT" | grep -q "^METRIC "; then
  echo "ERROR: scorer output contains no METRIC lines" >&2
  echo "$OUTPUT" >&2
  exit 1
fi

# Re-print METRIC lines to stdout (and also any extra? only METRIC lines per contract)
echo "$OUTPUT" | grep "^METRIC "

exit 0
