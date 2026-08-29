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
  Terminal,
  ChevronDown,
  ChevronUp,
  Save,
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

export interface ProfileEditorProps {
  profile: Profile;
  engines: Engine[];
  iwads: IWAD[];
  onProfileChange: (updatedProfile: Profile) => void;
  onProfileDeleted: (deletedProfileId: string) => void;
  onProfileDuplicated: (duplicatedProfile: Profile) => void;
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
  const [mods, setMods] = useState<ProfileMod[]>(profile.mods || []);
  const [argumentsText, setArgumentsText] = useState(
    (profile.arguments || []).join(' ')
  );
  const [workingDir, setWorkingDir] = useState(profile.workingDir || '');
  const [isFavorite, setIsFavorite] = useState(profile.isFavorite || false);

  // Advanced section accordion
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(
    Boolean(profile.workingDir || (profile.arguments && profile.arguments.length > 0))
  );

  // Mod selection modal
  const [isSelectModsOpen, setIsSelectModsOpen] = useState(false);

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
    setDescription(profile.description || '');
    setEngineId(profile.engineId || '');
    setIwadId(profile.iwadId || '');
    setMods(profile.mods || []);
    setArgumentsText((profile.arguments || []).join(' '));
    setWorkingDir(profile.workingDir || '');
    setIsFavorite(profile.isFavorite || false);
    setHasUnsavedChanges(false);
  }, [profile.id, profile.name, profile.updatedAt, profile.updated_at]);

  // Split arguments into tokens for visual badge display
  const parsedArguments = useMemo(() => {
    if (!argumentsText.trim()) return [];
    // Match tokens respecting quotes or spaces
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
  }, [profile.id, profile.mods, profile.engineId, profile.iwadId, runValidation]);

  // Save changes to profile
  const handleSave = async (overrides?: Partial<Profile>) => {
    const selectedEngine = engines.find((e) => e.id === (overrides?.engineId ?? engineId));
    const selectedIWAD = iwads.find((w) => w.id === (overrides?.iwadId ?? iwadId));

    const updated: Profile = {
      ...profile,
      name: overrides?.name ?? name,
      description: overrides?.description ?? description,
      engineId: overrides?.engineId ?? engineId,
      engineName: selectedEngine?.name ?? '',
      iwadId: overrides?.iwadId ?? iwadId,
      iwadName: selectedIWAD?.name ?? '',
      mods: overrides?.mods ?? mods,
      arguments: overrides?.arguments ?? parsedArguments,
      workingDir: overrides?.workingDir ?? workingDir,
      isFavorite: overrides?.isFavorite ?? isFavorite,
      updatedAt: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      await api.updateProfile(updated);
      onProfileChange(updated);
      setHasUnsavedChanges(false);
      // Re-validate saved profile
      await runValidation();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile';
      toast.error('Save Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Field change handlers with dirty detection
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

    // Call backend for each mod added
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
      // Copy to clipboard
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
      const duplicated = await api.duplicateProfile(profile.id, newName);
      toast.success('Profile Duplicated', `Created "${newName}"`);
      onProfileDuplicated(duplicated);
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
    <div className="flex flex-col h-full overflow-y-auto p-6 gap-6 bg-doom-bg">
      {/* Top Action Cockpit Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-doom-border">
        {/* Profile Identity & Title */}
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={handleFavoriteToggle}
            className="p-1 rounded text-zinc-600 hover:text-amber-400 focus:outline-none transition-colors mt-1"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={clsx(
                'w-6 h-6 transition-all',
                isFavorite
                  ? 'text-amber-400 fill-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                  : 'hover:scale-105'
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
                className="text-2xl font-extrabold tracking-wide text-doom-text bg-transparent border-b border-transparent hover:border-doom-border focus:border-doom-red focus:outline-none transition-colors px-1 py-0.5 max-w-lg"
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
              className="text-xs text-doom-muted bg-transparent border-b border-transparent hover:border-doom-border focus:border-doom-red focus:outline-none transition-colors px-1 py-0.5 w-full max-w-xl mt-0.5 placeholder-zinc-700"
            />
          </div>
        </div>

        {/* Primary Action Toolbar */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Validate Button */}
          <Button
            variant="secondary"
            size="md"
            onClick={runValidation}
            isLoading={isValidating}
            leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          >
            Validate
          </Button>

          {/* Export YAML */}
          <Button
            variant="secondary"
            size="md"
            onClick={handleExportYAML}
            leftIcon={<Download className="w-4 h-4 text-doom-muted" />}
            title="Export profile as YAML specification"
          >
            Export YAML
          </Button>

          {/* Duplicate Profile */}
          <Button
            variant="secondary"
            size="md"
            onClick={handleDuplicate}
            leftIcon={<Copy className="w-4 h-4 text-doom-muted" />}
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
            className="text-doom-muted hover:text-red-400 hover:bg-red-950/30"
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          {/* Prominent Blood Red PLAY Launch Button */}
          <Button
            variant={
              validation?.status === 'CANNOT_LAUNCH'
                ? 'secondary'
                : validation?.status === 'READY_WITH_WARNINGS'
                ? 'primary'
                : 'primary'
            }
            size="lg"
            onClick={handleLaunch}
            disabled={isLaunching || validation?.status === 'CANNOT_LAUNCH'}
            isLoading={isLaunching}
            leftIcon={
              !isLaunching && (
                <Play className="w-5 h-5 fill-current transition-transform group-hover:scale-110" />
              )
            }
            className={clsx(
              'px-6 font-bold uppercase tracking-wider text-base shadow-xl transition-all',
              validation?.status === 'CANNOT_LAUNCH'
                ? 'opacity-40 cursor-not-allowed border-zinc-700 bg-zinc-900 text-zinc-500'
                : validation?.status === 'READY_WITH_WARNINGS'
                ? 'bg-gradient-to-r from-amber-700 via-red-600 to-doom-red hover:from-amber-600 hover:to-red-500 text-white shadow-amber-950/50'
                : 'bg-gradient-to-r from-red-800 via-doom-red to-red-600 hover:from-red-700 hover:to-red-500 text-white shadow-red-950/60 ring-1 ring-red-500/50'
            )}
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
        <div className="p-4 rounded-lg border border-doom-border bg-doom-card flex flex-col gap-3 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-doom-text flex items-center gap-2">
              <Cpu className="w-4 h-4 text-doom-red" />
              Source Port Engine
            </label>
            {selectedEngineObj && (
              <Badge variant="cyan" size="xs">
                {selectedEngineObj.family}
              </Badge>
            )}
          </div>

          <select
            value={engineId}
            onChange={(e) => handleEngineSelect(e.target.value)}
            className="w-full bg-doom-surface border border-doom-border rounded px-3 py-2.5 text-sm text-doom-text focus:outline-none focus:ring-1 focus:ring-doom-red focus:border-doom-red font-medium"
          >
            <option value="">-- Select Doom Engine --</option>
            {engines.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.name} {eng.version ? `(${eng.version})` : ''} - [{eng.family}]
              </option>
            ))}
          </select>

          {selectedEngineObj ? (
            <div className="flex flex-col gap-1 text-xs text-doom-muted font-mono bg-doom-surface/60 p-2.5 rounded border border-doom-border/60">
              <div className="flex items-center justify-between">
                <span className="text-doom-text font-semibold">{selectedEngineObj.name}</span>
                {selectedEngineObj.version && (
                  <span className="text-[11px] text-zinc-400">v{selectedEngineObj.version}</span>
                )}
              </div>
              <span className="truncate text-[11px] text-zinc-500" title={selectedEngineObj.executable}>
                {selectedEngineObj.executable}
              </span>
            </div>
          ) : (
            <div className="text-xs text-amber-400/90 flex items-center gap-1.5 p-2 rounded bg-amber-950/20 border border-amber-800/40">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>No engine selected. Game cannot launch without a source port.</span>
            </div>
          )}
        </div>

        {/* IWAD Selector Card */}
        <div className="p-4 rounded-lg border border-doom-border bg-doom-card flex flex-col gap-3 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-doom-text flex items-center gap-2">
              <Disc className="w-4 h-4 text-doom-red" />
              Base Game IWAD
            </label>
            {selectedIWADObj && (
              <Badge variant="blue" size="xs">
                {selectedIWADObj.type}
              </Badge>
            )}
          </div>

          <select
            value={iwadId}
            onChange={(e) => handleIWADSelect(e.target.value)}
            className="w-full bg-doom-surface border border-doom-border rounded px-3 py-2.5 text-sm text-doom-text focus:outline-none focus:ring-1 focus:ring-doom-red focus:border-doom-red font-medium"
          >
            <option value="">-- Select Game IWAD --</option>
            {iwads.map((iwad) => (
              <option key={iwad.id} value={iwad.id}>
                {iwad.name} ({iwad.type.toUpperCase()}) - {iwad.lumpCount} lumps
              </option>
            ))}
          </select>

          {selectedIWADObj ? (
            <div className="flex flex-col gap-1 text-xs text-doom-muted font-mono bg-doom-surface/60 p-2.5 rounded border border-doom-border/60">
              <div className="flex items-center justify-between">
                <span className="text-doom-text font-semibold">{selectedIWADObj.name}</span>
                <span className="text-[11px] text-zinc-400">{selectedIWADObj.lumpCount} lumps</span>
              </div>
              <span className="truncate text-[11px] text-zinc-500" title={selectedIWADObj.path}>
                {selectedIWADObj.path}
              </span>
            </div>
          ) : (
            <div className="text-xs text-amber-400/90 flex items-center gap-1.5 p-2 rounded bg-amber-950/20 border border-amber-800/40">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>No IWAD selected. Game requires DOOM2.WAD, DOOM.WAD, or compatible IWAD.</span>
            </div>
          )}
        </div>
      </div>

      {/* Mod Load Order Management Section */}
      <div className="p-4 rounded-lg border border-doom-border bg-doom-card flex flex-col gap-4 shadow-sm">
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

      {/* Advanced Configuration Accordion */}
      <div className="rounded-lg border border-doom-border bg-doom-card/50 overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-doom-card hover:bg-zinc-800/60 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-doom-muted" />
            <span className="text-xs font-bold uppercase tracking-wider text-doom-text">
              Advanced Configuration
            </span>
            {(workingDir || parsedArguments.length > 0) && (
              <Badge variant="muted" size="xs">
                Configured
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-doom-muted">
            <span className="text-xs">
              {isAdvancedOpen ? 'Collapse' : 'Expand'}
            </span>
            {isAdvancedOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {isAdvancedOpen && (
          <div className="p-4 border-t border-doom-border flex flex-col gap-4 bg-doom-surface/40 animate-in slide-in-from-top-1 duration-150">
            {/* Custom Launch Arguments */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-doom-text flex items-center justify-between">
                <span>Custom Launch Arguments</span>
                <span className="text-[11px] font-mono text-doom-muted font-normal">
                  e.g. -skill 4 -warp MAP01 +sv_cheats 1 +cl_run 1
                </span>
              </label>
              <Input
                type="text"
                value={argumentsText}
                onChange={(e) => {
                  setArgumentsText(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                onBlur={() => handleSave({ arguments: parsedArguments })}
                placeholder="-skill 4 -warp 01"
                leftIcon={<Terminal className="w-4 h-4" />}
              />

              {/* Parsed Token Badges */}
              {parsedArguments.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <span className="text-[11px] font-mono text-doom-muted">Parsed tokens:</span>
                  {parsedArguments.map((tok, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-doom-surface border border-doom-border text-cyan-300 font-semibold"
                    >
                      {tok}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Working Directory */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-doom-text flex items-center justify-between">
                <span>Custom Working Directory</span>
                <span className="text-[11px] text-doom-muted font-normal">
                  Leave blank to use engine default directory
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
                    placeholder="Defaults to engine directory if unset"
                    leftIcon={<FolderOpen className="w-4 h-4" />}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleBrowseWorkingDir}
                  leftIcon={<FolderOpen className="w-4 h-4 text-doom-red" />}
                >
                  Browse...
                </Button>
                {workingDir && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setWorkingDir('');
                      handleSave({ workingDir: '' });
                    }}
                    className="text-doom-muted hover:text-doom-text text-xs"
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
    </div>
  );
};
