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
  Layers,
  HardDrive,
  LayoutGrid,
  List,
} from 'lucide-react';
import { IWAD, IWADType } from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { IWADModal } from './IWADModal';
import { formatBytes, formatDate } from '../../utils/formatters';

const TYPE_FILTER_TABS: { id: string; label: string; types?: IWADType[] }[] = [
  { id: 'all', label: 'All IWADs' },
  { id: 'doom2', label: 'Doom II', types: ['doom2'] },
  { id: 'doom', label: 'Ultimate DOOM', types: ['doom'] },
  { id: 'finaldoom', label: 'Final Doom (TNT/Plutonia)', types: ['tnt', 'plutonia'] },
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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

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
  const getTypeBadgeStyles = (type: IWADType) => {
    switch (type) {
      case 'doom':
        return 'bg-red-950/40 text-red-300 border-red-800/30';
      case 'doom2':
        return 'bg-amber-950/40 text-amber-300 border-amber-800/30';
      case 'tnt':
        return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/30';
      case 'plutonia':
        return 'bg-blue-950/40 text-blue-300 border-blue-800/30';
      case 'heretic':
      case 'hexen':
        return 'bg-purple-950/40 text-purple-300 border-purple-800/30';
      case 'strife':
        return 'bg-red-950/40 text-red-300 border-red-800/30';
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0c0e12] text-zinc-100 select-none">
      {/* Desktop Toolbar */}
      <div className="border-b border-[#22262d] bg-[#101317] px-8 py-3.5 space-y-3 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search IWADs by title, type, file path..."
              className="w-full rounded-md border border-[#22262d] bg-black/40 pl-8 pr-16 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-red-600 focus:outline-hidden font-mono"
            />
            <span className="absolute right-2.5 top-2 text-[10px] font-mono text-zinc-500">
              {filteredIWADs.length}/{iwads.length}
            </span>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-md border border-[#22262d] bg-black/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded transition-colors duration-150 ${
                  viewMode === 'grid'
                    ? 'bg-white/[0.12] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1 rounded transition-colors duration-150 ${
                  viewMode === 'table'
                    ? 'bg-white/[0.12] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Compact Table View"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="h-4 w-px bg-[#22262d] mx-1 hidden sm:block" />

            <Button
              variant="secondary"
              size="xs"
              onClick={loadIWADs}
              isLoading={isLoading}
              leftIcon={<RotateCw className="h-3 w-3" />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="xs"
              onClick={() => {
                setSelectedIWAD(null);
                setIsModalOpen(true);
              }}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Add IWAD
            </Button>
          </div>
        </div>

        {/* Game Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 border-t border-[#22262d]/50 pt-2">
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
                className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#1b1f26] text-zinc-100 border border-white/[0.14] font-semibold'
                    : 'bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 border border-[#22262d]'
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-black/40 text-zinc-200' : 'bg-black/30 text-zinc-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {/* Quick Stats Strip */}
        {iwads.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg border border-[#22262d] bg-[#14171c] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Disc className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-zinc-400">Total Base Games</span>
              </div>
              <span className="font-mono text-sm font-semibold text-zinc-100">{iwads.length}</span>
            </div>

            <div className="p-3.5 rounded-lg border border-[#22262d] bg-[#14171c] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <HardDrive className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-zinc-400">Total Disk Space</span>
              </div>
              <span className="font-mono text-sm font-semibold text-zinc-100">
                {formatBytes(totalDiskSize)}
              </span>
            </div>

            <div className="p-3.5 rounded-lg border border-[#22262d] bg-[#14171c] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-zinc-400">Total Indexed Lumps</span>
              </div>
              <span className="font-mono text-sm font-semibold text-zinc-100">
                {totalLumpCount.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <RotateCw className="h-6 w-6 animate-spin text-zinc-400" />
            <span className="text-xs font-medium text-zinc-400">Reading registered IWADs...</span>
          </div>
        ) : filteredIWADs.length === 0 ? (
          /* Empty State */
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-[#22262d] bg-[#14171c]/50 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1b1f26] border border-[#22262d] text-zinc-400 mb-3">
              <Disc className="h-6 w-6" />
            </div>
            {iwads.length === 0 ? (
              <>
                <h3 className="text-sm font-semibold text-zinc-100">No Base Game IWADs Registered</h3>
                <p className="mt-1 max-w-md text-xs text-zinc-400 leading-relaxed">
                  A base game IWAD (such as DOOM2.WAD, DOOM.WAD, TNT.WAD, or FreeDoom) contains the core
                  game resources necessary to execute mods and profiles.
                </p>
                <div className="mt-5">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedIWAD(null);
                      setIsModalOpen(true);
                    }}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Register Your First IWAD
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-zinc-100">No matching IWADs found</h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Try clearing your search query or switching to All IWADs.
                </p>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveTypeTab('all');
                  }}
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              </>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View of IWAD Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredIWADs.map((iwad) => {
              const filename = getCanonicalFilename(iwad.path);

              return (
                <div
                  key={iwad.id}
                  className="group flex flex-col justify-between rounded-lg border border-[#22262d] bg-[#14171c] hover:bg-[#1b1f26] hover:border-white/[0.14] transition-colors duration-150 select-none"
                >
                  {/* Card Body */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm text-zinc-100 truncate group-hover:text-white transition-colors">
                          {iwad.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium uppercase border ${getTypeBadgeStyles(
                              iwad.type
                            )}`}
                          >
                            {iwad.type}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono bg-black/30 text-zinc-300 border border-[#22262d]">
                            {filename}
                          </span>
                        </div>
                      </div>

                      {/* Card Header Action Icons */}
                      <div className="flex items-center gap-1 opacity-75 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIWAD(iwad);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors duration-150"
                          title="Edit IWAD Details"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIWADToDelete(iwad)}
                          className="p-1.5 rounded-md hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors duration-150"
                          title="Delete / Unlink IWAD"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Specs Grid */}
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-md bg-black/30 border border-[#22262d]">
                        <span className="text-[10px] text-zinc-500 block uppercase">File Size</span>
                        <span className="font-medium text-zinc-200 mt-0.5 block truncate">
                          {formatBytes(iwad.size)}
                        </span>
                      </div>
                      <div className="p-2 rounded-md bg-black/30 border border-[#22262d]">
                        <span className="text-[10px] text-zinc-500 block uppercase">Indexed Lumps</span>
                        <span className="font-medium text-zinc-200 mt-0.5 block truncate">
                          {iwad.lumpCount ? iwad.lumpCount.toLocaleString() : '0'} entries
                        </span>
                      </div>
                    </div>

                    {/* File Path Row */}
                    <div className="mt-3 p-2 rounded-md bg-black/40 border border-[#22262d] flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-zinc-400 truncate" title={iwad.path}>
                        {iwad.path}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyPath(iwad)}
                          className="p-1 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors duration-150"
                          title="Copy Full File Path"
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
                          className="p-1 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-blue-400 transition-colors duration-150"
                          title="Open Containing Folder"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* SHA-256 Checksum */}
                    {iwad.sha256 && (
                      <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                        <div className="flex items-center gap-1 truncate">
                          <Hash className="h-3 w-3 text-zinc-500 shrink-0" />
                          <span className="truncate" title={iwad.sha256}>
                            {iwad.sha256.slice(0, 16)}...{iwad.sha256.slice(-8)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyHash(iwad)}
                          className="text-zinc-500 hover:text-zinc-300 ml-2"
                        >
                          {copiedHashId === iwad.id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-2.5 border-t border-[#22262d] bg-black/20 flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span>Added {formatDate(iwad.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIWAD(iwad);
                        setIsModalOpen(true);
                      }}
                      className="text-zinc-300 hover:text-white font-medium transition-colors duration-150"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Compact Table View */
          <div className="overflow-hidden rounded-lg border border-[#22262d] bg-[#14171c]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#22262d] bg-black/30 text-zinc-400 font-medium">
                  <tr>
                    <th className="px-4 py-2.5">IWAD Name</th>
                    <th className="px-4 py-2.5">Game Type</th>
                    <th className="px-4 py-2.5">Filename</th>
                    <th className="px-4 py-2.5">File Size</th>
                    <th className="px-4 py-2.5">Lumps</th>
                    <th className="px-4 py-2.5">Path</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22262d]">
                  {filteredIWADs.map((iwad) => {
                    const filename = getCanonicalFilename(iwad.path);

                    return (
                      <tr key={iwad.id} className="hover:bg-[#1b1f26] transition-colors duration-150 group">
                        <td className="px-4 py-2.5 font-medium text-zinc-100">{iwad.name}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium uppercase border ${getTypeBadgeStyles(
                              iwad.type
                            )}`}
                          >
                            {iwad.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-zinc-300">{filename}</td>
                        <td className="px-4 py-2.5 font-mono text-zinc-400">{formatBytes(iwad.size)}</td>
                        <td className="px-4 py-2.5 font-mono text-zinc-400">
                          {iwad.lumpCount ? iwad.lumpCount.toLocaleString() : '0'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-zinc-400 truncate max-w-xs" title={iwad.path}>
                          {iwad.path}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenFolder(iwad)}
                              className="p-1 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-blue-400 transition-colors duration-150"
                              title="Open Folder"
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIWAD(iwad);
                                setIsModalOpen(true);
                              }}
                              className="p-1 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors duration-150"
                              title="Edit"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIWADToDelete(iwad)}
                              className="p-1 rounded-md hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors duration-150"
                              title="Delete"
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

      {/* Confirm Delete Modal */}
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
              isLoading={isDeleting}
              onClick={handleConfirmDelete}
            >
              Unlink IWAD
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-300 leading-relaxed">
          Are you sure you want to remove{' '}
          <span className="font-semibold text-white">{iwadToDelete?.name}</span> from registered
          IWADs? The file on your disk will remain untouched.
        </p>
      </Modal>
    </div>
  );
};
