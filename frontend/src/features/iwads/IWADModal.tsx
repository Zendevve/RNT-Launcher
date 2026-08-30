import React, { useState, useEffect, useCallback } from 'react';
import {
  Disc,
  FolderOpen,
  CheckCircle2,
  FileCode,
  Hash,
  Copy,
  Check,
} from 'lucide-react';
import { IWAD, IWADType } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { formatBytes } from '../../utils/formatters';

export interface IWADModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (iwad: IWAD) => void;
  iwad?: IWAD | null;
}

interface IWADTypeOption {
  id: IWADType;
  label: string;
  badgeColor: string;
  defaultTitle: string;
  canonicalFile: string;
}

const IWAD_TYPES: IWADTypeOption[] = [
  {
    id: 'doom2',
    label: 'Doom II',
    badgeColor: 'border-amber-500/60 text-amber-400 bg-amber-950/40',
    defaultTitle: 'Doom II: Hell on Earth',
    canonicalFile: 'DOOM2.WAD',
  },
  {
    id: 'doom',
    label: 'The Ultimate DOOM',
    badgeColor: 'border-red-500/60 text-red-400 bg-red-950/40',
    defaultTitle: 'The Ultimate DOOM / DOOM',
    canonicalFile: 'DOOM.WAD',
  },
  {
    id: 'tnt',
    label: 'TNT: Evilution',
    badgeColor: 'border-emerald-500/60 text-emerald-400 bg-emerald-950/40',
    defaultTitle: 'Final Doom: TNT - Evilution',
    canonicalFile: 'TNT.WAD',
  },
  {
    id: 'plutonia',
    label: 'The Plutonia Experiment',
    badgeColor: 'border-cyan-500/60 text-cyan-400 bg-cyan-950/40',
    defaultTitle: 'Final Doom: The Plutonia Experiment',
    canonicalFile: 'PLUTONIA.WAD',
  },
  {
    id: 'heretic',
    label: 'Heretic',
    badgeColor: 'border-purple-500/60 text-purple-400 bg-purple-950/40',
    defaultTitle: 'Heretic: Shadow of the Serpent Riders',
    canonicalFile: 'HERETIC.WAD',
  },
  {
    id: 'hexen',
    label: 'Hexen',
    badgeColor: 'border-indigo-500/60 text-indigo-400 bg-indigo-950/40',
    defaultTitle: 'Hexen: Beyond Heretic',
    canonicalFile: 'HEXEN.WAD',
  },
  {
    id: 'strife',
    label: 'Strife',
    badgeColor: 'border-rose-500/60 text-rose-400 bg-rose-950/40',
    defaultTitle: 'Strife: Quest for the Sigil',
    canonicalFile: 'STRIFE1.WAD',
  },
  {
    id: 'freedoom',
    label: 'Freedoom: Phase 1',
    badgeColor: 'border-blue-500/60 text-blue-400 bg-blue-950/40',
    defaultTitle: 'Freedoom: Phase 1',
    canonicalFile: 'freedoom1.wad',
  },
  {
    id: 'freedoom2',
    label: 'Freedoom: Phase 2',
    badgeColor: 'border-sky-500/60 text-sky-400 bg-sky-950/40',
    defaultTitle: 'Freedoom: Phase 2',
    canonicalFile: 'freedoom2.wad',
  },
  {
    id: 'other',
    label: 'Other / Custom IWAD',
    badgeColor: 'border-zinc-500/60 text-zinc-400 bg-zinc-800/40',
    defaultTitle: 'Custom Game IWAD',
    canonicalFile: '*.WAD',
  },
];

export const IWADModal: React.FC<IWADModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  iwad,
}) => {
  const toast = useToast();
  const isEditing = Boolean(iwad);

  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<IWADType>('doom2');
  const [lumpCount, setLumpCount] = useState<number>(0);
  const [size, setSize] = useState<number>(0);
  const [sha256, setSha256] = useState<string>('');

  const [isInspecting, setIsInspecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Initialize or reset form
  useEffect(() => {
    if (isOpen) {
      if (iwad) {
        setPath(iwad.path || '');
        setName(iwad.name || '');
        setType(iwad.type || 'doom2');
        setLumpCount(iwad.lumpCount || 0);
        setSize(iwad.size || 0);
        setSha256(iwad.sha256 || '');
      } else {
        setPath('');
        setName('');
        setType('doom2');
        setLumpCount(0);
        setSize(0);
        setSha256('');
      }
    }
  }, [isOpen, iwad]);

  // Inspect WAD file to extract lumps, sha256 and auto-detect type without persisting
  const inspectWADFile = useCallback(
    async (filePath: string) => {
      const cleanPath = filePath.trim();
      if (!cleanPath) return;

      setIsInspecting(true);
      try {
        const inspected = await api.inspectIWADFile(cleanPath);
        if (inspected) {
          setName(inspected.name);
          setType(inspected.type);
          setLumpCount(inspected.lumpCount ?? 0);
          setSize(inspected.size ?? 0);
          setSha256(inspected.sha256 || '');

          const typeOption = IWAD_TYPES.find((t) => t.id === inspected.type);
          const lumps = inspected.lumpCount ?? 0;
          toast.success(
            'IWAD Identified',
            `Recognized as ${typeOption ? typeOption.label : inspected.type} (${lumps.toLocaleString()} lumps)`
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not inspect IWAD header';
        toast.warning('IWAD Identification Note', message);
      } finally {
        setIsInspecting(false);
      }
    },
    [toast]
  );

  // Open native file dialog to browse for .WAD
  const handleBrowseIWAD = async () => {
    try {
      const selected = await api.openFileDialog('Select Base Game IWAD', '', [
        '*.wad',
        '*.WAD',
        '*',
      ]);
      if (selected && selected.trim()) {
        const cleanPath = selected.trim();
        setPath(cleanPath);
        await inspectWADFile(cleanPath);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'File dialog error';
      toast.error('Browse Error', message);
    }
  };

  // Copy SHA256 helper
  const handleCopyHash = async () => {
    if (!sha256) return;
    try {
      await navigator.clipboard.writeText(sha256);
      setCopiedHash(true);
      toast.success('Hash Copied', 'SHA-256 checksum copied to clipboard.');
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      toast.error('Clipboard Error', 'Could not copy hash.');
    }
  };

  // Save handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!path.trim()) {
      toast.error('Validation Error', 'IWAD file path is required.');
      return;
    }
    if (!name.trim()) {
      toast.error('Validation Error', 'IWAD display name is required.');
      return;
    }

    setIsSaving(true);
    try {
      let saved: IWAD;
      if (isEditing && iwad) {
        const updated: IWAD = {
          ...iwad,
          name: name.trim(),
          path: path.trim(),
          type,
          lumpCount,
          size,
          sha256,
        };
        await api.updateIWAD(updated);
        saved = updated;
        toast.success('IWAD Updated', `Updated "${saved.name}" successfully.`);
      } else {
        const newIWADData: Partial<IWAD> = {
          name: name.trim(),
          path: path.trim(),
          type,
          lumpCount,
          size,
          sha256,
        };
        saved = await api.addIWAD(newIWADData);
        toast.success('IWAD Registered', `Added "${saved.name}" to base games.`);
      }
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save IWAD';
      toast.error('Error Saving IWAD', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-doom-amber/20 text-doom-amber border border-doom-amber/40">
            <Disc className="h-4 w-4" />
          </div>
          <div>
            <div className="text-base font-bold tracking-wide text-zinc-100 uppercase">
              {isEditing ? 'Edit Base IWAD' : 'Register Base Game IWAD'}
            </div>
            <div className="text-xs text-doom-muted font-normal">
              {isEditing
                ? 'Update IWAD name or game type classification'
                : 'Select a base Doom game file (DOOM2.WAD, DOOM.WAD, TNT.WAD, etc.)'}
            </div>
          </div>
        </div>
      }
      size="xl"
    >
      <form onSubmit={handleSave} className="space-y-5">
        {/* File Path with Browse Button */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
            <span>IWAD File Path *</span>
            <span className="text-[11px] font-normal text-doom-muted lowercase">
              path to .wad base game file
            </span>
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="e.g. C:\Games\Doom\DOOM2.WAD"
                className="font-mono text-xs"
                leftIcon={<FileCode className="h-4 w-4" />}
                required
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleBrowseIWAD}
              isLoading={isInspecting}
              leftIcon={<FolderOpen className="h-4 w-4 text-doom-amber" />}
            >
              Browse WAD...
            </Button>

          </div>
        </div>

        {/* Auto-detected Metadata Bar */}
        {(lumpCount > 0 || size > 0 || sha256) && (
          <div className="p-3 bg-doom-surface rounded border border-doom-border space-y-2 text-xs">
            <div className="flex items-center justify-between text-zinc-400 font-medium">
              <span className="flex items-center gap-1.5 text-zinc-300 font-semibold uppercase text-[11px] tracking-wider">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Verified WAD Header & Metadata
              </span>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span>{lumpCount.toLocaleString()} lumps</span>
                <span>•</span>
                <span>{formatBytes(size)}</span>
              </div>
            </div>

            {sha256 && (
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-doom-border/60">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-doom-muted truncate">
                  <Hash className="h-3 w-3 text-zinc-500 shrink-0" />
                  <span className="text-zinc-500">SHA-256:</span>
                  <span className="text-zinc-300 select-all truncate">{sha256}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
                  title="Copy SHA-256 Checksum"
                >
                  {copiedHash ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Display Name Input */}
        <div>
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
            Display Title / Name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Doom II: Hell on Earth"
            required
          />
        </div>

        {/* Game Type Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
            <span>Base Game Classification</span>
            <span className="text-[11px] text-doom-muted font-normal">
              Used by profiles and mods to set compatible game mode
            </span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {IWAD_TYPES.map((opt) => {
              const isSelected = type === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => {
                    setType(opt.id);
                    if (!name.trim() || IWAD_TYPES.some((t) => t.defaultTitle === name)) {
                      setName(opt.defaultTitle);
                    }
                  }}
                  className={`flex flex-col text-left p-2.5 rounded border transition-all ${
                    isSelected
                      ? 'bg-amber-950/40 border-doom-amber text-white shadow-md shadow-amber-950/20'
                      : 'bg-doom-surface/60 border-doom-border text-zinc-300 hover:bg-zinc-800/60 hover:border-zinc-700'
                  }`}
                >
                  <span className="font-semibold text-xs text-zinc-100 truncate mb-1">
                    {opt.label}
                  </span>
                  <span className="text-[10px] font-mono text-doom-muted truncate">
                    {opt.canonicalFile}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-doom-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSaving}
            leftIcon={<Disc className="h-4 w-4" />}
          >
            {isEditing ? 'Save Changes' : 'Register IWAD'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
