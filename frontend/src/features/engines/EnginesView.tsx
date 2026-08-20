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
  Terminal,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { Engine, EngineFamily } from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { EngineModal } from './EngineModal';
import { formatDate } from '../../utils/formatters';

const FAMILY_TABS: { id: string; label: string; family?: EngineFamily }[] = [
  { id: 'all', label: 'All Engines' },
  { id: 'gzdoom', label: 'GZDoom', family: 'gzdoom' },
  { id: 'zandronum', label: 'Zandronum', family: 'zandronum' },
  { id: 'dsda-doom', label: 'DSDA-Doom', family: 'dsda-doom' },
  { id: 'woof', label: 'Woof!', family: 'woof' },
  { id: 'crispy-doom', label: 'Crispy Doom', family: 'crispy-doom' },
  { id: 'chocolate-doom', label: 'Chocolate Doom', family: 'chocolate-doom' },
  { id: 'prboom-plus', label: 'PrBoom+', family: 'prboom-plus' },
  { id: 'other', label: 'Other', family: 'other' },
];

export const EnginesView: React.FC = () => {
  const toast = useToast();

  const [engines, setEngines] = useState<Engine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFamilyTab, setActiveFamilyTab] = useState('all');

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
      setEngines((prev) => prev.filter((e) => e.id !== engineToDelete.id));
      toast.success('Engine Removed', `"${engineToDelete.name}" was deleted.`);
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
        const matchesVersion = engine.version.toLowerCase().includes(q);
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
        return 'bg-purple-950/60 text-purple-300 border-purple-600/50';
      case 'zandronum':
        return 'bg-blue-950/60 text-blue-300 border-blue-600/50';
      case 'dsda-doom':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-600/50';
      case 'woof':
        return 'bg-amber-950/60 text-amber-300 border-amber-600/50';
      case 'crispy-doom':
        return 'bg-orange-950/60 text-orange-300 border-orange-600/50';
      case 'chocolate-doom':
        return 'bg-yellow-950/60 text-yellow-300 border-yellow-600/50';
      case 'prboom-plus':
        return 'bg-cyan-950/60 text-cyan-300 border-cyan-600/50';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-600';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-doom-bg text-doom-text">
      {/* Header Bar */}
      <div className="border-b border-doom-border bg-doom-surface px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-doom-red/20 text-doom-red border border-doom-red/40 shadow-inner">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black uppercase tracking-wider text-zinc-100">
                    Source Ports & Engines
                  </h1>
                  <span className="rounded-full bg-doom-card px-2.5 py-0.5 text-xs font-mono font-semibold text-doom-muted border border-doom-border">
                    {engines.length} Registered
                  </span>
                </div>
                <p className="text-xs text-doom-muted mt-0.5">
                  Manage Doom executables (GZDoom, DSDA-Doom, Woof, Crispy Doom, Chocolate Doom, etc.)
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadEngines}
              isLoading={isLoading}
              leftIcon={<RotateCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setSelectedEngine(null);
                setIsModalOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Source Port
            </Button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Family Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {FAMILY_TABS.map((tab) => {
              const count =
                tab.id === 'all'
                  ? engines.length
                  : engines.filter((e) => e.family === tab.family).length;
              const isActive = activeFamilyTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFamilyTab(tab.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-doom-red text-white shadow-md shadow-red-950/40'
                      : 'bg-doom-card hover:bg-zinc-800 text-zinc-300 border border-doom-border'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold ${
                        isActive ? 'bg-black/30 text-white' : 'bg-zinc-900 text-doom-muted'
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
              placeholder="Search engines, versions, paths..."
              leftIcon={<Search className="h-4 w-4 text-doom-muted" />}
              className="text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <RotateCw className="h-8 w-8 animate-spin text-doom-red" />
            <span className="text-sm font-medium text-doom-muted">Scanning registered engines...</span>
          </div>
        ) : filteredEngines.length === 0 ? (
          /* Empty State */
          <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed border-doom-border bg-doom-surface/40 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 border border-doom-border text-zinc-500 mb-4">
              <Cpu className="h-8 w-8" />
            </div>
            {engines.length === 0 ? (
              <>
                <h3 className="text-lg font-bold text-zinc-200">No Source Ports Registered</h3>
                <p className="mt-1 max-w-md text-xs text-doom-muted">
                  Register your installed Doom engine executables (such as GZDoom, DSDA-Doom, or Woof) to
                  start creating profiles and launching mods.
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="md"
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
                <h3 className="text-base font-semibold text-zinc-200">No matching engines found</h3>
                <p className="mt-1 text-xs text-doom-muted">
                  Try clearing your search query or switching to &ldquo;All Engines&rdquo;.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFamilyTab('all');
                  }}
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              </>
            )}
          </div>
        ) : (
          /* Engine Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredEngines.map((engine) => {
              const status = validationStatuses[engine.id];
              const isPK3 = engine.family === 'gzdoom' || engine.family === 'zandronum';

              return (
                <div
                  key={engine.id}
                  className="group flex flex-col justify-between rounded-lg border border-doom-border bg-doom-card hover:border-doom-border-bright transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-black/40"
                >
                  {/* Card Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-zinc-100 truncate group-hover:text-doom-red transition-colors">
                            {engine.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${getFamilyBadgeColor(
                              engine.family
                            )}`}
                          >
                            {engine.family.toUpperCase()}
                          </span>
                          {engine.version && engine.version !== 'Unknown' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800/80 text-zinc-300 border border-zinc-700">
                              v{engine.version}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${
                              isPK3
                                ? 'bg-purple-950/30 text-purple-300 border-purple-800/40'
                                : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50'
                            }`}
                          >
                            {isPK3 ? 'PK3/PK7 Support' : 'WAD Only'}
                          </span>
                        </div>
                      </div>

                      {/* Quick Actions Dropdown / Buttons */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setSelectedEngine(engine);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                          title="Edit Engine"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEngineToDelete(engine)}
                          className="p-1.5 rounded hover:bg-red-950/60 text-zinc-400 hover:text-red-400 transition-colors"
                          title="Delete Engine"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Executable Path Strip */}
                    <div className="mt-4 p-2.5 rounded bg-doom-surface/90 border border-doom-border text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Terminal className="h-3.5 w-3.5 text-doom-muted shrink-0" />
                        <span className="font-mono text-[11px] text-zinc-300 truncate" title={engine.executable}>
                          {engine.executable}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyPath(engine)}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                          title="Copy Full Path"
                        >
                          {copiedId === engine.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenFolder(engine)}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-doom-amber transition-colors"
                          title="Open in Explorer"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Test Feedback if triggered */}
                    {status && (
                      <div className="mt-2.5 px-2.5 py-1.5 rounded text-xs flex items-center gap-2 border bg-zinc-900/80 border-zinc-800">
                        {status.testing ? (
                          <span className="flex items-center gap-1.5 text-doom-muted">
                            <RotateCw className="h-3.5 w-3.5 animate-spin text-doom-amber" />
                            Validating executable...
                          </span>
                        ) : status.valid ? (
                          <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Executable verified & runnable
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-red-400 font-mono text-[11px] truncate">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {status.message}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="px-5 py-3 bg-doom-surface/50 border-t border-doom-border/80 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] text-doom-muted">
                      {engine.updatedAt ? `Updated ${formatDate(engine.updatedAt)}` : 'Ready'}
                    </span>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleTestEngine(engine)}
                        isLoading={status?.testing}
                        leftIcon={<ShieldCheck className="h-3.5 w-3.5 text-doom-green" />}
                      >
                        Test Executable
                      </Button>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          setSelectedEngine(engine);
                          setIsModalOpen(true);
                        }}
                        leftIcon={<Edit2 className="h-3.5 w-3.5" />}
                      >
                        Edit
                      </Button>
                    </div>
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
          loadEngines();
        }}
        engine={selectedEngine}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(engineToDelete)}
        onClose={() => setEngineToDelete(null)}
        title={
          <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider">
            <ShieldAlert className="h-5 w-5" />
            <span>Delete Source Port</span>
          </div>
        }
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-zinc-300">
            Are you sure you want to delete <strong className="text-white">&ldquo;{engineToDelete?.name}&rdquo;</strong>?
          </p>
          <div className="p-3 bg-red-950/30 border border-red-900/50 rounded text-xs text-red-300">
            Profiles configured to use this engine will show validation warnings until reassigned.
          </div>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-doom-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEngineToDelete(null)}
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
              Delete Engine
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
