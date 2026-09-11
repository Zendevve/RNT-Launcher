#!/usr/bin/env bash
set -euo pipefail

# Canonical benchmark: managed library layout (engines/iwads/wads/mods)
# + offline source-port provisioning. Deterministic workload (fixed seed,
# no network, no clock-dependent fixtures); only the timings vary.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

OUTPUT="$(go run ./autoresearch/bench-organize 2>&1)"
STATUS=$?
if [[ $STATUS -ne 0 ]]; then
  echo "$OUTPUT" >&2
  exit $STATUS
fi

if ! echo "$OUTPUT" | grep -q "^METRIC "; then
  echo "ERROR: bench produced no METRIC lines" >&2
  echo "$OUTPUT" >&2
  exit 1
fi

echo "$OUTPUT" | grep "^METRIC "
exit 0
