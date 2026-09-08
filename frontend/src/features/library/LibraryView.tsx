import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Plus,
  FolderSearch,
  Star,
  Layers,
  Filter,
  Globe,
  UploadCloud,
  ArrowUpDown,
  Link2,
  RefreshCw,
  Copy,
  X,
} from 'lucide-react';
import { Mod, ModFilter, ModUpdate, Profile, Settings, ValidationItem } from '../../types';
import { api } from '../../services/api';
import { ModCard } from './ModCard';
import { ModTableRow } from './ModTableRow';
import { ModInspectorDrawer } from './ModInspectorDrawer';
import { AddModModal } from './AddModModal';
import { IdgamesSearchModal } from './IdgamesSearchModal';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

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

type SmartCollectionId = 'favorites' | 'unplayed' | 'large' | 'maps';

const SMART_COLLECTION_KEY = 'rnt-library-collection';

const SMART_COLLECTIONS: Array<{ id: SmartCollectionId; label: string; hint: string }> = [
  { id: 'favorites', label: 'Favorites', hint: 'Starred mods' },
  { id: 'unplayed', label: 'Unplayed', hint: 'Zero setup usage' },
  { id: 'large', label: 'Large', hint: 'Over 100 MB' },
  { id: 'maps', label: 'Maps-only', hint: 'Map content' },
];

const MAP_LUMP_RE = /^(MAP\d{2}|E\dM\d+)$/i;

/** True when the mod carries map content: MAP marker/map lump/MAPINFO or a Maps-category. */
const hasMapContent = (m: Mod): boolean => {
  const cat = (m.category || '').toLowerCase();
  if (cat === 'maps' || cat === 'megawads') return true;
  return (m.structures || []).some(
    (s) => s === 'MAPS' || s.toUpperCase() === 'MAPINFO' || MAP_LUMP_RE.test(s)
  );
};

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
  // Facets row state (author/min-rating/has-maps)
  const [authorQuery, setAuthorQuery] = useState('');
  const [minRatingInput, setMinRatingInput] = useState('');
  const [hasMaps, setHasMaps] = useState<'any' | 'yes' | 'no'>('any');
  // Saved smart collections (active id persisted to localStorage)
  const [activeCollection, setActiveCollection] = useState<SmartCollectionId | null>(() => {
    try {
      const saved = localStorage.getItem(SMART_COLLECTION_KEY);
      return saved === 'favorites' || saved === 'unplayed' || saved === 'large' || saved === 'maps'
        ? saved
        : null;
    } catch {
      return null;
    }
  });
  // Duplicates filter state
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<Mod[][]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [mergingGroupKey, setMergingGroupKey] = useState<string | null>(null);

  // Drawer & Modals state
  const [inspectingMod, setInspectingMod] = useState<Mod | null>(null);
  const [modForProfileAdd, setModForProfileAdd] = useState<Mod | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isIdgamesModalOpen, setIsIdgamesModalOpen] = useState(false);
  // URL import & mod updates state
  const [isUrlImportOpen, setIsUrlImportOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [isUpdatesOpen, setIsUpdatesOpen] = useState(false);
  const [updates, setUpdates] = useState<ModUpdate[] | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updatingModIds, setUpdatingModIds] = useState<Record<string, boolean>>({});
  // Conflict items for the inspected mod, fed by App.GetProfileConflicts
  // across profiles containing the mod.
  const [inspectConflicts, setInspectConflicts] = useState<ValidationItem[]>([]);

  useEffect(() => {
    if (!inspectingMod) {
      setInspectConflicts([]);
      return;
    }
    const modId = inspectingMod.id;
    const containing = profiles.filter((p) => p.mods?.some((m) => m.modId === modId));
    if (containing.length === 0) {
      setInspectConflicts([]);
      return;
    }
    let cancelled = false;
    Promise.all(containing.map((p) => api.getProfileConflicts(p.id).catch(() => [] as ValidationItem[])))
      .then((lists) => {
        if (!cancelled) setInspectConflicts(lists.flat());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [inspectingMod, profiles]);

  // Drag-and-drop state
  const [isWindowDragging, setIsWindowDragging] = useState(false);

  // Toast notification
  const toast = useToast();

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    } else {
      toast.info(message);
    }
  };

  // Forward-compatible ListMods extras (author/minRating/hasMaps ride the same filter object
  // backends already accept; unknown keys are ignored until the schema lands). Synced through
  // a ref so loadLibraryData keeps its stable identity.
  const listExtrasRef = useRef<{ author?: string; minRating?: number; hasMaps?: boolean }>({});
  useEffect(() => {
    const min = minRatingInput.trim() === '' ? NaN : Number(minRatingInput);
    listExtrasRef.current = {
      author: authorQuery.trim() || undefined,
      minRating: Number.isNaN(min) ? undefined : min,
      hasMaps: hasMaps === 'any' ? undefined : hasMaps === 'yes',
    };
  });

  // Initial data loading
  const loadLibraryData = useCallback(async () => {
    try {
      const [fetchedMods, fetchedProfiles, fetchedUsage, fetchedSettings] =
        await Promise.all([
          api.listMods({ ...listExtrasRef.current } as ModFilter),
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
  // Quietly fetch available mod updates for the toolbar badge (no toast on empty)
  const refreshUpdatesQuiet = useCallback(async () => {
    try {
      const result = await api.checkModUpdates();
      setUpdates(result || []);
    } catch {
      setUpdates(null);
    }
  }, []);

  useEffect(() => {
    refreshUpdatesQuiet();
  }, [refreshUpdatesQuiet]);

  // Manual re-check with user feedback, used by the Updates modal
  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    try {
      const result = await api.checkModUpdates();
      setUpdates(result || []);
      if ((result || []).length === 0) {
        showNotification('info', 'All mods are up to date.');
      }
    } catch (err) {
      console.error('Failed to check mod updates:', err);
      showNotification('error', 'Could not check for mod updates.');
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  // Update a single mod, then refresh library + updates list
  const handleUpdateMod = async (modId: string) => {
    setUpdatingModIds((prev) => ({ ...prev, [modId]: true }));
    try {
      const updated = await api.updateMod(modId);
      showNotification('success', `Updated "${updated.name}".`);
      loadLibraryData();
      const result = await api.checkModUpdates().catch(() => null);
      if (result) setUpdates(result);
    } catch (err) {
      console.error('Failed to update mod:', err);
      showNotification('error', err instanceof Error ? err.message : 'Could not update mod.');
    } finally {
      setUpdatingModIds((prev) => ({ ...prev, [modId]: false }));
    }
  };

  // Import a mod from a pasted URL (https://, idgames://<id>)
  const handleImportFromURL = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setIsImportingUrl(true);
    try {
      const mod = await api.importModFromURL(url);
      showNotification('success', `Imported "${mod.name}" into your library.`);
      setUrlInput('');
      setIsUrlImportOpen(false);
      loadLibraryData();
      refreshUpdatesQuiet();
    } catch (err) {
      console.error('Failed to import mod from URL:', err);
      showNotification('error', err instanceof Error ? err.message : 'Could not import mod from URL.');
    } finally {
      setIsImportingUrl(false);
    }
  };

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
    if (!files || files.length === 0) {
      // No files: a dropped link (https://… or idgames://<id>) imports from URL.
      const urlText = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      const url = (urlText || '').split('\n').map((s) => s.trim()).find((s) => s.length > 0) || '';
      if (/^(https?:\/\/|idgames:\/\/)/i.test(url)) {
        showNotification('info', 'Importing mod from URL...');
        try {
          const mod = await api.importModFromURL(url);
          showNotification('success', `Imported "${mod.name}" into your library.`);
          loadLibraryData();
          refreshUpdatesQuiet();
        } catch (err) {
          console.error('Failed to import dropped URL:', err);
          showNotification('error', err instanceof Error ? err.message : 'Could not import mod from URL.');
        }
      }
      return;
    }

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

  // Duplicate groups: backend FindDuplicateMods when available, else SHA-256 grouping.
  const refreshDuplicates = useCallback(async () => {
    setDuplicatesLoading(true);
    try {
      const backend = api as unknown as { findDuplicateMods?: () => Promise<Mod[][]> };
      if (typeof backend.findDuplicateMods === 'function') {
        const groups = await backend.findDuplicateMods();
        setDuplicateGroups((groups || []).filter((g) => g.length > 1));
      } else {
        const byKey: Record<string, Mod[]> = Object.create(null);
        for (const m of mods) {
          const key = m.sha256 ? `sha:${m.sha256}` : `size:${m.size}:${(m.name || '').toLowerCase()}`;
          const group = byKey[key];
          if (group) group.push(m);
          else byKey[key] = [m];
        }
        setDuplicateGroups(Object.values(byKey).filter((g) => g.length > 1));
      }
    } catch (err) {
      console.error('Failed to find duplicate mods:', err);
      showNotification('error', 'Could not find duplicate mods.');
    } finally {
      setDuplicatesLoading(false);
    }
  }, [mods]);

  const toggleDuplicatesOnly = () => {
    const next = !showDuplicatesOnly;
    setShowDuplicatesOnly(next);
    if (next) void refreshDuplicates();
  };

  // Merge one duplicate group: keep newest, delete the rest (best-effort profile detach).
  const handleMergeDuplicateGroup = async (group: Mod[]) => {
    const ordered = [...group].sort((a, b) => {
      const ta = a.createdAt || a.updatedAt || a.modifiedAt || '';
      const tb = b.createdAt || b.updatedAt || b.modifiedAt || '';
      if (ta === tb) return 0;
      return ta < tb ? 1 : -1;
    });
    const keep = ordered[0];
    const drop = ordered.slice(1);
    if (!keep || drop.length === 0) return;
    const groupKey = keep.sha256 || keep.id;
    setMergingGroupKey(groupKey);
    try {
      for (const d of drop) {
        for (const p of profiles) {
          if (p.mods?.some((m) => m.modId === d.id)) {
            await api.removeModFromProfile(p.id, d.id).catch(() => {});
          }
        }
        await api.deleteMod(d.id);
      }
      showNotification('success', `Merged ${drop.length} duplicate(s), kept "${keep.name}".`);
      await loadLibraryData();
      await refreshDuplicates();
    } catch (err) {
      console.error('Failed to merge duplicates:', err);
      showNotification('error', err instanceof Error ? err.message : 'Could not merge duplicates.');
    } finally {
      setMergingGroupKey(null);
    }
  };

  // Smart collections: drive the existing category/format/search/sort state, never a side system.
  const applySmartCollection = (id: SmartCollectionId | null) => {
    setActiveCollection(id);
    try {
      if (id) localStorage.setItem(SMART_COLLECTION_KEY, id);
      else localStorage.removeItem(SMART_COLLECTION_KEY);
    } catch {
      /* storage unavailable: selection still applies for this session */
    }
    setShowDuplicatesOnly(false);
    if (id === 'favorites') {
      setSelectedCategory('favorites');
      setSelectedFormat('all');
      setSearchQuery('');
      setHasMaps('any');
    } else if (id === 'unplayed') {
      setSelectedCategory('all');
      setSelectedFormat('all');
      setSearchQuery('');
    } else if (id === 'large') {
      setSelectedCategory('all');
      setSelectedFormat('all');
      setSearchQuery('');
      setSortOption('size-desc');
    } else if (id === 'maps') {
      setSelectedCategory('maps');
      setSelectedFormat('all');
      setSearchQuery('');
      setHasMaps('yes');
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

    // Saved smart collection predicate (same pipeline, not a parallel filter system)
    if (activeCollection === 'favorites') {
      result = result.filter((m) => m.isFavorite);
    } else if (activeCollection === 'unplayed') {
      result = result.filter((m) => (usageCounts[m.id] ?? 0) === 0);
    } else if (activeCollection === 'large') {
      result = result.filter((m) => (m.size || 0) > 100 * 1024 * 1024);
    } else if (activeCollection === 'maps') {
      result = result.filter(hasMapContent);
    }

    // Facets row: author text, min rating, has-maps tri-state.
    // The author/minRating/hasMaps keys also ride the ListMods filter object (cast until
    // ModFilter gains them) so a backend implementation picks them up without a UI change.
    if (authorQuery.trim()) {
      const q = authorQuery.trim().toLowerCase();
      result = result.filter((m) => {
        const extra = m as Mod & { author?: string; description?: string };
        return [extra.author, extra.description, m.name, m.path]
          .filter(Boolean)
          .join('\n')
          .toLowerCase()
          .includes(q);
      });
    }
    const minRating = minRatingInput.trim() === '' ? NaN : Number(minRatingInput);
    if (!Number.isNaN(minRating)) {
      result = result.filter((m) => {
        const rating = (m as Mod & { rating?: number }).rating;
        return typeof rating !== 'number' || rating >= minRating;
      });
    }
    if (hasMaps === 'yes') {
      result = result.filter(hasMapContent);
    } else if (hasMaps === 'no') {
      result = result.filter((m) => !hasMapContent(m));
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
  }, [mods, searchQuery, selectedCategory, selectedFormat, sortOption, activeCollection, usageCounts, authorQuery, minRatingInput, hasMaps]);

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

          {/* Mod Updates */}
          <button
            type="button"
            onClick={() => setIsUpdatesOpen(true)}
            title="Check for mod updates"
            className="inline-flex items-center gap-1.5 rounded border border-[#22262d] bg-[#181c21] hover:bg-[#1f242e] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-zinc-400" />
            <span>Updates</span>
            {(updates?.length ?? 0) > 0 && (
              <span className="rounded-full bg-[#5e7ce2] px-1.5 py-px text-[10px] font-bold text-[#09090b]">
                {updates?.length}
              </span>
            )}
          </button>

          {/* Import from URL */}
          <button
            type="button"
            onClick={() => setIsUrlImportOpen(true)}
            title="Import a mod from a URL"
            className="inline-flex items-center gap-1.5 rounded border border-[#22262d] bg-[#181c21] hover:bg-[#1f242e] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <Link2 className="h-3.5 w-3.5 text-zinc-400" />
            <span>From URL</span>
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
          {/* Duplicates filter toggle */}
          <button
            type="button"
            onClick={toggleDuplicatesOnly}
            title="Show only duplicate mods"
            className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 transition-colors ${
              showDuplicatesOnly
                ? 'border-[#2c323d] bg-[#1c2026] text-zinc-100'
                : 'border-[#22262d] bg-[#14171c] text-zinc-300 hover:text-white'
            }`}
          >
            <Copy className="h-3 w-3 text-zinc-500" />
            <span>Duplicates</span>
            {duplicateGroups.length > 0 && (
              <span className="rounded-full bg-[#5e7ce2] px-1.5 py-px text-[10px] font-bold text-[#09090b]">
                {duplicateGroups.reduce((n, g) => n + g.length, 0)}
              </span>
            )}
          </button>
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

      {/* TIER 2.5 FACETS: author text, min rating, has-maps tri-state */}
      <div className="border-b border-[#22262d] bg-[#101317] px-6 py-2 flex items-center gap-3 shrink-0 flex-wrap text-xs">
        <span className="text-zinc-500 select-none">Refine</span>
        <input
          type="text"
          value={authorQuery}
          onChange={(e) => setAuthorQuery(e.target.value)}
          placeholder="Author…"
          aria-label="Filter by author"
          className="w-40 rounded border border-[#22262d] bg-[#0c0e12] px-2.5 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-hidden transition-colors"
        />
        <label className="flex items-center gap-1.5 text-zinc-500">
          <span className="select-none">Min rating</span>
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={minRatingInput}
            onChange={(e) => setMinRatingInput(e.target.value)}
            placeholder="0–5"
            aria-label="Minimum rating"
            className="w-20 rounded border border-[#22262d] bg-[#0c0e12] px-2.5 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-hidden transition-colors"
          />
        </label>
        <div className="flex items-center rounded border border-[#22262d] bg-[#0c0e12] p-0.5" role="group" aria-label="Has maps">
          {(['any', 'yes', 'no'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setHasMaps(v)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                hasMaps === v ? 'bg-[#1b1f26] text-zinc-100 font-medium' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {v === 'any' ? 'Any maps' : v === 'yes' ? 'Has maps' : 'No maps'}
            </button>
          ))}
        </div>
        {(authorQuery.trim() !== '' || minRatingInput.trim() !== '' || hasMaps !== 'any') && (
          <button
            type="button"
            onClick={() => {
              setAuthorQuery('');
              setMinRatingInput('');
              setHasMaps('any');
            }}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="h-3 w-3" />
            <span>Clear refinements</span>
          </button>
        )}
      </div>

      {/* MAIN CONTENT: smart-collections sidebar + viewport */}
      <div className="flex min-h-0 flex-1">
        <aside className="w-48 shrink-0 overflow-y-auto border-r border-[#22262d] bg-[#101317] p-3">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 select-none">
            Collections
          </p>
          <div className="mt-2 space-y-1">
            {SMART_COLLECTIONS.map((c) => {
              const isActive = activeCollection === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  title={c.hint}
                  onClick={() => applySmartCollection(isActive ? null : c.id)}
                  className={`w-full rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                    isActive
                      ? 'bg-[#1c2026] text-zinc-100 border border-[#2c323d] font-medium'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
                  }`}
                >
                  <span className="block">{c.label}</span>
                  <span className="block text-[10px] text-zinc-500">{c.hint}</span>
                </button>
              );
            })}
          </div>
          {activeCollection && (
            <button
              type="button"
              onClick={() => applySmartCollection(null)}
              className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="h-3 w-3" />
              <span>Clear collection</span>
            </button>
          )}
        </aside>
        <div className="flex-1 overflow-y-auto p-6 min-w-0">
        {showDuplicatesOnly ? (
          duplicatesLoading ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-[#22262d] bg-[#14171c]/40 p-8 text-center">
              <p className="text-xs text-zinc-400">Finding duplicate mods…</p>
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-[#22262d] bg-[#14171c]/40 p-8 text-center">
              <Layers className="h-10 w-10 text-zinc-600 mb-3" />
              <h3 className="text-sm font-semibold text-zinc-200">No Duplicates Found</h3>
              <p className="mt-1 text-xs text-zinc-400 max-w-sm leading-relaxed">
                Every mod in your library has a unique fingerprint.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {duplicateGroups.map((group) => {
                const ordered = [...group].sort((a, b) => {
                  const ta = a.createdAt || a.updatedAt || a.modifiedAt || '';
                  const tb = b.createdAt || b.updatedAt || b.modifiedAt || '';
                  if (ta === tb) return 0;
                  return ta < tb ? 1 : -1;
                });
                const keep = ordered[0];
                const groupKey = group.map((m) => m.id).sort().join('|');
                const merging = mergingGroupKey === (keep.sha256 || keep.id);
                return (
                  <div key={groupKey} className="rounded-lg border border-[#22262d] bg-[#14171c] p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">
                          {group.length} copies of &ldquo;{keep.name}&rdquo;
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500" title={keep.path}>
                          Newest kept: {keep.path}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleMergeDuplicateGroup(group)}
                        disabled={merging}
                        className="inline-flex items-center gap-1.5 rounded border border-[#22262d] bg-[#181c21] hover:bg-[#1f242e] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors disabled:opacity-60"
                      >
                        <Copy className="h-3.5 w-3.5 text-zinc-400" />
                        <span>{merging ? 'Merging…' : 'Merge / Keep newest'}</span>
                      </button>
                    </div>
                    <ul className="mt-3 space-y-1">
                      {ordered.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-3 rounded border border-[#22262d] bg-[#0c0e12] px-3 py-1.5 text-xs"
                        >
                          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-400" title={m.path}>
                            {m.path}
                          </span>
                          {m.id === keep.id ? (
                            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 border border-emerald-500/20 shrink-0">
                              Kept
                            </span>
                          ) : (
                            <span className="rounded bg-[#2d2d34] px-2 py-0.5 text-[10px] text-zinc-400 shrink-0">
                              Removed on merge
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )
        ) : filteredAndSortedMods.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-[#22262d] bg-[#14171c]/40 p-8 text-center">
            <Layers className="h-10 w-10 text-zinc-600 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-200">No Mods Found</h3>
            <p className="mt-1 text-xs text-zinc-400 max-w-sm leading-relaxed">
              {searchQuery || selectedCategory !== 'all' || selectedFormat !== 'all'
                ? 'Try adjusting your search query or clearing the selected category and format filters.'
                : 'Drag and drop WAD, PK3, or DEH files into this window, or click "Scan Folders" to discover mods.'}
            </p>
            <button
              type="button"
              onClick={() => setIsIdgamesModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded border border-[#22262d] bg-[#181c21] hover:bg-[#1f242e] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            >
              <Globe className="h-3.5 w-3.5 text-zinc-400" />
              <span>Browse /idgames showcase</span>
            </button>
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
        conflicts={inspectConflicts}
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
      {/* Import Mod from URL Modal */}
      <Modal
        isOpen={isUrlImportOpen}
        onClose={() => setIsUrlImportOpen(false)}
        size="sm"
        title="Import Mod from URL"
        description="Paste a direct download link (https://…) or an idgames reference (idgames://<id>)."
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleImportFromURL();
            }}
            placeholder="https://… or idgames://…"
            autoFocus
            className="w-full rounded-md border border-[#22262d] bg-[#0c0e12] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-hidden transition-colors"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsUrlImportOpen(false)}
              className="rounded border border-[#22262d] bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleImportFromURL()}
              disabled={isImportingUrl || !urlInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#5e7ce2] hover:bg-[#4d6bd4] px-3.5 py-1.5 text-xs font-[600] text-[#09090b] transition-colors disabled:opacity-60"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>{isImportingUrl ? 'Importing…' : 'Import'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Mod Updates Modal */}
      <Modal
        isOpen={isUpdatesOpen}
        onClose={() => setIsUpdatesOpen(false)}
        size="sm"
        title="Mod Updates"
        description="Newer catalog versions found for mods in your library."
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => void handleCheckUpdates()}
              disabled={isCheckingUpdates}
              className="inline-flex items-center gap-1.5 rounded border border-[#22262d] bg-[#181c21] hover:bg-[#1f242e] px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:text-white transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`h-3 w-3 text-zinc-400 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdates ? 'Checking…' : 'Check again'}</span>
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1.5 -mx-2 px-2">
            {updates === null ? (
              <div className="p-4 text-center text-xs text-[#71717a]">
                Could not check for updates. Use &ldquo;Check again&rdquo; to retry.
              </div>
            ) : updates.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#71717a]">
                All mods are up to date.
              </div>
            ) : (
              updates.map((u) => (
                <div
                  key={u.modId}
                  className="w-full flex items-center justify-between gap-3 rounded-[8px] border border-transparent bg-[#0c0c0f]/60 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-[#f4f4f5] truncate">
                      {u.modName}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#71717a] truncate">
                      {u.reason}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleUpdateMod(u.modId)}
                    disabled={updatingModIds[u.modId] === true}
                    className="rounded-[6px] bg-[#2d2d34] hover:bg-[#5e7ce2] hover:text-[#09090b] px-2.5 py-1 text-[11px] text-[#f4f4f5] font-medium shrink-0 transition-colors disabled:opacity-60"
                  >
                    {updatingModIds[u.modId] === true ? 'Updating…' : 'Update'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>


      {/* Add to Preset Selection Modal */}
      <Modal
        isOpen={!!modForProfileAdd}
        onClose={() => setModForProfileAdd(null)}
        size="sm"
        title="Add Mod to Preset Setup"
        description={modForProfileAdd ? `Adding "${modForProfileAdd.name}" to a preset setup` : undefined}
      >
        <div className="max-h-64 overflow-y-auto space-y-1.5 -mx-2 px-2">
          {profiles.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#71717a]">
              No preset setups exist yet. Create a setup first in Profiles.
            </div>
          ) : (
            profiles.map((prof) => {
              const alreadyInProfile = modForProfileAdd
                ? prof.mods?.some((m) => m.modId === modForProfileAdd.id)
                : false;
              return (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => handleAddModToProfile(prof.id)}
                  className="w-full flex items-center justify-between rounded-[8px] border border-transparent hover:border-[#3a3a45] bg-[#0c0c0f]/60 hover:bg-[#0c0c0f] p-3 text-left transition-colors cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-[#f4f4f5] truncate">
                      {prof.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#71717a] truncate">
                      {prof.engineName || 'No Port'} • {prof.iwadName || 'No IWAD'}
                    </div>
                  </div>
                  {alreadyInProfile ? (
                    <span className="rounded-[6px] bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 border border-emerald-500/20 shrink-0 ml-2">
                      In Setup
                    </span>
                  ) : (
                    <span className="rounded-[6px] bg-[#2d2d34] hover:bg-[#5e7ce2] hover:text-[#09090b] px-2 py-0.5 text-[10px] text-[#f4f4f5] font-medium shrink-0 ml-2 transition-colors">
                      + Add
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </Modal>
    </div>
  );
};
