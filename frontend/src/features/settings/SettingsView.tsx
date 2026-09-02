import { FULL_VERSION } from '../../version';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon,
  FolderOpen,
  FolderPlus,
  Trash2,
  Save,
  RotateCcw,
  Database,
  Sparkles,
  Layers,
  Cpu,
  Disc,
  ExternalLink,
  Sliders,
  AlertTriangle,
  Layout,
  Eye,
  Flame,
  CheckSquare,
  Square,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Settings, DefaultNavView } from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import {
  BRAND_TAGLINE,
  BRAND_PILLARS,
  SUPPORTED_FORMATS,
  FORMAT_DESCRIPTIONS,
} from '../../lib/constants';

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
  formatVisibility: ['.wad', '.pk3', '.pk7', '.ipk3', '.zip', '.deh', '.bex'],
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

export const SettingsView: React.FC = () => {
  const toast = useToast();

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

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
              : ['.wad', '.pk3', '.pk7', '.ipk3', '.zip', '.deh', '.bex'],
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
    const current = settings.formatVisibility || ['.wad', '.pk3', '.pk7', '.ipk3', '.zip', '.deh', '.bex'];
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
    setSettings((prev) => ({
      ...prev,
      formatVisibility: [...SUPPORTED_FORMATS],
    }));
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

  // Trigger manual background library scan
  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      await api.startScan();
      toast.info('Scan Started', 'Scanning configured directories for content...');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Scanner error';
      toast.error('Scan Failed', message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-doom-bg text-doom-text">
      {/* Header Bar */}
      <div className="border-b border-doom-border bg-doom-surface px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 shadow-inner">
                <SettingsIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black uppercase tracking-wider text-zinc-100">
                    Launcher Settings
                  </h1>
                  {isDirty && (
                    <span className="rounded-full bg-amber-950/80 px-2.5 py-0.5 text-xs font-mono font-semibold text-amber-300 border border-amber-700/50">
                      Unsaved Changes
                    </span>
                  )}
                </div>
                <p className="text-xs text-doom-muted mt-0.5">
                  Configure directory search paths, interface density, format filters, and application preferences
                </p>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResetModalOpen(true)}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Reset Defaults
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveSettings}
              isLoading={isSaving}
              disabled={!isDirty && !isLoading}
              leftIcon={<Save className="h-4 w-4" />}
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Main Settings Form Scroll Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 max-w-5xl">
        {/* BRAND & DESIGN PHILOSOPHY CARD */}
        <div className="relative overflow-hidden rounded-xl border border-doom-red/30 bg-gradient-to-br from-doom-card/90 via-doom-surface to-doom-bg p-5 shadow-lg">
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-doom-red text-white shadow-md shadow-red-950/60 border border-red-500/40">
              <Flame className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold uppercase tracking-wider text-sm text-doom-text">
                  RNT Launcher Design Philosophy
                </span>
                <span className="rounded bg-doom-red/20 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-red-300 border border-doom-red/40">
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
                    className="rounded bg-doom-bg/70 border border-doom-border/60 p-2.5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-zinc-200">{pillar.title}</span>
                        <span className="text-[9px] font-mono text-doom-red-bright uppercase">{pillar.subtitle}</span>
                      </div>
                      <p className="text-[11px] text-doom-muted mt-1 leading-snug">{pillar.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: Interface & Density Preferences */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-doom-border">
            <Layout className="h-5 w-5 text-doom-amber" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
              Interface & Density Preferences
            </h2>
          </div>

          <div className="p-4 rounded-lg bg-doom-card border border-doom-border space-y-5">
            {/* UI Density Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                <span>UI Density Mode</span>
                <span className="text-[11px] font-normal text-doom-muted">
                  Controls vertical rhythm, table padding, and data density
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, uiDensity: 'compact' }))}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    settings.uiDensity === 'compact'
                      ? 'border-doom-red bg-doom-surface/90 shadow-md shadow-red-950/20 text-white'
                      : 'border-doom-border bg-doom-surface/40 hover:border-doom-border-bright text-zinc-400'
                  }`}
                >
                  <Minimize2 className={`h-5 w-5 shrink-0 mt-0.5 ${settings.uiDensity === 'compact' ? 'text-doom-red-bright' : 'text-doom-muted'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-100">Compact</span>
                      <span className="rounded bg-emerald-950/60 border border-emerald-700/60 px-1.5 py-0.2 text-[9px] font-mono text-emerald-400 font-bold uppercase">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-doom-muted mt-0.5 leading-tight">
                      Space-efficient layout with minimized chrome, tight table rows, and maximized viewport data density.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, uiDensity: 'comfortable' }))}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    settings.uiDensity === 'comfortable'
                      ? 'border-doom-red bg-doom-surface/90 shadow-md shadow-red-950/20 text-white'
                      : 'border-doom-border bg-doom-surface/40 hover:border-doom-border-bright text-zinc-400'
                  }`}
                >
                  <Maximize2 className={`h-5 w-5 shrink-0 mt-0.5 ${settings.uiDensity === 'comfortable' ? 'text-doom-cyan' : 'text-doom-muted'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-100">Comfortable</span>
                    </div>
                    <p className="text-[11px] text-doom-muted mt-0.5 leading-tight">
                      Roomy vertical padding and standard button height for touch screens or larger display monitors.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Default Initial View */}
            <div className="space-y-2 pt-3 border-t border-doom-border">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                <span>Default Initial View</span>
                <span className="text-[11px] font-normal text-doom-muted">
                  View displayed when launching RNT Launcher
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
                className="w-full h-9 px-3 bg-doom-bg text-doom-text text-xs rounded border border-doom-border focus:border-doom-red focus:ring-1 focus:ring-doom-red focus:outline-none font-mono"
              >
                {VIEW_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-doom-surface text-doom-text">
                    {opt.label} — {opt.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Path Visibility & Recent Launches Limit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-doom-border">
              {/* Mod Path Visibility */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.showFilePaths}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, showFilePaths: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-doom-border bg-doom-surface text-doom-red focus:ring-doom-red accent-doom-red"
                />
                <div>
                  <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors block">
                    Show full file paths in mod listings
                  </span>
                  <span className="text-[11px] text-doom-muted block">
                    When disabled, keeps mod tables minimal with clean names; full paths remain visible in the inspector drawer.
                  </span>
                </div>
              </label>

              {/* Recent Launches Display Limit */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200 block">
                    Dashboard Recent Launches Count
                  </span>
                  <span className="text-xs font-mono font-bold text-doom-amber">
                    {settings.showRecentLaunches === 0 ? 'Hidden (0)' : `${settings.showRecentLaunches} rows`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={settings.showRecentLaunches ?? 3}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      showRecentLaunches: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full accent-doom-red cursor-pointer"
                />
                <span className="text-[10px] text-doom-muted block">
                  Set to 0 to completely hide recent launch telemetry cards from the dashboard.
                </span>
              </div>
            </div>

            {/* Mod Format Visibility Multi-select */}
            <div className="space-y-2.5 pt-3 border-t border-doom-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <Eye className="h-4 w-4 text-doom-cyan" />
                  <span>Mod Format Visibility & Filtering</span>
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllFormats}
                  className="text-[11px] font-mono text-doom-cyan hover:underline"
                >
                  Enable All Formats
                </button>
              </div>
              <p className="text-[11px] text-doom-muted">
                Toggle visible package formats shown in the library format dropdown and scanner filters.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
                {SUPPORTED_FORMATS.map((fmt) => {
                  const info = FORMAT_DESCRIPTIONS[fmt] || {
                    label: fmt.toUpperCase(),
                    description: 'Mod package file',
                    badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
                  };
                  const isVisible = (settings.formatVisibility || []).includes(fmt);

                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => handleToggleFormat(fmt)}
                      className={`flex items-start gap-2.5 p-2 rounded-lg border text-left transition-all ${
                        isVisible
                          ? 'border-doom-border-bright bg-doom-surface text-zinc-200'
                          : 'border-doom-border/40 bg-doom-bg/40 text-zinc-500 opacity-60'
                      }`}
                    >
                      <div className="mt-0.5">
                        {isVisible ? (
                          <CheckSquare className="h-4 w-4 text-doom-green shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-doom-muted shrink-0" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded border px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase tracking-wider ${info.badgeColor}`}
                          >
                            {fmt}
                          </span>
                          <span className="text-[11px] font-semibold text-zinc-200 truncate">
                            {info.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-doom-muted truncate mt-0.5">
                          {info.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Configured Content Directories */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-doom-border">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-doom-red" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
                Content Search Directories
              </h2>
            </div>
            <span className="text-xs text-doom-muted font-mono">
              {settings.modDirectories.length +
                settings.iwadDirectories.length +
                settings.engineDirectories.length}{' '}
              total paths monitored
            </span>
          </div>

          {/* Mod Directories */}
          <div className="p-4 rounded-lg bg-doom-card border border-doom-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-doom-cyan" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Mod & PWAD Directories
                </span>
                <span className="text-xs text-doom-muted font-mono">
                  ({settings.modDirectories.length} configured)
                </span>
              </div>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleAddDirectory('modDirectories', 'Select Mod Directory')}
                leftIcon={<FolderPlus className="h-3.5 w-3.5 text-doom-cyan" />}
              >
                Add Mod Folder
              </Button>
            </div>

            {settings.modDirectories.length === 0 ? (
              <div className="p-3 text-center rounded border border-dashed border-zinc-800 text-xs text-doom-muted">
                No mod directories added yet. Click &ldquo;Add Mod Folder&rdquo; to scan for PWAD, PK3, and ZIP files.
              </div>
            ) : (
              <div className="space-y-1.5">
                {settings.modDirectories.map((dir, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-doom-surface border border-doom-border text-xs"
                  >
                    <span className="font-mono text-zinc-300 truncate mr-2" title={dir}>
                      {dir}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenExplorer(dir)}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-doom-cyan transition-colors"
                        title="Open in Explorer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveDirectory('modDirectories', idx)}
                        className="p-1 rounded hover:bg-red-950/60 text-zinc-400 hover:text-red-400 transition-colors"
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
          <div className="p-4 rounded-lg bg-doom-card border border-doom-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Disc className="h-4 w-4 text-doom-green" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  IWAD & Base Game Directories
                </span>
                <span className="text-xs text-doom-muted font-mono">
                  ({settings.iwadDirectories.length} configured)
                </span>
              </div>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleAddDirectory('iwadDirectories', 'Select IWAD Directory')}
                leftIcon={<FolderPlus className="h-3.5 w-3.5 text-doom-green" />}
              >
                Add IWAD Folder
              </Button>
            </div>

            {settings.iwadDirectories.length === 0 ? (
              <div className="p-3 text-center rounded border border-dashed border-zinc-800 text-xs text-doom-muted">
                No IWAD directories added yet. Add folders containing DOOM.WAD, DOOM2.WAD, TNT.WAD, etc.
              </div>
            ) : (
              <div className="space-y-1.5">
                {settings.iwadDirectories.map((dir, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-doom-surface border border-doom-border text-xs"
                  >
                    <span className="font-mono text-zinc-300 truncate mr-2" title={dir}>
                      {dir}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenExplorer(dir)}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-doom-amber transition-colors"
                        title="Open in Explorer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveDirectory('iwadDirectories', idx)}
                        className="p-1 rounded hover:bg-red-950/60 text-zinc-400 hover:text-red-400 transition-colors"
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
          <div className="p-4 rounded-lg bg-doom-card border border-doom-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-doom-red" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Engine & Source Port Directories
                </span>
                <span className="text-xs text-doom-muted font-mono">
                  ({settings.engineDirectories.length} configured)
                </span>
              </div>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleAddDirectory('engineDirectories', 'Select Engine Directory')}
                leftIcon={<FolderPlus className="h-3.5 w-3.5 text-doom-amber" />}
              >
                Add Engine Folder
              </Button>
            </div>

            {settings.engineDirectories.length === 0 ? (
              <div className="p-3 text-center rounded border border-dashed border-zinc-800 text-xs text-doom-muted">
                No engine directories added yet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {settings.engineDirectories.map((dir, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-doom-surface border border-doom-border text-xs"
                  >
                    <span className="font-mono text-zinc-300 truncate mr-2" title={dir}>
                      {dir}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenExplorer(dir)}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-doom-amber transition-colors"
                        title="Open in Explorer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveDirectory('engineDirectories', idx)}
                        className="p-1 rounded hover:bg-red-950/60 text-zinc-400 hover:text-red-400 transition-colors"
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

        {/* SECTION 3: Launch & Runtime Preferences */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-doom-border">
            <Sliders className="h-5 w-5 text-doom-cyan" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
              Launch & Application Preferences
            </h2>
          </div>

          <div className="p-4 rounded-lg bg-doom-card border border-doom-border space-y-5">
            {/* Default Working Directory */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                <span>Default Game Working Directory</span>
                <span className="text-[11px] font-normal text-doom-muted">
                  Leave blank to use profile / executable folder
                </span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    value={settings.defaultWorkingDir}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, defaultWorkingDir: e.target.value }))
                    }
                    placeholder="e.g. C:\Games\Doom"
                    className="font-mono text-xs"
                    leftIcon={<FolderOpen className="h-4 w-4 text-doom-muted" />}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleBrowseWorkingDir}
                >
                  Browse...
                </Button>
              </div>
            </div>

            {/* Checkbox Options Strip */}
            <div className="space-y-3 pt-3 border-t border-doom-border">
              {/* Auto Scan on Startup */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.autoScanOnStartup}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, autoScanOnStartup: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-doom-border bg-doom-surface text-doom-red focus:ring-doom-red accent-doom-red"
                />
                <div>
                  <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors block">
                    Auto-scan directories on launcher startup
                  </span>
                  <span className="text-[11px] text-doom-muted block">
                    Automatically inspect configured mod and IWAD folders for new additions when opening RNT Launcher.
                  </span>
                </div>
              </label>

              {/* Confirm Before Launch */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.confirmLaunch}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, confirmLaunch: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-doom-border bg-doom-surface text-doom-red focus:ring-doom-red accent-doom-red"
                />
                <div>
                  <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors block">
                    Prompt confirmation dialog prior to game launch
                  </span>
                  <span className="text-[11px] text-doom-muted block">
                    Display pre-flight validation status dialog with review option before starting executable.
                  </span>
                </div>
              </label>

              {/* Close Launcher on Game Start */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.closeOnLaunch}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, closeOnLaunch: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-doom-border bg-doom-surface text-doom-red focus:ring-doom-red accent-doom-red"
                />
                <div>
                  <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors block">
                    Minimize or close launcher upon game start
                  </span>
                  <span className="text-[11px] text-doom-muted block">
                    Keep system resources dedicated to the game process while running.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* SECTION 4: Database & Maintenance */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-doom-border">
            <Database className="h-5 w-5 text-doom-green" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
              Database & System Diagnostics
            </h2>
          </div>

          <div className="p-4 rounded-lg bg-doom-card border border-doom-border space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded bg-doom-surface border border-doom-border">
                <span className="text-[10px] text-doom-muted uppercase tracking-wider block">
                  Storage Engine
                </span>
                <span className="font-mono text-zinc-200 font-semibold text-xs mt-0.5 block">
                  SQLite (Zero-CGO Driver)
                </span>
              </div>
              <div className="p-3 rounded bg-doom-surface border border-doom-border">
                <span className="text-[10px] text-doom-muted uppercase tracking-wider block">
                  App Architecture
                </span>
                <span className="font-mono text-zinc-200 font-semibold text-xs mt-0.5 block">
                  Wails v2 + React 18
                </span>
              </div>
              <div className="p-3 rounded bg-doom-surface border border-doom-border">
                <span className="text-[10px] text-doom-muted uppercase tracking-wider block">
                  Release Version
                </span>
                <span className="font-mono text-zinc-200 font-semibold text-xs mt-0.5 block">
                  {FULL_VERSION}
                </span>
              </div>
            </div>

            {/* Manual Scan Trigger */}
            <div className="flex items-center justify-between p-3 rounded bg-doom-surface border border-doom-border text-xs">
              <div>
                <span className="font-semibold text-zinc-200 block">Force Manual Library Re-scan</span>
                <span className="text-[11px] text-doom-muted">
                  Inspect all configured folders now to detect new or modified mod files and source ports.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerScan}
                isLoading={isScanning}
                leftIcon={<Sparkles className="h-3.5 w-3.5 text-doom-amber" />}
              >
                Scan All Folders Now
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider">
            <AlertTriangle className="h-5 w-5" />
            <span>Reset Settings to Default?</span>
          </div>
        }
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-zinc-300">
            This will restore all directory paths and launcher preferences back to original defaults.
          </p>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-doom-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsResetModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmReset}
            >
              Reset to Defaults
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
