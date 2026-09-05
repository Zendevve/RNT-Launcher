# Reference Launchers Inventory — RNT Launcher Audit Harness (Phase 1)

Generated 2026-09-02 | Working directory: `D:/COMPROG/RNT Launcher` | Branch: `autoresearch/audit-against-the-ref-launchers-in-refs-20260902`

This inventory was built solely from local filesystem reads (no network). It cross-checks `docs/COMPETITOR_ANALYSIS.md`, `docs/PRD.md`, `docs/PRD_AUDIT.md`, `docs/KNOWN_ISSUES.md` and direct inspection of `references/*`.

---

## 1. Launcher Overview

| # | Launcher (id) | Path | Language / UI Stack | Build System | License | Storage / Data Flow |
|---|---|---|---|---|---|---|
| 1 | **Arachnotron** (`arachnotron`) | `references/arachnotron-master` | C++11, Qt Quick QML 2 + JavaScript, QML Scene Graph | `qmake` — `arachnotron.pro` (SUBDIRS) + `src/src.pro`; Qt Creator kit; `deploy-linux.sh` / `deploy-windows.cmd` | GPL-3.0+ (`debian/copyright` — `Format: ... GPL-3.0+`) | Hierarchical JSON: `profiles.json`, `profileSettings.json` (session overrides), `settings.json`, `categories/*.json` via `JsonLoader` (QHash strings/doubles/bools/lists/maps, `QJsonObject` read/write, `sourcePath` per model). Files under `debian/opt/arachnotron/config/` |
| 2 | **RocketLauncher2** (`rocketlauncher2`) | `references/RocketLauncher2` | C++11, Qt 4/5 Widgets (`Qt += core gui widgets`) | `qmake` — `RocketLauncher2.pro` | GPL-3.0 (`LICENSE.txt`) | INI via `QSettings::IniFormat` `UserScope` `"RocketLauncher2"` `"settings"` + `"SavedConfigs"` array (`configs.cpp`: `beginReadArray("configs")`, `RocketFile` fields). Also `settings.ini` beside exe |
| 3 | **DoomLauncher** (`doomlauncher`) | `references/DoomLauncher` | C# .NET Framework 4.8 ( `TargetFrameworkVersion v4.8` ), WinForms + WPF `ElementHost`; deps: EntityFramework 6.4.4, System.Data.SQLite 1.0.115.5, Newtonsoft.Json 13.0.1, SevenZipSharp, SharpCompress, Gameloop.Vdf, Octokit | MSBuild — `DoomLauncher.sln` (VS17, 7 csproj: DoomLauncher, WadReader, CheckBoxComboBox, BindingListView, UnitTest, WpfControlLibrary, DoomLauncherRelease) + `Setup/Setup.vdproj` installer; AppVeyor | GPL-3.0 (`LICENSE` 35 KB) | Embedded SQLite WAL (`DoomLauncher.sqlite` 36 KB) via `System.Data.SQLite` + EF6 Code-First (`SqliteDatabaseAdapter`, `DirectoryDataSourceAdapter`, `DbDataSourceAdapter`, `WadArchiveDataAdapter`). Automatic daily backups. EF `packages/EntityFramework.6.4.4` |
| 4 | **qZDL** (`qzdl`) | `references/qzdl` | C++03/11, Qt 4.8/5 Widgets, `miniz` + `SimpleWFA` | `qmake` — `qzdl.pro` (`TARGET zdl`, `DESTDIR release`) + MSVC `qzdl.vcxproj`/`qzdl.sln` (VS2010 compat); `COMPILE` documents static `-static-libstdc++` build | GPL-3.0 (`LICENSE` 32 KB; header in `qzdl.pro` `Lcferrum/QBasicer`) | Custom INI via `ZDLConf` / `ZDLSection` / `ZDLLine` parser (`readINI`/`writeINI`/`writeStream`, `QVector<ZDLSection*>`, `clone`, read/write locks). Files: `zdl.ini` + per-preset `*.zdl` `[zdl.save]` |
| 5 | **DoomRunner** (`doomrunner`) | `references/DoomRunner` | C++17, Qt 5.15 / Qt 6 Widgets + Network, `libminizip`/`bz2`/`zlib` | `qmake` — `DoomRunner.pro` (`CONFIG += c++17`, `QT += core gui widgets network`, `LIBS += -lminizip`); pkg deployment: AppImage, Flatpak, AUR, .deb, macOS DMG; `Scripts/3-install.sh` | GPL-3.0 (`LICENSE` 35 KB) | JSON `options.json` via `OptionsSerializer` (`serializeOptionsToJsonDoc`/`deserializeOptionsFromJsonDoc`, `UserData.hpp`, `JsonUtils`), plaintext `.dmb` Doom Mod Bundles, `FileInfoCache`, `PathCheckUtils`; `Resources/Resources.qrc` |

### Files inspected (evidence)

- All launchers: top-level `README*`, `*.pro`, `LICENSE*`, `debian/copyright` where applicable.
- Arachnotron: `src/include/jsonloader.h`, `settingsmanager.h`, `profilemodel.h`, `profilebase.h`, `src.pro`, `qml/*.qml`, `scripts/*.js`, `debian/opt/arachnotron/config/`.
- RocketLauncher2: `rocketlauncher2.h/.cpp` (708 lines), `rocketlauncher2.ui` (40.6 KB), `configs.h/.cpp`, `abstractmodels.*`, `dndfilesystemlistview.*`, `enginesetup.cpp`.
- DoomLauncher: `DoomLauncher.sln`, `DoomLauncher/DoomLauncher.csproj` (Nuspec, TargetFrameworkVersion), `WadReader/WadFileReader.cs`, `DoomLauncher.sqlite`, `DataSources/*.cs`, `Handlers/*.cs`, `SourcePort/*`, `Statistics/*`, `TileImages/*`, `TextFileParsers/*`.
- qZDL: `qzdl.pro`, `qzdl.vcxproj`, `COMPILE`, `include/zdlconf.hpp`, `include/zdlsection.hpp`, `include/ZDLMainWindow.h`, `src/qzdl.cpp`, `src/zdlconf.cpp`, `src/libwad.cpp`, `src/ZLibPK3.cpp`, `miniz/miniz.*`.
- DoomRunner: `DoomRunner.pro`, `README.md`, `HowToBuild.md`, `Sources/EngineTraits.hpp/.cpp` (244/28 KB), `Sources/OptionsSerializer.hpp/.cpp`, `Sources/UserData.hpp/.cpp`, `Sources/Utils/WADReader.*`, `Pk3Reader.*`, `ZipReader.*`, `Sources/MainWindow.*` (207 KB).
- Docs: `docs/COMPETITOR_ANALYSIS.md` (17.4 KB), `docs/PRD.md` (66.8 KB, 133 sections), `docs/PRD_AUDIT.md` (17.7 KB), `docs/KNOWN_ISSUES.md` (3.4 KB).

---

## 2. Core Feature Coverage

Legend: ✅ = present / mature, ⚠️ = partial / buggy, ❌ = absent, — = N/A.

### 2.1 Library / Metadata / Parsing

| Capability | Arachnotron | RocketLauncher2 | DoomLauncher | qZDL | DoomRunner | Notes (RNT gap/opportunity) |
|---|---|---|---|---|---|---|
| **Library / scanning** | ⚠️ category-based (`CategoryManager`) no file hash | ❌ flat favorites only | ✅ full DB + scraping `FileLoadHandler`, `NewFileDetector` | ❌ single in-memory state | ✅ synced dirs + `FileInfoCache` | RNT: SQLite indexed scan with progress events, inspector drawer |
| **WAD parsing (IWAD/PWAD magic, lumps, maps)** | ❌ | ❌ | ✅ `WadFileReader.cs` magic 4-byte, `WadHeader`, `FileLump` | ⚠️ minimal `libwad` + MD5 | ✅ `WADReader` (map tokens `MAP01..MAP99`, `E1M1..`) | RNT: header + lump + map markers |
| **PK3/ZIP parsing** | ❌ | ❌ | ✅ `WadArchiveFile`, `Zip/SevenZip/Rar` readers | ⚠️ `ZLibPK3` via `miniz` | ✅ `Pk3Reader`/`ZipReader` central dir | RNT: central-dir landmarks |
| **Archive landmark detection (`ZSCRIPT`, `DECORATE`, `MAPINFO`, `SNDINFO`)** | ❌ | ❌ | ⚠️ `TextFileParsers`, `GameInfo` | ⚠️ `MAPINFO` only | ✅ `MAPINFO` extraction | RNT: `ZSCRIPT`, `DECORATE`, `MAPINFO`, `SNDINFO`, `TEXTURES` |
| **Lump graphic render (PLAYPAL → ARGB)** | ❌ | ❌ | ✅ `WadReader/DoomImage/PaletteReaders.cs` | ❌ | ❌ | Roadmap Tier 1: pure-Go `PLAYPAL` reader |
| **Hashing** | ❌ | ❌ | ⚠️ internal hash/size | ✅ MD5 | ⚠️ timestamp / file info | RNT: streaming SHA-256 duplicate detection |

### 2.2 Engine / IWAD / Profile

| Capability | Arachnotron | RocketLauncher2 | DoomLauncher | qZDL | DoomRunner | Notes |
|---|---|---|---|---|---|---|
| **IWAD management** | ✅ `SettingsManager` hash `iwads` | ✅ `listbox_IWADs` | ✅ `IWadData`, tile view, Steam/GOG `libraryfolders.vdf` | ✅ `ZDLIWadList` / `ZLibDir` | ✅ sync to selected directory | DoomLauncher auto-discovers Steam |
| **Engine management** | ✅ hash `engines` (path+config) | ✅ `enginesetup.cpp` 4 types | ✅ `SourcePortData` + flavors | ✅ `ZDLSourcePortList` | ✅ `EngineTraits` families 6 | DoomRunner deepest |
| **Engine dialect translation** | ❌ hardcoded `+map`/`+set` ZDoom | ⚠️ 4 coarse types | ⚠️ flavors (ZDoom/PrBoom) | ❌ manual `addCmd` | ✅ full `EngineFamilyTraits` (`-warp` vs `+map`, `-file` vs `-merge`, `-savedir`, `compatmode` styles) | RNT: trait interface `EngineDialect` |
| **Profile / preset management** | ✅ `ProfileModel/Manager` + inheritance | ✅ `RocketFile` `name/engName/iwadName/resPaths/filePaths/filesChecked/map/skill/addCmd` | ✅ `GameProfile`, `TagData/TagMapping`, custom params | ❌ single `.zdl` live state | ✅ unlimited named presets, one-click switch | Arachnotron inheritance tree |
| **Load-order management** | ⚠️ up/down via `TextField` mutation | ✅ up/down + `DndFileSystemListView` checkboxes | ✅ order column grid + auto-load | ✅ drag/drop + strike-through disable | ✅ up/down + checkboxes tick without remove, drag-drop | qZDL strike-through is unique |
| **Profile inheritance / mixins** | ✅ `getInheritedProfiles()` / `getInheritedMap()` (bug: parent overwrites child) | ❌ | ❌ independent | ❌ | ⚠️ scoped (`StoreToPreset/Globally/DontStore`) | RNT roadmap: `parent_profile_id` |
| **Common resources bin** | ❌ | ✅ `resPaths` separated | ❌ | ❌ | ❌ | Rocket exclusive |
| **Mod bundles / playlists** | ❌ | ❌ | ❌ | ❌ | ✅ `.dmb` nested plaintext + shell script export | RNT: portable YAML v1 |

### 2.3 Launch / Process / Validation

| Capability | Arachnotron | RocketLauncher2 | DoomLauncher | qZDL | DoomRunner |
|---|---|---|---|---|---|
| **Launch / argument building** | ✅ `ProfileLaunch` `getLaunchCommand()` `+playerclass` etc. | ✅ `rocketlauncher2.cpp` `parseCmdLine`, `makeConfigFromCurrent()` | ✅ `LaunchArgs`, `ISourcePortFlavor`, skill/warp handling | ✅ `getArgumentsString`/`getArgumentsList` + `getExecutable()` | ✅ trait-adapted args, skill/warp/compat |
| **DOSBox scripting** | ❌ | ✅ automated `MOUNT C` + dir nav + aspect (`RLPics/DOSBox.png`) | ❌ | ❌ | ❌ |
| **Process supervision** | ⚠️ `new QProcess()` leak, no cleanup | ⚠️ `QProcess` unmanaged | ✅ Win32 `ProcessExited` | ⚠️ basic `QProcess` | ✅ `QProcess` + `ProcessOutputWindow` stdout/stderr debug window |
| **Bitfield calculators (dmflags/compatflags)** | ❌ | ❌ | ❌ | ❌ | ✅ `CompatOptsDialog`/`GameOptsDialog` with wiki tooltips |
| **Validation / diagnostics** | ❌ none | ⚠️ missing-selection `QMessageBox` | ⚠️ check-on-run (`NewFileDetector`/`ITagMapLookup`) | ⚠️ manual verify | ⚠️ engine binary verify (`PathCheckUtils`) | RNT: 5-rule pre-flight (`READY`/`WARNING`/`CANNOT LAUNCH`) |
| **Multiplayer** | ✅ GZDoom netplay (`-dup`, `-extratic`, host IP) | ❌ | ❌ | ❌ | ✅ LAN host/join (`multHostParam`, `multJoinParam`) |  |

### 2.4 History / Telemetry / Network

| Capability | Arachnotron | RocketLauncher2 | DoomLauncher | qZDL | DoomRunner |
|---|---|---|---|---|---|
| **History / playtime / stats** | ❌ ` -loadgame` only | ❌ | ✅ `Statistics` (`StatdumpReader`, `LevelstatReader`, `ZDoomStatsReader`, `PlaySession`, `StatsData`: kills/secrets/items/time per map) | ❌ | ❌ |
| **Savegame management** | ⚠️ basic `-loadgame` path | ❌ | ✅ `SaveGameHandler` (ZDS/DSG isolated per-mods in DB, `IDemoParser`) | ❌ | ⚠️ save/demo/screenshot dir per preset |
| **Demo management** | ❌ | ✅ `demo` + `demoName` flags | ✅ `Demo/DemoUtil`, `IDemoParser` | ❌ | ✅ record/replay demo |
| **Repository / downloader** | ❌ | ❌ | ✅ `/idgames` API (`api/api.php`) download + extract + text scraping (`Sync/*`, `DownloadHandler`) | ❌ | ❌ | RNT deferred (local-first) |
| **Steam/GOG discovery** | ❌ | ❌ | ✅ `GameStoreFiles`, `AutomaticGameStoreCheck` via `Gameloop.Vdf` | ❌ | ❌ |
| **Import / Export** | ✅ JSON export/import (`importFile`) | ✅ `.rocket` INI (buggy `loadExtConfig`) | ✅ export zip/preset + sync handlers | ✅ `.zdl` universal INI | ✅ `.dmb` bundles + shell scripts + `.ini` compat |

### 2.5 UI / Ergonomics / Settings

| Capability | Arachnotron | RocketLauncher2 | DoomLauncher | qZDL | DoomRunner |
|---|---|---|---|---|---|
| **UI framework** | QML 2 Quick Scene Graph + `qml/*.qml` | Qt Widgets (`rocketlauncher2.ui` 40.6 KB) | WinForms + WPF `ElementHost` `CheckBoxComboBox`, `BindingListView` tiles | Qt Widgets (XPM icons) | Qt Widgets + `ExtendedListView/TreeView` |
| **Settings / config** | `settings.json` via `SettingsManager` | `QSettings` Ini | `SettingsDataSource` + `ConfigurationData` in SQLite | `ZDLConfigurationManager` + `ZDLSettingsPane` | `SetupDialog` + `OptionsSerializer` + `Themes` |
| **Search / filter** | ❌ | ❌ | ✅ `Search` + `IItemFilter` + tags | ❌ | ✅ `SearchPanel` + regex filter |
| **Tagging** | category based | ❌ | ✅ custom colored `TagData` / `TagMapping` | ❌ | ❌ |
| **Drag-and-drop** | ✅ QML + `fileLoader.js` | ✅ `DndFileSystemListView` + custom `fileSystemPathDropped` | ✅ `DragDrop` handlers | ✅ custom `ZDLListWidget` | ✅ `Extended*` drag-drop + re-order |
| **Themes** | ⚠️ custom BG PNGs | ❌ | ⚠️ `DarkTheme`/`ImmersiveDarkMode` + `Stylize` | ❌ | ✅ light/dark follow system (`Themes.cpp` 33 KB) |
| **Notifications / UX polish** | controls.js popups | modal message boxes fatigue | `ToolTipHandler`, `UpdateControl`, `ScreenFilter` CRT | basic `QMessageBox` | native Qt dialogs |

---

## 3. Data Flow & Storage Detail

| Launcher | Persistence path(s) | Serialization | Flow |
|---|---|---|---|
| Arachnotron | `~/.config / build/o` or `debian/opt/arachnotron/config/{profiles.json, profileSettings.json, settings.json, categories/{doom,doom2,heretic,hexen,strife}.json}` | `JsonLoader` `toJson()`/`fromJson()` `parseJson(key,value)` → QHash maps; `SettingsManager::writeToJson()` `ProfileModel::readFromJson()` | QML JS (`main.js`, `profiles.js`, `categories.js`, `fileLoader.js`) → `ProfileManager` → `JsonLoader` → file |
| RocketLauncher2 | `QStandardPaths::UserScope/RocketLauncher2/settings.ini` + `SavedConfigs.ini`; `QSettings::beginReadArray("configs")` → `RocketFile` | `RocketFile` struct `name/engName/iwadName/resPaths/filePaths/filesChecked/map/skill/addCmd/demo/noMonsters/noMusic` `QVariantList` | `initConfigs()` load → UI listboxes (`pwadloadlist`, `reslist`, `conflist` `ConfigListModel`) → `makeConfigFromCurrent()` → `saveToGlobal()` |
| DoomLauncher | `%AppData%/DoomLauncher/DoomLauncher.sqlite` (WAL) + `bin/Debug|Release` backups | EF6 `DbContext` `DbDataSourceAdapter` (Entities: `GameFile`, `FileData`, `SourcePortData`, `TagData`, `StatsData`, `PlaySession`); `DirectoryDataSourceAdapter` (filesystem), `WadArchiveDataAdapter` (archive), `GameFileImageHandler` | Scanner `FileLoadHandler` + `TextFileParsers/ZdlParser` + `SyncHandler` (/idgames) → `DataSources` → SQLite → `TabViews` (`BasicTabViewCtrl`, `IdGamesTabViewCtrl`, `UntaggedTabView`) → `LaunchHandler` |
| qZDL | `zdl.ini` (app config) + `*.zdl` (preset) in user docs/pwd | `ZDLConf` (`sections: QVector<ZDLSection*>`) → `ZDLSection` (`lines: QVector<ZDLLine*>`) → `zdlline.hpp` `variable=value`; `parse(QString in, ZDLSection*)`, `streamWrite(QIODevice*)`, mutex `LOCK_CLASS` | `ZDLConfiguration`/`ZDLConfigurationManager` → `ZDLConf` → INI file → `ZDLMainWindow::getArgumentsList()` → `QProcess::startDetached` |
| DoomRunner | `~/.local/share/DoomRunner/options.json` (Linux) / `%AppData%/DoomRunner/options.json` (Win); `.dmb` bundles anywhere | `OptionsSerializer` `OptionsToSave` ↔ `OptionsToLoad` ↔ `QJsonDocument`; `UserData` (`Engines`, `IWADs`, `Presets`, `ModBundles`); `FileInfoCache` (timestamps, size) | `MainWindow` (god object) → `UserData` → `OptionsSerializer` → JSON; `WADReader`/`Pk3Reader`/`ZipReader`/`ExeReader` → `DoomFiles` meta → `EngineTraits` → arg builder → `QProcess`; `OptionsStorageDialog` scopes |

---

## 4. Standout Features & Gaps vs Others

| Launcher | Standout vs peers | Notable gaps vs peers |
|---|---|---|
| **Arachnotron** | Only one with *profile inheritance tree* (child inherits base mods/flags), *GZDoom netplay UI* (dup/extratic), split persistent profile vs ephemeral session file. | No WAD/PK3 landmark parsing, no archive validation, no history/stats, QProcess leak, hardcoded ZDoom (`+map`), inverted cvar merge bug. Most tightly coupled to ZDoom dialect. |
| **RocketLauncher2** | Only one with *automated DOSBox script generation* (`MOUNT C` + correct exe), *separate common resources bin* (soundfonts/high-res). | No deep metadata parsing, no validation suite, modal dialog fatigue, naive tokenizer, config desync bug — least robust persistence layer. |
| **DoomLauncher** | Gold standard for *library richness*: /idgames browser+download, `PLAYPAL` bitmap rendering, Steam/GOG `libraryfolders.vdf` discovery, per-map *stat tracking* (`statdump`/`levelstat`/`.zds`), *savegame segregation per mod*, tagging+rating, daily SQLite backups. | Windows-only (.NET/Win32), monolithic `MainForm` partials, heaviest dependency footprint (EF, SQLite, SharpCompress). |
| **qZDL** | *Speed king*: sub-50 ms, <10 MB, smallest binary; *universal `.zdl` standard* (portable INI still shared community-wide); *MD5 engine/IWAD identification*, *non-destructive disable* (strike-through). | Single live state (no indexed library), no rich metadata, no diagnostics, outdated Qt4 patterns. Minimalist by design — no persistence beyond one launch. |
| **DoomRunner** | Deepest *engine trait abstraction* (6 families, per-family load/save/mult/map/compat params, `pistolStartOption`, `screenshotDirParam`), *interactive bitfield calculators* with wiki tooltips, *scope-aware settings* (per-preset/global/discard), *` .dmb` bundles* (nested shareable playlists), *live process log window*. Cross-platform gold. | No asset acquisition (manual download), no visual card/box-art, no stat/history, `MainWindow.cpp` 5800-line god object, officially maintenance-only (`planned.txt` empty). |

### Cross-check against `docs/PRD_AUDIT.md` / `docs/COMPETITOR_ANALYSIS.md`

- PRD Audit (133/133 PASS) treats RNT as unifying *DoomRunner profiles* + *YADL playlists* + *qZDL launching* + *Arachnotron profile architecture* + *DoomLauncher metadata* — confirmed by inventory.
- Competitor Analysis market generations (Gen1 qZDL minimalist → Gen2 Rocket/Arachnotron → Gen3 DoomRunner/DoomLauncher → Gen4 RNT) aligns with build-system ages: Qt4/QtCreator (qZDL/Rocket) vs Qt Quick 5.12 (Arachnotron) vs Qt5/6 C++17 (DoomRunner) vs C# .NET 4.8 (DoomLauncher).
- Roadmap Tier 1–3 opportunities flagged in analysis (PLAYPAL rendering, /idgames, save isolation, engine dialects, dmflags calculator, .zdl import, inheritance mixins) are accurately absent in RNT MVP per `KNOWN_ISSUES.md` 1.1–1.3 deferrals.

---

## 5. Feature Taxonomy Candidate (union, `kebab-case`, sorted)

> Written verbatim to `autoresearch/ref_inventory.json:feature_taxonomy_candidate` for deterministic audit harness consumption.

```
archive-landmark-detection, automatic-backups, bitfield-calculator-dmflags, category-library, common-resources-bin, demo-management, diagnostics-validation, diagnostics-missing-selection-alert, dosbox-script-generation, drag-and-drop, engine-dialect-flavors, engine-dialect-translation, engine-management, gzdoom-netplay-controls, idgames-integration, import-export, import-export-rocket, import-export-zdl, iwad-management, launch-argument-building, library-favorites, library-management, lightweight-fast-start, load-order-management, lump-graphic-rendering-playpal, mapinfo-extraction, md5-engine-iwad-identification, mod-bundles-dmb, mod-list-checked-toggle, multiplayer-lan, non-destructive-disable, pk3-parsing-via-miniz, pk3-zip-parsing, play-history, playtime-tracking, process-log-capture, process-supervision, profile-inheritance, profile-load-order, profile-management, scanning, screenshots-import, scope-based-config, search-filter, search-filter-regex, session-vs-profile-overrides, settings-config, savegame-management, statistics-tracking, steam-gog-discovery, tagging, themes-light-dark, ui-qml, ui-qt-widgets, ui-winforms-wpf-tiles, wad-parsing, wad-parsing-minimal
```

Taxonomy covers all categories requested: **library/scanning, wad/pk3 parsing, engine/IWAD management, profile/load-order, launch/argument building, process supervision, history/playtime, diagnostics/validation, settings/config, import/export, UI framework**, plus archive/landmark, hashing, tagging, multiplayer, dosbox, inheritance.

---

## 6. Implications for RNT Launcher (audit harness)

- **Parity baselines**: Use DoomLauncher SQLite schema as library-rich reference, DoomRunner traits as engine-dialect oracle, qZDL `.zdl` as portable exchange format.
- **Validation harness**: RNT's 5-rule pre-flight (`ERR_ENGINE_NOT_FOUND`, `ERR_IWAD_MISSING`, `ERR_MOD_MISSING`, `ERR_DUPLICATE_MODS`, working-dir) exceeds any ref (all ≤ partial). Harness should test every ref's failure mode and expect RNT `READY/WARNING/CANNOT_LAUNCH` determinism.
- **Storage contract**: RNT `modernc.org/sqlite` WAL + YAML v1 portable profiles is strictly local-first — harness must not expect network or cloud (see `KNOWN_ISSUES.md` 1.1).
- **Executable safety**: Only RNT and DoomLauncher explicitly guard against shell string construction (`os/exec.Command` / `ProcessStartInfo` args array); others use naive `QProcess` splitting — harness should fuzz special characters/spaces (Rocket's tokenizer bug).

*Determinism note*: All paths are relative to `references/` as enumerated; file citations are anchored to specific `read` snapshots. JSON copy is canonical for machines; this MD is human-readable summary.*

