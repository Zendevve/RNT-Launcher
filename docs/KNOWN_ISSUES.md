# RNT Launcher — Known Issues & Non-Blocking Limitations

**Version**: 0.1.0 (MVP)  
**Last Updated**: August 2026  

This document logs architectural design decisions, accepted non-blocking edge cases, and scope boundaries explicitly deferred to future release versions in compliance with `PRD.MD`.

---

## 1. Explicit MVP Scope Boundaries (Non-Bugs)

### 1.1 Local-First Architecture vs. Cloud / Online Services
- **Status**: By Design (PRD Sections 6.2, 9, 11)
- **Description**: RNT Launcher is strictly a local-first desktop application. It does not provide automated mod downloading, Doomworld / ModDB scraping, multiplayer master server browsers, or user accounts.
- **Resolution**: All mod acquisition is managed externally by the user; RNT Launcher handles discovery, indexing, validation, and launching.

### 1.2 Multi-Category Mod Tagging
- **Status**: Deferred to v0.2.0 (PRD Section 105)
- **Description**: Mods in v0.1.0 are assigned a single primary category (`Gameplay`, `Total Conversion`, `Maps`, `Weapons`, `Monsters`, `Audio`, `HUD`, `Textures`, `Utility`, `Other`). Multi-tagging systems and custom user tags are planned for the v0.2.0 Organization milestone.
- **Workaround**: Search queries support substring filtering across title, filename, and format.

### 1.3 Automatic Inotify / ReadDirectoryChangesW File Watcher
- **Status**: Deferred (PRD Section 15, 53)
- **Description**: File system modification hooks are not enabled continuously in the background to avoid excessive CPU wakeups and battery drain on portable laptops.
- **Workaround**: Mod scanning is triggered manually via the "Scan Folders" button or automatically upon application startup when enabled in Settings.

---

## 2. Platform-Specific Considerations

### 2.1 Linux Wayland Drag-and-Drop Limitations
- **Platform**: Linux (Wayland compositors with specific WebKitGTK versions)
- **Symptom**: Dragging files from certain third-party file managers (e.g. Dolphin, Nautilus) into the webview may not emit standard HTML5 `drop` events depending on compositor security policies.
- **Workaround**: Use the prominent "Add Mod" or "Add Folder" file picker buttons on the Library toolbar.

### 2.2 macOS App Sandboxing & Executable Permissions
- **Platform**: macOS (Gatekeeper / Quarantine)
- **Symptom**: Downloading source ports (e.g. GZDoom) directly from the internet may attach `com.apple.quarantine` attributes, causing macOS to prevent launch until verified in System Settings.
- **Resolution**: RNT Launcher's pre-flight validator detects non-executable binaries and reports permission warnings with troubleshooting guidance.

---

## 3. Engine-Specific Considerations

### 3.1 Legacy Source Ports Without PK3 Support
- **Engine Family**: Vanilla, Chocolate Doom, Crispy Doom, Early Boom ports
- **Behavior**: Attempting to load `.pk3`, `.pke`, or directory-based mods into legacy ports that only support `.wad` files will trigger a pre-launch validation warning (`ERR_ENGINE_INCOMPATIBLE_FORMAT`).
- **Resolution**: The launcher blocks execution or warns the user before launch, preventing cryptic engine crashes.

---

## 4. Diagnostics & Automatic Recovery

Any issues arising from moved, renamed, or corrupted files can be diagnosed and repaired in one click using the built-in **System Diagnostics** tool (`DiagnosticsView`), which removes orphaned references from profiles and purges missing records from the SQLite database.
