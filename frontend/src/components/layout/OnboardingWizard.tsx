import React, { useState } from 'react';
import {
  FolderOpen,
  Gamepad2,
  HardDrive,
  CheckCircle2,
  Sparkles,
  FileCode2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { api } from '../../services/api';

interface OnboardingWizardProps {
  onComplete: () => void;
  onNavigate?: (tab: string) => void;
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onComplete,
  onNotify,
}) => {
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [selectedEnginePath, setSelectedEnginePath] = useState('');
  const [selectedIWADPath, setSelectedIWADPath] = useState('');
  const [selectedModDir, setSelectedModDir] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAutoDetect = async () => {
    if (isAutoDetecting) return;
    setIsAutoDetecting(true);
    try {
      onNotify?.('Scanning standard system paths for Doom ports and IWADs...', 'info');
      const scanResult = await api.startScan();
      const enginesCount = scanResult?.discoveredEngines ?? scanResult?.discovered_engines ?? 0;
      const iwadsCount = scanResult?.discoveredIWADs ?? scanResult?.discovered_iwads ?? 0;
      const modsCount = scanResult?.discoveredMods ?? scanResult?.discovered_mods ?? 0;
      const totalFound = enginesCount + iwadsCount + modsCount;
      if (totalFound > 0) {
        onNotify?.(`Auto-discovery completed: found ${enginesCount} engines, ${iwadsCount} IWADs, and ${modsCount} mods.`, 'success');
        onComplete();
      } else {
        onNotify?.('No Doom assets found in default directories. Please select paths manually below.', 'warning');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onNotify?.(`Auto-detection error: ${msg}`, 'error');
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const handleSelectEngine = async () => {
    try {
      const path = await api.openFileDialog(
        'Select Source Port Executable (gzdoom.exe, dsda-doom.exe, etc.)',
        '',
        ['exe', '']
      );
      if (path) {
        setSelectedEnginePath(path);
        setIsProcessing(true);
        const { version, family } = await api.detectEngineVersion(path);
        const name = family !== 'other' ? family.toUpperCase() : 'Doom Engine';
        await api.addEngine({
          name: `${name} ${version !== 'Unknown' ? version : ''}`.trim(),
          executable: path,
          version,
          family,
        });
        onNotify?.('Source Port registered successfully', 'success');
      }
    } catch (err) {
      console.error('Failed to select engine:', err);
      onNotify?.('Failed to configure engine', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectIWAD = async () => {
    try {
      const path = await api.openFileDialog('Select Base Game IWAD (DOOM2.WAD, DOOM.WAD, etc.)', '', [
        'wad',
        'iwad',
      ]);
      if (path) {
        setSelectedIWADPath(path);
        setIsProcessing(true);
        await api.registerIWADFile(path);
        onNotify?.('IWAD registered successfully', 'success');
      }
    } catch (err) {
      console.error('Failed to select IWAD:', err);
      onNotify?.('Failed to register IWAD', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectModDir = async () => {
    try {
      const dir = await api.openDirectoryDialog('Select Your Doom Mods Folder', '');
      if (dir) {
        setSelectedModDir(dir);
        setIsProcessing(true);
        const settings = await api.getSettings();
        const existing = settings.modDirectories || settings.mod_directories || [];
        if (!existing.includes(dir)) {
          await api.updateSettings({
            ...settings,
            modDirectories: [...existing, dir],
          });
        }
        onNotify?.('Scanning mod directory...', 'info');
        await api.startScan();
        onNotify?.('Setup complete. Welcome to RNT Launcher.', 'success');
        onComplete();
      }
    } catch (err) {
      console.error('Failed to configure mod folder:', err);
      onNotify?.('Failed to scan mod folder', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="rounded-xl bg-[#15181c] border border-white/[0.08] p-6 shadow-xl relative overflow-hidden mb-6">
      {/* Header with Title & Dismiss */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-red-400 font-mono text-[11px] uppercase tracking-wider font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-red-400" />
            Smart Plug & Play Setup
          </div>
          <h2 className="text-lg font-bold text-zinc-100">
            Welcome to RNT Launcher
          </h2>
          <p className="text-xs text-zinc-400">
            Auto-detect your installed Doom engines, IWADs, and mods or configure directories manually.
          </p>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={onComplete}
          className="text-zinc-500 hover:text-zinc-300 font-mono text-xs"
        >
          Dismiss
        </Button>
      </div>

      {/* 1-Click Auto-Detect Hero Banner */}
      <div className="my-5 p-4 rounded-lg bg-black/40 border border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-left">
          <div className="text-sm font-semibold text-zinc-100 flex items-center justify-center md:justify-start gap-2">
            <span>Auto-Detect Games & Source Ports</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/40">
              1-Click
            </span>
          </div>
          <p className="text-xs text-zinc-400 max-w-xl">
            Automatically search common Steam, GOG, and standard game folders for GZDoom, DSDA-Doom, DOOM2.WAD, and mods.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleAutoDetect}
          disabled={isAutoDetecting}
          className="px-5 py-2 font-bold tracking-wide uppercase text-xs whitespace-nowrap"
        >
          {isAutoDetecting ? 'Scanning System...' : 'Auto-Detect Installed Assets'}
        </Button>
      </div>

      {/* Manual Quick Pickers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Step 1: Engine */}
        <div className="p-3.5 rounded-lg bg-black/20 border border-white/[0.06] flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">1. Engine</span>
              {selectedEnginePath ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <FileCode2 className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </div>
            <div className="text-xs font-semibold text-zinc-200">Source Port</div>
            <p className="text-[11px] text-zinc-400">Select gzdoom.exe, dsda-doom, etc.</p>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={handleSelectEngine}
            disabled={isProcessing}
            className="w-full text-xs font-medium"
            leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
          >
            {selectedEnginePath ? 'Port Added' : 'Browse Executable'}
          </Button>
        </div>

        {/* Step 2: IWAD */}
        <div className="p-3.5 rounded-lg bg-black/20 border border-white/[0.06] flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">2. Base Game</span>
              {selectedIWADPath ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Gamepad2 className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </div>
            <div className="text-xs font-semibold text-zinc-200">Base IWAD</div>
            <p className="text-[11px] text-zinc-400">DOOM2.WAD, DOOM.WAD, etc.</p>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={handleSelectIWAD}
            disabled={isProcessing}
            className="w-full text-xs font-medium"
            leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
          >
            {selectedIWADPath ? 'IWAD Added' : 'Browse IWAD'}
          </Button>
        </div>

        {/* Step 3: Mod Directory */}
        <div className="p-3.5 rounded-lg bg-black/20 border border-white/[0.06] flex flex-col justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">3. Content</span>
              {selectedModDir ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </div>
            <div className="text-xs font-semibold text-zinc-200">Mods Folder</div>
            <p className="text-[11px] text-zinc-400">Folder with PK3, WAD files</p>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={handleSelectModDir}
            disabled={isProcessing}
            className="w-full text-xs font-medium"
            leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
          >
            {selectedModDir ? 'Folder Added' : 'Select Folder & Scan'}
          </Button>
        </div>
      </div>
    </div>
  );
};
