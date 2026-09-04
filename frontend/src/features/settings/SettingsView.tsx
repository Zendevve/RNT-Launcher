import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FolderOpen,
  Layout,
  Loader2,
  RotateCcw,
  Save,
  Search,
  Sliders,
} from 'lucide-react';
import { Settings, DefaultNavView } from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { DirectoriesTab } from './tabs/DirectoriesTab';
import { BehaviorTab } from './tabs/BehaviorTab';
import { InterfaceTab } from './tabs/InterfaceTab';
import { SystemTab } from './tabs/SystemTab';

export const DEFAULT_SETTINGS: Settings = {
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

export type SettingsTabId = 'directories' | 'behavior' | 'interface' | 'system';

export interface SettingsViewProps {
  initialTab?: SettingsTabId;
}

const SETTINGS_TABS: { id: SettingsTabId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'directories',
    label: 'Directories',
    icon: <FolderOpen className="w-3.5 h-3.5 text-blue-400" />,
  },
  {
    id: 'behavior',
    label: 'Behavior',
    icon: <Sliders className="w-3.5 h-3.5 text-zinc-400" />,
  },
  {
    id: 'interface',
    label: 'Interface',
    icon: <Layout className="w-3.5 h-3.5 text-amber-400" />,
  },
  {
    id: 'system',
    label: 'System',
    icon: <Database className="w-3.5 h-3.5 text-emerald-400" />,
  },
];

type DirectoryKind = 'mod' | 'iwad' | 'engine';

const DIRECTORY_KEY: Record<DirectoryKind, 'modDirectories' | 'iwadDirectories' | 'engineDirectories'> = {
  mod: 'modDirectories',
  iwad: 'iwadDirectories',
  engine: 'engineDirectories',
};

const DIRECTORY_DIALOG_TITLE: Record<DirectoryKind, string> = {
  mod: 'Select Mod Directory',
  iwad: 'Select Base IWAD Directory',
  engine: 'Select Source Port Directory',
};

export const SettingsView: React.FC<SettingsViewProps> = ({ initialTab = 'directories' }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [filter, setFilter] = useState('');

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

  // Generic patch helper for Behavior / Interface tabs
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // Revert modifications back to last saved state without reloading from backend
  const handleDiscard = useCallback(() => {
    setSettings(originalSettings);
  }, [originalSettings]);

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
        toast.info('Directory Added', `Added "${cleanPath}". Click Save to persist.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Directory selection failed';
      toast.error('Folder Error', message);
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

  // Save updated settings to backend
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await api.updateSettings(settings);
      setOriginalSettings(settings);
      toast.success('Settings Saved', 'Application preferences successfully saved.');
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

  const totalDirectoriesConfigured =
    settings.modDirectories.length + settings.iwadDirectories.length + settings.engineDirectories.length;

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-[#09090b] text-[#f4f4f5] select-none relative">
      {/* Top Header Bar: title + breadcrumb + subtitle, center filter, status + actions */}
      <div className="border-b border-[#2d2d34] bg-[#0c0c0f] px-6 py-4 flex items-center gap-4 shrink-0 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-zinc-500 tracking-wide">
            RNT Launcher <span className="text-zinc-700">/</span> Preferences
          </p>
          <h1 className="text-sm font-bold text-[#f4f4f5] tracking-tight mt-0.5">Settings</h1>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Configure content scan paths, process automation, display density, and system options.
          </p>
        </div>

        <div className="flex-1 min-w-[200px] max-w-md mx-auto w-full">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter settings..."
            leftIcon={<Search className="h-3.5 w-3.5" />}
          />
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          {isDirty ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950/40 px-2.5 py-1 text-[11px] font-medium text-amber-400 border border-amber-800/40 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              Unsaved Changes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-zinc-500 border border-[#2d2d34] bg-[#0f0f12]">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              Saved
            </span>
          )}
          <Button
            variant="outline"
            size="xs"
            onClick={handleDiscard}
            disabled={!isDirty || isSaving || isLoading}
            leftIcon={<RotateCcw className="h-3 w-3" />}
            className="text-xs border-[#2d2d34] bg-[#0f0f12] hover:bg-[#1a1d24] text-zinc-300 active:scale-[0.98] transition-all duration-150"
          >
            Discard
          </Button>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={!isDirty || isSaving || isLoading}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#5e7ce2] hover:bg-[#4d6bd4] px-3.5 py-1.5 text-xs font-[600] text-[#09090b] transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-xs"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>
      </div>

      {/* Segmented Tab Navigation Rail */}
      <div className="px-6 pt-4 shrink-0">
        <div className="flex items-center gap-1 bg-[#0c0c0f] border border-[#2d2d34] p-1 rounded-[10px] w-fit max-w-full overflow-x-auto">
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={
                  'flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-xs font-medium whitespace-nowrap ' +
                  'active:scale-[0.98] transition-all duration-150 ease-out ' +
                  (isActive
                    ? 'bg-[#1a1d24] text-[#f4f4f5] border border-[#3a3f4d] shadow-sm'
                    : 'text-zinc-400 border border-transparent hover:text-zinc-200 hover:bg-white/[0.03]')
                }
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.id === 'directories' && totalDirectoriesConfigured > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-zinc-400 border border-[#2d2d34]">
                    {totalDirectoriesConfigured}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        <div className="w-full pb-24">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading preferences...
            </div>
          ) : (
            <>
              {activeTab === 'directories' && (
                <DirectoriesTab
                  settings={settings}
                  onAdd={(kind: DirectoryKind) =>
                    handleAddDirectory(DIRECTORY_KEY[kind], DIRECTORY_DIALOG_TITLE[kind])
                  }
                  onRemove={(kind: DirectoryKind, index: number) =>
                    handleRemoveDirectory(DIRECTORY_KEY[kind], index)
                  }
                  onOpen={handleOpenExplorer}
                  onWorkingDirChange={(v: string) => update({ defaultWorkingDir: v })}
                  onBrowseWorkingDir={handleBrowseWorkingDir}
                  onClearWorkingDir={() => update({ defaultWorkingDir: '' })}
                  filter={filter}
                />
              )}
              {activeTab === 'behavior' && (
                <BehaviorTab settings={settings} update={update} filter={filter} />
              )}
              {activeTab === 'interface' && (
                <InterfaceTab settings={settings} update={update} filter={filter} />
              )}
              {activeTab === 'system' && (
                <SystemTab
                  settings={settings}
                  onResetRequest={() => setIsResetModalOpen(true)}
                  filter={filter}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating Unsaved Changes Dock */}
      {isDirty && !isLoading && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-[#0f0f12]/95 border border-[#3a3a45] backdrop-blur-md rounded-[12px] shadow-2xl px-5 py-3">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-300 whitespace-nowrap">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            You have unsaved changes
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={handleDiscard}
            disabled={isSaving}
            className="text-xs text-zinc-400 hover:text-zinc-100 active:scale-[0.98] transition-all duration-150"
          >
            Revert
          </Button>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#5e7ce2] hover:bg-[#4d6bd4] px-3.5 py-1.5 text-xs font-[600] text-[#09090b] transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Reset Preferences to Defaults?"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="ghost" onClick={() => setIsResetModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmReset}>
              Reset Defaults
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[#a1a1aa] leading-relaxed">
          Are you sure you want to reset <span className="text-[#f4f4f5] font-medium">all preferences to factory defaults</span>? Your scanned mods, IWADs, and custom profiles will not be removed.
        </p>
      </Modal>
    </div>
  );
};
