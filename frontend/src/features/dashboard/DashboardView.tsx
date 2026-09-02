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
import { Profile, Mod, IWAD, Engine, LaunchRecord, HistoryStats, Settings } from '../../types';
import { api } from '../../services/api';
import { RecentProfileCard } from './RecentProfileCard';
import { formatDuration, formatRelativeTime, formatDate } from '../../utils/formatters';
import { BRAND_SUMMARY } from '../../lib/constants';
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

  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [actionNotification, setActionNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setActionNotification({ type, message });
    setTimeout(() => {
      setActionNotification(null);
    }, 4500);
  };

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [
        fetchedProfiles,
        fetchedMods,
        fetchedIWADs,
        fetchedEngines,
        fetchedHistory,
        fetchedStats,
        fetchedSettings,
      ] = await Promise.all([
        api.listProfiles(),
        api.listMods(),
        api.listIWADs(),
        api.listEngines(),
        api.listLaunchHistory(10),
        api.getHistoryStats(),
        api.getSettings().catch(() => null),
      ]);

      setProfiles(fetchedProfiles || []);
      setMods(fetchedMods || []);
      setIWADs(fetchedIWADs || []);
      setEngines(fetchedEngines || []);
      setHistory(fetchedHistory || []);
      setHistoryStats(fetchedStats || null);
      if (fetchedSettings) setSettings(fetchedSettings);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      showNotification('error', 'Failed to load system dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleLaunch = async (profileId: string) => {
    try {
      const record = await api.launchProfile(profileId);
      showNotification(
        'success',
        `Launched "${record.profileName}" successfully via ${record.engineName}`
      );
      // Refresh history & stats
      const [updatedHistory, updatedStats] = await Promise.all([
        api.listLaunchHistory(10),
        api.getHistoryStats(),
      ]);
      setHistory(updatedHistory);
      setHistoryStats(updatedStats);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown launch error';
      showNotification('error', `Launch failed: ${errorMsg}`);
    }
  };

  const handleToggleFavorite = async (profileId: string) => {
    try {
      await api.toggleProfileFavorite(profileId);
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, isFavorite: !p.isFavorite } : p))
      );
    } catch (err) {
      console.error('Failed to toggle profile favorite:', err);
    }
  };

  const handleScan = async () => {
    if (isScanning) return;
    try {
      setIsScanning(true);
      const result = await api.startScan();
      showNotification(
        'success',
        `Scan complete! Discovered: ${result.discoveredMods} mods, ${result.discoveredIWADs} IWADs, ${result.discoveredEngines} engines.`
      );
      await loadDashboardData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      showNotification('error', `Directory scan error: ${msg}`);
    } finally {
      setIsScanning(false);
    }
  };

  const isCompact = settings?.uiDensity === 'compact';

  // Profile selection logic: Favorites first, then most recently created/updated
  const favoriteProfiles = profiles.filter((p) => p.isFavorite);
  const otherProfiles = profiles.filter((p) => !p.isFavorite);
  const displayProfiles = [...favoriteProfiles, ...otherProfiles].slice(0, 4);

  const isLibraryEmpty = mods.length === 0 && iwads.length === 0;

  // Recent launches display limit
  const maxRecentLaunches = settings?.showRecentLaunches ?? 3;
  const displayHistory = maxRecentLaunches > 0 ? history.slice(0, maxRecentLaunches) : [];

  return (
    <div className={cn('flex-1 overflow-y-auto bg-doom-bg text-doom-text', isCompact ? 'px-6 py-5' : 'px-8 py-6')}>
      {/* Toast / Notification Banner */}
      {actionNotification && (
        <div
          className={`fixed bottom-6 right-8 z-50 flex items-center gap-3 rounded-md border px-4 py-3 text-sm shadow-xl transition-all duration-300 ${
            actionNotification.type === 'success'
              ? 'border-doom-green/40 bg-doom-surface text-doom-green-bright shadow-doom-green/10'
              : actionNotification.type === 'error'
              ? 'border-doom-red/40 bg-doom-surface text-doom-red-bright shadow-doom-red/10'
              : 'border-doom-cyan/40 bg-doom-surface text-doom-cyan shadow-doom-cyan/10'
          }`}
        >
          {actionNotification.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {actionNotification.type === 'error' && <XCircle className="h-4 w-4 shrink-0" />}
          {actionNotification.type === 'info' && <Sparkles className="h-4 w-4 shrink-0" />}
          <span className="font-mono text-xs">{actionNotification.message}</span>
        </div>
      )}

      {/* Top Header Section with subtle Brand Promise */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center border-b border-doom-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-doom-red animate-pulse" />
            <h1 className="font-mono text-xl font-black uppercase tracking-widest text-doom-text">
              MISSION CONTROL
            </h1>
            <span className="rounded bg-doom-red/15 px-2 py-0.5 font-mono text-[9.5px] font-bold text-doom-red-bright border border-doom-red/30 uppercase">
              Fast &amp; Lightweight
            </span>
          </div>
          <p className="mt-1 text-[11px] font-mono text-doom-muted">
            {BRAND_SUMMARY}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleScan}
            disabled={isScanning}
            className="inline-flex items-center gap-2 rounded border border-doom-border bg-doom-surface px-3 py-1.5 text-xs font-mono font-medium text-doom-text transition-colors hover:border-doom-border-bright hover:bg-doom-card disabled:opacity-50"
          >
            <FolderSearch className={`h-3.5 w-3.5 text-doom-cyan ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'SCANNING...' : 'SCAN DIRECTORIES'}</span>
          </button>

          <button
            type="button"
            onClick={onCreateProfile}
            className="inline-flex items-center gap-2 rounded bg-doom-red px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-doom-red/20 transition-colors hover:bg-doom-red-bright"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>NEW PROFILE</span>
          </button>
        </div>
      </div>

      {/* Empty Library Onboarding CTA */}
      {isLibraryEmpty && !isLoading && (
        <div className="mt-5 rounded-lg border border-dashed border-doom-border-bright bg-doom-surface/50 p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-doom-card text-doom-amber">
            <Zap className="h-5 w-5" />
          </div>
          <h2 className="mt-2.5 font-mono text-sm font-bold uppercase tracking-wider text-doom-text">
            No Mods or IWADs Registered
          </h2>
          <p className="mx-auto mt-1 max-w-md text-[11px] text-doom-muted">
            Scan your system directories to automatically discover GZDoom, Chocolate Doom, DOOM2.WAD,
            and your mod library.
          </p>
          <div className="mt-3.5 flex justify-center gap-2.5">
            <button
              type="button"
              onClick={handleScan}
              disabled={isScanning}
              className="inline-flex items-center gap-2 rounded bg-doom-red px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-doom-red-bright"
            >
              <FolderSearch className="h-3.5 w-3.5" />
              <span>RUN AUTOMATIC SCAN</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToLibrary}
              className="inline-flex items-center gap-2 rounded border border-doom-border bg-doom-card px-3.5 py-1.5 text-xs font-mono text-doom-text hover:bg-doom-surface"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>OPEN MOD LIBRARY</span>
            </button>
          </div>
        </div>
      )}

      {/* Stats Banner: 4-Column Grid */}
      <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', isCompact ? 'mt-4' : 'mt-6')}>
        {/* Metric 1: Total Mods */}
        <div
          onClick={onNavigateToLibrary}
          className="group flex flex-col justify-between rounded-lg border border-doom-border bg-doom-surface/70 p-3.5 transition-all duration-200 hover:border-doom-border-bright hover:bg-doom-surface cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-doom-muted">
              Total Mods
            </span>
            <div className="rounded bg-doom-card p-1 text-doom-amber">
              <Layers className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="font-mono text-xl font-extrabold text-doom-text group-hover:text-white">
              {mods.length}
            </div>
            <p className="mt-0.5 text-[10px] text-doom-muted">
              {mods.filter((m) => m.isFavorite).length} favorites in library
            </p>
          </div>
        </div>

        {/* Metric 2: Base IWADs */}
        <div className="flex flex-col justify-between rounded-lg border border-doom-border bg-doom-surface/70 p-3.5 transition-all duration-200 hover:border-doom-border-bright hover:bg-doom-surface">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-doom-muted">
              Base IWADs
            </span>
            <div className="rounded bg-doom-card p-1 text-doom-blue">
              <Disc className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="font-mono text-xl font-extrabold text-doom-text">
              {iwads.length}
            </div>
            <p className="mt-0.5 truncate text-[10px] text-doom-muted">
              {iwads.length > 0
                ? iwads.map((i) => i.name.split('.')[0]).join(', ')
                : 'None detected'}
            </p>
          </div>
        </div>

        {/* Metric 3: Source Ports / Engines */}
        <div className="flex flex-col justify-between rounded-lg border border-doom-border bg-doom-surface/70 p-3.5 transition-all duration-200 hover:border-doom-border-bright hover:bg-doom-surface">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-doom-muted">
              Engines
            </span>
            <div className="rounded bg-doom-card p-1 text-doom-cyan">
              <Cpu className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="font-mono text-xl font-extrabold text-doom-text">
              {engines.length}
            </div>
            <p className="mt-0.5 truncate text-[10px] text-doom-muted">
              {engines.length > 0
                ? engines.map((e) => e.name).join(', ')
                : 'No engines registered'}
            </p>
          </div>
        </div>

        {/* Metric 4: Total Play Time & Launches */}
        <div className="flex flex-col justify-between rounded-lg border border-doom-border bg-doom-surface/70 p-3.5 transition-all duration-200 hover:border-doom-border-bright hover:bg-doom-surface">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-doom-muted">
              Play Time
            </span>
            <div className="rounded bg-doom-card p-1 text-doom-green">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="font-mono text-xl font-extrabold text-doom-text">
              {formatDuration(historyStats?.totalPlayTimeMs || 0)}
            </div>
            <p className="mt-0.5 text-[10px] text-doom-muted">
              {historyStats?.totalLaunches || history.length} total launches logged
            </p>
          </div>
        </div>
      </div>

      {/* Quick Launch Cards Section */}
      <div className={cn(isCompact ? 'mt-6' : 'mt-8')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-doom-red" />
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-doom-text">
              QUICK LAUNCH PROFILES
            </h2>
          </div>
          {profiles.length > 0 && onNavigateToProfiles && (
            <button
              type="button"
              onClick={onNavigateToProfiles}
              className="inline-flex items-center gap-1 font-mono text-xs text-doom-muted hover:text-doom-text transition-colors"
            >
              <span>View all ({profiles.length})</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {displayProfiles.length === 0 ? (
          <div className="mt-3 rounded-lg border border-doom-border bg-doom-surface/40 p-6 text-center">
            <p className="text-xs text-doom-muted">No launch profiles configured yet.</p>
            <button
              type="button"
              onClick={onCreateProfile}
              className="mt-2.5 inline-flex items-center gap-2 rounded bg-doom-red px-3 py-1.5 text-xs font-bold uppercase text-white hover:bg-doom-red-bright"
            >
              <Plus className="h-3 w-3" />
              <span>Create Profile</span>
            </button>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
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

      {/* Recent Launch History Feed Table (Respects showRecentLaunches) */}
      {maxRecentLaunches > 0 && (
        <div className={cn(isCompact ? 'mt-6' : 'mt-8')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HistoryIcon className="h-4 w-4 text-doom-cyan" />
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-doom-text">
                RECENT LAUNCH SESSIONS
              </h2>
            </div>
            <button
              type="button"
              onClick={loadDashboardData}
              title="Refresh dashboard data"
              className="rounded p-1 text-doom-muted hover:bg-doom-card hover:text-doom-text transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border border-doom-border bg-doom-surface/60">
            {displayHistory.length === 0 ? (
              <div className="p-6 text-center text-xs text-doom-muted font-mono">
                No recent launch records found. Launch a profile to record gameplay sessions.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-doom-border bg-doom-card/80 text-[10.5px] uppercase tracking-wider text-doom-muted">
                      <th className="px-3.5 py-2">Status</th>
                      <th className="px-3.5 py-2">Profile</th>
                      <th className="px-3.5 py-2">Engine</th>
                      <th className="px-3.5 py-2">IWAD</th>
                      <th className="px-3.5 py-2">Duration</th>
                      <th className="px-3.5 py-2">Launched</th>
                      <th className="px-3.5 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-doom-border/40">
                    {displayHistory.map((record) => {
                      const isSuccess = record.status === 'success' || record.exitCode === 0;
                      return (
                        <tr
                          key={record.id}
                          className="transition-colors hover:bg-doom-card/40"
                        >
                          {/* Status */}
                          <td className="px-3.5 py-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[9.5px] font-bold uppercase ${
                                isSuccess
                                  ? 'border border-doom-green/30 bg-doom-green/10 text-doom-green-bright'
                                  : 'border border-doom-red/30 bg-doom-red/10 text-doom-red-bright'
                              }`}
                            >
                              {isSuccess ? 'SUCCESS' : 'FAILED'}
                            </span>
                          </td>

                          {/* Profile Name */}
                          <td className="px-3.5 py-2 font-semibold text-doom-text">
                            {record.profileName || 'Default Profile'}
                          </td>

                          {/* Engine */}
                          <td className="px-3.5 py-2 text-doom-cyan">
                            {record.engineName || 'Engine'}
                          </td>

                          {/* IWAD */}
                          <td className="px-3.5 py-2 text-doom-blue">
                            {record.iwadName || 'DOOM2.WAD'}
                          </td>

                          {/* Duration */}
                          <td className="px-3.5 py-2 text-doom-muted">
                            {formatDuration(record.durationMs)}
                          </td>

                          {/* Timestamp */}
                          <td
                            className="px-3.5 py-2 text-doom-muted"
                            title={formatDate(record.startedAt)}
                          >
                            {formatRelativeTime(record.startedAt)}
                          </td>

                          {/* Relaunch Action */}
                          <td className="px-3.5 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleLaunch(record.profileId)}
                              className="inline-flex items-center gap-1 rounded bg-doom-card px-2 py-0.5 text-[10.5px] font-semibold text-doom-text transition-colors hover:bg-doom-red hover:text-white"
                            >
                              <Play className="h-2.5 w-2.5 fill-current" />
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
