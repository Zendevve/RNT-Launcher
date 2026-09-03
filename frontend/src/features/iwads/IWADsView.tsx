import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Disc,
  Plus,
  Search,
  FolderOpen,
  Copy,
  Check,
  Edit2,
  Trash2,
  RotateCw,
  Hash,
  LayoutGrid,
  List as ListIcon,
  X,
  FolderSearch,
} from 'lucide-react';
import { IWAD, IWADType } from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { IWADModal } from './IWADModal';
import { formatBytes } from '../../utils/formatters';

const TYPE_FILTER_TABS: { id: string; label: string; types?: IWADType[] }[] = [
  { id: 'all', label: 'All IWADs' },
  { id: 'doom2', label: 'Doom II', types: ['doom2'] },
  { id: 'doom', label: 'Ultimate DOOM', types: ['doom'] },
  { id: 'finaldoom', label: 'Final Doom', types: ['tnt', 'plutonia'] },
  { id: 'heretic-hexen', label: 'Heretic / Hexen', types: ['heretic', 'hexen'] },
  { id: 'strife', label: 'Strife', types: ['strife'] },
  { id: 'freedoom', label: 'FreeDoom', types: ['freedoom', 'freedoom2'] },
  { id: 'other', label: 'Other', types: ['other', 'unknown'] },
];

export const IWADsView: React.FC = () => {
  const toast = useToast();
  const [iwads, setIWADs] = useState<IWAD[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypeTab, setActiveTypeTab] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIWAD, setSelectedIWAD] = useState<IWAD | null>(null);

  // Delete confirm modal state
  const [iwadToDelete, setIWADToDelete] = useState<IWAD | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copied item tracking
  const [copiedPathId, setCopiedPathId] = useState<string | null>(null);
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);

  // Fetch IWADs from backend
  const loadIWADs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.listIWADs();
      setIWADs(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch IWADs';
      toast.error('Error Loading IWADs', message);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadIWADs();
  }, [loadIWADs]);

  // Copy helpers
  const handleCopyPath = async (iwad: IWAD) => {
    try {
      await navigator.clipboard.writeText(iwad.path);
      setCopiedPathId(iwad.id);
      toast.success('Path Copied', iwad.path);
      setTimeout(() => setCopiedPathId(null), 2000);
    } catch {
      toast.error('Clipboard Error', 'Could not copy path.');
    }
  };

  const handleCopyHash = async (iwad: IWAD) => {
    if (!iwad.sha256) return;
    try {
      await navigator.clipboard.writeText(iwad.sha256);
      setCopiedHashId(iwad.id);
      toast.success('Hash Copied', 'SHA-256 checksum copied.');
      setTimeout(() => setCopiedHashId(null), 2000);
    } catch {
      toast.error('Clipboard Error', 'Could not copy hash.');
    }
  };

  // Open directory containing IWAD
  const handleOpenFolder = async (iwad: IWAD) => {
    try {
      await api.openPathInExplorer(iwad.path);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not open directory';
      toast.error('Explorer Error', message);
    }
  };

  // Quick scan trigger
  const handleScanFolders = async () => {
    try {
      toast.info('Scanning Folders', 'Searching configured folders for game IWADs...');
      await api.startScan();
      setTimeout(() => {
        loadIWADs();
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scan failed';
      toast.error('Scan Error', message);
    }
  };

  // Delete IWAD
  const handleConfirmDelete = async () => {
    if (!iwadToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteIWAD(iwadToDelete.id);
      toast.success('IWAD Removed', `"${iwadToDelete.name}" was unlinked.`);
      setIWADs((prev) => prev.filter((w) => w.id !== iwadToDelete.id));
      setIWADToDelete(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete IWAD';
      toast.error('Delete Error', message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered IWADs
  const filteredIWADs = useMemo(() => {
    return iwads.filter((iwad) => {
      // Type Tab filter
      if (activeTypeTab !== 'all') {
        const tabConfig = TYPE_FILTER_TABS.find((t) => t.id === activeTypeTab);
        if (tabConfig && tabConfig.types && !tabConfig.types.includes(iwad.type)) {
          return false;
        }
      }
      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = iwad.name.toLowerCase().includes(q);
        const matchesType = iwad.type.toLowerCase().includes(q);
        const matchesPath = iwad.path.toLowerCase().includes(q);
        const matchesHash = iwad.sha256 ? iwad.sha256.toLowerCase().includes(q) : false;
        return matchesName || matchesType || matchesPath || matchesHash;
      }
      return true;
    });
  }, [iwads, activeTypeTab, searchQuery]);

  // Aggregate stats
  const totalDiskSize = useMemo(() => {
    return iwads.reduce((acc, curr) => acc + (curr.size || 0), 0);
  }, [iwads]);

  const totalLumpCount = useMemo(() => {
    return iwads.reduce((acc, curr) => acc + (curr.lumpCount || 0), 0);
  }, [iwads]);

  // Type badge color mappings
  const getTypeBadgeStyle = (type: IWADType) => {
    switch (type) {
      case 'doom':
        return 'bg-red-950/40 text-red-300 border-red-800/30';
      case 'doom2':
        return 'bg-amber-950/40 text-amber-300 border-amber-800/30';
      case 'tnt':
      case 'plutonia':
        return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/30';
      case 'heretic':
      case 'hexen':
        return 'bg-purple-950/40 text-purple-300 border-purple-800/30';
      case 'strife':
        return 'bg-rose-950/40 text-rose-300 border-rose-800/30';
      case 'freedoom':
      case 'freedoom2':
        return 'bg-blue-950/40 text-blue-300 border-blue-800/30';
      default:
        return 'bg-white/[0.04] text-zinc-300 border-white/[0.08]';
    }
  };

  const getCanonicalFilename = (path: string): string => {
    const clean = path.replace(/\\/g, '/');
    return clean.split('/').pop() || '';
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-[#0c0e12] text-zinc-100 select-none">
      {/* TIER 1 TOOLBAR: Search & Primary Actions (44px) */}
      <div className="border-b border-[#22262d] bg-[#14171c] px-6 py-2.5 flex items-center justify-between gap-4 shrink-0">
        {/* Left: Search input */}
        <div className="relative flex items-center flex-1 max-w-md">
          <Search className="absolute left-3 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search IWADs by title, type, file path..."
            className="w-full rounded-md border border-[#22262d] bg-[#0c0e12] pl-9 pr-8 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-hidden transition-colors font-normal"
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

        {/* Right: Table/Grid switcher, Scan, + Add IWAD */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Table vs Grid View Toggle */}
          <div className="flex items-center rounded border border-[#22262d] bg-[#0c0e10] p-0.5">
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

          <button
            type="button"
            onClick={handleScanFolders}
            className="inline-flex items-center gap-1.5 rounded border border-[#22262d] bg-[#181c21] hover:bg-[#1f242e] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <FolderSearch className="h-3.5 w-3.5 text-zinc-400" />
            <span>Scan Folders</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedIWAD(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#5e7ce2] hover:bg-[#4d6bd4] px-3.5 py-1.5 text-xs font-[600] text-[#09090b] transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Base IWAD</span>
          </button>
        </div>
      </div>

      {/* TIER 2 TOOLBAR: Type Filter Pills & Metrics (38px) */}
      <div className="border-b border-[#22262d] bg-[#101317] px-6 py-2 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        {/* Left: Type filter pills */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {TYPE_FILTER_TABS.map((tab) => {
            let count = 0;
            if (tab.id === 'all') {
              count = iwads.length;
            } else if (tab.types) {
              count = iwads.filter((w) => tab.types?.includes(w.type)).length;
            }
            const isActive = activeTypeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTypeTab(tab.id)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded text-xs font-medium transition-colors select-none ${
                  isActive
                    ? 'bg-[#1c2026] text-zinc-100 border border-[#2c323d]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className="text-[10px] font-mono text-zinc-500">
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Aggregate metrics & Count badge */}
        <div className="flex items-center gap-3 shrink-0 text-xs">
          {totalDiskSize > 0 && (
            <span className="text-zinc-500 font-mono text-[11px] hidden md:inline">
              {formatBytes(totalDiskSize)} • {totalLumpCount.toLocaleString()} lumps
            </span>
          )}
          <span className="font-mono text-[11px] text-zinc-400 bg-[#14171c] border border-[#22262d] px-2.5 py-1 rounded">
            {filteredIWADs.length} of {iwads.length} IWADs
          </span>
        </div>
      </div>

      {/* MAIN CONTENT VIEWPORT */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-zinc-500">
            <RotateCw className="h-6 w-6 animate-spin" />
            <span className="text-xs">Reading registered IWADs...</span>
          </div>
        ) : filteredIWADs.length === 0 ? (
          /* Empty State */
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-[#22262d] bg-[#14171c]/40 p-8 text-center">
            <Disc className="h-10 w-10 text-zinc-600 mb-3" />
            {iwads.length === 0 ? (
              <>
                <h3 className="text-sm font-semibold text-zinc-200">No Base Game IWADs Registered</h3>
                <p className="mt-1 max-w-md text-xs text-zinc-400 leading-relaxed">
                  A base game IWAD (such as DOOM2.WAD, DOOM.WAD, TNT.WAD, or FreeDoom) provides the core game resources required to run source ports and mods.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIWAD(null);
                      setIsModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#5e7ce2] hover:bg-[#4d6bd4] px-4 py-1.5 text-xs font-[600] text-[#09090b] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Base IWAD</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleScanFolders}
                    className="inline-flex items-center gap-1.5 rounded border border-[#22262d] bg-[#181c21] hover:bg-[#1f242e] px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                  >
                    <FolderSearch className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Auto-Detect</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-zinc-200">No matching IWADs found</h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Try clearing your search query or switching to All IWADs.
                </p>
                <Button
                  variant="outline"
                  size="xs"
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveTypeTab('all');
                  }}
                >
                  Clear Filters
                </Button>
              </>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* Default: Clean Desktop Table View */
          <div className="overflow-hidden rounded-lg border border-[#22262d] bg-[#14171c]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#22262d] bg-[#101317] text-[11px] font-semibold text-zinc-400 select-none">
                    <th className="px-4 py-2.5">Base IWAD</th>
                    <th className="px-4 py-2.5">Game Type</th>
                    <th className="px-4 py-2.5">File Name</th>
                    <th className="px-4 py-2.5">Size</th>
                    <th className="px-4 py-2.5">Lumps</th>
                    <th className="px-4 py-2.5">File Path</th>
                    <th className="px-4 py-2.5">SHA-256</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2229]">
                  {filteredIWADs.map((iwad) => {
                    const filename = getCanonicalFilename(iwad.path);

                    return (
                      <tr
                        key={iwad.id}
                        className="hover:bg-[#181c22] transition-colors duration-100 group"
                      >
                        {/* Title */}
                        <td className="px-4 py-2.5 font-semibold text-zinc-100">
                          {iwad.name}
                        </td>

                        {/* Game Type */}
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${getTypeBadgeStyle(
                              iwad.type
                            )}`}
                          >
                            {iwad.type}
                          </span>
                        </td>

                        {/* File Name */}
                        <td className="px-4 py-2.5 font-mono text-zinc-300">
                          {filename}
                        </td>

                        {/* Size */}
                        <td className="px-4 py-2.5 font-mono text-zinc-400">
                          {formatBytes(iwad.size)}
                        </td>

                        {/* Lump Count */}
                        <td className="px-4 py-2.5 font-mono text-zinc-400">
                          {iwad.lumpCount ? iwad.lumpCount.toLocaleString() : '-'}
                        </td>

                        {/* Path with Copy and Open Folder */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 max-w-xs">
                            <span
                              className="font-mono text-xs text-zinc-400 truncate hover:text-zinc-200 transition-colors"
                              title={iwad.path}
                            >
                              {iwad.path}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyPath(iwad)}
                              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors shrink-0"
                              title="Copy File Path"
                            >
                              {copiedPathId === iwad.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenFolder(iwad)}
                              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors shrink-0"
                              title="Open in Explorer"
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* SHA-256 Checksum */}
                        <td className="px-4 py-2.5">
                          {iwad.sha256 ? (
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
                              <span className="truncate max-w-[90px]" title={iwad.sha256}>
                                {iwad.sha256.slice(0, 8)}...
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyHash(iwad)}
                                className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                                title="Copy SHA-256 Checksum"
                              >
                                {copiedHashId === iwad.id ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Hash className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-zinc-600 font-mono text-[11px]">-</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIWAD(iwad);
                                setIsModalOpen(true);
                              }}
                              title="Edit IWAD"
                              className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIWADToDelete(iwad)}
                              title="Delete IWAD"
                              className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid View Toggle */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredIWADs.map((iwad) => (
              <div
                key={iwad.id}
                className="group flex flex-col justify-between rounded-lg border border-[#22262d] bg-[#14171c] hover:bg-[#181c22] transition-colors duration-100 p-4 select-none"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm text-zinc-100 truncate group-hover:text-white">
                        {iwad.name}
                      </h3>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase border ${getTypeBadgeStyle(
                            iwad.type
                          )}`}
                        >
                          {iwad.type}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-[#181c21] text-zinc-400 border border-[#22262d]">
                          {formatBytes(iwad.size)}
                        </span>
                        {iwad.lumpCount && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-[#181c21] text-zinc-400 border border-[#22262d]">
                            {iwad.lumpCount.toLocaleString()} lumps
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIWAD(iwad);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
                        title="Edit IWAD"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIWADToDelete(iwad)}
                        className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                        title="Delete IWAD"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Path Row */}
                  <div className="mt-3.5 p-2 rounded bg-[#0c0e12] border border-[#22262d] flex items-center justify-between gap-2">
                    <span
                      className="font-mono text-xs text-zinc-400 truncate"
                      title={iwad.path}
                    >
                      {iwad.path}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyPath(iwad)}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
                        title="Copy Path"
                      >
                        {copiedPathId === iwad.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenFolder(iwad)}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
                        title="Open in Explorer"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Checksum */}
                {iwad.sha256 && (
                  <div className="mt-3.5 pt-3 border-t border-[#22262d] flex items-center justify-between text-xs text-zinc-500 font-mono">
                    <div className="flex items-center gap-1 truncate">
                      <Hash className="h-3 w-3 text-zinc-600 shrink-0" />
                      <span className="truncate text-[11px]" title={iwad.sha256}>
                        {iwad.sha256.slice(0, 16)}...{iwad.sha256.slice(-8)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyHash(iwad)}
                      className="text-zinc-400 hover:text-zinc-200 text-[11px] transition-colors"
                    >
                      {copiedHashId === iwad.id ? 'Copied' : 'Copy Hash'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit IWAD Modal */}
      <IWADModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedIWAD(null);
        }}
        onSaved={() => {
          loadIWADs();
        }}
        iwad={selectedIWAD}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(iwadToDelete)}
        onClose={() => setIWADToDelete(null)}
        title="Unlink Base Game IWAD"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIWADToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              isLoading={isDeleting}
            >
              Delete IWAD
            </Button>
          </>
        }
      >
        <p className="text-xs text-zinc-300 leading-relaxed">
          Are you sure you want to unlink &quot;{iwadToDelete?.name}&quot;? Profiles referencing this base game will need reassignment before launching.
        </p>
      </Modal>
    </div>
  );
};
