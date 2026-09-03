import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Plus,
  FolderSearch,
  Star,
  Layers,
  CheckCircle2,
  XCircle,
  Filter,
  Globe,
  UploadCloud,
  ArrowUpDown,
  X,
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
  { label: 'Favorites', value: 'favorites' },
  { label: 'Gameplay', value: 'gameplay' },
  { label: 'Maps', value: 'maps' },
  { label: 'Weapons', value: 'weapons' },
  { label: 'Monsters', value: 'monsters' },
  { label: 'Textures', value: 'textures' },
  { label: 'Audio', value: 'audio' },
  { label: 'UI', value: 'ui' },
];

const FORMAT_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Formats', value: 'all' },
  { label: 'PK3 Archives', value: 'pk3' },
  { label: 'WAD Files', value: 'wad' },
  { label: 'PK7 / 7z', value: 'pk7' },
  { label: 'DEH / BEX', value: 'deh' },
  { label: 'ZIP Archives', value: 'zip' },
  { label: 'IPK3 Game Archives', value: 'ipk3' },
];

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: 'Name (A to Z)', value: 'name-asc' },
  { label: 'Name (Z to A)', value: 'name-desc' },
  { label: 'Size (Largest)', value: 'size-desc' },
  { label: 'Size (Smallest)', value: 'size-asc' },
  { label: 'Lumps (Most)', value: 'lumps-desc' },
  { label: 'Recently Added', value: 'date-desc' },
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
  const [sortOption, setSortOption] = useState<SortField>('name-asc');
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
    }, 3500);
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

  // Window Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWindowDragging(true);
  };
  const handleAddModToProfile = async (profileId: string) => {
    if (!modForProfileAdd) return;
    try {
      await api.addModToProfile(profileId, modForProfileAdd.id);
      const targetProfile = profiles.find((p) => p.id === profileId);
      showNotification(
        'success',
        `Added "${modForProfileAdd.name}" to setup "${targetProfile?.name || 'Selected'}"`
      );
      setModForProfileAdd(null);
      loadLibraryData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not add mod to profile';
      showNotification('error', message);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsWindowDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWindowDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (!files || files.length === 0) return;

    const validExtensions = ['.wad', '.pk3', '.pk7', '.ipk3', '.zip', '.deh', '.bex', '.7z'];
    const modFiles = files.filter((f) => {
      const name = f.name.toLowerCase();
      return validExtensions.some((ext) => name.endsWith(ext));
    });

    if (modFiles.length === 0) {
      showNotification('error', 'No compatible Doom mod files (.wad, .pk3, .pk7, .zip, .deh) found in dropped files.');
      return;
    }

    showNotification('info', `Importing ${modFiles.length} mod file(s)...`);

    try {
      let importedCount = 0;
      for (const file of modFiles) {
        const filePath =
          file && typeof file === 'object' && 'path' in file && typeof file.path === 'string'
            ? file.path
            : undefined;
        if (filePath) {
          try {
            await api.importModFile(filePath);
            importedCount++;
          } catch (err) {
            console.warn(`Failed to import dropped file ${file.name}:`, err);
          }
        }
      }

      if (importedCount > 0) {
        showNotification('success', `Imported ${importedCount} file(s) into your library.`);
        loadLibraryData();
      } else {
        showNotification('info', 'Files processed. Use "Scan Folders" for full directory discovery.');
      }
    } catch (err) {
      console.error('Failed to process dropped files:', err);
      showNotification('error', 'Failed to import dropped files.');
    }
  };

  // Toggle favorite status
  const handleToggleFavorite = async (modId: string) => {
    try {
      await api.toggleModFavorite(modId);
      setMods((prevMods) =>
        prevMods.map((m) => (m.id === modId ? { ...m, isFavorite: !m.isFavorite } : m))
      );
      if (inspectingMod && inspectingMod.id === modId) {
        setInspectingMod((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      showNotification('error', 'Could not update favorite status.');
    }
  };

  // Delete mod
  const handleDeleteMod = async (modId: string) => {
    try {
      await api.deleteMod(modId);
      setMods((prev) => prev.filter((m) => m.id !== modId));
      if (inspectingMod && inspectingMod.id === modId) {
        setInspectingMod(null);
      }
      showNotification('success', 'Mod removed from library.');
    } catch (err) {
      console.error('Failed to delete mod:', err);
      showNotification('error', 'Could not delete mod from library.');
    }
  };

  // Open directory in native explorer
  const handleOpenFolder = async (path: string) => {
    try {
      await api.openPathInExplorer(path);
    } catch (err) {
      console.error('Failed to open folder:', err);
      showNotification('error', 'Could not open folder in Explorer.');
    }
  };

  // Quick background scan trigger
  const handleQuickScan = async () => {
    try {
      showNotification('info', 'Scanning configured directories...');
      await api.startScan();
      setTimeout(() => {
        loadLibraryData();
      }, 3000);
    } catch (err) {
      console.error('Scan trigger error:', err);
      showNotification('error', 'Scan failed to start.');
    }
  };

  // Filtered & Sorted Mods computation
  const filteredAndSortedMods = useMemo(() => {
    let result = [...mods];

    // Search input filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.format.toLowerCase().includes(q) ||
          (m.category && m.category.toLowerCase().includes(q)) ||
          (m.path && m.path.toLowerCase().includes(q)) ||
          (m.structures && m.structures.some((s) => s.toLowerCase().includes(q)))
      );
    }

    // Category filter
    if (selectedCategory === 'favorites') {
      result = result.filter((m) => m.isFavorite);
    } else if (selectedCategory !== 'all') {
      result = result.filter((m) => (m.category || '').toLowerCase() === selectedCategory.toLowerCase());
    }

    // Format filter
    if (selectedFormat !== 'all') {
      result = result.filter((m) => m.format.toLowerCase() === selectedFormat.toLowerCase());
    }

    // Sorting
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
      className="relative flex flex-1 flex-col overflow-hidden bg-[#0c0e12] text-zinc-100 select-none h-full w-full"
    >
      {/* Visual Drag & Drop Overlay */}
      {isWindowDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0c0e12]/90 p-6">
          <div className="flex flex-col items-center justify-center max-w-md w-full rounded-xl border-2 border-dashed border-[#dc2626] bg-[#14171c] p-8 text-center shadow-2xl">
            <UploadCloud className="h-12 w-12 text-[#dc2626] mb-3 animate-bounce" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Drop Mod Files to Import
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Release .wad, .pk3, .pk7, or .deh files anywhere to index them into your persistent library.
            </p>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed bottom-6 right-8 z-50 flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-xs font-medium shadow-lg transition-all duration-150 ${
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

      {/* TIER 1 TOOLBAR: Search & Primary Action Controls (44px) */}
      <div className="border-b border-[#22262d] bg-[#14171c] px-6 py-2.5 flex items-center justify-between gap-4 shrink-0">
        {/* Left: Search input */}
        <div className="relative flex items-center flex-1 max-w-md">
          <Search className="absolute left-3 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, file format, lump structure..."
            className="w-full rounded-md border border-[#22262d] bg-[#0c0e12] pl-9 pr-8 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-hidden transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Right: View Switcher, Scan, /idgames, + Add Mod */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Table vs Grid View Toggle */}
          <div className="flex items-center rounded border border-[#22262d] bg-[#0c0e12] p-0.5">
            <button
              type="button"
              title="Table View (Dense)"
              onClick={() => setViewMode('table')}
              className={`rounded px-2 py-1 flex items-center gap-1.5 text-xs transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#1b1f26] text-zinc-100 font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <ListIcon className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              title="Grid Cards View"
              onClick={() => setViewMode('grid')}
              className={`rounded px-2 py-1 flex items-center gap-1.5 text-xs transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#1b1f26] text-zinc-100 font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Grid</span>
            </button>
          </div>

          <div className="h-4 w-px bg-[#22262d]" />

          {/* Scan Folders */}
          <button
            type="button"
            onClick={handleQuickScan}
            className="inline-flex items-center gap-1.5 rounded border border-[#22262d] bg-[#181c21] hover:bg-[#1f242e] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <FolderSearch className="h-3.5 w-3.5 text-zinc-400" />
            <span>Scan Folders</span>
          </button>

          {/* /idgames Search */}
          <button
            type="button"
            onClick={() => setIsIdgamesModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded border border-[#22262d] bg-[#181c21] hover:bg-[#1f242e] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <Globe className="h-3.5 w-3.5 text-zinc-400" />
            <span>/idgames</span>
          </button>

          {/* + Add Mod */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#5e7ce2] hover:bg-[#4d6bd4] px-3.5 py-1.5 text-xs font-[600] text-[#09090b] transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Mod</span>
          </button>
        </div>
      </div>

      {/* TIER 2 TOOLBAR: Category Pills, Format, Sort, Live Count (38px) */}
      <div className="border-b border-[#22262d] bg-[#101317] px-6 py-2 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        {/* Left: Category pills */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {CATEGORY_TABS.map((tab) => {
            const isActive = selectedCategory === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setSelectedCategory(tab.value)}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors select-none ${
                  isActive
                    ? 'bg-[#1c2026] text-zinc-100 border border-[#2c323d]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
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

        {/* Right: Format filter, Sort selector, Count badge */}
        <div className="flex items-center gap-2.5 shrink-0 text-xs">
          {/* Format selector */}
          <div className="flex items-center gap-1.5 bg-[#14171c] border border-[#22262d] px-2.5 py-1 rounded">
            <Filter className="h-3 w-3 text-zinc-500" />
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              aria-label="Filter by file format"
              className="bg-transparent text-zinc-300 focus:outline-none cursor-pointer"
            >
              {FORMAT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value} className="bg-[#14171c] text-zinc-200">
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-1.5 bg-[#14171c] border border-[#22262d] px-2.5 py-1 rounded">
            <ArrowUpDown className="h-3 w-3 text-zinc-500" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortField)}
              aria-label="Sort mods"
              className="bg-transparent text-zinc-300 focus:outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value} className="bg-[#14171c] text-zinc-200">
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Match count badge */}
          <span className="font-mono text-[11px] text-zinc-400 bg-[#14171c] border border-[#22262d] px-2.5 py-1 rounded">
            {filteredAndSortedMods.length} of {mods.length} mods
          </span>
        </div>
      </div>

      {/* MAIN CONTENT VIEWPORT */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredAndSortedMods.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-[#22262d] bg-[#14171c]/40 p-8 text-center">
            <Layers className="h-10 w-10 text-zinc-600 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-200">No Mods Found</h3>
            <p className="mt-1 text-xs text-zinc-400 max-w-sm leading-relaxed">
              {searchQuery || selectedCategory !== 'all' || selectedFormat !== 'all'
                ? 'Try adjusting your search query or clearing the selected category and format filters.'
                : 'Drag and drop WAD, PK3, or DEH files into this window, or click "Scan Folders" to discover mods.'}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          /* Default: Clean Desktop Table View */
          <div className="overflow-hidden rounded-lg border border-[#22262d] bg-[#14171c]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#22262d] bg-[#101317] text-[11px] font-semibold text-zinc-400 select-none">
                    <th className="w-9 px-3 py-2.5 text-center">Star</th>
                    <th className="w-16 px-3 py-2.5">Format</th>
                    <th className="px-3 py-2.5">Mod Name</th>
                    <th className="hidden sm:table-cell px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5">Size</th>
                    <th className="hidden md:table-cell px-3 py-2.5">Preset Usage</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2229]">
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
        )}
      </div>

      {/* Slide-over Mod Inspector Drawer */}
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
        onModAdded={() => {
          setIsAddModalOpen(false);
          loadLibraryData();
        }}
      />

      {/* /idgames Archive Search Modal */}
      <IdgamesSearchModal
        isOpen={isIdgamesModalOpen}
        onClose={() => setIsIdgamesModalOpen(false)}
        onModImported={() => {
          setIsIdgamesModalOpen(false);
          loadLibraryData();
        }}
      />

      {/* Add to Preset Selection Modal */}
      {modForProfileAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#22262d] bg-[#14171c] p-5 text-zinc-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#22262d] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Add Mod to Preset Setup
                </h3>
                <p className="mt-0.5 truncate text-xs text-emerald-400 font-mono" title={modForProfileAdd.name}>
                  {modForProfileAdd.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModForProfileAdd(null)}
                className="rounded p-1 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {profiles.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  No preset setups exist yet. Create a setup first in Profiles.
                </div>
              ) : (
                profiles.map((prof) => {
                  const alreadyInProfile = prof.mods?.some((m) => m.modId === modForProfileAdd.id);
                  return (
                    <button
                      key={prof.id}
                      type="button"
                      onClick={() => handleAddModToProfile(prof.id)}
                      className="w-full flex items-center justify-between rounded-md border border-[#22262d] bg-[#181c22] p-3 text-left transition-colors hover:border-[#2f3540] hover:bg-[#1e232b]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-zinc-200 truncate">
                          {prof.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-500 font-mono truncate">
                          {prof.engineName || 'No Port'} • {prof.iwadName || 'No IWAD'}
                        </div>
                      </div>
                      {alreadyInProfile ? (
                        <span className="rounded bg-emerald-950/40 px-2 py-0.5 text-[10px] text-emerald-400 border border-emerald-800/40 shrink-0 ml-2">
                          In Setup
                        </span>
                      ) : (
                        <span className="rounded-[6px] bg-[#2d2d34] hover:bg-[#5e7ce2] hover:text-[#09090b] px-2 py-0.5 text-[10px] text-zinc-300 font-[500] shrink-0 ml-2 transition-colors">
                          + Add
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
