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
} from 'lucide-react';
import { motion } from 'motion/react';
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
        return 'bg-[#231830] text-[#d8b4fe] border-purple-800/30';
      case 'zandronum':
        return 'bg-[#132232] text-[#93c5fd] border-blue-800/30';
      case 'dsda-doom':
        return 'bg-[#122419] text-[#86efac] border-emerald-800/30';
      case 'woof':
      case 'crispy-doom':
      case 'chocolate-doom':
        return 'bg-[#2b2011] text-[#fde047] border-amber-800/30';
      case 'prboom-plus':
        return 'bg-[#132232] text-[#93c5fd] border-blue-800/30';
      default:
        return 'bg-white/[0.04] text-zinc-300 border-white/[0.08]';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0c0e10] text-zinc-100 select-none">
      {/* Streamlined Single Desktop Toolbar */}
      <div className="border-b border-white/[0.07] bg-[#14171a] px-8 py-3.5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search source ports by name, family, executable..."
              className="w-full rounded-md border border-white/[0.08] bg-black/40 pl-8 pr-16 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-doom-red focus:outline-hidden font-mono"
            />
            <span className="absolute right-2.5 top-2 text-[10px] font-mono text-zinc-500">
              {filteredEngines.length}/{engines.length}
            </span>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5">
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
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 border-t border-white/[0.04] pt-2">
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
                className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#2b1416] text-[#fca5a5] border border-red-800/40 font-semibold'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 border border-white/[0.06]'
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold ${
                      isActive ? 'bg-black/30 text-[#fca5a5]' : 'bg-black/40 text-zinc-500'
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
            <RotateCw className="h-8 w-8 animate-spin text-red-400" />
            <span className="text-sm font-medium text-zinc-400">Scanning registered engines...</span>
          </div>
        ) : filteredEngines.length === 0 ? (
          /* Empty State */
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.08] text-zinc-400 mb-4">
              <Cpu className="h-8 w-8" />
            </div>
            {engines.length === 0 ? (
              <>
                <h3 className="text-lg font-bold text-white tracking-tight">No Source Ports Registered</h3>
                <p className="mt-1 max-w-md text-xs text-zinc-400 leading-relaxed">
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
                <h3 className="text-base font-semibold text-white">No matching engines found</h3>
                <p className="mt-1 text-xs text-zinc-400">
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
          /* Grid of Engine Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredEngines.map((engine) => {
              const status = validationStatuses[engine.id];

              return (
                <motion.div
                  whileTap={{ scale: 0.985 }}
                  transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  key={engine.id}
                  className="group flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#15181c] transition-colors duration-150 hover:border-white/[0.18] hover:bg-[#1a1e24] select-none"
                >
                  {/* Card Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-white truncate group-hover:text-red-400 transition-colors tracking-tight">
                            {engine.name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold uppercase border ${getFamilyBadgeColor(
                              engine.family
                            )}`}
                          >
                            {engine.family}
                          </span>
                          {engine.version && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono bg-white/[0.04] text-zinc-300 border border-white/[0.06]">
                              v{engine.version}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Header Action Buttons */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setSelectedEngine(engine);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded-md hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                          title="Edit Engine Details"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEngineToDelete(engine)}
                          className="p-1.5 rounded-md hover:bg-red-950/40 text-zinc-400 hover:text-red-300 transition-colors"
                          title="Delete Engine"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Executable Path Row */}
                    <div className="mt-4 p-2.5 rounded-lg bg-black/40 border border-white/[0.06] flex items-center justify-between gap-2">
                      <span
                        className="font-mono text-[11px] text-zinc-400 truncate"
                        title={engine.executable}
                      >
                        {engine.executable}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyPath(engine)}
                          className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                          title="Copy Full Executable Path"
                        >
                          {copiedId === engine.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenFolder(engine)}
                          className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-blue-400 transition-colors"
                          title="Open Containing Folder"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Executable Verification Indicator */}
                    {status && (
                      <div
                        className={`mt-3 flex items-center gap-2 p-2 rounded-lg text-xs font-mono border ${
                          status.testing
                            ? 'border-white/[0.08] bg-white/[0.02] text-zinc-400'
                            : status.valid
                            ? 'border-emerald-800/30 bg-[#122419] text-emerald-200'
                            : 'border-red-800/30 bg-[#2b1416] text-red-200'
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
                  <div className="px-5 py-3 border-t border-white/[0.06] bg-black/20 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                    <button
                      onClick={() => handleTestEngine(engine)}
                      disabled={status?.testing}
                      className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
                      <span>{status?.testing ? 'Testing...' : 'Verify Binary'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedEngine(engine);
                        setIsModalOpen(true);
                      }}
                      className="text-zinc-300 hover:text-white font-medium"
                    >
                      Configure →
                    </button>
                  </div>
                </motion.div>
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
