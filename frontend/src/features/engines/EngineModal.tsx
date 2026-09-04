import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  FolderOpen,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Terminal,
} from 'lucide-react';
import { Engine, EngineFamily } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

export interface EngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (engine: Engine) => void;
  engine?: Engine | null;
}

interface FamilyOption {
  id: EngineFamily;
  label: string;
  badgeColor: string;
  description: string;
  supportsPK3: boolean;
}

const ENGINE_FAMILIES: FamilyOption[] = [
  {
    id: 'gzdoom',
    label: 'GZDoom',
    badgeColor: 'border-purple-500/50 text-purple-400 bg-purple-950/40',
    description: 'Advanced OpenGL/Vulkan, UDMF & ZScript, PK3/PK7 support',
    supportsPK3: true,
  },
  {
    id: 'zandronum',
    label: 'Zandronum',
    badgeColor: 'border-blue-500/50 text-blue-400 bg-blue-950/40',
    description: 'Multiplayer client/server, Skulltag content, PK3 support',
    supportsPK3: true,
  },
  {
    id: 'dsda-doom',
    label: 'DSDA-Doom',
    badgeColor: 'border-emerald-500/50 text-emerald-400 bg-emerald-950/40',
    description: 'Speedrunning standard, demo fidelity, MBF21 support',
    supportsPK3: false,
  },
  {
    id: 'woof',
    label: 'Woof!',
    badgeColor: 'border-amber-500/50 text-amber-400 bg-amber-950/40',
    description: 'Modern WinMBF continuation, MBF21 & Boom features',
    supportsPK3: false,
  },
  {
    id: 'crispy-doom',
    label: 'Crispy Doom',
    badgeColor: 'border-orange-500/50 text-orange-400 bg-orange-950/40',
    description: 'Enhanced vanilla fidelity, widescreen, uncapped FPS',
    supportsPK3: false,
  },
  {
    id: 'chocolate-doom',
    label: 'Chocolate Doom',
    badgeColor: 'border-yellow-600/50 text-yellow-500 bg-yellow-950/40',
    description: 'Strict 1993 vanilla DOS Doom compatibility',
    supportsPK3: false,
  },
  {
    id: 'prboom-plus',
    label: 'PrBoom+',
    badgeColor: 'border-cyan-500/50 text-cyan-400 bg-cyan-950/40',
    description: 'Classic Boom compatibility and demo playback',
    supportsPK3: false,
  },
  {
    id: 'other',
    label: 'Other Port',
    badgeColor: 'border-zinc-500/50 text-zinc-400 bg-zinc-800/40',
    description: 'Custom, fork, or miscellaneous Doom source port',
    supportsPK3: false,
  },
];

export const EngineModal: React.FC<EngineModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  engine,
}) => {
  const toast = useToast();
  const isEditing = Boolean(engine);

  const [name, setName] = useState('');
  const [executable, setExecutable] = useState('');
  const [family, setFamily] = useState<EngineFamily>('gzdoom');
  const [version, setVersion] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [isDetecting, setIsDetecting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  const isDirty = isEditing && engine
    ? name !== (engine.name || '') ||
      executable !== (engine.executable || '') ||
      family !== (engine.family || 'gzdoom') ||
      version !== (engine.version || '')
    : Boolean(name.trim() || executable.trim() || version.trim() || family !== 'gzdoom');

  const handleRequestClose = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);
  // Initialize or reset form when modal opens or engine prop changes
  useEffect(() => {
    if (isOpen) {
      if (engine) {
        setName(engine.name || '');
        setExecutable(engine.executable || '');
        setFamily(engine.family || 'gzdoom');
        setVersion(engine.version || '');
      } else {
        setName('');
        setExecutable('');
        setFamily('gzdoom');
        setVersion('');
      }
      setValidationStatus(null);
    }
  }, [isOpen, engine]);

  // Helper to extract base filename without extension
  const getExecutableBaseName = (path: string): string => {
    const cleanPath = path.replace(/\\/g, '/');
    const filename = cleanPath.split('/').pop() || '';
    return filename.replace(/\.(exe|AppImage|bin|sh)$/i, '');
  };

  // Auto-detect engine version & family from executable
  const handleDetectVersion = useCallback(
    async (targetPath?: string) => {
      const execPath = targetPath || executable.trim();
      if (!execPath) {
        toast.warning('Executable Path Required', 'Please enter or select an executable path first.');
        return;
      }

      setIsDetecting(true);
      try {
        const result = await api.detectEngineVersion(execPath);
        if (result && result.version && result.version !== 'Unknown') {
          setVersion(result.version);
          if (result.family) {
            setFamily(result.family);
          }
          // If name is blank or matches raw path, synthesize a good display name
          if (!name.trim() || name === getExecutableBaseName(execPath)) {
            const familyObj = ENGINE_FAMILIES.find((f) => f.id === result.family);
            const familyLabel = familyObj ? familyObj.label : result.family;
            setName(`${familyLabel} ${result.version}`);
          }
          toast.success(
            'Engine Detected',
            `Identified ${result.family} (version ${result.version})`
          );
        } else if (result && result.family) {
          setFamily(result.family);
          const familyObj = ENGINE_FAMILIES.find((f) => f.id === result.family);
          const familyLabel = familyObj ? familyObj.label : result.family;
          if (!name.trim()) {
            setName(familyLabel);
          }
          toast.info('Engine Family Identified', `Identified as ${familyLabel}, but version could not be parsed.`);
        } else {
          toast.info('Detection Incomplete', 'Could not determine exact version automatically.');
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error('Detection Failed', message || 'Could not query engine version banner.');
      } finally {
        setIsDetecting(false);
      }
    },
    [executable, name, toast]
  );

  // Validate executable on disk
  const handleValidateExecutable = async () => {
    const execPath = executable.trim();
    if (!execPath) {
      toast.warning('Executable Path Required', 'Please select an executable first.');
      return;
    }

    setIsValidating(true);
    setValidationStatus(null);
    try {
      await api.validateEngineExecutable(execPath);
      setValidationStatus({
        valid: true,
        message: 'Executable exists, is regular file, and is runnable.',
      });
      toast.success('Validation Passed', 'Executable binary is verified and ready to run.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Executable validation failed.';
      setValidationStatus({
        valid: false,
        message,
      });
      toast.error('Validation Failed', message);
    } finally {
      setIsValidating(false);
    }
  };

  // Open native file dialog to browse for executable
  const handleBrowseExecutable = async () => {
    try {
      const selected = await api.openFileDialog('Select Doom Engine Executable', '', [
        '*.exe',
        '*.AppImage',
        '*',
      ]);
      if (selected && selected.trim()) {
        const cleaned = selected.trim();
        setExecutable(cleaned);
        setValidationStatus(null);

        // Derive initial name if empty
        const base = getExecutableBaseName(cleaned);
        if (!name.trim()) {
          setName(base);
        }

        // Trigger automatic version detection on selected binary
        handleDetectVersion(cleaned);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to open file dialog';
      toast.error('File Dialog Error', message);
    }
  };

  // Save handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Validation Error', 'Engine name is required.');
      return;
    }
    if (!executable.trim()) {
      toast.error('Validation Error', 'Executable path is required.');
      return;
    }

    setIsSaving(true);
    try {
      let saved: Engine;
      if (isEditing && engine) {
        const updated: Engine = {
          ...engine,
          name: name.trim(),
          executable: executable.trim(),
          family,
          version: version.trim() || 'Unknown',
        };
        await api.updateEngine(updated);
        saved = updated;
        toast.success('Engine Updated', `Updated "${saved.name}" successfully.`);
      } else {
        const newEngineData: Partial<Engine> = {
          name: name.trim(),
          executable: executable.trim(),
          family,
          version: version.trim() || 'Unknown',
        };
        saved = await api.addEngine(newEngineData);
        toast.success('Engine Added', `Registered "${saved.name}" successfully.`);
      }
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save engine';
      toast.error('Error Saving Engine', message);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedFamilyMeta = ENGINE_FAMILIES.find((f) => f.id === family);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleRequestClose}
        closeOnBackdrop={!isDirty}
        title={
          <div className="flex items-center gap-2.5">
            <span className="rounded-[8px] bg-[#0c0c0f] border border-[#2d2d34] p-1.5 text-[#ef4444]">
              <Cpu className="h-4 w-4" />
            </span>
            <span>{isEditing ? 'Configure Source Port' : 'Register Source Port'}</span>
          </div>
        }
        description={
          isEditing
            ? `Modify settings for "${engine?.name || 'engine'}"`
            : 'Add a new Doom engine executable to your registry'
        }
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button type="button" variant="ghost" onClick={handleRequestClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="engine-form"
              variant="primary"
              isLoading={isSaving}
              leftIcon={<Cpu className="h-4 w-4" />}
            >
              {isEditing ? 'Save Changes' : 'Register Engine'}
            </Button>
          </div>
        }
      >
        <form id="engine-form" onSubmit={handleSave} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
            <span>Executable Path *</span>
            <span className="text-[11px] font-normal text-doom-muted lowercase">
              full path to .exe or binary
            </span>
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={executable}
                onChange={(e) => {
                  setExecutable(e.target.value);
                  setValidationStatus(null);
                }}
                placeholder="e.g. C:\Games\Doom\gzdoom\gzdoom.exe"
                className="font-mono text-xs"
                leftIcon={<Terminal className="h-4 w-4" />}
                required
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleBrowseExecutable}
              leftIcon={<FolderOpen className="h-4 w-4 text-doom-amber" />}
            >
              Browse...
            </Button>
          </div>
        </div>

        {/* Validation / Auto-detection Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-doom-surface/80 rounded border border-doom-border/80">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDetectVersion()}
              isLoading={isDetecting}
              disabled={!executable.trim()}
              leftIcon={<Sparkles className="h-3.5 w-3.5 text-doom-amber" />}
            >
              Auto-Detect Version & Family
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleValidateExecutable}
              isLoading={isValidating}
              disabled={!executable.trim()}
              leftIcon={<CheckCircle2 className="h-3.5 w-3.5 text-doom-green" />}
            >
              Test Executable
            </Button>
          </div>

          {validationStatus && (
            <div className="flex items-center gap-1.5 text-xs">
              {validationStatus.valid ? (
                <span className="flex items-center gap-1 text-emerald-400 font-mono">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Verified Executable
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-400 font-mono">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {validationStatus.message}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Name and Version in 2 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
              Display Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GZDoom 4.14.0"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
              Version
            </label>
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 4.14.0 or v0.27.5"
              className="font-mono text-xs"
            />
          </div>
        </div>

        {/* Engine Family Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
            <span>Engine Family / Architecture</span>
            {selectedFamilyMeta && (
              <span className="text-[11px] font-mono text-doom-cyan">
                {selectedFamilyMeta.supportsPK3 ? '✓ PK3 / PK7 Supported' : '• WAD Only Engine'}
              </span>
            )}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ENGINE_FAMILIES.map((opt) => {
              const isSelected = family === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setFamily(opt.id)}
                  className={`flex flex-col text-left p-2.5 rounded border transition-all duration-150 ${
                    isSelected
                      ? 'bg-red-950/40 border-doom-red text-white shadow-md shadow-red-950/20'
                      : 'bg-doom-surface/60 border-doom-border text-zinc-300 hover:bg-zinc-800/60 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-semibold text-xs text-zinc-100">{opt.label}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase ${
                        isSelected ? 'bg-doom-red text-white' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {opt.id}
                    </span>
                  </div>
                  <p className="text-[10px] text-doom-muted leading-tight line-clamp-2">
                    {opt.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        </form>
      </Modal>

      <Modal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        size="sm"
        title="Discard Unsaved Changes?"
      >
        <div className="space-y-3">
          <p className="text-xs text-[#a1a1aa]">
            You have unsaved changes for{' '}
            <span className="text-[#f4f4f5] font-medium">{name || 'this source port'}</span>. Are
            you sure you want to discard them?
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowDiscardConfirm(false)}>
              Keep Editing
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowDiscardConfirm(false);
                onClose();
              }}
            >
              Discard Changes
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
