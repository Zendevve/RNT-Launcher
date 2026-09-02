import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Plus,
  FolderSearch,
  Star,
  Layers,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Filter,
  X,
  Globe,
} from 'lucide-react';
import { Mod, Profile, Settings } from '../../types';
import { api } from '../../services/api';
import { ModCard } from './ModCard';
import { ModTableRow } from './ModTableRow';
import { ModInspectorDrawer } from './ModInspectorDrawer';
import { AddModModal } from './AddModModal';
import { IdgamesSearchModal } from './IdgamesSearchModal';

interface LibraryViewProps {
  onNavigateToDashboard?: () => void;
}

type SortField = 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc' | 'lumps-desc' | 'date-desc';

const CATEGORY_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Gameplay', value: 'gameplay' },
  { label: 'Maps', value: 'maps' },
  { label: 'Weapons', value: 'weapons' },
  { label: 'Monsters', value: 'monsters' },
  { label: 'Textures', value: 'textures' },
  { label: 'Audio', value: 'audio' },
  { label: 'UI', value: 'ui' },
  { label: 'Favorites', value: 'favorites' },
];

const FORMAT_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Formats', value: 'all' },
  { label: 'PK3 Archives', value: 'pk3' },
  { label: 'WAD Files', value: 'wad' },
  { label: 'PK7 / 7z Archives', value: 'pk7' },
  { label: 'DEH / BEX Patches', value: 'deh' },
  { label: 'ZIP Archives', value: 'zip' },
  { label: 'IPK3 Archives', value: 'ipk3' },
];

export const LibraryView: React.FC<LibraryViewProps> = () => {
  const [mods, setMods] = useState<Mod[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<Settings | null>(null);

  // Filter, search & view states: Default to clean Desktop Table View
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [sortOption] = useState<SortField>('name-asc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Drawer & Modals state
  const [inspectingMod, setInspectingMod] = useState<Mod | null>(null);
  const [modForProfileAdd, setModForProfileAdd] = useState<Mod | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isIdgamesModalOpen, setIsIdgamesModalOpen] = useState(false);

  // Drag-and-drop state
  const [isWindowDragging, setIsWindowDragging] = useState(false);

  // Inline notifications toast
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Initial data loading
  const loadLibraryData = useCallback(async () => {
    try {
      const [fetchedMods, fetchedProfiles, fetchedUsage, fetchedSettings] =
        await Promise.all([
          api.listMods(),
          api.listProfiles(),
          api.getModUsageCounts().catch(() => ({})),
          api.getSettings().catch(() => null),
        ]);

      setMods(fetchedMods || []);
      setProfiles(fetchedProfiles || []);
      setUsageCounts(fetchedUsage || {});
      setSettings(fetchedSettings);
    } catch (err) {
      console.error('Failed to load library data:', err);
      showNotification('error', 'Could not load mod library from backend.');
    }
  }, []);

  useEffect(() => {
    loadLibraryData();
  }, [loadLibraryData]);

  // Favorite toggle handler
  const handleToggleFavorite = async (modId: string) => {
    try {
      const isFav = await api.toggleModFavorite(modId);
      setMods((prev) =>
        prev.map((m) => (m.id === modId ? { ...m, isFavorite: isFav } : m))
      );
      if (inspectingMod && inspectingMod.id === modId) {
        setInspectingMod((prev) => (prev ? { ...prev, isFavorite: isFav } : null));
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // Delete mod handler
  const handleDeleteMod = async (modId: string) => {
    try {
      await api.deleteMod(modId);
      setMods((prev) => prev.filter((m) => m.id !== modId));
      if (inspectingMod && inspectingMod.id === modId) {
        setInspectingMod(null);
      }
      showNotification('info', 'Mod removed from library.');
    } catch (err) {
      console.error('Failed to delete mod:', err);
      showNotification('error', 'Failed to delete mod.');
    }
  };

  // Open directory in native file explorer
  const handleOpenFolder = async (path: string) => {
    try {
      await api.openPathInExplorer(path);
    } catch (err) {
      console.error('Failed to open folder:', err);
      showNotification('error', 'Could not open folder in file explorer.');
    }
  };

  // Quick Directory Scan
  const handleQuickScan = async () => {
    showNotification('info', 'Scanning configured directories for Doom mods...');
    try {
      const res = await api.startScan();
      showNotification(
        'success',
        `Scan complete: discovered ${res.discoveredMods || 0} mods, ${res.discoveredIWADs || 0} IWADs.`
      );
      loadLibraryData();
    } catch (err) {
      console.error('Scan error:', err);
      showNotification('error', 'Directory scan encountered an error.');
    }
  };

  // Add mod to setup/profile from overlay
  const handleAddModToProfile = async (profileId: string) => {
    if (!modForProfileAdd) return;
    try {
      await api.addModToProfile(profileId, modForProfileAdd.id);
      showNotification(
        'success',
        `Added "${modForProfileAdd.name}" to setup!`
      );
      setModForProfileAdd(null);
      loadLibraryData();
    } catch (err) {
      console.error('Failed to add mod to setup:', err);
      showNotification('error', 'Could not add mod to setup.');
    }
  };

  // Drag and Drop File Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWindowDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsWindowDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWindowDragging(false);

    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const files = Array.from(e.dataTransfer.files);
    let importedCount = 0;

    for (const file of files) {
      const filePath = (file as unknown as { path?: string }).path || file.name;
      try {
        await api.importModFile(filePath);
        importedCount++;
      } catch (err) {
        console.error(`Failed to import dropped file ${file.name}:`, err);
      }
    }

    if (importedCount > 0) {
      showNotification(
        'success',
        `Successfully imported ${importedCount} mod${importedCount === 1 ? '' : 's'}!`
      );
      loadLibraryData();
    } else {
      showNotification('error', 'Could not import dropped files as Doom packages.');
    }
  };

  // Filter format options according to settings
  const availableFormatOptions = useMemo(() => {
    if (!settings || !settings.formatVisibility) return FORMAT_OPTIONS;
    const vis = settings.formatVisibility;
    return FORMAT_OPTIONS.filter(
      (opt) => opt.value === 'all' || vis.includes(opt.value)
    );
  }, [settings]);

  // Handle manual file addition from modal
  const handleModImported = (newMod: Mod) => {
    setMods((prev) => [newMod, ...prev]);
    showNotification('success', `Imported "${newMod.name}" to library!`);
  };

  // Filtered & Sorted Mods Calculation
  const filteredAndSortedMods = useMemo(() => {
    const result = mods.filter((mod) => {
      // 1. Text Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = mod.name.toLowerCase().includes(q);
        const matchesPath = mod.path.toLowerCase().includes(q);
        const matchesFormat = mod.format.toLowerCase().includes(q);
        const matchesCategory = (mod.category || '').toLowerCase().includes(q);
        const matchesStructure = (mod.structures || []).some((s) =>
          s.toLowerCase().includes(q)
        );

        if (
          !matchesName &&
          !matchesPath &&
          !matchesFormat &&
          !matchesCategory &&
          !matchesStructure
        ) {
          return false;
        }
      }

      // 2. Category Tabs
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'favorites') {
          if (!mod.isFavorite) return false;
        } else if (selectedCategory === 'maps') {
          const cat = (mod.category || '').toLowerCase();
          if (cat !== 'maps' && cat !== 'megawads') return false;
        } else if (selectedCategory === 'audio') {
          const cat = (mod.category || '').toLowerCase();
          if (cat !== 'audio' && cat !== 'sound') return false;
        } else {
          if ((mod.category || 'other').toLowerCase() !== selectedCategory.toLowerCase()) {
            return false;
          }
        }
      }

      // 3. Format dropdown
      if (selectedFormat !== 'all') {
        if (selectedFormat === 'pk7') {
          if (mod.format.toLowerCase() !== 'pk7' && mod.format.toLowerCase() !== '7z') return false;
        } else if (selectedFormat === 'deh') {
          if (mod.format.toLowerCase() !== 'deh' && mod.format.toLowerCase() !== 'bex') return false;
        } else if (selectedFormat === 'wad') {
          if (mod.format.toLowerCase() !== 'wad' && mod.format.toLowerCase() !== 'pwad') return false;
        } else {
          if (mod.format.toLowerCase() !== selectedFormat.toLowerCase()) return false;
        }
      }

      return true;
    });

    result.sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'size-desc':
          return (b.size || 0) - (a.size || 0);
        case 'size-asc':
          return (a.size || 0) - (b.size || 0);
        case 'lumps-desc':
          return (b.lumpCount || 0) - (a.lumpCount || 0);
        case 'date-desc':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [mods, searchQuery, selectedCategory, selectedFormat, sortOption]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative flex flex-1 flex-col overflow-hidden bg-[#0c0e10] text-zinc-100 select-none h-full"
    >
      {/* Clean Subtle Dropzone Overlay */}
      {isWindowDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0c0e10]/85 backdrop-blur-[2px] p-6">
          <div className="flex flex-col items-center justify-center max-w-md w-full rounded-xl border border-dashed border-zinc-600 bg-[#14171c] p-8 text-center shadow-xl">
            <UploadCloud className="h-10 w-10 text-zinc-400 mb-3" />
            <h2 className="text-sm font-semibold text-zinc-100">
              Drop mod files to import into library
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Supports .wad, .pk3, .pk7, .zip, .deh, and .bex packages
            </p>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed bottom-6 right-8 z-50 flex items-center gap-3 rounded-lg border px-4 py-3 text-xs transition-all duration-150 ${
            notification.type === 'success'
              ? 'border-emerald-500/30 bg-[#122419] text-emerald-200'
              : notification.type === 'error'
              ? 'border-red-500/30 bg-[#2b1416] text-red-200'
              : 'border-blue-500/30 bg-[#132232] text-blue-200'
          }`}
        >
          {notification.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
          {notification.type === 'error' && <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Single-Row Desktop Toolbar */}
      <div className="border-b border-[#22262d] bg-[#14171c] px-6 py-2.5">
        <div className="flex items-center justify-between gap-3 overflow-x-auto">
          {/* Left section: Search input with match counter pill */}
          <div className="relative flex items-center min-w-[260px] max-w-xs shrink-0">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mods..."
              className="w-full rounded border border-[#22262d] bg-[#0c0e10] pl-8 pr-24 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-hidden transition-colors"
            />
            <span className="absolute right-2 px-1.5 py-0.5 rounded bg-[#181c21] border border-[#22262d] font-mono text-[10px] text-zinc-400 select-none">
              {filteredAndSortedMods.length} of {mods.length} mods
            </span>
          </div>

          {/* Center section: Category tabs */}
          <div className="flex items-center gap-1 shrink-0">
            {CATEGORY_TABS.map((tab) => {
              const isActive = selectedCategory === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSelectedCategory(tab.value)}
                  className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#1b1f26] text-zinc-100 border border-[#22262d]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#181c21]'
                  }`}
                >
                  {tab.value === 'favorites' && (
                    <Star
                      className={`h-3 w-3 ${
                        isActive ? 'fill-amber-400 text-amber-400' : 'text-zinc-500'
                      }`}
                    />
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right section: Format dropdown, Table vs Grid toggle, and Quick actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Format dropdown */}
            <div className="flex items-center gap-1.5 rounded border border-[#22262d] bg-[#0c0e10] px-2 py-1 text-xs text-zinc-300">
              <Filter className="h-3 w-3 text-zinc-400" />
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                aria-label="Filter by file format"
                className="bg-transparent text-zinc-200 focus:outline-hidden cursor-pointer"
              >
                {availableFormatOptions.map((f) => (
                  <option key={f.value} value={f.value} className="bg-[#14171c] text-zinc-200">
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Table vs Grid View Toggle */}
            <div className="flex items-center rounded border border-[#22262d] bg-[#0c0e10] p-0.5">
              <button
                type="button"
                title="Table View"
                onClick={() => setViewMode('table')}
                className={`rounded p-1 transition-colors ${
                  viewMode === 'table'
                    ? 'bg-[#1b1f26] text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <ListIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Grid Cards View"
                onClick={() => setViewMode('grid')}
                className={`rounded p-1 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[#1b1f26] text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="h-4 w-px bg-[#22262d]" />

            {/* Quick Action: Scan Folders */}
            <button
              type="button"
              onClick={handleQuickScan}
              className="inline-flex items-center gap-1.5 rounded border border-[#22262d] bg-[#181c21] hover:bg-[#1b1f26] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            >
              <FolderSearch className="h-3.5 w-3.5 text-zinc-400" />
              <span>Scan Folders</span>
            </button>

            {/* Quick Action: /idgames Search */}
            <button
              type="button"
              onClick={() => setIsIdgamesModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded border border-[#22262d] bg-[#181c21] hover:bg-[#1b1f26] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            >
              <Globe className="h-3.5 w-3.5 text-zinc-400" />
              <span>/idgames Search</span>
            </button>

            {/* Quick Action: + Add Mod */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded bg-[#dc2626] hover:bg-[#ef4444] px-3 py-1 text-xs font-medium text-white transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Add Mod</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filteredAndSortedMods.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-[#22262d] bg-[#14171c]/50 p-8 text-center">
            <Layers className="h-10 w-10 text-zinc-500 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-200">No Mods Found</h3>
            <p className="mt-1 text-xs text-zinc-400 max-w-sm">
              {searchQuery || selectedCategory !== 'all' || selectedFormat !== 'all'
                ? 'Try adjusting your search terms or clearing selected filters.'
                : 'Drag and drop WAD, PK3, or DEH files here, or use Scan Folders to populate your mod library.'}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          /* Default: Clean Desktop Table View */
          <div className="overflow-hidden rounded-lg border border-[#22262d] bg-[#14171c]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#22262d] bg-[#181c21] text-[11px] font-medium text-zinc-400 select-none">
                    <th className="w-9 px-3 py-2.5 text-center">Star</th>
                    <th className="w-16 px-3 py-2.5">Format</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="hidden sm:table-cell px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5">Size</th>
                    <th className="hidden md:table-cell px-3 py-2.5">Usage</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedMods.map((mod) => (
                    <ModTableRow
                      key={mod.id}
                      mod={mod}
                      usageCount={usageCounts[mod.id]}
                      showFilePaths={settings?.showFilePaths}
                      density={settings?.uiDensity}
                      onInspect={(m) => setInspectingMod(m)}
                      onToggleFavorite={handleToggleFavorite}
                      onAddToProfile={(m) => setModForProfileAdd(m)}
                      onOpenFolder={handleOpenFolder}
                      onDelete={handleDeleteMod}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid View Toggle */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {filteredAndSortedMods.map((mod) => (
              <ModCard
                key={mod.id}
                mod={mod}
                usageCount={usageCounts[mod.id]}
                showFilePaths={settings?.showFilePaths}
                density={settings?.uiDensity}
                onInspect={(m) => setInspectingMod(m)}
                onToggleFavorite={handleToggleFavorite}
                onAddToProfile={(m) => setModForProfileAdd(m)}
                onOpenFolder={handleOpenFolder}
                onDelete={handleDeleteMod}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mod Inspector Drawer */}
      <ModInspectorDrawer
        mod={inspectingMod}
        isOpen={Boolean(inspectingMod)}
        onClose={() => setInspectingMod(null)}
        onAddToProfile={(m) => {
          setInspectingMod(null);
          setModForProfileAdd(m);
        }}
        onToggleFavorite={handleToggleFavorite}
        onDelete={handleDeleteMod}
        onOpenFolder={handleOpenFolder}
      />

      {/* Add Mod Modal */}
      <AddModModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onModAdded={handleModImported}
      />

      {/* /idgames Archive Search & Import Modal */}
      <IdgamesSearchModal
        isOpen={isIdgamesModalOpen}
        onClose={() => setIsIdgamesModalOpen(false)}
        onModImported={(newMod) => {
          setMods((prev) => [newMod, ...prev.filter((m) => m.id !== newMod.id)]);
          showNotification('success', `Imported "${newMod.name}" from /idgames!`);
        }}
      />

      {/* Add to Setup Selection Modal */}
      {modForProfileAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-lg border border-[#22262d] bg-[#14171c] p-5 text-zinc-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#22262d] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Add Mod to Setup
                </h3>
                <p className="mt-0.5 truncate text-xs text-zinc-400" title={modForProfileAdd.name}>
                  {modForProfileAdd.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModForProfileAdd(null)}
                className="rounded p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
              {profiles.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  No launch setups exist yet. Create a setup first.
                </div>
              ) : (
                profiles.map((prof) => {
                  const alreadyInProfile = prof.mods?.some(
                    (m) => m.modId === modForProfileAdd.id
                  );
                  return (
                    <button
                      key={prof.id}
                      type="button"
                      onClick={() => handleAddModToProfile(prof.id)}
                      className="w-full flex items-center justify-between rounded-lg border border-[#22262d] bg-[#181c21] p-3 text-left transition-colors hover:border-[#2f3540] hover:bg-[#1b1f26]"
                    >
                      <div>
                        <div className="text-xs font-medium text-zinc-100">
                          {prof.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-400">
                          {prof.engineName} • {prof.iwadName}
                        </div>
                      </div>
                      {alreadyInProfile ? (
                        <span className="rounded bg-[#1b1f26] px-2 py-0.5 text-[10px] text-zinc-400 border border-[#22262d]">
                          In Setup
                        </span>
                      ) : (
                        <span className="rounded bg-[#10b981]/15 px-2 py-0.5 text-[10px] font-medium text-[#86efac] border border-[#10b981]/30">
                          + Add
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#22262d] flex justify-end">
              <button
                type="button"
                onClick={() => setModForProfileAdd(null)}
                className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
