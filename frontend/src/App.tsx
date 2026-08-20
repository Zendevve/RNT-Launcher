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
import { SettingsView } from './features/settings';
import { api } from './services/api';
import { Mod, Profile, Engine, IWAD, ScanResult, LaunchRecord, ScanProgress } from './types';
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
  const [activeView, setActiveView] = useState<NavViewId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Global counts for sidebar badges
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

  const viewTitles: Record<NavViewId, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Fast launcher and recent activity',
    },
    library: {
      title: 'Mod Library',
      subtitle: 'Browse, inspect, and organize your Doom collection',
    },
    profiles: {
      title: 'Profiles',
      subtitle: 'Configure load orders, engines, IWADs, and custom parameters',
    },
    engines: {
      title: 'Source Ports',
      subtitle: 'Manage Doom executables and detected engine families',
    },
    iwads: {
      title: 'IWADs',
      subtitle: 'Base game data files and lump information',
    },
    history: {
      title: 'Launch History',
      subtitle: 'Past game sessions, duration, and telemetry',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Content scan directories and application preferences',
    },
  };

  return (
    <div className="flex h-screen w-screen bg-doom-bg text-doom-text font-sans antialiased overflow-hidden select-none">
      {/* Navigation Sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={(view) => {
          setActiveView(view);
          refreshData();
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        counts={counts}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <Header
          title={viewTitles[activeView]?.title || 'RNT Launcher'}
          subtitle={viewTitles[activeView]?.subtitle}
          onQuickScan={handleStartScan}
          isScanning={isScanning}
          showSearch={true}
          searchPlaceholder="Global Search (Ctrl+K)..."
          onSearchChange={(q) => {
            setGlobalSearchQuery(q);
            if (q.trim()) setIsSearchModalOpen(true);
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
        <main className="flex-1 overflow-hidden relative">
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

          {activeView === 'library' && <LibraryView />}

          {activeView === 'profiles' && <ProfilesView />}

          {activeView === 'engines' && <EnginesView />}

          {activeView === 'iwads' && <IWADsView />}

          {activeView === 'history' && <HistoryView />}

          {activeView === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Global Search Modal (Ctrl+K) */}
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
              leftIcon={<Search className="w-4 h-4 text-doom-muted" />}
              placeholder="Search profiles, mods, engines, IWADs..."
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              className="w-full text-lg py-3"
            />

            <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
              {/* Profiles section */}
              {filteredSearch.profiles.length > 0 && (
                <div>
                  <h4 className="text-xs font-mono uppercase text-doom-muted tracking-wider mb-2 flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-doom-red" />
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
                        className="flex items-center justify-between p-2.5 rounded bg-doom-surface/80 hover:bg-doom-card hover:border-doom-border border border-transparent cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Flame className="w-4 h-4 text-doom-red" />
                          <span className="font-medium text-sm text-doom-text">
                            {p.name}
                          </span>
                          <span className="text-xs text-doom-muted">
                            {p.engine_name || 'No engine'} • {p.iwad_name || 'No IWAD'}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            api.launchProfile(p.id);
                            setIsSearchModalOpen(false);
                          }}
                          className="px-2.5 py-1 text-xs bg-doom-red/20 hover:bg-doom-red text-white rounded flex items-center gap-1"
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
                  <h4 className="text-xs font-mono uppercase text-doom-muted tracking-wider mb-2 flex items-center gap-1.5">
                    <LibraryIcon className="w-3.5 h-3.5 text-doom-cyan" />
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
                        className="flex items-center justify-between p-2 rounded bg-doom-surface/80 hover:bg-doom-card hover:border-doom-border border border-transparent cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" size="sm">
                            {m.format.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-doom-text font-medium">
                            {m.name}
                          </span>
                          <span className="text-xs text-doom-muted">
                            {m.category}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-doom-muted truncate max-w-xs">
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
                  <h4 className="text-xs font-mono uppercase text-doom-muted tracking-wider mb-2 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-doom-amber" />
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
                        className="flex items-center justify-between p-2 rounded bg-doom-surface/80 hover:bg-doom-card cursor-pointer"
                      >
                        <span className="text-sm font-medium text-doom-text">
                          {e.name}
                        </span>
                        <span className="text-xs text-doom-muted font-mono">
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
                  <h4 className="text-xs font-mono uppercase text-doom-muted tracking-wider mb-2 flex items-center gap-1.5">
                    <Disc className="w-3.5 h-3.5 text-doom-green" />
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
                        className="flex items-center justify-between p-2 rounded bg-doom-surface/80 hover:bg-doom-card cursor-pointer"
                      >
                        <span className="text-sm font-medium text-doom-text">
                          {i.name}
                        </span>
                        <span className="text-xs text-doom-muted font-mono">
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
                  <div className="text-center py-8 text-doom-muted">
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
