import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion, Variants } from 'motion/react';
import {
  Sidebar,
  NavViewId,
  Header,
  ScanBanner,
  ToastProvider,
  useToast,
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
import { SearchPalette } from './features/search/SearchPalette';
import { useCrashRecoveryToast } from './hooks/useCrashRecoveryToast';
import type { ScanResult, ScanProgress, LaunchRecord, Engine, IWAD, UiDensity, Settings, Mod, Profile, OrganizeReport } from './types';
function AppContent() {
  const toast = useToast();
  useCrashRecoveryToast();
  const notify = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    if (type === 'success') toast.success(message);
    else if (type === 'error') toast.error(message);
    else if (type === 'warning') toast.warning(message);
    else toast.info(message);
  };
  const shouldReduceMotion = useReducedMotion();
  const pageVariants: Variants = useMemo(
    () => ({
      initial: shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 },
      animate: {
        opacity: 1,
        y: 0,
        transition: shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
      },
      exit: shouldReduceMotion
        ? { opacity: 0, transition: { duration: 0 } }
        : { opacity: 0, y: -4, transition: { duration: 0.12, ease: [0.32, 0, 0.67, 0] as const } },
    }),
    [shouldReduceMotion]
  );
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

    unsubs.push(
      api.onOrganizeComplete((data: OrganizeReport) => {
        refreshData();
        if (!data.dryRun) {
          toast.success(
            'Library Organized',
            `Moved ${data.movedCount} files, imported ${data.importedMods} mods.`
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
      // Never hijack keystrokes typed into editable fields.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
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

  // Global search palette lives in features/search/SearchPalette; Enter on a
  // profile entry launches it, other entries navigate to their views.
  const handlePaletteLaunchProfile = useCallback(
    (profileId: string) => {
      const target = allProfiles.find((p) => p.id === profileId);
      toast.info('Launching Profile', `Launching ${target?.name || 'profile'}...`);
      setIsSearchModalOpen(false);
      api
        .launchProfile(profileId)
        .then(() => refreshData())
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error('Launch Failed', msg || 'Validation error');
        });
    },
    [allProfiles, refreshData, toast]
  );
  const handlePaletteNavigate = useCallback(
    (view: NavViewId) => {
      setActiveView(view);
      refreshData();
    },
    [refreshData]
  );

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
      className="flex h-screen w-screen bg-[#09090b] text-[#f4f4f5] antialiased overflow-hidden select-none"
      style={{ fontFamily: 'var(--font-sans)' }}
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
      {/* Main Content Viewport - 8px rhythm container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#09090b]">
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
        {/* Dynamic View Content - compact density uses 8px rhythm */}
        <main className="flex-1 min-h-0 overflow-hidden relative bg-[#09090b] flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {activeView === 'dashboard' && (
              <motion.div
                key="dashboard"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex-1 min-h-0 h-full flex flex-col overflow-hidden"
              >
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
              </motion.div>
            )}

            {(activeView === 'profiles' || activeView === 'play') && (
              <motion.div
                key="profiles"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex-1 min-h-0 h-full flex flex-col overflow-hidden"
              >
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
              </motion.div>
            )}

            {(activeView === 'library' || activeView === 'mods') && (
              <motion.div
                key="library"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex-1 min-h-0 h-full flex flex-col overflow-hidden"
              >
                <LibraryView onNavigateToDashboard={() => setActiveView('dashboard')} />
              </motion.div>
            )}

            {activeView === 'engines' && (
              <motion.div
                key="engines"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex-1 min-h-0 h-full flex flex-col overflow-hidden"
              >
                <EnginesView />
              </motion.div>
            )}

            {activeView === 'iwads' && (
              <motion.div
                key="iwads"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex-1 min-h-0 h-full flex flex-col overflow-hidden"
              >
                <IWADsView />
              </motion.div>
            )}

            {activeView === 'history' && (
              <motion.div
                key="history"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex-1 min-h-0 h-full flex flex-col overflow-hidden"
              >
                <HistoryView />
              </motion.div>
            )}

            {activeView === 'diagnostics' && (
              <motion.div
                key="diagnostics"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex-1 min-h-0 h-full flex flex-col overflow-hidden"
              >
                <DiagnosticsView onNotify={(msg, type) => notify(msg, type)} />
              </motion.div>
            )}

            {activeView === 'settings' && (
              <motion.div
                key="settings"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex-1 min-h-0 h-full flex flex-col overflow-hidden"
              >
                <SettingsView />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      <SearchPalette
        open={isSearchModalOpen}
        query={globalSearchQuery}
        onQueryChange={setGlobalSearchQuery}
        onClose={() => {
          setIsSearchModalOpen(false);
          setGlobalSearchQuery('');
        }}
        mods={allMods}
        profiles={allProfiles}
        engines={allEngines}
        iwads={allIwads}
        onSelectProfile={(id) => setSelectedProfileId(id)}
        onLaunchProfile={handlePaletteLaunchProfile}
        onNavigate={handlePaletteNavigate}
      />
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
