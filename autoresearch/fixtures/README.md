# autoresearch/fixtures

Deterministic sample data for the RNT Launcher audit harness. **No network access,
no wall-clock dependency, no real game data.** Everything in here can be checked
into git and byte-identical across machines and runs.

These fixtures are **placeholder / reference** — the live audit harness
(`autoresearch.sh` + `autoresearch/score.py`) reads the real
`ref_inventory.json` and `rnt_inventory.json` produced by the inventory stage
and does **not** consume these files at scoring time.

## Contents

| File | Bytes | Purpose |
|---|---|---|
| `sample_wad_header.bin` | 12 | Deterministic fake WAD header (`IWAD` + 0 lumps + dirOffset=12). Suitable for unit-testing the parser benchmark (`internal/filesystem/wad.go`) without shipping any real IWAD bytes. |
| `sample_taxonomy_snapshot.json` | ~1.9 KB | Frozen snapshot showing the expected harness output shape — one line per metric, in `METRIC <name> <value>` form. Lets devs diff against live output without re-running the whole pipeline. |
| `README.md` | this file | You're reading it. |

## Why fixtures exist

The harness must remain reproducible. If a future contributor adds a parser
benchmark or a fuzz-style check, they need a tiny, well-defined input. The two
files above are the smallest such inputs that still exercise a non-trivial code
path:

- The 12-byte WAD header is the minimum valid Doom `IWAD` (magic + count +
  dirOffset pointing just past itself, with zero directory entries).
- The taxonomy snapshot is JSON-only, ~30 lines, and asserts the shape of the
  `METRIC` line format.

## Determinism contract

Every file here:

1. Has a fixed byte length (12 bytes for the binary, ~1.9 KB for the JSON).
2. Contains no timestamps, no UUIDs, no hashes of external data.
3. Is hand-rolled or generated from a fixed seed — re-running the generator
   produces byte-identical output (verified in `../DETERMINISM.md`).

## Re-generating

The fixtures are checked in and should rarely need regeneration. If you do
need to (e.g. to bump a schema version), regenerate with:

```bash
# sample_wad_header.bin
python3 -c "import struct,sys; sys.stdout.buffer.write(b'IWAD' + struct.pack('<II', 0, 12))" \
  > autoresearch/fixtures/sample_wad_header.bin

# sample_taxonomy_snapshot.json is hand-edited; keep it < 2 KB.
```

## What this directory is NOT

- Not a corpus of real game data — no `doom2.wad`, no `pk3` archives.
- Not consumed by the live scorer at audit time.
- Not fuzz seed material — see a real corpus for that.