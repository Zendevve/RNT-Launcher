import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  Layers,
  Disc,
  Cpu,
  Clock,
  RotateCw,
  FolderSearch,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  FolderOpen,
  ArrowUpRight,
  Sparkles,
  Zap,
  History as HistoryIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Profile, Mod, IWAD, Engine, LaunchRecord, HistoryStats, Settings } from '../../types';
import { api } from '../../services/api';
import { RecentProfileCard } from './RecentProfileCard';
import { formatDuration, formatRelativeTime, formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';

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

  // Quick Play selected state (defaults to favorite profile or first profile or first engine+iwad)
  const [quickEngineId, setQuickEngineId] = useState<string>('');
  const [quickIwadId, setQuickIwadId] = useState<string>('');

  const [actionNotification, setActionNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setActionNotification({ type, message });
    setTimeout(() => {
      setActionNotification(null);
    }, 3500);
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
        api.listLaunchHistory(20).catch(() => []),
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

      // Initialize quick play selections
      if (eList.length > 0 && !quickEngineId) {
        setQuickEngineId(eList[0].id);
      }
      if (iList.length > 0 && !quickIwadId) {
        setQuickIwadId(iList[0].id);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      showNotification('error', 'Could not load mission control data.');
    }
  }, [quickEngineId, quickIwadId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleLaunch = async (profileId: string) => {
    try {
      showNotification('info', 'Executing engine binary...');
      await api.launchProfile(profileId);
      showNotification('success', 'Launch session started successfully.');
      loadDashboardData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Launch failed';
      showNotification('error', `Launch failed: ${message}`);
    }
  };

  const handleQuickPlayHero = async () => {
    if (isLaunchingHero) return;
    setIsLaunchingHero(true);
    try {
      // If we have an existing profile matching quick selections, launch it
      const matchingProfile =
        profiles.find((p) => p.isFavorite) ||
        profiles.find((p) => p.engineId === quickEngineId && p.iwadId === quickIwadId) ||
        profiles[0];

      if (matchingProfile) {
        showNotification('info', `Launching ${matchingProfile.name}...`);
        await api.launchProfile(matchingProfile.id);
        showNotification('success', 'Game launched successfully.');
        loadDashboardData();
      } else if (quickEngineId && quickIwadId) {
        // Create an on-the-fly default profile and launch it
        const selEng = engines.find((e) => e.id === quickEngineId);
        const selIw = iwads.find((w) => w.id === quickIwadId);
        const defaultProf = await api.createProfile({
          name: `${selIw?.name || 'Doom'} (${selEng?.name || 'Port'})`,
          engineId: quickEngineId,
          engineName: selEng?.name || '',
          iwadId: quickIwadId,
          iwadName: selIw?.name || '',
          mods: [],
          arguments: [],
          workingDir: '',
          isFavorite: false,
        });
        showNotification('info', `Starting ${defaultProf.name}...`);
        await api.launchProfile(defaultProf.id);
        showNotification('success', 'Game launched successfully.');
        loadDashboardData();
      } else {
        showNotification('info', 'Please select a source port engine and base IWAD first.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start game';
      showNotification('error', msg);
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
    if (isScanning) return;
    setIsScanning(true);
    showNotification('info', 'Scanning system for game assets...');
    try {
      const result = await api.startScan();
      showNotification(
        'success',
        `Scan complete: ${result.discoveredMods || 0} mods, ${result.discoveredIWADs || 0} IWADs.`
      );
      loadDashboardData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scan failed';
      showNotification('error', `Scan failed: ${message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const isCompact = settings?.uiDensity === 'compact';

  // Profile selection logic
  const favoriteProfiles = profiles.filter((p) => p.isFavorite);
  const otherProfiles = profiles.filter((p) => !p.isFavorite);
  const displayProfiles = [...favoriteProfiles, ...otherProfiles].slice(0, 4);

  const hasAssets = engines.length > 0 && iwads.length > 0;
  const maxRecentLaunches = settings?.showRecentLaunches ?? 3;
  const displayHistory = maxRecentLaunches > 0 ? history.slice(0, maxRecentLaunches) : [];

  const activeHeroProfile =
    profiles.find((p) => p.isFavorite) ||
    profiles.find((p) => p.engineId === quickEngineId && p.iwadId === quickIwadId) ||
    profiles[0];

  return (
    <div className={cn('flex-1 overflow-y-auto bg-[#0c0e10] text-zinc-100 select-none', isCompact ? 'p-6 space-y-6' : 'p-8 space-y-8')}>
      {/* Toast Notification */}
      {actionNotification && (
        <div
          className={`fixed bottom-6 right-8 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all duration-150 ${
            actionNotification.type === 'success'
              ? 'border-emerald-800/40 bg-[#122419] text-emerald-200'
              : actionNotification.type === 'error'
              ? 'border-red-800/40 bg-[#2b1416] text-red-200'
              : 'border-blue-800/40 bg-[#132232] text-blue-200'
          }`}
        >
          {actionNotification.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
          {actionNotification.type === 'error' && <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
          {actionNotification.type === 'info' && <Sparkles className="h-4 w-4 shrink-0 text-blue-400" />}
          <span className="font-mono text-xs">{actionNotification.message}</span>
        </div>
      )}

      {/* QUICK PLAY HERO SECTION */}
      {hasAssets ? (
        <div className="p-6 rounded-xl border border-white/[0.08] bg-[#15181c] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-400">
                Ready to Launch
              </span>
              {activeHeroProfile && (
                <span className="text-zinc-500 font-mono text-xs">
                  • Preset: <strong className="text-zinc-200 font-semibold">{activeHeroProfile.name}</strong>
                </span>
              )}
            </div>

            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                {activeHeroProfile
                  ? activeHeroProfile.name
                  : (iwads.find((w) => w.id === quickIwadId)?.name || 'Doom')}
              </h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-xl">
                {activeHeroProfile?.description ||
                  '1-click instant launch using selected source port engine and base game data.'}
              </p>
            </div>

            {/* Quick Engine and IWAD Dropdown Selectors */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-mono">
              <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/[0.07]">
                <Cpu className="h-3.5 w-3.5 text-blue-400" />
                <select
                  value={quickEngineId}
                  onChange={(e) => setQuickEngineId(e.target.value)}
                  className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
                >
                  {engines.map((eng) => (
                    <option key={eng.id} value={eng.id} className="bg-[#141619] text-zinc-100">
                      {eng.name} ({eng.family})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/[0.07]">
                <Disc className="h-3.5 w-3.5 text-amber-400" />
                <select
                  value={quickIwadId}
                  onChange={(e) => setQuickIwadId(e.target.value)}
                  className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
                >
                  {iwads.map((w) => (
                    <option key={w.id} value={w.id} className="bg-[#141619] text-zinc-100">
                      {w.name} ({w.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {activeHeroProfile && activeHeroProfile.mods && activeHeroProfile.mods.length > 0 && (
                <div className="flex items-center gap-1.5 text-zinc-400 px-2 py-1">
                  <Layers className="h-3.5 w-3.5 text-amber-400" />
                  <span>{activeHeroProfile.mods.filter((m) => m.enabled).length} active mod(s)</span>
                </div>
              )}
            </div>
          </div>

          {/* Primary Big PLAY NOW Button */}
          <div className="flex items-center gap-3 shrink-0">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleQuickPlayHero}
              disabled={isLaunchingHero}
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#dc2626] hover:bg-[#c02020] px-8 py-4 text-sm font-bold uppercase tracking-wider text-white border border-red-500/30 transition-colors disabled:opacity-50"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>{isLaunchingHero ? 'STARTING...' : 'PLAY NOW'}</span>
            </motion.button>
          </div>
        </div>
      ) : (
        /* Empty / First-Run Onboarding Card */
        <div className="p-8 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-amber-400 border border-white/[0.08]">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold uppercase tracking-tight text-white">
              No Doom Games or Source Ports Detected
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs text-zinc-400 leading-relaxed">
              Scan your system to automatically discover installed engines (GZDoom, DSDA-Doom, Woof) and base game IWADs (DOOM2.WAD, DOOM.WAD, TNT, Plutonia).
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleScan}
              disabled={isScanning}
              className="inline-flex items-center gap-2 rounded-md bg-[#dc2626] hover:bg-[#c02020] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white border border-red-500/30 transition-colors"
            >
              <FolderSearch className="h-4 w-4" />
              <span>{isScanning ? 'SCANNING...' : 'AUTO-DETECT GAMES & PORTS'}</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToLibrary}
              className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-[#15181c] px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-[#1f2228] hover:text-white transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              <span>OPEN LIBRARY</span>
            </button>
          </div>
        </div>
      )}

      {/* CORE STATS BENTO TILES */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Metric 1: Total Mods */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={onNavigateToLibrary}
          className="group flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#15181c] p-4.5 transition-colors hover:border-white/[0.18] hover:bg-[#1a1e24] cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Total Mods
            </span>
            <div className="rounded-lg bg-[#2b2011] p-1.5 text-[#fde047] border border-amber-800/30">
              <Layers className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-white">
              {mods.length}
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {mods.filter((m) => m.isFavorite).length} favorites in library
            </p>
          </div>
        </motion.div>

        {/* Metric 2: Base IWADs */}
        <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#15181c] p-4.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Base IWADs
            </span>
            <div className="rounded-lg bg-[#132232] p-1.5 text-[#93c5fd] border border-blue-800/30">
              <Disc className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-white">
              {iwads.length}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-zinc-400">
              {iwads.length > 0
                ? iwads.map((i) => i.name.split('.')[0]).join(', ')
                : 'None detected'}
            </p>
          </div>
        </div>

        {/* Metric 3: Source Ports / Engines */}
        <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#15181c] p-4.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Engines
            </span>
            <div className="rounded-lg bg-[#132232] p-1.5 text-[#93c5fd] border border-blue-800/30">
              <Cpu className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-white">
              {engines.length}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-zinc-400">
              {engines.length > 0
                ? engines.map((e) => e.name).join(', ')
                : 'No engines registered'}
            </p>
          </div>
        </div>

        {/* Metric 4: Total Play Time */}
        <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#15181c] p-4.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Play Time
            </span>
            <div className="rounded-lg bg-[#122419] p-1.5 text-[#86efac] border border-emerald-800/30">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-white">
              {formatDuration(historyStats?.totalPlayTimeMs || 0)}
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {historyStats?.totalLaunches || history.length} total launches logged
            </p>
          </div>
        </div>
      </div>

      {/* QUICK LAUNCH PROFILES SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              Launch Profiles
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCreateProfile}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-red-400" />
              <span>New Profile</span>
            </button>
            {profiles.length > 0 && onNavigateToProfiles && (
              <button
                type="button"
                onClick={onNavigateToProfiles}
                className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                <span>View all ({profiles.length})</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {displayProfiles.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#15181c] p-6 text-center">
            <p className="text-xs text-zinc-400">No launch profiles configured yet.</p>
            <button
              type="button"
              onClick={onCreateProfile}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#dc2626] hover:bg-[#c02020] px-3.5 py-1.5 text-xs font-bold uppercase text-white border border-red-500/30 transition-colors"
            >
              <Plus className="h-3 w-3" />
              <span>Create First Profile</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-4">
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

      {/* RECENT LAUNCH SESSIONS TABLE */}
      {maxRecentLaunches > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HistoryIcon className="h-4 w-4 text-blue-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Recent Game Sessions
              </h2>
            </div>
            <button
              type="button"
              onClick={loadDashboardData}
              title="Refresh dashboard data"
              className="rounded-md p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#15181c]">
            {displayHistory.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400 font-mono">
                No recent launch records found. Launch a profile to record gameplay sessions.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/[0.07] bg-white/[0.02] text-[10.5px] uppercase tracking-wider text-zinc-400">
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Profile</th>
                      <th className="px-4 py-2.5">Engine</th>
                      <th className="px-4 py-2.5">IWAD</th>
                      <th className="px-4 py-2.5">Duration</th>
                      <th className="px-4 py-2.5">Launched</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {displayHistory.map((record) => {
                      const isSuccess = record.status === 'success' || record.exitCode === 0;
                      return (
                        <tr
                          key={record.id}
                          className="transition-colors hover:bg-white/[0.04]"
                        >
                          {/* Status */}
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase ${
                                isSuccess
                                  ? 'border border-emerald-800/40 bg-[#122419] text-[#86efac]'
                                  : 'border border-red-800/40 bg-[#2b1416] text-[#fca5a5]'
                              }`}
                            >
                              {isSuccess ? 'SUCCESS' : 'FAILED'}
                            </span>
                          </td>

                          {/* Profile Name */}
                          <td className="px-4 py-2.5 font-semibold text-zinc-100">
                            {record.profileName || 'Default Profile'}
                          </td>

                          {/* Engine */}
                          <td className="px-4 py-2.5 text-blue-400">
                            {record.engineName || 'Engine'}
                          </td>

                          {/* IWAD */}
                          <td className="px-4 py-2.5 text-blue-400">
                            {record.iwadName || 'DOOM2.WAD'}
                          </td>

                          {/* Duration */}
                          <td className="px-4 py-2.5 text-zinc-400">
                            {formatDuration(record.durationMs)}
                          </td>

                          {/* Timestamp */}
                          <td
                            className="px-4 py-2.5 text-zinc-400"
                            title={formatDate(record.startedAt)}
                          >
                            {formatRelativeTime(record.startedAt)}
                          </td>

                          {/* Relaunch Action */}
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleLaunch(record.profileId)}
                              className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] border border-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-zinc-200 transition-colors hover:bg-[#dc2626] hover:text-white hover:border-[#dc2626]"
                            >
                              <Play className="h-3 w-3 fill-current" />
                              <span>PLAY</span>
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
      )}
    </div>
  );
};
