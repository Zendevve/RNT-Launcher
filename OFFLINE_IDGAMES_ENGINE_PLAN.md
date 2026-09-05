# Implementation Plan: Offline-First /idgames Engine & Curated Showcase

## Context
RNT Launcher currently queries Doomworld's legacy `api.php` on every keystroke, which is slow (2–4s), lacks full-text and fuzzy search, and frequently fails when blocked by Cloudflare anti-bot shields (HTTP 403).
This plan transitions RNT Launcher to an offline-first `/idgames` engine with an embedded compressed catalog seed (~1.8 MB), SQLite FTS5 search, curated Cacowards/Top 100 metadata, smart mod ingestion via binary lump inspection, and resilient sequential CDN mirror downloads.

---

## Approach

### 1. Embedded Catalog Seed & Curated Metadata
- **Curated Dataset (`internal/idgames/curated.json`)**:
  - Map ~200 canonical idgames IDs to award metadata: `is_cacoward` (bool), `cacoward_year` (int), `is_top100` (bool), `category` (string: "Megawad", "Episode", "Gameplay", "Total Conversion", "Deathmatch"), and `curator_note` (string).
- **Archive Catalog Seed (`internal/idgames/seed/catalog.json.gz`)**:
  - Embedded via Go 1.16+ `//go:embed catalog.json.gz`.
  - Schema per entry: `id` (int), `title` (string), `dir` (string), `filename` (string), `size` (int64), `age` (int64), `date` (string), `author` (string), `description` (string), `rating` (float64), `votes` (int).
- **Seed Generator Tooling (`cmd/build-catalog/main.go`)**:
  - Standalone build-time utility to fetch or compile the complete `/idgames` archive dump (`ls-lR.gz` / JSON mirror), compress it to gzip, and write `internal/idgames/seed/catalog.json.gz`.
  - Also seeds fallback test fixtures for deterministic testing.

### 2. Database Schema & FTS5 Migration
- **Target File**: `internal/database/schema.go`
  - Add tables to `SchemaSQL`:
    - `idgames_catalog`: `id INTEGER PRIMARY KEY`, `title TEXT NOT NULL`, `dir TEXT NOT NULL`, `filename TEXT NOT NULL`, `size INTEGER NOT NULL`, `age INTEGER NOT NULL`, `date TEXT NOT NULL`, `author TEXT NOT NULL`, `description TEXT NOT NULL`, `rating REAL NOT NULL`, `votes INTEGER NOT NULL`, `is_cacoward INTEGER NOT NULL DEFAULT 0`, `cacoward_year INTEGER NOT NULL DEFAULT 0`, `is_top100 INTEGER NOT NULL DEFAULT 0`, `category TEXT NOT NULL DEFAULT ''`, `created_at DATETIME NOT NULL`.
    - `idgames_fts`: `CREATE VIRTUAL TABLE IF NOT EXISTS idgames_fts USING fts5(title, author, filename, description, content='idgames_catalog', content_rowid='id');`
    - Triggers `idgames_ai`, `idgames_ad`, `idgames_au` to keep FTS index synchronized with `idgames_catalog`.
    - Indices: `idx_idgames_rating_votes ON idgames_catalog(rating DESC, votes DESC)`, `idx_idgames_cacoward ON idgames_catalog(is_cacoward, cacoward_year DESC)`, `idx_idgames_date ON idgames_catalog(date DESC)`.

### 3. Repository & Search Engine
- **Target File**: `internal/idgames/repository.go` (new)
  - `type CatalogRepository struct { db *sql.DB }`
  - `SeedIfEmpty(ctx context.Context, seedReader io.Reader) error`: Checks `SELECT COUNT(*) FROM idgames_catalog`. If 0, parses JSON stream and executes batched inserts (`BEGIN TRANSACTION; ... COMMIT;`) in chunks of 500 rows, merging curated Cacowards metadata on match.
  - `Search(ctx context.Context, opts SearchOptions) ([]CatalogItem, error)`:
    - SearchOptions: `Query string`, `CacowardOnly bool`, `Top100Only bool`, `Category string`, `Sort string`, `Limit int`, `Offset int`.
    - If `Query` is empty: query directly from `idgames_catalog` ordered by `rating DESC, votes DESC` or `date DESC`.
    - If `Query` is provided: join `idgames_fts` with `idgames_catalog` using BM25 relevance score combined with community multiplier:
      `score = (bm25(idgames_fts) * -1.0) * (1.0 + (log10(max(votes, 1)) * (rating / 5.0))) * CASE WHEN is_cacoward = 1 THEN 2.5 WHEN is_top100 = 1 THEN 1.8 ELSE 1.0 END`.
    - Cross-reference with `mods` table via `LEFT JOIN mods ON LOWER(mods.name) = LOWER(idgames_catalog.filename) OR LOWER(mods.path) LIKE '%' || LOWER(idgames_catalog.filename)` to populate `is_installed: bool` and `installed_mod_id: string`.

### 4. Resilient Downloader & Smart Lump Ingestion
- **Target File**: `internal/idgames/downloader.go` (enhancement of `client.go`)
  - Sequential CDN mirror failover across `youfailit.net`, `gamers.org`, `api.slade.mancubus.net`, `mancubus.net`.
  - Timeout per mirror: 5s connection / initial response timeout; automatic fallback to next mirror on HTTP != 200 or timeout.
  - Streaming download with progress callback: emits `(bytesRead, totalBytes, percent, mirrorURL)`.
  - Extraction destination: `<mods_dir>/idgames/<filename_without_ext>/`.
  - Primary file detection: locate `.wad`, `.pk3`, `.pk7`, `.ipk3` with largest size or matching main entry.
  - Pass primary file into `filesystem.Inspector.InspectFile()` to extract map markers (`MAP01`, `E1M1`), script markers (`DECORATE`, `ZSCRIPT`), and suggested IWAD (`doom2.wad`, `doom.wad`).
  - Auto-import into `mods` repository so the mod is immediately visible in Library and Profiles.

### 5. Backend RPC & Wails Events
- **Target File**: `app.go`
  - Initialize `idgamesRepo` in `startup()`, trigger non-blocking seed in background goroutine.
  - Expose RPC methods:
    - `SearchIdgamesCatalog(opts SearchOptions) ([]CatalogItem, error)`
    - `GetIdgamesCuratedShowcase() (ShowcaseResult, error)`: Returns Top Cacowards, Hall of Fame, and Trending/Recent sets for zero-state UI.
    - `SyncIdgamesHighWatermark() (int, error)`: Checks `SELECT MAX(id) FROM idgames_catalog`, queries remote API for `id > max_id`, inserts diff.
    - `DownloadIdgamesArchive(id int) (*domain.Mod, error)`: Emits `idgames:download:progress` event through Wails event bus `a.emitter`.

### 6. Frontend Redesign: Mod Store & Showcase
- **Target Files**:
  - `frontend/src/types/index.ts`: Update/extend `IdgamesFile` with `is_cacoward`, `cacoward_year`, `is_top100`, `category`, `is_installed`, `installed_mod_id`.
  - `frontend/src/features/library/IdgamesSearchModal.tsx`:
    - Rename/expand or adapt into dedicated, rich catalog viewer.
    - **Zero-State**: Curated shelves ("Cacoward Classics", "Top 100", "Top Rated", "Recent Uploads") with category pills (*Megawads*, *Gameplay*, *Deathmatch*).
    - **Search-State**: Instant as-you-type search with debounced 100ms local RPC query (no loading spinner delay).
    - **Installed Card State**: Green checkmark badge with "Installed" label and "Select in Profile" shortcut.
    - **Progress Bar**: Non-blocking download progress tray displaying percentage, mirror name, and extraction status.

---

## Critical Files & Anchors
- `internal/database/schema.go`: Database migration declaring `idgames_catalog`, `idgames_fts`, and sync triggers.
- `internal/idgames/repository.go`: Core FTS5 multi-signal search logic, local mod library cross-join, and seed loader.
- `internal/idgames/client.go`: Download mirror failover logic and progress streaming.
- `app.go`: Controller methods connecting `idgamesRepo` and `downloader` to Wails runtime and frontend bindings.
- `frontend/src/features/library/IdgamesSearchModal.tsx`: Frontend modal transformed into high-density curated mod store.

---

## Verification Plan
1. **Catalog Seed & FTS5 Unit Tests**:
   - `go test -v ./internal/idgames -run TestCatalogSeedAndFTS5`: Verifies decompression, database population, FTS5 tokenization, and multi-signal ranking formula.
2. **Curated Showcase Query Test**:
   - `go test -v ./internal/idgames -run TestCuratedShowcase`: Verifies Cacoward filters, Top 100 tags, and category sorting.
3. **Download & Lump Ingest Integration Test**:
   - `go test -v ./internal/idgames -run TestDownloadAndLumpInspect`: Runs synthetic test archive download, extraction to isolated subfolder, lump inspection, and automatic mod registry insertion.
4. **End-to-End Acceptance Test**:
   - Run `go test -v . -run TestApp_IdgamesFlow` verifying the full RPC cycle from search to download to library state update.
5. **Frontend Production Build**:
   - `npm --prefix frontend run build` verifying TypeScript types and React bundle compilation without errors.

---

## Assumptions & Fallbacks
- **Assumption 1**: `modernc.org/sqlite` compiled without CGO supports SQLite FTS5 extension.
  - *Fallback*: If FTS5 virtual table initialization fails in any environment, fall back gracefully to indexed `LIKE` / substring queries with rating weights.
- **Assumption 2**: Initial seed size will remain under 2.5 MB compressed.
  - *Fallback*: Only include essential metadata columns in the seed blob; description text is truncated or stripped of non-printable whitespace.
