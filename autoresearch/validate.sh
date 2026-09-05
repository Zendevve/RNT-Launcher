#!/usr/bin/env bash
# validate.sh — autoresearch harness invariant checks.
#
# Purpose:
#   1. Verify the harness entry-point files exist and are runnable.
#   2. Run the harness twice and confirm the METRIC lines are byte-identical.
#   3. Exit non-zero on any violation; print a one-line summary on success.
#
# Usage:
#   bash autoresearch/validate.sh
#
# Notes:
#   - Designed to be cheap and offline (no network).
#   - Safe to run repeatedly; idempotent.
#   - All tmp files are written under mktemp and cleaned on exit.

set -euo pipefail

# --- locate repo root (parent of this script's directory) ----------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# --- tmpfile lifecycle ---------------------------------------------------------
TMPDIR_RUN="$(mktemp -d)"
trap 'rm -rf "${TMPDIR_RUN}"' EXIT

# --- pretty printing -----------------------------------------------------------
ok()   { printf 'OK   %s\n' "$*"; }
fail() { printf 'FAIL %s\n' "$*" >&2; exit 1; }
note() { printf 'NOTE %s\n' "$*"; }

# --- 1. harness entry-point files exist ----------------------------------------
ENTRY_SH="autoresearch.sh"
SCORER_PY="autoresearch/score.py"

[[ -f "${ENTRY_SH}" ]]    || fail "missing entry-point: ${ENTRY_SH}"
[[ -x "${ENTRY_SH}" ]]    || fail "not executable: ${ENTRY_SH} (run: chmod +x ${ENTRY_SH})"
[[ -f "${SCORER_PY}" ]]   || fail "missing scorer: ${SCORER_PY}"
ok "entry-point and scorer exist and are runnable"

# --- 2. inventory files exist (otherwise the scorer can't run meaningfully) ---
[[ -f "autoresearch/ref_inventory.json" ]] || fail "missing autoresearch/ref_inventory.json"
[[ -f "autoresearch/rnt_inventory.json" ]] || fail "missing autoresearch/rnt_inventory.json"
ok "inventory files present"

# --- 3. run the harness twice -------------------------------------------------
note "running harness (run 1 of 2)..."
if ! bash "${ENTRY_SH}" > "${TMPDIR_RUN}/run1.txt" 2> "${TMPDIR_RUN}/run1.err"; then
    fail "harness run 1 exited non-zero; stderr follows:
$(cat "${TMPDIR_RUN}/run1.err")"
fi
[[ -s "${TMPDIR_RUN}/run1.err" ]] && note "stderr(run1) had output but exit was 0; continuing"

note "running harness (run 2 of 2)..."
if ! bash "${ENTRY_SH}" > "${TMPDIR_RUN}/run2.txt" 2> "${TMPDIR_RUN}/run2.err"; then
    fail "harness run 2 exited non-zero; stderr follows:
$(cat "${TMPDIR_RUN}/run2.err")"
fi
[[ -s "${TMPDIR_RUN}/run2.err" ]] && note "stderr(run2) had output but exit was 0; continuing"
ok "harness executed cleanly twice"

# --- 4. at least one METRIC line was emitted ----------------------------------
grep -q '^METRIC ' "${TMPDIR_RUN}/run1.txt" \
  || fail "harness emitted no METRIC lines; output looks like:
$(cat "${TMPDIR_RUN}/run1.txt")"
ok "harness emitted at least one METRIC line"

# --- 5. two runs produce byte-identical METRIC lines ---------------------------
if diff -q <(grep '^METRIC ' "${TMPDIR_RUN}/run1.txt") \
           <(grep '^METRIC ' "${TMPDIR_RUN}/run2.txt") >/dev/null; then
    ok "two consecutive runs produced byte-identical METRIC output"
else
    fail "METRIC lines differ between runs; harness is non-deterministic:
--- run1 ---
$(grep '^METRIC ' "${TMPDIR_RUN}/run1.txt")
--- run2 ---
$(grep '^METRIC ' "${TMPDIR_RUN}/run2.txt")"
fi

# --- 6. primary metric (audit_score) is present in the right format ---------
if grep -q '^METRIC audit_score=[0-9]' "${TMPDIR_RUN}/run1.txt"; then
    ok "harness emitted the primary audit_score metric in METRIC <name>=<value> format"
else
    note "harness did not emit METRIC audit_score=... (acceptable if metric renamed in dev branch)"
fi


# --- summary -------------------------------------------------------------------
METRIC_COUNT="$(grep -c '^METRIC ' "${TMPDIR_RUN}/run1.txt" || true)"
printf 'PASS validate.sh — %s METRIC lines, both runs identical.\n' "$METRIC_COUNT"