import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sidebar,
  NavViewId,
  Header,
  ScanBanner,
  ToastProvider,
  useToast,
  Modal,
  Input,
  Badge,
} from './components';
import { DashboardView } from './features/dashboard';
import { LibraryView } from './features/library';
import { ProfilesView } from './features/profiles';
import { EnginesView } from './features/engines';
import { IWADsView } from './features/iwads';
import { HistoryView } from './features/history';
import { DiagnosticsView } from './features/diagnostics';
import { SettingsView } from './features/settings';
import { api } from './services/api';
import { Mod, Profile, Engine, IWAD, ScanResult, LaunchRecord, ScanProgress, UiDensity, Settings } from './types';
import {
  Search,
  Crosshair,
  Library as LibraryIcon,
  Cpu,
  Disc,
  Play,
  Flame,
} from 'lucide-react';
function AppContent() {
  const toast = useToast();
  const notify = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    if (type === 'success') toast.success(message);
    else if (type === 'error') toast.error(message);
    else if (type === 'warning') toast.warning(message);
    else toast.info(message);
  };
  const [activeView, setActiveView] = useState<NavViewId>('dashboard');
  const [density, setDensity] = useState<UiDensity>('compact');
  const [appSettings, setAppSettings] = useState<Settings | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [counts, setCounts] = useState<{
    mods: number;
    profiles: number;
    engines: number;
    iwads: number;
    history: number;
  }>({
    mods: 0,
    profiles: 0,
    engines: 0,
    iwads: 0,
    history: 0,
  });

  // Global Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    current: number;
    total: number;
    currentFile: string;
  }>({ current: 0, total: 0, currentFile: '' });
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);

  // Global Search Modal State (Ctrl+K)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [allMods, setAllMods] = useState<Mod[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [allEngines, setAllEngines] = useState<Engine[]>([]);
  const [allIwads, setAllIwads] = useState<IWAD[]>([]);

  // Selected Profile for direct navigation from Dashboard or Global Search
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Load settings on initial startup for density and default view
  useEffect(() => {
    let isMounted = true;
    api
      .getSettings()
      .then((s) => {
        if (!isMounted || !s) return;
        setAppSettings(s);
        if (s.uiDensity) {
          setDensity(s.uiDensity);
        }
        if (s.defaultView) {
          setActiveView(s.defaultView as NavViewId);
        }
      })
      .catch(() => {
        // Fallback for standalone/dev
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleDensity = useCallback(async () => {
    const nextDensity: UiDensity = density === 'compact' ? 'comfortable' : 'compact';
    setDensity(nextDensity);
    if (appSettings) {
      const updated = { ...appSettings, uiDensity: nextDensity };
      setAppSettings(updated);
      try {
        await api.updateSettings(updated);
      } catch {
        // ignore
      }
    }
    notify(`Switched to ${nextDensity} density`, 'info');
  }, [density, appSettings]);

  // Fetch counts and library data
  const refreshData = useCallback(async () => {
    try {
      const [mods, profiles, engines, iwads, historyList] = await Promise.all([
        api.listMods({}),
        api.listProfiles(),
        api.listEngines(),
        api.listIWADs(),
        api.listLaunchHistory(10),
      ]);

      setAllMods(mods || []);
      setAllProfiles(profiles || []);
      setAllEngines(engines || []);
      setAllIwads(iwads || []);

      setCounts({
        mods: mods?.length || 0,
        profiles: profiles?.length || 0,
        engines: engines?.length || 0,
        iwads: iwads?.length || 0,
        history: historyList?.length || 0,
      });
    } catch {
      // Standalone dev mode fallback
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Wails Event Listeners for scanning & launches
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      api.onScanStart(() => {
        setIsScanning(true);
        setLastScanResult(null);
        setScanProgress({ current: 0, total: 0, currentFile: '' });
      })
    );

    unsubs.push(
      api.onScanProgress((data: ScanProgress) => {
        setIsScanning(true);
        setScanProgress({
          current: data.current || 0,
          total: data.total || 0,
          currentFile: data.currentFile || '',
        });
      })
    );

    unsubs.push(
      api.onScanComplete((data: ScanResult) => {
        setIsScanning(false);
        setLastScanResult(data);
        refreshData();
        toast.success(
          'Scan Complete',
          `Discovered ${data.discovered_mods || 0} mods, ${data.discovered_iwads || 0} IWADs, and ${data.discovered_engines || 0} engines.`
        );
      })
    );

    unsubs.push(
      api.onLaunchStart((data: LaunchRecord) => {
        toast.info(
          'Launching Doom',
          `Starting ${data?.profile_name || 'profile'} with ${data?.engine_name || 'engine'}...`
        );
      })
    );

    unsubs.push(
      api.onLaunchExit((data: LaunchRecord) => {
        refreshData();
        if (data?.exit_code === 0) {
          toast.success(
            'Doom Session Finished',
            `Session ended successfully (Duration: ${Math.round((data.duration_ms || 0) / 1000)}s)`
          );
        } else {
          toast.warning(
            'Doom Process Exited',
            `Exit code: ${data?.exit_code}`
          );
        }
      })
    );

    return () => {
      unsubs.forEach((unsub) => unsub && unsub());
    };
  }, [refreshData, toast]);

  // Trigger quick scan
  const handleStartScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      toast.info('Starting Scan', 'Scanning configured directories...');
      const result = await api.startScan();
      setLastScanResult(result);
      refreshData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error('Scan Failed', errMsg || 'Error scanning directories');
    } finally {
      setIsScanning(false);
    }
  };

  // Keyboard Shortcuts (Ctrl+K -> Search, Ctrl+Enter -> Quick Launch)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const targetProfile =
          allProfiles.find((p) => p.id === selectedProfileId) ||
          allProfiles.find((p) => p.is_favorite) ||
          allProfiles[0];
        if (targetProfile) {
          toast.info('Launching Profile', `Launching ${targetProfile.name}...`);
          api
            .launchProfile(targetProfile.id)
            .then(() => refreshData())
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              toast.error('Launch Failed', msg || 'Validation error');
            });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allProfiles, selectedProfileId, refreshData, toast]);

  // Filtered global search results
  const filteredSearch = useMemo(() => {
    if (!globalSearchQuery.trim()) {
      return { mods: [], profiles: [], engines: [], iwads: [] };
    }
    const q = globalSearchQuery.toLowerCase();
    return {
      profiles: allProfiles.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.engine_name?.toLowerCase().includes(q) ||
          p.iwad_name?.toLowerCase().includes(q)
      ),
      mods: allMods.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.path.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      ),
      engines: allEngines.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.family.toLowerCase().includes(q) ||
          e.executable.toLowerCase().includes(q)
      ),
      iwads: allIwads.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.type.toLowerCase().includes(q) ||
          i.path.toLowerCase().includes(q)
      ),
    };
  }, [globalSearchQuery, allMods, allProfiles, allEngines, allIwads]);

  const viewTitles: Record<NavViewId, string> = {
    dashboard: 'Dashboard',
    profiles: 'Profiles',
    library: 'Mod Library',
    engines: 'Source Ports',
    iwads: 'Base IWADs',
    history: 'Launch History',
    diagnostics: 'Diagnostics & Health',
    settings: 'Settings',
    play: 'Profiles',
    mods: 'Mod Library',
  };
  return (
    <div
      data-density={density}
      className="flex h-screen w-screen bg-[#0c0e12] text-zinc-100 font-sans antialiased overflow-hidden select-none"
    >
      {/* Navigation Sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={(view) => {
          setActiveView(view);
          refreshData();
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        density={density}
        onToggleDensity={handleToggleDensity}
        counts={counts}
        systemStatus={{
          ready: counts.engines > 0 && counts.iwads > 0,
          engineName: allEngines[0]?.name,
          iwadName: allIwads[0]?.name,
        }}
      />
      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0c0e12]">
        {/* Top Header */}
        <Header
          title={viewTitles[activeView] || 'RNT Launcher'}
          onQuickScan={handleStartScan}
          isScanning={isScanning}
          showSearch={true}
          searchPlaceholder="Global Search (Ctrl+K)..."
          onSearchClick={() => setIsSearchModalOpen(true)}
          onSearchChange={(q) => {
            setGlobalSearchQuery(q);
            if (q.trim()) setIsSearchModalOpen(true);
          }}
          activeProfileName={
            (allProfiles.find((p) => p.id === selectedProfileId) ||
              allProfiles.find((p) => p.isFavorite) ||
              allProfiles[0])?.name
          }
          onQuickLaunch={() => {
            const target =
              allProfiles.find((p) => p.id === selectedProfileId) ||
              allProfiles.find((p) => p.isFavorite) ||
              allProfiles[0];
            if (target) {
              toast.info('Launching Profile', `Starting ${target.name}...`);
              api
                .launchProfile(target.id)
                .then(() => refreshData())
                .catch((err: unknown) => {
                  const msg = err instanceof Error ? err.message : String(err);
                  toast.error('Launch Failed', msg);
                });
            } else {
              setActiveView('profiles');
            }
          }}
        />

        {/* Live Scan Progress Banner */}
        <ScanBanner
          isScanning={isScanning}
          current={scanProgress.current}
          total={scanProgress.total}
          currentFile={scanProgress.currentFile}
          lastResult={
            lastScanResult
              ? {
                  discoveredMods: lastScanResult.discovered_mods,
                  discoveredIWADs: lastScanResult.discovered_iwads,
                  discoveredEngines: lastScanResult.discovered_engines,
                  errors: lastScanResult.errors,
                }
              : null
          }
          onDismiss={() => setLastScanResult(null)}
        />

        {/* Dynamic View Content */}
        <main className="flex-1 min-h-0 overflow-hidden relative bg-[#0c0e12] flex flex-col">
          {activeView === 'dashboard' && (
            <DashboardView
              onNavigateToLibrary={() => setActiveView('library')}
              onNavigateToProfiles={() => setActiveView('profiles')}
              onSelectProfile={(profileId) => {
                setSelectedProfileId(profileId);
                setActiveView('profiles');
              }}
              onCreateProfile={() => {
                setSelectedProfileId(null);
                setActiveView('profiles');
              }}
            />
          )}

          {(activeView === 'profiles' || activeView === 'play') && (
            <ProfilesView
              selectedProfileId={selectedProfileId}
              onSelectProfile={setSelectedProfileId}
              onNavigateToLibrary={() => setActiveView('library')}
              onNavigateToSettings={(tab) => {
                if (tab === 'engines' || tab === 'iwads' || tab === 'history' || tab === 'diagnostics') {
                  setActiveView(tab as NavViewId);
                } else {
                  setActiveView('settings');
                }
              }}
              onScanRequested={handleStartScan}
            />
          )}

          {(activeView === 'library' || activeView === 'mods') && (
            <LibraryView onNavigateToDashboard={() => setActiveView('dashboard')} />
          )}

          {activeView === 'engines' && <EnginesView />}
          {activeView === 'iwads' && <IWADsView />}
          {activeView === 'history' && <HistoryView />}
          {activeView === 'diagnostics' && (
            <DiagnosticsView onNotify={(msg, type) => notify(msg, type)} />
          )}
          {activeView === 'settings' && <SettingsView />}
        </main>
      </div>
      {isSearchModalOpen && (
        <Modal
          isOpen={isSearchModalOpen}
          onClose={() => {
            setIsSearchModalOpen(false);
            setGlobalSearchQuery('');
          }}
          title="Global Search"
          size="lg"
        >
          <div className="space-y-4">
            <Input
              autoFocus
              leftIcon={<Search className="w-4 h-4 text-zinc-400" />}
              placeholder="Search profiles, mods, engines, IWADs..."
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              className="w-full text-sm py-2.5 bg-[#101317] border border-[#22262d] text-zinc-100 placeholder:text-zinc-500"
            />

            <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
              {/* Profiles section */}
              {filteredSearch.profiles.length > 0 && (
                <div>
                  <h4 className="text-xs font-mono uppercase text-zinc-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-[#ef4444]" />
                    Profiles ({filteredSearch.profiles.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredSearch.profiles.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedProfileId(p.id);
                          setActiveView('profiles');
                          setIsSearchModalOpen(false);
                        }}
                        className="flex items-center justify-between p-2.5 rounded bg-[#14171a] hover:bg-[#1c2026] hover:border-[#22262d] border border-white/[0.04] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Flame className="w-4 h-4 text-[#ef4444]" />
                          <span className="font-medium text-sm text-zinc-100">
                            {p.name}
                          </span>
                          <span className="text-xs text-zinc-400 font-mono">
                            {p.engine_name || 'No engine'} • {p.iwad_name || 'No IWAD'}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            api.launchProfile(p.id);
                            setIsSearchModalOpen(false);
                          }}
                          className="px-2.5 py-1 text-xs bg-[#dc2626] hover:bg-[#ef4444] text-white font-medium rounded flex items-center gap-1 transition-colors"
                        >
                          <Play className="w-3 h-3 fill-current" /> Play
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mods section */}
              {filteredSearch.mods.length > 0 && (
                <div>
                  <h4 className="text-xs font-mono uppercase text-zinc-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <LibraryIcon className="w-3.5 h-3.5 text-blue-400" />
                    Mods ({filteredSearch.mods.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredSearch.mods.slice(0, 10).map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setActiveView('library');
                          setIsSearchModalOpen(false);
                        }}
                        className="flex items-center justify-between p-2 rounded bg-[#14171a] hover:bg-[#1c2026] hover:border-[#22262d] border border-white/[0.04] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" size="sm">
                            {m.format.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-zinc-100 font-medium">
                            {m.name}
                          </span>
                          <span className="text-xs text-zinc-400">
                            {m.category}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-zinc-400 truncate max-w-xs">
                          {m.path}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Engines section */}
              {filteredSearch.engines.length > 0 && (
                <div>
                  <h4 className="text-xs font-mono uppercase text-zinc-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    Engines ({filteredSearch.engines.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredSearch.engines.map((e) => (
                      <div
                        key={e.id}
                        onClick={() => {
                          setActiveView('engines');
                          setIsSearchModalOpen(false);
                        }}
                        className="flex items-center justify-between p-2 rounded bg-[#14171a] hover:bg-[#1c2026] hover:border-[#22262d] border border-white/[0.04] cursor-pointer transition-colors"
                      >
                        <span className="text-sm font-medium text-zinc-100">
                          {e.name}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          {e.version || 'Unknown'} ({e.family})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* IWADs section */}
              {filteredSearch.iwads.length > 0 && (
                <div>
                  <h4 className="text-xs font-mono uppercase text-zinc-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <Disc className="w-3.5 h-3.5 text-emerald-400" />
                    IWADs ({filteredSearch.iwads.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredSearch.iwads.map((i) => (
                      <div
                        key={i.id}
                        onClick={() => {
                          setActiveView('iwads');
                          setIsSearchModalOpen(false);
                        }}
                        className="flex items-center justify-between p-2 rounded bg-[#14171a] hover:bg-[#1c2026] hover:border-[#22262d] border border-white/[0.04] cursor-pointer transition-colors"
                      >
                        <span className="text-sm font-medium text-zinc-100">
                          {i.name}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          {i.type.toUpperCase()} ({i.lump_count} lumps)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty search */}
              {globalSearchQuery.trim() &&
                filteredSearch.profiles.length === 0 &&
                filteredSearch.mods.length === 0 &&
                filteredSearch.engines.length === 0 &&
                filteredSearch.iwads.length === 0 && (
                  <div className="text-center py-8 text-zinc-400">
                    No results found for &ldquo;{globalSearchQuery}&rdquo;
                  </div>
                )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
