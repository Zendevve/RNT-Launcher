import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Download,
  ExternalLink,
  Star,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Globe,
  HardDrive,
  User,
  Calendar,
  Sparkles,
  ArrowUpDown,
  FileCode,
  RotateCw,
  Award,
  Trophy,
} from 'lucide-react';
import { IdgamesCatalogItem, IdgamesShowcase, IdgamesDownloadProgress, Mod } from '../../types';
import { api } from '../../services/api';
import { events } from '../../lib/events';
import { formatBytes } from '../../utils/formatters';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';

export interface IdgamesSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModImported?: (mod: Mod) => void;
}

type SortOption = 'rating-desc' | 'votes-desc' | 'date-desc' | 'size-desc' | 'title-asc';

const POPULAR_SUGGESTIONS = [
  'Eviternity',
  'Scythe',
  'Ancient Aliens',
  'Sunder',
  'Sunlust',
  'Valiant',
  'Sigil',
  'Back to Saturn X',
];

const CATEGORY_PILLS = [
  'All',
  'Megawads',
  'Maps',
  'Gameplay',
  'Weapons',
  'Monsters',
  'Textures',
  'Audio',
];

const SHELVES: Array<{ key: keyof IdgamesShowcase; title: string; icon: 'award' | 'trophy' | 'star' | 'globe' }> = [
  { key: 'cacowardClassics', title: 'Cacoward Classics', icon: 'award' },
  { key: 'top100', title: 'Top 100', icon: 'trophy' },
  { key: 'topRated', title: 'Top Rated', icon: 'star' },
  { key: 'recentUploads', title: 'Recent Uploads', icon: 'globe' },
];

function ShelfIcon({ icon }: { icon: 'award' | 'trophy' | 'star' | 'globe' }) {
  if (icon === 'award') return <Award className="h-3.5 w-3.5 text-doom-amber" />;
  if (icon === 'trophy') return <Trophy className="h-3.5 w-3.5 text-doom-amber" />;
  if (icon === 'star') return <Star className="h-3.5 w-3.5 text-doom-amber" />;
  return <Globe className="h-3.5 w-3.5 text-doom-cyan" />;
}

function InstalledBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-green-400 border border-green-500/30 shrink-0">
      <CheckCircle2 className="h-3 w-3" />
      <span>In Library — Select in Profile</span>
    </span>
  );
}

export const IdgamesSearchModal: React.FC<IdgamesSearchModalProps> = ({
  isOpen,
  onClose,
  onModImported,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IdgamesCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('rating-desc');
  const [selectedFile, setSelectedFile] = useState<IdgamesCatalogItem | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');

  const [showcase, setShowcase] = useState<IdgamesShowcase | null>(null);
  const [showcaseLoading, setShowcaseLoading] = useState(false);

  // Download state mapping archive ID -> status
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<
    Record<number, { status: 'loading' | 'success' | 'error'; message?: string }>
  >({});
  const [progressMap, setProgressMap] = useState<Record<number, IdgamesDownloadProgress>>({});

  const requestRef = useRef(0);

  // Curated showcase for the zero-state shelves
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setShowcaseLoading(true);
    api
      .getIdgamesShowcase()
      .then((data) => {
        if (cancelled) return;
        setShowcase(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Failed to load /idgames showcase:', err);
        setShowcase(null);
      })
      .finally(() => {
        if (!cancelled) setShowcaseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const runSearch = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;

      setIsLoading(true);
      setError(null);
      setHasSearched(true);

      try {
        const items = await api.searchIdgamesCatalog({
          query: trimmed,
          category: activeCategory === 'All' ? '' : activeCategory,
          sort: sortOption,
          limit: 50,
          offset: 0,
        });
        if (requestRef.current !== requestId) return;
        setResults(items || []);
        setSelectedFile((prev) => {
          if (prev && items?.some((it) => it.id === prev.id)) return prev;
          return items && items.length > 0 ? items[0] : null;
        });
      } catch (err: unknown) {
        if (requestRef.current !== requestId) return;
        console.error('Failed to search /idgames:', err);
        const msg = err instanceof Error ? err.message : 'Failed to query /idgames archive';
        setError(msg);
        setResults([]);
      } finally {
        if (requestRef.current === requestId) setIsLoading(false);
      }
    },
    [activeCategory, sortOption]
  );

  // Debounced search (~100ms) as the user types
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      setIsLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      void runSearch(query);
    }, 100);
    return () => clearTimeout(timer);
  }, [query, isOpen, runSearch]);

  // Non-blocking progress tray: backend progress events + window event fallback
  useEffect(() => {
    if (!isOpen) return;
    const off = events.on<IdgamesDownloadProgress>('idgames:download:progress', (data) => {
      if (!data || typeof data.archiveId !== 'number') return;
      setProgressMap((prev) => ({ ...prev, [data.archiveId]: data }));
    });
    const onWindowProgress = (e: Event) => {
      const detail = (e as CustomEvent<IdgamesDownloadProgress>).detail;
      if (!detail || typeof detail.archiveId !== 'number') return;
      setProgressMap((prev) => ({ ...prev, [detail.archiveId]: detail }));
    };
    window.addEventListener('idgames:download:progress', onWindowProgress);
    return () => {
      off();
      window.removeEventListener('idgames:download:progress', onWindowProgress);
    };
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(query);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    void runSearch(suggestion);
  };

  const handleCategoryClick = (category: string) => {
    setActiveCategory(category);
    if (query.trim()) void runSearch(query);
  };

  const handleDownload = async (file: IdgamesCatalogItem) => {
    if (downloadingId !== null) return;

    setDownloadingId(file.id);
    setDownloadStatus((prev) => ({
      ...prev,
      [file.id]: { status: 'loading' },
    }));

    try {
      const importedMod = await api.downloadIdgamesArchive(file.id);
      setDownloadStatus((prev) => ({
        ...prev,
        [file.id]: { status: 'success', message: 'Imported successfully!' },
      }));
      setResults((prev) =>
        prev.map((it) =>
          it.id === file.id ? { ...it, isInstalled: true, installedModId: importedMod?.id ?? it.installedModId } : it
        )
      );
      setSelectedFile((prev) =>
        prev && prev.id === file.id
          ? { ...prev, isInstalled: true, installedModId: importedMod?.id ?? prev.installedModId }
          : prev
      );

      if (onModImported && importedMod) {
        onModImported(importedMod);
      }
    } catch (err: unknown) {
      console.error('Download failed:', err);
      const msg = err instanceof Error ? err.message : 'Download failed';
      setDownloadStatus((prev) => ({
        ...prev,
        [file.id]: { status: 'error', message: msg },
      }));
    } finally {
      setDownloadingId(null);
    }
  };

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      switch (sortOption) {
        case 'rating-desc':
          return (b.rating || 0) - (a.rating || 0);
        case 'votes-desc':
          return (b.votes || 0) - (a.votes || 0);
        case 'date-desc':
          return (b.date || '').localeCompare(a.date || '');
        case 'size-desc':
          return (b.size || 0) - (a.size || 0);
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '');
        default:
          return 0;
      }
    });
  }, [results, sortOption]);

  const activeProgress = useMemo(
    () =>
      Object.values(progressMap).filter(
        (p) => p.status === 'downloading' || p.status === 'extracting' || (p.percent < 100 && !p.error)
      ),
    [progressMap]
  );

  const renderFileCard = (file: IdgamesCatalogItem) => {
    const isSelected = selectedFile?.id === file.id;
    const status = downloadStatus[file.id];
    const isDownloading = downloadingId === file.id;
    const progress = progressMap[file.id];

    return (
      <div
        key={file.id}
        onClick={() => setSelectedFile(file)}
        className={`group flex flex-col gap-2 rounded border p-3.5 transition-all cursor-pointer ${
          isSelected
            ? 'border-doom-red bg-doom-surface/90 shadow-md shadow-doom-red/10'
            : 'border-doom-border bg-doom-card hover:border-doom-border-bright hover:bg-doom-surface/50'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-sm font-bold text-doom-text truncate group-hover:text-white">
                {file.title || file.filename}
              </h3>
              {file.rating > 0 && (
                <span className="inline-flex items-center gap-1 rounded bg-doom-amber/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-doom-amber shrink-0 border border-doom-amber/30">
                  <Star className="h-2.5 w-2.5 fill-doom-amber" />
                  {file.rating.toFixed(1)}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-doom-muted">
              {file.author && (
                <span className="flex items-center gap-1 truncate">
                  <User className="h-3 w-3" />
                  {file.author}
                </span>
              )}
              {file.size > 0 && (
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {formatBytes(file.size)}
                </span>
              )}
              {file.date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {file.date}
                </span>
              )}
            </div>
          </div>
          {/* Quick Download Button */}
          <div className="shrink-0">
            {status?.status === 'success' || file.isInstalled ? (
              <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2.5 py-1 font-mono text-xs font-bold text-green-400 border border-green-500/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Imported</span>
              </span>
            ) : (
              <button
                type="button"
                disabled={isDownloading || downloadingId !== null}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDownload(file);
                }}
                className="inline-flex items-center gap-1.5 rounded bg-doom-red px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-doom-red-bright disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3" />
                    <span>Get</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {file.isCacoward && (
            <Badge variant="outline" size="sm" className="text-[10px] text-doom-amber border-doom-amber/40">
              <Award className="h-3 w-3 mr-1" />
              Cacoward{file.cacowardYear > 0 ? ` ${file.cacowardYear}` : ''}
            </Badge>
          )}
          {file.isTop100 && (
            <Badge variant="outline" size="sm" className="text-[10px]">
              <Trophy className="h-3 w-3 mr-1" />
              Top 100
            </Badge>
          )}
          {file.category && (
            <Badge variant="outline" size="sm" className="text-[10px]">
              {file.category}
            </Badge>
          )}
          {file.isInstalled && <InstalledBadge />}
        </div>

        {(isDownloading || (progress && progress.percent < 100 && progress.status !== 'done')) && progress && (
          <div className="h-1 rounded bg-doom-border overflow-hidden">
            <div
              className="h-full bg-doom-red transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
            />
          </div>
        )}

        {file.description && (
          <p className="font-mono text-xs text-doom-muted line-clamp-2 leading-relaxed">
            {file.description}
          </p>
        )}

        {status?.status === 'error' && (
          <p className="font-mono text-[11px] text-doom-red flex items-center gap-1">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>{status.message || 'Failed to download'}</span>
          </p>
        )}
      </div>
    );
  };

  const showZeroState = !hasSearched && !query.trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="6xl"
      title={
        <div className="flex items-center gap-2.5">
          <span className="rounded-[8px] bg-[#0c0c0f] border border-[#2d2d34] p-1.5 text-[#5e7ce2]">
            <Globe className="h-4 w-4" />
          </span>
          <span>/idgames Archive Search</span>
          <Badge variant="outline" size="sm" className="ml-1 text-[10px]">
            Doomworld
          </Badge>
        </div>
      }
      description="Zero-account search, direct mirror download, and instant library import"
    >
      <div className="flex h-[75vh] w-full flex-col -m-6 overflow-hidden relative">
        {/* Search & Filter Bar */}
        <div className="border-b border-doom-border bg-doom-surface/60 px-6 py-3.5">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-doom-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by mod title, author, or filename (e.g. eviternity, sunder, scythe)..."
                autoFocus
                className="w-full rounded border border-doom-border bg-doom-card pl-9 pr-8 py-2 font-mono text-xs text-doom-text placeholder-doom-muted/60 focus:border-doom-red focus:outline-hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-2.5 text-doom-muted hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="inline-flex items-center gap-2 rounded bg-doom-red px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-doom-red/20 transition-colors hover:bg-doom-red-bright disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  <span>Search</span>
                </>
              )}
            </button>
          </form>
          {/* Category Pills */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {CATEGORY_PILLS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                className={`rounded-full border px-3 py-1 font-mono text-[11px] shrink-0 transition-colors ${
                  activeCategory === cat
                    ? 'border-doom-red bg-doom-red/15 text-white'
                    : 'border-doom-border bg-doom-card/70 text-doom-muted hover:border-doom-border-bright hover:text-doom-text'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Quick Suggestions Chips */}
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="flex items-center gap-1 font-mono text-[11px] text-doom-muted uppercase tracking-wider shrink-0">
              <Sparkles className="h-3 w-3 text-doom-amber" />
              Popular:
            </span>
            {POPULAR_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="rounded border border-doom-border bg-doom-card/70 px-2 py-0.5 font-mono text-[11px] text-doom-muted transition-colors hover:border-doom-border-bright hover:bg-doom-card hover:text-doom-text shrink-0"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body: Split Results List & Detail Panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column: Results List or Showcase Shelves */}
          <div className="flex flex-1 flex-col border-r border-doom-border overflow-hidden">
            {/* Results Sub-header with Sort */}
            <div className="flex items-center justify-between border-b border-doom-border/70 bg-doom-surface/40 px-6 py-2">
              <span className="font-mono text-xs font-semibold text-doom-muted">
                {showZeroState ? 'Curated from the offline archive' : `${results.length} results found`}
              </span>
              {!showZeroState && results.length > 0 && (
                <div className="flex items-center gap-1.5 font-mono text-xs text-doom-muted">
                  <ArrowUpDown className="h-3 w-3" />
                  <span>Sort:</span>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    aria-label="Sort idgames search results"
                    className="bg-transparent text-doom-text focus:outline-hidden cursor-pointer text-xs"
                  >
                    <option value="rating-desc" className="bg-doom-surface text-doom-text">Highest Rating</option>
                    <option value="votes-desc" className="bg-doom-surface text-doom-text">Most Votes</option>
                    <option value="date-desc" className="bg-doom-surface text-doom-text">Release Date</option>
                    <option value="size-desc" className="bg-doom-surface text-doom-text">File Size</option>
                    <option value="title-asc" className="bg-doom-surface text-doom-text">Title (A-Z)</option>
                  </select>
                </div>
              )}
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {showZeroState ? (
                showcaseLoading ? (
                  <div className="flex h-64 flex-col items-center justify-center text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-doom-red mb-3" />
                    <p className="font-mono text-xs text-doom-muted uppercase tracking-wider">
                      Loading curated shelves...
                    </p>
                  </div>
                ) : showcase &&
                  (showcase.cacowardClassics.length > 0 ||
                    showcase.top100.length > 0 ||
                    showcase.topRated.length > 0 ||
                    showcase.recentUploads.length > 0) ? (
                  SHELVES.map((shelf) => {
                    const items = showcase[shelf.key];
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={shelf.key}>
                        <div className="flex items-center gap-1.5 px-1 pb-2">
                          <ShelfIcon icon={shelf.icon} />
                          <h4 className="font-mono text-xs font-bold uppercase tracking-widest text-doom-text">
                            {shelf.title}
                          </h4>
                          <span className="font-mono text-[10px] text-doom-muted">({items.length})</span>
                        </div>
                        <div className="flex gap-2.5 overflow-x-auto pb-3">
                          {items.map((file) => (
                            <div key={file.id} className="w-72 shrink-0">
                              {renderFileCard(file)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-doom-muted">
                    <Globe className="h-10 w-10 text-doom-muted/40 mb-3" />
                    <h4 className="font-mono text-sm font-bold uppercase text-doom-text">Search /idgames</h4>
                    <p className="mt-1 font-mono text-xs max-w-sm">
                      Search tens of thousands of classic and modern Doom megawads, mods, and levels
                      directly from Doomworld.
                    </p>
                  </div>
                )
              ) : isLoading ? (
                <div className="flex h-64 flex-col items-center justify-center text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-doom-red mb-3" />
                  <p className="font-mono text-xs text-doom-muted uppercase tracking-wider">
                    Querying Doomworld /idgames database...
                  </p>
                </div>
              ) : error ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border mb-3 ${error.toLowerCase().includes('cloudflare') || error.toLowerCase().includes('shielded') ? 'bg-amber-950/30 border-amber-800/30 text-amber-400' : 'bg-red-950/30 border-red-800/30 text-red-400'}`}>
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-100 tracking-tight">
                    {error.toLowerCase().includes('cloudflare') || error.toLowerCase().includes('shielded')
                      ? 'Archive temporarily unavailable'
                      : 'Search failed'}
                  </h4>
                  <p className="mt-1.5 max-w-md text-xs leading-relaxed text-zinc-400">{error}</p>
                  {error.toLowerCase().includes('cloudflare') || error.toLowerCase().includes('temporarily') ? (
                    <div className="mt-4 rounded-lg border border-[#22262d] bg-[#14171c] px-4 py-3 text-left max-w-sm w-full">
                      <p className="text-[11px] leading-relaxed text-zinc-400">
                        Try a more specific term - use the <span className="text-zinc-300 font-medium">Popular</span> chips above - or browse the archive directly.
                      </p>
                      <a
                        href="https://www.doomworld.com/idgames/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <span>Open doomworld.com/idgames</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void runSearch(query)}
                      className="mt-4 inline-flex items-center gap-1.5 rounded bg-[#5e7ce2] hover:bg-[#4d6bd4] px-4 py-1.5 text-xs font-medium text-[#09090b] shadow-sm transition-colors"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      Try again
                    </button>
                  )}
                </div>
              ) : sortedResults.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-doom-muted">
                  <FileCode className="h-10 w-10 text-doom-muted/40 mb-3" />
                  <h4 className="font-mono text-sm font-bold uppercase text-doom-text">No Files Found</h4>
                  <p className="mt-1 font-mono text-xs max-w-sm">
                    No archive entries matched &ldquo;{query}&rdquo;. Try another search term or author name.
                  </p>
                </div>
              ) : (
                sortedResults.map((file) => renderFileCard(file))
              )}
            </div>
          </div>

          {/* Right Column: Selected File Details Drawer */}
          <div className="hidden md:flex w-80 lg:w-96 flex-col bg-doom-surface/50 overflow-y-auto p-5">
            {selectedFile ? (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-doom-muted">
                      ARCHIVE DETAILS
                    </span>
                    {selectedFile.url && (
                      <a
                        href={selectedFile.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-doom-cyan hover:underline"
                      >
                        <span>Doomworld</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <h3 className="mt-1 font-mono text-base font-black text-white break-words">
                    {selectedFile.title || selectedFile.filename}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedFile.isCacoward && (
                      <Badge variant="outline" size="sm" className="text-[10px] text-doom-amber border-doom-amber/40">
                        <Award className="h-3 w-3 mr-1" />
                        Cacoward{selectedFile.cacowardYear > 0 ? ` ${selectedFile.cacowardYear}` : ''}
                      </Badge>
                    )}
                    {selectedFile.isTop100 && (
                      <Badge variant="outline" size="sm" className="text-[10px]">
                        <Trophy className="h-3 w-3 mr-1" />
                        Top 100
                      </Badge>
                    )}
                    {selectedFile.isInstalled && <InstalledBadge />}
                  </div>
                </div>

                {/* Rating Card */}
                {selectedFile.rating > 0 && (
                  <div className="rounded border border-doom-amber/30 bg-doom-amber/5 p-3 font-mono">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Star className="h-4 w-4 fill-doom-amber text-doom-amber" />
                        <span className="text-sm font-bold text-doom-amber">
                          {selectedFile.rating.toFixed(2)} / 5.0
                        </span>
                      </div>
                      <span className="text-xs text-doom-muted">
                        {selectedFile.votes} {selectedFile.votes === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Curator Note */}
                {selectedFile.curatorNote && (
                  <div className="rounded border border-doom-amber/30 bg-doom-amber/5 p-3 font-mono text-xs text-doom-amber leading-relaxed">
                    {selectedFile.curatorNote}
                  </div>
                )}

                {/* Metadata key-values */}
                <div className="rounded border border-doom-border bg-doom-card p-3 font-mono text-xs space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-doom-muted">Filename:</span>
                    <span className="font-bold text-doom-text truncate">
                      {selectedFile.filename}
                    </span>
                  </div>
                  {selectedFile.author && (
                    <div className="flex justify-between gap-2">
                      <span className="text-doom-muted">Author:</span>
                      <span className="text-doom-text text-right truncate">
                        {selectedFile.author}
                      </span>
                    </div>
                  )}
                  {selectedFile.size > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-doom-muted">Size:</span>
                      <span className="text-doom-text">{formatBytes(selectedFile.size)}</span>
                    </div>
                  )}
                  {selectedFile.date && (
                    <div className="flex justify-between gap-2">
                      <span className="text-doom-muted">Date:</span>
                      <span className="text-doom-text">{selectedFile.date}</span>
                    </div>
                  )}
                  {selectedFile.category && (
                    <div className="flex justify-between gap-2">
                      <span className="text-doom-muted">Category:</span>
                      <span className="text-doom-text">{selectedFile.category}</span>
                    </div>
                  )}
                  {selectedFile.dir && (
                    <div className="flex flex-col gap-0.5 pt-1 border-t border-doom-border/50">
                      <span className="text-doom-muted text-[10px]">Directory:</span>
                      <span className="text-doom-muted/80 text-[11px] break-all">
                        {selectedFile.dir}
                      </span>
                    </div>
                  )}
                </div>

                {/* Full Description */}
                {selectedFile.description && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-doom-muted">
                      Description
                    </span>
                    <div className="rounded border border-doom-border bg-doom-card p-3 font-mono text-xs text-doom-muted whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                      {selectedFile.description}
                    </div>
                  </div>
                )}

                {/* Download & Import Action */}
                <div className="mt-auto pt-4 border-t border-doom-border/70">
                  {downloadStatus[selectedFile.id]?.status === 'success' || selectedFile.isInstalled ? (
                    <div className="flex items-center justify-center gap-2 rounded bg-green-500/10 border border-green-500/30 p-2.5 font-mono text-xs font-bold text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Ready in Mod Library</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={downloadingId !== null}
                      onClick={() => void handleDownload(selectedFile)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded bg-doom-red py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-doom-red/20 hover:bg-doom-red-bright disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    >
                      {downloadingId === selectedFile.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Downloading & Importing...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          <span>Download & Import</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-doom-muted">
                <FileCode className="h-8 w-8 text-doom-muted/30 mb-2" />
                <p className="font-mono text-xs">Select a mod from the results to view details</p>
              </div>
            )}
          </div>
        </div>

        {/* Non-blocking download progress tray */}
        {activeProgress.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(480px,90%)] rounded-lg border border-doom-border bg-doom-card/95 shadow-xl backdrop-blur p-3 space-y-2 z-10">
            {activeProgress.map((p) => (
              <div key={p.archiveId} className="font-mono text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-doom-text truncate font-bold">{p.filename || `Archive #${p.archiveId}`}</span>
                  <span className="text-doom-muted shrink-0">
                    {Math.round(p.percent)}% · {p.status}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-doom-border overflow-hidden">
                  <div
                    className="h-full bg-doom-red transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, p.percent))}%` }}
                  />
                </div>
                {p.mirrorUrl && (
                  <p className="mt-0.5 text-doom-muted/70 truncate">via {p.mirrorUrl}</p>
                )}
                {p.error && <p className="mt-0.5 text-doom-red">{p.error}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
