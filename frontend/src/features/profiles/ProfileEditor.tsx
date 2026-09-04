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
  Plus,
  FileUp,
  Search,
  LayoutGrid,
  MoreHorizontal,
  Edit2,
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
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { LoadOrderList } from './LoadOrderList';
import { ValidationBanner } from './ValidationBanner';
import { SelectModsModal } from './SelectModsModal';
import { DmFlagsModal } from './DmFlagsModal';
import { RecentProfileCard } from '../dashboard/RecentProfileCard';

export interface ProfileEditorProps {
  profile: Profile;
  profiles: Profile[];
  engines: Engine[];
  iwads: IWAD[];
  onProfileChange: (updated: Profile) => void;
  onProfileDeleted: (profileId: string) => void;
  onProfileDuplicated: (duplicated: Profile) => void;
  onSelectProfile: (profileId: string) => void;
  onCreateProfileClick?: () => void;
  onImportClick?: () => void;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({
  profile,
  profiles,
  engines,
  iwads,
  onProfileChange,
  onProfileDeleted,
  onProfileDuplicated,
  onSelectProfile,
  onCreateProfileClick,
  onImportClick,
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

  // Sub-Tab state: 'mods' | 'parameters' | 'all-presets' | 'details'
  const [activeTab, setActiveTab] = useState<'mods' | 'parameters' | 'all-presets' | 'details'>('mods');
  const [presetSearchFilter, setPresetSearchFilter] = useState('');
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const actionsMenuRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setIsActionsOpen(false);
      }
    };
    if (isActionsOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [isActionsOpen]);
  // Modals state
  const [isSelectModsOpen, setIsSelectModsOpen] = useState(false);
  const [isDmFlagsOpen, setIsDmFlagsOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameName, setRenameName] = useState(profile.name);
  const [isRenaming, setIsRenaming] = useState(false);

  // Validation state
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Launch state
  const [isLaunching, setIsLaunching] = useState(false);

  // Dirty state tracking & saving
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Update local state when incoming profile prop changes
  useEffect(() => {
    setName(profile.name);
    setRenameName(profile.name);
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
    return profiles.filter((p) => p.id !== profile.id);
  }, [profiles, profile.id]);

  // Currently selected parent profile object
  const selectedParentProfile = useMemo(() => {
    if (!parentProfileId) return null;
    return profiles.find((p) => p.id === parentProfileId) || null;
  }, [profiles, parentProfileId]);

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
      name: name.trim() || 'Untitled Preset',
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
      const msg = err instanceof Error ? err.message : 'Failed to save preset';
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
    handleSave({ parentProfileId: newParentId });
  };

  const handleToggleIsolateSaves = (checked: boolean) => {
    setIsolateSaves(checked);
    handleSave({ isolateSaves: checked });
  };

  const handleOpenSaveFolder = async () => {
    try {
      await api.openProfileSaveFolder(profile.id);
      toast.info('Save Folder', 'Opened preset saves folder in file explorer');
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
    handleSave({ mods: updated });
  };

  const handleRemoveMod = (modId: string) => {
    const updated = mods
      .filter((m) => m.modId !== modId)
      .map((m, idx) => ({ ...m, order: idx }));
    setMods(updated);
    handleSave({ mods: updated });
  };

  const handleToggleAllMods = (enabled: boolean) => {
    const updated = mods.map((m) => ({ ...m, enabled }));
    setMods(updated);
    handleSave({ mods: updated });
  };

  const handleClearAllMods = () => {
    setMods([]);
    handleSave({ mods: [] });
  };

  const handleAddMods = (selectedMods: Mod[]) => {
    const currentMaxOrder = mods.length;
    const newProfileMods: ProfileMod[] = selectedMods.map((sm, idx) => ({
      id: `${profile.id}-${sm.id}-${Date.now()}-${idx}`,
      profileId: profile.id,
      modId: sm.id,
      modName: sm.name,
      modFormat: sm.format,
      modPath: sm.path,
      order: currentMaxOrder + idx,
      enabled: true,
    }));
    const updated = [...mods, ...newProfileMods];
    setMods(updated);
    handleSave({ mods: updated });
    setIsSelectModsOpen(false);
  };

  const handleApplyDmFlags = (newArgs: string[]) => {
    setArgumentsText(newArgs.join(' '));
    handleSave({ arguments: newArgs });
  };

  // Browse Directory for Working Dir
  const handleBrowseWorkingDir = async () => {
    try {
      const selected = await api.openDirectoryDialog('Select Working Directory', workingDir);
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
      toast.success('YAML Exported', 'Preset specification copied to clipboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast.error('Export Failed', msg);
    }
  };

  // Rename Profile
  const handleOpenRename = () => {
    setRenameName(profile.name);
    setIsRenameModalOpen(true);
  };

  const handleConfirmRename = async () => {
    const trimmed = renameName.trim();
    if (!trimmed || trimmed === profile.name) {
      setIsRenameModalOpen(false);
      return;
    }
    setIsRenaming(true);
    try {
      const updated: Profile = {
        ...profile,
        name: trimmed,
      };
      await api.updateProfile(updated);
      setName(trimmed);
      setHasUnsavedChanges(false);
      onProfileChange(updated);
      toast.success('Preset Renamed', `Renamed to "${trimmed}"`);
      setIsRenameModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to rename preset';
      toast.error('Rename Failed', msg);
    } finally {
      setIsRenaming(false);
    }
  };

  // Duplicate Profile
  const handleDuplicate = async () => {
    try {
      const newName = `${profile.name} (Copy)`;
      const dup = await api.duplicateProfile(profile.id, newName);
      toast.success('Preset Duplicated', `Created "${dup.name}"`);
      onProfileDuplicated(dup);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Duplicate failed';
      toast.error('Duplicate Failed', msg);
    }
  };

  // Delete Profile
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };
  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      await api.deleteProfile(profile.id);
      toast.info('Preset Deleted', `Deleted "${profile.name}"`);
      onProfileDeleted(profile.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      toast.error('Delete Failed', msg);
    }
  };
  // Launch Game Execution
  const handleLaunch = async () => {
    if (validation?.status === 'CANNOT_LAUNCH') {
      toast.error('Cannot Launch', 'Please resolve pre-launch validation errors before launching.');
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
        toast.warning('Game Exited', `Process exited with code ${record.exitCode ?? 0}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to launch preset';
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
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-[#14171c] border border-[#22262d] text-zinc-400 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
          <span>Checking</span>
        </div>
      );
    }

    if (!validation || validation.status === 'READY') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Ready to Play</span>
        </div>
      );
    }

    if (validation.status === 'READY_WITH_WARNINGS') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-amber-950/40 border border-amber-800/40 text-amber-400 select-none">
          <span className="text-[10px] leading-none">▲</span>
          <span>Warnings</span>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-red-950/40 border border-red-800/40 text-red-400 select-none">
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

  // Filtered profiles for "All Presets" tab
  const filteredAllProfiles = useMemo(() => {
    if (!presetSearchFilter.trim()) return profiles;
    const q = presetSearchFilter.toLowerCase();
    return profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.engineName && p.engineName.toLowerCase().includes(q)) ||
        (p.iwadName && p.iwadName.toLowerCase().includes(q))
    );
  }, [profiles, presetSearchFilter]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#0c0e12] select-none text-zinc-100">
      {/* 1. Streamlined Single Control Deck (44px) */}
      <div className="px-5 py-2 bg-[#0e0e11] border-b border-[#2d2d34] flex items-center justify-between gap-3 shrink-0 flex-wrap">
        {/* Left cluster: Preset Picker + Favorite + Inline Port + Inline IWAD + Status */}
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#141418] border border-[#2d2d34] rounded-[8px] px-2.5 py-1 text-xs">
            <span className="text-[#71717a] font-medium text-[11px]">Preset:</span>
            <select
              value={profile.id}
              onChange={(e) => onSelectProfile(e.target.value)}
              aria-label="Select active preset"
              className="bg-transparent text-[#f4f4f5] font-medium cursor-pointer focus:outline-none max-w-[180px] sm:max-w-[220px] truncate"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#141418] text-[#f4f4f5]">
                  {p.isFavorite ? '★ ' : ''}{p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleOpenRename}
              className="p-1 rounded-[6px] text-[#71717a] hover:text-[#5e7ce2] hover:bg-white/[0.04] transition-colors shrink-0"
              title={`Rename "${profile.name}"`}
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleFavoriteToggle}
            className="p-1 rounded-[6px] text-[#71717a] hover:text-amber-400 hover:bg-white/[0.04] transition-colors shrink-0"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={clsx('w-3.5 h-3.5', isFavorite ? 'fill-amber-400 text-amber-400' : 'text-[#71717a]')} />
          </button>

          <div className="h-4 w-px bg-[#2d2d34] mx-0.5" />

          <div className="flex items-center gap-1.5 bg-[#141418] border border-[#2d2d34] px-2.5 py-1 rounded-[8px] text-xs">
            <Cpu className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
            <span className="text-[#71717a] font-medium text-[11px]">Port:</span>
            <select
              value={engineId}
              onChange={(e) => handleEngineSelect(e.target.value)}
              aria-label="Select Source Port"
              className="bg-transparent text-[#f4f4f5] text-xs font-medium cursor-pointer focus:outline-none max-w-[130px] truncate"
            >
              <option value="">-- Port --</option>
              {engines.map((eng) => (
                <option key={eng.id} value={eng.id} className="bg-[#141418] text-[#f4f4f5]">
                  {eng.name} {eng.version ? `v${eng.version}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#141418] border border-[#2d2d34] px-2.5 py-1 rounded-[8px] text-xs">
            <Disc className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
            <span className="text-[#71717a] font-medium text-[11px]">IWAD:</span>
            <select
              value={iwadId}
              onChange={(e) => handleIWADSelect(e.target.value)}
              aria-label="Select Base IWAD"
              className="bg-transparent text-[#f4f4f5] text-xs font-medium cursor-pointer focus:outline-none max-w-[130px] truncate"
            >
              <option value="">-- IWAD --</option>
              {iwads.map((iwad) => (
                <option key={iwad.id} value={iwad.id} className="bg-[#141418] text-[#f4f4f5]">
                  {iwad.name} ({iwad.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {renderReadinessStatus()}

          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="text-[11px] text-[#5e7ce2] hover:underline font-medium px-2 py-0.5 rounded bg-[rgba(94,124,226,0.1)] border border-[#5e7ce2]/30 transition-colors"
            >
              Save
            </button>
          )}
        </div>

        {/* Right cluster: + New, Import, Overflow Menu [⋯] */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onCreateProfileClick && (
            <button
              type="button"
              onClick={onCreateProfileClick}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-[8px] bg-[#141418] hover:bg-[#1a1a20] border border-[#2d2d34] text-[#f4f4f5] transition-colors"
              title="Create a new setup"
            >
              <Plus className="w-3.5 h-3.5 text-[#5e7ce2]" />
              <span>New</span>
            </button>
          )}

          {onImportClick && (
            <button
              type="button"
              onClick={onImportClick}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-[8px] bg-[#141418] hover:bg-[#1a1a20] border border-[#2d2d34] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
              title="Import YAML or .zdl preset"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Import</span>
            </button>
          )}

          {/* Launch Play Action */}
          <button
            type="button"
            onClick={handleLaunch}
            disabled={isLaunching || validation?.status === 'CANNOT_LAUNCH'}
            className={clsx(
              'h-7 px-3.5 font-[600] text-xs uppercase tracking-wider rounded-[8px] transition-colors flex items-center gap-1.5 text-[#09090b] select-none',
              validation?.status === 'CANNOT_LAUNCH'
                ? 'bg-[#141418] text-[#71717a] cursor-not-allowed border border-[#2d2d34]'
                : 'bg-[#5e7ce2] hover:bg-[#4d6bd4] active:bg-[#435ec0] shadow-sm'
            )}
          >
            {isLaunching ? (
              <>
                <RotateCw className="w-3 h-3 animate-spin text-current" />
                <span>Starting...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          {/* Overflow Menu for secondary actions (Validate, Export, Duplicate, Delete) */}
          <div className="relative" ref={actionsMenuRef}>
            <button
              type="button"
              onClick={() => setIsActionsOpen(!isActionsOpen)}
              className="p-1.5 rounded-[8px] bg-[#141418] hover:bg-[#1a1a20] border border-[#2d2d34] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
              title="Preset actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {isActionsOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-[8px] bg-[#0c0c0f] border border-[#2d2d34] shadow-xl py-1 z-30 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsOpen(false);
                    runValidation();
                  }}
                  className="w-full px-3 py-1.5 text-left text-[#f4f4f5] hover:bg-[rgba(244,244,245,0.05)] flex items-center gap-2"
                >
                  <RotateCw className={clsx('w-3.5 h-3.5 text-[#71717a]', isValidating && 'animate-spin')} />
                  <span>Validate Setup</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsOpen(false);
                    handleExportYAML();
                  }}
                  className="w-full px-3 py-1.5 text-left text-[#f4f4f5] hover:bg-[rgba(244,244,245,0.05)] flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-[#71717a]" />
                  <span>Export YAML</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsOpen(false);
                    handleOpenRename();
                  }}
                  className="w-full px-3 py-1.5 text-left text-[#f4f4f5] hover:bg-[rgba(244,244,245,0.05)] flex items-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#71717a]" />
                  <span>Rename Preset</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsOpen(false);
                    handleDuplicate();
                  }}
                  className="w-full px-3 py-1.5 text-left text-[#f4f4f5] hover:bg-[rgba(244,244,245,0.05)] flex items-center gap-2"
                >
                  <Copy className="w-3.5 h-3.5 text-[#71717a]" />
                  <span>Duplicate Preset</span>
                </button>
                <div className="my-1 border-t border-[#2d2d34]" />
                <button
                  type="button"
                  onClick={() => {
                    setIsActionsOpen(false);
                    handleDelete();
                  }}
                  className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-red-950/30 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Preset</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Sub-Tab Navigation Bar with Inline Mod Count & Path Hint (36px) */}
      <div className="h-9 px-5 bg-[#09090b] border-b border-[#2d2d34] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('mods')}
            className={clsx(
              'px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors flex items-center gap-1.5',
              activeTab === 'mods'
                ? 'bg-[rgba(244,244,245,0.08)] text-[#f4f4f5]'
                : 'text-[#71717a] hover:text-[#f4f4f5] hover:bg-[rgba(244,244,245,0.03)]'
            )}
          >
            <Layers className="w-3.5 h-3.5 text-[#71717a]" />
            <span>Mod Load Order</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[rgba(244,244,245,0.05)] text-[#a1a1aa]">
              {mods.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('parameters')}
            className={clsx(
              'px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors flex items-center gap-1.5',
              activeTab === 'parameters'
                ? 'bg-[rgba(244,244,245,0.08)] text-[#f4f4f5]'
                : 'text-[#71717a] hover:text-[#f4f4f5] hover:bg-[rgba(244,244,245,0.03)]'
            )}
          >
            <Sliders className="w-3.5 h-3.5 text-[#71717a]" />
            <span>Launch Parameters</span>
            {hasConfiguredOptions && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#5e7ce2]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all-presets')}
            className={clsx(
              'px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors flex items-center gap-1.5',
              activeTab === 'all-presets'
                ? 'bg-[rgba(244,244,245,0.08)] text-[#f4f4f5]'
                : 'text-[#71717a] hover:text-[#f4f4f5] hover:bg-[rgba(244,244,245,0.03)]'
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#71717a]" />
            <span>All Presets</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[rgba(244,244,245,0.05)] text-[#a1a1aa]">
              {profiles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={clsx(
              'px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors flex items-center gap-1.5',
              activeTab === 'details'
                ? 'bg-[rgba(244,244,245,0.08)] text-[#f4f4f5]'
                : 'text-[#71717a] hover:text-[#f4f4f5] hover:bg-[rgba(244,244,245,0.03)]'
            )}
          >
            <FileText className="w-3.5 h-3.5 text-[#71717a]" />
            <span>Details & Notes</span>
          </button>
        </div>

        {/* Subtle Path hint on right */}
        <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono text-[#71717a] truncate max-w-sm">
          {selectedEngineObj && <span className="truncate">{selectedEngineObj.name}</span>}
          {selectedEngineObj && selectedIWADObj && <span>•</span>}
          {selectedIWADObj && <span className="truncate">{selectedIWADObj.name}</span>}
        </div>
      </div>

      {/* 3. Main Full-Width Tab Content Viewport */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* TAB 1: MOD LOAD ORDER (100% Full Screen Width & Height!) */}
        {activeTab === 'mods' && (
          <div className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden gap-3">
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
            {/* Preset Name Edit */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider block">
                Preset Name
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={() => hasUnsavedChanges && handleSave()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                    if (hasUnsavedChanges) handleSave();
                  }
                }}
                placeholder="Preset Name"
                className="bg-[#14171c] border-[#22262d] text-zinc-100"
              />
            </div>

            {/* Custom Launch Arguments */}
            <div className="space-y-2 pt-4 border-t border-[#22262d]">
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
                    className="w-4 h-4 rounded border-[#2d2d34] bg-[#09090b] text-[#5e7ce2] focus:ring-[#5e7ce2] cursor-pointer accent-[#5e7ce2]"
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

        {/* TAB 3: ALL PRESETS GALLERY OVERVIEW */}
        {activeTab === 'all-presets' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex items-center max-w-sm w-full">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={presetSearchFilter}
                  onChange={(e) => setPresetSearchFilter(e.target.value)}
                  placeholder="Filter presets..."
                  className="w-full bg-[#14171c] border border-[#22262d] rounded-md pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                />
              </div>

              {onCreateProfileClick && (
                <button
                  type="button"
                  onClick={onCreateProfileClick}
                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#5e7ce2] hover:bg-[#4d6bd4] px-3.5 py-1.5 text-xs font-[600] text-[#09090b] transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Setup</span>
                </button>
              )}
            </div>

            {filteredAllProfiles.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-[#22262d] rounded-lg">
                No presets found matching &quot;{presetSearchFilter}&quot;
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAllProfiles.map((p) => (
                  <RecentProfileCard
                    key={p.id}
                    profile={p}
                    onLaunch={async (id) => {
                      onSelectProfile(id);
                      try {
                        await api.launchProfile(id);
                      } catch (err) {
                        console.error('Launch failed', err);
                      }
                    }}
                    onToggleFavorite={async (id) => {
                      await api.toggleProfileFavorite(id);
                      onProfileChange({ ...p, isFavorite: !p.isFavorite });
                    }}
                    onSelectProfile={(id) => {
                      onSelectProfile(id);
                      setActiveTab('mods');
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DETAILS & NOTES & VALIDATION */}
        {activeTab === 'details' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
            {/* Preset Name */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider block">
                Preset Name
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={() => hasUnsavedChanges && handleSave()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                    if (hasUnsavedChanges) handleSave();
                  }
                }}
                placeholder="Preset Name"
                className="bg-[#14171c] border-[#22262d] text-zinc-100"
              />
            </div>

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

      {/* Rename Preset Modal */}
      <Modal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        title={
          <div className="flex items-center gap-2.5">
            <span className="rounded-[8px] bg-[#0c0c0f] border border-[#2d2d34] p-1.5 text-[#5e7ce2]">
              <Edit2 className="h-4 w-4" />
            </span>
            <span>Rename Preset</span>
          </div>
        }
        description="Enter a new display name for this configuration preset."
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRenameModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!renameName.trim() || isRenaming}
              isLoading={isRenaming}
              onClick={handleConfirmRename}
            >
              Save Name
            </Button>
          </div>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmRename();
          }}
          className="space-y-4"
        >
          <Input
            autoFocus
            label="Preset Name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            placeholder="e.g. Brutal Doom + Metal Soundtrack"
            className="bg-[#14171c] border-[#22262d] text-zinc-100"
          />
        </form>
      </Modal>
      {/* Canonical Danger Delete Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        size="sm"
        title="Delete Preset Setup?"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[#a1a1aa]">
          Are you sure you want to delete <span className="text-[#f4f4f5] font-medium">&ldquo;{profile.name}&rdquo;</span>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};
