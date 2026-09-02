# RNT Launcher — Capability Inventory (Phase 1 Recon)

**Branch:** `autoresearch/audit-against-the-ref-launchers-in-refs-20260902`  
**Working dir:** `D:/COMPROG/RNT Launcher`  
**Generated:** 2026-09-02  
**Scope:** Compare RNT Launcher (Gen-4 reactive cockpit) against `references/` launchers (DoomLauncher, DoomRunner, qZDL, Arachnotron, RocketLauncher2)

---

## 1. Stack

| Layer | Technology | Version / Detail | Manifest |
|---|---|---|---|
| **Backend** | Go | `1.25.0` | `go.mod:3` `go 1.25.0`, AGENTS.md |
| **Desktop bridge** | Wails v2 | `v2.13.0` | `go.mod:7`, `wails.json`, `main.go` (App window 1280×800, BackgroundColour RGBA 12,13,14) |
| **Frontend** | React + TypeScript + Vite | React `18.3.1`, TS `5.7.3`, Vite `6.2.0`, `@vitejs/plugin-react 4.3.4` | `frontend/package.json`, `vite.config.ts`, `frontend/src/main.tsx` |
| **Styling** | Tailwind CSS | `3.4.17` dark industrial (`doom-bg #0c0d0e`, `doom-surface #141618`, `doom-red #dc2626` etc.) | `tailwind.config.js`, `frontend/src/index.css` |
| **State / Fetch** | TanStack Query | `5.67.1` (`QueryClient` staleTime 60s, refetchOnWindowFocus false) | `frontend/src/main.tsx:7`, `package.json` |
| **Database** | SQLite — `modernc.org/sqlite` | `v1.57.0` **pure Go**, `CGO_ENABLED=0`, WAL+ FKs | `go.mod:9`, `internal/database/db.go` |
| **Profile ser.** | YAML v1 | `gopkg.in/yaml.v3` | `go.mod:8`, `internal/profiles/yaml.go` |
| **IDs / Util** | `google/uuid 1.6.0`, `yaml 2.7.0`, `lucide-react 1.16`, `clsx 2.1 + tailwind-merge 3.0` | — | `frontend/package.json`, `internal/*/service.go` |
| **Icons** | Lucide React | Crisp industrial iconography | `frontend/src/features/*`, `components/ui/*` |

**Key principle:** zero CGO, cross-platform (Windows WebView2 / Linux webkit2gtk-4.0+ / macOS WebKit), local-first, single-file DB.

---

## 2. Engines Supported

Derived from `internal/domain/models.go:174-186` (`EngineFamily` const), `internal/scanner/scanner.go:634-681` (`DetectEngineFamily`) and `internal/engines/service.go:DetectFamilyFromPath`.

| Stored `family` | Display name | Detection heuristic (`DetectEngineFamily`) | Dialect (`internal/launcher/dialect.go:GetDialect`) |
|---|---|---|---|
| `gzdoom` | GZDoom | `stem contains gzdoom` | `ZDoomDialect` |
| `zandronum` | Zandronum | `zandronum` | `ZDoomDialect` |
| `dsda-doom` | dsda-doom | `dsda-doom` / `dsdadom` | `PrBoomDialect` |
| `prboom-plus` | PrBoom+ | `prboom-plus` / `prboom_plus` / `prboom+` | `PrBoomDialect` |
| `woof` | Woof! | `woof` | `WoofDialect` |
| `crispy-doom` | Crispy Doom | `crispy-doom` / `crispydoom` | `ChocolateDialect` |
| `chocolate-doom` | Chocolate Doom | `chocolate-doom` / `chocolatedoom` | `ChocolateDialect` |
| `other` | Other *or mapped friendly name* | fallback — also recognizes `lzdoom→LZDoom`, `vkdoom→VKDoom`, `eternity→Eternity Engine`, `doomsday→Doomsday Engine`, `edge→EDGE-Classic` | `GenericDialect` |

> Notes: `SupportsPK3()` returns `true` only for `gzdoom`/`zandronum` (`domain/models.go:254`). Version probing (`ProbeEngineVersion`) executes `--version`/`-version` with 1500 ms timeout and parses `versionRegex` (`(?i)(?:version\s*|v|\bg|woof!\s*|doom\s*)?(\d+\.\d+...)`).

---

## 3. Storage & Data Flow

### 3.1 SQLite (WAL, pure Go)

* **Driver:** `modernc.org/sqlite` — no C toolchain (`AGENTS.md`, `internal/database/db.go:10 _ "modernc.org/sqlite"`)
* **Init:** `database.InitDB(dbPath)` — creates `os.UserConfigDir()/rnt-launcher/rnt-launcher.db` or `rnt-launcher.db` fallback (`app.go:107-122`); `MkdirAll(dir,0755)`
* **Pool:** `SetMaxOpenConns(10)` (1 for `:memory:` so tests preserve state) — `db.go:36-40`
* **PRAGMAs on open (`db.go:43-48`):**
  ```sql
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA synchronous = NORMAL;
  ```
* **Schema** — single migration string `SchemaSQL` (`internal/database/schema.go:3`):
  ```sql
  engines(id TEXT PK, name TEXT, executable TEXT, version TEXT, family TEXT, created_at DATETIME, updated_at DATETIME)
  iwads(id TEXT PK, name TEXT, path TEXT UNIQUE, type TEXT, lump_count INT, size INT, sha256 TEXT, created_at DATETIME, updated_at DATETIME)
  mods(id TEXT PK, name TEXT, path TEXT UNIQUE, format TEXT, category TEXT, size INT, modified_at DATETIME, sha256 TEXT, lump_count INT, structures TEXT JSON '[]', is_favorite INT, created_at DATETIME, updated_at DATETIME)
  profiles(id TEXT PK, name TEXT, description TEXT, engine_id TEXT FK SET NULL, iwad_id TEXT FK SET NULL, parent_profile_id TEXT FK SET NULL, isolate_saves INT, arguments TEXT JSON '[]', working_dir TEXT, is_favorite INT, created_at DATETIME, updated_at DATETIME)
  profile_mods(id TEXT PK, profile_id TEXT FK CASCADE, mod_id TEXT FK CASCADE, enabled INT, sort_order INT)
  launch_history(id TEXT PK, profile_id TEXT, profile_name TEXT, engine_name TEXT, iwad_name TEXT, started_at DATETIME, finished_at DATETIME, duration_ms INT, exit_code INT, status TEXT, command_line TEXT)
  settings(key TEXT PK, value TEXT)
  -- indexes: idx_mods_name/path/format/category/favorite, idx_profile_mods_profile_order/mod, idx_launch_history_started/profile
  ```
* **Back-compat alters** (`db.go:63-64`): `ALTER TABLE profiles ADD COLUMN isolate_saves / parent_profile_id`
* **Repositories** (`internal/database/repositories.go`): `engineRepo`, `iwadRepo`, `modRepo` (full filter: search/category/format/isFavorite with `LIKE %query%` + `ORDER BY name` — `332-396`, `GetUsageCounts` via `GROUP BY mod_id`), `profileRepo` (`SetProfileMods` transactional reorder, `Duplicate` clones profile_mods), `historyRepo` (`GetStats` aggregates totalLaunches / playTime / mostPlayed), `settingsRepo` (KV JSON marshal helpers).

### 3.2 Filesystem / Lump Parsers

| Component | File | Responsibility |
|---|---|---|
| **WAD parser** | `internal/filesystem/wad.go` | Validates `IWAD`/`PWAD` magic, reads LE header (`numLumps`, `dirOffset`), `ReadWADDirectory` 16-byte entries, `isMapLump` (`MAP01..MAP99` / `E1M1..E9M9`), `identifyStructure` → WADInfo. |
| **Archive parser** | `internal/filesystem/archive.go` | Reads PK3/PK7/ZIP/IPK3 central directories without extraction; `Is7z` 6-byte `37 7A BC AF 27 1C`, `IsZip`; collects `ArchiveInfo.entries/maps/structures` (`ZSCRIPT, DECORATE, MAPINFO, SNDINFO, TEXTURES, GLDEFS`). |
| **Inspector** | `internal/filesystem/inspector.go` | `FileInfo` assembler (path, size, modTime, sha256, format, category via `DetermineCategory`, maps, structures, WAD/ArchiveInfo); `InspectFile/Bytes/Reader`; `ExtractArtwork` scanning `TITLEPIC/CREDIT/BOSSBACK/HELP/INTERPIC`. |
| **Palette / Picture** | `internal/filesystem/palette.go` | `DefaultDoomPalette` 256×RGB, `ExtractPLAYPAL` (768-byte), `DecodeDoomPicture` (column-post rendering), `EncodePNG`. |
| **Hasher** | `internal/filesystem/hasher.go` | `ComputeSHA256` 64 KiB streaming buffer, `ComputeSHA256Bytes`. |

All read-only; paths `cleanPath` normalized; ZipSlip-guarded extraction (`internal/idgames/client.go:364 extractZipSafely`).

### 3.3 Process Supervision

`internal/launcher/launcher.go` — `OSProcessRunner.Start(ctx, executable, args, workingDir)` → `exec.CommandContext` *without shell*; `ProcessHandle` (Pid/Kill/Wait) captures stdout/stderr via pipes. `LauncherService` holds `map[string]*ActiveLaunch {mu RWMutex, pid, profileID, startedAt}`; `LaunchProfileEntity` validates → `builder.BuildArguments` (sorted enabled mods + customArgs split via `SplitCustomArgs` quote-aware) → `runner.Start` → returns `LaunchRecord` immediately → background `monitorProcess` waits, computes `durationMs`, writes `historyRepo.Add`, emits `launch:exit` via `EventEmitter` (`a.emitSafe` wrapping `runtime.EventsEmit`). `KillLaunch(id)/KillAll()` via `handle.Kill()`; `app.Close()` kills all before `db.Close()`.

### 3.4 Data Flow Diagram (as observed `AGENTS.md + app.go:95-177`)

```
React Component (dashboard/library/profiles/engines/iwads/history/settings/diagnostics)
  → services `frontend/src/services/api.ts` / `lib/api.ts:callBackend(method, ...args)` → `window.go.main.App.<Method>`
     ↳ fallback mock `mockCall` with localStorage (dev without Wails)
  → Go `app.go: App` (ctx, dbPath, repositories, 8 services, event emitter)
     → domain service (validator / launcher / scanner / profiles / engines / iwads / history / settings / diagnostics / saves / idgames)
     → repository (database/*) → SQLite WAL file  ─┐
     → filesystem/inspector | processRunner          └→ Wails event bus `runtime.EventsEmit` → `frontend/src/lib/events.ts: EventsOn` (scan:progress/complete, launch:start/exit)
```

Startup path: `main.go:embed all:frontend/dist` → `wails.Run` 1280×800 → `app.startup` builds DB+repos+services → spawn goroutine if `settings.AutoScanOnStartup` then `StartScan()`.

---

## 4. Feature Inventory

Legend: **implemented** = full code + UI + RPC + tests | **partial** = code present but conditional/flagged/roadmap incomplete | **missing** = not in tree (intentionally out-of-scope / deferred)

| Feature | Status | Evidence (file paths inspected) | Notes |
|---|---|---|---|
| **Asset scanning (recursive discovery)** | **implemented** | `internal/scanner/scanner.go` (ScannerService 777 lines, CollectModFiles, ProcessModFile), `internal/filesystem/inspector.go`, `frontend/src/features/library/LibraryView.tsx:57-775`, `app.go:487-531` | Handles `.wad/.pk3/.pk7/.ipk3/.zip/.deh/.bex`; `ScanDirectories(modDirs, iwadDirs, engineDirs)` aggregated `ScanResult`; `ctx` cancellation; `progressFn(current,total,currentFile)` → Wails `scan:progress`; `ImportFile` single-drop path. Stress test `internal/database/stress_test.go` handles 1k mods <10 ms. |
| **WAD header & lump inspection** | **implemented** | `internal/filesystem/wad.go:30-131`, `internal/filesystem/inspector.go:124-181` | Magic validation `IsWADMagic`, LumpCount, Maps, Structures; `ReadWADDirectory` 16-byte LE entries; map regex `MAP\d{2}`, `E\dM\d`. Shown in `ModInspectorDrawer`. |
| **Archive landmark detection** | **implemented** | `internal/filesystem/archive.go:34-230` | PK3/PK7/ZIP/IPK3 detection via header ext+magic; `Entries []string`, `Maps`, `Structures` without extraction; covers `MAPINFO, ZSCRIPT, DECORATE, SNDINFO, TEXTURES, GLDEFS`. |
| **Artwork extraction (TITLEPIC via PLAYPAL)** | **implemented** | `internal/filesystem/palette.go:51-145`, `internal/filesystem/inspector.go:237-360`, `app.go:199-220` | `ExtractArtwork` finds `TITLEPIC/CREDIT/BOSSBACK/HELP/INTERPIC`, decodes via `DefaultDoomPalette` or embedded `PLAYPAL`, renders PNG → `base64 dataUri`; pure Go. |
| **SHA-256 hashing & dedup** | **implemented** | `internal/filesystem/hasher.go`, `internal/filesystem/inspector.go: FileInfo.SHA256` | `ComputeSHA256(path)` streaming 64 KiB; stored `mods.sha256 / iwads.sha256`; basis for duplicate-aware import (`processModFile` checks existing by path/hash). |
| **Engine / source-port management** | **implemented** | `internal/engines/service.go:28-342`, `internal/database/repositories.go: engineRepo`, `frontend/src/features/engines/EnginesView.tsx:0EEF`, `app.go:335-365` | CRUD, family inference, executable `ValidateExecutable` (exists+regular+exec bits), version detection `DetectVersion`, copy-path / open-folder helpers, family tabs + search. |
| **Engine version probing** | **implemented** | `internal/scanner/scanner.go:746-777`, `internal/engines/service.go:143-281` | 1500 ms `context.WithTimeout`, tries `--version/-version`, family-specific regex + generic `(?i)(?:version\s*\|v\|g)?\s*([0-9]+(?:\.[0-9]+)+...)`; never hard-fails → `"Unknown"` + `DetectFamilyFromPath`. |
| **Engine dialect translation** | **implemented** | `internal/launcher/dialect.go:10-386`, `internal/launcher/builder.go:30-67` | 5 dialects (`ZDoom, Chocolate, PrBoom, Woof, Generic`) implementing `FormatWarp/File/Deh/SaveDir/Config/CompatibilityLevel`; `GetDialect(family)` switch; builder routes `-iwad <path> + enabled mods sorted + customArgs`. |
| **IWAD management & auto-ID** | **implemented** | `internal/iwads/service.go:15-282`, `internal/scanner/scanner.go:683-744`, `frontend/src/features/iwads/IWADsView.tsx:4AF4` | 8 canonical types Doom/Doom2/TNT/Plutonia/Heretic/Hexen/Strife/Freedoom/Chex/HACX mapped per filename+lump heuristics; grid+table views, type tabs, copy hash/path, open-folder, lumpCount/size disk stats. |
| **Library views (grid + table)** | **implemented** | `frontend/src/features/library/LibraryView.tsx`, `ModCard.tsx`, `ModTableRow.tsx`, `ModInspectorDrawer.tsx` | Dual mode, category tabs All→Utility, format chips WAD/PK3/PK7/ZIP/DEH/BEX, filter chips (Has Maps/ZScript/DeHack/Unused/In-Use), sort name/size/lumps/date, usage counts via `api.getModUsageCounts`. |
| **Search & filtering** | **implemented** | `internal/database/repositories.go:332-396` (`List(filter)` LIKE), `frontend/src/features/library/LibraryView.tsx: filteredMods`, `frontend/src/App.tsx:227-258` spotlight | SQLite `LIKE '%q%'` on name/path + in-memory chip filters; global `Ctrl+K` cross-entity search (mods+profiles+engines+iwads) via `useMemo` lower-case includes. |
| **Favorites (mods & profiles)** | **implemented** | `internal/database/schema.go: is_favorite`, `internal/database/repositories.go: ToggleFavorite`, `app.go:222-224,395-397`, `frontend/src/features/dashboard/DashboardView.tsx:146-148` | Toggle int flag; dashboard favors favorites first; Library `Favorites` tab; `idx_mods_favorite`. |
| **Drag-and-drop ingestion** | **implemented** | `frontend/src/features/library/LibraryView.tsx` drop handlers, `app.go:230 importModFile`, `docs/KNOWN_ISSUES.md:2.1` | HTML5 `drop` → `ImportFile`; files referenced not copied; fallback `AddModModal` picker; documented Wayland caveat. |
| **Profile CRUD + duplicate** | **implemented** | `internal/profiles/service.go:61-243`, `internal/database/repositories.go: profileRepo`, `frontend/src/features/profiles/ProfilesView.tsx:A42A, ProfileEditor.tsx` | `Create/Update/Delete/Duplicate/ToggleFavorite`; holds `engineId/iwadId, Mods[], Arguments[], WorkingDir, IsFavorite, IsolateSaves, ParentProfileID`; transactions. |
| **Load-order manager** | **implemented** | `internal/profiles/service.go:245-452`, `internal/domain/models.go:389-495`, `frontend/src/features/profiles/LoadOrderList.tsx, LoadOrderItem.tsx` | DnD reorder, move ↑/↓, top/bottom, per-mod `enabled` checkbox; `ReorderMods(modIDsInOrder)` validates; `EnabledMods()` sorted `Order ASC`; `idx_profile_mods_profile_order`. |
| **Profile inheritance (parent)** | **implemented** | `internal/domain/models.go:405-465 GetEffectiveMods`, `internal/database/schema.go: parent_profile_id`, `docs/COMPETITOR_ANALYSIS.md:4 roadmap claims planned — actually shipped` | `GetEffectiveMods(parent)` merges parent enabled mods with local overrides by ModID/clean path; disabled override suppresses parent mod. Migration via `ALTER add parent_profile_id`. |
| **YAML v1 portability** | **implemented** | `internal/profiles/yaml.go:52-519`, `app.go:415-432`, `frontend/src/features/profiles/ImportProfileModal.tsx` | `ExportYAML` → YAML v1 (`ProfileExportFile{version:1, profile:{name, engine{name}, iwad{name}, mods[{id,name,filename,enabled,order}], arguments, workingDir}}`); `ImportYAML` resolves by id→name→filename, returns `ValidationItem[] warnings` for missing. |
| **ZDL legacy import** | **implemented** | `internal/profiles/zdl.go:46-500`, `app.go:443-444` | `ParseZDL` reads `[zdl.save]` INI (`port/iwad/numFiles/files/file0/title/enabled/extra/substitutions`); `ImportZDL` creates profile mapping skill/warp/extraArgs; great qZDL migration parity (industry .zdl standard). |
| **Pre-flight validation (5 rules)** | **implemented** | `internal/validator/validator.go:57-318`, `internal/domain/models.go:513-546`, `frontend/src/features/profiles/ValidationBanner.tsx`, `app.go:467-469` | Rules: Engine exists+exec; IWAD selected+exists; mod files (enabled=error, disabled=warning, disabled present=info); duplicate ModID; workingDir exists. `ComputeStatus()` → `READY / READY_WITH_WARNINGS / CANNOT_LAUNCH`. |
| **Launcher pipeline (arg builder)** | **implemented** | `internal/launcher/builder.go:19-139`, `internal/launcher/dialect.go`, `internal/launcher/launcher.go:127-295` | `BuildArguments(engine,iwad,mods,customArgs)` → `["-iwad", iwadPath, "-file", modPaths..., customArgs...]` via `SplitCustomArgs` quote-preserving; `FormatCommandLine` for history display; no shell interpolation; customArgs appended verbatim. |
| **Process supervision & kill** | **implemented** | `internal/launcher/launcher.go:22-402`, `frontend/src/features/history/HistoryView.tsx:73-85` event subscriptions, `app.go:475-481` | `OSProcessRunner` via `exec.Cmd`, `sync.RWMutex` map `id→ActiveLaunch`, `monitorProcess` goroutine computes `DurationMs` + `launch_history` write + `launch:exit` emit; `KillLaunch/ KillAll` called on `app.Close`. |
| **Launch telemetry & history** | **implemented** | `internal/history/service.go:38-99`, `internal/database/repositories.go: historyRepo`, `internal/domain/models.go:627-664`, `frontend/src/features/history/HistoryView.tsx:6EA4`, `frontend/src/features/dashboard/DashboardView.tsx` | `LaunchRecord` with commandLine, duration, exitCode, status success/failed; `DefaultHistoryLimit=50`; list `started_at DESC`; `GetStats()` totalLaunches/playTime/lastLaunched/mostPlayed; history view search/status filter/clear/re-launch/copy. |
| **Per-profile isolated saves** | **implemented** | `internal/saves/service.go:10-51`, `internal/launcher/launcher.go:160-162`, `app.go:454-461` | `SaveService.baseDir` default `UserConfigDir/RNTLauncher/saves`; `GetProfileSaveDir(id) = baseDir/id`; launcher injects `-savedir <dir>` via `dialect.FormatSaveDir` when `profile.IsolateSaves`; editor toggle + `OpenProfileSaveFolder` (platform explorer). |
| **Diagnostics & health** | **implemented** | `internal/diagnostics/service.go:52-594`, `internal/domain/diagnostics.go:3-66`, `frontend/src/features/diagnostics/DiagnosticsView.tsx:74A`, `app.go:638-650` | `RunDiagnostics` → `DatabaseHealth (integrity_check OK, counts)` + `Issues[] {error/warning/info, category=database/engine/iwad/library/profile, canRepair, repairAction}` + `Summary`; repair actions `prune_all_missing / repair_orphan_<id>` etc delete orphan `profile_mods`/missing file refs. |
| **Settings / preferences** | **implemented** | `internal/settings/service.go:18-241`, `internal/domain/models.go:681-705`, `frontend/src/features/settings/SettingsView.tsx:6385`, `app.go:168-176` | KV table `settings(key,value)` JSON; prefs `mod/iwad/engine Directories[], defaultWorkingDir, theme(dark), confirmLaunch, autoScanOnStartup(true), closeOnLaunch`; directory add/remove idempotent + normalized `ToLower+Clean`; startup `AutoScanOnStartup` goroutine; save via `UpdateSettings`. |
| **Structured logging** | **implemented** | `internal/logger/logger.go:14-177`, `app.go:652-659`, `frontend/src/features/diagnostics/DiagnosticsView.tsx` logs tab | `MemoryLogHandler` `sync.RWMutex` ring buffer `maxSize`, `Handle` captures `slog.Record` → `LogEntry{timestamp, level, message, fields}`, `GetEntries` clone; exposed `GetSystemLogs/ClearSystemLogs`; `logs` tab filter+clear. |
| **Native dialogs** | **implemented** | `app.go:562-632` (OpenFileDialog, OpenDirectoryDialog, OpenPathInExplorer), `frontend/src/lib/api.ts:636-647` | Wails `runtime.OpenFileDialog` with extension filters (wad/pk3/iwa...), `OpenDirectoryDialog`, `OpenPathInExplorer` `runtime.BrowserOpenURL / exec` per OS (`explorer/open/xdg-open`). |
| **/idgames archive integration** | **implemented** | `internal/idgames/client.go:20-583`, `app.go:243-298`, `frontend/src/features/library/IdgamesSearchModal.tsx`, `frontend/src/lib/api.ts:651-653` | `IdgamesClient` queries `https://www.doomworld.com/idgames/api/api.php?action=search&query=...`; parses `rawSearchResponse`; `Download` fetches mirror list (`DefaultMirrors`), safextract via `extractZipSafely` (ZipSlip: `Clean` + `HasPrefix` check), `selectPrimaryModFile` picks best `.wad/.pk3`; then `scanner.ImportFile`. Claims to address COMPETITOR_ANALYSIS Tier-1 roadmap (despite `KNOWN_ISSUES 1.1` local-first disclaimer — now hybrid). |
| **DMFlags bitfield calculators** | **implemented** | `internal/domain/dmflags.go:3-137` (Bitflag + 4 slices), `frontend/src/features/profiles/DmFlagsModal.tsx:AE90` (DMFLAGS_DATA sync, computeBitmask/parseBitmask, Tabs + search + hex, +set parsing) | 4 flag sets: `DMFlags 29` (NoHealth..NoCheckpoints), `DMFlags2 24`, `CompatFlags 30`, `CompatFlags2 9`; grouped by `Category`; integer mask via `\|=`; `FormatCompatibilityLevel`-like emit `+set dmflags <mask>`; embedded per-flag docs; modal opened from `ProfileEditor`. Parity with DoomRunner trait. |
| **Dashboard cockpit** | **implemented** | `frontend/src/features/dashboard/DashboardView.tsx:A781`, `RecentProfileCard.tsx`, `frontend/src/components/layout/ScanBanner.tsx`, `Header.tsx`, `Sidebar.tsx` | One-click launch (favorite/other slice(0,4)), counts (mods/iwads/engines/profiles/recentLaunches), scan banner `current/total/currentFile`, empty-state onboarding CTA; notifications via `useToast`. |
| **Keyboard shortcuts & spotlight** | **implemented** | `frontend/src/App.tsx:196-258`, `frontend/src/components/layout/Header.tsx` | Global `keydown`: `Ctrl/Cmd+K` → spotlight modal search across all entities (`filteredSearch useMemo`), `Ctrl+Enter` launch favorite/active, `Ctrl+S` save, `Ctrl+Shift+S` export YAML, `Esc` close; load-order ↑/↓ keyboard nav. |
| **UI shell & onboarding** | **implemented** | `frontend/src/App.tsx:C5E3` (activeView switch), `frontend/src/components/layout/Sidebar.tsx`, `Header.tsx`, `OnboardingWizard.tsx`, `frontend/tailwind.config.js:4BC2` | Collapsible sidebar `NavViewId=dashboard/library/profiles/engines/iwads/history/settings/diagnostics`; `Header` breadcrumbs; `OnboardingWizard` 3 steps on zero-config; dark industrial theme (`doom-bg #0c0d0e` etc), high-density utility, custom `components/ui/*` (Button/Modal/Input/Badge/Toast/ContextMenu/ProgressBar/Tabs). |
| **Wails bridge & typed bindings** | **implemented** | `app.go:32-659` (App struct + 40+ exported methods), `frontend/src/lib/api.ts:CAEC` (callBackend + mock fallback), `frontend/wailsjs/go/models.ts:72A6`, `frontend/src/types/domain.ts:914C` | Constructor DI `NewEngineService(profileRepo, modRepo...)`; typed DTOs mirroring Go JSON tags camelCase; `GetAppBridge()` detects `window.go.main.App`; dev `mockCall` using `localStorage` prefix `rnt_mock_`; runtime events via `frontend/src/lib/events.ts` (`onScanStart/Progress/Complete`, `onLaunchStart/Exit`). |

---

## 5. Storage Summary (reiteration for JSON `storage`)

See §3 above. **Persistent file:** `os.UserConfigDir() + /rnt-launcher/rnt-launcher.db` (fallback `rnt-launcher.db`). `database.InitDB` applies `SchemaSQL` with FK+WAL pragmatics, pool 10, `busy_timeout 5000`, `synchronous NORMAL`. Normalized tables with FK SET NULL / CASCADE, JSON-encoded `structures`/`arguments`, indexed paths/names. `repositories_test.go` and `stress_test.go` prove sub-10 ms indexing for 100+ items and 1k-mods search <3 ms. `app_e2e_test.go` 20-step E2E `TestEndToEndUserWorkflow` covers scan→add→validate→launch→history. Frontend sync via `lib/api.ts:callBackend('ListMods', filter...)` → Wails binding `wailsjs/go/main/App.js` auto-gen; mock shim provides offline browser preview.

---

## 6. Known Gaps & Non-Blocking Limitations

Sourced from `docs/KNOWN_ISSUES.md` (v0.1 MVP), `docs/COMPETITOR_ANALYSIS.md` Tier 1-3 Roadmap, `docs/PRD.md` §11 Out-of-Scope / §105 Future Roadmap, and code inspection.

| # | Gap | Status / Docs | Workaround / Comment |
|---|---|---|---|
| 1 | **No continuous filesystem watcher** (inotify / ReadDirectoryChangesW) | Deferred by design — *KNOWN_ISSUES 1.3*, `PRD 15 Scanning` | Manual **Scan Folders** button or `Settings.autoScanOnStartup`; avoids laptop battery/CPU wake; `app.go:168 go func AutoScanOnStartup` not a watcher. |
| 2 | **Single primary category per mod** (no multi-tag / custom tags) | Deferred to v0.2.0 — *KNOWN_ISSUES 1.2*, `PRD 105 Organization` | Search supports substring across title/filename/format; heuristic `DetermineCategory` one value. |
| 3 | **Linux/Wayland drag-and-drop intermittently blocked** | Platform limitation — *KNOWN_ISSUES 2.1* | Use Library toolbar **Add Mod / Add Folder** picker; not a regression (compositor policy). |
| 4 | **macOS quarantine xattr blocks unsigned engines** | Platform limitation — *KNOWN_ISSUES 2.2* | Validator surfaces permission warning with troubleshooting guide; requires user `xattr -d com.apple.quarantine`. |
| 5 | **Legacy ports PK3 incompatibility advisory only** | By design — *KNOWN_ISSUES 3.1* | `Engine.SupportsPK3()` only true for gzdoom/zandronum; validator emits warning not silent crash (`ERR_ENGINE_INCOMPATIBLE_FORMAT`). |
| 6 | **No Steam / GOG auto-discovery** (`libraryfolders.vdf`, `appmanifest*.acf`) | Missing — DoomLauncher parity gap — *COMPETITOR_ANALYSIS 2.1.4*, Tier-1 roadmap not yet implemented | Manual `RegisterIWADFile` / scan IWAD directories; no VDF parser in `internal/scanner`. |
| 7 | **No demo/statdump parsing** (`-statdump` PrBoom+ / `-levelstat` Chocolate / `.zds` header) | Missing — DoomLauncher strength 2.1.3 | History stores generic duration/exitCode only; per-level kill/secret/item stats not intercepted (see `launcher/monitorProcess` no lmp parse). |
| 8 | **Savegame management only as isolated dirs, not DB-swapped assets** | Partial — `saves.SaveService` (dir-only) vs DoomLauncher SQLite per-save metadata + screenshots — *COMPETITOR_ANALYSIS Tier 1* | `-savedir` injected; browsing/migrating saves still manual Explorer; no per-save screenshots/time. |
| 9 | **No cloud sync, multiplayer browser, master-server listing** | Out-of-scope by design — *KNOWN_ISSUES 1.1*, `PRD 6.2 Local-First`, `11 Explicitly Out-of-Scope` | Entirely offline, no accounts/servers; netplay configured only via custom args (`-host`, `-dup`, `-extratic`). |
| 10 | **/idgames only; no ModDB/scraper/online marketplace** | By design (now hybrid) — *KNOWN_ISSUES 1.1* claims no auto-download but `internal/idgames/client.go` + `IdgamesSearchModal` shipped (Tier-1 implemented) | Remaining limitation: no persistent thumbnails, READMEs inline, ratings, dependency resolution beyond archive. |
| 11 | **No DOSBox automated scripting** (authentic `DOOM.EXE` mount traps) | Missing — RocketLauncher differentiator — *COMPETITOR_ANALYSIS 2.5.1* | RNT only launches native source ports; legacy DOS exes unsupported by design. |
| 12 | **No profile templates gallery** | Deferred — `PRD 78 Profile Templates`, `PRD 105 Future` | Only `Duplicate`, empty create, YAML/ZDL import; no curated starter presets. |
| 13 | **Cross-machine path portability via heuristic only** | Partial — `internal/profiles/yaml.go: ImportYAML` resolves by `id → name → lowercased filename` | Absolute paths not rewritten via portable tokens; moving mods across OS requires same filenames; mirrors Tier 1 portable YAML but not DoomLauncher ZIP export. |
| 14 | **In-memory ring buffer logs only (no file rotation)** | By design — `internal/logger/logger.go: MemoryLogHandler` | Logs visible in Diagnostics `logs` tab but lost after restart; `InitLogger(io.Writer)` discards outside tests. |
| 15 | **Eternity/Doomsday/EDGE/KEX dialects alias Generic** | Partial — `internal/launcher/dialect.go:GetDialect` default `GenericDialect` vs DoomRunner deep `EngineTraits` per-family flag trees — *COMPETITOR_ANALYSIS Tier 2* | `-savedir/-file/-warp` generic produces working launch but not nuanced per-engine optimal flags (`-merge`, `+map` vs `+set`). |

> **Docs assert 100% PRD MVP compliance** (`docs/PRD_AUDIT.md: Overall 133/133 sections PASS`, `docs/RELEASE_READINESS.md: READY FOR PRODUCTION`) — gaps above are *explicitly deferred non-blocking* scope boundaries, not audit failures.

---

## 7. Evidence — Files Inspected (chronological read order)

Top-level: `AGENTS.md`, `README.md`, `go.mod`, `main.go`, `wails.json`, `app.go`, `app_e2e_test.go` (e2e 20-step)  
`internal/` subtrees: `domain/models.go, diagnostics.go, dmflags.go`; `filesystem/wad.go, archive.go, inspector.go, hasher.go, palette.go`; `scanner/scanner.go`; `validator/validator.go`; `launcher/launcher.go, builder.go, dialect.go`; `profiles/service.go, yaml.go, zdl.go`; `engines/service.go`; `iwads/service.go`; `database/db.go, schema.go, repositories.go`; `history/service.go`; `settings/service.go`; `diagnostics/service.go`; `saves/service.go`; `idgames/client.go`; `logger/logger.go`  
`frontend/src/`: `App.tsx`, `main.tsx`, `version.ts`, `vite.config.ts`, `tailwind.config.js`, `types/domain.ts`, `lib/api.ts, events.ts, utils.ts`, `services/api.ts`, `wailsjs/go/models.ts`, `features/dashboard/DashboardView.tsx + RecentProfileCard.tsx`, `features/library/LibraryView.tsx + ModCard/TableRow/ModInspectorDrawer/AddModModal/IdgamesSearchModal`, `features/profiles/ProfilesView + ProfileEditor + LoadOrderList/Item + DmFlagsModal + ImportProfileModal + SelectModsModal + ValidationBanner`, `features/engines/EnginesView + EngineModal`, `features/iwads/IWADsView + IWADModal`, `features/history/HistoryView`, `features/settings/SettingsView`, `features/diagnostics/DiagnosticsView`, `components/layout/Sidebar + Header + ScanBanner + OnboardingWizard`, `components/ui/Button + Modal + Input + Badge + Toast + ContextMenu + Tabs + ProgressBar`  
`docs/`: `COMPETITOR_ANALYSIS.md` (feature matrix), `PRD.md` (2710-line spec), `PRD_AUDIT.md` (133/133 PASS), `KNOWN_ISSUES.md` (scope boundaries), `RELEASE_READINESS.md` (scorecard)

---

## 8. Reproducibility

```bash
go test ./...           # vet, race, coverage — AGENTS.md commands
go vet ./...
npm --prefix frontend run build   # tsc -b && vite build  — must succeed with 0 errors (RELEASE_READINESS)
```

DB inspection: open WAL file `~/.config/rnt-launcher/rnt-launcher.db` (Windows `%AppData%\rnt-launcher\rnt-launcher.db`) with `sqlite3` and `PRAGMA integrity_check;`.

---

## 9. Caveats

* Some frontend evidence cites wildcard expansion (`frontend/src/features/*`) — exact files listed in glob above.
* Pure-Go SQLite WAL file is a single portable `.db` plus `-wal`/`-shm` sidecars while running; closed state is one file.
* `idgames` integration is now *implemented* but still described as “planned” in `COMPETITOR_ANALYSIS.md` Tier 1 — audit reflects code reality (`internal/idgames` exists) over stale roadmap text.

---

*End inventory — deterministic, local filesystem only, no `init_experiment` invoked.*
