import React, { useState, useEffect, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import {
  Layers,
  Plus,
  Search,
  Star,
  Download,
  Copy,
  Trash2,
  MoreVertical,
  FileUp,
  Flame,
  Cpu,
  Disc,
} from 'lucide-react';
import { Profile, Engine, IWAD, ValidationItem } from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { ProfileEditor } from './ProfileEditor';
import { ImportProfileModal } from './ImportProfileModal';

export const ProfilesView: React.FC = () => {
  const toast = useToast();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [iwads, setIwads] = useState<IWAD[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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
      const [profs, engs, iws] = await Promise.all([
        api.listProfiles(),
        api.listEngines(),
        api.listIWADs(),
      ]);
      setProfiles(profs || []);
      setEngines(engs || []);
      setIwads(iws || []);

      // Auto-select first profile if none selected
      if (profs && profs.length > 0) {
        setSelectedProfileId((prev) => (prev && profs.some((p) => p.id === prev) ? prev : profs[0].id));
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
    <div className="flex h-screen w-full bg-doom-bg overflow-hidden text-doom-text select-none">
      {/* Left Sidebar: Profile Selector & Management */}
      <div className="w-80 md:w-88 xl:w-96 flex flex-col border-r border-doom-border bg-doom-surface/80 shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-doom-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-doom-red fill-doom-red animate-pulse" />
              <h2 className="text-base font-extrabold tracking-wider uppercase text-doom-text">
                Profiles
              </h2>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-doom-card text-doom-muted border border-doom-border">
              {profiles.length} total
            </span>
          </div>

          {/* Action Buttons: New & Import */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New Profile
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              leftIcon={<FileUp className="w-4 h-4 text-doom-muted" />}
            >
              Import YAML
            </Button>
          </div>

          {/* Search & Favorites Toggle */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search profiles..."
                leftIcon={<Search className="w-3.5 h-3.5" />}
                className="py-1.5 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={clsx(
                'p-2 rounded border transition-colors flex items-center justify-center shrink-0',
                showFavoritesOnly
                  ? 'bg-amber-950/70 border-amber-600/70 text-amber-400'
                  : 'bg-doom-surface border-doom-border text-doom-muted hover:text-doom-text hover:border-doom-border-bright'
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
            <div className="p-8 text-center text-xs text-doom-muted flex items-center justify-center gap-2">
              <span className="animate-spin">⚙️</span> Loading profiles...
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="p-6 text-center text-xs text-doom-muted border border-dashed border-doom-border rounded-lg bg-doom-card/30 flex flex-col items-center gap-2">
              <Layers className="w-8 h-8 text-doom-muted" />
              <span>
                {searchQuery || showFavoritesOnly
                  ? 'No profiles match your search criteria.'
                  : 'No profiles created yet.'}
              </span>
              <Button
                variant="secondary"
                size="xs"
                onClick={handleOpenCreateModal}
                leftIcon={<Plus className="w-3 h-3 text-doom-red" />}
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

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProfileId(p.id);
                    setOpenMenuProfileId(null);
                  }}
                  className={clsx(
                    'group relative p-3 rounded-lg border transition-all duration-150 cursor-pointer select-none',
                    isSelected
                      ? 'bg-doom-card border-doom-red ring-1 ring-doom-red shadow-lg shadow-red-950/20'
                      : 'bg-doom-surface hover:bg-doom-card/80 border-doom-border hover:border-doom-border-bright'
                  )}
                >
                  {/* Top Row: Name, Favorite, 3-dots action menu */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(e, p.id)}
                        className="text-zinc-600 hover:text-amber-400 transition-colors shrink-0"
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
                          'text-sm font-bold truncate',
                          isSelected ? 'text-doom-text font-extrabold' : 'text-doom-text'
                        )}
                      >
                        {p.name}
                      </h4>
                    </div>

                    {/* Context Action Menu Trigger */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuProfileId(isMenuOpen ? null : p.id);
                        }}
                        className="p-1 rounded text-doom-muted hover:text-doom-text hover:bg-zinc-800 transition-colors"
                        title="Profile actions"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown Action Menu */}
                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-6 z-30 w-44 bg-doom-surface border border-doom-border rounded-md shadow-2xl py-1 flex flex-col text-xs text-doom-text animate-in fade-in zoom-in-95 duration-100"
                        >
                          <button
                            type="button"
                            onClick={(e) => handleQuickDuplicate(e, p)}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 transition-colors text-left"
                          >
                            <Copy className="w-3.5 h-3.5 text-doom-muted" />
                            Duplicate Profile
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleQuickExport(e, p)}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 transition-colors text-left"
                          >
                            <Download className="w-3.5 h-3.5 text-doom-muted" />
                            Export YAML
                          </button>
                          <div className="h-px bg-doom-border my-1" />
                          <button
                            type="button"
                            onClick={(e) => handleQuickDelete(e, p)}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-red-950/50 text-red-400 transition-colors text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Profile
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metadata Chips: Engine, IWAD, Mods */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {p.engineName ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-cyan-400 flex items-center gap-1 truncate max-w-[120px]">
                        <Cpu className="w-2.5 h-2.5 shrink-0 text-doom-red" />
                        <span className="truncate">{p.engineName}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800 text-amber-400">
                        No Engine
                      </span>
                    )}

                    {p.iwadName ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-blue-400 flex items-center gap-1 truncate max-w-[110px]">
                        <Disc className="w-2.5 h-2.5 shrink-0 text-doom-red" />
                        <span className="truncate">{p.iwadName}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800 text-amber-400">
                        No IWAD
                      </span>
                    )}

                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-doom-muted ml-auto">
                      {modCount > 0 ? `${activeModCount}/${modCount} mods` : '0 mods'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content Pane: Active Profile Editor */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        {activeProfile ? (
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
          <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4 bg-doom-bg">
            <div className="w-16 h-16 rounded-2xl bg-doom-card border border-doom-border flex items-center justify-center text-doom-muted shadow-2xl">
              <Layers className="w-8 h-8 text-doom-red" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-doom-text uppercase tracking-wide">
                No Profile Selected
              </h3>
              <p className="text-sm text-doom-muted max-w-md mt-1">
                Select an existing profile from the sidebar or create a new profile to configure source ports, IWADs, and mod load orders.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleOpenCreateModal}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create New Profile
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsImportModalOpen(true)}
                leftIcon={<FileUp className="w-4 h-4 text-doom-muted" />}
              >
                Import YAML
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Import Profile YAML */}
      <ImportProfileModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* Modal: Create Profile */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-doom-red" />
            Create New Profile
          </span>
        }
        description="Set up a new playable Doom launch configuration."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateProfileSubmit}
              disabled={!newProfileName.trim() || isCreating}
              isLoading={isCreating}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Profile
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Profile Name *"
            placeholder="e.g. Brutal Doom 21, Project Brutality, Vanilla Doom"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            autoFocus
          />

          <Input
            label="Description (Optional)"
            placeholder="Brief summary or gameplay notes..."
            value={newProfileDescription}
            onChange={(e) => setNewProfileDescription(e.target.value)}
          />

          {/* Initial Engine Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-doom-muted uppercase tracking-wider">
              Source Port Engine
            </label>
            <select
              value={newProfileEngineId}
              onChange={(e) => setNewProfileEngineId(e.target.value)}
              className="bg-doom-surface border border-doom-border rounded text-sm text-doom-text px-3 py-2 focus:outline-none focus:ring-1 focus:ring-doom-red"
            >
              <option value="">-- Select Source Port --</option>
              {engines.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name} ({eng.family})
                </option>
              ))}
            </select>
          </div>

          {/* Initial IWAD Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-doom-muted uppercase tracking-wider">
              Base Game IWAD
            </label>
            <select
              value={newProfileIwadId}
              onChange={(e) => setNewProfileIwadId(e.target.value)}
              className="bg-doom-surface border border-doom-border rounded text-sm text-doom-text px-3 py-2 focus:outline-none focus:ring-1 focus:ring-doom-red"
            >
              <option value="">-- Select Game IWAD --</option>
              {iwads.map((iwad) => (
                <option key={iwad.id} value={iwad.id}>
                  {iwad.name} ({iwad.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};
