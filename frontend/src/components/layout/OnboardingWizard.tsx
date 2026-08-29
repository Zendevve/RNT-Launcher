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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedEnginePath, setSelectedEnginePath] = useState('');
  const [selectedIWADPath, setSelectedIWADPath] = useState('');
  const [selectedModDir, setSelectedModDir] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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
        setStep(2);
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
        setStep(3);
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
        onNotify?.('Setup complete! Welcome to RNT Launcher.', 'success');
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
    <div className="rounded-xl bg-gradient-to-b from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 p-6 md:p-8 shadow-2xl relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      <div className="relative z-10 space-y-6">
        {/* Banner Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-red-500 font-semibold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              Quick Setup Wizard
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100 flex items-center gap-2.5">
              Welcome to RNT Launcher
            </h2>
            <p className="text-sm text-zinc-400">
              Get ready to play in 3 simple steps. Configure your source port, IWAD, and mods directory.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onComplete} className="text-zinc-500 hover:text-zinc-300">
            Skip for now
          </Button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Step 1 */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              step === 1
                ? 'bg-zinc-800/80 border-red-500/50 shadow-md ring-1 ring-red-500/20'
                : selectedEnginePath
                ? 'bg-zinc-900/60 border-emerald-900/40 text-zinc-400'
                : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider">Step 1</span>
              {selectedEnginePath ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <FileCode2 className="w-4 h-4 text-zinc-400" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 mt-2">Add Source Port</h3>
            <p className="text-xs text-zinc-400 mt-1">GZDoom, DSDA-Doom, Woof, or Crispy</p>
          </div>

          {/* Step 2 */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              step === 2
                ? 'bg-zinc-800/80 border-red-500/50 shadow-md ring-1 ring-red-500/20'
                : selectedIWADPath
                ? 'bg-zinc-900/60 border-emerald-900/40 text-zinc-400'
                : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider">Step 2</span>
              {selectedIWADPath ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Gamepad2 className="w-4 h-4 text-zinc-400" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 mt-2">Add Base IWAD</h3>
            <p className="text-xs text-zinc-400 mt-1">DOOM2.WAD, DOOM.WAD, or Freedoom</p>
          </div>

          {/* Step 3 */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              step === 3
                ? 'bg-zinc-800/80 border-red-500/50 shadow-md ring-1 ring-red-500/20'
                : selectedModDir
                ? 'bg-zinc-900/60 border-emerald-900/40 text-zinc-400'
                : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider">Step 3</span>
              {selectedModDir ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <HardDrive className="w-4 h-4 text-zinc-400" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 mt-2">Scan Mod Folder</h3>
            <p className="text-xs text-zinc-400 mt-1">Discover your PK3 and WAD collection</p>
          </div>
        </div>

        {/* Step Action Body */}
        <div className="p-6 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          {step === 1 && (
            <>
              <div className="space-y-1">
                <h4 className="text-base font-semibold text-zinc-100">Step 1: Choose Your Doom Source Port</h4>
                <p className="text-xs text-zinc-400 max-w-lg">
                  Select the executable for your preferred source port (such as <code>gzdoom.exe</code> or{' '}
                  <code>dsda-doom</code>).
                </p>
              </div>
              <Button
                variant="primary"
                onClick={handleSelectEngine}
                disabled={isProcessing}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <FolderOpen className="w-4 h-4" />
                Select Engine Executable
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1">
                <h4 className="text-base font-semibold text-zinc-100">Step 2: Choose Your Game IWAD</h4>
                <p className="text-xs text-zinc-400 max-w-lg">
                  Select a base game IWAD file (such as <code>DOOM2.WAD</code>, <code>DOOM.WAD</code>, or{' '}
                  <code>freedoom2.wad</code>).
                </p>
              </div>
              <Button
                variant="primary"
                onClick={handleSelectIWAD}
                disabled={isProcessing}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <FolderOpen className="w-4 h-4" />
                Select IWAD File
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-1">
                <h4 className="text-base font-semibold text-zinc-100">Step 3: Select Your Mods Folder</h4>
                <p className="text-xs text-zinc-400 max-w-lg">
                  Choose the directory where you store your Doom mods (.pk3, .wad, .zip). We will automatically catalog
                  and index them.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={handleSelectModDir}
                disabled={isProcessing}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <FolderOpen className="w-4 h-4" />
                Select Mods Folder & Scan
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
