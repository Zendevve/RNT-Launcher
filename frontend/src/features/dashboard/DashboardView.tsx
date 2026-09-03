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
  Flame,
  Star,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Sliders,
} from 'lucide-react';
import { Profile, Mod, IWAD, Engine, LaunchRecord, HistoryStats, Settings } from '../../types';
import { api } from '../../services/api';
import { formatDuration, formatRelativeTime, formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';

interface ProfileLeaderboardRowProps {
  profile: Profile;
  rank: number;
  onLaunch: (profileId: string) => Promise<void>;
  onToggleFavorite: (profileId: string) => Promise<void>;
  onSelectProfile?: (profileId: string) => void;
}

const ProfileLeaderboardRow: React.FC<ProfileLeaderboardRowProps> = ({
  profile,
  rank,
  onLaunch,
  onToggleFavorite,
  onSelectProfile,
}) => {
  const [isLaunching, setIsLaunching] = useState(false);
  const [isFavLoading, setIsFavLoading] = useState(false);

  const activeModCount = profile.mods?.filter((m) => m.enabled).length ?? 0;
  const totalModCount = profile.mods?.length ?? 0;
  const isReady = Boolean(profile.engineName && profile.iwadName);
  const rankLabel = String(rank).padStart(2, '0');
  const GhostIcon = totalModCount > 0 ? Flame : Layers;
  const InlineIcon = totalModCount > 0 ? Flame : Layers;

  const handleLaunch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLaunching) return;
    setIsLaunching(true);
    try {
      await onLaunch(profile.id);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFavLoading) return;
    setIsFavLoading(true);
    try {
      await onToggleFavorite(profile.id);
    } finally {
      setIsFavLoading(false);
    }
  };

  return (
    <div
      onClick={() => onSelectProfile?.(profile.id)}
      className="group relative flex h-[56px] w-full items-center gap-3 overflow-hidden border border-[#22262d] bg-[#14171c] px-3 transition-colors hover:bg-[#181c22] cursor-pointer select-none"
    >
      <span className="w-8 shrink-0 font-mono text-xs font-medium tracking-wide text-zinc-500 text-center">
        {rankLabel}
      </span>

      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-[#22262d] bg-[#1b1f26]">
        <InlineIcon className="h-3.5 w-3.5 text-zinc-400" />
      </div>

      <button
        type="button"
        onClick={handleFavorite}
        disabled={isFavLoading}
        title={profile.isFavorite ? 'Remove favorite' : 'Add favorite'}
        className="shrink-0 rounded p-1 text-zinc-500 hover:text-amber-400 hover:bg-white/[0.04] transition-colors disabled:opacity-50"
      >
        <Star
          className={cn(
            'h-3.5 w-3.5 transition-colors',
            profile.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-zinc-500'
          )}
        />
      </button>

      <div className="min-w-0 flex-1">
        <div
          className="truncate font-mono text-[13px] font-bold leading-none tracking-[-0.02em] text-zinc-100"
          title={profile.name}
        >
          {profile.name}
        </div>
        <div className="truncate font-mono text-[11px] leading-none text-zinc-500 mt-1">
          {(profile.engineName || 'NO PORT').toUpperCase()} {profile.engineName && profile.iwadName ? '•' : ''} {(profile.iwadName || 'NO IWAD').toUpperCase()}
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 flex-col items-end gap-0.5 font-mono">
        <span className="text-[11px] font-bold leading-none text-zinc-300">
          {totalModCount === 0 ? 'VANILLA' : `${activeModCount} mods`}
        </span>
        <span
          className={cn(
            'text-[10px] font-bold leading-none tracking-wide',
            isReady ? 'text-emerald-400' : 'text-red-400'
          )}
        >
          {isReady ? '+ READY' : '- NEEDS SETUP'}
        </span>
      </div>

      <button
        type="button"
        onClick={handleLaunch}
        disabled={isLaunching}
        className="relative z-10 inline-flex shrink-0 items-center gap-1 rounded bg-[#dc2626] px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#ef4444] disabled:opacity-50"
      >
        {isLaunching ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Play className="h-3 w-3 fill-current" />
        )}
        <span>{isLaunching ? '...' : 'Play'}</span>
      </button>

      <GhostIcon
        className="pointer-events-none absolute right-[-10px] top-1/2 h-16 w-16 -translate-y-1/2 text-white opacity-[0.06] select-none"
        aria-hidden
      />
    </div>
  );
};

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

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
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

      // Default hero preset: favorite or first
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

  // Active hero profile object
  const activeHeroProfile =
    profiles.find((p) => p.id === selectedHeroProfileId) ||
    profiles.find((p) => p.isFavorite) ||
    profiles[0];

  // Presets gallery (favorites first, up to 6)
  const sortedProfiles = [...profiles].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return a.name.localeCompare(b.name);
  });
  const displayProfiles = sortedProfiles.slice(0, 6);

  return (
    <div
      className={cn(
        'flex-1 min-h-0 overflow-y-auto bg-[#0c0e12] text-zinc-100 select-none',
        isCompact ? 'p-5 pb-16 space-y-6' : 'p-6 md:p-8 pb-20 space-y-8'
      )}
    >
      {/* Action Notification Toast */}
      {notification && (
        <div
          className={cn(
            'fixed bottom-6 right-8 z-50 flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-xs font-medium shadow-lg transition-all duration-150',
            notification.type === 'success'
              ? 'border-emerald-800/40 bg-[#122419] text-emerald-200'
              : notification.type === 'error'
              ? 'border-red-800/40 bg-[#2b1416] text-red-200'
              : 'border-blue-800/40 bg-[#132232] text-blue-200'
          )}
        >
          {notification.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
          {notification.type === 'error' && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
          {notification.type === 'info' && <Clock className="h-4 w-4 text-blue-400 shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* HERO SECTION */}
      {hasAssets ? (
        <div className="rounded-xl border border-[#22262d] bg-[#12151a] p-6 md:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1 min-w-0 space-y-3">
            {/* Top Status & Preset Switcher Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Ready to Launch</span>
              </div>

              {profiles.length > 1 && (
                <div className="relative inline-flex items-center">
                  <select
                    value={selectedHeroProfileId}
                    onChange={(e) => setSelectedHeroProfileId(e.target.value)}
                    aria-label="Select active preset"
                    className="appearance-none bg-[#1a1e26] hover:bg-[#202530] text-zinc-300 hover:text-white border border-[#2c323e] rounded-md px-3 py-1 pr-7 text-xs font-medium cursor-pointer focus:outline-none focus:border-[#dc2626] transition-colors"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#14171c] text-zinc-100">
                        {p.isFavorite ? '★ ' : ''}
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Main Title & Description */}
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white truncate">
                {activeHeroProfile
                  ? activeHeroProfile.name
                  : (iwads.find((w) => w.id === engines[0]?.id)?.name || 'Doom II')}
              </h1>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl line-clamp-2 leading-relaxed">
                {activeHeroProfile?.description ||
                  'Instant launch with selected source port engine and configured mod load order.'}
              </p>
            </div>

            {/* Quick Specs Pill Row */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-400">
              <div className="flex items-center gap-1.5 bg-[#171b22] border border-[#22262d] px-2.5 py-1 rounded">
                <Cpu className="h-3.5 w-3.5 text-zinc-400" />
                <span>{activeHeroProfile?.engineName || engines[0]?.name || 'Port'}</span>
              </div>

              <div className="flex items-center gap-1.5 bg-[#171b22] border border-[#22262d] px-2.5 py-1 rounded">
                <Disc className="h-3.5 w-3.5 text-zinc-400" />
                <span>{activeHeroProfile?.iwadName || iwads[0]?.name || 'IWAD'}</span>
              </div>

              <div className="flex items-center gap-1.5 bg-[#171b22] border border-[#22262d] px-2.5 py-1 rounded">
                <Layers className="h-3.5 w-3.5 text-zinc-400" />
                <span>
                  {activeHeroProfile?.mods && activeHeroProfile.mods.length > 0
                    ? `${activeHeroProfile.mods.filter((m) => m.enabled).length} active mod(s)`
                    : 'Vanilla (No Mods)'}
                </span>
              </div>
            </div>
          </div>

          {/* Big Authoritative Crimson Launch Button & Secondary Action */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleLaunchHero}
              disabled={isLaunchingHero}
              className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-[#dc2626] hover:bg-[#ef4444] px-7 py-3 text-sm font-bold text-white transition-colors disabled:opacity-50 shadow-md"
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
                className="inline-flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 py-1 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Configure Setup</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* FIRST-RUN ONBOARDING HERO */
        <div className="rounded-xl border border-[#22262d] bg-[#12151a] p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#1c2028] text-amber-400 border border-[#2a303d]">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Welcome to RNT Launcher. Let's find your Doom games.
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs text-zinc-400 leading-relaxed">
              Scan your system to automatically discover installed source ports (GZDoom, PRBoom+, DSDA-Doom, Woof) and game IWADs (DOOM, DOOM II, Final Doom).
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleScan}
              disabled={isScanning}
              className="inline-flex items-center gap-2 rounded-lg bg-[#dc2626] hover:bg-[#ef4444] px-5 py-2 text-xs font-bold text-white transition-colors"
            >
              <FolderSearch className="h-4 w-4" />
              <span>{isScanning ? 'Scanning...' : 'Auto-Detect Installed Games & Ports'}</span>
            </button>
            {onNavigateToLibrary && (
              <button
                type="button"
                onClick={onNavigateToLibrary}
                className="inline-flex items-center gap-2 rounded-lg border border-[#22262d] bg-[#171b22] hover:bg-[#1f242e] px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
              >
                <FolderOpen className="h-4 w-4" />
                <span>Open Library</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* YOUR SETUPS GALLERY */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-zinc-100 tracking-tight">Your Setups</h2>
            <span className="text-xs font-mono text-zinc-500">({profiles.length})</span>
          </div>

          <div className="flex items-center gap-3">
            {onCreateProfile && (
              <button
                type="button"
                onClick={onCreateProfile}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-[#dc2626]" />
                <span>New Setup</span>
              </button>
            )}
            {profiles.length > 0 && onNavigateToProfiles && (
              <button
                type="button"
                onClick={onNavigateToProfiles}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
              >
                <span>View all</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {displayProfiles.length === 0 ? (
          <div className="rounded-lg border border-[#22262d] bg-[#14171c] p-6 text-center">
            <p className="text-xs text-zinc-400">No preset setups configured yet.</p>
            {onCreateProfile && (
              <button
                type="button"
                onClick={onCreateProfile}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#dc2626] hover:bg-[#ef4444] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create First Setup</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {displayProfiles.map((prof, idx) => (
              <ProfileLeaderboardRow
                key={prof.id}
                profile={prof}
                rank={idx + 1}
                onLaunch={handleLaunch}
                onToggleFavorite={handleToggleFavorite}
                onSelectProfile={onSelectProfile}
              />
            ))}
          </div>
        )}
      </div>

      {/* TWO-COLUMN ACTIVITY & SYSTEM OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1">
        {/* Left Column (7 cols): Recent Gameplay Sessions */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-100 tracking-tight">Recent Sessions</h2>
            <button
              type="button"
              onClick={loadDashboardData}
              title="Refresh recent sessions"
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#22262d] bg-[#14171c]">
            {history.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">
                No recent gameplay sessions logged yet. Launch a preset to start tracking time.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#22262d] bg-[#101317] text-[11px] font-semibold text-zinc-400">
                      <th className="px-3.5 py-2.5">Preset</th>
                      <th className="px-3.5 py-2.5">Port / IWAD</th>
                      <th className="px-3.5 py-2.5">Duration</th>
                      <th className="px-3.5 py-2.5">When</th>
                      <th className="px-3.5 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2229]">
                    {history.slice(0, 5).map((record) => {
                      const isSuccess = record.status === 'success' || record.exitCode === 0;
                      return (
                        <tr key={record.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-3.5 py-2.5 font-medium text-zinc-200">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'h-1.5 w-1.5 rounded-full shrink-0',
                                  isSuccess ? 'bg-emerald-400' : 'bg-red-400'
                                )}
                              />
                              <span className="truncate max-w-[140px]">
                                {record.profileName || 'Default Setup'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-zinc-400 truncate max-w-[120px]">
                            {record.engineName} • {record.iwadName}
                          </td>
                          <td className="px-3.5 py-2.5 text-zinc-400 font-mono text-[11px]">
                            {formatDuration(record.durationMs)}
                          </td>
                          <td className="px-3.5 py-2.5 text-zinc-500 text-[11px]" title={formatDate(record.startedAt)}>
                            {formatRelativeTime(record.startedAt)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleLaunch(record.profileId)}
                              className="inline-flex items-center gap-1 rounded bg-[#1c2026] hover:bg-[#dc2626] text-zinc-300 hover:text-white border border-[#2c323d] hover:border-[#dc2626] px-2 py-1 text-[11px] font-medium transition-colors"
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

        {/* Right Column (5 cols): System Assets & Telemetry Overview */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-100 tracking-tight">System Status</h2>
            <button
              type="button"
              onClick={handleScan}
              disabled={isScanning}
              className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <FolderSearch className="w-3 h-3" />
              <span>{isScanning ? 'Scanning...' : 'Scan Folders'}</span>
            </button>
          </div>

          <div className="rounded-lg border border-[#22262d] bg-[#14171c] p-4 space-y-3.5">
            {/* Port summary row */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-300">
                <Cpu className="w-4 h-4 text-zinc-400" />
                <span>Source Ports</span>
              </div>
              <span className="font-semibold text-zinc-100">
                {engines.length} detected
              </span>
            </div>

            {/* IWAD summary row */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-300">
                <Disc className="w-4 h-4 text-zinc-400" />
                <span>Base Game IWADs</span>
              </div>
              <span className="font-semibold text-zinc-100">
                {iwads.length} detected
              </span>
            </div>

            {/* Mod Library summary row */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-300">
                <Layers className="w-4 h-4 text-zinc-400" />
                <span>Mod Catalog</span>
              </div>
              <span className="font-semibold text-zinc-100">
                {mods.length} files ({mods.filter((m) => m.isFavorite).length} starred)
              </span>
            </div>

            {/* Playtime telemetry */}
            <div className="pt-2.5 border-t border-[#22262d] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-300">
                <Clock className="w-4 h-4 text-zinc-400" />
                <span>Total Playtime</span>
              </div>
              <span className="font-mono font-semibold text-emerald-400">
                {formatDuration(historyStats?.totalPlayTimeMs || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
