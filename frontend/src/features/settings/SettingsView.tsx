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
} from 'lucide-react';
import { Settings, ScanResult } from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

const DEFAULT_SETTINGS: Settings = {
  modDirectories: [],
  iwadDirectories: [],
  engineDirectories: [],
  defaultWorkingDir: '',
  theme: 'doom-dark',
  confirmLaunch: false,
  autoScanOnStartup: true,
  closeOnLaunch: false,
};

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
      const message = err instanceof Error ? err.message : 'Could not open path';
      toast.error('Explorer Error', message);
    }
  };

  // Browse default working directory
  const handleBrowseWorkingDir = async () => {
    try {
      const selected = await api.openDirectoryDialog('Select Default Working Directory');
      if (selected && selected.trim()) {
        setSettings((prev) => ({
          ...prev,
          defaultWorkingDir: selected.trim(),
        }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Folder selection failed';
      toast.error('Browse Error', message);
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await api.updateSettings(settings);
      setOriginalSettings(settings);
      toast.success('Settings Saved', 'Application preferences and paths updated successfully.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      toast.error('Save Error', message);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset Settings to Defaults
  const handleConfirmReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setIsResetModalOpen(false);
    toast.info('Defaults Restored', 'Settings reset to factory defaults. Click Save to persist.');
  };

  // Trigger full library scanner
  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      const result: ScanResult = await api.startScan();
      const mods = result.discoveredMods ?? 0;
      const iwads = result.discoveredIWADs ?? 0;
      const engines = result.discoveredEngines ?? 0;
      toast.success(
        'Scan Complete',
        `Discovered ${mods} mods, ${iwads} IWADs, and ${engines} engines.`
      );
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
                  Configure directory search paths, launch behavior, auto-scanning, and application storage
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
        {/* SECTION 1: Configured Directories */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-doom-border">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-doom-amber" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
                Directory Search Paths
              </h2>
            </div>
            <span className="text-xs text-doom-muted">
              Auto-scan discovers WAD, PK3, IWAD, and Engine files in these paths
            </span>
          </div>

          {/* Mod Directories */}
          <div className="p-4 rounded-lg bg-doom-card border border-doom-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Mod & Addon Directories
                </span>
                <span className="text-xs text-doom-muted font-mono">
                  ({settings.modDirectories.length} configured)
                </span>
              </div>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleAddDirectory('modDirectories', 'Select Mod Directory')}
                leftIcon={<FolderPlus className="h-3.5 w-3.5 text-doom-amber" />}
              >
                Add Mod Folder
              </Button>
            </div>

            {settings.modDirectories.length === 0 ? (
              <div className="p-3 text-center rounded border border-dashed border-zinc-800 text-xs text-doom-muted">
                No mod directories added yet. Click &ldquo;Add Mod Folder&rdquo; to configure paths.
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
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-doom-amber transition-colors"
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
                <Disc className="h-4 w-4 text-doom-amber" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Base IWAD Directories
                </span>
                <span className="text-xs text-doom-muted font-mono">
                  ({settings.iwadDirectories.length} configured)
                </span>
              </div>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleAddDirectory('iwadDirectories', 'Select IWAD Directory')}
                leftIcon={<FolderPlus className="h-3.5 w-3.5 text-doom-amber" />}
              >
                Add IWAD Folder
              </Button>
            </div>

            {settings.iwadDirectories.length === 0 ? (
              <div className="p-3 text-center rounded border border-dashed border-zinc-800 text-xs text-doom-muted">
                No IWAD directories added yet.
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

        {/* SECTION 2: Launch & Runtime Preferences */}
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

        {/* SECTION 3: Database & Maintenance */}
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
