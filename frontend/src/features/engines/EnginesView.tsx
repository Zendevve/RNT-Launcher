import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Cpu,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Copy,
  Check,
  Edit2,
  Trash2,
  RotateCw,
  ShieldCheck,
  LayoutGrid,
  List as ListIcon,
  X,
  FolderSearch,
} from 'lucide-react';
import { Engine, EngineFamily } from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { EngineModal } from './EngineModal';

const FAMILY_TABS: { id: string; label: string; family?: EngineFamily }[] = [
  { id: 'all', label: 'All Engines' },
  { id: 'gzdoom', label: 'GZDoom', family: 'gzdoom' },
  { id: 'zandronum', label: 'Zandronum', family: 'zandronum' },
  { id: 'dsda-doom', label: 'DSDA-Doom', family: 'dsda-doom' },
  { id: 'woof', label: 'Woof!', family: 'woof' },
  { id: 'crispy-doom', label: 'Crispy Doom', family: 'crispy-doom' },
  { id: 'chocolate-doom', label: 'Chocolate Doom', family: 'chocolate-doom' },
  { id: 'prboom-plus', label: 'PRBoom+', family: 'prboom-plus' },
  { id: 'other', label: 'Other', family: 'other' },
];

export const EnginesView: React.FC = () => {
  const toast = useToast();
  const [engines, setEngines] = useState<Engine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFamilyTab, setActiveFamilyTab] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState<Engine | null>(null);

  // Delete confirm modal state
  const [engineToDelete, setEngineToDelete] = useState<Engine | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Executable validation status per engine id
  const [validationStatuses, setValidationStatuses] = useState<
    Record<string, { valid?: boolean; message?: string; testing?: boolean }>
  >({});

  // Copied path tracking
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch engines list
  const loadEngines = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.listEngines();
      setEngines(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch engines';
      toast.error('Error Loading Engines', message);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadEngines();
  }, [loadEngines]);

  // Copy path helper
  const handleCopyPath = async (engine: Engine) => {
    try {
      await navigator.clipboard.writeText(engine.executable);
      setCopiedId(engine.id);
      toast.success('Path Copied', engine.executable);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Clipboard Error', 'Could not copy executable path to clipboard.');
    }
  };

  // Open directory containing the executable in Explorer/Finder
  const handleOpenFolder = async (engine: Engine) => {
    try {
      await api.openPathInExplorer(engine.executable);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not open folder';
      toast.error('Explorer Error', message);
    }
  };

  // Validate an engine executable on demand
  const handleTestEngine = async (engine: Engine) => {
    setValidationStatuses((prev) => ({
      ...prev,
      [engine.id]: { testing: true },
    }));

    try {
      await api.validateEngineExecutable(engine.executable);
      setValidationStatuses((prev) => ({
        ...prev,
        [engine.id]: { valid: true, message: 'Executable verified', testing: false },
      }));
      toast.success('Engine Verified', `"${engine.name}" executable is ready.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      setValidationStatuses((prev) => ({
        ...prev,
        [engine.id]: { valid: false, message, testing: false },
      }));
      toast.error('Engine Validation Error', message);
    }
  };

  // Quick background scan trigger
  const handleScanFolders = async () => {
    try {
      toast.info('Scanning Folders', 'Checking configured directories for engine executables...');
      await api.startScan();
      setTimeout(() => {
        loadEngines();
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scan failed';
      toast.error('Scan Error', message);
    }
  };

  // Delete engine
  const handleConfirmDelete = async () => {
    if (!engineToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteEngine(engineToDelete.id);
      toast.success('Engine Removed', `"${engineToDelete.name}" was deleted.`);
      setEngines((prev) => prev.filter((e) => e.id !== engineToDelete.id));
      setEngineToDelete(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete engine';
      toast.error('Delete Error', message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered engines
  const filteredEngines = useMemo(() => {
    return engines.filter((engine) => {
      // Family tab filter
      if (activeFamilyTab !== 'all' && engine.family !== activeFamilyTab) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = engine.name.toLowerCase().includes(q);
        const matchesFamily = engine.family.toLowerCase().includes(q);
        const matchesVersion = engine.version ? engine.version.toLowerCase().includes(q) : false;
        const matchesPath = engine.executable.toLowerCase().includes(q);
        return matchesName || matchesFamily || matchesVersion || matchesPath;
      }
      return true;
    });
  }, [engines, activeFamilyTab, searchQuery]);

  // Helpers for family badge appearance
  const getFamilyBadgeStyle = (family: EngineFamily) => {
    switch (family) {
      case 'gzdoom':
        return 'bg-purple-950/40 text-purple-300 border-purple-800/30';
      case 'zandronum':
        return 'bg-blue-950/40 text-blue-300 border-blue-800/30';
      case 'dsda-doom':
        return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/30';
      case 'woof':
      case 'crispy-doom':
      case 'chocolate-doom':
        return 'bg-amber-950/40 text-amber-300 border-amber-800/30';
      case 'prboom-plus':
        return 'bg-cyan-950/40 text-cyan-300 border-cyan-800/30';
      default:
        return 'bg-white/[0.04] text-zinc-300 border-white/[0.08]';
    }
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
            placeholder="Search source ports by name, family, executable..."
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

        {/* Right: Table/Grid switcher, Scan, + Add Engine */}
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
              setSelectedEngine(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#5e7ce2] hover:bg-[#4d6bd4] px-3.5 py-1.5 text-xs font-[600] text-[#09090b] transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Source Port</span>
          </button>
        </div>
      </div>

      {/* TIER 2 TOOLBAR: Family Filter Pills & Live Count (38px) */}
      <div className="border-b border-[#22262d] bg-[#101317] px-6 py-2 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        {/* Left: Family filter pills */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {FAMILY_TABS.map((tab) => {
            const count =
              tab.id === 'all'
                ? engines.length
                : engines.filter((e) => e.family === tab.family).length;
            const isActive = activeFamilyTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFamilyTab(tab.id)}
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

        {/* Right: Match count badge */}
        <span className="font-mono text-[11px] text-zinc-400 bg-[#14171c] border border-[#22262d] px-2.5 py-1 rounded">
          {filteredEngines.length} of {engines.length} ports
        </span>
      </div>

      {/* MAIN CONTENT VIEWPORT */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-zinc-500">
            <RotateCw className="h-6 w-6 animate-spin" />
            <span className="text-xs">Scanning registered engines...</span>
          </div>
        ) : filteredEngines.length === 0 ? (
          /* Empty State */
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-[#22262d] bg-[#14171c]/40 p-8 text-center">
            <Cpu className="h-10 w-10 text-zinc-600 mb-3" />
            {engines.length === 0 ? (
              <>
                <h3 className="text-sm font-semibold text-zinc-200">No Source Ports Registered</h3>
                <p className="mt-1 max-w-md text-xs text-zinc-400 leading-relaxed">
                  Register your installed Doom engine executables (such as GZDoom, PRBoom+, DSDA-Doom, or Woof) to configure setups and launch games.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEngine(null);
                      setIsModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#5e7ce2] hover:bg-[#4d6bd4] px-4 py-1.5 text-xs font-[600] text-[#09090b] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Source Port</span>
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
                <h3 className="text-sm font-semibold text-zinc-200">No matching engines found</h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Try clearing your search query or switching to All Engines.
                </p>
                <Button
                  variant="outline"
                  size="xs"
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFamilyTab('all');
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
                    <th className="px-4 py-2.5">Source Port</th>
                    <th className="px-4 py-2.5">Family</th>
                    <th className="px-4 py-2.5">Version</th>
                    <th className="px-4 py-2.5">Executable Path</th>
                    <th className="px-4 py-2.5">Binary Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2229]">
                  {filteredEngines.map((engine) => {
                    const status = validationStatuses[engine.id];
                    return (
                      <tr
                        key={engine.id}
                        className="hover:bg-[#181c22] transition-colors duration-100 group"
                      >
                        {/* Port Name */}
                        <td className="px-4 py-2.5 font-semibold text-zinc-100">
                          {engine.name}
                        </td>

                        {/* Family */}
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${getFamilyBadgeStyle(
                              engine.family
                            )}`}
                          >
                            {engine.family}
                          </span>
                        </td>

                        {/* Version */}
                        <td className="px-4 py-2.5 font-mono text-zinc-400">
                          {engine.version ? `v${engine.version}` : '-'}
                        </td>

                        {/* Executable Path with copy & open folder */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 max-w-lg">
                            <span
                              className="font-mono text-xs text-zinc-400 truncate hover:text-zinc-200 transition-colors"
                              title={engine.executable}
                            >
                              {engine.executable}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyPath(engine)}
                              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors shrink-0"
                              title="Copy Executable Path"
                            >
                              {copiedId === engine.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenFolder(engine)}
                              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors shrink-0"
                              title="Open in Explorer"
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-2.5">
                          {status ? (
                            status.testing ? (
                              <span className="inline-flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
                                <RotateCw className="h-3 w-3 animate-spin text-zinc-400" />
                                <span>Testing</span>
                              </span>
                            ) : status.valid ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Verified</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-red-400 font-mono text-[11px]" title={status.message}>
                                <AlertCircle className="h-3 w-3" />
                                <span>Failed</span>
                              </span>
                            )
                          ) : (
                            <span className="text-zinc-500 font-mono text-[11px]">Not verified</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleTestEngine(engine)}
                              disabled={status?.testing}
                              title="Verify Executable"
                              className="p-1.5 rounded text-zinc-400 hover:text-emerald-400 hover:bg-white/[0.04] transition-colors disabled:opacity-40"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEngine(engine);
                                setIsModalOpen(true);
                              }}
                              title="Edit Port Configuration"
                              className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEngineToDelete(engine)}
                              title="Delete Port"
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
            {filteredEngines.map((engine) => {
              const status = validationStatuses[engine.id];

              return (
                <div
                  key={engine.id}
                  className="group flex flex-col justify-between rounded-lg border border-[#22262d] bg-[#14171c] hover:bg-[#181c22] transition-colors duration-100 p-4 select-none"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm text-zinc-100 truncate group-hover:text-white">
                          {engine.name}
                        </h3>

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase border ${getFamilyBadgeStyle(
                              engine.family
                            )}`}
                          >
                            {engine.family}
                          </span>
                          {engine.version && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-[#181c21] text-zinc-400 border border-[#22262d]">
                              v{engine.version}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEngine(engine);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
                          title="Edit Port"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEngineToDelete(engine)}
                          className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                          title="Delete Port"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Executable Path Row */}
                    <div className="mt-3.5 p-2 rounded bg-[#0c0e12] border border-[#22262d] flex items-center justify-between gap-2">
                      <span
                        className="font-mono text-xs text-zinc-400 truncate"
                        title={engine.executable}
                      >
                        {engine.executable}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyPath(engine)}
                          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
                          title="Copy Path"
                        >
                          {copiedId === engine.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenFolder(engine)}
                          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
                          title="Open in Explorer"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-3.5 pt-3 border-t border-[#22262d] flex items-center justify-between text-xs text-zinc-400">
                    <div>
                      {status ? (
                        status.testing ? (
                          <span className="inline-flex items-center gap-1 text-zinc-400 font-mono text-[10px]">
                            <RotateCw className="h-3 w-3 animate-spin" /> Testing
                          </span>
                        ) : status.valid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-[10px]">
                            <CheckCircle2 className="h-3 w-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-400 font-mono text-[10px]">
                            <AlertCircle className="h-3 w-3" /> Failed
                          </span>
                        )
                      ) : (
                        <span className="text-zinc-500 font-mono text-[10px]">Not verified</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTestEngine(engine)}
                      disabled={status?.testing}
                      className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-emerald-400 transition-colors disabled:opacity-40"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Verify</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Engine Modal */}
      <EngineModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEngine(null);
        }}
        onSaved={() => {
          setIsModalOpen(false);
          setSelectedEngine(null);
          loadEngines();
        }}
        engine={selectedEngine}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(engineToDelete)}
        onClose={() => setEngineToDelete(null)}
        title="Remove Source Port"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="ghost" onClick={() => setEngineToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              isLoading={isDeleting}
            >
              Remove
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[#a1a1aa] leading-relaxed">
          Are you sure you want to remove <span className="text-[#f4f4f5] font-medium">&ldquo;{engineToDelete?.name}&rdquo;</span>? Profiles using this port will require reassignment before launching.
        </p>
      </Modal>
    </div>
  );
};
