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
import { SUPPORTED_FORMATS, FORMAT_DESCRIPTIONS } from '../../lib/constants';

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
  { id: 'dashboard', label: 'Play (The Launchpad)', description: 'Quick launch, active preset stage, and engine controls' },
  { id: 'profiles', label: 'Profiles', description: 'Preset launcher configurations and load orders' },
  { id: 'library', label: 'Mods (The Collection)', description: 'Catalog of scanned and imported mod files' },
  { id: 'iwads', label: 'Base Games (IWADs)', description: 'Base game packages and binary lump data' },
  { id: 'engines', label: 'Source Ports (Engines)', description: 'Configured source ports and executables' },
  { id: 'history', label: 'Launch History', description: 'Telemetry logs and session playtime stats' },
  { id: 'diagnostics', label: 'System Diagnostics', description: 'Integrity checks and system health repair' },
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
          formatVisibility:
            Array.isArray(data.formatVisibility) && data.formatVisibility.length > 0
              ? data.formatVisibility
              : ['wad', 'pk3', 'pk7', 'ipk3', 'zip', 'deh', 'bex'],
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
      icon: <Cpu className="w-3.5 h-3.5 text-zinc-400" />,
    },
    {
      id: 'iwads',
      label: 'Base Games',
      sublabel: 'IWADs',
      icon: <Disc className="w-3.5 h-3.5 text-zinc-400" />,
    },
    {
      id: 'directories',
      label: 'Scan Directories',
      sublabel: 'Folders',
      icon: <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />,
    },
    {
      id: 'history',
      label: 'Launch History',
      sublabel: 'Telemetry',
      icon: <Clock className="w-3.5 h-3.5 text-zinc-400" />,
    },
    {
      id: 'diagnostics',
      label: 'System Diagnostics',
      sublabel: 'Health',
      icon: <Activity className="w-3.5 h-3.5 text-zinc-400" />,
    },
    {
      id: 'preferences',
      label: 'Preferences',
      sublabel: 'Config',
      icon: <Sliders className="w-3.5 h-3.5 text-zinc-400" />,
    },
  ];

  const totalDirectoriesConfigured =
    settings.modDirectories.length + settings.iwadDirectories.length + settings.engineDirectories.length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0c0e12] text-zinc-100 select-none">
      {/* Sub-Tab Navigation Bar */}
      <div className="border-b border-[#22262d] bg-[#101317] px-6 py-2 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {ENGINE_ROOM_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 select-none ${
                  isActive
                    ? 'bg-[#1b1f26] text-zinc-100 font-semibold border border-white/[0.12] shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {tab.icon}
                <span className="tracking-tight">{tab.label}</span>
                {tab.id === 'directories' && totalDirectoriesConfigured > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-black/40 text-zinc-200' : 'bg-black/30 text-zinc-500'
                    }`}
                  >
                    {totalDirectoriesConfigured}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Header Actions for Directories and Preferences */}
        {(activeTab === 'preferences' || activeTab === 'directories') && (
          <div className="flex items-center gap-2.5">
            {isDirty && (
              <span className="rounded-md bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-800/40">
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
              disabled={!isDirty || isSaving || isLoading}
              leftIcon={<Save className="h-3 w-3" />}
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

        {/* Scan Directories Tab */}
        {activeTab === 'directories' && (
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 max-w-5xl">
            {/* Section Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#22262d]">
              <div className="flex items-center gap-2.5">
                <FolderOpen className="h-4 w-4 text-zinc-400" />
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">Content Search Directories</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Configure filesystem directories scanned for base games, engine binaries, and modification archives.
                  </p>
                </div>
              </div>
              <span className="text-xs text-zinc-400 font-mono bg-[#14171c] border border-[#22262d] px-2 py-0.5 rounded-md">
                {totalDirectoriesConfigured} paths monitored
              </span>
            </div>

            {/* Mod Directories */}
            <div className="p-5 rounded-lg bg-[#14171c] border border-[#22262d] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-400" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200">Mod & PWAD Directories</span>
                    <span className="text-xs text-zinc-400 ml-2 font-mono">
                      ({settings.modDirectories.length} configured)
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Scanned for .wad, .pk3, .pk7, and .zip files.</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => handleAddDirectory('modDirectories', 'Select Mod Directory')}
                  leftIcon={<FolderPlus className="h-3.5 w-3.5" />}
                >
                  Add Mod Folder
                </Button>
              </div>

              {settings.modDirectories.length === 0 ? (
                <div className="p-4 text-center rounded-md bg-black/20 border border-dashed border-[#22262d] text-xs text-zinc-500">
                  No mod folders added yet. Click Add Mod Folder to configure scanned locations.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {settings.modDirectories.map((dir, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-md bg-black/30 border border-[#22262d] text-xs font-mono hover:bg-[#1b1f26] transition-colors duration-150"
                    >
                      <span className="truncate text-zinc-200" title={dir}>
                        {dir}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => handleOpenExplorer(dir)}
                          className="p-1 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 transition-colors duration-150"
                          title="Show in Explorer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveDirectory('modDirectories', idx)}
                          className="p-1 rounded-md hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors duration-150"
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
            <div className="p-5 rounded-lg bg-[#14171c] border border-[#22262d] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Disc className="h-4 w-4 text-amber-400" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200">Base Game IWAD Directories</span>
                    <span className="text-xs text-zinc-400 ml-2 font-mono">
                      ({settings.iwadDirectories.length} configured)
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Scanned for base game packages (DOOM.WAD, DOOM2.WAD, etc.).</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => handleAddDirectory('iwadDirectories', 'Select Base IWAD Directory')}
                  leftIcon={<FolderPlus className="h-3.5 w-3.5" />}
                >
                  Add IWAD Folder
                </Button>
              </div>

              {settings.iwadDirectories.length === 0 ? (
                <div className="p-4 text-center rounded-md bg-black/20 border border-dashed border-[#22262d] text-xs text-zinc-500">
                  No IWAD folders added yet. Standard Doom installation paths will be scanned automatically.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {settings.iwadDirectories.map((dir, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-md bg-black/30 border border-[#22262d] text-xs font-mono hover:bg-[#1b1f26] transition-colors duration-150"
                    >
                      <span className="truncate text-zinc-200" title={dir}>
                        {dir}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => handleOpenExplorer(dir)}
                          className="p-1 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 transition-colors duration-150"
                          title="Show in Explorer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveDirectory('iwadDirectories', idx)}
                          className="p-1 rounded-md hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors duration-150"
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
            <div className="p-5 rounded-lg bg-[#14171c] border border-[#22262d] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-emerald-400" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200">Source Port & Engine Directories</span>
                    <span className="text-xs text-zinc-400 ml-2 font-mono">
                      ({settings.engineDirectories.length} configured)
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Scanned for engine executables and port installations.</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => handleAddDirectory('engineDirectories', 'Select Engine Directory')}
                  leftIcon={<FolderPlus className="h-3.5 w-3.5" />}
                >
                  Add Engine Folder
                </Button>
              </div>

              {settings.engineDirectories.length === 0 ? (
                <div className="p-4 text-center rounded-md bg-black/20 border border-dashed border-[#22262d] text-xs text-zinc-500">
                  No engine folders added yet. Click Add Engine Folder to monitor source port installations.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {settings.engineDirectories.map((dir, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-md bg-black/30 border border-[#22262d] text-xs font-mono hover:bg-[#1b1f26] transition-colors duration-150"
                    >
                      <span className="truncate text-zinc-200" title={dir}>
                        {dir}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => handleOpenExplorer(dir)}
                          className="p-1 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 transition-colors duration-150"
                          title="Show in Explorer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveDirectory('engineDirectories', idx)}
                          className="p-1 rounded-md hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors duration-150"
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
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 max-w-5xl">
            {/* Section 1: Interface & Density Preferences */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-[#22262d]">
                <Layout className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-zinc-100">Interface & Density Preferences</h2>
              </div>

              <div className="p-5 rounded-lg bg-[#14171c] border border-[#22262d] space-y-5">
                {/* UI Density Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200">UI Density Mode</label>
                    <span className="text-[11px] text-zinc-400">Controls vertical rhythm, table padding, and data density</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, uiDensity: 'compact' }))}
                      className={`flex items-start gap-3 p-3.5 rounded-lg border text-left transition-colors duration-150 ${
                        settings.uiDensity === 'compact'
                          ? 'border-white/[0.2] bg-[#1b1f26] text-white shadow-xs'
                          : 'border-[#22262d] bg-black/20 hover:border-white/[0.12] text-zinc-400'
                      }`}
                    >
                      <Minimize2
                        className={`h-4 w-4 shrink-0 mt-0.5 ${
                          settings.uiDensity === 'compact' ? 'text-zinc-100' : 'text-zinc-500'
                        }`}
                      />
                      <div>
                        <span className="text-xs font-medium block text-zinc-200">Compact Density</span>
                        <span className="text-[11px] text-zinc-400 leading-snug mt-0.5 block">
                          Tight padding and high data density. Ideal for large mod catalogs.
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, uiDensity: 'comfortable' }))}
                      className={`flex items-start gap-3 p-3.5 rounded-lg border text-left transition-colors duration-150 ${
                        settings.uiDensity === 'comfortable'
                          ? 'border-white/[0.2] bg-[#1b1f26] text-white shadow-xs'
                          : 'border-[#22262d] bg-black/20 hover:border-white/[0.12] text-zinc-400'
                      }`}
                    >
                      <Maximize2
                        className={`h-4 w-4 shrink-0 mt-0.5 ${
                          settings.uiDensity === 'comfortable' ? 'text-zinc-100' : 'text-zinc-500'
                        }`}
                      />
                      <div>
                        <span className="text-xs font-medium block text-zinc-200">Comfortable Density</span>
                        <span className="text-[11px] text-zinc-400 leading-snug mt-0.5 block">
                          Spacious touch targets and generous margins for relaxed navigation.
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Default Startup View Selector */}
                <div className="space-y-1.5 pt-3 border-t border-[#22262d]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200">Default Startup View</label>
                    <span className="text-[11px] text-zinc-400">Screen opened automatically when launcher starts</span>
                  </div>
                  <select
                    value={settings.defaultView || 'dashboard'}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        defaultView: e.target.value as DefaultNavView,
                      }))
                    }
                    className="w-full h-8 px-3 bg-black/40 text-zinc-200 text-xs rounded-md border border-[#22262d] focus:border-white/[0.2] focus:outline-hidden"
                  >
                    {VIEW_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id} className="bg-[#14171c] text-zinc-200">
                        {opt.label} ({opt.description})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Format Visibility Filter Checkboxes */}
                <div className="space-y-2.5 pt-3 border-t border-[#22262d]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-zinc-400" />
                      <label className="text-xs font-semibold text-zinc-200">Format Visibility Filters</label>
                    </div>
                    <button
                      type="button"
                      onClick={handleSelectAllFormats}
                      className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors duration-150"
                    >
                      Select All Formats
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
                    {SUPPORTED_FORMATS.map((fmt) => {
                      const isChecked = settings.formatVisibility?.includes(fmt);
                      return (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => handleToggleFormat(fmt)}
                          className={`flex items-center gap-2.5 p-2 rounded-md border text-left transition-colors duration-150 ${
                            isChecked
                              ? 'bg-[#1b1f26] border-white/[0.14] text-zinc-200'
                              : 'bg-black/20 border-[#22262d] text-zinc-500 hover:text-zinc-400'
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="font-mono text-xs font-semibold uppercase block text-zinc-200">
                              .{fmt}
                            </span>
                            <span className="text-[10px] text-zinc-500 truncate block">
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

            {/* Section 2: Launch & Process Execution Behavior */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-[#22262d]">
                <Sliders className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-zinc-100">Launch & Process Execution Behavior</h2>
              </div>

              <div className="p-5 rounded-lg bg-[#14171c] border border-[#22262d] space-y-4">
                {/* Default Working Directory */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200">Default Working Directory</label>
                    <span className="text-[11px] text-zinc-500">Custom execution directory override</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={settings.defaultWorkingDir || ''}
                      onChange={(e) => setSettings((prev) => ({ ...prev, defaultWorkingDir: e.target.value }))}
                      placeholder="Executable parent folder (default)"
                      className="font-mono text-xs h-8"
                    />
                    <Button variant="secondary" size="xs" onClick={handleBrowseWorkingDir}>
                      Browse
                    </Button>
                    {settings.defaultWorkingDir && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setSettings((prev) => ({ ...prev, defaultWorkingDir: '' }))}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                {/* Checkbox behaviors */}
                <div className="space-y-3 pt-3 border-t border-[#22262d]">
                  {/* Confirm before launch */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={settings.confirmLaunch}
                      onChange={(e) => setSettings((prev) => ({ ...prev, confirmLaunch: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded border-[#22262d] bg-black/40 text-red-600 focus:ring-0 focus:ring-offset-0"
                    />
                    <div>
                      <span className="text-xs font-medium text-zinc-200 group-hover:text-white transition-colors block">
                        Show pre-flight confirmation before launching games
                      </span>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        Displays pre-flight validation status, active mod counts, and parameters before spawning the engine process.
                      </span>
                    </div>
                  </label>

                  {/* Close launcher on game start */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={settings.closeOnLaunch}
                      onChange={(e) => setSettings((prev) => ({ ...prev, closeOnLaunch: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded border-[#22262d] bg-black/40 text-red-600 focus:ring-0 focus:ring-offset-0"
                    />
                    <div>
                      <span className="text-xs font-medium text-zinc-200 group-hover:text-white transition-colors block">
                        Close launcher on game start
                      </span>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        Frees system memory while the source port executable is active.
                      </span>
                    </div>
                  </label>

                  {/* Auto-scan on startup */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={settings.autoScanOnStartup}
                      onChange={(e) => setSettings((prev) => ({ ...prev, autoScanOnStartup: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded border-[#22262d] bg-black/40 text-red-600 focus:ring-0 focus:ring-offset-0"
                    />
                    <div>
                      <span className="text-xs font-medium text-zinc-200 group-hover:text-white transition-colors block">
                        Automatic background asset scan on startup
                      </span>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        Periodically checks configured folders in background for newly added WAD and PK3 files upon launch.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 3: Application System Info & Version */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-[#22262d]">
                <Database className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-zinc-100">Application System Info & Version</h2>
              </div>

              <div className="p-5 rounded-lg bg-[#14171c] border border-[#22262d] space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Version</span>
                    <span className="font-mono font-semibold text-zinc-200 mt-0.5 block">{FULL_VERSION}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Database Engine</span>
                    <span className="font-mono text-zinc-300 mt-0.5 block">SQLite 3 (Pure Go)</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Desktop Runtime</span>
                    <span className="font-mono text-zinc-300 mt-0.5 block">Wails v2 Desktop Bridge</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Theme</span>
                    <span className="font-mono text-zinc-300 mt-0.5 block">Doom Obsidian & Crimson</span>
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
          Are you sure you want to reset all preferences to their original factory defaults? Your scanned mods, IWADs, and custom profiles will not be removed.
        </p>
      </Modal>
    </div>
  );
};
