import React, { useState, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { IdgamesFile, Mod } from '../../types';
import { api } from '../../services/api';
import { formatBytes } from '../../utils/formatters';

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

export const IdgamesSearchModal: React.FC<IdgamesSearchModalProps> = ({
  isOpen,
  onClose,
  onModImported,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IdgamesFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('rating-desc');
  const [selectedFile, setSelectedFile] = useState<IdgamesFile | null>(null);

  // Download state mapping file ID -> status
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<
    Record<number, { status: 'loading' | 'success' | 'error'; message?: string }>
  >({});

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) return;

      setIsLoading(true);
      setError(null);
      setHasSearched(true);
      setSelectedFile(null);

      try {
        const files = await api.searchIdgames(trimmed);
        setResults(files || []);
        if (files && files.length > 0) {
          setSelectedFile(files[0]);
        }
      } catch (err: unknown) {
        console.error('Failed to search /idgames:', err);
        const msg = err instanceof Error ? err.message : 'Failed to query /idgames archive';
        setError(msg);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  const handleDownload = async (file: IdgamesFile) => {
    if (downloadingId !== null) return;

    setDownloadingId(file.id);
    setDownloadStatus((prev) => ({
      ...prev,
      [file.id]: { status: 'loading' },
    }));

    try {
      const importedMod = await api.downloadIdgamesMod(file);
      setDownloadStatus((prev) => ({
        ...prev,
        [file.id]: { status: 'success', message: 'Imported successfully!' },
      }));

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
      <div className="flex h-[88vh] w-full max-w-6xl flex-col rounded-lg border border-doom-border bg-doom-bg text-doom-text shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-doom-border/80 bg-doom-surface px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-doom-red/20 text-doom-red border border-doom-red/40">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-base font-black uppercase tracking-wider text-doom-text">
                  /IDGAMES ARCHIVE SEARCH
                </h2>
                <span className="rounded bg-doom-card px-2 py-0.5 font-mono text-[10px] font-bold text-doom-muted border border-doom-border">
                  DOOMWORLD
                </span>
              </div>
              <p className="font-mono text-xs text-doom-muted">
                Zero-account search, direct mirror download, and instant library import
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded p-1.5 text-doom-muted transition-colors hover:bg-doom-card hover:text-doom-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

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

          {/* Quick Suggestions Chips */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
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
          {/* Left Column: Results List */}
          <div className="flex flex-1 flex-col border-r border-doom-border overflow-hidden">
            {/* Results Sub-header with Sort */}
            <div className="flex items-center justify-between border-b border-doom-border/70 bg-doom-surface/40 px-6 py-2">
              <span className="font-mono text-xs font-semibold text-doom-muted">
                {hasSearched ? `${results.length} results found` : 'Enter a search term to begin'}
              </span>

              {results.length > 0 && (
                <div className="flex items-center gap-1.5 font-mono text-xs text-doom-muted">
                  <ArrowUpDown className="h-3 w-3" />
                  <span>Sort:</span>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    aria-label="Sort idgames search results"
                    className="bg-transparent text-doom-text focus:outline-hidden cursor-pointer text-xs"
                  >
                    <option value="rating-desc" className="bg-doom-surface text-doom-text">
                      Highest Rating
                    </option>
                    <option value="votes-desc" className="bg-doom-surface text-doom-text">
                      Most Votes
                    </option>
                    <option value="date-desc" className="bg-doom-surface text-doom-text">
                      Release Date
                    </option>
                    <option value="size-desc" className="bg-doom-surface text-doom-text">
                      File Size
                    </option>
                    <option value="title-asc" className="bg-doom-surface text-doom-text">
                      Title (A-Z)
                    </option>
                  </select>
                </div>
              )}
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {isLoading ? (
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
                  {(error.toLowerCase().includes('cloudflare') || error.toLowerCase().includes('temporarily')) && (
                    <div className="mt-4 rounded-lg border border-[#22262d] bg-[#14171c] px-4 py-3 text-left max-w-sm w-full">
                      <p className="text-[11px] leading-relaxed text-zinc-400">
                        Try a more specific term — use the <span className="text-zinc-300 font-medium">Popular</span> chips above — or browse the archive directly.
                      </p>
                      <a
                        href="https://www.doomworld.com/idgames/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Open doomworld.com/idgames <span aria-hidden>↗</span>
                      </a>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSearch(query)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded bg-[#dc2626] hover:bg-[#ef4444] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Try again
                  </button>
                </div>
              ) : !hasSearched ? (
                <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-doom-muted">
                  <Globe className="h-10 w-10 text-doom-muted/40 mb-3" />
                  <h4 className="font-mono text-sm font-bold uppercase text-doom-text">
                    Search /idgames
                  </h4>
                  <p className="mt-1 font-mono text-xs max-w-sm">
                    Search tens of thousands of classic and modern Doom megawads, mods, and levels
                    directly from Doomworld.
                  </p>
                </div>
              ) : results.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-doom-muted">
                  <FileCode className="h-10 w-10 text-doom-muted/40 mb-3" />
                  <h4 className="font-mono text-sm font-bold uppercase text-doom-text">
                    No Files Found
                  </h4>
                  <p className="mt-1 font-mono text-xs max-w-sm">
                    No archive entries matched &ldquo;{query}&rdquo;. Try another search term or
                    author name.
                  </p>
                </div>
              ) : (
                sortedResults.map((file) => {
                  const isSelected = selectedFile?.id === file.id;
                  const status = downloadStatus[file.id];
                  const isDownloading = downloadingId === file.id;

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
                          {status?.status === 'success' ? (
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
                                handleDownload(file);
                              }}
                              className="inline-flex items-center gap-1.5 rounded bg-doom-red px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-doom-red-bright disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                            >
                              {isDownloading ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Downloading...</span>
                                </>
                              ) : (
                                <>
                                  <Download className="h-3 w-3" />
                                  <span>Download</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

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
                })
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
                  {downloadStatus[selectedFile.id]?.status === 'success' ? (
                    <div className="flex items-center justify-center gap-2 rounded bg-green-500/10 border border-green-500/30 p-2.5 font-mono text-xs font-bold text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Ready in Mod Library</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={downloadingId !== null}
                      onClick={() => handleDownload(selectedFile)}
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
      </div>
    </div>
  );
};
