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
  ShieldAlert,
  FileCode,
} from 'lucide-react';
import { IWAD, IWADType } from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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
  { id: 'freedoom', label: 'Freedoom', types: ['freedoom', 'freedoom2'] },
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
      setIWADs((prev) => prev.filter((w) => w.id !== iwadToDelete.id));
      toast.success('IWAD Removed', `"${iwadToDelete.name}" was unlinked.`);
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
        return 'bg-red-950/60 text-red-300 border-red-600/50';
      case 'doom2':
        return 'bg-amber-950/60 text-amber-300 border-amber-600/50';
      case 'tnt':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-600/50';
      case 'plutonia':
        return 'bg-cyan-950/60 text-cyan-300 border-cyan-600/50';
      case 'heretic':
        return 'bg-purple-950/60 text-purple-300 border-purple-600/50';
      case 'hexen':
        return 'bg-indigo-950/60 text-indigo-300 border-indigo-600/50';
      case 'strife':
        return 'bg-rose-950/60 text-rose-300 border-rose-600/50';
      case 'freedoom':
      case 'freedoom2':
        return 'bg-blue-950/60 text-blue-300 border-blue-600/50';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-600';
    }
  };

  const getCanonicalFilename = (path: string): string => {
    const clean = path.replace(/\\/g, '/');
    return clean.split('/').pop() || '';
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-doom-bg text-doom-text">
      {/* Header Bar */}
      <div className="border-b border-doom-border bg-doom-surface px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-doom-amber/20 text-doom-amber border border-doom-amber/40 shadow-inner">
                <Disc className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black uppercase tracking-wider text-zinc-100">
                    Base Game IWADs
                  </h1>
                  <span className="rounded-full bg-doom-card px-2.5 py-0.5 text-xs font-mono font-semibold text-doom-muted border border-doom-border">
                    {iwads.length} Registered
                  </span>
                </div>
                <p className="text-xs text-doom-muted mt-0.5">
                  Manage core game data archives (DOOM, DOOM II, TNT, Plutonia, Heretic, Hexen, Strife, FreeDoom)
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded border border-doom-border bg-doom-card p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'table'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Compact Table View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadIWADs}
              isLoading={isLoading}
              leftIcon={<RotateCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setSelectedIWAD(null);
                setIsModalOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add IWAD
            </Button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Game Type Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
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
                  onClick={() => setActiveTypeTab(tab.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-doom-amber text-zinc-950 font-bold shadow-md shadow-amber-950/40'
                      : 'bg-doom-card hover:bg-zinc-800 text-zinc-300 border border-doom-border'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold ${
                        isActive ? 'bg-black/30 text-zinc-950' : 'bg-zinc-900 text-doom-muted'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="w-full md:w-72">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search IWADs by name, type, path..."
              leftIcon={<Search className="h-4 w-4 text-doom-muted" />}
              className="text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Quick Stats Strip */}
        {iwads.length > 0 && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-lg border border-doom-border bg-doom-surface/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Disc className="h-4 w-4 text-doom-amber" />
                <span className="text-xs text-doom-muted">Total IWADs</span>
              </div>
              <span className="font-mono text-sm font-bold text-zinc-100">{iwads.length}</span>
            </div>

            <div className="p-3.5 rounded-lg border border-doom-border bg-doom-surface/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <HardDrive className="h-4 w-4 text-doom-cyan" />
                <span className="text-xs text-doom-muted">Total Disk Space</span>
              </div>
              <span className="font-mono text-sm font-bold text-zinc-100">
                {formatBytes(totalDiskSize)}
              </span>
            </div>

            <div className="p-3.5 rounded-lg border border-doom-border bg-doom-surface/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="h-4 w-4 text-doom-green" />
                <span className="text-xs text-doom-muted">Total Indexed Lumps</span>
              </div>
              <span className="font-mono text-sm font-bold text-zinc-100">
                {totalLumpCount.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <RotateCw className="h-8 w-8 animate-spin text-doom-amber" />
            <span className="text-sm font-medium text-doom-muted">Reading registered IWADs...</span>
          </div>
        ) : filteredIWADs.length === 0 ? (
          /* Empty State */
          <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed border-doom-border bg-doom-surface/40 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 border border-doom-border text-zinc-500 mb-4">
              <Disc className="h-8 w-8" />
            </div>
            {iwads.length === 0 ? (
              <>
                <h3 className="text-lg font-bold text-zinc-200">No Base Game IWADs Registered</h3>
                <p className="mt-1 max-w-md text-xs text-doom-muted">
                  A base game IWAD (such as DOOM2.WAD, DOOM.WAD, TNT.WAD, or FreeDoom) contains the core
                  game resources necessary to execute mods and profiles.
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="md"
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
                <h3 className="text-base font-semibold text-zinc-200">No matching IWADs found</h3>
                <p className="mt-1 text-xs text-doom-muted">
                  Try clearing your search query or switching to &ldquo;All IWADs&rdquo;.
                </p>
                <Button
                  variant="outline"
                  size="sm"
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredIWADs.map((iwad) => {
              const filename = getCanonicalFilename(iwad.path);

              return (
                <div
                  key={iwad.id}
                  className="group flex flex-col justify-between rounded-lg border border-doom-border bg-doom-card hover:border-doom-border-bright transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-black/40"
                >
                  {/* Card Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-base text-zinc-100 truncate group-hover:text-doom-amber transition-colors">
                          {iwad.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase border ${getTypeBadgeStyles(
                              iwad.type
                            )}`}
                          >
                            {iwad.type}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {filename}
                          </span>
                        </div>
                      </div>

                      {/* Card Header Action Icons */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setSelectedIWAD(iwad);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                          title="Edit IWAD Details"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setIWADToDelete(iwad)}
                          className="p-1.5 rounded hover:bg-red-950/60 text-zinc-400 hover:text-red-400 transition-colors"
                          title="Delete IWAD"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata summary (Lumps, Size, Hash) */}
                    <div className="mt-4 grid grid-cols-2 gap-2 p-2.5 rounded bg-doom-surface/80 border border-doom-border text-xs">
                      <div>
                        <span className="text-[10px] text-doom-muted uppercase tracking-wider block">
                          Indexed Lumps
                        </span>
                        <span className="font-mono text-zinc-200 font-semibold">
                          {iwad.lumpCount ? iwad.lumpCount.toLocaleString() : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-doom-muted uppercase tracking-wider block">
                          File Size
                        </span>
                        <span className="font-mono text-zinc-200 font-semibold">
                          {formatBytes(iwad.size)}
                        </span>
                      </div>
                    </div>

                    {/* Path & SHA-256 information */}
                    <div className="mt-3 space-y-1.5">
                      {/* Path row */}
                      <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800 text-xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileCode className="h-3.5 w-3.5 text-doom-muted shrink-0" />
                          <span className="font-mono text-[11px] text-zinc-400 truncate" title={iwad.path}>
                            {iwad.path}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleCopyPath(iwad)}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                            title="Copy Path"
                          >
                            {copiedPathId === iwad.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleOpenFolder(iwad)}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-doom-amber transition-colors"
                            title="Open in Explorer"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* SHA-256 row */}
                      {iwad.sha256 && (
                        <div className="px-2 py-1 rounded bg-zinc-900/30 text-[10px] font-mono text-zinc-500 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <Hash className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {iwad.sha256.slice(0, 16)}...{iwad.sha256.slice(-8)}
                            </span>
                          </div>
                          <button
                            onClick={() => handleCopyHash(iwad)}
                            className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                            title="Copy Full SHA-256 Hash"
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
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-3 bg-doom-surface/50 border-t border-doom-border/80 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] text-doom-muted">
                      {iwad.updatedAt ? `Updated ${formatDate(iwad.updatedAt)}` : 'Ready'}
                    </span>
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        setSelectedIWAD(iwad);
                        setIsModalOpen(true);
                      }}
                      leftIcon={<Edit2 className="h-3.5 w-3.5" />}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View of IWADs */
          <div className="overflow-hidden rounded-lg border border-doom-border bg-doom-surface/40 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-doom-border bg-doom-surface text-zinc-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Title & Type</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Lumps</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Path</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-doom-border/60">
                {filteredIWADs.map((iwad) => {
                  const filename = getCanonicalFilename(iwad.path);

                  return (
                    <tr key={iwad.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase border ${getTypeBadgeStyles(
                              iwad.type
                            )}`}
                          >
                            {iwad.type}
                          </span>
                          <span className="font-semibold text-zinc-100">{iwad.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-300">{filename}</td>
                      <td className="py-3 px-4 font-mono text-zinc-400">
                        {iwad.lumpCount ? iwad.lumpCount.toLocaleString() : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400">{formatBytes(iwad.size)}</td>
                      <td className="py-3 px-4 font-mono text-zinc-500 max-w-xs truncate" title={iwad.path}>
                        {iwad.path}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleCopyPath(iwad)}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                            title="Copy Path"
                          >
                            {copiedPathId === iwad.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleOpenFolder(iwad)}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-doom-amber transition-colors"
                            title="Open in Explorer"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedIWAD(iwad);
                              setIsModalOpen(true);
                            }}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setIWADToDelete(iwad)}
                            className="p-1 rounded hover:bg-red-950/60 text-zinc-400 hover:text-red-400 transition-colors"
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
        title={
          <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider">
            <ShieldAlert className="h-5 w-5" />
            <span>Remove Base Game IWAD</span>
          </div>
        }
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-zinc-300">
            Are you sure you want to remove <strong className="text-white">&ldquo;{iwadToDelete?.name}&rdquo;</strong> from your registered base games?
          </p>
          <div className="p-3 bg-red-950/30 border border-red-900/50 rounded text-xs text-red-300">
            This will only unlink the file from RNT Launcher. The original .WAD file on your disk will NOT be deleted.
          </div>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-doom-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIWADToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDelete}
              isLoading={isDeleting}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Remove IWAD
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
