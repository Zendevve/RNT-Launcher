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
  FileCode,
  Globe,
} from 'lucide-react';
import { Mod, Profile } from '../../types';
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
  { label: 'PK3', value: 'pk3' },
  { label: 'WAD / PWAD', value: 'wad' },
  { label: 'PK7 / IPK3', value: 'pk7' },
  { label: 'ZIP', value: 'zip' },
  { label: 'DEH / BEX', value: 'deh' },
];

export const LibraryView: React.FC<LibraryViewProps> = () => {
  const [mods, setMods] = useState<Mod[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [activeFilterChip, setActiveFilterChip] = useState<FilterChip>('all');
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [sortOption, setSortOption] = useState<SortField>('name-asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  // Modals & Drawers
  const [inspectingMod, setInspectingMod] = useState<Mod | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isIdgamesModalOpen, setIsIdgamesModalOpen] = useState(false);
  const [modForProfileAdd, setModForProfileAdd] = useState<Mod | null>(null);

  // Global Drag & Drop State
  const [isWindowDragging, setIsWindowDragging] = useState(false);

  // Notification Toast
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

  const loadData = useCallback(async () => {
    try {
      const [fetchedMods, fetchedProfiles, fetchedUsage] = await Promise.all([
        api.listMods(),
        api.listProfiles(),
        api.getModUsageCounts ? api.getModUsageCounts().catch(() => ({})) : Promise.resolve({}),
      ]);
      setMods(fetchedMods || []);
      setProfiles(fetchedProfiles || []);
      setUsageCounts(fetchedUsage || {});
    } catch (err) {
      console.error('Failed to load library:', err);
      showNotification('error', 'Failed to load mods from library');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Actions
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
      console.error('Failed to toggle mod favorite:', err);
    }
  };

  const handleDeleteMod = async (modId: string) => {
    try {
      await api.deleteMod(modId);
      setMods((prev) => prev.filter((m) => m.id !== modId));
      if (inspectingMod && inspectingMod.id === modId) {
        setInspectingMod(null);
      }
      const updatedUsage = api.getModUsageCounts ? await api.getModUsageCounts().catch(() => ({})) : {};
      setUsageCounts(updatedUsage || {});
      showNotification('success', 'Mod removed from library');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      showNotification('error', `Failed to delete mod: ${msg}`);
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await api.openPathInExplorer(path);
    } catch (err) {
      console.error('Failed to open folder in explorer:', err);
    }
  };

  const handleAddModToProfile = async (profileId: string) => {
    if (!modForProfileAdd) return;
    try {
      await api.addModToProfile(profileId, modForProfileAdd.id);
      const targetProfile = profiles.find((p) => p.id === profileId);
      showNotification(
        'success',
        `Added "${modForProfileAdd.name}" to profile "${targetProfile?.name || 'Selected'}"`
      );
      setModForProfileAdd(null);
      const [updatedProfiles, updatedUsage] = await Promise.all([
        api.listProfiles(),
        api.getModUsageCounts ? api.getModUsageCounts().catch(() => ({})) : Promise.resolve({}),
      ]);
      setProfiles(updatedProfiles);
      setUsageCounts(updatedUsage || {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error adding mod';
      showNotification('error', `Could not add mod to profile: ${msg}`);
    }
  };

  const handleModImported = async (newMod: Mod) => {
    setMods((prev) => [newMod, ...prev.filter((m) => m.id !== newMod.id)]);
    const updatedUsage = api.getModUsageCounts ? await api.getModUsageCounts().catch(() => ({})) : {};
    setUsageCounts(updatedUsage || {});
    showNotification('success', `Imported "${newMod.name}" into mod library`);
  };
  const handleQuickScan = async () => {
    try {
      showNotification('info', 'Scanning registered mod directories...');
      const res = await api.startScan();
      showNotification(
        'success',
        `Scan complete: ${res.discoveredMods} mods discovered`
      );
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      showNotification('error', `Scan error: ${msg}`);
    }
  };

  // Drag & Drop handlers over the library view
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsWindowDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      let importCount = 0;
      for (const file of files) {
        let filePath = file.name;
        if ('path' in file && typeof file.path === 'string') {
          filePath = file.path;
        }
        if (filePath) {
          try {
            const imported = await api.importModFile(filePath);
            setMods((prev) => [imported, ...prev.filter((m) => m.id !== imported.id)]);
            importCount++;
          } catch (err) {
            console.error('Failed to import dropped file:', filePath, err);
          }
        }
      }
      if (importCount > 0) {
        showNotification('success', `Successfully imported ${importCount} mod file(s)`);
      }
    }
  };

  // Filter & Sort Logic
  const filteredAndSortedMods = useMemo(() => {
    let result = [...mods];

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.path.toLowerCase().includes(q) ||
          m.category?.toLowerCase().includes(q) ||
          m.format?.toLowerCase().includes(q) ||
          (m.structures && m.structures.some((s) => s.toLowerCase().includes(q)))
      );
    }

    // 2. Category Tab
    if (selectedCategory === 'favorites') {
      result = result.filter((m) => m.isFavorite);
    } else if (selectedCategory !== 'all') {
      result = result.filter(
        (m) => m.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // 3. Format Dropdown
    if (selectedFormat !== 'all') {
      if (selectedFormat === 'wad') {
        result = result.filter((m) => m.format === 'wad' || m.format === 'pwad');
      } else if (selectedFormat === 'pk7') {
        result = result.filter((m) => m.format === 'pk7' || m.format === 'ipk3');
      } else if (selectedFormat === 'deh') {
        result = result.filter((m) => m.format === 'deh' || m.format === 'bex');
      } else {
        result = result.filter(
          (m) => m.format.toLowerCase() === selectedFormat.toLowerCase()
        );
      }
    }

    // 4. Quick Filter Chips
    if (activeFilterChip !== 'all') {
      result = result.filter((m) => {
        const count = usageCounts[m.id] || 0;
        switch (activeFilterChip) {
          case 'has-maps':
            return (
              Boolean(m.lumpCount !== undefined && m.lumpCount > 0) ||
              Boolean((m as { maps?: string[] }).maps && (m as { maps?: string[] }).maps!.length > 0) ||
              m.category === 'Maps' ||
              m.category === 'Megawads' ||
              Boolean(
                m.structures &&
                  m.structures.some((s) => {
                    const upper = s.toUpperCase().trim();
                    return /^MAP\d+/i.test(upper) || /^E\d+M\d+/i.test(upper) || upper === 'MAPS';
                  })
              )
            );
          case 'zscript':
            return (
              m.category === 'Gameplay' ||
              Boolean(m.structures && m.structures.some((s) => s.toUpperCase().includes('ZSCRIPT')))
            );
          case 'dehack':
            return (
              m.format?.toLowerCase() === 'deh' ||
              m.format?.toLowerCase() === 'bex' ||
              Boolean(m.structures && m.structures.some((s) => s.toUpperCase().includes('DEHACKED')))
            );
          case 'unused':
            return count === 0;
          case 'in-use':
            return count > 0;
          default:
            return true;
        }
      });
    }

    // 5. Sorting
    result.sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'name-desc':
          return (b.name || '').localeCompare(a.name || '');
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
      className="relative flex flex-1 flex-col overflow-hidden bg-doom-bg text-doom-text"
    >
      {/* Visual Drag & Drop Full-View Overlay */}
      {isWindowDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-doom-bg/90 border-4 border-dashed border-doom-red backdrop-blur-xs">
          <UploadCloud className="h-16 w-16 text-doom-red animate-bounce" />
          <h2 className="mt-4 font-mono text-xl font-black uppercase tracking-widest text-white">
            Drop Doom Mod Files to Import
          </h2>
          <p className="mt-1 font-mono text-xs text-doom-muted">
            Files will be parsed, verified, and added to your persistent library.
          </p>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed bottom-6 right-8 z-50 flex items-center gap-3 rounded-md border px-4 py-3 text-sm shadow-xl transition-all duration-300 ${
            notification.type === 'success'
              ? 'border-doom-green/40 bg-doom-surface text-doom-green-bright shadow-doom-green/10'
              : notification.type === 'error'
              ? 'border-doom-red/40 bg-doom-surface text-doom-red-bright shadow-doom-red/10'
              : 'border-doom-cyan/40 bg-doom-surface text-doom-cyan shadow-doom-cyan/10'
          }`}
        >
          {notification.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {notification.type === 'error' && <XCircle className="h-4 w-4 shrink-0" />}
          <span className="font-mono text-xs">{notification.message}</span>
        </div>
      )}

      {/* Top Header & Action Bar */}
      <div className="border-b border-doom-border/80 bg-doom-surface/50 px-8 py-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-doom-red" />
              <h1 className="font-mono text-xl font-black uppercase tracking-wider text-doom-text">
                MOD LIBRARY
              </h1>
            </div>
            <p className="mt-0.5 font-mono text-xs text-doom-muted">
              Showing {filteredAndSortedMods.length} of {mods.length} mods
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleQuickScan}
              className="inline-flex items-center gap-2 rounded border border-doom-border bg-doom-card px-3.5 py-2 font-mono text-xs text-doom-text transition-colors hover:border-doom-border-bright hover:bg-doom-surface"
            >
              <FolderSearch className="h-3.5 w-3.5 text-doom-cyan" />
              <span>Scan Folders</span>
            </button>

            <button
              type="button"
              onClick={() => setIsIdgamesModalOpen(true)}
              className="inline-flex items-center gap-2 rounded border border-doom-border bg-doom-card px-3.5 py-2 font-mono text-xs text-doom-text transition-colors hover:border-doom-border-bright hover:bg-doom-surface"
            >
              <Globe className="h-3.5 w-3.5 text-doom-amber" />
              <span>/idgames</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 rounded bg-doom-red px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-doom-red/20 transition-colors hover:bg-doom-red-bright"
            >
              <Plus className="h-4 w-4" />
              <span>Add Mod</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Instant Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-doom-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, path, lumps, structure..."
              className="w-full rounded border border-doom-border bg-doom-card/80 pl-9 pr-8 py-2 font-mono text-xs text-doom-text placeholder-doom-muted/60 focus:border-doom-red focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-doom-muted hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Right Controls: Format Filter, Sort Selector, View Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Format Filter */}
            <div className="flex items-center gap-1.5 rounded border border-doom-border bg-doom-card px-2.5 py-1.5 text-xs font-mono">
              <Filter className="h-3.5 w-3.5 text-doom-muted" />
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                aria-label="Filter by file format"
                className="bg-transparent text-doom-text focus:outline-hidden cursor-pointer"
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value} className="bg-doom-surface text-doom-text">
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 rounded border border-doom-border bg-doom-card px-2.5 py-1.5 text-xs font-mono">
              <ArrowUpDown className="h-3.5 w-3.5 text-doom-muted" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortField)}
                aria-label="Sort library mods"
                className="bg-transparent text-doom-text focus:outline-hidden cursor-pointer"
              >
                <option value="name-asc" className="bg-doom-surface text-doom-text">Name (A-Z)</option>
                <option value="name-desc" className="bg-doom-surface text-doom-text">Name (Z-A)</option>
                <option value="size-desc" className="bg-doom-surface text-doom-text">Size (Largest)</option>
                <option value="size-asc" className="bg-doom-surface text-doom-text">Size (Smallest)</option>
                <option value="lumps-desc" className="bg-doom-surface text-doom-text">Lumps (Most)</option>
                <option value="date-desc" className="bg-doom-surface text-doom-text">Recently Added</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded border border-doom-border bg-doom-card p-0.5">
              <button
                type="button"
                title="Grid Cards View"
                onClick={() => setViewMode('grid')}
                className={`rounded p-1.5 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-doom-surface text-white shadow-xs'
                    : 'text-doom-muted hover:text-doom-text'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Table List View"
                onClick={() => setViewMode('table')}
                className={`rounded p-1.5 transition-colors ${
                  viewMode === 'table'
                    ? 'bg-doom-surface text-white shadow-xs'
                    : 'text-doom-muted hover:text-doom-text'
                }`}
              >
                <ListIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORY_TABS.map((tab) => {
            const isActive = selectedCategory === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setSelectedCategory(tab.value)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-3 py-1 font-mono text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-doom-red text-white'
                    : 'bg-doom-card/60 text-doom-muted hover:bg-doom-card hover:text-doom-text'
                }`}
              >
                {tab.value === 'favorites' && (
                  <Star className={`h-3 w-3 ${isActive ? 'fill-white' : 'fill-doom-amber text-doom-amber'}`} />
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Filter Chips / Tag Pills */}
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-doom-muted shrink-0 mr-1">
            Filter:
          </span>
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeFilterChip === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveFilterChip(chip.id)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-doom-cyan/20 text-doom-cyan border border-doom-cyan/50 shadow-xs'
                    : 'bg-doom-card/60 text-doom-muted border border-doom-border/60 hover:bg-doom-card hover:text-doom-text'
                }`}
              >
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {filteredAndSortedMods.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-doom-border bg-doom-surface/30 p-8 text-center">
            <FileCode className="h-10 w-10 text-doom-muted/50 mb-3" />
            <h3 className="font-mono text-sm font-bold uppercase text-doom-text">
              No Mods Found
            </h3>
            <p className="mt-1 max-w-sm font-mono text-xs text-doom-muted">
              {searchQuery || selectedCategory !== 'all' || selectedFormat !== 'all'
                ? 'Try adjusting your search query, category, or format filters.'
                : 'Your library is empty. Import files or scan your Doom directories.'}
            </p>
            <div className="mt-4 flex gap-3">
              {(searchQuery || selectedCategory !== 'all' || selectedFormat !== 'all' || activeFilterChip !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedFormat('all');
                    setActiveFilterChip('all');
                  }}
                  className="rounded border border-doom-border bg-doom-card px-3.5 py-1.5 font-mono text-xs text-doom-text hover:bg-doom-surface"
                >
                  Reset Filters
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded bg-doom-red px-3.5 py-1.5 font-mono text-xs font-bold uppercase text-white hover:bg-doom-red-bright"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Mod</span>
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid Cards View */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAndSortedMods.map((mod) => (
              <ModCard
                key={mod.id}
                mod={mod}
                usageCount={usageCounts[mod.id] || 0}
                onInspect={(m) => setInspectingMod(m)}
                onToggleFavorite={handleToggleFavorite}
                onAddToProfile={(m) => setModForProfileAdd(m)}
                onOpenFolder={handleOpenFolder}
                onDelete={handleDeleteMod}
              />
            ))}
          </div>
        ) : (
          /* Table List View */
          <div className="overflow-hidden rounded-lg border border-doom-border bg-doom-surface/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-doom-border bg-doom-card/80 text-[11px] uppercase tracking-wider text-doom-muted">
                    <th className="w-10 px-3 py-2.5 text-center">Fav</th>
                    <th className="px-4 py-2.5">Name &amp; File</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5">Format</th>
                    <th className="px-4 py-2.5">Usage</th>
                    <th className="px-4 py-2.5">Size</th>
                    <th className="px-4 py-2.5">Structure &amp; Lumps</th>
                    <th className="px-4 py-2.5">Added</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedMods.map((mod) => (
                    <ModTableRow
                      key={mod.id}
                      mod={mod}
                      usageCount={usageCounts[mod.id] || 0}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg border border-doom-border bg-doom-surface p-5 text-doom-text shadow-2xl">
            <div className="flex items-center justify-between border-b border-doom-border/70 pb-3">
              <div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white">
                  Add Mod to Profile
                </h3>
                <p className="mt-0.5 truncate font-mono text-xs text-doom-cyan" title={modForProfileAdd.name}>
                  {modForProfileAdd.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModForProfileAdd(null)}
                className="rounded p-1 text-doom-muted hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
              {profiles.length === 0 ? (
                <div className="p-4 text-center font-mono text-xs text-doom-muted">
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
                      className="w-full flex items-center justify-between rounded-lg border border-doom-border bg-doom-card/70 p-3 text-left transition-colors hover:border-doom-border-bright hover:bg-doom-card"
                    >
                      <div>
                        <div className="font-mono text-xs font-semibold text-doom-text">
                          {prof.name}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-doom-muted">
                          {prof.engineName} • {prof.iwadName}
                        </div>
                      </div>
                      {alreadyInProfile ? (
                        <span className="rounded bg-doom-cyan/20 px-2 py-0.5 font-mono text-[10px] text-doom-cyan border border-doom-cyan/30">
                          In Profile
                        </span>
                      ) : (
                        <span className="rounded bg-doom-green/20 px-2 py-0.5 font-mono text-[10px] font-bold text-doom-green-bright border border-doom-green/30">
                          + Add
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-doom-border/70 flex justify-end">
              <button
                type="button"
                onClick={() => setModForProfileAdd(null)}
                className="rounded px-4 py-1.5 font-mono text-xs text-doom-muted hover:text-white"
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
