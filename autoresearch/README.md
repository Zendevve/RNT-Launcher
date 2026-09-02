# autoresearch/ — RNT Launcher Audit Harness (Phase 1)

This directory hosts the audit harness that compares **RNT Launcher** against the
five reference Doom launchers vendored under `references/`:
**arachnotron**, **rocketlauncher2**, **doomlauncher**, **qzdl**, **doomrunner**.

The harness is fully local, fully offline, and safe to repeat any number of times
on the same checkout.

---

## Purpose

Produce a single, reproducible **audit_score** for RNT Launcher that measures how
well it covers the union of features found in the five reference launchers,
down-weighting nice-to-haves and up-weighting critical capabilities.

It also surfaces a per-feature diff so contributors can see at a glance which
capabilities are missing, which are partial, and which are RNT strengths.

---

## How to run

```bash
# Full pipeline (shell wrapper that calls the Python scorer):
bash autoresearch.sh

# Or run the scorer directly:
python3 autoresearch/score.py

# Validate harness invariants (recommended in CI):
bash autoresearch/validate.sh
```

Both `autoresearch.sh` (at the repo root) and `autoresearch/score.py` (in this
directory) are owned by the core builder. This README only describes them.

The harness emits one `METRIC <name>=<value>` line per metric to **stdout**, in
a fixed order. Exit code is `0` on success, non-zero on any invariant violation.

### Example output (real run)

```
$ bash autoresearch.sh
METRIC audit_score=74.62
METRIC parity_pct=68.87
METRIC features_total=53
METRIC features_covered=35
METRIC features_missing=15
METRIC critical_gaps=0
METRIC refs_audited=5
METRIC taxonomy_size=57
```

The exact metric names, order, and `name=value` (not `name value`) format are a
**stable contract**. Any change is a breaking change to the harness.

---

## Metrics

| Metric | Type | Range | Meaning |
|---|---|---|---|
| `audit_score` | float (2dp) | 0.00 – 100.00 | **Primary.** Weighted percentage: `100 * Σ(weight × coverage_factor) / Σ(weight)`, where `coverage_factor` is `1.0` for `covered`, `0.5` for `partial`, `0.0` for `missing`. Higher is better; `100.00` means every weighted feature is fully covered. |
| `parity_pct` | float (2dp) | 0.00 – 100.00 | Unweighted parity: `100 * (features_covered + 0.5 × partial_count) / features_total`. Tracks raw feature coverage without taxonomy weighting. |
| `features_total` | int | n ≥ 0 | Count of taxonomy entries with `weight > 0` (the denominator for the audit). |
| `features_covered` | int | 0 – features_total | Count of weighted features whose `rnt_status` is `"covered"`. |
| `features_missing` | int | 0 – features_total | Count of weighted features whose `rnt_status` is `"missing"` (strict). Equals `features_total − features_covered − partial_count`. |
| `critical_gaps` | int | n ≥ 0 | Count of features flagged `critical=true` that are still missing. **Should be zero in any release-grade audit** — a non-zero value is a release blocker. |
| `refs_audited` | int | always 5 | Number of reference launchers scored: arachnotron, rocketlauncher2, doomlauncher, qzdl, doomrunner. Read from `taxonomy.json`. |
| `taxonomy_size` | int | 57 (contract) | Raw size of the candidate feature taxonomy from `ref_inventory.json["feature_taxonomy_candidate"]`. The contract value is `57`; the scorer prints this literal and warns if the source deviates. |

### Coverage model

Each entry in `autoresearch/taxonomy.json` carries:

```json
{
  "id": "...",
  "weight": <int ≥ 0>,
  "critical": <bool>,
  "rnt_status": "covered" | "partial" | "missing"
}
```

Only entries with `weight > 0` participate in the audit. `audit_score` is the
weighted coverage; `parity_pct` is the unweighted view. The two together let
contributors see both "are we doing it" and "are we doing it *as importantly*
as the reference set says we should".

---

## File layout

```
autoresearch/
├── README.md                  ← you are here
├── DETERMINISM.md             ← proof that runs are byte-identical
├── ref_inventory.json         ← inventories of all 5 reference launchers
├── rnt_inventory.json         ← inventory of RNT Launcher's own features
├── ref_inventory.md           ← human-readable companion to ref_inventory.json
├── rnt_inventory.md           ← human-readable companion to rnt_inventory.json
├── taxonomy.json              ← canonical feature vocabulary + weights + statuses
├── score.py                   ← the Python scorer (core builder)
├── fixtures/                  ← deterministic sample data (no real game data)
│   ├── README.md
│   ├── sample_wad_header.bin           (12 bytes)
│   └── sample_taxonomy_snapshot.json   (~2.3 KB)
└── validate.sh                ← harness self-check script
```

Out of scope for this directory (owned by the core builder, do not edit from the
polish role):

- `autoresearch.sh` at repo root — entry-point shell wrapper.
- `autoresearch/score.py` — the Python scorer.
- `autoresearch/taxonomy.json` — canonical feature vocabulary.

---

## Determinism guarantees

The harness is **deterministic by construction**:

- No network access (no `fetch`, no `curl`, no HTTP clients).
- No wall-clock reads (`date`, `time.time()`, `datetime.now()` are forbidden
  in scoring paths).
- No random number generators; the only permitted seed value is the literal
  `1337` (unused in the current scorer but reserved for tie ordering).
- All inputs are local JSON files checked into git.
- Output lines are emitted in a frozen order from a literal list in `score.py`.

Full proof and verification recipe: see [`DETERMINISM.md`](./DETERMINISM.md).

---

## Adding new features or references

1. Edit `ref_inventory.json` or `rnt_inventory.json` (inventory stage; coordinate
   with the core builder).
2. If the change introduces a new feature id, add it to `taxonomy.json` with
   its `weight`, `critical` flag, and current `rnt_status`.
3. Re-run `bash autoresearch.sh` and confirm METRIC lines are stable across two
   consecutive runs (`bash autoresearch/validate.sh` automates this).
4. If you added a real-game fixture, **do not** put it in `autoresearch/fixtures/`
   — that directory is for deterministic placeholders only.

---

## When things go wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| METRIC lines differ between runs | non-determinism leaked into scorer | grep `score.py` for `time.`, `random.`, `os.urandom`, env reads |
| `parity_pct` drops without code changes | inventory updated but taxonomy statuses not | update `rnt_status` in `taxonomy.json` |
| `audit_score` NaN / 0.00 | `features_total` is zero or `sum_weight` is zero | check that taxonomy has entries with `weight > 0` |
| `critical_gaps > 0` | release-blocker: a flagged-critical feature is missing | see `taxonomy.json` for the offending id and address before release |
| harness exits non-zero | invariant violation (see stderr) | run `bash autoresearch/validate.sh` for diagnostics |