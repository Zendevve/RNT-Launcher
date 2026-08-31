# RNT Launcher (Doom Mod Manager)

[![Go Version](https://img.shields.io/badge/Go-1.23%2B-00ADD8?style=flat&logo=go)](https://golang.org)
[![Wails Framework](https://img.shields.io/badge/Wails-v2-DF1E54?style=flat&logo=wails)](https://wails.io)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat&logo=tailwindcss)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/SQLite-CGo--Free-003B57?style=flat&logo=sqlite)](https://sqlite.org)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/zendevve)
[![Discord](https://img.shields.io/badge/Discord-Artano-5865F2?style=flat&logo=discord&logoColor=white)](https://discord.gg/Y4rDyTScPe)

**RNT Launcher** is a modern, fast, local-first cross-platform desktop application for organizing, configuring, validating, and launching Doom games and modifications.

Built with an interface-agnostic Go application core, embedded SQLite metadata database, and a high-density industrial dark desktop GUI using Wails and React.

---

## Key Features

### 1-Click Launch Cockpit & Dashboard
- Launch your favorite and recent profiles instantly with one click.
- Live system status overview displaying active source ports, base IWADs, and mod counts.
- Recent launch feed showing duration, completion status, and timestamps.
- Quick scan trigger with a live progressive scan banner.

### Mod Library & Drag-and-Drop
- Recursive background directory scanner for `.wad`, `.pk3`, `.pk7`, `.ipk3`, `.zip`, `.deh`, and `.bex` files.
- Instant search across mod names, filenames, and absolute paths (<100ms response time).
- Categorization and filtering by format (`.wad`, `.pk3`, `.zip`, etc.) and mod type (*Gameplay*, *Maps*, *Megawads*, *Weapons*, *Monsters*, *Textures*, *Audio*, *UI*, *Utility*).
- Seamless Drag-and-Drop ingestion directly into the library without moving or altering user files on disk.

### Deep Mod Inspector
- **Binary WAD Header Inspection**: Extracts lump counts, identifies map markers (`MAP01`–`MAP99`, `E1M1`–`E4M9`), and validates IWAD/PWAD magic.
- **Archive Marker Detection**: Traverses PK3/ZIP archives to detect structural landmarks (`ZSCRIPT`, `DECORATE`, `MAPINFO`, `SNDINFO`, `TEXTURES`, `GLDEFS`).
- **Streaming SHA-256 Hasher**: Computes cryptographic checksums in the background for duplicate identification.
- One-click actions to open containing folders, view file details, toggle favorites, and add mods directly to profiles.

### Profiles & Draggable Load Ordering
- Configure independent launch configurations combining an engine executable, base IWAD, ordered mod list, custom launch arguments, and working directories.
- **Visual Load Order Manager**: Drag-and-Drop reordering, keyboard navigation (`↑`/`↓`), move to top/bottom, and individual mod enable/disable toggling.
- **Profile Management**: Clone, duplicate, edit, search, favorite, and delete profiles.

### Pre-Launch Validation Engine
Never fail at launch time. The pre-flight validator executes 5 core verification rules before process creation:
1. **Engine Rule**: Checks if the source port executable exists and is accessible.
2. **IWAD Rule**: Verifies base game IWAD presence and readability.
3. **Mod File Rule**: Validates disk presence for all enabled and disabled mods.
4. **Duplicate Rule**: Flags duplicate mods in the load order.
5. **Working Directory Rule**: Validates custom working directory paths.
- Computes aggregate launch statuses: `READY`, `READY WITH WARNINGS`, or `CANNOT LAUNCH` with an expandable breakdown.

### Multi-Engine & IWAD Managers
- **Source Port Manager**: Register multiple versions of any engine (GZDoom, Zandronum, DSDA-Doom, Woof!, Crispy Doom, Chocolate Doom, PrBoom+, etc.).
- **Automatic Version Detection**: Executes `--version` / `-version` probes with execution timeouts to identify engine versions and families.
- **IWAD Manager**: Auto-identifies base games (*Doom*, *Doom II*, *TNT*, *Plutonia*, *Heretic*, *Hexen*, *Strife*, *FreeDoom*).

### Portable Profile Specification (YAML v1)
- Export complete profile definitions into human-readable YAML specification version 1.
- Import profiles with automated dependency resolution matching local engines, IWADs, and mods by ID, name, or filename, generating warning diagnostics for missing content.

### Launch Telemetry & History
- Direct process execution with `exec.Command` using structured arguments (`-iwad`, `-file`, custom parameters) with **no shell interpolation**.
- Asynchronous process monitoring capturing exit codes, runtime duration, and timestamps.
- Aggregated gameplay statistics: total launches, total playtime, and last played sessions.

### Desktop Ergonomics & Shortcuts
- `Ctrl+K`: Global spotlight search across all profiles, mods, engines, and IWADs.
- `Ctrl+Enter`: 1-click launch of the active or favorite profile.
- `Ctrl+S`: Save active profile.
- `Ctrl+Shift+S`: Export profile to YAML.
- `Esc`: Close open modals and drawers.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Desktop GUI (React 18 + TS)                 │
│    Dashboard • Library • Profiles • Engines • IWADs • Stats │
└──────────────────────────────┬──────────────────────────────┘
                               │ Wails v2 RPC & Events
┌──────────────────────────────▼──────────────────────────────┐
│                    Application Core (Go)                    │
│   ┌───────────────┐ ┌───────────────┐ ┌──────────────────┐  │
│   │ Mod Service   │ │Engine Service │ │ Profile Service  │  │
│   ├───────────────┤ ├───────────────┤ ├──────────────────┤  │
│   │ IWAD Service  │ │Validator Svc  │ │ Launcher Service │  │
│   ├───────────────┤ ├───────────────┤ ├──────────────────┤  │
│   │ Scanner Svc   │ │History Service│ │ Settings Service │  │
│   └───────────────┘ └───────────────┘ └──────────────────┘  │
│                              │                              │
│   ┌──────────────────────────┴──────────────────────────┐   │
│   │          Filesystem Inspection & Hasher             │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │                              │
│   ┌──────────────────────────▼──────────────────────────┐   │
│   │       SQLite Persistence (modernc.org/sqlite)       │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Backend** | Go 1.23+ | Clean, interface-agnostic application core |
| **Desktop Bridge** | Wails v2 | Lightweight native OS webview bridge |
| **Database** | `modernc.org/sqlite` | Pure-Go CGo-free SQLite with WAL mode |
| **Profile Schema** | `gopkg.in/yaml.v3` | YAML Profile Specification Version 1 |
| **Frontend** | React 18 & TypeScript | Type-safe single-page desktop GUI |
| **State Management** | TanStack Query | Query caching, invalidation, and async state |
| **Styling** | Tailwind CSS | Dark Doom-industrial design system |
| **Icons** | Lucide React | Crisp modern interface iconography |

---

## Getting Started

### Prerequisites
- **Go**: 1.23 or higher
- **Node.js**: 18 or higher (Node 20+ recommended)
- **npm**: 9 or higher
- **Wails CLI**: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### Installation & Build

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Zendevve/RNT-Launcher.git
   cd RNT-Launcher
   ```

2. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

3. **Run in development mode**:
   ```bash
   wails dev
   ```

4. **Run backend tests**:
   ```bash
   go test -v ./...
   ```

5. **Build standalone production binary**:
   ```bash
   # Using Wails CLI:
   wails build

   # Or standard Go compilation:
   cd frontend && npm run build && cd ..
   go build -o rnt-launcher.exe .
   ```

---

## Community & Feedback

Join Artano on Discord to discuss RNT Launcher, report issues, and try out early test builds:

[![Join Discord](https://img.shields.io/badge/Discord-Artano-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/Y4rDyTScPe)

Invite link: [https://discord.gg/Y4rDyTScPe](https://discord.gg/Y4rDyTScPe)

---

## Support & Donations

If you find RNT Launcher helpful for organizing and launching your Doom setup, consider buying me a coffee to support continued development:

<a href="https://buymeacoffee.com/zendevve">
  <img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&slug=zendevve&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" alt="Buy Me A Coffee" />
</a>

Link: [https://buymeacoffee.com/zendevve](https://buymeacoffee.com/zendevve)

---

## License

Copyright (c) 2026 Zendevve. All rights reserved.

See the [LICENSE](LICENSE) file for the full Copyright Notice and Limited Personal Use Terms.
