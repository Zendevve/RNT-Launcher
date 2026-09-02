import { FULL_VERSION } from '../../version';
import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  FolderPlus,
  Trash2,
  Save,
  RotateCcw,
  Database,
  Layers,
  Cpu,
  Disc,
  ExternalLink,
  Sliders,
  Layout,
  Eye,
  Flame,
  CheckSquare,
  Square,
  Maximize2,
  Minimize2,
  Clock,
  Activity,
} from 'lucide-react';
import { EnginesView } from '../engines/EnginesView';
import { IWADsView } from '../iwads/IWADsView';
import { HistoryView } from '../history/HistoryView';
import { DiagnosticsView } from '../diagnostics/DiagnosticsView';
import { Settings, DefaultNavView } from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { BRAND_TAGLINE, BRAND_PILLARS, SUPPORTED_FORMATS, FORMAT_DESCRIPTIONS } from '../../lib/constants';

const DEFAULT_SETTINGS: Settings = {
  modDirectories: [],
  iwadDirectories: [],
  engineDirectories: [],
  defaultWorkingDir: '',
  theme: 'doom-dark',
  confirmLaunch: false,
  autoScanOnStartup: true,
  closeOnLaunch: false,
  uiDensity: 'compact',
  showFilePaths: false,
  showRecentLaunches: 3,
  formatVisibility: ['wad', 'pk3', 'pk7', 'ipk3', 'zip', 'deh', 'bex'],
  defaultView: 'dashboard',
};

const VIEW_OPTIONS: { id: DefaultNavView; label: string; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Overview, quick launch, and system status' },
  { id: 'profiles', label: 'Profiles', description: 'Preset launcher configurations and load orders' },
  { id: 'library', label: 'Mod Library', description: 'Catalog of scanned and imported mod files' },
  { id: 'iwads', label: 'IWADs', description: 'Base game packages and binary lump data' },
  { id: 'engines', label: 'Engines', description: 'Configured source ports and executables' },
  { id: 'history', label: 'History', description: 'Telemetry logs and session playtime stats' },
  { id: 'diagnostics', label: 'Diagnostics', description: 'Integrity checks and system health repair' },
  { id: 'settings', label: 'Settings', description: 'Directories and application preferences' },
];

export type SettingsTabId =
  | 'engines'
  | 'iwads'
  | 'directories'
  | 'history'
  | 'diagnostics'
  | 'preferences';

export interface SettingsViewProps {
  initialTab?: SettingsTabId;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ initialTab = 'engines' }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Reset confirmation modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  // Load settings from backend
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getSettings();
      if (data) {
        const normalized: Settings = {
          modDirectories: Array.isArray(data.modDirectories) ? data.modDirectories : [],
          iwadDirectories: Array.isArray(data.iwadDirectories) ? data.iwadDirectories : [],
          engineDirectories: Array.isArray(data.engineDirectories) ? data.engineDirectories : [],
          defaultWorkingDir: data.defaultWorkingDir || '',
          theme: data.theme || 'doom-dark',
          confirmLaunch: Boolean(data.confirmLaunch),
          autoScanOnStartup: data.autoScanOnStartup ?? true,
          closeOnLaunch: Boolean(data.closeOnLaunch),
          uiDensity: data.uiDensity || 'compact',
          showFilePaths: Boolean(data.showFilePaths),
          showRecentLaunches: typeof data.showRecentLaunches === 'number' ? data.showRecentLaunches : 3,
          formatVisibility: Array.isArray(data.formatVisibility) && data.formatVisibility.length > 0 ? data.formatVisibility : ['wad', 'pk3', 'pk7', 'ipk3', 'zip', 'deh', 'bex'],
          defaultView: (data.defaultView as DefaultNavView) || 'dashboard',
        };
        setSettings(normalized);
        setOriginalSettings(normalized);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch settings';
      toast.error('Settings Load Error', message);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Check if form has unsaved modifications
  const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  // Directory addition helper
  const handleAddDirectory = async (
    key: 'modDirectories' | 'iwadDirectories' | 'engineDirectories',
    dialogTitle: string
  ) => {
    try {
      const selected = await api.openDirectoryDialog(dialogTitle);
      if (selected && selected.trim()) {
        const cleanPath = selected.trim();
        if (settings[key].includes(cleanPath)) {
          toast.warning('Already Configured', 'This folder is already in the list.');
          return;
        }
        setSettings((prev) => ({
          ...prev,
          [key]: [...prev[key], cleanPath],
        }));
        toast.info('Directory Added', `Added ${cleanPath}. Click Save to persist.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Directory dialog failed';
      toast.error('Folder Selection Error', message);
    }
  };

  // Directory removal helper
  const handleRemoveDirectory = (
    key: 'modDirectories' | 'iwadDirectories' | 'engineDirectories',
    index: number
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  // Open directory in native file explorer
  const handleOpenExplorer = async (path: string) => {
    try {
      await api.openPathInExplorer(path);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not open folder in Explorer';
      toast.error('Explorer Launch Error', message);
    }
  };

  // Browse for default working directory
  const handleBrowseWorkingDir = async () => {
    try {
      const selected = await api.openDirectoryDialog('Select Default Working Directory');
      if (selected && selected.trim()) {
        setSettings((prev) => ({ ...prev, defaultWorkingDir: selected.trim() }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Folder selection failed';
      toast.error('Working Directory Error', message);
    }
  };

  // Format visibility toggles
  const handleToggleFormat = (fmt: string) => {
    const current = settings.formatVisibility || ['wad', 'pk3', 'pk7', 'ipk3', 'zip', 'deh', 'bex'];
    let updated: string[];
    if (current.includes(fmt)) {
      if (current.length === 1) {
        toast.warning('Minimum One Format', 'At least one format must remain visible.');
        return;
      }
      updated = current.filter((f) => f !== fmt);
    } else {
      updated = [...current, fmt];
    }
    setSettings((prev) => ({ ...prev, formatVisibility: updated }));
  };

  const handleSelectAllFormats = () => {
    setSettings((prev) => ({ ...prev, formatVisibility: [...SUPPORTED_FORMATS] }));
  };

  // Save updated settings to backend
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await api.updateSettings(settings);
      setOriginalSettings(settings);
      toast.success('Settings Saved', 'Application preferences successfully persisted.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      toast.error('Save Error', message);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default settings
  const handleConfirmReset = async () => {
    try {
      setSettings(DEFAULT_SETTINGS);
      await api.updateSettings(DEFAULT_SETTINGS);
      setOriginalSettings(DEFAULT_SETTINGS);
      setIsResetModalOpen(false);
      toast.success('Settings Reset', 'Preferences restored to default configuration.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset settings';
      toast.error('Reset Error', message);
    }
  };

  const ENGINE_ROOM_TABS: { id: SettingsTabId; label: string; sublabel: string; icon: React.ReactNode }[] = [
    {
      id: 'engines',
      label: 'Source Ports',
      sublabel: 'Engines',
      icon: <Cpu className="w-3.5 h-3.5 text-red-400" />,
    },
    {
      id: 'iwads',
      label: 'Base Games',
      sublabel: 'IWADs',
      icon: <Disc className="w-3.5 h-3.5 text-amber-400" />,
    },
    {
      id: 'directories',
      label: 'Scan Directories',
      sublabel: 'Folders',
      icon: <FolderOpen className="w-3.5 h-3.5 text-blue-400" />,
    },
    {
      id: 'history',
      label: 'Launch History',
      sublabel: 'Telemetry',
      icon: <Clock className="w-3.5 h-3.5 text-purple-400" />,
    },
    {
      id: 'diagnostics',
      label: 'Diagnostics',
      sublabel: 'Health',
      icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
    },
    {
      id: 'preferences',
      label: 'Preferences',
      sublabel: 'UI & System',
      icon: <Sliders className="w-3.5 h-3.5 text-zinc-400" />,
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0c0e10] text-zinc-100 select-none">
      {/* Engine Room Sub-Nav Tabs Header */}
      <div className="border-b border-white/[0.07] bg-[#14171a] px-6 py-2 flex items-center justify-between gap-4 flex-wrap shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {ENGINE_ROOM_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all select-none active:scale-[0.98] ${
                  isActive
                    ? 'bg-[#1c2026] text-white font-semibold border border-white/[0.12] shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {tab.icon}
                <span className="tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Header Actions for Directories and Preferences */}
        {(activeTab === 'preferences' || activeTab === 'directories') && (
          <div className="flex items-center gap-2.5">
            {isDirty && (
              <span className="rounded-full bg-[#2b2011] px-2 py-0.5 text-[10px] font-mono font-semibold text-[#fde047] border border-amber-800/40">
                Unsaved Changes
              </span>
            )}
            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsResetModalOpen(true)}
              leftIcon={<RotateCcw className="h-3 w-3" />}
            >
              Reset Defaults
            </Button>
            <Button
              variant="primary"
              size="xs"
              onClick={handleSaveSettings}
              isLoading={isSaving}
              disabled={!isDirty && !isLoading}
              leftIcon={<Save className="h-3.5 w-3.5" />}
            >
              Save Settings
            </Button>
          </div>
        )}
      </div>

      {/* Dynamic Tab Body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'engines' && <EnginesView />}
        {activeTab === 'iwads' && <IWADsView />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'diagnostics' && <DiagnosticsView />}

        {activeTab === 'directories' && (
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 max-w-5xl">
            {/* SECTION 2: Configured Content Directories */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-red-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                    Content Search Directories
                  </h2>
                </div>
                <span className="text-xs text-zinc-400 font-mono">
                  {settings.modDirectories.length +
                    settings.iwadDirectories.length +
                    settings.engineDirectories.length}{' '}
                  total paths monitored
                </span>
              </div>

              {/* Mod Directories */}
              <div className="p-5 rounded-xl bg-[#15181c] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                      {'Mod & PWAD Directories'}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      ({settings.modDirectories.length} configured)
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => handleAddDirectory('modDirectories', 'Select Mod Directory')}
                    leftIcon={<FolderPlus className="h-3.5 w-3.5 text-blue-400" />}
                  >
                    Add Mod Folder
                  </Button>
                </div>

                {settings.modDirectories.length === 0 ? (
                  <div className="p-4 text-center rounded-xl bg-black/30 border border-dashed border-white/[0.08] text-xs text-zinc-500">
                    No mod folders added yet. Click &ldquo;Add Mod Folder&rdquo; to configure scanned locations.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {settings.modDirectories.map((dir, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/[0.06] text-xs font-mono"
                      >
                        <span className="truncate text-zinc-200" title={dir}>
                          {dir}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => handleOpenExplorer(dir)}
                            className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                            title="Show in Explorer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDirectory('modDirectories', idx)}
                            className="p-1 rounded hover:bg-red-950/60 text-zinc-400 hover:text-red-300 transition-colors"
                            title="Remove Folder"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* IWAD Directories */}
              <div className="p-5 rounded-xl bg-[#15181c] border border-white/[0.08] space-y-3">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Disc className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                      Base Game IWAD Directories
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      ({settings.iwadDirectories.length} configured)
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => handleAddDirectory('iwadDirectories', 'Select Base IWAD Directory')}
                    leftIcon={<FolderPlus className="h-3.5 w-3.5 text-amber-400" />}
                  >
                    Add IWAD Folder
                  </Button>
                </div>

                {settings.iwadDirectories.length === 0 ? (
                  <div className="p-4 text-center rounded-xl bg-black/30 border border-dashed border-white/[0.08] text-xs text-zinc-500">
                    No IWAD folders added yet. Standard doom installation paths will be scanned automatically.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {settings.iwadDirectories.map((dir, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/[0.06] text-xs font-mono"
                      >
                        <span className="truncate text-zinc-200" title={dir}>
                          {dir}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => handleOpenExplorer(dir)}
                            className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                            title="Show in Explorer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDirectory('iwadDirectories', idx)}
                            className="p-1 rounded hover:bg-red-950/60 text-zinc-400 hover:text-red-300 transition-colors"
                            title="Remove Folder"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Engine Directories */}
              <div className="p-5 rounded-xl bg-[#15181c] border border-white/[0.08] space-y-3">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-red-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                      {'Source Port & Engine Directories'}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      ({settings.engineDirectories.length} configured)
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => handleAddDirectory('engineDirectories', 'Select Engine Directory')}
                    leftIcon={<FolderPlus className="h-3.5 w-3.5 text-red-400" />}
                  >
                    Add Engine Folder
                  </Button>
                </div>

                {settings.engineDirectories.length === 0 ? (
                  <div className="p-4 text-center rounded-xl bg-black/30 border border-dashed border-white/[0.08] text-xs text-zinc-500">
                    No engine folders added yet. Click &ldquo;Add Engine Folder&rdquo; to monitor source port installations.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {settings.engineDirectories.map((dir, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/[0.06] text-xs font-mono"
                      >
                        <span className="truncate text-zinc-200" title={dir}>
                          {dir}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => handleOpenExplorer(dir)}
                            className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                            title="Show in Explorer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDirectory('engineDirectories', idx)}
                            className="p-1 rounded hover:bg-red-950/60 text-zinc-400 hover:text-red-300 transition-colors"
                            title="Remove Folder"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 max-w-5xl">
            {/* BRAND & DESIGN PHILOSOPHY CARD */}
            <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#15181c] p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#dc2626] text-white border border-red-500/30">
                  <Flame className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold uppercase tracking-tight text-sm text-white">
                      RNT Launcher Design Philosophy
                    </span>
                    <span className="rounded-full bg-[#2b1416] px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase text-[#fca5a5] border border-red-800/40">
                      Beautifully Simple
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-300 font-sans italic">
                    &ldquo;{BRAND_TAGLINE}&rdquo;
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
                    {BRAND_PILLARS.map((pillar) => (
                      <div
                        key={pillar.title}
                        className="rounded-xl bg-black/40 border border-white/[0.06] p-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-white tracking-tight">{pillar.title}</span>
                            <span className="text-[9px] font-mono text-red-400 uppercase font-semibold">{pillar.subtitle}</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{pillar.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 1: Interface & Density Preferences */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-white/[0.08]">
                <Layout className="h-4 w-4 text-amber-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  {'Interface & Density Preferences'}
                </h2>
              </div>

              <div className="p-5 rounded-xl bg-[#15181c] border border-white/[0.08] space-y-5">
                {/* UI Density Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                    <span>UI Density Mode</span>
                    <span className="text-[11px] font-normal text-zinc-400">
                      Controls vertical rhythm, table padding, and data density
                    </span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, uiDensity: 'compact' }))}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                        settings.uiDensity === 'compact'
                          ? 'border-red-500/80 bg-[#2b1416] text-white font-semibold'
                          : 'border-white/[0.08] bg-black/30 hover:border-white/[0.18] text-zinc-400'
                      }`}
                    >
                      <Minimize2 className={`h-5 w-5 shrink-0 mt-0.5 ${settings.uiDensity === 'compact' ? 'text-red-400' : 'text-zinc-500'}`} />
                      <div>
                        <span className="text-xs font-bold block">Compact Density</span>
                        <span className="text-[11px] text-zinc-400 leading-snug mt-0.5 block">
                          Tight padding and high data density. Ideal for large mod catalogs.
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, uiDensity: 'comfortable' }))}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                        settings.uiDensity === 'comfortable'
                          ? 'border-red-500/80 bg-[#2b1416] text-white font-semibold'
                          : 'border-white/[0.08] bg-black/30 hover:border-white/[0.18] text-zinc-400'
                      }`}
                    >
                      <Maximize2 className={`h-5 w-5 shrink-0 mt-0.5 ${settings.uiDensity === 'comfortable' ? 'text-red-400' : 'text-zinc-500'}`} />
                      <div>
                        <span className="text-xs font-bold block">Comfortable Density</span>
                        <span className="text-[11px] text-zinc-400 leading-snug mt-0.5 block">
                          Spacious touch targets and generous margins for relaxed navigation.
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Default Startup View Selector */}
                <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Default Startup View</span>
                    <span className="text-[11px] font-normal text-zinc-400">
                      Screen opened automatically when launcher starts
                    </span>
                  </label>
                  <select
                    value={settings.defaultView || 'dashboard'}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        defaultView: e.target.value as DefaultNavView,
                      }))
                    }
                    className="w-full h-9 px-3 bg-black/40 text-zinc-100 text-xs rounded-lg border border-white/[0.08] focus:border-doom-red focus:ring-1 focus:ring-doom-red focus:outline-none font-mono"
                  >
                    {VIEW_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id} className="bg-[#14171a] text-zinc-100">
                        {opt.label} ({opt.description})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Format Visibility Filter Checkboxes */}
                <div className="space-y-2.5 pt-3 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Format Visibility Filters</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleSelectAllFormats}
                      className="text-[11px] text-red-400 hover:text-red-300 transition-colors font-mono"
                    >
                      Select All Formats
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
                    {SUPPORTED_FORMATS.map((fmt) => {
                      const isChecked = (settings.formatVisibility || []).includes(fmt);
                      return (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => handleToggleFormat(fmt)}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${
                            isChecked
                              ? 'bg-[#1c2026] border-white/[0.12] text-zinc-200'
                              : 'bg-black/20 border-white/[0.04] text-zinc-500 hover:text-zinc-400'
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="h-3.5 w-3.5 text-red-400 shrink-0" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-bold uppercase block">{fmt}</span>
                            <span className="text-[10px] text-zinc-400 truncate block">
                              {FORMAT_DESCRIPTIONS[fmt]?.description || fmt}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Launch & Execution Behavior */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-white/[0.08]">
                <Sliders className="h-4 w-4 text-blue-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  {'Launch & Process Execution Behavior'}
                </h2>
              </div>

              <div className="p-5 rounded-xl bg-[#15181c] border border-white/[0.08] space-y-4">
                {/* Default Working Directory */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                    Default Working Directory
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={settings.defaultWorkingDir || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, defaultWorkingDir: e.target.value }))
                      }
                      placeholder="Engine execution directory (leave empty to use executable's parent folder)"
                      className="font-mono text-xs"
                    />
                    <Button variant="secondary" size="sm" onClick={handleBrowseWorkingDir}>
                      Browse
                    </Button>
                  </div>
                </div>

                {/* Checkbox behaviors */}
                <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                  {/* Confirm before launch */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={settings.confirmLaunch}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, confirmLaunch: e.target.checked }))
                      }
                      className="mt-0.5 h-4 w-4 rounded border-white/[0.1] bg-black/40 text-doom-red focus:ring-doom-red accent-doom-red"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors block">
                        Show pre-flight confirmation before launching games
                      </span>
                      <span className="text-[11px] text-zinc-400 block">
                        Displays pre-flight validation status, active mod counts, and parameters before spawning the engine process.
                      </span>
                    </div>
                  </label>

                  {/* Close launcher on game start */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={settings.closeOnLaunch}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, closeOnLaunch: e.target.checked }))
                      }
                      className="mt-0.5 h-4 w-4 rounded border-white/[0.1] bg-black/40 text-doom-red focus:ring-doom-red accent-doom-red"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors block">
                        Minimize or close launcher on game launch
                      </span>
                      <span className="text-[11px] text-zinc-400 block">
                        Releases system memory while the source port is active.
                      </span>
                    </div>
                  </label>

                  {/* Auto-scan on startup */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={settings.autoScanOnStartup}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, autoScanOnStartup: e.target.checked }))
                      }
                      className="mt-0.5 h-4 w-4 rounded border-white/[0.1] bg-black/40 text-doom-red focus:ring-doom-red accent-doom-red"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors block">
                        Automatic background asset scan on startup
                      </span>
                      <span className="text-[11px] text-zinc-400 block">
                        Periodically checks configured folders in background for newly added WAD and PK3 files upon launch.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* SECTION 4: Application System Info & Version */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-white/[0.08]">
                <Database className="h-4 w-4 text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  {'Application Metadata & Version'}
                </h2>
              </div>

              <div className="p-5 rounded-xl bg-[#15181c] border border-white/[0.08] space-y-3 text-xs font-mono">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-zinc-500 uppercase text-[10px] block font-semibold">Version</span>
                    <span className="font-bold text-white mt-0.5 block">{FULL_VERSION}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase text-[10px] block font-semibold">Database Engine</span>
                    <span className="text-zinc-200 mt-0.5 block">SQLite 3 (Pure Go)</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase text-[10px] block font-semibold">GUI Framework</span>
                    <span className="text-zinc-200 mt-0.5 block">Wails v2 Desktop Bridge</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase text-[10px] block font-semibold">Theme Palette</span>
                    <span className="text-red-400 font-bold mt-0.5 block">Doom Minimalist Monolith</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Reset Preferences to Defaults"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsResetModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmReset}>
              Reset Defaults
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-300 leading-relaxed">
          Are you sure you want to reset all preferences to their original factory defaults?
          Your scanned mods, IWADs, and custom profiles will not be removed.
        </p>
      </Modal>
    </div>
  );
};
