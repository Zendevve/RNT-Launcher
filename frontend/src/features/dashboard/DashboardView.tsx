import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Plus,
  ArrowUpRight,
  RotateCw,
  FolderSearch,
  FolderOpen,
  Cpu,
  Disc,
  Layers,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Sliders,
} from 'lucide-react';
import {
  Profile,
  Mod,
  IWAD,
  Engine,
  LaunchRecord,
  HistoryStats,
  Settings,
} from '../../types';
import { api } from '../../services/api';
import { formatDuration, formatDate, formatRelativeTime } from '../../utils/formatters';
import { RecentProfileCard } from './RecentProfileCard';
import { cn } from '../../utils/cn';
import { useToast } from '../../components/ui/Toast';

interface DashboardViewProps {
  onNavigateToLibrary?: () => void;
  onNavigateToProfiles?: () => void;
  onSelectProfile?: (profileId: string) => void;
  onCreateProfile?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToLibrary,
  onNavigateToProfiles,
  onSelectProfile,
  onCreateProfile,
}) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [iwads, setIWADs] = useState<IWAD[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [history, setHistory] = useState<LaunchRecord[]>([]);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [isLaunchingHero, setIsLaunchingHero] = useState(false);
  const [selectedHeroProfileId, setSelectedHeroProfileId] = useState<string>('');

  const toast = useToast();

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    } else {
      toast.info(message);
    }
  };

  const loadDashboardData = useCallback(async () => {
    try {
      const [
        fetchedProfiles,
        fetchedMods,
        fetchedIWADs,
        fetchedEngines,
        fetchedHistory,
        fetchedStats,
        fetchedSettings,
      ] = await Promise.all([
        api.listProfiles().catch(() => []),
        api.listMods().catch(() => []),
        api.listIWADs().catch(() => []),
        api.listEngines().catch(() => []),
        api.listLaunchHistory(10).catch(() => []),
        api.getHistoryStats().catch(() => null),
        api.getSettings().catch(() => null),
      ]);

      const profs = fetchedProfiles || [];
      const eList = fetchedEngines || [];
      const iList = fetchedIWADs || [];

      setProfiles(profs);
      setMods(fetchedMods || []);
      setIWADs(iList);
      setEngines(eList);
      setHistory(fetchedHistory || []);
      setHistoryStats(fetchedStats);
      setSettings(fetchedSettings);

      if (profs.length > 0) {
        setSelectedHeroProfileId((prev) => {
          if (prev && profs.some((p) => p.id === prev)) return prev;
          const fav = profs.find((p) => p.isFavorite);
          return fav ? fav.id : profs[0].id;
        });
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      showNotification('error', 'Could not load dashboard data from backend.');
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleLaunch = async (profileId: string) => {
    try {
      showNotification('info', 'Launching game session...');
      await api.launchProfile(profileId);
      showNotification('success', 'Game session started successfully.');
      loadDashboardData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Launch failed';
      showNotification('error', `Launch failed: ${message}`);
    }
  };

  const handleLaunchHero = async () => {
    if (isLaunchingHero) return;
    const target = profiles.find((p) => p.id === selectedHeroProfileId) || profiles[0];
    if (!target) {
      showNotification('error', 'No preset available to launch.');
      return;
    }

    setIsLaunchingHero(true);
    try {
      showNotification('info', `Launching "${target.name}"...`);
      await api.launchProfile(target.id);
      showNotification('success', 'Game launched successfully.');
      loadDashboardData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Launch failed';
      showNotification('error', `Launch failed: ${message}`);
    } finally {
      setIsLaunchingHero(false);
    }
  };

  const handleToggleFavorite = async (profileId: string) => {
    try {
      await api.toggleProfileFavorite(profileId);
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, isFavorite: !p.isFavorite } : p))
      );
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await api.startScan();
      showNotification('info', 'Scanning system folders for engines, IWADs, and mods...');
      setTimeout(() => {
        loadDashboardData();
        setIsScanning(false);
      }, 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scan failed';
      showNotification('error', `Scan failed: ${message}`);
      setIsScanning(false);
    }
  };

  const isCompact = settings?.uiDensity === 'compact';
  const hasAssets = engines.length > 0 && iwads.length > 0;

  const activeHeroProfile =
    profiles.find((p) => p.id === selectedHeroProfileId) ||
    profiles.find((p) => p.isFavorite) ||
    profiles[0];

  const sortedProfiles = [...profiles].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return a.name.localeCompare(b.name);
  });
  const displayProfiles = sortedProfiles.slice(0, 6);

  return (
    <div
      className={cn(
        'flex-1 min-h-0 overflow-y-auto bg-[#09090b] text-[#f4f4f5] select-none [font-family:var(--font-geist),Geist,sans-serif] font-[500]',
        isCompact ? 'p-5 pb-16 space-y-6' : 'p-6 md:p-8 pb-20 space-y-8'
      )}
    >
      {/* Notification — Slate card 12px, 0.001s ease */}


      {/* HERO SECTION — Slate */}
      {hasAssets ? (
        <div className="rounded-[12px] border border-[#2d2d34] bg-[#0f0f12] p-6 md:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-[border-color,background-color] duration-[0.001s] ease-[ease]">
          <div className="flex-1 min-w-0 space-y-3">
            {/* Top Status & Preset Switcher */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-[500] text-[#5e7ce2]">
                <span className="h-2 w-2 rounded-full bg-[#5e7ce2]" />
                <span>Ready to Launch</span>
              </div>

              {profiles.length > 1 && (
                <div className="relative inline-flex items-center">
                  <select
                    value={selectedHeroProfileId}
                    onChange={(e) => setSelectedHeroProfileId(e.target.value)}
                    aria-label="Select active preset"
                    className="appearance-none bg-[#0c0c0f] hover:bg-[#0f0f12] text-[#a1a1aa] hover:text-[#f4f4f5] border border-[#2d2d34] rounded-[8px] px-3 py-1 pr-7 text-xs font-[500] cursor-pointer focus:outline-none focus:border-[var(--framer-input-focused-border-color)] transition-[background-color,color,border-color] duration-[0.001s] ease-[ease] [font-family:var(--font-geist),Geist,sans-serif]"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0c0c0f] text-[#f4f4f5]">
                        {p.isFavorite ? '★ ' : ''}
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#71717a] absolute right-2 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Title & Description */}
            <div>
              <h1 className="text-xl md:text-2xl font-[500] tracking-tight text-[#f4f4f5] truncate [font-family:var(--font-geist),Geist,sans-serif]">
                {activeHeroProfile
                  ? activeHeroProfile.name
                  : (iwads.find((w) => w.id === engines[0]?.id)?.name || 'Doom II')}
              </h1>
              <p className="text-xs text-[#a1a1aa] mt-1 max-w-xl line-clamp-2 leading-relaxed font-[500]">
                {activeHeroProfile?.description ||
                  'Instant launch with selected source port engine and configured mod load order.'}
              </p>
            </div>

            {/* Specs pills — 8px radius, 8px spacing */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#a1a1aa]">
              <div className="flex items-center gap-1.5 bg-[#0c0c0f] border border-[#2d2d34] px-2.5 py-1 rounded-[8px] transition-colors duration-[0.001s] ease-[ease]">
                <Cpu className="h-3.5 w-3.5 text-[#71717a]" />
                <span className="font-[500] text-[#a1a1aa]">{activeHeroProfile?.engineName || engines[0]?.name || 'Port'}</span>
              </div>

              <div className="flex items-center gap-1.5 bg-[#0c0c0f] border border-[#2d2d34] px-2.5 py-1 rounded-[8px] transition-colors duration-[0.001s] ease-[ease]">
                <Disc className="h-3.5 w-3.5 text-[#71717a]" />
                <span className="font-[500] text-[#a1a1aa]">{activeHeroProfile?.iwadName || iwads[0]?.name || 'IWAD'}</span>
              </div>

              <div className="flex items-center gap-1.5 bg-[#0c0c0f] border border-[#2d2d34] px-2.5 py-1 rounded-[8px] transition-colors duration-[0.001s] ease-[ease]">
                <Layers className="h-3.5 w-3.5 text-[#71717a]" />
                <span className="font-[500] text-[#a1a1aa]">
                  {activeHeroProfile?.mods && activeHeroProfile.mods.length > 0
                    ? `${activeHeroProfile.mods.filter((m) => m.enabled).length} active mod(s)`
                    : 'Vanilla (No Mods)'}
                </span>
              </div>
            </div>
          </div>

          {/* CTA — Button Slate spec: bg #0f0f12 / #0c0c0f, radius 14px/32px, padding 8px 14px 8px 18px, motion 0.001s ease */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleLaunchHero}
              disabled={isLaunchingHero}
              className="inline-flex items-center justify-center gap-2.5 rounded-[32px] bg-[#0f0f12] hover:bg-[#0c0c0f] text-[#f4f4f5] border border-[#2d2d34] hover:border-[#3a3a44] pt-[8px] pr-[14px] pb-[8px] pl-[18px] text-sm font-[500] transition-[background-color,color,border-color] duration-[0.001s] ease-[ease] disabled:opacity-50 shadow-none [font-family:var(--font-geist),Geist,sans-serif]"
            >
              {isLaunchingHero ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  <span>PLAY NOW</span>
                </>
              )}
            </button>

            {activeHeroProfile && onSelectProfile && (
              <button
                type="button"
                onClick={() => onSelectProfile(activeHeroProfile.id)}
                className="inline-flex items-center justify-center gap-1.5 text-xs text-[#a1a1aa] hover:text-[#f4f4f5] py-1 transition-[color] duration-[0.001s] ease-[ease] font-[500] [font-family:var(--font-geist),Geist,sans-serif]"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Configure Setup</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ONBOARDING — Slate */
        <div className="rounded-[12px] border border-[#2d2d34] bg-[#0f0f12] p-8 text-center space-y-4 transition-colors duration-[0.001s] ease-[ease]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#0c0c0f] text-[#5e7ce2] border border-[#2d2d34]">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-[500] text-[#f4f4f5] tracking-tight [font-family:var(--font-geist),Geist,sans-serif]">
              Welcome to RNT Launcher. Let&apos;s find your Doom games.
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs text-[#a1a1aa] leading-relaxed font-[500]">
              Scan your system to automatically discover installed source ports (GZDoom, PRBoom+, DSDA-Doom, Woof) and game IWADs (DOOM, DOOM II, Final Doom).
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleScan}
              disabled={isScanning}
              className="inline-flex items-center gap-2 rounded-[14px] bg-[#0f0f12] hover:bg-[#0c0c0f] text-[#f4f4f5] border border-[#2d2d34] pt-[8px] pr-[14px] pb-[8px] pl-[18px] text-xs font-[500] transition-[background-color,color,border-color] duration-[0.001s] ease-[ease] [font-family:var(--font-geist),Geist,sans-serif]"
            >
              <FolderSearch className="h-4 w-4" />
              <span>{isScanning ? 'Scanning...' : 'Auto-Detect Installed Games & Ports'}</span>
            </button>
            {onNavigateToLibrary && (
              <button
                type="button"
                onClick={onNavigateToLibrary}
                className="inline-flex items-center gap-2 rounded-[14px] border border-[#2d2d34] bg-[#0c0c0f] hover:bg-[#0f0f12] hover:border-[#3a3a44] px-4 py-2 text-xs font-[500] text-[#a1a1aa] hover:text-[#f4f4f5] transition-[background-color,color,border-color] duration-[0.001s] ease-[ease] [font-family:var(--font-geist),Geist,sans-serif]"
              >
                <FolderOpen className="h-4 w-4" />
                <span>Open Library</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* SETUPS GALLERY — Slate */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-[500] text-[#f4f4f5] tracking-tight [font-family:var(--font-geist),Geist,sans-serif]">Your Setups</h2>
            <span className="text-xs font-[500] text-[#71717a] [font-family:var(--font-geist),Geist,sans-serif]">({profiles.length})</span>
          </div>

          <div className="flex items-center gap-3">
            {onCreateProfile && (
              <button
                type="button"
                onClick={onCreateProfile}
                className="inline-flex items-center gap-1.5 text-xs font-[500] text-[#a1a1aa] hover:text-[#f4f4f5] transition-[color] duration-[0.001s] ease-[ease] [font-family:var(--font-geist),Geist,sans-serif]"
              >
                <Plus className="h-3.5 w-3.5 text-[#5e7ce2]" />
                <span>New Setup</span>
              </button>
            )}
            {profiles.length > 0 && onNavigateToProfiles && (
              <button
                type="button"
                onClick={onNavigateToProfiles}
                className="inline-flex items-center gap-1 text-xs font-[500] text-[#a1a1aa] hover:text-[#f4f4f5] transition-[color] duration-[0.001s] ease-[ease] [font-family:var(--font-geist),Geist,sans-serif]"
              >
                <span>View all</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {displayProfiles.length === 0 ? (
          <div className="rounded-[12px] border border-[#2d2d34] bg-[#0f0f12] p-6 text-center transition-colors duration-[0.001s] ease-[ease]">
            <p className="text-xs text-[#a1a1aa] font-[500]">No preset setups configured yet.</p>
            {onCreateProfile && (
              <button
                type="button"
                onClick={onCreateProfile}
                className="mt-3 inline-flex items-center gap-1.5 rounded-[14px] bg-[#0f0f12] hover:bg-[#0c0c0f] text-[#f4f4f5] border border-[#2d2d34] pt-[8px] pr-[14px] pb-[8px] pl-[18px] text-xs font-[500] transition-[background-color,color] duration-[0.001s] ease-[ease] [font-family:var(--font-geist),Geist,sans-serif]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create First Setup</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayProfiles.map((prof) => (
              <RecentProfileCard
                key={prof.id}
                profile={prof}
                onLaunch={handleLaunch}
                onToggleFavorite={handleToggleFavorite}
                onSelectProfile={onSelectProfile}
              />
            ))}
          </div>
        )}
      </div>

      {/* ACTIVITY & SYSTEM OVERVIEW — 12-col */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1">
        {/* Recent Sessions */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-[500] text-[#f4f4f5] tracking-tight [font-family:var(--font-geist),Geist,sans-serif]">Recent Sessions</h2>
            <button
              type="button"
              onClick={loadDashboardData}
              title="Refresh recent sessions"
              className="p-1 rounded-[8px] text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#0c0c0f] transition-[background-color,color] duration-[0.001s] ease-[ease]"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-hidden rounded-[12px] border border-[#2d2d34] bg-[#0f0f12] transition-colors duration-[0.001s] ease-[ease]">
            {history.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#71717a] font-[500]">
                No recent gameplay sessions logged yet. Launch a preset to start tracking time.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#2d2d34] bg-[#09090b] text-[11px] font-[500] text-[#a1a1aa] [font-family:var(--font-geist),Geist,sans-serif]">
                      <th className="px-3.5 py-2.5">Preset</th>
                      <th className="px-3.5 py-2.5">Port / IWAD</th>
                      <th className="px-3.5 py-2.5">Duration</th>
                      <th className="px-3.5 py-2.5">When</th>
                      <th className="px-3.5 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d2d34]">
                    {history.slice(0, 5).map((record) => {
                      const isSuccess = record.status === 'success' || record.exitCode === 0;
                      return (
                        <tr key={record.id} className="hover:bg-[#0c0c0f] transition-[background-color] duration-[0.001s] ease-[ease]">
                          <td className="px-3.5 py-2.5 font-[500] text-[#f4f4f5]">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'h-1.5 w-1.5 rounded-full shrink-0',
                                  isSuccess ? 'bg-[#5e7ce2]' : 'bg-red-400'
                                )}
                              />
                              <span className="truncate max-w-[140px] text-[#f4f4f5]">
                                {record.profileName || 'Default Setup'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-[#a1a1aa] truncate max-w-[120px] font-[500]">
                            {record.engineName} • {record.iwadName}
                          </td>
                          <td className="px-3.5 py-2.5 text-[#a1a1aa] font-[500] text-[11px] [font-family:var(--font-geist),Geist,sans-serif]">
                            {formatDuration(record.durationMs)}
                          </td>
                          <td className="px-3.5 py-2.5 text-[#71717a] text-[11px] font-[500]" title={formatDate(record.startedAt)}>
                            {formatRelativeTime(record.startedAt)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleLaunch(record.profileId)}
                              className="inline-flex items-center gap-1 rounded-[14px] bg-[#0f0f12] hover:bg-[#0c0c0f] text-[#f4f4f5] hover:text-white border border-[#2d2d34] hover:border-[#3a3a44] px-2 py-1 text-[11px] font-[500] transition-[background-color,color,border-color] duration-[0.001s] ease-[ease] [font-family:var(--font-geist),Geist,sans-serif]"
                            >
                              <Play className="h-2.5 w-2.5 fill-current" />
                              <span>Play</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-[500] text-[#f4f4f5] tracking-tight [font-family:var(--font-geist),Geist,sans-serif]">System Status</h2>
            <button
              type="button"
              onClick={handleScan}
              disabled={isScanning}
              className="inline-flex items-center gap-1 text-xs text-[#a1a1aa] hover:text-[#f4f4f5] transition-[color] duration-[0.001s] ease-[ease] font-[500] [font-family:var(--font-geist),Geist,sans-serif]"
            >
              <FolderSearch className="w-3 h-3" />
              <span>{isScanning ? 'Scanning...' : 'Scan Folders'}</span>
            </button>
          </div>

          <div className="rounded-[12px] border border-[#2d2d34] bg-[#0f0f12] p-4 space-y-3.5 transition-colors duration-[0.001s] ease-[ease]">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#a1a1aa]">
                <Cpu className="w-4 h-4 text-[#71717a]" />
                <span className="font-[500]">Source Ports</span>
              </div>
              <span className="font-[500] text-[#f4f4f5]">
                {engines.length} detected
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#a1a1aa]">
                <Disc className="w-4 h-4 text-[#71717a]" />
                <span className="font-[500]">Base Game IWADs</span>
              </div>
              <span className="font-[500] text-[#f4f4f5]">
                {iwads.length} detected
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#a1a1aa]">
                <Layers className="w-4 h-4 text-[#71717a]" />
                <span className="font-[500]">Mod Catalog</span>
              </div>
              <span className="font-[500] text-[#f4f4f5]">
                {mods.length} files ({mods.filter((m) => m.isFavorite).length} starred)
              </span>
            </div>

            <div className="pt-2.5 border-t border-[#2d2d34] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#a1a1aa]">
                <Clock className="w-4 h-4 text-[#71717a]" />
                <span className="font-[500]">Total Playtime</span>
              </div>
              <span className="font-[500] text-[#5e7ce2] [font-family:var(--font-geist),Geist,sans-serif]">
                {formatDuration(historyStats?.totalPlayTimeMs || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
