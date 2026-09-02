import React, { useState, useEffect, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import {
  Play,
  RotateCw,
  Copy,
  Download,
  Trash2,
  Star,
  Cpu,
  Disc,
  FolderOpen,
  FolderLock,
  Terminal,
  Layers,
  Sliders,
  FileText,
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

  // Tab selection state: 'mods' | 'parameters' | 'details'
  const [activeTab, setActiveTab] = useState<'mods' | 'parameters' | 'details'>('mods');
  // Modals state
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

  // Status chip renderer
  const renderReadinessStatus = () => {
    if (isValidating) {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#14171c] border border-[#22262d] text-zinc-400 select-none">
          <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
          <span>Checking...</span>
        </div>
      );
    }

    if (!validation || validation.status === 'READY') {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 select-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Ready to Play</span>
        </div>
      );
    }

    if (validation.status === 'READY_WITH_WARNINGS') {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-950/40 border border-amber-800/40 text-amber-400 select-none">
          <span className="text-[10px] leading-none">▲</span>
          <span>Warnings</span>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-950/40 border border-red-800/40 text-red-400 select-none">
        <span className="text-[10px] leading-none">✖</span>
        <span>Cannot Launch</span>
      </div>
    );
  };

  const hasConfiguredOptions = Boolean(
    workingDir ||
    (parsedArguments && parsedArguments.length > 0) ||
    isolateSaves ||
    parentProfileId
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0c0e12] select-none text-zinc-100">
      {/* 1. Sleek Compact Stage Header */}
      <div className="px-5 py-2.5 bg-[#12151a] border-b border-[#22262d] flex items-center justify-between gap-4 shrink-0 flex-wrap">
        {/* Left: Star + Title + Status */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleFavoriteToggle}
            className="p-1 rounded text-zinc-500 hover:text-amber-400 transition-colors shrink-0"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={clsx(
                'w-4 h-4 transition-colors',
                isFavorite ? 'fill-amber-400 text-amber-400' : 'text-zinc-500'
              )}
            />
          </button>

          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => hasUnsavedChanges && handleSave()}
            placeholder="Preset Name"
            className="text-base font-bold tracking-tight text-zinc-100 bg-transparent border-b border-transparent hover:border-[#22262d] focus:border-zinc-500 focus:outline-none transition-colors px-1 py-0.5 truncate max-w-xs"
          />

          {renderReadinessStatus()}

          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="text-[11px] text-amber-400 hover:text-amber-300 font-medium px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40 transition-colors"
            >
              Save
            </button>
          )}
        </div>

        {/* Center: Inline Port and IWAD Selectors */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-[#171b22] border border-[#22262d] px-2.5 py-1 rounded text-xs">
            <Cpu className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-zinc-500 font-medium text-[11px]">Port:</span>
            <select
              value={engineId}
              onChange={(e) => handleEngineSelect(e.target.value)}
              aria-label="Select Source Port"
              className="bg-transparent text-zinc-200 text-xs font-medium cursor-pointer focus:outline-none max-w-[140px] truncate"
            >
              <option value="">-- Select Port --</option>
              {engines.map((eng) => (
                <option key={eng.id} value={eng.id} className="bg-[#14171c] text-zinc-100">
                  {eng.name} {eng.version ? `v${eng.version}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#171b22] border border-[#22262d] px-2.5 py-1 rounded text-xs">
            <Disc className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-zinc-500 font-medium text-[11px]">IWAD:</span>
            <select
              value={iwadId}
              onChange={(e) => handleIWADSelect(e.target.value)}
              aria-label="Select Base IWAD"
              className="bg-transparent text-zinc-200 text-xs font-medium cursor-pointer focus:outline-none max-w-[140px] truncate"
            >
              <option value="">-- Select IWAD --</option>
              {iwads.map((iwad) => (
                <option key={iwad.id} value={iwad.id} className="bg-[#14171c] text-zinc-100">
                  {iwad.name} ({iwad.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Authoritative Crimson Launch CTA & Action Icons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleLaunch}
            disabled={isLaunching || validation?.status === 'CANNOT_LAUNCH'}
            className={clsx(
              'h-8 px-4 font-bold text-xs tracking-wider uppercase rounded-md transition-colors flex items-center gap-2 text-white select-none',
              validation?.status === 'CANNOT_LAUNCH'
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-[#22262d]'
                : 'bg-[#dc2626] hover:bg-[#ef4444] active:bg-[#b91c1c] shadow-sm'
            )}
          >
            {isLaunching ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Starting...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current text-white" />
                <span>PLAY</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={runValidation}
            title="Validate configuration"
            className="p-1.5 h-8 w-8 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] rounded flex items-center justify-center transition-colors"
          >
            <RotateCw className={clsx('w-3.5 h-3.5', isValidating && 'animate-spin')} />
          </button>

          <button
            type="button"
            onClick={handleExportYAML}
            title="Export YAML"
            className="p-1.5 h-8 w-8 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] rounded flex items-center justify-center transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleDuplicate}
            title="Duplicate preset"
            className="p-1.5 h-8 w-8 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] rounded flex items-center justify-center transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            title="Delete preset"
            className="p-1.5 h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded flex items-center justify-center transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Sub-Tab Navigation Bar */}
      <div className="h-10 px-5 bg-[#101317] border-b border-[#22262d] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('mods')}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
              activeTab === 'mods'
                ? 'bg-[#1c2026] text-zinc-100 border border-[#2c323d]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
            )}
          >
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Mod Load Order</span>
            <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-zinc-400">
              {mods.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('parameters')}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
              activeTab === 'parameters'
                ? 'bg-[#1c2026] text-zinc-100 border border-[#2c323d]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
            )}
          >
            <Sliders className="w-3.5 h-3.5 text-zinc-400" />
            <span>Launch Parameters</span>
            {hasConfiguredOptions && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
              activeTab === 'details'
                ? 'bg-[#1c2026] text-zinc-100 border border-[#2c323d]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
            )}
          >
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <span>Details & Notes</span>
          </button>
        </div>

        {/* Port & IWAD Path preview on the right */}
        <div className="hidden xl:flex items-center gap-3 text-[11px] font-mono text-zinc-500">
          {selectedEngineObj && (
            <span className="truncate max-w-xs" title={selectedEngineObj.executable}>
              {selectedEngineObj.name}: {selectedEngineObj.executable}
            </span>
          )}
          {selectedIWADObj && (
            <span className="truncate max-w-xs" title={selectedIWADObj.path}>
              • {selectedIWADObj.name}
            </span>
          )}
        </div>
      </div>

      {/* 3. Main Tab Content Viewport */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* TAB 1: MOD LOAD ORDER (Full Height!) */}
        {activeTab === 'mods' && (
          <div className="flex-1 flex flex-col min-h-0 p-5 overflow-hidden gap-3">
            {/* Parent Profile Inheritance Notice */}
            {selectedParentProfile && (
              <div className="p-2.5 rounded-md bg-[#101826] border border-blue-900/40 flex items-center justify-between gap-3 text-blue-300 text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    Base Mixin Active: <strong>{selectedParentProfile.name}</strong> (Inheriting {selectedParentProfile.mods?.length || 0} mod(s) from parent)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/40 text-blue-300">
                  INHERITED
                </span>
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
        )}

        {/* TAB 2: LAUNCH PARAMETERS & ISOLATION */}
        {activeTab === 'parameters' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
            {/* Custom Launch Arguments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Custom Launch Arguments</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsDmFlagsOpen(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium flex items-center gap-1"
                >
                  <Sliders className="w-3 h-3" />
                  <span>ZDoom Flag Calculator</span>
                </button>
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
                leftIcon={<Terminal className="w-3.5 h-3.5 text-zinc-500" />}
                className="font-mono text-xs bg-[#14171c] border-[#22262d]"
              />
              {parsedArguments.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <span className="text-[11px] font-mono text-zinc-500">Tokens:</span>
                  {parsedArguments.map((tok, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#171b22] border border-[#22262d] text-zinc-300"
                    >
                      {tok}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Save Game Isolation */}
            <div className="space-y-2 pt-4 border-t border-[#22262d]">
              <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <FolderLock className="w-3.5 h-3.5 text-amber-400" />
                <span>Save Game Isolation</span>
              </label>
              <div className="flex items-center justify-between gap-3 bg-[#14171c] p-3 rounded-lg border border-[#22262d]">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isolateSaves}
                    onChange={(e) => handleToggleIsolateSaves(e.target.checked)}
                    className="w-4 h-4 rounded border-[#22262d] bg-black text-[#dc2626] focus:ring-[#dc2626] cursor-pointer accent-red-600"
                  />
                  <span className="text-xs font-medium text-zinc-200">
                    Store savegames in dedicated folder for this preset
                  </span>
                </label>

                {isolateSaves && (
                  <button
                    type="button"
                    onClick={handleOpenSaveFolder}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white px-2.5 py-1 rounded bg-[#1a1f28] border border-[#22262d] transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Open Saves</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                Prevents save state corruption between complex mod configurations.
              </p>
            </div>

            {/* Custom Working Directory */}
            <div className="space-y-2 pt-4 border-t border-[#22262d]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Custom Working Directory</span>
                </label>
                <span className="text-[11px] text-zinc-500 font-normal">
                  Leave blank to use engine default directory
                </span>
              </div>
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
                    leftIcon={<FolderOpen className="w-3.5 h-3.5 text-zinc-500" />}
                    className="font-mono text-xs bg-[#14171c] border-[#22262d]"
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBrowseWorkingDir}
                  leftIcon={<FolderOpen className="w-3.5 h-3.5 text-zinc-400" />}
                  className="text-xs h-9 bg-[#181f26] border-[#22262d] text-zinc-300"
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
                    className="text-zinc-500 hover:text-zinc-300 text-xs h-9"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Base Mixin / Parent Profile Selector */}
            <div className="space-y-2 pt-4 border-t border-[#22262d]">
              <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Base Mixin / Parent Profile</span>
              </label>
              <select
                value={parentProfileId}
                onChange={(e) => handleParentProfileSelect(e.target.value)}
                disabled={isLoadingProfiles}
                className="w-full bg-[#14171c] border border-[#22262d] rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 font-medium"
              >
                <option value="">None (Standalone Preset)</option>
                {eligibleParentProfiles.map((p) => {
                  const modCount = p.mods?.filter((m) => m.enabled).length ?? p.mods?.length ?? 0;
                  return (
                    <option key={p.id} value={p.id} className="bg-[#14171c] text-zinc-100">
                      {p.name} ({modCount} mod{modCount !== 1 ? 's' : ''})
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-zinc-500">
                Optionally inherit baseline mods or engine settings from another profile.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: DETAILS & NOTES & VALIDATION */}
        {activeTab === 'details' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
            {/* Description Notes */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider block">
                Preset Description & Notes
              </label>
              <textarea
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                onBlur={() => hasUnsavedChanges && handleSave()}
                rows={4}
                placeholder="Add notes about gameplay mods, difficulty recommendations, or compatibility..."
                className="w-full bg-[#14171c] border border-[#22262d] rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none font-normal"
              />
            </div>

            {/* Validation Breakdown */}
            <div className="space-y-2 pt-4 border-t border-[#22262d]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider block">
                  Pre-Flight Validation Check
                </label>
                <button
                  type="button"
                  onClick={runValidation}
                  disabled={isValidating}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
                >
                  <RotateCw className={clsx('w-3 h-3', isValidating && 'animate-spin')} />
                  <span>Re-check</span>
                </button>
              </div>

              <ValidationBanner
                validation={validation}
                isValidating={isValidating}
                onValidate={runValidation}
              />
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
