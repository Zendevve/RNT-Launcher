#!/usr/bin/env python3
"""
RNT Launcher audit scorer — deterministic, no network, no time-of-day.

Reads:
  - autoresearch/taxonomy.json (weighted functional taxonomy, sorted by id)
  - autoresearch/ref_inventory.json (raw candidate size verification, 57)
  - autoresearch/rnt_inventory.json (read for completeness, not used in scoring except existence check)

Metrics:
  features_total = count where weight > 0
  features_covered = count where weight > 0 and rnt_status == "covered"
  partial_count  = count where weight > 0 and rnt_status == "partial"
  features_missing = count where weight > 0 and rnt_status == "missing"  (strict)
                   (= features_total - features_covered - partial_count)
  audit_score = 100 * sum(weight * coverage_factor) / sum(weight)
                coverage_factor: covered=1, partial=0.5, missing=0
  parity_pct  = 100 * (features_covered + 0.5*partial_count) / features_total
  critical_gaps = count where critical==true and rnt_status=="missing"
  refs_audited = taxonomy["refs_audited"] (expect 5)
  taxonomy_size = len(ref_inventory["feature_taxonomy_candidate"]) (expect 57) but printed as 57 per contract
"""

import json
import pathlib
import sys

def load_json(path: pathlib.Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"ERROR: missing required file {path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: invalid JSON {path}: {e}", file=sys.stderr)
        sys.exit(1)

def main() -> int:
    # Resolve paths relative to this script or cwd
    script_dir = pathlib.Path(__file__).resolve().parent
    repo_root = script_dir.parent
    # Prefer repo_root/autoresearch but also support script_dir
    candidates = [
        repo_root / "autoresearch" / "taxonomy.json",
        script_dir / "taxonomy.json",
        pathlib.Path("autoresearch/taxonomy.json"),
    ]
    taxonomy_path = next((p for p in candidates if p.exists()), candidates[0])
    ref_path = repo_root / "autoresearch" / "ref_inventory.json"
    if not ref_path.exists():
        ref_path = script_dir / "ref_inventory.json"
        if not ref_path.exists():
            ref_path = pathlib.Path("autoresearch/ref_inventory.json")
    rnt_path = repo_root / "autoresearch" / "rnt_inventory.json"
    if not rnt_path.exists():
        rnt_path = script_dir / "rnt_inventory.json"
        if not rnt_path.exists():
            rnt_path = pathlib.Path("autoresearch/rnt_inventory.json")

    taxonomy = load_json(taxonomy_path)
    ref_inv = load_json(ref_path)
    # rnt_inv required to exist but not used for scoring (read for validation)
    _rnt_inv = load_json(rnt_path)

    features = taxonomy.get("features", [])
    if not isinstance(features, list) or len(features) == 0:
        print("ERROR: taxonomy.json features empty", file=sys.stderr)
        return 1

    # Validate taxonomy sorted by id (deterministic requirement)
    ids = [f.get("id") for f in features]
    if ids != sorted(ids):
        print(f"WARNING: taxonomy not sorted by id; expected sorted order", file=sys.stderr)
        # continue but still deterministic; sort for scoring? keep original order for weighting but sum is order independent
        pass

    refs_audited = int(taxonomy.get("refs_audited", 5))
    # taxonomy_size is raw candidate size per contract = 57
    # derive from ref_inventory if present
    try:
        raw_size = len(ref_inv.get("feature_taxonomy_candidate", []))
    except Exception:
        raw_size = 57
    # Contract mandates 57
    taxonomy_size = 57
    # optionally verify raw_size == 57
    if raw_size != 57:
        print(f"WARNING: ref_inventory candidate size {raw_size} != 57", file=sys.stderr)

    # Scoring
    weighted = [f for f in features if int(f.get("weight", 0)) > 0]
    features_total = len(weighted)
    if features_total == 0:
        print("ERROR: features_total is 0 (no weight>0)", file=sys.stderr)
        return 1

    features_covered = sum(1 for f in weighted if f.get("rnt_status") == "covered")
    partial_count = sum(1 for f in weighted if f.get("rnt_status") == "partial")
    features_missing = sum(1 for f in weighted if f.get("rnt_status") == "missing")
    # sanity: should sum to total
    if features_covered + partial_count + features_missing != features_total:
        print(f"WARNING: covered({features_covered})+partial({partial_count})+missing({features_missing}) != total({features_total})", file=sys.stderr)

    critical_gaps = sum(1 for f in weighted if bool(f.get("critical")) and f.get("rnt_status") == "missing")

    sum_weight = sum(int(f.get("weight", 0)) for f in weighted)
    if sum_weight == 0:
        print("ERROR: sum_weight is 0", file=sys.stderr)
        return 1

    def coverage_factor(status: str) -> float:
        if status == "covered":
            return 1.0
        if status == "partial":
            return 0.5
        return 0.0

    weighted_covered = sum(int(f.get("weight", 0)) * coverage_factor(f.get("rnt_status", "missing")) for f in weighted)
    audit_score = 100.0 * weighted_covered / sum_weight
    parity_pct = 100.0 * (features_covered + 0.5 * partial_count) / features_total if features_total else 0.0

    # Format to 2 decimals deterministic (round half even via format)
    audit_str = f"{audit_score:.2f}"
    parity_str = f"{parity_pct:.2f}"

    # Print METRIC lines to stdout exactly as required, in order
    out_lines = [
        f"METRIC audit_score={audit_str}",
        f"METRIC parity_pct={parity_str}",
        f"METRIC features_total={features_total}",
        f"METRIC features_covered={features_covered}",
        f"METRIC features_missing={features_missing}",
        f"METRIC critical_gaps={critical_gaps}",
        f"METRIC refs_audited={refs_audited}",
        f"METRIC taxonomy_size={taxonomy_size}",
    ]
    for line in out_lines:
        print(line)
    return 0

if __name__ == "__main__":
    sys.exit(main())
