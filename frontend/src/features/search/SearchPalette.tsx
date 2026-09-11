import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Crosshair,
  Library as LibraryIcon,
  Cpu,
  Disc,
  Play,
  Flame,
  Globe,
  Download,
  Loader2,
} from 'lucide-react';
import { Modal, Input, Badge, useToast } from '../../components';
import type { NavViewId } from '../../components';
import { api } from '../../services/api';
import type { Engine, IWAD, Mod, Profile, IdgamesCatalogItem } from '../../types';

export interface SearchPaletteProps {
  open: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  mods: Mod[];
  profiles: Profile[];
  engines: Engine[];
  iwads: IWAD[];
  onSelectProfile: (profileId: string) => void;
  onLaunchProfile: (profileId: string) => void;
  onNavigate: (view: NavViewId) => void;
}

interface PaletteEntry {
  key: string;
  run: () => void;
}

const MAX_MOD_ROWS = 10;
const MAX_CATALOG_ROWS = 8;

/**
 * Global command palette (Ctrl+K).
 * Client-side filters local mods/profiles/engines/IWADs and queries the
 * /idgames catalog for remote installs. Enter runs the active entry:
 * a profile entry launches it, a mod entry opens the library,
 * a catalog entry downloads + imports it. Escape closes via Modal.
 */
export const SearchPalette: React.FC<SearchPaletteProps> = ({
  open,
  query,
  onQueryChange,
  onClose,
  mods,
  profiles,
  engines,
  iwads,
  onSelectProfile,
  onLaunchProfile,
  onNavigate,
}) => {
  const toast = useToast();
  const [activeIndex, setActiveIndex] = useState(0);
  const [catalog, setCatalog] = useState<IdgamesCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return { mods: [] as Mod[], profiles: [] as Profile[], engines: [] as Engine[], iwads: [] as IWAD[] };
    }
    const q = query.toLowerCase();
    return {
      profiles: profiles.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.engine_name?.toLowerCase().includes(q) ||
          p.iwad_name?.toLowerCase().includes(q)
      ),
      mods: mods.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.path.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      ),
      engines: engines.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.family.toLowerCase().includes(q) ||
          e.executable.toLowerCase().includes(q)
      ),
      iwads: iwads.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.type.toLowerCase().includes(q) ||
          i.path.toLowerCase().includes(q)
      ),
    };
  }, [query, mods, profiles, engines, iwads]);

  // Remote /idgames catalog search (debounced, quiet-offline).
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setCatalog([]);
      setCatalogLoading(false);
      return;
    }
    setCatalogLoading(true);
    const timer = setTimeout(() => {
      api
        .searchIdgamesCatalog({ query: q, limit: MAX_CATALOG_ROWS })
        .then((items) => setCatalog(items || []))
        .catch(() => setCatalog([]))
        .finally(() => setCatalogLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const closeAndNavigate = (view: NavViewId) => {
    onNavigate(view);
    onClose();
  };

  const handleDownloadCatalogItem = async (item: IdgamesCatalogItem) => {
    if (downloadingId !== null) return;
    setDownloadingId(item.id);
    try {
      await api.downloadIdgamesArchive(item.id);
      toast.success('Mod Installed', `Installed ${item.title || item.filename}.`);
      closeAndNavigate('library');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Download Failed', msg || 'Could not download this file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const modRows = filtered.mods.slice(0, MAX_MOD_ROWS);

  const modOffset = filtered.profiles.length;
  const engineOffset = modOffset + modRows.length;
  const iwadOffset = engineOffset + filtered.engines.length;
  const catalogOffset = iwadOffset + filtered.iwads.length;

  const entries: PaletteEntry[] = [
    ...filtered.profiles.map((p) => ({
      key: `profile-${p.id}`,
      run: () => onLaunchProfile(p.id),
    })),
    ...modRows.map((m) => ({
      key: `mod-${m.id}`,
      run: () => closeAndNavigate('library'),
    })),
    ...filtered.engines.map((e) => ({
      key: `engine-${e.id}`,
      run: () => closeAndNavigate('engines'),
    })),
    ...filtered.iwads.map((i) => ({
      key: `iwad-${i.id}`,
      run: () => closeAndNavigate('iwads'),
    })),
    ...catalog.map((c) => ({
      key: `idgames-${c.id}`,
      run: () => {
        void handleDownloadCatalogItem(c);
      },
    })),
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (entries.length === 0 ? 0 : (prev + 1) % entries.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        entries.length === 0 ? 0 : (prev - 1 + entries.length) % entries.length
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      entries[activeIndex]?.run();
    }
  };

  if (!open) return null;

  const rowClass = (isActive: boolean) =>
    `flex items-center justify-between rounded-[8px] px-3 py-2 hover:bg-[#0c0c0f] hover:border-[#3a3a45] border cursor-pointer transition-colors ${
      isActive ? 'bg-[#0c0c0f] border-[#3a3a45]' : 'border-transparent'
    }`;
  const sectionTitle = 'text-[11px] uppercase text-[#71717a] tracking-wide mb-2 flex items-center gap-1.5';
  const hasAny =
    filtered.profiles.length > 0 ||
    filtered.mods.length > 0 ||
    filtered.engines.length > 0 ||
    filtered.iwads.length > 0 ||
    catalog.length > 0;

  return (
    <Modal isOpen={open} onClose={onClose} title="Global Search" size="lg">
      <div className="space-y-3">
        <Input
          autoFocus
          leftIcon={<Search className="w-4 h-4" />}
          placeholder="Search mods, profiles, ports, IWADs, /idgames..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
          {filtered.profiles.length > 0 && (
            <div>
              <h4 className={sectionTitle}>
                <Crosshair className="w-3.5 h-3.5 text-[#ef4444]" />
                Profiles ({filtered.profiles.length})
              </h4>
              <div className="space-y-1">
                {filtered.profiles.map((p, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onSelectProfile(p.id);
                        closeAndNavigate('profiles');
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={rowClass(isActive)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" size="sm">
                          PROFILE
                        </Badge>
                        <Flame className="w-3.5 h-3.5 text-[#ef4444] shrink-0" />
                        <span className="text-sm text-[#f4f4f5] truncate">{p.name}</span>
                        <span className="mono-meta text-xs text-[#71717a] truncate">
                          {p.engine_name || 'No engine'} • {p.iwad_name || 'No IWAD'}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLaunchProfile(p.id);
                        }}
                        className="px-2.5 py-1 text-xs bg-[#5e7ce2] hover:bg-[#4d6bd4] text-[#09090b] font-[600] rounded-[6px] flex items-center gap-1 transition-colors shrink-0"
                      >
                        <Play className="w-3 h-3 fill-current" /> Play
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {filtered.mods.length > 0 && (
            <div>
              <h4 className={sectionTitle}>
                <LibraryIcon className="w-3.5 h-3.5 text-blue-400" />
                Mods ({filtered.mods.length})
              </h4>
              <div className="space-y-1">
                {modRows.map((m, i) => {
                  const rowIndex = modOffset + i;
                  const isActive = rowIndex === activeIndex;
                  return (
                    <div
                      key={m.id}
                      onClick={() => closeAndNavigate('library')}
                      onMouseEnter={() => setActiveIndex(rowIndex)}
                      className={`flex items-center justify-between gap-3 ${rowClass(isActive)}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" size="sm">
                          {m.format.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-[#f4f4f5] truncate">{m.name}</span>
                        <span className="mono-meta text-xs text-[#71717a] truncate">
                          {m.category}
                        </span>
                      </div>
                      <span className="mono-meta text-xs text-[#71717a] truncate max-w-xs shrink-0">
                        {m.path}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {filtered.engines.length > 0 && (
            <div>
              <h4 className={sectionTitle}>
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                Engines ({filtered.engines.length})
              </h4>
              <div className="space-y-1">
                {filtered.engines.map((e, i) => {
                  const rowIndex = engineOffset + i;
                  const isActive = rowIndex === activeIndex;
                  return (
                    <div
                      key={e.id}
                      onClick={() => closeAndNavigate('engines')}
                      onMouseEnter={() => setActiveIndex(rowIndex)}
                      className={`flex items-center justify-between gap-3 ${rowClass(isActive)}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" size="sm">
                          {e.family.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-[#f4f4f5] truncate">{e.name}</span>
                      </div>
                      <span className="mono-meta text-xs text-[#71717a] truncate shrink-0">
                        {e.version || 'Unknown'} ({e.family})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {filtered.iwads.length > 0 && (
            <div>
              <h4 className={sectionTitle}>
                <Disc className="w-3.5 h-3.5 text-emerald-400" />
                IWADs ({filtered.iwads.length})
              </h4>
              <div className="space-y-1">
                {filtered.iwads.map((iwad, idx) => {
                  const rowIndex = iwadOffset + idx;
                  const isActive = rowIndex === activeIndex;
                  return (
                    <div
                      key={iwad.id}
                      onClick={() => closeAndNavigate('iwads')}
                      onMouseEnter={() => setActiveIndex(rowIndex)}
                      className={`flex items-center justify-between gap-3 ${rowClass(isActive)}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" size="sm">
                          {iwad.type.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-[#f4f4f5] truncate">{iwad.name}</span>
                      </div>
                      <span className="mono-meta text-xs text-[#71717a] truncate shrink-0">
                        {iwad.type.toUpperCase()} ({iwad.lump_count} lumps)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {(catalog.length > 0 || catalogLoading) && (
            <div>
              <h4 className={sectionTitle}>
                <Globe className="w-3.5 h-3.5 text-[#5e7ce2]" />
                From /idgames {catalogLoading ? '(searching...)' : `(${catalog.length})`}
              </h4>
              <div className="space-y-1">
                {catalog.map((c, i) => {
                  const rowIndex = catalogOffset + i;
                  const isActive = rowIndex === activeIndex;
                  const downloading = downloadingId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        void handleDownloadCatalogItem(c);
                      }}
                      onMouseEnter={() => setActiveIndex(rowIndex)}
                      className={`flex items-center justify-between gap-3 ${rowClass(isActive)}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" size="sm">
                          IDGAMES
                        </Badge>
                        <span className="text-sm text-[#f4f4f5] truncate">
                          {c.title || c.filename}
                        </span>
                        <span className="mono-meta text-xs text-[#71717a] truncate">
                          {c.author || 'Unknown author'}
                          {c.rating > 0 ? ` • ★ ${c.rating.toFixed(1)}` : ''}
                        </span>
                      </div>
                      <button
                        disabled={downloading || c.isInstalled}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDownloadCatalogItem(c);
                        }}
                        className="px-2.5 py-1 text-xs bg-[#0f0f12] hover:bg-[#0c0c0f] text-[#f4f4f5] border border-[#2d2d34] rounded-[6px] flex items-center gap-1 transition-colors shrink-0 disabled:opacity-50"
                      >
                        {downloading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        {c.isInstalled ? 'Installed' : downloading ? 'Fetching...' : 'Get'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {query.trim() && !hasAny && !catalogLoading && (
            <div className="text-center py-8 text-[13px] text-[#71717a]">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-[#2d2d34] pt-2.5 text-[11px] text-[#71717a]">
          <span>↑↓ navigate · Enter launch/open · Esc close</span>
        </div>
      </div>
    </Modal>
  );
};
