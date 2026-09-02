import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Plus,
  FolderSearch,
  Star,
  Layers,
  ArrowUpDown,
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

type FilterChip = 'all' | 'has-maps' | 'zscript' | 'dehack' | 'unused' | 'in-use';

const FILTER_CHIPS: { id: FilterChip; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'has-maps', label: 'Has Maps' },
  { id: 'zscript', label: 'ZScript Gameplay' },
  { id: 'dehack', label: 'DeHackEd Patch' },
  { id: 'unused', label: 'Unused in Profiles' },
  { id: 'in-use', label: 'In Use' },
];

const CATEGORY_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Favorites', value: 'favorites' },
  { label: 'Gameplay', value: 'Gameplay' },
  { label: 'Maps', value: 'Maps' },
  { label: 'Megawads', value: 'Megawads' },
  { label: 'Weapons', value: 'Weapons' },
  { label: 'Monsters', value: 'Monsters' },
  { label: 'Textures', value: 'Textures' },
  { label: 'Audio', value: 'Audio' },
  { label: 'UI', value: 'UI' },
  { label: 'Utility', value: 'Utility' },
  { label: 'Other', value: 'Other' },
];

const FORMAT_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Formats', value: 'all' },
  { label: 'PK3 Archives', value: 'pk3' },
  { label: 'WAD Files', value: 'wad' },
  { label: 'IPK3 Archives', value: 'ipk3' },
  { label: 'ZIP Archives', value: 'zip' },
  { label: 'PK7 / 7z Archives', value: 'pk7' },
  { label: 'DEH / BEX Patches', value: 'deh' },
];

export const LibraryView: React.FC<LibraryViewProps> = () => {
  const [mods, setMods] = useState<Mod[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<Settings | null>(null);

  // Filter, search & view states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [activeFilterChip, setActiveFilterChip] = useState<FilterChip>('all');
  const [sortOption, setSortOption] = useState<SortField>('name-asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

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

  // Add mod to profile from overlay
  const handleAddModToProfile = async (profileId: string) => {
    if (!modForProfileAdd) return;
    try {
      await api.addModToProfile(profileId, modForProfileAdd.id);
      showNotification(
        'success',
        `Added "${modForProfileAdd.name}" to profile!`
      );
      setModForProfileAdd(null);
      loadLibraryData();
    } catch (err) {
      console.error('Failed to add mod to profile:', err);
      showNotification('error', 'Could not add mod to profile.');
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
        } else {
          if (
            (mod.category || 'other').toLowerCase() !==
            selectedCategory.toLowerCase()
          ) {
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

      // 4. Quick Filter Tag Chips
      if (activeFilterChip !== 'all') {
        switch (activeFilterChip) {
          case 'has-maps':
            if (!mod.structures?.includes('MAPINFO')) return false;
            break;
          case 'zscript':
            if (!mod.structures?.includes('ZSCRIPT')) return false;
            break;
          case 'dehack':
            if (
              !mod.structures?.includes('DEHACKED') &&
              mod.format.toLowerCase() !== 'deh' &&
              mod.format.toLowerCase() !== 'bex'
            )
              return false;
            break;
          case 'unused':
            if ((usageCounts[mod.id] || 0) > 0) return false;
            break;
          case 'in-use':
            if ((usageCounts[mod.id] || 0) === 0) return false;
            break;
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
  }, [mods, searchQuery, selectedCategory, selectedFormat, activeFilterChip, usageCounts, sortOption]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative flex flex-1 flex-col overflow-hidden bg-[#0c0e10] text-zinc-100 select-none h-full"
    >
      {/* Visual Drag & Drop Full-View Overlay */}
      {isWindowDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0c0e10]/95 border-2 border-dashed border-red-500">
          <UploadCloud className="h-16 w-16 text-red-500 animate-bounce" />
          <h2 className="mt-4 font-bold text-xl uppercase tracking-wider text-white">
            Drop Doom Mod Files to Import
          </h2>
          <p className="mt-1 text-xs text-zinc-400 font-mono">
            Files will be parsed, verified, and added to your persistent library.
          </p>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed bottom-6 right-8 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all duration-150 ${
            notification.type === 'success'
              ? 'border-emerald-800/40 bg-[#122419] text-emerald-200'
              : notification.type === 'error'
              ? 'border-red-800/40 bg-[#2b1416] text-red-200'
              : 'border-blue-800/40 bg-[#132232] text-blue-200'
          }`}
        >
          {notification.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
          {notification.type === 'error' && <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
          <span className="font-mono text-xs">{notification.message}</span>
        </div>
      )}

      {/* Single Unified Desktop Toolbar */}
      <div className="border-b border-white/[0.07] bg-[#14171a] px-8 py-3.5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input with count pill */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name, file, lump structure..."
              className="w-full rounded-md border border-white/[0.08] bg-black/40 pl-8 pr-16 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-doom-red focus:outline-hidden font-mono"
            />
            <span className="absolute right-2.5 top-2 text-[10px] font-mono text-zinc-500">
              {filteredAndSortedMods.length}/{mods.length}
            </span>
          </div>

          {/* Action and Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Format Filter */}
            <div className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-black/40 px-2.5 py-1 text-xs font-mono">
              <Filter className="h-3 w-3 text-zinc-400" />
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                aria-label="Filter by file format"
                className="bg-transparent text-zinc-200 focus:outline-hidden cursor-pointer"
              >
                {availableFormatOptions.map((f) => (
                  <option key={f.value} value={f.value} className="bg-[#141619] text-zinc-100">
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-black/40 px-2.5 py-1 text-xs font-mono">
              <ArrowUpDown className="h-3 w-3 text-zinc-400" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortField)}
                aria-label="Sort library mods"
                className="bg-transparent text-zinc-200 focus:outline-hidden cursor-pointer"
              >
                <option value="name-asc" className="bg-[#141619] text-zinc-100">Name (A-Z)</option>
                <option value="name-desc" className="bg-[#141619] text-zinc-100">Name (Z-A)</option>
                <option value="size-desc" className="bg-[#141619] text-zinc-100">Size (Largest)</option>
                <option value="size-asc" className="bg-[#141619] text-zinc-100">Size (Smallest)</option>
                <option value="lumps-desc" className="bg-[#141619] text-zinc-100">Lumps (Most)</option>
                <option value="date-desc" className="bg-[#141619] text-zinc-100">Recently Added</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-md border border-white/[0.08] bg-black/40 p-0.5">
              <button
                type="button"
                title="Grid Cards View"
                onClick={() => setViewMode('grid')}
                className={`rounded p-1 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white/[0.12] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Table List View"
                onClick={() => setViewMode('table')}
                className={`rounded p-1 transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white/[0.12] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <ListIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="h-4 w-px bg-white/[0.08] mx-1 hidden sm:block" />

            {/* Action Buttons */}
            <button
              type="button"
              onClick={handleQuickScan}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#15181c] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-[#1f2228] hover:text-white transition-colors"
            >
              <FolderSearch className="h-3.5 w-3.5 text-blue-400" />
              <span>Scan</span>
            </button>

            <button
              type="button"
              onClick={() => setIsIdgamesModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#15181c] px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-[#1f2228] hover:text-white transition-colors"
            >
              <Globe className="h-3.5 w-3.5 text-amber-400" />
              <span>/idgames</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#dc2626] hover:bg-[#c02020] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white border border-red-500/30 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Mod</span>
            </button>
          </div>
        </div>

        {/* Category Pills & Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {CATEGORY_TABS.map((tab) => {
              const isActive = selectedCategory === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSelectedCategory(tab.value)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'bg-[#2b1416] text-[#fca5a5] border border-red-800/40 font-semibold'
                      : 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {tab.value === 'favorites' && (
                    <Star className={`h-3 w-3 ${isActive ? 'fill-red-400 text-red-400' : 'fill-amber-400 text-amber-400'}`} />
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {FILTER_CHIPS.map((chip) => {
              const isActive = activeFilterChip === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setActiveFilterChip(chip.id)}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] font-medium transition-colors ${
                    isActive
                      ? 'bg-[#132232] text-[#93c5fd] border border-blue-800/40'
                      : 'bg-black/20 text-zinc-500 border border-white/[0.04] hover:text-zinc-300'
                  }`}
                >
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {filteredAndSortedMods.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] p-8 text-center">
            <Layers className="h-12 w-12 text-zinc-600 mb-3" />
            <h3 className="text-base font-semibold text-white">No Mods Found</h3>
            <p className="mt-1 text-xs text-zinc-400 max-w-sm">
              {searchQuery || selectedCategory !== 'all' || activeFilterChip !== 'all'
                ? 'Try adjusting your search terms or clearing active filters.'
                : 'Drag and drop WAD, PK3, or DEH files here, or use Scan Folders to populate your library.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
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
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#15181c]">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-white/[0.02] text-[10.5px] uppercase tracking-wider text-zinc-400">
                    <th className="w-8 px-3 py-2.5 text-center">Fav</th>
                    <th className="px-4 py-2.5">{'Name & File'}</th>
                    <th className="hidden sm:table-cell px-4 py-2.5">Category</th>
                    <th className="hidden md:table-cell px-4 py-2.5">Structures</th>
                    <th className="px-4 py-2.5">Size</th>
                    <th className="hidden lg:table-cell px-4 py-2.5">Usage</th>
                    <th className="hidden xl:table-cell px-4 py-2.5">Added</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
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

      {/* Add to Profile Selection Modal */}
      {modForProfileAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#15181c] p-5 text-zinc-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Add Mod to Profile
                </h3>
                <p className="mt-0.5 truncate font-mono text-xs text-blue-400" title={modForProfileAdd.name}>
                  {modForProfileAdd.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModForProfileAdd(null)}
                className="rounded p-1 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
              {profiles.length === 0 ? (
                <div className="p-4 text-center font-mono text-xs text-zinc-500">
                  No launch profiles exist yet. Create a profile first.
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
                      className="w-full flex items-center justify-between rounded-lg border border-white/[0.08] bg-black/30 p-3 text-left transition-colors hover:border-white/[0.18] hover:bg-black/50"
                    >
                      <div>
                        <div className="font-mono text-xs font-semibold text-white">
                          {prof.name}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-zinc-400">
                          {prof.engineName} • {prof.iwadName}
                        </div>
                      </div>
                      {alreadyInProfile ? (
                        <span className="rounded-full bg-[#132232] px-2.5 py-0.5 font-mono text-[10px] text-[#93c5fd] border border-blue-800/30">
                          In Profile
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#122419] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#86efac] border border-emerald-800/30">
                          + Add
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.07] flex justify-end">
              <button
                type="button"
                onClick={() => setModForProfileAdd(null)}
                className="rounded px-4 py-1.5 font-mono text-xs text-zinc-400 hover:text-white"
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
