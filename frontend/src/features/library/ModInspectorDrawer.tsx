import React, { useEffect, useState } from 'react';
import {
  X,
  Copy,
  Check,
  FolderOpen,
  Plus,
  Star,
  Trash2,
  FileCode,
  MapPin,
  HardDrive,
  Cpu,
  Loader2,
  CheckCircle2,
  MinusCircle,
  ExternalLink,
} from 'lucide-react';
import { Mod, FileInfo } from '../../types';
import { api } from '../../services/api';
import { formatBytes, formatDate } from '../../utils/formatters';

interface ModInspectorDrawerProps {
  mod: Mod | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToProfile: (mod: Mod) => void;
  onToggleFavorite: (modId: string) => Promise<void>;
  onDelete: (modId: string) => Promise<void>;
  onOpenFolder: (path: string) => Promise<void>;
}

const KNOWN_STRUCTURES = [
  { name: 'MAPINFO', desc: 'Map definitions, episode metadata & clusters' },
  { name: 'ZSCRIPT', desc: 'Modern GZDoom object scripting language' },
  { name: 'DECORATE', desc: 'Actor, monster & weapon definitions' },
  { name: 'SNDINFO', desc: 'Sound curve and lump associations' },
  { name: 'TEXTURES', desc: 'Custom wall and flat texture definitions' },
  { name: 'GLDEFS', desc: 'Dynamic lights and glowing flats shaders' },
  { name: 'ANIMATED', desc: 'Animated wall textures and flats' },
  { name: 'SWITCHES', desc: 'Interactive switch textures' },
  { name: 'DEHACKED', desc: 'DeHackEd vanilla game engine patch' },
  { name: 'CVARINFO', desc: 'Custom user console variables and options' },
  { name: 'MENUDEF', desc: 'Custom in-game menus and config GUI' },
  { name: 'VOXELDEF', desc: '3D voxel actor definitions' },
];

export const ModInspectorDrawer: React.FC<ModInspectorDrawerProps> = ({
  mod,
  isOpen,
  onClose,
  onAddToProfile,
  onToggleFavorite,
  onDelete,
  onOpenFolder,
}) => {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !mod) {
      setFileInfo(null);
      return;
    }

    let isCancelled = false;
    const fetchInspection = async () => {
      setIsLoading(true);
      try {
        const info = await api.inspectMod(mod.id);
        if (!isCancelled) {
          setFileInfo(info);
        }
      } catch (err) {
        console.error('Failed to inspect mod:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchInspection();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, mod]);

  if (!isOpen || !mod) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const detectedStructures = fileInfo?.structures || mod.structures || [];
  const detectedMaps = fileInfo?.maps || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs transition-opacity duration-300">
      {/* Backdrop click to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Slide-over Drawer Panel */}
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-doom-border bg-doom-surface text-doom-text shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-doom-border px-6 py-4 bg-doom-card/80">
          <div className="flex items-center gap-3">
            <div className="rounded bg-doom-surface p-2 text-doom-cyan border border-doom-border">
              <FileCode className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-base font-bold text-white line-clamp-1" title={mod.name}>
                  {mod.name}
                </h2>
                <span className="rounded bg-doom-surface px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-doom-cyan border border-doom-border">
                  {mod.format.toUpperCase()}
                </span>
              </div>
              <p className="text-xs font-mono text-doom-muted">{mod.category || 'General Mod'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              title={mod.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
              onClick={() => onToggleFavorite(mod.id)}
              className="rounded p-1.5 text-doom-muted hover:bg-doom-surface hover:text-doom-amber transition-colors"
            >
              <Star
                className={`h-4 w-4 ${mod.isFavorite ? 'fill-doom-amber text-doom-amber' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-doom-muted hover:bg-doom-surface hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-doom-muted">
              <Loader2 className="h-8 w-8 animate-spin text-doom-cyan" />
              <span className="font-mono text-xs">Parsing file headers &amp; lump directory...</span>
            </div>
          ) : (
            <>
              {/* Section 1: File Properties & Metadata */}
              <div>
                <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-doom-muted mb-3">
                  <HardDrive className="h-3.5 w-3.5 text-doom-cyan" />
                  <span>File Properties</span>
                </h3>

                <div className="space-y-2 rounded-lg border border-doom-border bg-doom-card/60 p-4 text-xs font-mono">
                  {/* File Path */}
                  <div>
                    <div className="text-[11px] text-doom-muted mb-1 flex items-center justify-between">
                      <span>Full Path</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(mod.path, 'path')}
                          className="inline-flex items-center gap-1 text-[10px] text-doom-muted hover:text-white"
                        >
                          {copiedField === 'path' ? (
                            <Check className="h-3 w-3 text-doom-green" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          <span>{copiedField === 'path' ? 'Copied' : 'Copy'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenFolder(mod.path)}
                          className="inline-flex items-center gap-1 text-[10px] text-doom-muted hover:text-doom-cyan"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Show in Folder</span>
                        </button>
                      </div>
                    </div>
                    <div className="break-all rounded bg-doom-surface px-2.5 py-1.5 text-doom-text border border-doom-border/60">
                      {mod.path}
                    </div>
                  </div>

                  {/* Size & Lump Count Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <span className="text-[11px] text-doom-muted">File Size</span>
                      <div className="mt-0.5 text-doom-text font-semibold">
                        {formatBytes(fileInfo?.size || mod.size)}{' '}
                        <span className="text-doom-muted font-normal">
                          ({(fileInfo?.size || mod.size).toLocaleString()} bytes)
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-doom-muted">Total Lumps / Files</span>
                      <div className="mt-0.5 text-doom-text font-semibold">
                        {fileInfo?.lumpCount || mod.lumpCount}{' '}
                        <span className="text-doom-muted font-normal">entries</span>
                      </div>
                    </div>
                  </div>

                  {/* SHA-256 Hash */}
                  <div className="pt-2">
                    <div className="text-[11px] text-doom-muted mb-1 flex items-center justify-between">
                      <span>SHA-256 Checksum</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(fileInfo?.sha256 || mod.sha256, 'hash')}
                        className="inline-flex items-center gap-1 text-[10px] text-doom-muted hover:text-white"
                      >
                        {copiedField === 'hash' ? (
                          <Check className="h-3 w-3 text-doom-green" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{copiedField === 'hash' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="break-all font-mono text-[11px] text-doom-muted rounded bg-doom-surface px-2.5 py-1.5 border border-doom-border/60">
                      {fileInfo?.sha256 || mod.sha256 || 'Hash not computed'}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <span className="text-[11px] text-doom-muted">File Modified</span>
                      <div className="mt-0.5 text-doom-text">
                        {formatDate(fileInfo?.modTime || mod.modifiedAt)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-doom-muted">Added to Library</span>
                      <div className="mt-0.5 text-doom-text">
                        {formatDate(mod.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Detected Engine Structures */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-doom-muted">
                    <Cpu className="h-3.5 w-3.5 text-doom-cyan" />
                    <span>Internal Structures</span>
                  </h3>
                  <span className="font-mono text-[11px] text-doom-muted">
                    {detectedStructures.length} detected
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {KNOWN_STRUCTURES.map(({ name, desc }) => {
                    const isPresent = detectedStructures.some(
                      (s) => s.toUpperCase() === name.toUpperCase()
                    );
                    return (
                      <div
                        key={name}
                        className={`flex items-start gap-2.5 rounded-lg border p-3 font-mono transition-colors ${
                          isPresent
                            ? 'border-doom-cyan/40 bg-doom-cyan/5 text-doom-text'
                            : 'border-doom-border/40 bg-doom-card/30 text-doom-muted/60 opacity-60'
                        }`}
                      >
                        {isPresent ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-doom-cyan mt-0.5" />
                        ) : (
                          <MinusCircle className="h-4 w-4 shrink-0 text-doom-muted/40 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold ${isPresent ? 'text-doom-cyan' : ''}`}>
                              {name}
                            </span>
                            {isPresent && (
                              <span className="rounded bg-doom-cyan/20 px-1 py-0.2 text-[9px] text-doom-cyan uppercase">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[10px] leading-tight text-doom-muted">{desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Map / Level Index */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-doom-muted">
                    <MapPin className="h-3.5 w-3.5 text-doom-amber" />
                    <span>Map / Level Index</span>
                  </h3>
                  <span className="font-mono text-[11px] text-doom-muted">
                    {detectedMaps.length > 0
                      ? `${detectedMaps.length} ${detectedMaps.length === 1 ? 'map' : 'maps'} found`
                      : 'No map lumps'}
                  </span>
                </div>

                {detectedMaps.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 rounded-lg border border-doom-border bg-doom-card/50 p-3 max-h-48 overflow-y-auto">
                    {detectedMaps.map((mapName) => (
                      <span
                        key={mapName}
                        className="inline-flex items-center rounded bg-doom-surface px-2.5 py-1 font-mono text-xs font-semibold text-doom-amber border border-doom-amber/30"
                      >
                        {mapName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-doom-border bg-doom-card/30 p-4 text-center text-xs font-mono text-doom-muted">
                    No map markers (MAP01.. or E1M1..) detected in this archive.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Drawer Action Footer */}
        <div className="border-t border-doom-border bg-doom-card/90 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAddToProfile(mod)}
              className="inline-flex items-center gap-1.5 rounded bg-doom-green px-4 py-2 font-mono text-xs font-bold text-black transition-colors hover:bg-doom-green-bright"
            >
              <Plus className="h-4 w-4" />
              <span>Add to Profile</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenFolder(mod.path)}
              className="inline-flex items-center gap-1.5 rounded border border-doom-border bg-doom-surface px-3.5 py-2 font-mono text-xs text-doom-text hover:bg-doom-card"
            >
              <FolderOpen className="h-3.5 w-3.5 text-doom-cyan" />
              <span>Open Folder</span>
            </button>
          </div>

          <button
            type="button"
            onClick={async () => {
              if (window.confirm(`Delete "${mod.name}" from library?`)) {
                await onDelete(mod.id);
                onClose();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded border border-doom-red/40 bg-doom-red/10 px-3 py-2 font-mono text-xs text-doom-red-bright hover:bg-doom-red/20 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Mod</span>
          </button>
        </div>
      </div>
    </div>
  );
};
