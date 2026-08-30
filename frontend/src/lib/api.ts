/**
 * RNT Launcher - Backend API Client
 * Wraps Wails window.go.main.App bridge with safe fallback & TypeScript types.
 */

import type {
  ActiveLaunch,
  Engine,
  EngineFamily,
  FileInfo,
  HistoryStats,
  IWAD,
  LaunchRecord,
  Mod,
  ModFilter,
  Profile,
  ScanResult,
  Settings,
  ValidationResult,
  DiagnosticsReport,
  LogEntry,
  IdgamesFile,
} from '../types/domain'

interface WailsAppBridge {
  [key: string]: ((...args: unknown[]) => Promise<unknown>) | undefined
}

declare global {
  interface Window {
    go?: {
      main?: {
        App?: WailsAppBridge
      }
    }
  }
}

function getAppBridge(): WailsAppBridge | null {
  if (typeof window !== 'undefined' && window.go?.main?.App) {
    return window.go.main.App
  }
  return null
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

async function callBackend<T>(methodName: string, ...args: unknown[]): Promise<T> {
  const app = getAppBridge()
  if (app) {
    const fn = app[methodName] ?? app[toCamelCase(methodName)] ?? app[toPascalCase(methodName)]
    if (typeof fn === 'function') {
      const res = await fn(...args)
      return res as T
    }
  }
  const isDev = Boolean(import.meta.env?.DEV ?? false)
  if (!isDev) {
    throw new Error(`Backend method "${methodName}" not available: Wails App bridge is not initialized.`)
  }
  return mockCall<T>(methodName, ...args)
}

// -------------------------------------------------------------
// Dev Mock Implementation (Browser fallback)
// -------------------------------------------------------------

const MOCK_STORAGE_PREFIX = 'rnt_mock_'

function getMockStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_PREFIX + key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    // ignore json parse errors
  }
  return defaultValue
}

function setMockStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(MOCK_STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    // ignore storage errors
  }
}

const DEFAULT_MOCK_IWADS: IWAD[] = [
  {
    id: 'iwad-doom2',
    name: 'DOOM2.WAD',
    path: 'C:/Games/Doom/DOOM2.WAD',
    type: 'doom2',
    lumpCount: 2919,
    size: 14604584,
    sha256: '25e1459ca71d321525f840f79721a6511252033668817a0edb88577e0499e201',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'iwad-doom',
    name: 'DOOM.WAD',
    path: 'C:/Games/Doom/DOOM.WAD',
    type: 'doom',
    lumpCount: 2306,
    size: 12408284,
    sha256: 'a5712ad643194a34b22c71286c478a87b8f2d5a37f940d99bcadcb9a6136d8db',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
]

const DEFAULT_MOCK_ENGINES: Engine[] = [
  {
    id: 'eng-gzdoom',
    name: 'GZDoom',
    executable: 'C:/Games/Doom/Engines/gzdoom.exe',
    version: '4.12.2',
    family: 'gzdoom',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'eng-dsda',
    name: 'DSDA-Doom',
    executable: 'C:/Games/Doom/Engines/dsda-doom.exe',
    version: '0.27.5',
    family: 'dsda-doom',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
]

const DEFAULT_MOCK_MODS: Mod[] = [
  {
    id: 'mod-eviternity',
    name: 'Eviternity.wad',
    path: 'C:/Games/Doom/Mods/Eviternity.wad',
    format: 'wad',
    category: 'Megawads',
    size: 58921840,
    modifiedAt: '2026-01-10T12:00:00Z',
    sha256: '9f81a7b8e61234bc5678def0123456789abcdef0123456789abcdef012345678',
    lumpCount: 324,
    structures: ['MAPINFO', 'MAPS', 'TEXTURES', 'DECORATE'],
    isFavorite: true,
    createdAt: '2026-01-10T12:00:00Z',
    updatedAt: '2026-01-10T12:00:00Z',
  },
  {
    id: 'mod-smoothdoom',
    name: 'SmoothDoom.pk3',
    path: 'C:/Games/Doom/Mods/SmoothDoom.pk3',
    format: 'pk3',
    category: 'Gameplay',
    size: 18451200,
    modifiedAt: '2026-01-15T15:30:00Z',
    sha256: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    lumpCount: 1420,
    structures: ['ZSCRIPT', 'DECORATE', 'SNDINFO'],
    isFavorite: false,
    createdAt: '2026-01-15T15:30:00Z',
    updatedAt: '2026-01-15T15:30:00Z',
  },
]

const DEFAULT_MOCK_SETTINGS: Settings = {
  modDirectories: ['C:/Games/Doom/Mods'],
  iwadDirectories: ['C:/Games/Doom/IWADs'],
  engineDirectories: ['C:/Games/Doom/Engines'],
  defaultWorkingDir: 'C:/Games/Doom',
  theme: 'dark',
  confirmLaunch: false,
  autoScanOnStartup: true,
  closeOnLaunch: false,
}

async function mockCall<T>(methodName: string, ...args: unknown[]): Promise<T> {
  const norm = toCamelCase(methodName)
  
  switch (norm) {
    case 'listMods': {
      const mods = getMockStorage<Mod[]>('mods', DEFAULT_MOCK_MODS)
      const filter = (args[0] ?? {}) as ModFilter
      let filtered = [...mods]
      if (filter.search) {
        const q = filter.search.toLowerCase()
        filtered = filtered.filter((m) => m.name.toLowerCase().includes(q))
      }
      if (filter.category && filter.category !== 'All') {
        filtered = filtered.filter((m) => m.category === filter.category)
      }
      if (filter.format) {
        filtered = filtered.filter((m) => m.format === filter.format)
      }
      if (filter.isFavorite || filter.favoritesOnly || filter.favorites_only) {
        filtered = filtered.filter((m) => m.isFavorite)
      }
      return filtered as T
    }
    case 'getMod': {
      const id = args[0] as string
      const mods = getMockStorage<Mod[]>('mods', DEFAULT_MOCK_MODS)
      const found = mods.find((m) => m.id === id)
      if (!found) throw new Error(`Mod with id ${id} not found`)
      return found as T
    }
    case 'inspectMod': {
      const id = args[0] as string
      const mods = getMockStorage<Mod[]>('mods', DEFAULT_MOCK_MODS)
      const found = mods.find((m) => m.id === id)
      const info: FileInfo = {
        path: found?.path ?? `C:/Games/Doom/Mods/${id}`,
        filename: found?.name ?? id,
        name: found?.name ?? id,
        size: found?.size ?? 1024 * 1024,
        format: found?.format?.toUpperCase() ?? 'PWAD',
        category: found?.category ?? 'Gameplay',
        lumpCount: found?.lumpCount ?? 10,
        maps: ['MAP01', 'MAP02'],
        structures: found?.structures ?? ['MAPINFO'],
        sha256: found?.sha256 ?? 'mocksha256',
      }
      return info as T
    }
    case 'toggleModFavorite': {
      const id = args[0] as string
      const mods = getMockStorage<Mod[]>('mods', DEFAULT_MOCK_MODS)
      let newState = false
      const updated = mods.map((m) => {
        if (m.id === id) {
          newState = !m.isFavorite
          return { ...m, isFavorite: newState, updatedAt: new Date().toISOString() }
        }
        return m
      })
      setMockStorage('mods', updated)
      return newState as T
    }
    case 'deleteMod': {
      const id = args[0] as string
      const mods = getMockStorage<Mod[]>('mods', DEFAULT_MOCK_MODS)
      setMockStorage('mods', mods.filter((m) => m.id !== id))
      return undefined as T
    }
    case 'getModUsageCounts': {
      const profiles = getMockStorage<Profile[]>('profiles', [])
      const counts: Record<string, number> = {}
      for (const p of profiles) {
        if (p.mods) {
          for (const m of p.mods) {
            counts[m.modId] = (counts[m.modId] || 0) + 1
          }
        }
      }
      return counts as T
    }
    case 'listIWADs': {
      return getMockStorage<IWAD[]>('iwads', DEFAULT_MOCK_IWADS) as T
    }
    case 'getIWAD': {
      const id = args[0] as string
      const iwads = getMockStorage<IWAD[]>('iwads', DEFAULT_MOCK_IWADS)
      const found = iwads.find((w) => w.id === id)
      if (!found) throw new Error(`IWAD with id ${id} not found`)
      return found as T
    }
    case 'listEngines': {
      return getMockStorage<Engine[]>('engines', DEFAULT_MOCK_ENGINES) as T
    }
    case 'getEngine': {
      const id = args[0] as string
      const engines = getMockStorage<Engine[]>('engines', DEFAULT_MOCK_ENGINES)
      const found = engines.find((e) => e.id === id)
      if (!found) throw new Error(`Engine with id ${id} not found`)
      return found as T
    }
    case 'detectEngineVersion': {
      return { version: '4.12.2', family: 'gzdoom' } as T
    }
    case 'validateEngineExecutable': {
      return undefined as T
    }
    case 'listProfiles': {
      return getMockStorage<Profile[]>('profiles', []) as T
    }
    case 'getProfile': {
      const id = args[0] as string
      const profiles = getMockStorage<Profile[]>('profiles', [])
      const found = profiles.find((p) => p.id === id)
      if (!found) throw new Error(`Profile with id ${id} not found`)
      return found as T
    }
    case 'createProfile': {
      const data = args[0] as Partial<Profile>
      const profiles = getMockStorage<Profile[]>('profiles', [])
      const newProfile: Profile = {
        id: `prof-${Date.now()}`,
        name: data.name ?? 'New Profile',
        description: data.description ?? '',
        engineId: data.engineId ?? '',
        engineName: data.engineName ?? '',
        iwadId: data.iwadId ?? '',
        iwadName: data.iwadName ?? '',
        mods: data.mods ?? [],
        arguments: data.arguments ?? [],
        workingDir: data.workingDir ?? '',
        isFavorite: data.isFavorite ?? false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setMockStorage('profiles', [...profiles, newProfile])
      return newProfile as T
    }
    case 'updateProfile': {
      const data = args[0] as Profile
      const profiles = getMockStorage<Profile[]>('profiles', [])
      setMockStorage('profiles', profiles.map((p) => (p.id === data.id ? { ...data, updatedAt: new Date().toISOString() } : p)))
      return undefined as T
    }
    case 'deleteProfile': {
      const id = args[0] as string
      const profiles = getMockStorage<Profile[]>('profiles', [])
      setMockStorage('profiles', profiles.filter((p) => p.id !== id))
      return undefined as T
    }
    case 'openprofilesavefolder': {
      return undefined as T
    }
    case 'getprofilesavedir': {
      const id = args[0] as string
      return `userData/saves/${id || 'default'}` as T
    }
    case 'validateProfile': {
      const res: ValidationResult = {
        status: 'READY',
        items: [],
        enabledMods: [],
      }
      return res as T
    }
    case 'launchProfile': {
      const id = args[0] as string
      const record: LaunchRecord = {
        id: `launch-${Date.now()}`,
        profileId: id,
        profileName: 'Mock Profile',
        engineName: 'GZDoom',
        iwadName: 'DOOM2.WAD',
        startedAt: new Date().toISOString(),
        durationMs: 0,
        status: 'success',
        commandLine: 'gzdoom.exe -iwad DOOM2.WAD',
      }
      return record as T
    }
    case 'getActiveLaunches': {
      return [] as T
    }
    case 'killLaunch': {
      return undefined as T
    }
    case 'startScan': {
      const res: ScanResult = {
        discoveredMods: 2,
        discoveredIWADs: 2,
        discoveredEngines: 2,
        errors: [],
      }
      return res as T
    }
    case 'isScanning': {
      return false as T
    }
    case 'listLaunchHistory': {
      return getMockStorage<LaunchRecord[]>('history', []) as T
    }
    case 'getHistoryStats': {
      const stats: HistoryStats = {
        totalLaunches: 0,
        totalPlayTimeMs: 0,
      }
      return stats as T
    }
    case 'clearLaunchHistory': {
      setMockStorage('history', [])
      return undefined as T
    }
    case 'getSettings': {
      return getMockStorage<Settings>('settings', DEFAULT_MOCK_SETTINGS) as T
    }
    case 'updateSettings': {
      const data = args[0] as Settings
      setMockStorage('settings', data)
      return undefined as T
    }
    case 'openFileDialog':
    case 'openDirectoryDialog': {
      return '' as T
    }
    case 'openPathInExplorer': {
      return undefined as T
    }
    case 'runDiagnostics': {
      return {
        overallStatus: 'healthy',
        database: {
          status: 'healthy',
          path: 'C:/Users/natha/AppData/Roaming/rnt-launcher/rnt-launcher.db',
          integrityCheck: 'ok',
          modCount: 0,
          iwadCount: 2,
          engineCount: 1,
          profileCount: 0,
          historyCount: 0,
        },
        issues: [],
        summary: {
          totalIssues: 0,
          errorCount: 0,
          warningCount: 0,
          infoCount: 0,
        },
        generatedAt: new Date().toISOString(),
      } as T
    }
    case 'repairDiagnosticIssue': {
      return undefined as T
    }
    case 'getSystemLogs': {
      return [] as T
    }
    case 'clearSystemLogs': {
      return undefined as T
    }
    case 'searchidgames': {
      const query = String(args[0] || '').toLowerCase()
      const sampleFiles: IdgamesFile[] = [
        {
          id: 19485,
          title: 'Eviternity',
          dir: 'levels/doom2/Ports/megawads/',
          filename: 'eviternity.zip',
          size: 75234120,
          age: 1544400000,
          date: '2018-12-10',
          author: 'Dragonfly et al.',
          description: 'Eviternity is a 32-level megawad designed for MBF-compatible source ports with custom textures and soundtrack.',
          rating: 4.85,
          votes: 142,
          url: 'https://www.doomworld.com/idgames/levels/doom2/Ports/megawads/eviternity',
        },
        {
          id: 12345,
          title: 'Scythe',
          dir: 'levels/doom2/megawads/',
          filename: 'scythe.zip',
          size: 4512300,
          age: 1054400000,
          date: '2003-05-01',
          author: 'Erik Alm',
          description: 'A classic 32-level fast-paced megawad focusing on tight encounter design.',
          rating: 4.70,
          votes: 98,
          url: 'https://www.doomworld.com/idgames/levels/doom2/megawads/scythe',
        },
        {
          id: 18000,
          title: 'Ancient Aliens',
          dir: 'levels/doom2/Ports/megawads/',
          filename: 'aaliens.zip',
          size: 95000000,
          age: 1460000000,
          date: '2016-04-10',
          author: 'skillsaw et al.',
          description: 'Ancient Aliens is a 32-level set with bright psychedelic color palettes and custom alien lore.',
          rating: 4.92,
          votes: 210,
          url: 'https://www.doomworld.com/idgames/levels/doom2/Ports/megawads/aaliens',
        },
        {
          id: 15000,
          title: 'Sunder',
          dir: 'levels/doom2/Ports/s-u/',
          filename: 'sunder.zip',
          size: 68000000,
          age: 1244400000,
          date: '2009-06-01',
          author: 'Insane_Gazebo',
          description: 'A monumentally scaled slaughter map set featuring grand gothic architectures.',
          rating: 4.78,
          votes: 165,
          url: 'https://www.doomworld.com/idgames/levels/doom2/Ports/s-u/sunder',
        },
      ]
      if (!query) return sampleFiles as T
      return sampleFiles.filter(
        (f) =>
          f.title.toLowerCase().includes(query) ||
          f.filename.toLowerCase().includes(query) ||
          f.author.toLowerCase().includes(query) ||
          f.description.toLowerCase().includes(query)
      ) as T
    }
    case 'downloadidgamesmod': {
      const file = args[0] as IdgamesFile
      const mockMod: Mod = {
        id: `mock-mod-${file?.id || Date.now()}`,
        name: file?.title || 'Downloaded Mod',
        path: `C:/Games/Doom/Mods/${(file?.filename || 'downloaded.zip').replace('.zip', '.wad')}`,
        format: 'wad',
        category: 'Megawads',
        size: file?.size || 1024 * 1024,
        modifiedAt: new Date().toISOString(),
        sha256: 'mock-sha256-hash',
        lumpCount: 42,
        structures: ['MAPINFO', 'GRAPHICS'],
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      return mockMod as T
    }
    default:
      return undefined as T
  }
}

// -------------------------------------------------------------
// Typed API Client
// -------------------------------------------------------------

export const api = {
  // Mods
  listMods: (filter?: ModFilter): Promise<Mod[]> => callBackend<Mod[]>('ListMods', filter ?? {}),
  getMod: (id: string): Promise<Mod> => callBackend<Mod>('GetMod', id),
  inspectMod: (id: string): Promise<FileInfo> => callBackend<FileInfo>('InspectMod', id),
  getModArtwork: (idOrPath: string): Promise<{ hasArt: boolean; lumpName: string; dataUri: string }> =>
    callBackend<{ hasArt: boolean; lumpName: string; dataUri: string }>('GetModArtwork', idOrPath),
  toggleModFavorite: (id: string): Promise<boolean> => callBackend<boolean>('ToggleModFavorite', id),
  deleteMod: (id: string): Promise<void> => callBackend<void>('DeleteMod', id),
  importModFile: (path: string): Promise<Mod> => callBackend<Mod>('ImportModFile', path),
  getModUsageCounts: (): Promise<Record<string, number>> =>
    callBackend<Record<string, number>>('GetModUsageCounts'),
  // IWADs
  listIWADs: (): Promise<IWAD[]> => callBackend<IWAD[]>('ListIWADs'),
  getIWAD: (id: string): Promise<IWAD> => callBackend<IWAD>('GetIWAD', id),
  registerIWADFile: (path: string): Promise<IWAD> => callBackend<IWAD>('RegisterIWADFile', path),
  addIWAD: (iwad: Partial<IWAD>): Promise<IWAD> => callBackend<IWAD>('AddIWAD', iwad),
  updateIWAD: (iwad: IWAD): Promise<void> => callBackend<void>('UpdateIWAD', iwad),
  deleteIWAD: (id: string): Promise<void> => callBackend<void>('DeleteIWAD', id),

  // Engines
  listEngines: (): Promise<Engine[]> => callBackend<Engine[]>('ListEngines'),
  getEngine: (id: string): Promise<Engine> => callBackend<Engine>('GetEngine', id),
  addEngine: (engine: Partial<Engine>): Promise<Engine> => callBackend<Engine>('AddEngine', engine),
  updateEngine: (engine: Engine): Promise<void> => callBackend<void>('UpdateEngine', engine),
  deleteEngine: (id: string): Promise<void> => callBackend<void>('DeleteEngine', id),
  detectEngineVersion: (execPath: string): Promise<{ version: string; family: EngineFamily }> =>
    callBackend<{ version: string; family: EngineFamily }>('DetectEngineVersion', execPath),
  validateEngineExecutable: (execPath: string): Promise<void> =>
    callBackend<void>('ValidateEngineExecutable', execPath),

  // Profiles
  listProfiles: (): Promise<Profile[]> => callBackend<Profile[]>('ListProfiles'),
  getProfile: (id: string): Promise<Profile> => callBackend<Profile>('GetProfile', id),
  createProfile: (profile: Partial<Profile>): Promise<Profile> => callBackend<Profile>('CreateProfile', profile),
  updateProfile: (profile: Profile): Promise<void> => callBackend<void>('UpdateProfile', profile),
  deleteProfile: (id: string): Promise<void> => callBackend<void>('DeleteProfile', id),
  duplicateProfile: (id: string, newName: string): Promise<Profile> =>
    callBackend<Profile>('DuplicateProfile', id, newName),
  toggleProfileFavorite: (id: string): Promise<void> => callBackend<void>('ToggleProfileFavorite', id),
  addModToProfile: (profileId: string, modId: string): Promise<void> =>
    callBackend<void>('AddModToProfile', profileId, modId),
  removeModFromProfile: (profileId: string, modId: string): Promise<void> =>
    callBackend<void>('RemoveModFromProfile', profileId, modId),
  reorderProfileMods: (profileId: string, modIdsInOrder: string[]): Promise<void> =>
    callBackend<void>('ReorderProfileMods', profileId, modIdsInOrder),
  toggleProfileMod: (profileId: string, modId: string, enabled: boolean): Promise<void> =>
    callBackend<void>('ToggleProfileMod', profileId, modId, enabled),
  exportProfileYAML: (profileId: string): Promise<string> => callBackend<string>('ExportProfileYAML', profileId),
  importProfileYAML: (yamlContent: string): Promise<Record<string, unknown>> =>
    callBackend<Record<string, unknown>>('ImportProfileYAML', yamlContent),
  importProfileZDL: (zdlContent: string): Promise<Record<string, unknown>> =>
    callBackend<Record<string, unknown>>('ImportProfileZDL', zdlContent),
  openProfileSaveFolder: (profileId: string): Promise<void> =>
    callBackend<void>('OpenProfileSaveFolder', profileId),
  getProfileSaveDir: (profileId: string): Promise<string> =>
    callBackend<string>('GetProfileSaveDir', profileId),
  // Validator & Launcher
  validateProfile: (profileId: string): Promise<ValidationResult> =>
    callBackend<ValidationResult>('ValidateProfile', profileId),
  launchProfile: (profileId: string): Promise<LaunchRecord> =>
    callBackend<LaunchRecord>('LaunchProfile', profileId),
  getActiveLaunches: (): Promise<ActiveLaunch[]> => callBackend<ActiveLaunch[]>('GetActiveLaunches'),
  killLaunch: (id: string): Promise<void> => callBackend<void>('KillLaunch', id),

  // Scanner
  startScan: (): Promise<ScanResult> => callBackend<ScanResult>('StartScan'),
  isScanning: (): Promise<boolean> => callBackend<boolean>('IsScanning'),

  // History & Settings
  listLaunchHistory: (limit: number = 50): Promise<LaunchRecord[]> =>
    callBackend<LaunchRecord[]>('ListLaunchHistory', limit),
  getHistoryStats: (): Promise<HistoryStats> => callBackend<HistoryStats>('GetHistoryStats'),
  clearLaunchHistory: (): Promise<void> => callBackend<void>('ClearLaunchHistory'),
  getSettings: (): Promise<Settings> => callBackend<Settings>('GetSettings'),
  updateSettings: (settings: Settings): Promise<void> => callBackend<void>('UpdateSettings', settings),

  // Native Dialogs & System Helpers
  openFileDialog: (title: string = 'Select File', defaultDir: string = '', extensions: string[] = []): Promise<string> =>
    callBackend<string>('OpenFileDialog', title, defaultDir, extensions),
  openDirectoryDialog: (title: string = 'Select Directory', defaultDir: string = ''): Promise<string> =>
    callBackend<string>('OpenDirectoryDialog', title, defaultDir),

  // Diagnostics & Health
  runDiagnostics: (): Promise<DiagnosticsReport> => callBackend<DiagnosticsReport>('RunDiagnostics'),
  repairDiagnosticIssue: (action: string, targetId: string = ''): Promise<void> =>
    callBackend<void>('RepairDiagnosticIssue', action, targetId),
  getSystemLogs: (): Promise<LogEntry[]> => callBackend<LogEntry[]>('GetSystemLogs'),
  clearSystemLogs: (): Promise<void> => callBackend<void>('ClearSystemLogs'),
  openPathInExplorer: (path: string): Promise<void> => callBackend<void>('OpenPathInExplorer', path),

  // /idgames Archive
  searchIdgames: (query: string): Promise<IdgamesFile[]> =>
    callBackend<IdgamesFile[]>('SearchIdgames', query),
  downloadIdgamesMod: (file: IdgamesFile): Promise<Mod> =>
    callBackend<Mod>('DownloadIdgamesMod', file),
}
