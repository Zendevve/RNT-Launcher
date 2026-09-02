import React, { useState, useEffect, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Download,
  Trash2,
  Star,
  Cpu,
  Disc,
  FolderOpen,
  FolderLock,
  Terminal,
  ChevronDown,
  ChevronUp,
  Save,
  Layers,
  Sliders,
} from 'lucide-react';
import {
  Profile,
  ProfileMod,
  Engine,
  IWAD,
  Mod,
  ValidationResult,
} from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { LoadOrderList } from './LoadOrderList';
import { ValidationBanner } from './ValidationBanner';
import { SelectModsModal } from './SelectModsModal';
import { DmFlagsModal } from './DmFlagsModal';

export interface ProfileEditorProps {
  profile: Profile;
  engines: Engine[];
  iwads: IWAD[];
  onProfileChange: (updated: Profile) => void;
  onProfileDeleted: (profileId: string) => void;
  onProfileDuplicated: (duplicated: Profile) => void;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({
  profile,
  engines,
  iwads,
  onProfileChange,
  onProfileDeleted,
  onProfileDuplicated,
}) => {
  const toast = useToast();

  // Local editable form state
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description || '');
  const [engineId, setEngineId] = useState(profile.engineId || '');
  const [iwadId, setIwadId] = useState(profile.iwadId || '');
  const [parentProfileId, setParentProfileId] = useState(
    profile.parentProfileId || profile.parent_profile_id || ''
  );
  const [isolateSaves, setIsolateSaves] = useState(
    Boolean(profile.isolateSaves ?? profile.isolate_saves ?? false)
  );
  const [mods, setMods] = useState<ProfileMod[]>(profile.mods || []);
  const [argumentsText, setArgumentsText] = useState(
    (profile.arguments || []).join(' ')
  );
  const [workingDir, setWorkingDir] = useState(profile.workingDir || '');
  const [isFavorite, setIsFavorite] = useState(profile.isFavorite || false);

  // Available profiles list for base mixin selector
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Advanced section accordion
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(
    Boolean(
      profile.workingDir ||
        (profile.arguments && profile.arguments.length > 0) ||
        profile.isolateSaves ||
        profile.parentProfileId
    )
  );

  // Mod selection modal
  const [isSelectModsOpen, setIsSelectModsOpen] = useState(false);
  const [isDmFlagsOpen, setIsDmFlagsOpen] = useState(false);

  // Validation state
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Launch state
  const [isLaunching, setIsLaunching] = useState(false);

  // Dirty state tracking & saving
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch available profiles for parent mixin dropdown
  const loadProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    try {
      const list = await api.listProfiles();
      setAvailableProfiles(list || []);
    } catch (err) {
      console.error('Failed to load profiles for base mixin selector:', err);
    } finally {
      setIsLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Update local state when incoming profile prop changes
  useEffect(() => {
    setName(profile.name);
    setDescription(profile.description || '');
    setEngineId(profile.engineId || '');
    setIwadId(profile.iwadId || '');
    setParentProfileId(profile.parentProfileId || profile.parent_profile_id || '');
    setIsolateSaves(Boolean(profile.isolateSaves ?? profile.isolate_saves ?? false));
    setMods(profile.mods || []);
    setArgumentsText((profile.arguments || []).join(' '));
    setWorkingDir(profile.workingDir || '');
    setIsFavorite(profile.isFavorite || false);
    setHasUnsavedChanges(false);
  }, [
    profile.id,
    profile.name,
    profile.engineId,
    profile.iwadId,
    profile.parentProfileId,
    profile.parent_profile_id,
    profile.isolateSaves,
    profile.isolate_saves,
    profile.updatedAt,
    profile.updated_at,
  ]);

  // Eligible parent profiles (exclude self to prevent cyclic dependency)
  const eligibleParentProfiles = useMemo(() => {
    return availableProfiles.filter((p) => p.id !== profile.id);
  }, [availableProfiles, profile.id]);

  // Currently selected parent profile object
  const selectedParentProfile = useMemo(() => {
    if (!parentProfileId) return null;
    return availableProfiles.find((p) => p.id === parentProfileId) || null;
  }, [availableProfiles, parentProfileId]);

  // Split arguments into tokens for visual badge display
  const parsedArguments = useMemo(() => {
    if (!argumentsText.trim()) return [];
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    const tokens: string[] = [];
    let match;
    while ((match = regex.exec(argumentsText)) !== null) {
      tokens.push(match[1] || match[2] || match[0]);
    }
    return tokens;
  }, [argumentsText]);

  // Run validation
  const runValidation = useCallback(async () => {
    if (!profile.id) return;
    setIsValidating(true);
    try {
      const result = await api.validateProfile(profile.id);
      setValidation(result);
    } catch (err) {
      console.error('Failed to validate profile:', err);
    } finally {
      setIsValidating(false);
    }
  }, [profile.id]);

  // Initial validation when profile loads or dependencies change
  useEffect(() => {
    runValidation();
  }, [
    profile.id,
    profile.engineId,
    profile.iwadId,
    profile.mods,
    profile.parentProfileId,
    runValidation,
  ]);

  // Unified save handler
  const handleSave = async (overrideData?: Partial<Profile>) => {
    setIsSaving(true);
    const updatedProfile: Profile = {
      ...profile,
      name: name.trim() || 'Untitled Profile',
      description: description.trim(),
      engineId,
      engineName: engines.find((e) => e.id === engineId)?.name || '',
      iwadId,
      iwadName: iwads.find((w) => w.id === iwadId)?.name || '',
      parentProfileId: parentProfileId || undefined,
      isolateSaves,
      mods,
      arguments: parsedArguments,
      workingDir: workingDir.trim(),
      isFavorite,
      ...overrideData,
    };

    try {
      await api.updateProfile(updatedProfile);
      setHasUnsavedChanges(false);
      onProfileChange(updatedProfile);
      runValidation();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile';
      toast.error('Save Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setHasUnsavedChanges(true);
  };

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    setHasUnsavedChanges(true);
  };

  const handleEngineSelect = (newEngineId: string) => {
    setEngineId(newEngineId);
    const selected = engines.find((e) => e.id === newEngineId);
    handleSave({ engineId: newEngineId, engineName: selected?.name || '' });
  };

  const handleIWADSelect = (newIwadId: string) => {
    setIwadId(newIwadId);
    const selected = iwads.find((w) => w.id === newIwadId);
    handleSave({ iwadId: newIwadId, iwadName: selected?.name || '' });
  };

  const handleParentProfileSelect = (newParentId: string) => {
    setParentProfileId(newParentId);
    handleSave({
      parentProfileId: newParentId,
    });
  };

  const handleToggleIsolateSaves = (checked: boolean) => {
    setIsolateSaves(checked);
    handleSave({
      isolateSaves: checked,
    });
  };

  const handleOpenSaveFolder = async () => {
    try {
      await api.openProfileSaveFolder(profile.id);
      toast.info('Save Folder', 'Opened profile saves folder in file explorer');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to open save folder';
      toast.error('Save Folder Error', msg);
    }
  };

  const handleFavoriteToggle = async () => {
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await api.toggleProfileFavorite(profile.id);
      onProfileChange({ ...profile, isFavorite: next });
      toast.info(next ? 'Added to favorites' : 'Removed from favorites');
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // Mod Load Order handlers
  const handleModsReorder = (newOrderedMods: ProfileMod[]) => {
    setMods(newOrderedMods);
    const modIds = newOrderedMods.map((m) => m.modId);
    api
      .reorderProfileMods(profile.id, modIds)
      .then(() => {
        handleSave({ mods: newOrderedMods });
      })
      .catch((err) => {
        console.error('Failed to reorder mods:', err);
        handleSave({ mods: newOrderedMods });
      });
  };

  const handleToggleMod = (modId: string, enabled: boolean) => {
    const updated = mods.map((m) => (m.modId === modId ? { ...m, enabled } : m));
    setMods(updated);
    api
      .toggleProfileMod(profile.id, modId, enabled)
      .then(() => {
        handleSave({ mods: updated });
      })
      .catch((err) => {
        console.error('Failed to toggle mod:', err);
        handleSave({ mods: updated });
      });
  };

  const handleRemoveMod = (modId: string) => {
    const updated = mods
      .filter((m) => m.modId !== modId)
      .map((m, idx) => ({ ...m, order: idx }));
    setMods(updated);
    api
      .removeModFromProfile(profile.id, modId)
      .then(() => {
        handleSave({ mods: updated });
        toast.info('Mod removed from load order');
      })
      .catch((err) => {
        console.error('Failed to remove mod:', err);
        handleSave({ mods: updated });
      });
  };

  const handleAddMods = async (selectedMods: Mod[]) => {
    const startIndex = mods.length;
    const newProfileMods: ProfileMod[] = selectedMods.map((m, idx) => ({
      id: `${profile.id}-${m.id}`,
      profileId: profile.id,
      modId: m.id,
      modName: m.name,
      modPath: m.path,
      modFormat: m.format,
      enabled: true,
      order: startIndex + idx,
    }));

    const combined = [...mods, ...newProfileMods];
    setMods(combined);

    try {
      for (const m of selectedMods) {
        await api.addModToProfile(profile.id, m.id);
      }
      await handleSave({ mods: combined });
      toast.success(
        'Mods Added',
        `Added ${selectedMods.length} mod(s) to ${profile.name}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add mods';
      toast.error('Add Mods Error', msg);
    }
  };

  const handleToggleAllMods = (enabled: boolean) => {
    const updated = mods.map((m) => ({ ...m, enabled }));
    setMods(updated);
    handleSave({ mods: updated });
  };

  const handleClearAllMods = () => {
    setMods([]);
    handleSave({ mods: [] });
    toast.info('Cleared all mods from profile');
  };

  const handleApplyDmFlags = (newTokens: string[]) => {
    const currentTokens = argumentsText.trim() ? argumentsText.trim().split(/\s+/) : [];
    const filtered: string[] = [];
    for (let i = 0; i < currentTokens.length; i++) {
      const tok = currentTokens[i];
      if (tok === '+set' && i + 1 < currentTokens.length) {
        const next = currentTokens[i + 1].toLowerCase();
        if (['dmflags', 'dmflags2', 'compatflags', 'compatflags2'].includes(next)) {
          i += 2;
          continue;
        }
      }
      filtered.push(tok);
    }
    const combinedTokens = [...filtered, ...newTokens];
    const combinedStr = combinedTokens.join(' ');
    setArgumentsText(combinedStr);
    handleSave({ arguments: combinedTokens });
    toast.success('Flags Applied', 'Updated profile custom launch arguments');
  };

  // Browse Directory for Working Dir
  const handleBrowseWorkingDir = async () => {
    try {
      const selected = await api.openDirectoryDialog(
        'Select Working Directory',
        workingDir
      );
      if (selected) {
        setWorkingDir(selected);
        handleSave({ workingDir: selected });
      }
    } catch (err) {
      console.error('Failed to open directory dialog:', err);
    }
  };

  // Export YAML
  const handleExportYAML = async () => {
    try {
      const yamlStr = await api.exportProfileYAML(profile.id);
      await navigator.clipboard.writeText(yamlStr);
      toast.success(
        'YAML Exported',
        'Profile specification copied to clipboard!'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast.error('Export Failed', msg);
    }
  };

  // Duplicate Profile
  const handleDuplicate = async () => {
    try {
      const newName = `${profile.name} (Copy)`;
      const dup = await api.duplicateProfile(profile.id, newName);
      toast.success('Profile Duplicated', `Created "${dup.name}"`);
      onProfileDuplicated(dup);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Duplicate failed';
      toast.error('Duplicate Failed', msg);
    }
  };

  // Delete Profile
  const handleDelete = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete profile "${profile.name}"? This action cannot be undone.`
      )
    ) {
      try {
        await api.deleteProfile(profile.id);
        toast.info('Profile Deleted', `Deleted "${profile.name}"`);
        onProfileDeleted(profile.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Delete failed';
        toast.error('Delete Failed', msg);
      }
    }
  };

  // Launch Game Execution
  const handleLaunch = async () => {
    if (validation?.status === 'CANNOT_LAUNCH') {
      toast.error(
        'Cannot Launch',
        'Please resolve pre-launch validation errors before launching.'
      );
      return;
    }

    setIsLaunching(true);
    try {
      toast.info('Launching Game', `Starting "${profile.name}"...`);
      const record = await api.launchProfile(profile.id);
      if (record.status === 'success' || (record.exitCode !== undefined && record.exitCode === 0)) {
        toast.success(
          'Game Exited',
          `Session finished successfully (${Math.round((record.durationMs || 0) / 1000)}s).`
        );
      } else {
        toast.warning(
          'Game Exited',
          `Process exited with code ${record.exitCode ?? 0}`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to launch profile';
      toast.error('Launch Failed', msg);
    } finally {
      setIsLaunching(false);
    }
  };

  const selectedEngineObj = engines.find((e) => e.id === engineId);
  const selectedIWADObj = iwads.find((w) => w.id === iwadId);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 md:p-8 gap-6 bg-[#0c0e10] select-none">
      {/* Top Action Cockpit Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
        {/* Profile Identity & Title */}
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={handleFavoriteToggle}
            className="p-1 rounded-md text-zinc-500 hover:text-amber-400 focus:outline-none transition-colors mt-1"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={clsx(
                'w-5 h-5 transition-colors',
                isFavorite
                  ? 'text-amber-400 fill-amber-400'
                  : 'hover:text-amber-300'
              )}
            />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={() => hasUnsavedChanges && handleSave()}
                placeholder="Profile Name"
                className="text-xl font-bold tracking-tight text-white bg-transparent border-b border-transparent hover:border-white/[0.15] focus:border-doom-red focus:outline-none transition-colors px-1 py-0.5 max-w-lg"
              />
              {hasUnsavedChanges && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => handleSave()}
                  isLoading={isSaving}
                  leftIcon={<Save className="w-3.5 h-3.5 text-amber-400" />}
                  className="text-amber-400 hover:bg-amber-950/30"
                >
                  Save
                </Button>
              )}
            </div>
            <input
              type="text"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onBlur={() => hasUnsavedChanges && handleSave()}
              placeholder="Add profile description or notes..."
              className="text-xs text-zinc-400 bg-transparent border-b border-transparent hover:border-white/[0.15] focus:border-doom-red focus:outline-none transition-colors px-1 py-0.5 w-full max-w-xl mt-0.5 placeholder-zinc-600"
            />
          </div>
        </div>

        {/* Primary Action Toolbar */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Validate Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={runValidation}
            isLoading={isValidating}
            leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          >
            Validate
          </Button>

          {/* Export YAML */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportYAML}
            leftIcon={<Download className="w-4 h-4 text-zinc-400" />}
            title="Export profile as YAML specification"
          >
            Export
          </Button>

          {/* Duplicate Profile */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDuplicate}
            leftIcon={<Copy className="w-4 h-4 text-zinc-400" />}
            title="Duplicate profile"
          >
            Duplicate
          </Button>

          {/* Delete Profile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            title="Delete profile"
            className="text-zinc-400 hover:text-red-400 hover:bg-red-950/30"
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          {/* Primary PLAY Launch Button */}
          <Button
            variant={validation?.status === 'CANNOT_LAUNCH' ? 'secondary' : 'primary'}
            size="md"
            onClick={handleLaunch}
            disabled={isLaunching || validation?.status === 'CANNOT_LAUNCH'}
            isLoading={isLaunching}
            leftIcon={!isLaunching && <Play className="w-4 h-4 fill-current" />}
            className="px-5 font-bold tracking-wide"
          >
            {isLaunching
              ? 'RUNNING...'
              : validation?.status === 'CANNOT_LAUNCH'
              ? 'CANNOT LAUNCH'
              : validation?.status === 'READY_WITH_WARNINGS'
              ? 'PLAY ANYWAY'
              : 'PLAY'}
          </Button>
        </div>
      </div>

      {/* Validation Status Banner */}
      <ValidationBanner
        validation={validation}
        isValidating={isValidating}
        onValidate={runValidation}
      />

      {/* Core Setup Grid: Source Port Engine & Base Game IWAD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Engine Selector Card */}
        <div className="p-4.5 rounded-xl border border-white/[0.08] bg-[#15181c] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              Source Port Engine
            </label>
            {selectedEngineObj && (
              <Badge variant="blue" size="xs">
                {selectedEngineObj.family}
              </Badge>
            )}
          </div>

          <select
            value={engineId}
            onChange={(e) => handleEngineSelect(e.target.value)}
            className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-doom-red font-medium"
          >
            <option value="">-- Select Doom Engine --</option>
            {engines.map((eng) => (
              <option key={eng.id} value={eng.id} className="bg-[#141619] text-zinc-100">
                {eng.name} {eng.version ? `(${eng.version})` : ''} - [{eng.family}]
              </option>
            ))}
          </select>

          {selectedEngineObj ? (
            <div className="flex flex-col gap-1 text-xs text-zinc-400 font-mono bg-black/30 p-2.5 rounded-lg border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-zinc-200 font-semibold">{selectedEngineObj.name}</span>
                {selectedEngineObj.version && (
                  <span className="text-[11px] text-zinc-400">v{selectedEngineObj.version}</span>
                )}
              </div>
              <span className="truncate text-[11px] text-zinc-500" title={selectedEngineObj.executable}>
                {selectedEngineObj.executable}
              </span>
            </div>
          ) : (
            <div className="text-xs text-amber-400 flex items-center gap-1.5 p-2 rounded-lg bg-[#2b2011] border border-amber-800/30">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>No engine selected. Game cannot launch without a source port.</span>
            </div>
          )}
        </div>

        {/* IWAD Selector Card */}
        <div className="p-4.5 rounded-xl border border-white/[0.08] bg-[#15181c] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <Disc className="w-4 h-4 text-amber-400" />
              Base Game IWAD
            </label>
            {selectedIWADObj && (
              <Badge variant="amber" size="xs">
                {selectedIWADObj.type}
              </Badge>
            )}
          </div>

          <select
            value={iwadId}
            onChange={(e) => handleIWADSelect(e.target.value)}
            className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-doom-red font-medium"
          >
            <option value="">-- Select Game IWAD --</option>
            {iwads.map((iwad) => (
              <option key={iwad.id} value={iwad.id} className="bg-[#141619] text-zinc-100">
                {iwad.name} ({iwad.type.toUpperCase()}) - {iwad.lumpCount} lumps
              </option>
            ))}
          </select>

          {selectedIWADObj ? (
            <div className="flex flex-col gap-1 text-xs text-zinc-400 font-mono bg-black/30 p-2.5 rounded-lg border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-zinc-200 font-semibold">{selectedIWADObj.name}</span>
                <span className="text-[11px] text-zinc-400">{selectedIWADObj.lumpCount} lumps</span>
              </div>
              <span className="truncate text-[11px] text-zinc-500" title={selectedIWADObj.path}>
                {selectedIWADObj.path}
              </span>
            </div>
          ) : (
            <div className="text-xs text-amber-400 flex items-center gap-1.5 p-2 rounded-lg bg-[#2b2011] border border-amber-800/30">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>No IWAD selected. Game requires DOOM2.WAD, DOOM.WAD, or compatible IWAD.</span>
            </div>
          )}
        </div>
      </div>

      {/* Mod Load Order Management Section */}
      <div className="p-4.5 rounded-xl border border-white/[0.08] bg-[#15181c] flex flex-col gap-4">
        {/* If Parent Profile is selected: Informational Banner */}
        {selectedParentProfile && (
          <div className="p-3.5 rounded-lg bg-[#132232] border border-blue-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-blue-200">
            <div className="flex items-start gap-3">
              <Layers className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                    Base Mixin Active: {selectedParentProfile.name}
                  </span>
                  <Badge variant="blue" size="xs">
                    INHERITED
                  </Badge>
                </div>
                <p className="text-xs text-blue-200/80">
                  Inheriting {selectedParentProfile.mods?.length || 0} mod(s) from parent profile. Inherited base mods load first before local profile mods.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="blue" size="xs">
                {selectedParentProfile.mods?.filter((m) => m.enabled).length || 0} Active Inherited Mod(s)
              </Badge>
            </div>
          </div>
        )}

        <LoadOrderList
          mods={mods}
          onReorder={handleModsReorder}
          onToggle={handleToggleMod}
          onRemove={handleRemoveMod}
          onAddModsClick={() => setIsSelectModsOpen(true)}
          onToggleAll={handleToggleAllMods}
          onClearAll={handleClearAllMods}
        />
      </div>

      {/* Progressive Disclosure: Advanced Execution Options */}
      <div className="rounded-xl border border-white/[0.08] bg-[#15181c] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              {'Advanced Execution & Configuration'}
            </span>
            {(workingDir || parsedArguments.length > 0 || isolateSaves || parentProfileId) && (
              <Badge variant="secondary" size="xs">
                Configured
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="text-xs">
              {isAdvancedOpen ? 'Hide Advanced' : 'Show Advanced'}
            </span>
            {isAdvancedOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {isAdvancedOpen && (
          <div className="p-5 border-t border-white/[0.07] flex flex-col gap-5 bg-black/20">
            {/* Base Mixin / Parent Profile & Savegame Isolation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Base Mixin Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  Base Mixin / Parent Profile
                </label>
                <select
                  value={parentProfileId}
                  onChange={(e) => handleParentProfileSelect(e.target.value)}
                  disabled={isLoadingProfiles}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-doom-red font-medium"
                >
                  <option value="">None (Standalone Profile)</option>
                  {eligibleParentProfiles.map((p) => {
                    const modCount = p.mods?.filter((m) => m.enabled).length ?? p.mods?.length ?? 0;
                    return (
                      <option key={p.id} value={p.id} className="bg-[#141619] text-zinc-100">
                        {p.name} ({modCount} mod{modCount !== 1 ? 's' : ''})
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-zinc-500">
                  Optionally inherit baseline mods or engine settings from another profile.
                </p>
              </div>

              {/* Save Game Isolation */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <FolderLock className="w-3.5 h-3.5 text-amber-400" />
                  Save Game Isolation
                </label>
                <div className="flex items-center justify-between gap-3 bg-black/30 p-2.5 rounded-lg border border-white/[0.06]">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isolateSaves}
                      onChange={(e) => handleToggleIsolateSaves(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-700 bg-black text-doom-red focus:ring-doom-red cursor-pointer accent-red-600"
                    />
                    <span className="text-xs font-semibold text-zinc-200">
                      Dedicated savegame folder
                    </span>
                  </label>

                  {isolateSaves && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={handleOpenSaveFolder}
                      leftIcon={<FolderOpen className="w-3 h-3 text-amber-400" />}
                    >
                      Open Saves
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500">
                  Prevents save state corruption between complex mod packs.
                </p>
              </div>
            </div>

            {/* Custom Launch Arguments */}
            <div className="flex flex-col gap-2 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                  Custom Launch Arguments
                </label>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setIsDmFlagsOpen(true)}
                  leftIcon={<Sliders className="w-3 h-3 text-blue-400" />}
                >
                  ZDoom Flag Calculator
                </Button>
              </div>
              <Input
                type="text"
                value={argumentsText}
                onChange={(e) => {
                  setArgumentsText(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                onBlur={() => handleSave({ arguments: parsedArguments })}
                placeholder="-skill 4 -warp MAP01 +sv_cheats 1"
                leftIcon={<Terminal className="w-4 h-4" />}
                className="font-mono text-xs"
              />

              {parsedArguments.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <span className="text-[11px] font-mono text-zinc-500">Tokens:</span>
                  {parsedArguments.map((tok, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#132232] border border-blue-800/30 text-blue-200 font-medium"
                    >
                      {tok}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Working Directory */}
            <div className="flex flex-col gap-2 pt-3 border-t border-white/[0.06]">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                <span>Custom Working Directory</span>
                <span className="text-[11px] text-zinc-500 font-normal">
                  Leave blank to use engine default folder
                </span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    type="text"
                    value={workingDir}
                    onChange={(e) => {
                      setWorkingDir(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    onBlur={() => handleSave({ workingDir })}
                    placeholder="Defaults to engine executable directory"
                    leftIcon={<FolderOpen className="w-4 h-4" />}
                    className="font-mono text-xs"
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBrowseWorkingDir}
                  leftIcon={<FolderOpen className="w-4 h-4 text-zinc-400" />}
                >
                  Browse
                </Button>
                {workingDir && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setWorkingDir('');
                      handleSave({ workingDir: '' });
                    }}
                    className="text-zinc-400 hover:text-white text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mod Selection Modal */}
      <SelectModsModal
        isOpen={isSelectModsOpen}
        onClose={() => setIsSelectModsOpen(false)}
        existingModIds={mods.map((m) => m.modId)}
        onAddMods={handleAddMods}
      />

      {/* ZDoom Flags Bitfield Calculator Modal */}
      <DmFlagsModal
        isOpen={isDmFlagsOpen}
        onClose={() => setIsDmFlagsOpen(false)}
        existingArgs={parsedArguments}
        onApply={handleApplyDmFlags}
      />
    </div>
  );
};
