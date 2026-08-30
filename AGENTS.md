# Repository Guidelines

## Project Overview
**RNT Launcher** is a cross-platform desktop game manager and launcher specifically engineered for classic Doom source ports (e.g., GZDoom, PRBoom+, DSDA-Doom, Crispy Doom, Chocolate Doom, Zandronum, Eternity, Woof), base game IWADs, and custom modifications (PWAD, PK3, PK7, DEH).

### Core Capabilities
- **Asset Scanning & Lump Inspection**: Recursive directory scanner parsing binary WAD headers, PK3/PK7 ZIP archives, map markers (e.g., `MAP01`, `E1M1`), script markers (`DECORATE`, `ZSCRIPT`), and SHA-256 hashes.
- **Profile Management & Load Ordering**: Presets pairing source engines, base IWADs, custom parameters, working directories, and prioritized mod load orders with YAML v1 import/export support.
- **Pre-flight Launch Validation**: Automated verification checking engine binary permissions, IWAD compatibility, file availability, and map/resource collisions before spawning processes.
- **Process Supervisor & Telemetry**: Non-blocking process execution with real-time stdout/stderr capture, process state tracking, and session playtime telemetry logging.
- **Diagnostics & Health**: Database integrity checks (`modernc.org/sqlite` in pure Go), orphaned record cleanup, and in-memory structured log capture.

---

## Architecture & Data Flow

RNT Launcher uses a clean layered Go backend paired with a React 18 / TypeScript frontend hosted inside a Wails v2 desktop webview.

```
+-------------------------------------------------------------------------+
|                        Frontend (React 18 + TS)                         |
|   Features (Dashboard, Library, Profiles, Engines, IWADs, History, ...)  |
|   State & Fetching: TanStack React Query  |  UI: Tailwind CSS + Lucide  |
+------------------------------------+------------------------------------+
                                     | Wails RPC Bridge & Event Bus
+------------------------------------+------------------------------------+
|                         Go Backend (Wails v2)                           |
|  app.go (App Controller) <---> main.go (Desktop Window & Asset Embed)   |
+-------------------------------------------------------------------------+
|                           Domain Services                               |
|  Profiles | Engines | IWADs | Scanner | Validator | Launcher | History  |
+-------------------+-------------------+---------------------------------+
                    |                   |
+-------------------+---+       +-------+---------------------------------+
|   Storage Layer       |       |       Filesystem & Process Layer        |
| internal/database     |       | internal/filesystem (Lump/ZIP Parsers)  |
| SQLite (WAL, pure Go) |       | internal/launcher   (os/exec Supervisor)|
+-----------------------+       +-----------------------------------------+
```

### Data Flow
1. **Frontend Request**: React components dispatch calls through service wrappers (`frontend/src/services/`) invoking auto-generated Wails RPC bindings (`frontend/wailsjs/go/main/App.js`).
2. **Backend Dispatch**: `app.go` receives calls and delegates to domain service instances initialized via constructor dependency injection.
3. **Storage & Execution**: Domain services read/write SQLite tables (`internal/database`) or interact with the filesystem and child processes (`internal/filesystem`, `internal/launcher`).
4. **Real-time Notifications**: Backend events (scan progress, log outputs, process termination) broadcast to the UI using the Wails event bus (`runtime.EventsEmit` $\rightarrow$ `runtime.EventsOn`).

---

## Key Directories

```
.
├── app.go                      # Wails application controller & RPC interface
├── main.go                     # Desktop binary entry point & embedded assets
├── internal/
│   ├── domain/                 # Core domain entities, contracts, and error definitions
│   ├── database/               # SQLite migrations, connection pool, and repository queries
│   ├── filesystem/             # Binary lump parsers (WAD/PK3/PK7), checksums, and path safety
│   ├── scanner/                # Recursive file scanner, classifier, and batch asset importer
│   ├── validator/              # Pre-flight profile validation engine and rule checks
│   ├── launcher/               # Process supervisor, CLI argument builder, and telemetry
│   ├── profiles/               # Profile management, load-order sorting, and YAML serializer
│   ├── engines/                # Source port registration, path validation, and version probing
│   ├── iwads/                  # IWAD detection, game type classification, and registry
│   ├── history/                # Launch session logging and playtime analytics
│   ├── settings/               # Application configuration and scan directory preferences
│   ├── diagnostics/            # SQLite integrity checking, orphan cleanup, and repair utilities
│   └── logger/                 # In-memory ring-buffer logging handler
└── frontend/
    ├── src/
    │   ├── features/           # Feature slices (dashboard, library, profiles, engines, etc.)
    │   ├── components/         # Reusable UI primitives (buttons, modals, layout shells, tables)
    │   ├── services/           # Frontend wrappers for Wails RPC functions
    │   ├── lib/                # Utility helpers (cn class merging, formatters)
    │   └── types/              # TypeScript interfaces matching backend domain structs
    └── wailsjs/                # Auto-generated Wails TypeScript/JavaScript bindings
```

---

## Development Commands

### Full Application
- **Run Full Dev App (Hot Reload)**: `wails dev`
- **Build Production Executable**: `wails build`
- **Build Direct Go Executable**: `npm --prefix frontend run build && go build -o rnt-launcher.exe .`

### Backend (Go)
- **Run Tests**: `go test ./...`
- **Run Tests with Coverage**: `go test -coverprofile=coverage.out ./...`
- **Run Tests for Specific Package**: `go test -v ./internal/profiles`
- **Run Benchmarks**: `go test -bench=. ./internal/...`
- **Lint & Static Analysis**: `go vet ./...`
- **Tidy Dependencies**: `go mod tidy`

### Frontend (React + Vite)
- **Install Dependencies**: `npm --prefix frontend install`
- **Run Vite Dev Server Only**: `npm --prefix frontend run dev`
- **Type Check & Build Bundle**: `npm --prefix frontend run build` (executes `tsc -b && vite build`)
- **Preview Production Bundle**: `npm --prefix frontend run preview`

---

## Code Conventions & Common Patterns

### Backend (Go)
- **Dependency Injection**: Services and repositories instantiate via explicit constructor functions (`NewService(...)`, `NewRepository(...)`) taking interfaces or concrete dependencies.
- **Error Handling**: Always wrap errors with context using `fmt.Errorf("failed to <action>: %w", err)`. Return sentinel domain errors (`domain.ErrNotFound`, `domain.ErrInvalidProfile`) where appropriate.
- **Concurrency & Thread Safety**: Shared resources (running processes, memory logs, cache maps) MUST be synchronized using `sync.RWMutex` or `sync.Mutex`.
- **Database Access**: Pure Go SQLite (`modernc.org/sqlite`) without CGO dependencies. Foreign keys and WAL mode are enforced on connection open (`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;`).
- **Naming Conventions**:
  - Exported structs, interfaces, and methods: `PascalCase`
  - Internal helper functions and variables: `camelCase`
  - Test files: `*_test.go` adjacent to source files

### Frontend (TypeScript / React)
- **State Management**: Server-backed data uses `@tanstack/react-query` (`useQuery`, `useMutation`). Local UI state uses standard React hooks (`useState`, `useMemo`).
- **Styling**: Tailwind CSS utility classes composed using the `cn(...)` helper (`clsx` + `tailwind-merge`).
- **Type Consistency**: TypeScript interfaces in `frontend/src/types/` MUST strictly match Go JSON struct tags (camelCase).
- **Component Design**: Modular feature slices located in `frontend/src/features/<feature>/` with collocated subcomponents.

---

## Important Files

| File | Purpose |
| --- | --- |
| `main.go` | Application entry point; initializes Wails window, title, dimensions, and asset embedding. |
| `app.go` | Main controller struct exposing Go methods to frontend RPC and managing startup/shutdown lifecycles. |
| `wails.json` | Wails v2 configuration defining build settings, frontend commands, and app metadata. |
| `go.mod` | Go module declaration targeting Go 1.25+ with dependencies (`modernc.org/sqlite`, `yaml.v3`, `uuid`). |
| `app_e2e_test.go` | 20-step end-to-end acceptance test covering scanning, profile creation, validation, launch, and diagnostics. |
| `frontend/src/App.tsx` | Main frontend layout, navigation sidebar, and active view switcher. |
| `frontend/src/main.tsx` | Frontend entry point configuring React Query client and mounting DOM root. |
| `frontend/vite.config.ts` | Vite configuration with `@` alias pointing to `frontend/src`. |
| `frontend/tailwind.config.js` | Custom dark industrial theme palette (`doom-bg`, `doom-surface`, `doom-red`, `doom-amber`, etc.). |

---

## Runtime & Tooling Preferences

- **Backend Runtime**: Go `1.23+` (configured with `go 1.25.0` in `go.mod`).
- **Frontend Runtime & Package Manager**: Node.js `18+` (Node 20+ recommended), `npm` (`package-lock.json` present).
- **CGO Not Required**: The project uses `modernc.org/sqlite` and compiles cleanly with `CGO_ENABLED=0`.
- **Desktop Framework**: Wails v2 CLI (`v2.13+`).
- **Platform Webview Requirements**:
  - Windows: Microsoft Edge WebView2
  - Linux: `webkit2gtk-4.0` or `webkit2gtk-4.1`
  - macOS: WebKit (built-in)

---

## Testing & QA

### Test Frameworks & Suites
- Backend tests rely entirely on the standard Go `testing` package (`testing.T`, `testing.B`).
- Integration and unit tests use isolated temporary folders via `t.TempDir()` and in-memory SQLite instances (`:memory:`).
- End-to-end acceptance tests (`app_e2e_test.go`) exercise full service coordination without opening a real OS window.

### Running Tests
```bash
# Run all unit and integration tests
go test ./...

# Run tests with race condition detection (when CGO enabled)
go test -race ./...

# Run all tests with coverage summary
go test -cover ./...
```

### Coverage & Test Expectations
- Core domain logic, database operations, validators, and launchers maintain high unit test coverage ($\ge 80\%$).
- When modifying business logic in `internal/`, include corresponding table-driven subtests (`t.Run(...)`).
- Frontend type safety and build verification is enforced during `npm --prefix frontend run build`.
