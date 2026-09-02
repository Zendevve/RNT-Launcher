# Determinism Proof — RNT Launcher Audit Harness

The audit harness under `autoresearch/` (with entry points `autoresearch.sh` and
`autoresearch/score.py`) is **deterministic by construction**. Two consecutive
runs on the same checkout, with the same inputs and no side effects, produce
byte-identical output.

This document lists the invariants that guarantee that property and shows how
to verify it yourself.

---

## Invariants

The following checks all pass on a healthy harness. Each is stated as a property
the harness **must** satisfy, with the corresponding static check.

### I1. No network access

The harness never opens a socket. Specifically:

- `score.py` imports only the standard library — no `urllib`, `requests`,
  `socket`, `http.client`, `aiohttp`, etc.
- `autoresearch.sh` contains no `curl`, `wget`, `nc`, `ssh`, `rsync`, `git
  fetch`, or `git pull`.
- The fixture directory `autoresearch/fixtures/` does not contain pointers to
  remote URLs.

**Static check**

```bash
# Should print nothing.
grep -nE 'urllib|requests|http\.client|socket\.|aiohttp|wget|curl\b|nc\b|ssh\b|rsync\b' \
  autoresearch.sh autoresearch/score.py 2>/dev/null \
  || echo 'OK: no network primitives found'
```

### I2. No wall-clock reads

The harness does not read system time during scoring. Specifically:

- No `import time` followed by `time.time()` / `time.monotonic()` / `time.gmtime()`.
- No `import datetime` followed by `datetime.now()` / `datetime.utcnow()`.
- No shell `date`, `date +%s`, or `printf '%(%s)T'`.

**Static check**

```bash
# Should print nothing in scoring paths.
grep -nE 'time\.time\(\)|time\.monotonic|datetime\.now|datetime\.utcnow|^\s*date\b' \
  autoresearch.sh autoresearch/score.py 2>/dev/null \
  || echo 'OK: no wall-clock reads in scoring paths'
```

### I3. No nondeterministic randomness

- `score.py` contains no `import random` and no `os.urandom` calls.
- If any tie-breaking sort ever requires a seed, the literal `1337` is used.

**Static check**

```bash
grep -nE 'import random|os\.urandom|random\.' autoresearch/score.py 2>/dev/null \
  || echo 'OK: no randomness in scoring'
```

### I4. Reads only local JSON

`score.py` opens only:

- `autoresearch/taxonomy.json`
- `autoresearch/ref_inventory.json`
- `autoresearch/rnt_inventory.json`

All paths are repo-relative. No `/etc/`, no `/proc/`, no `/tmp/`, no `~/`.

**Static check**

```bash
grep -nE 'open\(|json\.load' autoresearch/score.py \
  | grep -vE 'autoresearch/(ref_inventory|rnt_inventory|taxonomy)\.json' \
  || echo 'OK: only the three inventory files are read'
```

### I5. Output is emitted in a frozen order

`score.py` defines the output lines as a literal Python list and iterates it
in that order. Two runs of the same scorer on the same inputs always emit
metric lines in the same order:

```
audit_score, parity_pct, features_total, features_covered,
features_missing, critical_gaps, refs_audited, taxonomy_size
```

Reordering, inserting, or removing a metric is a breaking change and must be
called out explicitly in a PR.

### I6. No environment-dependent values

The harness does not consult `$TZ`, `$LANG`, `$RANDOM`, `$HOSTNAME`, or
`/etc/timezone`. Float formatting uses Python's default `f"{x:.2f}"` (locale-
independent, always `.` decimal).

### I7. Fixed working directory

The scorer is invoked from the repo root (or resolves relative paths to it).
`autoresearch.sh` enforces this with `cd` at the top of the script.

---

## Verification recipe

Run the harness twice in a single shell session and diff the `METRIC` lines.
On a healthy harness the diff is empty.

```bash
# Capture two runs and compare only the METRIC block.
bash autoresearch.sh > /tmp/run1.txt 2>/tmp/run1.err
bash autoresearch.sh > /tmp/run2.txt 2>/tmp/run2.err

# 1. Identical METRIC lines?
diff <(grep '^METRIC ' /tmp/run1.txt) <(grep '^METRIC ' /tmp/run2.txt) \
  && echo 'OK: METRIC lines are byte-identical across runs'

# 2. At least one METRIC line was emitted?
grep -q '^METRIC audit_score=' /tmp/run1.txt \
  && echo 'OK: harness emitted the audit_score metric'

# 3. No errors on stderr?
test ! -s /tmp/run1.err && test ! -s /tmp/run2.err \
  && echo 'OK: stderr empty on both runs'

# 4. Full byte-identical stdout?
diff /tmp/run1.txt /tmp/run2.txt \
  && echo 'OK: full stdout byte-identical (incl. banners)'
```

The `autoresearch/validate.sh` script automates the checks above and is the
recommended entry point in pull-request CI.

---

## What "deterministic" does and does not guarantee

**Does guarantee:**

- Identical inputs → identical outputs.
- The audit number you see in CI today will match the number your teammate sees
  on the same commit tomorrow.
- No flaky failures caused by time of day, network jitter, or load order.

**Does not guarantee:**

- Stability of the metric names themselves. Adding a metric to the scorer
  intentionally changes the output, and that is **expected** — it should be a
  single, explicit PR.
- Identicality across operating systems. The scorer is OS-agnostic by design
  (uses only the Python stdlib's `json` / `pathlib`), but file paths and line
  endings may differ on Windows vs Unix. The `METRIC` line values are
  OS-agnostic; the surrounding banners may not be.

---

## Regression policy

Any PR that:

- introduces a new network call,
- introduces a `time.time()` / `datetime.now()` read in a scoring path,
- introduces a `random` call without the `1337` seed,
- reads a file outside `autoresearch/{ref,rnt}_inventory.json` and `autoresearch/taxonomy.json`,
- emits a metric line outside the frozen order,
- renames an existing metric or changes its format (e.g. `<name>=<value>` to
  `<name> <value>`),

…must be rejected. The `validate.sh` script will fail loudly on any of these,
and the failure message will point to the offending line.