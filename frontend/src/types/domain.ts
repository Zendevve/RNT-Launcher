/**
 * RNT Launcher - Core Domain Types
 * Matches Go backend models in internal/domain/models.go & internal/filesystem/inspector.go
 */

export type ModFormat =
  | 'wad'
  | 'pk3'
  | 'pk7'
  | 'ipk3'
  | 'zip'
  | 'deh'
  | 'bex'
  | 'unknown'
  | string

export type ModCategory =
  | 'Gameplay'
  | 'Maps'
  | 'Megawads'
  | 'Weapons'
  | 'Monsters'
  | 'Textures'
  | 'Audio'
  | 'UI'
  | 'Utility'
  | 'Other'
  | 'Unknown'
  | 'all'
  | 'gameplay'
  | 'maps'
  | 'weapons'
  | 'monsters'
  | 'textures'
  | 'sound'
  | 'total-conversion'
  | 'utility'
  | 'other'
  | string

export interface Mod {
  id: string
  name: string
  path: string
  format: ModFormat
  category: ModCategory
  size: number
  modifiedAt?: string
  modified_at?: string
  sha256: string
  lumpCount?: number
  lump_count?: number
  structures: string[]
  isFavorite: boolean
  is_favorite?: boolean
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export interface ModFilter {
  search?: string
  category?: ModCategory | string
  format?: ModFormat | string
  isFavorite?: boolean
  is_favorite?: boolean
  favorites_only?: boolean
  favoritesOnly?: boolean
  limit?: number
  offset?: number
}

export type EngineFamily =
  | 'gzdoom'
  | 'zandronum'
  | 'dsda-doom'
  | 'prboom-plus'
  | 'woof'
  | 'crispy-doom'
  | 'chocolate-doom'
  | 'other'
  | string

export interface Engine {
  id: string
  name: string
  executable: string
  version: string
  family: EngineFamily
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type IWADType =
  | 'doom'
  | 'doom2'
  | 'tnt'
  | 'plutonia'
  | 'heretic'
  | 'hexen'
  | 'strife'
  | 'freedoom'
  | 'freedoom1'
  | 'freedoom2'
  | 'chex'
  | 'hacx'
  | 'other'
  | 'unknown'
  | string

export interface IWAD {
  id: string
  name: string
  path: string
  type: IWADType
  lumpCount?: number
  lump_count?: number
  size: number
  sha256: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export interface ProfileMod {
  id: string
  profileId?: string
  profile_id?: string
  modId: string
  mod_id?: string
  modName: string
  mod_name?: string
  modPath: string
  mod_path?: string
  modFormat: ModFormat
  mod_format?: ModFormat
  enabled: boolean
  order: number
}

export interface Profile {
  id: string
  name: string
  description: string
  engineId: string
  engine_id?: string
  engineName: string
  engine_name?: string
  iwadId: string
  iwad_id?: string
  iwadName: string
  iwad_name?: string
  parentProfileId?: string
  parent_profile_id?: string
  isolateSaves?: boolean
  isolate_saves?: boolean
  mods: ProfileMod[]
  arguments: string[]
  workingDir: string
  working_dir?: string
  isFavorite: boolean
  is_favorite?: boolean
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type ValidationSeverity = 'info' | 'warning' | 'error'

export interface ValidationItem {
  severity: ValidationSeverity
  code: string
  message: string
  target: string
}

export type ValidationStatus = 'READY' | 'READY_WITH_WARNINGS' | 'CANNOT_LAUNCH'

export interface ValidationResult {
  status: ValidationStatus
  items: ValidationItem[]
  engine?: Engine
  iwad?: IWAD
  enabledMods?: ProfileMod[]
  enabled_mods?: ProfileMod[]
}

export interface LaunchRecord {
  id: string
  profileId: string
  profile_id?: string
  profileName: string
  profile_name?: string
  engineName: string
  engine_name?: string
  iwadName: string
  iwad_name?: string
  startedAt: string
  started_at?: string
  finishedAt?: string
  finished_at?: string
  durationMs: number
  duration_ms?: number
  exitCode?: number
  exit_code?: number
  status: 'success' | 'failed' | string
  commandLine?: string
  command_line?: string
}

export interface ActiveLaunch {
  id: string
  profileId: string
  profile_id?: string
  profileName: string
  profile_name?: string
  engineName: string
  engine_name?: string
  iwadName: string
  iwad_name?: string
  pid: number
  startedAt: string
  started_at?: string
  commandLine?: string
  command_line?: string
}

export type ActiveLaunchInfo = ActiveLaunch

export interface ScanProgress {
  current: number
  total: number
  currentFile: string
}

export interface ScanResult {
  discoveredMods: number
  discovered_mods?: number
  discoveredIWADs: number
  discovered_iwads?: number
  discoveredEngines: number
  discovered_engines?: number
  errors: string[]
}

export interface Settings {
  modDirectories: string[]
  mod_directories?: string[]
  iwadDirectories: string[]
  iwad_directories?: string[]
  engineDirectories: string[]
  engine_directories?: string[]
  defaultWorkingDir: string
  default_working_dir?: string
  theme: string
  confirmLaunch: boolean
  confirm_launch?: boolean
  autoScanOnStartup: boolean
  auto_scan_on_startup?: boolean
  closeOnLaunch: boolean
  close_on_launch?: boolean
}

export interface HistoryStats {
  totalLaunches: number
  total_launches?: number
  totalPlayTimeMs: number
  total_playtime_ms?: number
  lastLaunchedAt?: string
  last_played?: string
  mostPlayedProfileId?: string
  mostPlayedProfileName?: string
}

export interface DashboardStats {
  totalMods: number
  totalIWADs: number
  totalEngines: number
  totalProfiles: number
  totalLaunches: number
  totalPlayTimeMs: number
  recentProfiles: Profile[]
  recentLaunches: LaunchRecord[]
}

export interface FileInfo {
  path: string
  filename?: string
  name?: string
  size: number
  format: string
  category: string
  isIwad?: boolean
  is_iwad?: boolean
  lumpCount?: number
  lump_count?: number
  maps: string[]
  structures: string[]
  sha256: string
  modTime?: string
  wadInfo?: {
    type: string
    lumpCount: number
  }
  archiveInfo?: {
    format: string
    fileCount: number
    uncompressedSize: number
    hasMapinfo: boolean
    hasZscript: boolean
    hasDecorate: boolean
  }
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info'
export type DiagnosticCategory = 'database' | 'engine' | 'iwad' | 'library' | 'profile'

export interface DiagnosticIssue {
  id: string
  category: DiagnosticCategory
  severity: DiagnosticSeverity
  title: string
  description: string
  targetId?: string
  target_id?: string
  targetPath?: string
  target_path?: string
  canRepair: boolean
  can_repair?: boolean
  repairAction?: string
  repair_action?: string
  repairDescription?: string
  repair_description?: string
}

export interface DatabaseHealth {
  status: string
  path: string
  integrityCheck: string
  integrity_check?: string
  modCount: number
  mod_count?: number
  iwadCount: number
  iwad_count?: number
  engineCount: number
  engine_count?: number
  profileCount: number
  profile_count?: number
  historyCount: number
  history_count?: number
}

export interface DiagnosticsSummary {
  totalIssues: number
  total_issues?: number
  errorCount: number
  error_count?: number
  warningCount: number
  warning_count?: number
  infoCount: number
  info_count?: number
}

export interface DiagnosticsReport {
  overallStatus: 'healthy' | 'warning' | 'error' | string
  overall_status?: string
  database: DatabaseHealth
  issues: DiagnosticIssue[]
  summary: DiagnosticsSummary
  generatedAt: string
  generated_at?: string
}

export interface LogEntry {
  timestamp: string
  level: string
  message: string
  fields?: Record<string, unknown>
}

export interface Bitflag {
  value: number
  name: string
  description: string
  category: string
}

export interface IdgamesFile {
  id: number
  title: string
  dir: string
  filename: string
  size: number
  age: number
  date: string
  author: string
  description: string
  rating: number
  votes: number
  url: string
}
