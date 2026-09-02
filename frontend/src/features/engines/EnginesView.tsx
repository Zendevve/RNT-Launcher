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
  List,
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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

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
  const getFamilyBadgeColor = (family: EngineFamily) => {
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
        return 'bg-blue-950/40 text-blue-300 border-blue-800/30';
      default:
        return 'bg-white/[0.04] text-zinc-300 border-white/[0.08]';
    }
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
              placeholder="Search source ports by name, family, executable..."
              className="w-full rounded-md border border-[#22262d] bg-black/40 pl-8 pr-16 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-red-600 focus:outline-hidden font-mono"
            />
            <span className="absolute right-2.5 top-2 text-[10px] font-mono text-zinc-500">
              {filteredEngines.length}/{engines.length}
            </span>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5">
            {/* View Mode Switcher */}
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
              onClick={loadEngines}
              isLoading={isLoading}
              leftIcon={<RotateCw className="h-3 w-3" />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="xs"
              onClick={() => {
                setSelectedEngine(null);
                setIsModalOpen(true);
              }}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              Add Engine
            </Button>
          </div>
        </div>

        {/* Family Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 border-t border-[#22262d]/50 pt-2">
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
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <RotateCw className="h-6 w-6 animate-spin text-zinc-400" />
            <span className="text-xs font-medium text-zinc-400">Scanning registered engines...</span>
          </div>
        ) : filteredEngines.length === 0 ? (
          /* Empty State */
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-[#22262d] bg-[#14171c]/50 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1b1f26] border border-[#22262d] text-zinc-400 mb-3">
              <Cpu className="h-6 w-6" />
            </div>
            {engines.length === 0 ? (
              <>
                <h3 className="text-sm font-semibold text-zinc-100">No Source Ports Registered</h3>
                <p className="mt-1 max-w-md text-xs text-zinc-400 leading-relaxed">
                  Register your installed Doom engine executables (such as GZDoom, DSDA-Doom, or Woof) to start creating profiles and launching mods.
                </p>
                <div className="mt-5">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedEngine(null);
                      setIsModalOpen(true);
                    }}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Add Your First Engine
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-zinc-100">No matching engines found</h3>
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
        ) : viewMode === 'grid' ? (
          /* Grid of Engine Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredEngines.map((engine) => {
              const status = validationStatuses[engine.id];

              return (
                <div
                  key={engine.id}
                  className="group flex flex-col justify-between rounded-lg border border-[#22262d] bg-[#14171c] hover:bg-[#1b1f26] hover:border-white/[0.14] transition-colors duration-150 select-none"
                >
                  {/* Card Body */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-zinc-100 truncate group-hover:text-white transition-colors">
                            {engine.name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium uppercase border ${getFamilyBadgeColor(
                              engine.family
                            )}`}
                          >
                            {engine.family}
                          </span>
                          {engine.version && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono bg-black/30 text-zinc-300 border border-[#22262d]">
                              v{engine.version}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Header Action Buttons */}
                      <div className="flex items-center gap-1 opacity-75 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEngine(engine);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors duration-150"
                          title="Edit Engine Details"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEngineToDelete(engine)}
                          className="p-1.5 rounded-md hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors duration-150"
                          title="Delete Engine"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Executable Path Row */}
                    <div className="mt-4 p-2 rounded-md bg-black/40 border border-[#22262d] flex items-center justify-between gap-2">
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
                          className="p-1 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors duration-150"
                          title="Copy Full Executable Path"
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
                          className="p-1 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-blue-400 transition-colors duration-150"
                          title="Open Containing Folder"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Executable Verification Indicator */}
                    {status && (
                      <div
                        className={`mt-3 flex items-center gap-2 p-2 rounded-md text-xs font-mono border ${
                          status.testing
                            ? 'border-[#22262d] bg-black/20 text-zinc-400'
                            : status.valid
                            ? 'border-emerald-800/30 bg-emerald-950/30 text-emerald-300'
                            : 'border-red-800/30 bg-red-950/30 text-red-300'
                        }`}
                      >
                        {status.testing ? (
                          <RotateCw className="h-3.5 w-3.5 animate-spin text-zinc-400 shrink-0" />
                        ) : status.valid ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        )}
                        <span className="truncate">{status.message || 'Status unknown'}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Validation & Edit Links */}
                  <div className="px-5 py-2.5 border-t border-[#22262d] bg-black/20 flex items-center justify-between text-xs text-zinc-400">
                    <button
                      type="button"
                      onClick={() => handleTestEngine(engine)}
                      disabled={status?.testing}
                      className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors duration-150 disabled:opacity-50"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
                      <span>{status?.testing ? 'Testing...' : 'Verify Binary'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEngine(engine);
                        setIsModalOpen(true);
                      }}
                      className="text-zinc-300 hover:text-white font-medium transition-colors duration-150"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-hidden rounded-lg border border-[#22262d] bg-[#14171c]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#22262d] bg-black/30 text-zinc-400 font-medium">
                <tr>
                  <th className="px-4 py-2.5">Source Port</th>
                  <th className="px-4 py-2.5">Family</th>
                  <th className="px-4 py-2.5">Version</th>
                  <th className="px-4 py-2.5">Executable Path</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22262d]">
                {filteredEngines.map((engine) => {
                  const status = validationStatuses[engine.id];
                  return (
                    <tr
                      key={engine.id}
                      className="hover:bg-[#1b1f26] transition-colors duration-150 group"
                    >
                      <td className="px-4 py-2.5 font-medium text-zinc-100">
                        {engine.name}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono uppercase border ${getFamilyBadgeColor(
                            engine.family
                          )}`}
                        >
                          {engine.family}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-zinc-400">
                        {engine.version ? `v${engine.version}` : '-'}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 max-w-xs">
                          <span
                            className="font-mono text-xs text-zinc-400 truncate"
                            title={engine.executable}
                          >
                            {engine.executable}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPath(engine)}
                            className="p-1 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors duration-150 shrink-0"
                            title="Copy Path"
                          >
                            {copiedId === engine.id ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFolder(engine)}
                            className="p-1 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-blue-400 transition-colors duration-150 shrink-0"
                            title="Open Folder"
                          >
                            <FolderOpen className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {status ? (
                          status.testing ? (
                            <span className="inline-flex items-center gap-1 text-zinc-400 font-mono text-[11px]">
                              <RotateCw className="h-3 w-3 animate-spin" /> Testing
                            </span>
                          ) : status.valid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                              <CheckCircle2 className="h-3 w-3" /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-400 font-mono text-[11px]">
                              <AlertCircle className="h-3 w-3" /> Failed
                            </span>
                          )
                        ) : (
                          <span className="text-zinc-500 font-mono text-[11px]">Not verified</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleTestEngine(engine)}
                            disabled={status?.testing}
                            title="Verify Binary"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              setSelectedEngine(engine);
                              setIsModalOpen(true);
                            }}
                            title="Edit Engine"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-zinc-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setEngineToDelete(engine)}
                            title="Delete Engine"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-zinc-400 hover:text-red-400" />
                          </Button>
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

      {/* Add / Edit Engine Modal */}
      <EngineModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEngine(null);
        }}
        onSaved={() => {
          loadEngines();
        }}
        engine={selectedEngine}
      />

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={Boolean(engineToDelete)}
        onClose={() => setEngineToDelete(null)}
        title="Delete Source Port"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEngineToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              onClick={handleConfirmDelete}
            >
              Delete Engine
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-300 leading-relaxed">
          Are you sure you want to remove{' '}
          <span className="font-semibold text-white">{engineToDelete?.name}</span> from registered
          engines? Any profiles using this engine will fail pre-flight validation until reassigned.
        </p>
      </Modal>
    </div>
  );
};
