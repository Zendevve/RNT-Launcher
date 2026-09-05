# Competitive Analysis: Doom Launchers & Mod Managers

This comparative evaluation examines **RNT Launcher** alongside the five reference implementations located in `references/`: **Doom Launcher**, **Doom Runner**, **qZDL**, **Arachnotron**, and **Rocket Launcher 2.0**.

---

## 1. Executive Summary & Market Landscape

The Doom launcher ecosystem spans four distinct architectural generations:

```
[Gen 1: Minimalist Switches]       qZDL (C++/Qt4)
           │                        - Ultra-fast, single in-memory state, .zdl INI standard
           ▼
[Gen 2: Tabbed Presets & Demos]    RocketLauncher 2 (C++/Qt) & Arachnotron (C++/QML)
           │                        - Preset listboxes, DOSBox mounting, QML inheritance
           ▼
[Gen 3: Deep Managers & Engines]   DoomRunner (C++17/Qt) & DoomLauncher (C#/.NET/WinForms)
           │                        - DoomRunner: Port traits, bitfield calculators, cross-platform
           │                        - DoomLauncher: Gold-standard /idgames scraper, save/stat tracking
           ▼
[Gen 4: Reactive Local Cockpit]    RNT Launcher (Go 1.23+ / Wails v2 / React 18 / TS / SQLite)
                                    - Pre-flight launch validation engine, deep lump/marker inspector,
                                      non-blocking process supervisor, portable YAML v1, modern ergonomics
```

### Market Positioning Summary
- **qZDL**: Minimalist speedrunning standard. Lightning fast, zero library management.
- **Rocket Launcher 2.0**: Legacy multi-tab launcher with built-in DOSBox script generation, but burdened by modal dialog fatigue and unmanaged process lifecycles.
- **Arachnotron**: QML-based visual launcher with profile inheritance and GZDoom netplay controls, but tightly coupled to ZDoom command dialects.
- **DoomRunner**: The premier cross-platform C++/Qt preset orchestrator with granular engine CLI trait adaptation and bitfield calculators, but lacks rich asset browsing and has entered maintenance-only mode.
- **DoomLauncher**: The undisputed gold standard for Windows library management with full `/idgames` scraping, savegame swapping, and level stat parsing, but locked to Windows/.NET WinForms.
- **RNT Launcher**: Fuses the rich library management of DoomLauncher with the portable preset-driven workflow of DoomRunner. Built upon the brand promise:
  > *"Beautifully simple. Designed from the very start to be as visually minimal and space efficient as possible. No cluttered interface. Fast and lightweight opens practically instantly, and switching is just as quick, all while having low memory and CPU usage. Fully-featured minimalism doesn't have to be a compromise. Configurable features a myriad of configurable preferences to ensure the best experience for as many people as possible. Supports all common formats."*

## 2. In-Depth Competitor Breakdown

### 2.1. Doom Launcher (`references/DoomLauncher`)
* **Author / Tech**: Nicholas St-Laurent (`Hobomaster22`) | C# (.NET Framework 4.6.1/4.7+), WinForms + WPF `ElementHost`, SQLite (`System.Data.SQLite`).
* **Platforms**: Windows-only (tightly coupled to Win32 APIs, `DwmSetWindowAttribute`, Windows shell paths).

#### Architectural Strengths & Differentiators
1. **Integrated `/idgames` Client**: Queries the Doomworld API (`api/api.php`), downloads archives, extracts contents, and imports entries into the local database with full text documentation.
2. **Native Lump Graphic Extraction & Palette Decoding**: `WadFileReader.cs` and `PaletteReaders.cs` parse raw 8-bit paletted lumps (`PLAYPAL`) and convert Doom/Heretic/Hexen/Doom64 planar graphics into ARGB bitmaps for instant UI rendering without engine invocation.
3. **Automated Save Game & Stat Tracking**: Segregates save games into isolated database records per mod; intercepts `-statdump` (PrBoom+), `-levelstat` (Chocolate/Crispy), and `.zds` save headers (ZDoom) to track kills, secrets, items, and level times per session.
4. **Steam & GOG Auto-Discovery**: Parses Steam's `libraryfolders.vdf` and `appmanifest_*.acf` to discover official commercial IWADs automatically.

#### Architectural Bottlenecks & Limitations
- **Platform Inflexibility**: Pure Win32/WinForms stack prevents native Linux/Steam Deck/macOS deployment.
- **Monolithic UI Coupling**: Partial classes in `MainForm` mix window messaging, process supervision, database persistence, and GDI+ rendering.
- **Modal-Heavy Interaction**: Editing presets, configuring ports, or resolving conflicts requires deep, blocking modal dialog trees.

---

### 2.2. Doom Runner (`references/DoomRunner`)
* **Author / Tech**: Jan Broz (`Youda008`) | C++17, Qt 5.15 / Qt 6, qmake, `libminizip`, `zlib`.
* **Platforms**: Windows (portable `.exe`, Scoop), Linux (AppImage, Flatpak, AUR, `.deb`, OBS), macOS (DMG bundle).

#### Architectural Strengths & Differentiators
1. **Deep Engine Dialect Abstraction (`Sources/EngineTraits/`)**: Tailors command-line arguments to specific engine families (ZDoom vs Chocolate vs PrBoom vs MBF vs EDGE vs KEX), resolving syntax divergences (`-warp` vs `+map`, `-merge` vs `-file`, `-savedir` vs `-save`).
2. **Interactive Bitfield Calculators**: Full UI visual calculators for ZDoom `dmflags`, `dmflags2`, `compatflags`, and `compatflags2` with embedded wiki descriptions and real-time integer flag computation.
3. **Scope-Based Configuration System**: Settings can be scoped per-preset, stored globally, or discarded upon exit (`StoreToPreset`, `StoreGlobally`, `DontStore`).
4. **Doom Mod Bundles (`.dmb`)**: Plaintext playlist format allowing modular composition and nested mod list sharing.
5. **Real-Time Process Supervisor**: Monitors engine execution via `QProcess`, capturing `stdout`/`stderr` into an integrated debug window.

#### Architectural Bottlenecks & Limitations
- **Massive God Object**: `MainWindow.cpp` exceeds 5,800 lines of tightly coupled logic spanning UI events, serialization, process spawning, and filesystem caching.
- **Maintenance-Only Status**: The author has officially frozen major feature development (`planned.txt` / `README.md`).
- **No In-App Mod Acquisition**: Lacks repository integrations (idgames/ModDB); requires all files to be pre-downloaded manually.
- **No Visual Card / Box Art Presentation**: Tabular and tree widget presentation provides utilitarian efficiency but minimal visual immersion.

---

### 2.3. qZDL (`references/qzdl`)
* **Author / Tech**: Lcferrum, Cody Harris (`QBasicer`), Ryan Turner (`BioHazard`) | C++ (C++03/11), Qt 4.8 / Qt 5, Visual Studio / qmake.
* **Platforms**: Windows, Linux, macOS.

#### Architectural Strengths & Differentiators
1. **Sub-50ms Cold Starts & Ultra-Low Footprint**: Consumes $<10\text{ MB}$ of RAM with instantaneous startup.
2. **Industry-Standard `.zdl` Format**: The portable INI launch state file (`[zdl.save]`) remains the universal standard for sharing load orders across the Doom community.
3. **Non-Destructive Mod Disabling**: Striking through mod files in the launch list excludes them from the generated `-file` command without deleting them from the list.
4. **MD5 Engine & IWAD Identification**: Uses binary checksums to auto-detect base game types and engine binaries.

#### Architectural Bottlenecks & Limitations
- **No Library Indexing or Persistence**: Maintains only a single active launch state in memory; switching projects requires manually opening `.zdl` files.
- **No Deep Metadata Parsing**: Lacks lump inspection, archive validation, and duplicate detection.
- **Dated Architecture**: Bound to legacy Qt 4 patterns and basic dialog layouts lacking search, filtering, and rich telemetry.

---

### 2.4. Arachnotron (`references/arachnotron-master`)
* **Author / Tech**: Richard Nicholson (`Lycanite` / Nephrite UK) | C++11, Qt Quick / QML 2, JavaScript, qmake.
* **Platforms**: Linux (Debian `.deb`), Windows.

#### Architectural Strengths & Differentiators
1. **Object-Oriented Profile Inheritance (`inheritProfiles`)**: Child profiles inherit base mods, configuration parameters, and engine flags from parent profiles, reducing duplicate configuration for total conversions and weapon mods.
2. **Separation of Profile vs Session Overrides**: Permanent profile records (`profiles.json`) are decoupled from ephemeral launch session settings (`profileSettings.json`).
3. **Specialized GZDoom Netplay Controls**: GUI configuration for GZDoom peer-to-peer networking, packet duplication (`-dup`), latency buffering (`-extratic`), and host IP concealment.

#### Architectural Bottlenecks & Limitations
- **Hardcoded ZDoom Dialect**: Emits `+map`, `+set`, `+playerclass`, and `+freeze`, breaking compatibility with vanilla/Boom/demo-compatible ports (Chocolate Doom, DSDA-Doom, Woof!).
- **QProcess Memory Leaks**: Spawns processes using `new QProcess()` without lifecycle ownership or process cleanup.
- **Broken Inheritance Implementation**: An inverted cvar merging bug in `ProfileModel::getInheritedMap` causes parent profile variables to overwrite child profile overrides.
- **UI-Level List Hacks**: Reorders mod items by mutating QML `TextField` string properties rather than reordering the underlying data model.

---

### 2.5. Rocket Launcher 2.0 (`references/RocketLauncher2`)
* **Author / Tech**: Hypnotoad (`Techpillar`) | C++, Qt 4/5, qmake.
* **Platforms**: Windows, Linux.

#### Architectural Strengths & Differentiators
1. **Automated DOSBox Script Generator**: Automatically constructs DOSBox execution routines (`MOUNT C`, directory navigation, aspect ratio correction) for running authentic 16-bit DOS executables (`DOOM.EXE`, `DOOM2.EXE`, `HERETIC.EXE`).
2. **Dedicated Common Resources Bin**: Separates base resources (soundfonts, high-res textures, HUDs) from gameplay PWADs.
3. **Drag-and-Drop File Integration**: Custom `DndFileSystemListView` facilitates drag transfers directly from the OS file manager.

#### Architectural Bottlenecks & Limitations
- **Severe Config Desynchronization Bug**: `configs.cpp` (`loadExtConfig`) erroneously reads settings from the active in-memory object instead of the targeted `.rocket` file.
- **Aggressive Modal Dialog Fatigue**: Every operation (preset loading, path browsing, missing item warnings) triggers blocking modal message boxes.
- **Naive Argument Tokenizer**: Naive quote splitting breaks on nested quotation marks and special path characters.
- **Unfinished Codebase**: Abandoned UI hooks (`PWListView`) containing active debugging alerts.

---

## 3. Comprehensive Feature & Architecture Matrix

| Capability / Feature Area | **RNT Launcher** | **DoomLauncher** | **DoomRunner** | **qZDL** | **Arachnotron** | **RocketLauncher 2** |
|---|---|---|---|---|---|---|
| **Core Language & GUI** | Go 1.23+ / React 18 / TS 5 | C# / WinForms + WPF | C++17 / Qt 5 & 6 | C++ / Qt 4 & 5 | C++11 / QML 2 | C++ / Qt 4 & 5 |
| **Desktop Bridge / Native Layer** | Wails v2 (Webview) | Win32 / .NET Runtime | Native Qt Widgets | Native Qt Widgets | Qt Quick Scene Graph | Native Qt Widgets |
| **CGO / Native Dependency** | **Zero CGO** (Pure Go) | Required (.NET CLR) | C++ Toolchain | C++ Toolchain | C++ Toolchain | C++ Toolchain |
| **Supported Platforms** | **Win, Linux, macOS** | Windows Only | **Win, Linux, macOS** | **Win, Linux, macOS** | Linux, Windows | Linux, Windows |
| **UI Density Modes** | **Compact & Comfortable** | Fixed Windows DPI | Utilitarian Grid | Fixed Layout | Fixed QML | Fixed Multi-tab |
| **Supported Mod Formats** | **WAD, PK3, PK7, IPK3, ZIP, DEH, BEX** | WAD, PK3, ZIP | WAD, PK3, 7Z, DEH | WAD, PK3, DEH | WAD, PK3 | WAD, PK3, DEH |
| **Format Visibility Controls** | **Granular Multi-select** | None | None | None | None | None |
| **Data Persistence Engine** | Embedded SQLite (WAL) | Embedded SQLite (WAL) | JSON (`options.json`) | INI (`zdl.ini`, `.zdl`) | Hierarchical JSON | INI (`SavedConfigs`) |
| **Pre-Flight Validation Engine** | **5-Rule Pre-flight Suite** | Partial (check on run) | Engine binary verify | Manual verify | None | Missing-selection alert |
| **Binary Lump Parsing** | **WAD Magic, Lumps, Maps** | **Full (PLAYPAL, ARGB)** | WAD & PK3 Headers | Minimal / MD5 | None | None |
| **Archive Landmark Detection** | **ZSCRIPT, DECORATE, etc.** | Text files, GameInfo | `MAPINFO` extraction | `MAPINFO` extraction | None | None |
| **Cryptographic Hashing** | Streaming SHA-256 | Internal Hash / Size | File Info Timestamp | MD5 Checksum | None | None |
| **Load Order Management** | Drag/Drop, Keys, Toggle | Order Column in Grid | Up/Down, Checkboxes | Drag/Drop, Strike | Up/Down UI swap | Up/Down, Checkboxes |
| **Profile Sharing Format** | **Portable YAML v1** | Export Zip / Preset | `.dmb` / Shell Scripts | **.zdl INI (Standard)** | JSON files | `.rocket` INI files |
| **Profile Inheritance** | Independent Profiles | Independent Profiles | Scoped Presets | None | **Parent/Child Tree** | None |
| **Engine Dialect Translation** | Standard structured CLI | Flavors (ZDoom, PrBoom) | **Deep Engine Traits** | Manual arguments | Hardcoded ZDoom | 4 Coarse Types |
| **Bitfield Calculators (dmflags)**| Planned / Roadmap | None | **Full Interactive** | None | None | None |
| **Process Supervision & Logs** | **Structured Goroutines** | Win32 ProcessExited | `QProcess` with Log Win | Basic `QProcess` | Unmanaged leak | Unmanaged leak |
| **Playtime & Telemetry Tracking** | **Full History & Duration**| **Full History & Stats**| None | None | None | None |
| **In-Game Savegame Management** | Planned / Roadmap | **Full SQLite Storage** | Path overrides only | None | Basic `-loadgame` | None |
| **Online Repository Integration** | Planned / Roadmap | **Full /idgames Client** | None | None | None | None |
| **DOSBox Execution Setup** | None | Launch feature args | Custom arguments | Manual | None | **Automated Scripting** |
---

## 4. Distinct Competitive Advantages of RNT Launcher

1. **Deterministic Pre-Flight Validation Engine**
   - *The Problem in Other Launchers*: Launchers like qZDL, Arachnotron, and RocketLauncher spawn processes blindly. If an IWAD is missing, a mod path is stale, or an engine executable lacks execution permissions, the engine crashes with an opaque OS alert or silent failure.
   - *RNT Launcher Advantage*: Evaluates 5 discrete validation rules (Engine, IWAD, Mod Files, Duplicate Mods, Working Directory) before execution, computing an aggregate state (`READY`, `READY WITH WARNINGS`, `CANNOT LAUNCH`) with actionable diagnostic items.

2. **Zero-CGO, Cross-Platform Architecture**
   - *The Problem in Other Launchers*: DoomLauncher is bound to Windows WinForms; DoomRunner, qZDL, and Arachnotron require platform-specific C++ compilers, Qt SDKs, and native build dependencies.
   - *RNT Launcher Advantage*: Powered by Go 1.23+, Wails v2, and `modernc.org/sqlite` (pure Go SQLite), RNT Launcher compiles with `CGO_ENABLED=0` across Windows, Linux, and macOS without requiring GCC/MinGW or heavy runtime dependencies.

3. **Deep Structural Archive Inspection**
   - *The Problem in Other Launchers*: Most launchers only verify file extensions (`.wad`, `.pk3`).
   - *RNT Launcher Advantage*: Binary header validation verifies IWAD/PWAD magic, counts internal lumps, extracts map tokens (`MAP01`-`MAP99`, `E1M1`-`E4M9`), and checks PK3/ZIP archives for core landmarks (`ZSCRIPT`, `DECORATE`, `MAPINFO`, `SNDINFO`, `TEXTURES`, `GLDEFS`), immediately classifying mod behaviors and game targets.

4. **Portable Profile Specification (YAML v1)**
   - *The Problem in Other Launchers*: Profiles in DoomRunner (`options.json`), Arachnotron (`profiles.json`), and DoomLauncher (`DoomLauncher.sqlite`) are tightly coupled to local absolute filesystem paths, making them non-transferable across different machines or OS environments.
   - *RNT Launcher Advantage*: Implements a standardized YAML v1 schema that resolves dependencies locally by asset ID, name, or filename, generating diagnostic reports for missing content upon import.

5. **Modern Reactive Ergonomics, UI Density & Desktop Polish**
   - *The Problem in Other Launchers*: Legacy launchers rely on dense, utilitarian Qt/WinForms table controls or modal dialog sequences that cause interaction fatigue and consume bloated screen real estate.
   - *RNT Launcher Advantage*: Modern React 18 + Tailwind CSS interface featuring spotlight search (`Ctrl+K`), visual drag-and-drop load ordering, keyboard navigation (`↑`/`↓`), real-time scan progress banners, customizable UI density modes (`Compact` default vs `Comfortable`), and instant 1-click launch shortcuts (`Ctrl+Enter`).
---

## 5. Strategic Roadmap & Architectural Opportunities

To solidify RNT Launcher as the category-defining Doom management platform, the following features should be prioritized based on competitor analysis:

### Tier 1: High-Impact Parity Features (Borrowing from DoomLauncher)
- [ ] **Native PLAYPAL / TITLEPIC Lump Rendering**: Implement a pure-Go palette reader to decode 8-bit `PLAYPAL` graphics and render authentic `TITLEPIC`, `CREDIT`, and `BOSSBACK` lump artwork directly in the Mod Inspector drawer.
- [ ] **Doomworld `/idgames` API Integration**: Add a dedicated archive browser allowing users to search, inspect README files, download archives, and ingest mods into the library with automated ZIP decompression.
- [ ] **Isolated Savegame Management**: Add a savegame repository service that isolates `.zds` / `.dsg` save files by profile, preventing mods from overwriting each other's save slots.

### Tier 2: Advanced Engine Adaptation (Borrowing from DoomRunner)
- [ ] **Engine Family Dialects & Parameter Adapters**: Formalize an `EngineDialect` trait interface in `internal/launcher/` that adapts command-line arguments according to the target engine family (e.g., `-warp` vs `+map`, `-complevel` for DSDA/PrBoom, `-file` vs `-merge` for Chocolate Doom).
- [ ] **ZDoom `dmflags` / `compatflags` Bitfield Calculator**: Add an interactive configuration modal in the profile editor with flag bitfield toggles and embedded documentation tooltips.

### Tier 3: Interoperability & Community Standards (Borrowing from qZDL & Arachnotron)
- [ ] **`.zdl` Configuration Importer**: Support importing legacy `.zdl` launch files directly into RNT Launcher profiles to eliminate switching friction for long-time qZDL users.
- [ ] **Profile Inheritance / Mixins**: Allow profiles to declare a `parent_profile_id`, inheriting base gameplay mods (e.g., *Brutal Doom*, *Nash's Gore*, HUD enhancements) while varying map PWADs and difficulty settings.
