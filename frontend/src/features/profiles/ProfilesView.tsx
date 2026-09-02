import React, { useState, useEffect, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import {
  Layers,
  Plus,
  Search,
  Star,
  Copy,
  Trash2,
  MoreVertical,
  FileUp,
  Flame,
  Cpu,
  Disc,
  RotateCw,
} from 'lucide-react';
import { Profile, Engine, IWAD, ValidationItem, Settings } from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { ProfileEditor } from './ProfileEditor';
import { ImportProfileModal } from './ImportProfileModal';
export interface ProfilesViewProps {
  selectedProfileId?: string | null;
  onSelectProfile?: (id: string | null) => void;
  onNavigateToLibrary?: () => void;
  onNavigateToSettings?: (tab?: string) => void;
  onScanRequested?: () => void;
}

export const ProfilesView: React.FC<ProfilesViewProps> = ({
  selectedProfileId: propSelectedProfileId,
  onSelectProfile,
  onNavigateToLibrary,
  onNavigateToSettings,
  onScanRequested,
}) => {
  const toast = useToast();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [iwads, setIwads] = useState<IWAD[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    propSelectedProfileId ?? null
  );
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importModalFormat, setImportModalFormat] = useState<'yaml' | 'zdl'>('yaml');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [newProfileEngineId, setNewProfileEngineId] = useState('');
  const [newProfileIwadId, setNewProfileIwadId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Action Menu Open Dropdown
  const [openMenuProfileId, setOpenMenuProfileId] = useState<string | null>(null);

  // Load all initial data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profs, engs, iws, stgs] = await Promise.all([
        api.listProfiles(),
        api.listEngines(),
        api.listIWADs(),
        api.getSettings().catch(() => null),
      ]);
      setProfiles(profs || []);
      setEngines(engs || []);
      setIwads(iws || []);
      if (stgs) setSettings(stgs);
      if (profs && profs.length > 0) {
        setSelectedProfileId((prev) => {
          const next = propSelectedProfileId || (prev && profs.some((p) => p.id === prev) ? prev : profs[0].id);
          onSelectProfile?.(next);
          return next;
        });
      }
    } catch (err: unknown) {
      console.error('Failed to load profiles data:', err);
      toast.error('Data Load Error', 'Could not fetch profiles from backend');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  useEffect(() => {
    if (propSelectedProfileId !== undefined && propSelectedProfileId !== selectedProfileId) {
      setSelectedProfileId(propSelectedProfileId);
    }
  }, [propSelectedProfileId, selectedProfileId]);

  const handleSelectPreset = (id: string) => {
    setSelectedProfileId(id);
    onSelectProfile?.(id);
  };

  const handleAutoDetect = async () => {
    setIsAutoDetecting(true);
    try {
      if (onScanRequested) {
        onScanRequested();
      } else {
        await api.startScan();
      }
      toast.info('Auto-Detection Started', 'Scanning system paths for Doom engines and IWADs...');
      setTimeout(() => {
        loadData();
        setIsAutoDetecting(false);
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      toast.error('Scan Error', msg);
      setIsAutoDetecting(false);
    }
  };
  // Filtered profile list
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchesSearch =
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.engineName && p.engineName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.iwadName && p.iwadName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFav = !showFavoritesOnly || p.isFavorite;

      return matchesSearch && matchesFav;
    });
  }, [profiles, searchQuery, showFavoritesOnly]);

  // Currently selected profile object
  const activeProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedProfileId) || null;
  }, [profiles, selectedProfileId]);

  // Handle Profile Update from Editor
  const handleProfileChange = (updated: Profile) => {
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  // Handle Profile Delete
  const handleProfileDeleted = (deletedId: string) => {
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== deletedId);
      if (selectedProfileId === deletedId) {
        setSelectedProfileId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  // Handle Profile Duplicate
  const handleProfileDuplicated = (duplicated: Profile) => {
    setProfiles((prev) => [duplicated, ...prev]);
    setSelectedProfileId(duplicated.id);
  };

  // Handle Favorite Toggle from list
  const handleToggleFavorite = async (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    try {
      await api.toggleProfileFavorite(profileId);
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, isFavorite: !p.isFavorite } : p))
      );
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // Handle Quick Actions from Sidebar Context Menu
  const handleQuickDuplicate = async (e: React.MouseEvent, p: Profile) => {
    e.stopPropagation();
    setOpenMenuProfileId(null);
    try {
      const newName = `${p.name} (Copy)`;
      const dup = await api.duplicateProfile(p.id, newName);
      toast.success('Profile Duplicated', `Created "${newName}"`);
      handleProfileDuplicated(dup);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Duplicate failed';
      toast.error('Duplicate Failed', msg);
    }
  };

  const handleQuickExport = async (e: React.MouseEvent, p: Profile) => {
    e.stopPropagation();
    setOpenMenuProfileId(null);
    try {
      const yamlStr = await api.exportProfileYAML(p.id);
      await navigator.clipboard.writeText(yamlStr);
      toast.success('YAML Exported', `Copied specification for "${p.name}" to clipboard`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast.error('Export Failed', msg);
    }
  };

  const handleQuickDelete = async (e: React.MouseEvent, p: Profile) => {
    e.stopPropagation();
    setOpenMenuProfileId(null);
    if (window.confirm(`Delete profile "${p.name}"? This cannot be undone.`)) {
      try {
        await api.deleteProfile(p.id);
        toast.info('Profile Deleted', `Deleted "${p.name}"`);
        handleProfileDeleted(p.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Delete failed';
        toast.error('Delete Failed', msg);
      }
    }
  };

  // Handle Create Profile
  const handleOpenCreateModal = () => {
    setNewProfileName('');
    setNewProfileDescription('');
    setNewProfileEngineId(engines.length > 0 ? engines[0].id : '');
    setNewProfileIwadId(iwads.length > 0 ? iwads[0].id : '');
    setIsCreateModalOpen(true);
  };

  const handleCreateProfileSubmit = async () => {
    if (!newProfileName.trim()) {
      toast.error('Name Required', 'Please enter a name for the profile');
      return;
    }

    const selectedEng = engines.find((e) => e.id === newProfileEngineId);
    const selectedIw = iwads.find((w) => w.id === newProfileIwadId);

    setIsCreating(true);
    try {
      const created = await api.createProfile({
        name: newProfileName.trim(),
        description: newProfileDescription.trim(),
        engineId: newProfileEngineId,
        engineName: selectedEng?.name || '',
        iwadId: newProfileIwadId,
        iwadName: selectedIw?.name || '',
        mods: [],
        arguments: [],
        workingDir: '',
        isFavorite: false,
      });

      setProfiles((prev) => [created, ...prev]);
      setSelectedProfileId(created.id);
      setIsCreateModalOpen(false);
      toast.success('Profile Created', `Created "${created.name}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create profile';
      toast.error('Create Error', msg);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Import YAML Success
  const handleImportSuccess = (imported: Profile, _warnings: ValidationItem[]) => {
    setProfiles((prev) => [imported, ...prev]);
    setSelectedProfileId(imported.id);
  };

  return (
    <div className="flex h-full w-full bg-[#0c0e10] overflow-hidden text-zinc-100 select-none">
      {/* Left Sidebar: Profile Selector & Management */}
      <div className="w-80 md:w-88 xl:w-96 flex flex-col border-r border-white/[0.07] bg-[#14171a] shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/[0.07] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-500 fill-red-500" />
              <h2 className="text-base font-bold tracking-tight uppercase text-white">
                Presets
              </h2>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-zinc-400 border border-white/[0.08]">
              {profiles.length} total
            </span>
          </div>

          {/* Action Buttons: New & Import */}
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
              className="font-bold tracking-wide"
            >
              + New Setup
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => {
                  setImportModalFormat('yaml');
                  setIsImportModalOpen(true);
                }}
                leftIcon={<FileUp className="w-3.5 h-3.5 text-zinc-400" />}
              >
                Import YAML
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => {
                  setImportModalFormat('zdl');
                  setIsImportModalOpen(true);
                }}
                leftIcon={<FileUp className="w-3.5 h-3.5 text-zinc-400" />}
              >
                Import .zdl
              </Button>
            </div>
          </div>

          {/* Search & Favorites Toggle */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search profiles..."
                leftIcon={<Search className="w-3.5 h-3.5 text-zinc-400" />}
                className="py-1.5 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={clsx(
                'p-2 rounded-lg border transition-colors flex items-center justify-center shrink-0',
                showFavoritesOnly
                  ? 'bg-[#2b2011] border-amber-800/40 text-amber-400'
                  : 'bg-black/30 border-white/[0.08] text-zinc-400 hover:text-white'
              )}
              title={showFavoritesOnly ? 'Show all profiles' : 'Show favorites only'}
            >
              <Star
                className={clsx(
                  'w-4 h-4',
                  showFavoritesOnly && 'fill-amber-400'
                )}
              />
            </button>
          </div>
        </div>

        {/* Profile List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
              Loading profiles...
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400 border border-dashed border-white/[0.1] rounded-xl bg-black/20 flex flex-col items-center gap-2">
              <Layers className="w-8 h-8 text-zinc-500" />
              <span>
                {searchQuery || showFavoritesOnly
                  ? 'No profiles match your search criteria.'
                  : 'No profiles created yet.'}
              </span>
              <Button
                variant="secondary"
                size="xs"
                onClick={handleOpenCreateModal}
                leftIcon={<Plus className="w-3 h-3 text-red-400" />}
                className="mt-1"
              >
                Create First Profile
              </Button>
            </div>
          ) : (
            filteredProfiles.map((p) => {
              const isSelected = p.id === selectedProfileId;
              const isMenuOpen = openMenuProfileId === p.id;
              const modCount = p.mods ? p.mods.length : 0;
              const activeModCount = p.mods ? p.mods.filter((m) => m.enabled).length : 0;

              const isCompact = settings?.uiDensity === 'compact';
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    handleSelectPreset(p.id);
                    setOpenMenuProfileId(null);
                  }}
                  className={clsx(
                    'group relative rounded-xl border transition-colors cursor-pointer select-none',
                    isCompact ? 'p-2.5' : 'p-3',
                    isSelected
                      ? 'bg-[#1a1e24] border-red-500/80'
                      : 'bg-[#15181c] hover:bg-[#1a1d22] border-white/[0.08]'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(e, p.id)}
                        className="text-zinc-500 hover:text-amber-400 transition-colors shrink-0"
                        title={p.isFavorite ? 'Unfavorite' : 'Favorite'}
                      >
                        <Star
                          className={clsx(
                            'w-4 h-4',
                            p.isFavorite
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-zinc-600 hover:text-amber-400'
                          )}
                        />
                      </button>
                      <h4
                        className={clsx(
                          'text-xs font-bold truncate tracking-tight',
                          isSelected ? 'text-white' : 'text-zinc-200 group-hover:text-white'
                        )}
                      >
                        {p.name}
                      </h4>
                    </div>

                    {/* Context Action Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuProfileId(isMenuOpen ? null : p.id);
                        }}
                        className="p-1 text-zinc-500 hover:text-white rounded hover:bg-white/[0.06] transition-colors"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {isMenuOpen && (
                        <div
                          className="absolute right-0 top-6 z-40 w-36 rounded-lg bg-[#15181c] border border-white/[0.08] shadow-xl py-1 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleQuickDuplicate(e, p)}
                            className="w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-white/[0.06] hover:text-white flex items-center gap-2"
                          >
                            <Copy className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Duplicate</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleQuickExport(e, p)}
                            className="w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-white/[0.06] hover:text-white flex items-center gap-2"
                          >
                            <FileUp className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Export YAML</span>
                          </button>
                          <div className="my-1 border-t border-white/[0.06]" />
                          <button
                            type="button"
                            onClick={(e) => handleQuickDelete(e, p)}
                            className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-red-950/40 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Profile Metadata Spec Badges */}
                  <div className="mt-2 flex flex-col gap-1 text-[11px] font-mono">
                    <div className="flex items-center gap-1 text-zinc-400 truncate">
                      <Cpu className="w-3 h-3 text-blue-400 shrink-0" />
                      <span className="truncate">{p.engineName || 'No Engine Assigned'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-zinc-400 truncate">
                      <Disc className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">{p.iwadName || 'No IWAD Assigned'}</span>
                    </div>
                  </div>

                  {/* Mod count tag */}
                  <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-white/[0.04] pt-1.5">
                    <span>
                      {activeModCount}/{modCount} mods active
                    </span>
                    {p.isolateSaves && (
                      <span className="text-amber-400">ISOLATED SAVES</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Detail Pane: Profile Editor Component */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {engines.length === 0 && iwads.length === 0 && !isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto select-none">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center mb-5 shadow-lg shadow-red-950/40 border border-red-500/30">
              <Flame className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mb-2">
              Welcome to RNT Launcher - Let's find your Doom games
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Scan your computer to automatically discover installed source ports (GZDoom, PRBoom+, DSDA-Doom, Woof) and base game IWADs (DOOM, DOOM II, Final Doom).
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              <Button
                variant="primary"
                size="md"
                onClick={handleAutoDetect}
                isLoading={isAutoDetecting}
                leftIcon={<RotateCw className={clsx('w-4 h-4', isAutoDetecting && 'animate-spin')} />}
                className="font-bold tracking-wide px-6"
              >
                {isAutoDetecting ? 'Auto-Detecting Games...' : 'Auto-Detect Installed Games & Ports'}
              </Button>
            </div>
            <div className="mt-5 flex items-center gap-3 text-xs text-zinc-500">
              <span>Or add manually:</span>
              <button
                type="button"
                onClick={() => onNavigateToSettings?.('engines')}
                className="text-zinc-300 hover:text-white underline underline-offset-2"
              >
                Add Source Port
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => onNavigateToSettings?.('iwads')}
                className="text-zinc-300 hover:text-white underline underline-offset-2"
              >
                Add Base IWAD
              </button>
            </div>
          </div>
        ) : activeProfile ? (
          <ProfileEditor
            key={activeProfile.id}
            profile={activeProfile}
            engines={engines}
            iwads={iwads}
            onProfileChange={handleProfileChange}
            onProfileDeleted={handleProfileDeleted}
            onProfileDuplicated={handleProfileDuplicated}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 gap-3">
            <Layers className="w-12 h-12 text-zinc-600" />
            <h3 className="text-base font-semibold text-zinc-300">No Setup Selected</h3>
            <p className="text-xs max-w-sm">
              Select a preset configuration from the left list to configure its engine, base IWAD, and mod load order.
            </p>
            <div className="flex items-center gap-2.5">
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreateModal}
                leftIcon={<Plus className="w-4 h-4" />}
                className="font-bold tracking-wide"
              >
                + New Setup
              </Button>
              {onNavigateToLibrary && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onNavigateToLibrary}
                >
                  Browse Mod Collection
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Profile Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Launch Profile"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateProfileSubmit}
              isLoading={isCreating}
            >
              Create Profile
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Profile Name *"
            placeholder="e.g. Brutal Doom + Metal Soundtrack"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
          />

          <Input
            label="Description / Notes (Optional)"
            placeholder="e.g. Hardcore gameplay mod with modern graphics renderer"
            value={newProfileDescription}
            onChange={(e) => setNewProfileDescription(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
              Default Source Port
            </label>
            <select
              value={newProfileEngineId}
              onChange={(e) => setNewProfileEngineId(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-doom-red font-medium"
            >
              <option value="">-- Select Engine --</option>
              {engines.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.family})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
              Default Base Game IWAD
            </label>
            <select
              value={newProfileIwadId}
              onChange={(e) => setNewProfileIwadId(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-doom-red font-medium"
            >
              <option value="">-- Select IWAD --</option>
              {iwads.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <ImportProfileModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        initialFormat={importModalFormat}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
};
