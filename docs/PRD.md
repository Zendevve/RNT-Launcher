# DOOM MOD MANAGER

> **Product Requirements Document + Technical Specification + Implementation Plan**

| Specification Property | Detail |
|---|---|
| **Working Name** | RNT Launcher (Rip and Tear) |
| **Status** | MVP Specification |
| **Version** | 0.1.0 |
| **Platform** | Windows, Linux, macOS |
| **Primary Interface** | Desktop GUI |
| **Backend** | Go (1.23+) |
| **Desktop Framework** | Wails v2 |
| **Frontend** | React 18 + TypeScript 5 + Vite |
| **Database** | SQLite (`modernc.org/sqlite`) |
| **Profile Format** | YAML (`gopkg.in/yaml.v3`) |

---

## Table of Contents

<details>
<summary><strong>Click to expand full 133-section specification index</strong></summary>

- [1. Executive Summary](#1-executive-summary)
- [2. Product Vision](#2-product-vision)
- [3. Product Positioning](#3-product-positioning)
- [4. Problem Statement](#4-problem-statement)
- [5. Target Users](#5-target-users)
- [6. Product Principles](#6-product-principles)
- [7. Competitive Research](#7-competitive-research)
- [8. What to Fix](#8-what-to-fix)
- [9. What to Avoid](#9-what-to-avoid)
- [10. MVP Scope](#10-mvp-scope)
- [11. Explicitly Out of Scope](#11-explicitly-out-of-scope)
- [12. Application Information Architecture](#12-application-information-architecture)
- [13. Dashboard](#13-dashboard)
- [14. Library](#14-library)
- [15. Library Scanning](#15-library-scanning)
- [16. Drag and Drop](#16-drag-and-drop)
- [17. Mod Identity](#17-mod-identity)
- [18. Mod Inspector](#18-mod-inspector)
- [19. Archive Inspection](#19-archive-inspection)
- [20. WAD Inspection](#20-wad-inspection)
- [21. IWAD Manager](#21-iwad-manager)
- [22. Source-Port Manager](#22-source-port-manager)
- [23. Engine Abstraction](#23-engine-abstraction)
- [24. Profiles](#24-profiles)
- [25. Profile Editor](#25-profile-editor)
- [26. Load Order](#26-load-order)
- [27. Adding Mods](#27-adding-mods)
- [28. Launch Arguments](#28-launch-arguments)
- [29. Advanced Profile Options](#29-advanced-profile-options)
- [30. Launch Pipeline](#30-launch-pipeline)
- [31. Launch Security](#31-launch-security)
- [32. Example Launch](#32-example-launch)
- [33. Validation](#33-validation)
- [34. Validation Errors](#34-validation-errors)
- [35. Validation Rules](#35-validation-rules)
- [36. Compatibility Detection](#36-compatibility-detection)
- [37. Launch Confirmation](#37-launch-confirmation)
- [38. Process Monitoring](#38-process-monitoring)
- [39. Launch History](#39-launch-history)
- [40. Statistics](#40-statistics)
- [41. Favorites](#41-favorites)
- [42. Search](#42-search)
- [43. Filtering](#43-filtering)
- [44. File Ownership](#44-file-ownership)
- [45. Database](#45-database)
- [46. Why SQLite](#46-why-sqlite)
- [47. Hashing](#47-hashing)
- [48. Data Model](#48-data-model)
- [49. Application Services](#49-application-services)
- [50. Wails Boundary](#50-wails-boundary)
- [51. Frontend Architecture](#51-frontend-architecture)
- [52. Backend Architecture](#52-backend-architecture)
- [53. Domain Layer](#53-domain-layer)
- [54. Repository Layer](#54-repository-layer)
- [55. Async Operations](#55-async-operations)
- [56. UI Design](#56-ui-design)
- [57. Primary Layout](#57-primary-layout)
- [58. Profile UX Priority](#58-profile-ux-priority)
- [59. Keyboard Support](#59-keyboard-support)
- [60. Context Menus](#60-context-menus)
- [61. Notifications](#61-notifications)
- [62. Error UX](#62-error-ux)
- [63. Settings](#63-settings)
- [64. Automatic Scanning](#64-automatic-scanning)
- [65. Performance Requirements](#65-performance-requirements)
- [66. Cross-Platform](#66-cross-platform)
- [67. Security](#67-security)
- [68. Logging](#68-logging)
- [69. Profile Export](#69-profile-export)
- [70. Import](#70-import)
- [71. Missing Profile Content](#71-missing-profile-content)
- [72. Portable Profiles](#72-portable-profiles)
- [73. Duplicate Detection](#73-duplicate-detection)
- [74. Version Detection](#74-version-detection)
- [75. Future Engine Capabilities](#75-future-engine-capabilities)
- [76. Future Mod Metadata](#76-future-mod-metadata)
- [77. Mod Classification](#77-mod-classification)
- [78. Profile Templates](#78-profile-templates)
- [79. Mod Testing Workflow](#79-mod-testing-workflow)
- [80. Repository Structure](#80-repository-structure)
- [81. Technology Stack](#81-technology-stack)
- [82. Dependency Philosophy](#82-dependency-philosophy)
- [83. Testing Strategy](#83-testing-strategy)
- [84. Fake Launcher](#84-fake-launcher)
- [85. Test Fixtures](#85-test-fixtures)
- [86. Implementation Strategy](#86-implementation-strategy)
- [87. Phase 1 — Project Foundation](#87-phase-1-project-foundation)
- [88. Phase 2 — Domain](#88-phase-2-domain)
- [89. Phase 3 — Database](#89-phase-3-database)
- [90. Phase 4 — Scanner](#90-phase-4-scanner)
- [91. Phase 5 — File Inspection](#91-phase-5-file-inspection)
- [92. Phase 6 — Engine Manager](#92-phase-6-engine-manager)
- [93. Phase 7 — IWAD Manager](#93-phase-7-iwad-manager)
- [94. Phase 8 — Library](#94-phase-8-library)
- [95. Phase 9 — Profiles](#95-phase-9-profiles)
- [96. Phase 10 — Load Order](#96-phase-10-load-order)
- [97. Phase 11 — Validation](#97-phase-11-validation)
- [98. Phase 12 — Launcher](#98-phase-12-launcher)
- [99. Phase 13 — Dashboard](#99-phase-13-dashboard)
- [100. Phase 14 — Import/Export](#100-phase-14-importexport)
- [101. Phase 15 — Polish](#101-phase-15-polish)
- [102. MVP Milestones](#102-mvp-milestones)
- [103. End-to-End Acceptance Test](#103-end-to-end-acceptance-test)
- [104. Definition of Done](#104-definition-of-done)
- [105. Future Roadmap](#105-future-roadmap)
- [106. Future CLI](#106-future-cli)
- [107. AI Implementation Agent Prompt](#107-ai-implementation-agent-prompt)
- [108. Technology Requirements](#108-technology-requirements)
- [109. Interface Requirement](#109-interface-requirement)
- [110. Engineering Principles](#110-engineering-principles)
- [111. Architecture](#111-architecture)
- [112. Backend Structure](#112-backend-structure)
- [113. Frontend Structure](#113-frontend-structure)
- [114. Critical Architecture Rule](#114-critical-architecture-rule)
- [115. Launcher Safety](#115-launcher-safety)
- [116. MVP Development Order](#116-mvp-development-order)
- [117. Phase 1 Acceptance](#117-phase-1-acceptance)
- [118. Phase 2 Acceptance](#118-phase-2-acceptance)
- [119. Phase 3 Acceptance](#119-phase-3-acceptance)
- [120. Phase 4 Acceptance](#120-phase-4-acceptance)
- [121. Phase 5 Acceptance](#121-phase-5-acceptance)
- [122. Phase 6 Acceptance](#122-phase-6-acceptance)
- [123. Phase 7 Acceptance](#123-phase-7-acceptance)
- [124. Phase 8 Acceptance](#124-phase-8-acceptance)
- [125. Phase 9 Acceptance](#125-phase-9-acceptance)
- [126. Phase 10 Acceptance](#126-phase-10-acceptance)
- [127. Phase 11 Acceptance](#127-phase-11-acceptance)
- [128. Phase 12 Acceptance](#128-phase-12-acceptance)
- [129. Phase 13 Acceptance](#129-phase-13-acceptance)
- [130. Phase 14 Acceptance](#130-phase-14-acceptance)
- [131. Phase 15 Acceptance](#131-phase-15-acceptance)
- [132. Phase 16 Acceptance](#132-phase-16-acceptance)
- [133. Final MVP Requirement](#133-final-mvp-requirement)

</details>

---

## 1. Executive Summary

> **Beautifully simple. Designed from the very start to be as visually minimal and space efficient as possible. No cluttered interface. Fast and lightweight opens practically instantly, and switching is just as quick, all while having low memory and CPU usage. Fully-featured minimalism doesn't have to be a compromise. Configurable features a myriad of configurable preferences to ensure the best experience for as many people as possible. Supports all common formats.**

Build a modern, cross-platform desktop application for managing, organizing, configuring, validating, and launching Doom games and mods.

The application takes the strongest ideas from the existing Doom launcher ecosystem while avoiding the limitations and dated workflows found in older launchers.

The product combines:
- **DoomRunner**: profile/load-order workflow
- **ZDL / qZDL**: straightforward launching
- **YADL**: organization
- **Arachnotron**: profile-oriented architecture
- **DoomLauncher**: library and metadata concepts
- **RocketLauncher2**: source-port abstraction

The result does not feel like a bloated replacement for one specific launcher. It is a modern, lightweight, beautifully simple Doom mod management environment.
### Core Workflow

```text
Discover
   ↓
Organize
   ↓
Create Profile
   ↓
Configure
   ↓
Validate
   ↓
Play
```

### Core Architecture Principles
- **Local-first**: Everything necessary for normal use works offline.
- **No account required**: Zero registration or authentication.
- **No online service required**: Completely standalone operation.
- **No internet connection required** for normal use.

---

## 2. Product Vision

Create the definitive modern desktop tool for managing Doom installations, source ports, IWADs, mods, load orders, profiles, and launches.

A user should be able to have:
- 1,000+ mods
- 20 IWADs
- 10 source ports
- 50 profiles

without feeling like they're manually managing a giant collection of files.

The application should turn Doom's messy modding ecosystem into something understandable.

---

## 3. Product Positioning

Do not position the product as:
- *"A modern ZDL."*
- *"DoomRunner but better."*

Instead:
> **A modern Doom mod manager and launcher.**

The launcher is only one part of the product. The larger product is:

```text
Library + Profiles + Configuration + Validation + Launcher + History
```

---

## 4. Problem Statement

Doom's source-port ecosystem is incredibly flexible, but that flexibility creates friction.

Users commonly have:
- Multiple source ports
- Multiple versions of the same source port
- Dozens or hundreds of mods
- Different IWADs
- Different load orders
- Different launch arguments
- Test configurations
- Multiplayer configurations
- Separate mod combinations

Traditional launchers generally treat this as:

```text
Executable + IWAD + Files + Arguments
```

That works, but it doesn't scale particularly well. The application should instead represent the user's Doom setup as a **structured library**.

---

## 5. Target Users

### Primary Users
Doom players who:
- Use GZDoom or another source port
- Regularly play mods
- Maintain multiple configurations
- Switch between source ports
- Have large mod collections
- Want persistent profiles
- Want easy load-order management

### Secondary Users
Doom modders who need:
- Quick test configurations
- Multiple engine versions
- Rapid launch/relaunch
- Reproducible configurations
- Isolated profiles

### Power Users
Users who maintain:
- Large mod libraries
- Multiple Doom installations
- Many profiles
- Complex launch arguments
- Portable configurations

---

## 6. Product Principles

### 6.1 GUI First
The desktop application is the product. There is no CLI requirement for MVP.
The backend must remain UI-agnostic enough that a CLI could be added later without rewriting business logic. Do not spend MVP development time maintaining two interfaces.

### 6.2 Local First
Everything necessary for normal use works offline. The application must not require:
- Accounts
- Servers
- Cloud storage
- Internet access
- Online APIs

### 6.3 Files Remain Files
Do not force users into a proprietary content-management system. If a user has `D:\Doom\Mods\brutal-doom.pk3`, the application should be able to reference that file directly. Do not silently move or copy files.

### 6.4 Profiles Are First-Class
A profile represents a complete playable configuration.

**Example:**
- **Profile**: Brutal Doom
- **Engine**: GZDoom 4.14.3
- **IWAD**: `DOOM2.WAD`
- **Mods**:
  1. Brutal Doom
  2. Nashgore
  3. Beautiful Doom
- **Arguments**: `-skill 4`

### 6.5 Progressive Disclosure
Beginners should see:
- Engine
- IWAD
- Mods
- **PLAY**

Advanced users can access:
- Launch Arguments
- Working Directory
- Environment Variables
- Save Directory
- Advanced Engine Options

Do not expose every possible configuration option immediately.

### 6.6 Don't Pretend to Understand What We Don't
If the application can't confidently determine:
- Compatibility
- Dependency
- Conflict
- Version
- Engine requirement

It should say **Unknown** rather than making a guess.

### 6.7 Visual Minimalism & Zero Clutter
The interface must remain clean, space-efficient, and free from extraneous widgets, promotional banners, or bloated whitespace. Density modes (`Compact` default vs `Comfortable`) allow users to tailor viewport efficiency.

### 6.8 Deep Configurability & Format Coverage
Full compatibility across all common Doom formats (`.wad`, `.pk3`, `.pk7`, `.ipk3`, `.zip`, `.deh`, `.bex`) with user-configurable format visibility and display options.

## 7. Competitive Research

The application was designed after reviewing:
- DoomRunner
- YADL
- Arachnotron
- ZDL-3
- qZDL
- DoomLauncher
- RocketLauncher2

### What to Take

#### DoomRunner
- Profiles
- Load ordering
- Enable/disable toggles
- Multiple launch configurations
- Quick launching

#### YADL
- Organization
- Categories
- Playlists
- Library thinking

#### Arachnotron
- Profile-oriented configuration
- Portable configuration concepts
- Relative-path thinking

#### ZDL / qZDL
- Simplicity
- Explicit engine / IWAD / mod configuration
- Direct launch workflow

#### DoomLauncher
- Persistent content library
- Metadata
- Play history
- Tags
- Screenshots (future feature)

#### RocketLauncher2
- Source-port abstraction
- Multiple engine versions
- Engine configuration

---

## 8. What to Fix

### File-Centric Workflows
Don't force users to think primarily in filenames. Prefer **Brutal Doom** over `brutalv21.pk3`, but always make the actual filename and path accessible.

### Configuration Overload
Don't show dozens of fields immediately. Use progressive disclosure:
- **Basic**
- **Advanced**

### Poor Validation
A launcher shouldn't discover that something is broken only after the process fails. Validate first.

### Fragmented Content
A mod should be represented as a persistent library object. The same mod appearing in five profiles should still refer to the same underlying library object.

### Portability
Profiles should be exportable and importable.

---

## 9. What to Avoid

Do not blindly reproduce:
- Giant configuration dialogs
- Excessive engine-specific settings
- File-only interfaces
- Unnecessary setup steps
- Mandatory file imports
- Online services in MVP
- Automatic mod downloads
- Accounts
- Social features
- Mod marketplaces
- Unnecessary animations
- "AI SaaS" visual design

---

## 10. MVP Scope

### Library
- Mod discovery
- Mod scanning
- Mod import
- Drag and drop
- Search
- Basic filtering
- Favorites
- File inspection
- Archive inspection
- Basic metadata

### IWADs
- Discovery
- Registration
- Inspection
- Management

### Source Ports
- Registration
- Executable selection
- Version detection
- Management

### Profiles
- Create
- Rename
- Delete
- Duplicate
- Import
- Export
- Engine selection
- IWAD selection
- Mod selection
- Enable/disable
- Load order
- Arguments

### Validation
- Missing engine
- Missing IWAD
- Missing mods
- Invalid paths
- Duplicate entries
- Basic file validation

### Launcher
- Launch
- Process monitoring
- Exit handling
- Launch history

### UI
- Dashboard
- Library
- Profiles
- Engines
- IWADs
- History
- Settings
- Mod inspector
- Validation interface

---

## 11. Explicitly Out of Scope

Do **NOT** implement during MVP:
- CLI (command-line interface)
- Online mod downloads
- idgames integration
- Doomworld integration
- GitHub update detection
- Automatic dependency resolution
- Automatic conflict resolution
- Full ZScript parsing
- Full DECORATE parsing
- Mod hosting
- User accounts
- Cloud synchronization
- Multiplayer matchmaking
- Mod ratings
- Social features
- Built-in browser
- Steam Workshop integration
- Automatic Doom installation
- Automatic source-port installation
- DOSBox management
- Mod marketplace

*(These can be considered in future releases.)*

---

## 12. Application Information Architecture

### Primary Navigation
- **Dashboard**
- **Library**
- **Profiles**
- **Engines**
- **IWADs**
- **History**

---
- **Settings**

---

## 13. Dashboard

The dashboard should prioritize launching.

```text
┌─────────────────────────────────────────────────────────────┐
│ DOOM MOD MANAGER                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ RECENT PROFILES                                             │
│                                                             │
│ ┌──────────────────┐ ┌──────────────────┐ ┌───────────────┐ │
│ │ Brutal Doom      │ │ Eviternity       │ │ Vanilla       │ │
│ │                  │ │                  │ │               │ │
│ │ GZDoom           │ │ GZDoom           │ │ DSDA-Doom     │ │
│ │ DOOM2            │ │ DOOM2            │ │ DOOM2         │ │
│ │                  │ │                  │ │               │ │
│ │ [ PLAY ]         │ │ [ PLAY ]         │ │ [ PLAY ]      │ │
│ └──────────────────┘ └──────────────────┘ └───────────────┘ │
│                                                             │
│ LIBRARY                                                     │
│ 247 Mods     12 IWADs     6 Engines                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The dashboard should not become a statistics dashboard. Its primary purpose is:
> **Get me into Doom quickly.**

---

## 14. Library

The library contains all discovered Doom-related content.

### Categories
- All
- Mods
- Maps
- Megawads
- Gameplay
- Weapons
- Monsters
- Textures
- Audio
- UI
- Other
- Unknown

*Categories should behave as tags rather than exclusive classifications.*

---

## 15. Library Scanning

Users configure scan directories:
- **Mods**: `D:\Doom\Mods`
- **IWADs**: `D:\Doom\IWADs`
- **Engines**: `D:\Doom\Ports`

The scanner recursively searches configured locations.

### Recognized Formats
- `.wad`
- `.pk3`
- `.pk7`
- `.ipk3`
- `.zip`
- `.deh`
- `.bex`

*Note: The application must not assume that every `.zip` is a Doom mod.*

---

## 16. Drag and Drop

Drag-and-drop is a core workflow. A user can drag `brutal-doom.pk3` into the library.

### Ingestion Flow
1. Detects the file.
2. Checks readability.
3. Identifies the format.
4. Inspects it.
5. Adds it to the library.
6. Shows metadata.
7. Optionally adds it to the active profile.

**Default behavior:** Reference the existing file in place. Do **not** silently copy it.

---

## 17. Mod Identity

Separate **Mod** from **File**.

```text
Mod
├── Identity
├── Metadata
└── Files
```

**Example:**
- **Mod**: Brutal Doom
- **Version**: 21.66b
- **File**: `brutalv21.pk3`

MVP can initially derive the name from the filename. More sophisticated identification is future scope.

---

## 18. Mod Inspector

Selecting a mod opens an inspector drawer.

### Example Inspection View
```text
BRUTAL DOOM
Gameplay Mod · GZDoom

Version:   21.66b
File:      brutalv21.pk3
Size:      142 MB
Location:  D:\Doom\Modsrutalv21.pk3

Archive Contents: 183 files
```

#### Detected Structures
- [x] `ZSCRIPT`
- [x] `DECORATE`
- [x] `MAPINFO`
- [x] `TEXTURES`
- [x] `SNDINFO`

#### Available Actions
- **Open File**
- **Open Folder**
- **Add to Profile**
- **Favorite**
- **Remove from Library**

---

## 19. Archive Inspection

For container formats (`PK3`, `PK7`, `IPK3`, `ZIP`), inspect archive contents without extracting.

### Detect Common Structures
- `ZSCRIPT`
- `MAPINFO`
- `GAMEINFO`
- `DECORATE`
- `SNDINFO`
- `TEXTURES`
- `HIRES`
- `MAP01`, `MAP02`, `E1M1`

*MVP should only perform structural inspection. It should not attempt to understand the entire mod.*

---

## 20. WAD Inspection

Read WAD headers directly from disk:
- Recognize **IWAD** vs **PWAD** markers.
- Extract lump counts.
- Use lump counts for basic validation.

*Do not implement a full WAD editor.*

---

## 21. IWAD Manager

Display discovered IWADs.

### Example IWAD Registry
- **DOOM**: `DOOM.WAD` (Ultimate Doom)
- **DOOM II**: `DOOM2.WAD` (Doom II: Hell on Earth)
- **TNT**: `TNT.WAD` (TNT: Evilution)
- **PLUTONIA**: `PLUTONIA.WAD` (The Plutonia Experiment)

### Actions
- Add
- Edit
- Remove
- Inspect
- Open Folder

---

## 22. Source-Port Manager

Source ports are first-class objects.

### Example Registered Engines
- **GZDoom Stable**: `4.14.3`
- **GZDoom Development**: `4.15.0pre`
- **DSDA-Doom**: `0.27.5`
- **Woof!**: `14.1.0`
- **UZDoom**

### Engine Attributes
Each engine contains:
- `ID`
- `Name`
- `Executable`
- `Version`
- `Family`

*If version detection fails, display `Version: Unknown` while keeping the engine fully usable.*

---

## 23. Engine Abstraction

Do not hardcode GZDoom.

```go
type Engine struct {
    ID         string
    Name       string
    Executable string
    Version    string
    Family     string
}
```

Future engine adapters can provide:
- Argument conventions
- Capabilities
- Version detection
- Save paths
- Engine-specific features

---

## 24. Profiles

A profile represents one complete playable configuration.

### Example: Brutal Doom Profile
- **Engine**: GZDoom Stable
- **IWAD**: `DOOM2.WAD`
- **Mods**:
  1. `01` Brutal Doom
  2. `02` Nashgore
  3. `03` Beautiful Doom
  4. `04` Maps of Chaos
- **Arguments**: `-skill 4`

### Profile Actions
- Launch
- Edit
- Duplicate
- Export
- Delete

---

## 25. Profile Editor

The profile editor is the most important screen in the application.

```text
┌──────────────────────────────────────────────────────────────┐
│ BRUTAL DOOM                                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ENGINE                                                       │
│ GZDoom Stable                                                │
│                                                              │
│ IWAD                                                         │
│ DOOM2.WAD                                                    │
│                                                              │
│ MODS                                                         │
│                                                              │
│ ☑ Brutal Doom                                                │
│ ☑ Nashgore                                                   │
│ ☑ Beautiful Doom                                             │
│ ☑ Maps of Chaos                                              │
│ ☐ Experimental Mod                                           │
│                                                              │
│ Drag to reorder                                              │
│                                                              │
│ Advanced                                                     │
│                                                              │
│                         [ VALIDATE ]  [ PLAY ]               │
└──────────────────────────────────────────────────────────────┘
```

*The user should never have to hunt for the PLAY button.*

---

## 26. Load Order

Mods have an explicit load order. Users can:
- Drag to reorder
- Move up
- Move down
- Move to top
- Move to bottom
- Enable
- Disable
- Remove

### Example Order State
- `01` [x] Brutal Doom
- `02` [x] Beautiful Doom
- `03` [ ] Experimental Mod *(disabled)*
- `04` [x] Nashgore

*Disabled mods remain visible in the load order.*

---

## 27. Adding Mods

The profile editor provides `+ Add Mod`, opening a library selector modal.
- The user searches (e.g. `brutal`) and selects matching mods.
- Multiple mods can be selected and added in a single interaction.

---

## 28. Launch Arguments

Internally store arguments as structured arrays:

```go
Arguments []string
```

**Example Data:**
```json
[
    "-skill",
    "4",
    "-warp",
    "MAP01"
]
```

*Do not store only one raw shell command string. This prevents quoting and escaping bugs.*

---

## 29. Advanced Profile Options

MVP must support:
- Launch Arguments
- Working Directory

### Future Options
- Environment Variables
- Custom Save Directory
- Demo Directory
- Screenshot Directory
- Engine-specific options

*Do not expose these until necessary (Progressive Disclosure).*

---

## 30. Launch Pipeline

Launching must follow a strict sequential pipeline:

```text
Profile
   ↓
Resolve Engine
   ↓
Resolve IWAD
   ↓
Resolve Mods
   ↓
Validate
   ↓
Build Arguments
   ↓
Start Process
   ↓
Monitor
   ↓
Record History
```

---

## 31. Launch Security

Never construct a shell command string.

Use structured process invocation:
```go
exec.Command(executable, args...)
```

**Forbidden for normal launching:**
- `sh -c`
- `cmd /c`
- `powershell -Command`

*Treat paths, filenames, and mod metadata as untrusted input.*

---

## 32. Example Launch

### Argument Construction Concept
```text
gzdoom -iwad D:\Doom\DOOM2.WAD -file D:\Doom\Modsrutal-doom.pk3 D:\Doom\Mods
ashgore.pk3 -skill 4
```

The backend constructs this as structured argument slices without shell interpolation.

---

## 33. Validation

Before launching, pre-flight checks verify the configuration:

### Pre-Flight Check Output
```text
VALIDATION
✓ Engine found
✓ IWAD found
✓ 4 mods found
✓ All paths valid

Warnings:
⚠ Experimental Mod is disabled

Status: READY
```

---

## 34. Validation Errors

When a launch is blocked, clearly explain what needs fixing:

```text
CANNOT LAUNCH
✕ GZDoom executable not found
✕ DOOM2.WAD missing
✕ brutal-doom.pk3 missing
```

*The application must explain exactly what needs fixing with direct navigation to the missing resource.*

---

## 35. Validation Rules

### Errors (Blocking)
- Missing engine
- Missing executable
- Missing IWAD
- Missing mod
- Invalid path
- Invalid profile
- Invalid file

### Warnings (Non-Blocking)
- Disabled mod
- Duplicate entry
- Duplicate file
- Unknown format
- Missing working directory

### Information
- Engine version
- IWAD type
- Mod count
- Archive structures

---

## 36. Compatibility Detection

MVP must **NOT** pretend to provide complete compatibility analysis.

Do not automatically claim *"Mod A conflicts with Mod B"* unless there is a reliable rule explicitly supporting that conclusion.

### Future Compatibility Engine
- `requires`
- `conflicts`
- `load-before`
- `load-after`
- `engine-min-version`
- `engine-max-version`

---

## 37. Launch Confirmation

### Successful Validation: Ready to Play
```text
READY TO PLAY
Profile: Brutal Doom
Engine:  GZDoom 4.14.3
IWAD:    DOOM2.WAD
Mods:    4 enabled

[ PLAY ]
```

### Validation Warnings: Ready with Warnings
```text
READY WITH WARNINGS
2 warnings found.

[ VIEW WARNINGS ]  [ PLAY ANYWAY ]
```

### Validation Errors: Cannot Launch
```text
CANNOT LAUNCH
2 errors must be fixed.

[ VIEW ERRORS ]
```

---

## 38. Process Monitoring

When Doom is running, track:
- Running status
- Profile
- Engine
- Start time
- Elapsed time

*Do not embed Doom inside the UI window; Doom remains an independent external process.*

---

## 39. Launch History

Store recent launches (MVP target: last 50 launches).

### Record Attributes
- Timestamp
- Profile
- Engine
- IWAD
- Started time
- Finished time
- Exit code
- Duration

### Example History Feed
- **Brutal Doom** · GZDoom · Today 18:32 · *32 minutes*
- **Eviternity** · DSDA-Doom · Today 15:10 · *47 minutes*

---

## 40. Statistics

### MVP Statistics
- Total launches
- Total play time
- Last played timestamp

*Do not build an elaborate analytics system. Per-profile stats, map completion, deaths, and achievements are deferred.*

---

## 41. Favorites

Users can favorite:
- Mods
- Profiles

Favorites must be directly filterable and accessible from:
- Dashboard
- Library
- Profiles

---

## 42. Search

### Library Search
Search library items instantly across:
- Name
- Filename
- Path
- Tags

### Profile Search
Search profiles across:
- Name
- Mod titles
- Engine name
- IWAD name

*Search response time must feel instant (<100ms).*

---

## 43. Filtering

### MVP Filters
- Type (Gameplay, Maps, Megawads, Weapons, etc.)
- Format (`.wad`, `.pk3`, `.zip`, etc.)
- Favorites toggle

### Future Filters
- Target Engine
- User Tags
- Recently Added
- Recently Played

---

## 44. File Ownership

The application should not assume ownership of user files.

- **Default behavior**: Register existing file in place by path.
- **Optional future feature**: Copy to Managed Library.
- **Rule**: Never silently relocate or delete content.

---

## 45. Database

Use **SQLite** (pure Go / cgo-free).

SQLite stores application state:
- `mods`
- `mod_files`
- `mod_metadata`
- `engines`
- `iwads`
- `profiles`
- `profile_mods`
- `tags`
- `mod_tags`
- `profile_tags`
- `launch_history`
- `settings`

---

## 46. Why SQLite

A large Doom collection may contain thousands of files. Repeated filesystem scans are expensive and unnecessary.

### Data Flow
```text
Filesystem
    ↓
Scanner
    ↓
SQLite
    ↓
Application UI
```

### Cached File Properties
- Path
- Modification time (`mtime`)
- File size
- SHA-256 hash
- Extracted metadata

---

## 47. Hashing

Use **SHA-256** checksums where useful:
- Duplicate detection
- Mod identity verification
- Future metadata matching

*Rule: Do not hash files synchronously on the UI thread. Hash lazily or in background workers.*

---

## 48. Data Model

```go
type Mod struct {
    ID         string
    Name       string
    Path       string
    Format     ModFormat
    Size       int64
    ModifiedAt time.Time
    SHA256     string
}

type Engine struct {
    ID         string
    Name       string
    Executable string
    Version    string
    Family     string
}

type IWAD struct {
    ID        string
    Name      string
    Path      string
    Type      string
    LumpCount int
}

type Profile struct {
    ID         string
    Name       string
    EngineID   string
    IWADID     string
    Mods       []ProfileMod
    Arguments  []string
    WorkingDir string
}

type ProfileMod struct {
    ModID   string
    Path    string
    Enabled bool
    Order   int
}
```

*(Exact structure may evolve with project needs.)*

---

## 49. Application Services

Encapsulate domain operations in services:
- `ModService`
- `ProfileService`
- `EngineService`
- `IWADService`
- `ScannerService`
- `ValidatorService`
- `LauncherService`
- `HistoryService`

### Service Interface Examples
```go
// Mods
ListMods(filter ModFilter) ([]Mod, error)
GetMod(id string) (Mod, error)
CreateMod(mod Mod) error
RemoveMod(id string) error
ScanMods() (ScanResult, error)

// Profiles
ListProfiles() ([]Profile, error)
CreateProfile(p Profile) error
UpdateProfile(p Profile) error
DeleteProfile(id string) error
CloneProfile(id string) (Profile, error)

// Profile Mod Ordering
AddModToProfile(profileID, modID string) error
RemoveModFromProfile(profileID, modID string) error
ReorderProfileMods(profileID string, modIDs []string) error

// Validation & Launching
ValidateProfile(id string) ([]ValidationResult, error)
LaunchProfile(id string) error

// History
ListLaunchHistory(limit int) ([]LaunchRecord, error)
```

---

## 50. Wails Boundary

Expose application functionality to the frontend through the Wails binding layer:

```go
func (a *App) ListProfiles() ([]Profile, error)
func (a *App) GetProfile(id string) (Profile, error)
func (a *App) CreateProfile(input CreateProfileInput) (Profile, error)
func (a *App) UpdateProfile(input UpdateProfileInput) error
func (a *App) DeleteProfile(id string) error

func (a *App) ListMods(filter ModFilter) ([]Mod, error)
func (a *App) ScanMods() (ScanResult, error)

func (a *App) ListEngines() ([]Engine, error)
func (a *App) ListIWADs() ([]IWAD, error)

func (a *App) ValidateProfile(id string) ([]ValidationResult, error)
func (a *App) LaunchProfile(id string) error
```

*Rule: React components must never access repositories or SQLite directly.*

---

## 51. Frontend Architecture

### Technology Stack
- React
- TypeScript
- Vite
- TanStack Query

### Recommended Directory Structure
```text
frontend/
└── src/
    ├── app/
    ├── components/
    ├── features/
    │   ├── dashboard/
    │   ├── library/
    │   ├── profiles/
    │   ├── engines/
    │   ├── iwads/
    │   └── history/
    ├── hooks/
    ├── lib/
    ├── types/
    └── styles/
```

*Avoid monolithic components; divide logic into domain features.*

---

## 52. Backend Architecture

```text
backend/
├── cmd/
├── internal/
│   ├── app/
│   ├── domain/
│   ├── database/
│   ├── filesystem/
│   ├── scanner/
│   ├── mods/
│   ├── iwads/
│   ├── engines/
│   ├── profiles/
│   ├── launcher/
│   ├── validator/
│   └── history/
└── migrations/
```

---

## 53. Domain Layer

The domain layer must remain independent of Wails and React:
- Entities
- Value objects
- Validation rules
- Domain logic

*Rule: Zero UI imports in domain code.*

---

## 54. Repository Layer

Repositories encapsulate all SQLite database operations:
- `ModRepository`
- `ProfileRepository`
- `EngineRepository`
- `IWADRepository`
- `HistoryRepository`

*Services should depend on interfaces rather than concrete SQL implementations.*

---

## 55. Async Operations

Scanning and hashing must never freeze the UI. Emit asynchronous Wails events for long operations:

### Event Types
- `scan:start`
- `scan:progress`
- `scan:complete`
- `launch:start`
- `launch:exit`

### Progress Example
```text
Scanning Doom library...
[██████████████████░░░░] 76% (143 / 187 files)
```

---

## 56. UI Design & Density Modes

The application should feel like a serious, professional desktop utility:
- **Dense information presentation**: Maximize screen real-estate with purposeful data placement.
- **UI Density Modes**: `Compact` (Recommended default) for maximum viewport data efficiency; `Comfortable` for relaxed touch/large screen viewing.
- **Minimal Path Disclosure**: Mod listings feature clean names by default, hiding long absolute paths unless toggled or viewed inside the inspector drawer.
- **Clear visual hierarchy**: Primary play actions stand out; secondary options reveal progressively.
- **Keyboard-friendly navigation**: Full shortcut support (`Ctrl+K`, `Ctrl+Enter`, `Ctrl+S`).
- **Fast, snappy rendering**: Instant sub-second navigation between views without layout shifts.
- **Dark mode default**: Industrial dark slate palette with vibrant crimson accents.
- **Restrained visual styling**: Purposeful borders, subtle elevation, zero fluff.

### Anti-Patterns to Avoid
- Giant decorative cards
- Excessive gradients
- Gratuitous animations
- Fake dashboards
- Web-app-like exaggerated whitespace
---

## 57. Primary Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ DOOM MOD MANAGER                              Search   ⚙   │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│ Dashboard    │                                              │
│ Library      │                 CONTENT AREA                 │
│ Profiles     │                                              │
│ Engines      │                                              │
│ IWADs        │                                              │
│ History      │                                              │
│              │                                              │
│              │                                              │
│              │                                              │
├──────────────┴──────────────────────────────────────────────┤
│ Status / Notifications                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 58. Profile UX Priority

The profile editor must immediately answer:
1. What am I launching?
2. Which engine?
3. Which IWAD?
4. Which mods?
5. What is their load order?
6. Can I launch right now?

*Everything else is secondary.*

---

## 59. Keyboard Support

Desktop power users must be able to operate the manager via shortcuts:

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Open Search modal |
| `Ctrl+Enter` | Launch active profile |
| `Ctrl+S` | Save active profile |
| `Ctrl+Shift+S` | Export profile to YAML |
| `Delete` | Remove selected item |
| `Esc` | Close active dialog / drawer |
| `↑` / `↓` | Navigate load order list |
| `Ctrl+↑` | Move selected mod to top |
| `Ctrl+↓` | Move selected mod to bottom |
| `Space` | Toggle mod enabled / disabled |

---

## 60. Context Menus

### Mod Context Menu
- Add to Profile
- Inspect
- Open File
- Open Containing Folder
- Favorite / Unfavorite
- Remove from Library

### Profile Context Menu
- Launch
- Edit
- Duplicate
- Export (YAML)
- Delete

---

## 61. Notifications

Use non-intrusive toast notifications for:
- Profile saved
- Mod added
- Scan completed
- Launch started
- Launch failed

*Rule: Do not interrupt the user with modal dialogs for routine operations.*

---

## 62. Error UX

Do not present raw technical stack traces to users as primary text.

**Bad:**
```text
exec: "C:\Games\gzdoom.exe": file not found
```

**Good:**
```text
GZDoom couldn't be launched.
The configured executable doesn't exist:
C:\Games\gzdoom.exe

[ OPEN ENGINE SETTINGS ]
```

*Technical error details remain viewable in an expandable drawer but aren't the primary UX.*

---

## 63. Settings Specifications

### Interface & Density
- **UI Density Mode**: `Compact` (default) vs `Comfortable`.
- **Default Initial View**: Configurable starting view (`Dashboard`, `Profiles`, `Library`, `IWADs`, `Engines`, `History`, `Diagnostics`, `Settings`).
- **Mod Path Display**: Toggle to show full absolute file paths in mod cards and tables.
- **Dashboard Recent Launches Limit**: Configurable recent sessions count (0 to hide section completely, 1–10).
- **Mod Format Visibility**: Multi-select filtering enabling/disabling visibility for `.wad`, `.pk3`, `.pk7`, `.ipk3`, `.zip`, `.deh`, and `.bex`.

### General & Launching
- Theme selection (`doom-dark` default)
- Confirm launch toggle (pre-flight status modal prior to process creation)
- Automatic scan on startup
- Minimize or close launcher upon game launch
- Default working directory override

### Directory Management
- Mod scan directories (`.wad`, `.pk3`, `.pk7`, `.ipk3`, `.zip`, `.deh`, `.bex`)
- IWAD scan directories
- Engine & source port scan directories

### Diagnostics & Storage
- Pure-Go SQLite database persistence
- Manual force re-scan trigger
- Restore factory default configuration
---

## 64. Automatic Scanning

### MVP Implementation
- Manual on-demand scanning
- Optional startup scan
- Automatic scan after adding or modifying directories

### Future Enhancements
- OS filesystem watcher (`fsnotify` / `ReadDirectoryChangesW`)
- Incremental background indexing

---

## 65. Performance Requirements

### Target Collection Capacity
- 1,000 mods
- 100 IWADs
- 20 source ports / engines
- 100 profiles

### Latency Targets
- UI remains responsive at 60fps
- Library search: `<100ms`
- Profile switching / load: `<100ms`
- Pre-flight validation: `<500ms`
- Background scanning and hashing never stutter the UI

---

## 66. Cross-Platform

Support:
- **Windows 10+**
- **Linux** (X11 / Wayland)
- **macOS** (Apple Silicon + Intel)

*Use platform-appropriate paths for data, database, config, and logs (`os.UserConfigDir`). Never hardcode Windows-specific path separators.*

---

## 67. Security

- **Rule**: Never execute shell commands constructed from string concatenation.
- Always use direct process execution with discrete argument vectors.
- Treat file paths, archive entries, lump names, and imported YAML files as untrusted input.
- Do not automatically extract arbitrary compressed archives in MVP.

---

## 68. Logging

Use Go standard library structured logging (`log/slog`):
- Log scanner warnings and errors
- Log database transaction failures
- Log process launch failures
- Log YAML profile import/export parsing errors

*Rule: Do not flood logs with normal high-frequency user interactions.*

---

## 69. Profile Export

Profiles must be portable and human-readable using **YAML**:

```yaml
version: 1

profile:
  id: brutal-doom
  name: Brutal Doom

  engine:
    id: gzdoom

  iwad:
    id: doom2

  mods:
    - id: brutal-doom
      enabled: true
      order: 1

    - id: nashgore
      enabled: true
      order: 2

  arguments:
    - "-skill"
    - "4"
```

*Rule: Never bundle copyrighted commercial IWADs automatically.*

---

## 70. Import

### Import Pipeline
```text
YAML File
   ↓
Parse
   ↓
Schema Validation
   ↓
Resolve Engine
   ↓
Resolve IWAD
   ↓
Resolve Mods
   ↓
Report Missing Content
   ↓
Persist Profile
```

*Missing content should not prevent importing; allow importing with warnings.*

---

## 71. Missing Profile Content

When importing a profile with unresolved resources:

```text
IMPORT PROFILE: Brutal Doom

✓ Engine found (GZDoom)
✓ IWAD found (DOOM2.WAD)
✓ Brutal Doom found
✕ Nashgore missing

[ IMPORT ANYWAY ]  [ CANCEL ]
```

*Imported profiles can be saved with unresolved references marked as warnings.*

---

## 72. Portable Profiles

### Future Modpack Structure
```text
profile/
├── profile.yaml
├── mods/
├── saves/
└── screenshots/
```

*MVP does not automatically bundle assets; references existing files by path.*

---

## 73. Duplicate Detection

- Detect duplicate paths immediately during registration.
- Use SHA-256 hashes to detect identical files residing at different paths.
- **Safety**: Never automatically delete files from disk.

---

## 74. Version Detection

Engine versions should be automatically detected by querying executables (`--version`, `-v`). If version detection fails or is unsupported:
- Set `Version: Unknown`
- Keep the engine fully selectable and launchable

---

## 75. Future Engine Capabilities

Design engine abstractions to support future capability flags:
- Supports PK3
- Supports PK7
- Supports ZScript
- Supports Multiplayer
- Supports Demo recording
- Supports Map Warp (`-warp`)

---

## 76. Future Mod Metadata

Future metadata extractors can discover:
- Maps and Episodes
- Map Slot numbers
- Required IWADs
- Required Engine / Source Port
- Supported Game Modes (Singleplayer, Co-op, Deathmatch)

*Rule: Only display metadata that can be reliably determined.*

---

## 77. Mod Classification

### Initial Categories
- Gameplay
- Map
- Megawad
- Total Conversion
- Weapon
- Monster
- Texture
- Audio
- UI
- Utility
- Other
- Unknown

*Users will be able to customize categories via user-defined tags in v0.2.*

---

## 78. Profile Templates

Future releases will provide starter templates:
- Empty Profile
- Vanilla Doom
- Modern GZDoom
- Multiplayer Client
- Modder Testing Rig

*MVP starts with a clean empty profile creator.*

---

## 79. Mod Testing Workflow

Modders require rapid test iterations:

```text
TESTING PROFILE
Engine: GZDoom Development
IWAD:   DOOM2.WAD
Mods:   test.pk3
```

The user can iterate on mod code in an external editor, then press `Ctrl+Enter` to launch immediately. This turnaround loop must be sub-second.

---

## 80. Repository Structure

```text
doom-mod-manager/
├── backend/
│   ├── cmd/
│   ├── internal/
│   │   ├── app/
│   │   ├── domain/
│   │   ├── database/
│   │   ├── filesystem/
│   │   ├── scanner/
│   │   ├── mods/
│   │   ├── iwads/
│   │   ├── engines/
│   │   ├── profiles/
│   │   ├── launcher/
│   │   ├── validator/
│   │   └── history/
│   └── migrations/
│
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── features/
│       │   ├── dashboard/
│       │   ├── library/
│       │   ├── profiles/
│       │   ├── engines/
│       │   ├── iwads/
│       │   └── history/
│       ├── hooks/
│       ├── lib/
│       ├── types/
│       └── styles/
│
├── docs/
├── build/
├── wails.json
├── README.md
└── LICENSE
```

---

## 81. Technology Stack

### Backend
- **Go 1.23+**: Robust system programming with standard library concurrency.
- **Wails v2**: Lightweight webview desktop application framework.
- **SQLite**: Pure Go cgo-free embedded database engine (`modernc.org/sqlite`).
- **YAML**: `gopkg.in/yaml.v3` for human-readable profile serialization.
- **Structured Logging**: `log/slog` standard library.

### Frontend
- **React 18**: Component-driven declarative UI.
- **TypeScript 5**: Strict type safety across bridge boundaries.
- **Vite**: Rapid HMR and bundling.
- **TanStack Query**: Data synchronization, caching, and state management.

---

## 82. Dependency Philosophy

Prefer:
```text
Go standard library + small focused dependencies
```

- Avoid massive abstraction frameworks.
- Every external dependency must have a clear, justified architectural purpose.

---

## 83. Testing Strategy

### Unit Tests
Validate individual algorithms and domain services:
- WAD header detection and lump counts
- Archive marker and structural detection
- Path resolution and validation logic
- Profile validation rule outcomes
- Profile YAML serialization / deserialization
- Launch argument vector generation
- Database repository CRUD operations

### Integration Tests
Validate cross-layer execution:
- Filesystem scanning into SQLite persistence
- Profile creation and modification lifecycles
- Pre-flight validation and aggregate status calculation
- End-to-end launch command construction

### Frontend Tests
Verify critical UI user interactions:
- `ProfileEditor` interactions
- `LoadOrderList` drag-and-drop / keyboard reordering
- `LibrarySearch` debouncing and filtering
- `ValidationBanner` error and warning rendering

*Rule: Test observable contracts and failure modes rather than vanity coverage metrics.*

---

## 84. Fake Launcher

Do not require GZDoom or physical game engines in automated CI:
- Provide a mock executable / test launcher process.
- Verify:
  - Executable path
  - Argument vectors and correct flag order
  - Base IWAD assignment (`-iwad`)
  - Mod file paths (`-file`)
  - Custom user arguments
  - Configured working directory

---

## 85. Test Fixtures

Store minimal, deterministic test fixtures:

```text
testdata/
├── valid_iwad.wad
├── valid_pwad.wad
├── invalid.wad
├── sample.pk3
├── sample.pk7
└── malformed.zip
```

*Fixtures should be tiny (bytes to kilobytes) to avoid repository bloat.*

---

## 86. Implementation Strategy

- Do not attempt to build every feature independently in silos.
- Build vertical, functional slices.
- Each phase must produce a verifiable, working increment.

---

## 87. Phase 1 — Project Foundation

### Deliverables
- Scaffold Go backend, Wails v2 desktop shell, Vite + React + TypeScript frontend.
- Seed SQLite integration with embedded migrations.
- Set up CI, linting, and automated test runners.

### Acceptance Criteria
```bash
go test ./...
go vet ./...
go build ./...
```
The desktop application opens successfully to a rendered shell.

---

## 88. Phase 2 — Domain

### Deliverables
Define canonical Go domain models:
- `Mod`
- `ModFile`
- `Engine`
- `IWAD`
- `Profile`
- `ProfileMod`
- `LaunchRecord`
- `ValidationResult`

### Acceptance Criteria
Domain entity constructors, invariants, and validation logic covered with unit tests.

---

## 89. Phase 3 — Database

### Deliverables
- Implement SQLite schema migrations.
- Build repository interfaces and implementations.
- Enforce transactional integrity.

### Acceptance Criteria
- CRUD verification for Mods: Create, Read, Update, Delete.
- CRUD verification for Profiles: Create, Read, Update, Delete.
- Profile Mod management: Attach mods, reorder load order.

---

## 90. Phase 4 — Scanner

### Deliverables
- Implement `ModScanner`, `IWADScanner`, and `EngineScanner`.
- Recursively scan configured directory paths.
- Persist discovered files directly into SQLite.

### Acceptance Criteria
Scanning completes asynchronously in background routines without blocking UI rendering.

---

## 91. Phase 5 — File Inspection

### Deliverables
- WAD header detection: Validate `IWAD` / `PWAD` magic markers and lump counts.
- Container archive inspection: Inspect `ZIP`, `PK3`, `PK7`, and `IPK3` files.
- Structural marker discovery: Identify `ZSCRIPT`, `DECORATE`, `MAPINFO`, `SNDINFO`, `TEXTURES`.

### Acceptance Criteria
All inspection modules pass against deterministic `testdata` fixtures.

---

## 92. Phase 6 — Engine Manager

### Deliverables
- Add, edit, delete engine configurations.
- Automatic version detection probe (`--version`, `-v`).
- Test executable capability and accessibility.
- Build source-port management UI view.

### Acceptance Criteria
User can add an engine, detect its version, and verify its executable path.

---

## 93. Phase 7 — IWAD Manager

### Deliverables
- Scan, add, edit, delete IWAD registrations.
- Inspect lump headers and identify game title (Ultimate Doom, Doom II, Final Doom).
- Build IWAD management UI view.

### Acceptance Criteria
User can add, inspect, and organize base game IWADs.

---

## 94. Phase 8 — Library

### Deliverables
- Build full mod library view.
- Real-time search by name, filename, and path.
- Type and format filtering.
- Mod inspector drawer with archive structure breakdown.
- Drag-and-drop file ingestion.
- Favorites toggling.

### Acceptance Criteria
The library is fully functional for cataloging and organizing content even prior to launch execution.

---

## 95. Phase 9 — Profiles

### Deliverables
- Profile list view with search and favorites.
- Create, rename, delete, duplicate profiles.
- Profile editor: Select source port engine and base IWAD.

### Acceptance Criteria
User can configure independent playable profiles with designated engines and IWADs.

---

## 96. Phase 10 — Load Order

### Deliverables
- Add mods from library selector modal.
- Remove mods from active profile.
- Toggle mod enabled / disabled state.
- Drag-and-drop visual reordering.
- Keyboard navigation and shortcut reordering (`↑`/`↓`, `Ctrl+↑`/`Ctrl+↓`).
- Persist ordered sequence in database.

### Acceptance Criteria
Mod load order changes are persisted and immediately reflected in argument generation.

---

## 97. Phase 11 — Validation

### Deliverables
- Implement `ValidationService` with 5 core verification rules.
- Integrate real-time validation banner into the profile editor.

### Acceptance Criteria
Profile status unambiguously resolves to:
- `READY`
- `READY WITH WARNINGS`
- `CANNOT LAUNCH`

---

## 98. Phase 12 — Launcher

### Deliverables
- Build argument generator for source-port CLI conventions.
- Implement process creation via direct `exec.Command`.
- Asynchronous process monitoring and exit code tracking.
- Record execution duration and status to launch history.
- Wire up the prominent **PLAY** button.

### Acceptance Criteria
Verified launch execution with correct argument vectors and automatic session history capture.

---

## 99. Phase 13 — Dashboard

### Deliverables
- Live cockpit built from real database state.
- Quick-launch cards for favorite and recent profiles.
- Live library statistics counter (Mods, IWADs, Engines).
- Recent launch feed with durations and exit statuses.

### Acceptance Criteria
Dashboard provides instant 1-click launch access to recently played profiles.

---

## 100. Phase 14 — Import/Export

### Deliverables
- Export profile configuration to portable YAML files.
- Import profile from YAML files with schema validation.
- Reference resolution for engines, IWADs, and mods.
- Unresolved missing content handling with user confirmation.

### Acceptance Criteria
Profiles can be seamlessly exported, shared, and imported across different machines.

---

## 101. Phase 15 — Polish

### Focus Areas
- Visual loading spinners, skeleton states, and progress bars.
- Comprehensive empty states with helpful call-to-action triggers.
- Humanized error dialogs and toast alerts.
- Polished keyboard shortcuts and context menus.
- Latency optimization across search and profile switching.

*Rule: Zero new major features added during this stabilization phase.*

---

## 102. MVP Milestones

- **Milestone A**: Application opens (Wails + Go + React shell operational).
- **Milestone B**: Library works (Scan → Database → Browse).
- **Milestone C**: Profiles work (Create → Configure → Save).
- **Milestone D**: Launcher works (Validate → Launch Doom process).
- **Milestone E**: Complete workflow works (Dashboard → Library → Profile → Validate → Play → History).
- **Milestone F**: Polished release candidate ready for distribution.

---

## 103. End-to-End Acceptance Test

On a clean, zero-state installation:
1. Open the application.
2. Add source port engine (e.g., GZDoom).
3. Add base game IWAD (`DOOM2.WAD`).
4. Configure a mod scan directory.
5. Trigger directory scan.
6. Verify discovered mods in library (`brutal-doom.pk3`, `nashgore.pk3`).
7. Create a new profile: `Brutal Doom`.
8. Select GZDoom engine and `DOOM2.WAD` base game.
9. Add mods from library into profile.
10. Drag to adjust mod load order.
11. Toggle one mod to disabled state.
12. Save profile.
13. Execute pre-flight validation.
14. Click **PLAY** to launch Doom.
15. Play game and exit Doom.
16. Verify session logged in Launch History with elapsed playtime.
17. Export profile to YAML file.
18. Delete profile from database.
19. Import profile from exported YAML file.
20. Launch profile again successfully.

*If all 20 steps execute reliably without errors, MVP acceptance is fulfilled.*

---

## 104. Definition of Done

### Product
- [x] Desktop GUI on Windows, Linux, and macOS.
- [x] Fully local-first offline operation (no online account or cloud services).
- [x] No CLI dependency for MVP.

### Library
- [x] Recursive mod and IWAD scanning across multiple directories.
- [x] Source port engine management with version detection.
- [x] Instant sub-100ms library search and filtering.
- [x] Mod inspector drawer with archive and WAD header analysis.
- [x] Drag-and-drop mod ingestion.
- [x] Favorites management.

### Profiles
- [x] Full CRUD operations (Create, Edit, Delete, Duplicate, Clone).
- [x] Portable YAML Import and Export with missing reference warnings.
- [x] Engine and base IWAD selection.
- [x] Multi-mod selection with enable/disable toggling.
- [x] Drag-and-drop and keyboard load ordering.
- [x] Custom launch arguments and working directory configuration.

### Launcher & Pipeline
- [x] Pre-flight validation with categorized blocking errors and non-blocking warnings.
- [x] Deterministic argument generation matching source-port CLI conventions.
- [x] Process launching via direct `exec.Command` without shell wrappers.
- [x] Real-time process monitoring and exit code tracking.
- [x] Persistent launch history logging.

### Engineering Quality
- [x] Unit test suite across domain, validator, filesystem, and repositories.
- [x] Integration test suite with fake launcher harness.
- [x] Zero shell interpolation security vulnerabilities.
- [x] Atomic SQLite database persistence.
- [x] Clear, human-readable error messages.
- [x] Non-blocking background scanning and hashing.
- [x] Automated test gates passing:
  ```bash
  go test ./...
  go vet ./...
  ```
- [x] Clean production build verification.

---

## 105. Future Roadmap

### v0.2 — Better Organization
- Rich mod metadata and community tags
- Screenshot capture gallery
- Map slot detection
- Advanced multi-criteria library filtering
- Profile inheritance and templating
- Relative portable path support

### v0.3 — Mod Intelligence
- Dependency detection and automatic ordering rules
- Known conflict warnings
- Mod version management
- Global SHA-256 duplicate content identification
- Engine feature compatibility matrix

### v0.4 — Online Metadata
- idgames archive search integration
- Doomworld and GitHub release update notifications
- Automated mod update checks

### v0.5 — Managed Libraries
- Automated 1-click mod installation
- Self-contained modpack archive format
- Managed sandbox file copies
- Instant engine version switching

### v1.0
- Comprehensive, mature Doom content management ecosystem.

---

## 106. Future CLI

A CLI is intentionally omitted from MVP scope. When user demand warrants, a command-line client will sit directly on top of the shared application core:

### Potential Commands
- `doomctl scan`
- `doomctl profile list`
- `doomctl profile launch <id>`
- `doomctl profile validate <id>`
- `doomctl doctor`

### Architectural Decoupling
```text
        GUI (Desktop)                       CLI (Future)
             │                                   │
           Wails                               CLI App
             │                                   │
             └─────────────────┬─────────────────┘
                               │
                               ▼
                       Application Core
                               │
               ┌───────────────┼───────────────┐
               │               │               │
            Library         Profiles        Launcher
               │               │               │
               └───────────────┼───────────────┘
                               │
                               ▼
                            SQLite
```

*The application core must remain strictly interface-agnostic to support this architecture.*

---

## 107. AI Implementation Agent Prompt

> **Context**: You are the lead engineer responsible for building Doom Mod Manager, a modern cross-platform desktop application for managing Doom mods, IWADs, source ports, profiles, load orders, validation, and launching.
> The application takes inspiration from the existing Doom launcher ecosystem (DoomRunner, YADL, Arachnotron, ZDL-3, qZDL, DoomLauncher, RocketLauncher2) without cloning their interfaces or dated architectures.

### Primary User Workflow
```text
Scan Doom files
       ↓
Browse library
       ↓
Create profile
       ↓
Select engine
       ↓
Select IWAD
       ↓
Add mods
       ↓
Reorder mods
       ↓
Validate
       ↓
PLAY
```

*This loop must feel instantaneous, obvious, and rock solid.*

---

## 108. Technology Requirements

- **Backend**: Go 1.23+
- **Desktop Wrapper**: Wails v2
- **Frontend**: React 18 + TypeScript 5 + Vite
- **Database**: SQLite (pure Go)
- **Serialization**: YAML
- **State & Data Synchronization**: TanStack Query
- *Use external libraries only when they solve a concrete, necessary problem.*

---

## 109. Interface Requirement

- **The MVP is GUI-only.**
- Do **NOT** build a CLI during MVP.
- Maintain an interface-agnostic backend core so a CLI can be attached in the future without modifying domain logic.

---

## 110. Engineering Principles

- Build production-quality, enterprise-grade software from day one; no throwaway prototypes.
- Do not hardcode sample data into production builds.
- Do not fabricate false compatibility assertions.
- Do not build future roadmap features prematurely.
- Make sound, well-documented engineering decisions.
- Prefer simple, robust, maintainable code over convoluted abstractions.
- Keep business logic strictly out of React components.
- Keep UI-specific concerns out of backend domain services.

---

## 111. Architecture

### Data Layer Flow
```text
React (UI)
   ↓
Wails Bridge
   ↓
Application Services
   ↓
Domain Models & Rules
   ↓
Repositories
   ↓
SQLite / Local Filesystem
```

### Launch Execution Flow
```text
React (UI)
   ↓
Wails Bridge
   ↓
LauncherService
   ↓
Validator
   ↓
ArgumentBuilder
   ↓
os/exec (Direct Process Execution)
```

---

## 112. Backend Structure

```text
backend/
├── cmd/
├── internal/
│   ├── app/
│   ├── domain/
│   ├── database/
│   ├── filesystem/
│   ├── scanner/
│   ├── mods/
│   ├── iwads/
│   ├── engines/
│   ├── profiles/
│   ├── launcher/
│   ├── validator/
│   └── history/
└── migrations/
```

---

## 113. Frontend Structure

```text
frontend/src/
├── app/
├── components/
├── features/
│   ├── dashboard/
│   ├── library/
│   ├── profiles/
│   ├── engines/
│   ├── iwads/
│   └── history/
├── hooks/
├── lib/
├── types/
└── styles/
```

---

## 114. Critical Architecture Rule

**The React application must not contain business logic.**

```text
// FORBIDDEN:
React  ───>  SQLite
React  ───>  Filesystem
React  ───>  Process Exec

// REQUIRED:
React  ───>  Wails Bridge  ───>  Application Service  ───>  Repository / OS
```

---

## 115. Launcher Safety

**Mandatory Security Rule**: Never execute concatenated shell strings.

```go
// REQUIRED:
exec.Command(executable, args...)
```

*Arguments must always remain structured slices of strings (`[]string`). Never route launches through `sh -c`, `cmd /c`, or `powershell -Command`.*

---

## 116. MVP Development Order

Implement features strictly according to vertical dependency phases:
1. **Foundation**: Build harness, Wails integration, Vite shell
2. **Domain**: Invariant models and unit tests
3. **Database**: Schema, migrations, repository CRUD
4. **Scanner**: Directory traversal and background indexing
5. **File Inspection**: WAD headers and archive contents
6. **Engine Manager**: Source-port configuration and version probe
7. **IWAD Manager**: Base game detection and metadata
8. **Library**: Search, filtering, inspector drawer, favorites
9. **Profiles**: Profile lifecycle and engine/IWAD bindings
10. **Load Order**: Draggable, persistent mod ordering
11. **Validation**: Pre-flight verification engine
12. **Launcher**: Direct process execution and monitoring
13. **History**: Persistent session tracking
14. **Dashboard**: Live cockpit and quick-launch feed
15. **Import/Export**: Portable YAML profile transfer
16. **Polish**: Loading states, empty states, keyboard UX, error handling

---

## 117. Phase 1 Acceptance

Before proceeding beyond Phase 1:
```bash
go test ./...
go vet ./...
go build ./...
```
*The Wails desktop application window must launch and render the frontend.*

---

## 118. Phase 2 Acceptance

Domain entities and value objects must exist with comprehensive unit test coverage.

---

## 119. Phase 3 Acceptance

SQLite repositories must pass CRUD verification across all entity tables.

---

## 120. Phase 4 Acceptance

The background scanner must discover Doom files from configured directories without freezing the GUI.

---

## 121. Phase 5 Acceptance

WAD header parsing and container archive inspection must function accurately against test fixtures.

---

## 122. Phase 6 Acceptance

User can register a source port engine, probe its version, and verify executable accessibility.

---

## 123. Phase 7 Acceptance

User can register and inspect base game IWADs.

---

## 124. Phase 8 Acceptance

User can perform the following library operations:
- Scan folders
- Search mods (<100ms latency)
- Filter by type and format
- Inspect archive internals
- Toggle favorites
- Drag-and-drop ingest mod files

---

## 125. Phase 9 Acceptance

User can perform the following profile operations:
- Create new profiles
- Rename profiles
- Delete profiles
- Duplicate / clone profiles
- Select target source port engine
- Select base game IWAD

---

## 126. Phase 10 Acceptance

User can manage mod load orders:
- Add mods from library selector
- Remove mods from profile
- Toggle mods between enabled and disabled
- Reorder mods via drag-and-drop
- Reorder mods via keyboard shortcuts

---

## 127. Phase 11 Acceptance

The pre-flight validation banner clearly and deterministically reports:
- `READY`
- `READY WITH WARNINGS`
- `CANNOT LAUNCH`

---

## 128. Phase 12 Acceptance

A real Doom source port process can be launched with:
- Selected Engine executable
- Selected IWAD argument (`-iwad`)
- Ordered mod arguments (`-file`)
- Custom launch arguments
in the exact required order.

---

## 129. Phase 13 Acceptance

Every executed launch records a session entry in SQLite containing timestamp, duration, and exit status.

---

## 130. Phase 14 Acceptance

The dashboard displays live profile cards, recent launch history, and library statistics from real database data.

---

## 131. Phase 15 Acceptance

Profiles can be exported to and imported from valid YAML files across systems.

---

## 132. Phase 16 Acceptance

The application is thoroughly stabilized for daily use:
- Fast rendering and responsiveness
- Clean visual empty states and loading skeletons
- Comprehensive keyboard shortcut support
- User-friendly error dialogs and notifications
- Zero blocking bugs

---

## 133. Final MVP Requirement

The finished application must make this end-to-end user loop feel effortless:

```text
"I have a bunch of Doom mods."
               ↓
        "Scan my folder."
               ↓
       "Here's everything."
               ↓
"I want to make a Brutal Doom setup."
               ↓
          "Pick GZDoom."
               ↓
        "Pick DOOM2.WAD."
               ↓
"Drag these mods into the order I want."
               ↓
            "Validate."
               ↓
          "Looks good."
               ↓
             "PLAY."
```

If that loop is fast, reliable, and pleasant, the MVP succeeds.
*Everything else is secondary.*
