Absolutely. I'd make the GUI the entire MVP product and remove the CLI from the actual scope. The backend stays clean and interface-agnostic so a CLI can be added later if there's a real reason for it.
Here's the revised full PRD.
DOOM MOD MANAGER
Product Requirements Document + Technical Specification + Implementation Plan
Working name: RNT Launcher (Rip and Tear)
Status: MVP Specification
Version: 0.1.0
Platform: Windows, Linux, macOS
Primary Interface: Desktop GUI
Backend: Go
Desktop Framework: Wails
Frontend: React + TypeScript
Database: SQLite
Profile Format: YAML

1. Executive Summary
Build a modern, cross-platform desktop application for managing, organizing, configuring, validating, and launching Doom games and mods.
The application takes the strongest ideas from the existing Doom launcher ecosystem while avoiding the limitations and dated workflows found in older launchers.
The product combines:
DoomRunner's profile/load-order workflow
ZDL/qZDL's straightforward launching
YADL's organization
Arachnotron's profile-oriented architecture
DoomLauncher's library and metadata concepts
RocketLauncher2's source-port abstraction
The result should not feel like a replacement for one specific launcher.
It should feel like a modern Doom mod management environment.
The core workflow is:
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
The application is local-first.
No account is required.
No online service is required.
No internet connection is required for normal use.

2. Product Vision
Create the definitive modern desktop tool for managing Doom installations, source ports, IWADs, mods, load orders, profiles, and launches.
A user should be able to have:
1,000+ mods
20 IWADs
10 source ports
50 profiles
without feeling like they're manually managing a giant collection of files.
The application should turn Doom's messy modding ecosystem into something understandable.

3. Product Positioning
Do not position the product as:
"A modern ZDL."
Do not position it as:
"DoomRunner but better."
Instead:
A modern Doom mod manager and launcher.
The launcher is only one part of the product.
The larger product is:
Library
+
Profiles
+
Configuration
+
Validation
+
Launcher
+
History

4. Problem Statement
Doom's source-port ecosystem is incredibly flexible, but that flexibility creates friction.
Users commonly have:
multiple source ports
multiple versions of the same source port
dozens or hundreds of mods
different IWADs
different load orders
different launch arguments
test configurations
multiplayer configurations
separate mod combinations
Traditional launchers generally treat this as:
Executable
+
IWAD
+
Files
+
Arguments
That works.
But it doesn't scale particularly well.
The application should instead represent the user's Doom setup as a structured library.

5. Target Users
Primary Users
Doom players who:
use GZDoom or another source port
regularly play mods
maintain multiple configurations
switch between source ports
have large mod collections
want persistent profiles
want easy load-order management
Secondary Users
Doom modders who need:
quick test configurations
multiple engine versions
rapid launch/relaunch
reproducible configurations
isolated profiles
Power Users
Users who maintain:
large mod libraries
multiple Doom installations
many profiles
complex launch arguments
portable configurations

6. Product Principles
6.1 GUI First
The desktop application is the product.
There is no CLI requirement for MVP.
The backend must remain UI-agnostic enough that a CLI could be added later without rewriting business logic.
Do not spend MVP development time maintaining two interfaces.

6.2 Local First
Everything necessary for normal use works offline.
The application must not require:
accounts
servers
cloud storage
internet access
online APIs

6.3 Files Remain Files
Do not force users into a proprietary content-management system.
If a user has:
D:\Doom\Mods\brutal-doom.pk3
the application should be able to reference that file directly.
Do not silently move or copy files.

6.4 Profiles Are First-Class
A profile represents a complete playable configuration.
Example:
Brutal Doom

Engine:
GZDoom 4.14.3

IWAD:
DOOM2.WAD

Mods:
1. Brutal Doom
2. Nashgore
3. Beautiful Doom

Arguments:
-skill 4

6.5 Progressive Disclosure
Beginners should see:
Engine
IWAD
Mods
PLAY
Advanced users can access:
Launch Arguments
Working Directory
Environment Variables
Save Directory
Advanced Engine Options
Do not expose every possible configuration option immediately.

6.6 Don't Pretend to Understand What We Don't
If the application can't confidently determine:
compatibility
dependency
conflict
version
engine requirement
it should say:
Unknown
rather than making a guess.

7. Competitive Research
The application was designed after reviewing:
DoomRunner
YADL
Arachnotron
ZDL-3
qZDL
DoomLauncher
RocketLauncher2
What to take
DoomRunner
Take:
profiles
load ordering
enable/disable
multiple launch configurations
quick launching
YADL
Take:
organization
categories
playlists
library thinking
Arachnotron
Take:
profile-oriented configuration
portable configuration concepts
relative-path thinking
ZDL / qZDL
Take:
simplicity
explicit engine/IWAD/mod configuration
direct launch workflow
DoomLauncher
Take:
persistent content library
metadata
play history
tags
screenshots as a future feature
RocketLauncher2
Take:
source-port abstraction
multiple engine versions
engine configuration

8. What to Fix
File-centric workflows
Don't force users to think primarily in filenames.
Prefer:
Brutal Doom
over:
brutalv21.pk3
but always make the actual filename/path accessible.

Configuration overload
Don't show dozens of fields immediately.
Use:
Basic
Advanced

Poor validation
A launcher shouldn't discover that something is broken only after the process fails.
Validate first.

Fragmented content
A mod should be represented as a persistent library object.
The same mod appearing in five profiles should still refer to the same underlying library object.

Portability
Profiles should be exportable and importable.

9. What to Avoid
Do not blindly reproduce:
giant configuration dialogs
excessive engine-specific settings
file-only interfaces
unnecessary setup steps
mandatory file imports
online services in MVP
automatic mod downloads
accounts
social features
mod marketplaces
unnecessary animations
"AI SaaS" visual design

10. MVP Scope
Library
Mod discovery
Mod scanning
Mod import
Drag and drop
Search
Basic filtering
Favorites
File inspection
Archive inspection
Basic metadata
IWADs
Discovery
Registration
Inspection
Management
Source Ports
Registration
Executable selection
Version detection
Management
Profiles
Create
Rename
Delete
Duplicate
Import
Export
Engine selection
IWAD selection
Mod selection
Enable/disable
Load order
Arguments
Validation
Missing engine
Missing IWAD
Missing mods
Invalid paths
Duplicate entries
Basic file validation
Launcher
Launch
Process monitoring
Exit handling
Launch history
UI
Dashboard
Library
Profiles
Engines
IWADs
History
Settings
Mod inspector
Validation interface

11. Explicitly Out of Scope
Do NOT implement during MVP:
CLI
Online mod downloads
idgames integration
DoomWorld integration
GitHub update detection
Automatic dependency resolution
Automatic conflict resolution
Full ZScript parsing
Full DECORATE parsing
Mod hosting
User accounts
Cloud synchronization
Multiplayer matchmaking
Mod ratings
Social features
Built-in browser
Steam Workshop integration
Automatic Doom installation
Automatic source-port installation
DOSBox management
Mod marketplace
These can be considered later.

12. Application Information Architecture
Primary navigation:
Dashboard
Library
Profiles
Engines
IWADs
History

────────────

Settings

13. Dashboard
The dashboard should prioritize launching.
Example:
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
The dashboard should not become a statistics dashboard.
Its primary purpose is:
Get me into Doom quickly.

14. Library
The library contains all discovered Doom-related content.
Categories:
All
Mods
Maps
Megawads
Gameplay
Weapons
Monsters
Textures
Audio
UI
Other
Unknown
Categories should behave as tags rather than exclusive classifications.

15. Library Scanning
Users configure directories:
Mods:
D:\Doom\Mods

IWADs:
D:\Doom\IWADs

Engines:
D:\Doom\Ports
The scanner recursively searches configured locations.
Recognized formats:
.wad
.pk3
.pk7
.ipk3
.zip
.deh
.bex
The application must not assume that every .zip is a Doom mod.

16. Drag and Drop
Drag-and-drop is a core workflow.
A user can drag:
brutal-doom.pk3
into the library.
The application:
Detects the file
Checks readability
Identifies the format
Inspects it
Adds it to the library
Shows metadata
Optionally adds it to the active profile
Default behavior:
Reference the existing file.
Do not silently copy it.

17. Mod Identity
Separate:
Mod
from:
File
Conceptually:
Mod
├── Identity
├── Metadata
└── Files
Example:
Mod:
Brutal Doom

Version:
21.66b

File:
brutalv21.pk3
MVP can initially derive the name from filename.
More sophisticated identification is future scope.

18. Mod Inspector
Selecting a mod opens an inspector.
Example:
BRUTAL DOOM

Gameplay Mod
GZDoom

Version
21.66b

File
brutalv21.pk3

Size
142 MB

Location
D:\Doom\Mods\brutalv21.pk3

Archive Contents
183 files

Detected Structures

✓ ZSCRIPT
✓ DECORATE
✓ MAPINFO
✓ TEXTURES
✓ SNDINFO
Actions:
Open File
Open Folder
Add to Profile
Favorite
Remove from Library

19. Archive Inspection
For:
PK3
PK7
IPK3
ZIP
inspect the archive contents.
Detect common structures:
ZSCRIPT
MAPINFO
GAMEINFO
DECORATE
SNDINFO
TEXTURES
HIRES
MAP01
MAP02
E1M1
MVP should only perform structural inspection.
It should not attempt to understand the entire mod.

20. WAD Inspection
Read WAD headers.
Recognize:
IWAD
PWAD
Extract:
Lump count
Use this for basic validation.
Do not implement a full WAD editor.

21. IWAD Manager
Display discovered IWADs.
Example:
IWADS

DOOM
DOOM.WAD
Ultimate Doom

DOOM II
DOOM2.WAD
Doom II

TNT
TNT.WAD
TNT: Evilution

PLUTONIA
PLUTONIA.WAD
The Plutonia Experiment
Actions:
Add
Edit
Remove
Inspect
Open Folder

22. Source-Port Manager
Source ports are first-class objects.
Example:
ENGINES

GZDoom Stable
4.14.3

GZDoom Development
4.15.0pre

DSDA-Doom
0.27.5

Woof!
14.1.0

UZDoom
Each engine contains:
ID
Name
Executable
Version
Family
If version detection fails:
Version: Unknown
The engine remains usable.

23. Engine Abstraction
Do not hardcode GZDoom.
Conceptually:
type Engine struct {
    ID         string
    Name       string
    Executable string
    Version    string
    Family     string
}
Future engine adapters can provide:
argument conventions
capabilities
version detection
save paths
engine-specific features

24. Profiles
A profile represents one complete playable configuration.
Example:
BRUTAL DOOM

Engine:
GZDoom Stable

IWAD:
DOOM2.WAD

Mods:

01 Brutal Doom
02 Nashgore
03 Beautiful Doom
04 Maps of Chaos

Arguments:

-skill 4
Profile actions:
Launch
Edit
Duplicate
Export
Delete

25. Profile Editor
The profile editor is the most important screen in the application.
It should look conceptually like:
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
The user should never have to hunt for the PLAY button.

26. Load Order
Mods have explicit order.
Users can:
drag
move up
move down
move to top
move to bottom
enable
disable
remove
Example:
01 ✓ Brutal Doom
02 ✓ Beautiful Doom
03 ✕ Experimental Mod
04 ✓ Nashgore
Disabled mods remain visible.

27. Adding Mods
Profile editor contains:
+ Add Mod
This opens the library.
The user can search:
brutal
and select:
Brutal Doom
Multiple mods should be addable in one interaction.

28. Launch Arguments
Internally store arguments as arrays.
Example:
Arguments []string
Example data:
[
    "-skill",
    "4",
    "-warp",
    "MAP01"
]
Do not store only one raw shell command.
This prevents quoting and escaping problems.

29. Advanced Profile Options
MVP should support:
Launch Arguments
Working Directory
Potential future:
Environment Variables
Custom Save Directory
Demo Directory
Screenshot Directory
Engine-specific options
Do not expose these until necessary.

30. Launch Pipeline
Launching must follow:
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

31. Launch Security
Never construct a shell command.
Use:
exec.Command(executable, args...)
Never use:
sh -c
cmd /c
powershell -Command
for normal launching.
Treat paths and filenames as untrusted input.

32. Example Launch
Conceptually:
gzdoom
-iwad
D:\Doom\DOOM2.WAD
-file
D:\Doom\Mods\brutal-doom.pk3
D:\Doom\Mods\nashgore.pk3
-skill
4
The backend should construct this as structured arguments.

33. Validation
Before launching:
VALIDATION

✓ Engine found
✓ IWAD found
✓ 4 mods found
✓ All paths valid

Warnings:
⚠ Experimental Mod is disabled

Status:
READY

34. Validation Errors
Example:
CANNOT LAUNCH

✕ GZDoom executable not found
✕ DOOM2.WAD missing
✕ brutal-doom.pk3 missing
The application should explain what needs fixing.

35. Validation Rules
Errors
Missing engine
Missing executable
Missing IWAD
Missing mod
Invalid path
Invalid profile
Invalid file
Warnings
Disabled mod
Duplicate entry
Duplicate file
Unknown format
Missing working directory
Information
Engine version
IWAD type
Mod count
Archive structures

36. Compatibility Detection
MVP must NOT pretend to provide complete compatibility analysis.
Do not automatically claim:
Mod A conflicts with Mod B
unless there is a reliable rule explicitly supporting that conclusion.
Future compatibility engine can support:
requires
conflicts
load-before
load-after
engine-min-version
engine-max-version

37. Launch Confirmation
Successful validation:
READY TO PLAY

Profile:
Brutal Doom

Engine:
GZDoom 4.14.3

IWAD:
DOOM2.WAD

Mods:
4 enabled

[ PLAY ]
Warnings:
READY WITH WARNINGS

2 warnings found.

[ VIEW WARNINGS ] [ PLAY ANYWAY ]
Errors:
CANNOT LAUNCH

2 errors must be fixed.

[ VIEW ERRORS ]

38. Process Monitoring
When Doom is running, track:
Running
Profile
Engine
Start time
Elapsed time
Do not embed Doom.
Doom remains an external process.

39. Launch History
Store recent launches.
MVP target:
Last 50 launches
Record:
Timestamp
Profile
Engine
IWAD
Started
Finished
Exit code
Duration
Example:
TODAY

Brutal Doom
GZDoom
18:32
32 minutes

Eviternity
DSDA-Doom
15:10
47 minutes

40. Statistics
MVP statistics:
total launches
total play time
last played
Do not build an elaborate analytics system.
Future:
per-profile statistics
map completion
deaths
achievements

41. Favorites
Users can favorite:
Mods
Profiles
Favorites should be accessible from:
Dashboard
Library
Profiles

42. Search
Search library by:
Name
Filename
Path
Tags
Search profiles by:
Name
Mods
Engine
IWAD
Search should feel instant.

43. Filtering
MVP:
Type
Format
Favorites
Future:
Engine
Tags
Recently Added
Recently Played

44. File Ownership
The application should not assume ownership of user files.
Default behavior:
Register existing file
Optional future feature:
Copy to Managed Library
Never silently relocate content.

45. Database
Use SQLite.
SQLite stores application state:
mods
mod_files
mod_metadata
engines
iwads
profiles
profile_mods
tags
mod_tags
profile_tags
launch_history
settings

46. Why SQLite
A large Doom collection may contain thousands of files.
Repeated filesystem scans are expensive and unnecessary.
Architecture:
Filesystem
    ↓
Scanner
    ↓
SQLite
    ↓
Application
Store:
Path
Modification time
Size
Hash
Metadata
The scanner should eventually become incremental.
MVP may begin with straightforward scanning.

47. Hashing
Use SHA-256 where useful.
Potential purposes:
duplicate detection
identity
future metadata matching
Do not hash everything synchronously on the UI thread.
Hash lazily or during background scanning.

48. Data Model
Example:
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
Exact structure may evolve.

49. Application Services
Use services such as:
ModService
ProfileService
EngineService
IWADService
ScannerService
ValidatorService
LauncherService
HistoryService
Example methods:
ListMods()
GetMod()
CreateMod()
RemoveMod()
ScanMods()

ListProfiles()
CreateProfile()
UpdateProfile()
DeleteProfile()
CloneProfile()

AddModToProfile()
RemoveModFromProfile()
ReorderProfileMods()

ValidateProfile()
LaunchProfile()

ListLaunchHistory()

50. Wails Boundary
Expose application functionality through Wails.
Example:
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
React should never access repositories directly.

51. Frontend Architecture
Use:
React
TypeScript
Vite
TanStack Query
Recommended:
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
Do not create one giant component.

52. Backend Architecture
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

53. Domain Layer
The domain layer must remain independent of Wails and React.
It should contain:
entities
value objects
validation rules
domain logic
No UI imports.

54. Repository Layer
Repositories handle:
SQLite
Examples:
ModRepository
ProfileRepository
EngineRepository
IWADRepository
HistoryRepository
Services should depend on interfaces where useful.

55. Async Operations
Scanning must not freeze the UI.
Use background operations and Wails events.
Events:
scan:start
scan:progress
scan:complete

launch:start
launch:exit
Example:
Scanning Doom library...

██████████████████░░░░ 76%

143 / 187 files

56. UI Design
The application should feel like a serious desktop utility.
Characteristics:
dense information
clear hierarchy
keyboard-friendly
fast
dark mode
restrained visual styling
strong typography
useful empty states
Avoid:
giant decorative cards
excessive gradients
excessive animation
fake dashboards
web-app-like spacing everywhere

57. Primary Layout
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

58. Profile UX Priority
The profile page must immediately answer:
What am I launching?
Which engine?
Which IWAD?
Which mods?
What's their order?
Can I launch?
Everything else is secondary.

59. Keyboard Support
Desktop users should be able to operate the application efficiently.
Suggested shortcuts:
Ctrl+K
Search

Ctrl+Enter
Launch

Ctrl+S
Save

Ctrl+Shift+S
Export

Delete
Remove

Esc
Close dialog
Load order:
↑ / ↓
Navigate

Ctrl+↑
Move top

Ctrl+↓
Move bottom

Space
Enable/disable
Shortcuts can change during implementation.

60. Context Menus
Mod context menu:
Add to Profile
Inspect
Open File
Open Folder
Favorite
Remove
Profile context menu:
Launch
Edit
Duplicate
Export
Delete

61. Notifications
Use lightweight notifications for:
Profile saved
Mod added
Scan complete
Launch started
Launch failed
Don't interrupt the user for routine actions.

62. Error UX
Bad:
exec: "C:\Games\gzdoom.exe": file not found
Good:
GZDoom couldn't be launched.

The configured executable doesn't exist:

C:\Games\gzdoom.exe

[ OPEN ENGINE SETTINGS ]

Details
Technical errors remain accessible but aren't the primary UX.

63. Settings
General
Theme
Startup Page
Confirm Launch
Automatic Scan
Library
Mod Directories
IWAD Directories
Engine Directories
Launching
Default Working Directory
Behavior on Validation Warnings
Advanced
Logging
Database Location
Debug Mode

64. Automatic Scanning
MVP:
manual scanning
optional startup scan
scan after adding directories
Future:
filesystem watchers
incremental indexing

65. Performance Requirements
Target collection:
1,000 mods
100 IWADs
20 engines
100 profiles
Requirements:
UI remains responsive
searching should be effectively instant
profile switching should be immediate
scans run in background
hashing runs in background
archive inspection doesn't freeze UI
Target:
Search <100ms
Profile load <100ms
Validation <500ms
excluding unusually slow filesystem operations.

66. Cross-Platform
Support:
Windows 10+
Linux
macOS
Use platform-appropriate locations for:
application data
database
configuration
logs
Do not hardcode Windows paths.

67. Security
Never execute shell commands constructed from user input.
Use direct process execution.
Treat:
paths
filenames
archive contents
imported profiles
as untrusted data.
Do not automatically extract arbitrary archives in MVP.

68. Logging
Use structured logging.
Go:
log/slog
Log:
scanner errors
database errors
launch errors
import errors
unexpected application errors
Do not spam normal user operations into logs.

69. Profile Export
Profiles should be portable.
Use YAML.
Example:
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
Do not bundle copyrighted IWADs automatically.

70. Import
Import pipeline:
YAML
 ↓
Parse
 ↓
Schema validation
 ↓
Resolve Engine
 ↓
Resolve IWAD
 ↓
Resolve Mods
 ↓
Report missing content
 ↓
Import
Missing content should not necessarily prevent importing.

71. Missing Profile Content
Example:
IMPORT PROFILE

Brutal Doom

✓ Engine found
✓ IWAD found
✓ Brutal Doom found
✕ Nashgore missing

[ IMPORT ANYWAY ] [ CANCEL ]
Imported profiles can contain unresolved references.

72. Portable Profiles
Future-compatible structure:
profile/
├── profile.yaml
├── mods/
├── saves/
└── screenshots/
MVP does not automatically bundle content.

73. Duplicate Detection
Detect:
Same path
immediately.
Future:
Same SHA-256
can detect duplicate content.
Never automatically delete files.

74. Version Detection
Engine versions should be detected where practical.
If detection fails:
Unknown
The engine remains usable.

75. Future Engine Capabilities
Design for future support:
Supports PK3
Supports PK7
Supports ZScript
Supports Multiplayer
Supports Demo
Supports Map Warp
MVP does not need to populate these.

76. Future Mod Metadata
Possible future metadata:
Maps
Episodes
Map Slots
IWAD Requirement
Engine Requirement
Game Mode
Multiplayer
Co-op
Deathmatch
Singleplayer
Only collect metadata that can be reliably determined.

77. Mod Classification
Initial categories:
Gameplay
Map
Megawad
Total Conversion
Weapon
Monster
Texture
Audio
UI
Utility
Other
Unknown
Users should eventually be able to tag content manually.

78. Profile Templates
Future:
New Profile

Empty
Vanilla
GZDoom
Multiplayer
Testing
MVP can simply create an empty profile.

79. Mod Testing Workflow
A modder should be able to create:
TESTING

Engine:
GZDoom Development

IWAD:
DOOM2.WAD

Mods:
test.pk3
Then repeatedly press:
Ctrl+Enter
to launch.
This workflow should be extremely fast.

80. Repository Structure
doom-mod-manager/
│
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

81. Technology Stack
Backend
Go
SQLite
Wails
YAML
log/slog
Frontend
React
TypeScript
Vite
TanStack Query
Use additional libraries only when they solve a concrete problem.

82. Dependency Philosophy
Prefer:
Go standard library
+
small focused dependencies
Avoid unnecessary abstraction frameworks.
Every dependency should have a clear reason to exist.

83. Testing Strategy
Unit Tests
Test:
WAD detection
Archive detection
Path resolution
Profile validation
Profile serialization
Launch argument generation
Database repositories
Integration Tests
Test:
Filesystem scan
Database persistence
Profile creation
Profile modification
Validation
Launch argument generation
Frontend Tests
Test important behavior:
ProfileEditor
LoadOrder
LibrarySearch
ValidationResults
Do not chase arbitrary coverage percentages.
Test things that can break the product.

84. Fake Launcher
Do not require GZDoom in CI.
Create a fake executable/test process.
Verify:
Executable
Arguments
Argument order
IWAD
Mods
Custom arguments
Working directory

85. Test Fixtures
testdata/
├── valid_iwad.wad
├── valid_pwad.wad
├── invalid.wad
├── sample.pk3
├── sample.pk7
└── malformed.zip
Fixtures should be tiny.

86. Implementation Strategy
Do not build every feature independently.
Build vertical slices.
Each phase should produce something usable.

87. Phase 1 — Project Foundation
Create:
Go
Wails
React
TypeScript
Vite
SQLite
CI
Linting
Testing
Acceptance:
go test ./...
go vet ./...
go build ./...
The application opens successfully.

88. Phase 2 — Domain
Implement:
Mod
ModFile
Engine
IWAD
Profile
ProfileMod
LaunchRecord
ValidationResult
Add unit tests.

89. Phase 3 — Database
Implement:
Migrations
Repositories
Transactions
Acceptance:
Create mod
Read mod
Update mod
Delete mod

Create profile
Read profile
Update profile
Delete profile

Attach mods
Reorder mods

90. Phase 4 — Scanner
Implement:
ModScanner
IWADScanner
EngineScanner
Scan configured directories.
Persist results.

91. Phase 5 — File Inspection
Implement:
WAD header detection
IWAD/PWAD detection
Lump count
ZIP inspection
PK3 inspection
PK7 inspection
IPK3 inspection
Add structural detection.

92. Phase 6 — Engine Manager
Implement:
Add Engine
Edit Engine
Delete Engine
Detect Version
Test Executable
Build engine UI.

93. Phase 7 — IWAD Manager
Implement:
Scan
Add
Edit
Delete
Inspect
Build IWAD UI.

94. Phase 8 — Library
Build:
Library
Search
Filters
Mod list
Mod inspector
Drag/drop
Favorites
At this point the application should already be useful even without launching Doom.

95. Phase 9 — Profiles
Build:
Profile list
Create
Rename
Delete
Duplicate
Then:
Profile editor

96. Phase 10 — Load Order
Implement:
Add mods
Remove mods
Enable/disable
Drag reorder
Keyboard reorder
Persist changes reliably.

97. Phase 11 — Validation
Implement:
ValidationService
ValidationResult
Integrate validation into the profile editor.

98. Phase 12 — Launcher
Implement:
LaunchProfile
ProcessMonitor
Exit handling
Launch history
Connect PLAY button.

99. Phase 13 — Dashboard
Build the dashboard from real data.
Show:
Recent profiles
Recent launches
Favorites
Library counts

100. Phase 14 — Import/Export
Implement:
Profile export
Profile import
Schema validation
Reference resolution
Missing content handling

101. Phase 15 — Polish
Focus on:
Loading states
Empty states
Error states
Keyboard navigation
Drag/drop
Dialogs
Notifications
Search
Performance
No new major features.

102. MVP Milestones
Milestone A
Application opens.
Wails + Go + React
Milestone B
Library works.
Scan → Database → Browse
Milestone C
Profiles work.
Create → Configure → Save
Milestone D
Launcher works.
Validate → Launch Doom
Milestone E
Complete workflow works.
Dashboard
→ Library
→ Profile
→ Validate
→ Play
→ History
Milestone F
Polished release candidate.

103. End-to-End Acceptance Test
On a clean installation:
1
Open application.
2
Add GZDoom.
3
Add:
DOOM2.WAD
4
Configure a mod directory.
5
Scan.
6
Application discovers:
brutal-doom.pk3
nashgore.pk3
7
Create profile:
Brutal Doom
8
Select:
GZDoom
DOOM2.WAD
9
Add mods.
10
Drag to reorder.
11
Disable one mod.
12
Save.
13
Validate.
14
Launch.
15
Exit Doom.
16
Launch history records the session.
17
Export profile.
18
Delete profile.
19
Import profile.
20
Launch again.
If these steps work reliably, the core MVP is complete.

104. Definition of Done
Product
Desktop GUI
Windows
Linux
macOS
Offline operation
No account required
No CLI requirement
Library
Mod scanning
IWAD scanning
Engine management
Search
Filtering
Mod inspection
Archive inspection
Drag/drop
Favorites
Profiles
Create
Edit
Delete
Duplicate
Import
Export
Engine selection
IWAD selection
Mod selection
Enable/disable
Load ordering
Arguments
Launcher
Validation
Argument generation
Process launching
Process monitoring
Exit handling
Launch history
Quality
Unit tests
Integration tests
Fake launcher tests
No shell execution
Atomic persistence
Human-readable errors
Background scanning
No UI freezing
go test ./...
go vet ./...
Production build

105. Future Roadmap
v0.2 — Better Organization
Rich metadata
Tags
Screenshots
Map detection
Better library views
Profile inheritance
Relative paths
v0.3 — Mod Intelligence
Dependency detection
Conflict detection
Load-order rules
Version management
Duplicate detection
Engine compatibility
v0.4 — Online Metadata
idgames
DoomWorld
GitHub releases
Update checking
v0.5 — Managed Libraries
Mod installation
Modpack format
Managed copies
Version switching
v1.0
A mature Doom content-management platform.

106. Future CLI
A CLI is intentionally not part of MVP.
If demand exists later, it should sit on top of the same application core.
Potential commands:
doomctl scan
doomctl profile list
doomctl profile launch <id>
doomctl profile validate <id>
doomctl doctor
Architecture:
                GUI
                  │
                Wails
                  │
                  ▼
           Application Core
                  │
        ┌─────────┼─────────┐
        │         │         │
     Library   Profiles   Launcher
        │         │         │
        └─────────┼─────────┘
                  │
                SQLite

Future:

                 CLI
                  │
                  ▼
           Application Core
The core must therefore remain interface-agnostic.
But do not implement the CLI now.

107. AI IMPLEMENTATION AGENT PROMPT
You are the lead engineer responsible for building Doom Mod Manager, a modern cross-platform desktop application for managing Doom mods, IWADs, source ports, profiles, load orders, validation, and launching.
The application is inspired by the existing Doom launcher ecosystem, including DoomRunner, YADL, Arachnotron, ZDL-3, qZDL, DoomLauncher, and RocketLauncher2.
Do not clone their interfaces or implementations.
Build a modern desktop product that combines their strongest concepts while fixing their usability problems.

Product Goal
The primary user workflow is:
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
This workflow must feel fast and obvious.

108. Technology Requirements
Use:
Go
Wails
React
TypeScript
Vite
SQLite
YAML
TanStack Query
Use additional dependencies only when necessary.

109. Interface Requirement
The MVP is GUI-only.
Do NOT build a CLI.
However, keep the backend/application core interface-agnostic so a CLI can be added later without duplicating business logic.

110. Engineering Principles
Build production-quality software.
Do not build a fake prototype.
Do not hardcode sample content into production.
Do not implement fake compatibility detection.
Do not implement future features prematurely.
Do not ask unnecessary questions when the requirements already provide enough information.
Make reasonable engineering decisions and document them.
Prefer simple reliable code.
Avoid giant files.
Avoid giant React components.
Keep business logic out of React.
Keep UI concerns out of domain services.

111. Architecture
Use:
React
   ↓
Wails
   ↓
Application Services
   ↓
Domain
   ↓
Repositories
   ↓
SQLite / Filesystem
Launching:
React
 ↓
Wails
 ↓
LauncherService
 ↓
Validator
 ↓
ArgumentBuilder
 ↓
os/exec

112. Backend Structure
Implement:
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

113. Frontend Structure
Implement:
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

114. Critical Architecture Rule
The React application must not contain business logic.
Do not do:
React → SQLite
React → filesystem
React → exec
Instead:
React → Wails → service → repository/system

115. Launcher Safety
This is mandatory.
Never execute shell command strings.
Use:
exec.Command(executable, args...)
Arguments must remain structured arrays.
Never use:
sh -c
cmd /c
powershell -Command
for normal launching.

116. MVP Development Order
Implement exactly this general order:
1. Foundation
2. Domain
3. Database
4. Scanner
5. File inspection
6. Engine manager
7. IWAD manager
8. Library
9. Profiles
10. Load order
11. Validation
12. Launcher
13. History
14. Dashboard
15. Import/export
16. Polish
Do not jump ahead.

117. Phase 1 Acceptance
Before moving forward:
go test ./...
go vet ./...
go build ./...
must pass.
Wails application must launch.

118. Phase 2 Acceptance
Domain entities must exist and have unit tests.

119. Phase 3 Acceptance
SQLite repositories must support CRUD operations.

120. Phase 4 Acceptance
The scanner must discover Doom files from configured directories without freezing the UI.

121. Phase 5 Acceptance
WAD and archive inspection must work against test fixtures.

122. Phase 6 Acceptance
The user can add an engine and test its executable.

123. Phase 7 Acceptance
The user can add and inspect IWADs.

124. Phase 8 Acceptance
The user can:
Scan
Search
Filter
Inspect
Favorite
Drag/drop
mods.

125. Phase 9 Acceptance
The user can:
Create profile
Rename profile
Delete profile
Duplicate profile
Select engine
Select IWAD

126. Phase 10 Acceptance
The user can:
Add mods
Remove mods
Enable/disable
Drag reorder
Keyboard reorder

127. Phase 11 Acceptance
The application clearly reports:
Ready
Ready with warnings
Cannot launch

128. Phase 12 Acceptance
A real Doom source port can be launched with:
Engine
IWAD
Mods
Arguments
in the correct order.

129. Phase 13 Acceptance
Every launch creates a history record.

130. Phase 14 Acceptance
Dashboard displays real profiles and launch history.

131. Phase 15 Acceptance
Profiles can be exported and imported.

132. Phase 16 Acceptance
The application is polished enough for real daily use.
Focus on:
Speed
Clarity
Reliability
Keyboard support
Error handling
Empty states
Loading states
Do not add major features during this phase.

133. Final MVP Requirement
The finished application must make this experience effortless:
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
If that loop is fast, reliable, and pleasant, the MVP succeeds.
Everything else is secondary.
The big strategic decision is now pretty clean: don't build a GUI and CLI product. Build a really damn good desktop Doom manager, with a clean Go core underneath. If the project takes off, the CLI becomes an adapter you can bolt on later rather than another thing you have to drag through every MVP decision.

