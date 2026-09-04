import React, { useEffect, useState } from 'react';
import {
  X,
  Copy,
  Check,
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
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mod, FileInfo, ModFormat } from '../../types';
import { api } from '../../services/api';
import { formatBytes, formatDate } from '../../utils/formatters';
import { drawerVariants, scrimVariants } from '../../lib/springs';
import { acquireModalScrollLock, releaseModalScrollLock } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
interface ModInspectorDrawerProps {
  mod: Mod | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToProfile: (mod: Mod) => void;
  onToggleFavorite: (modId: string) => Promise<void>;
  onDelete: (modId: string) => Promise<void>;
  onOpenFolder: (path: string) => Promise<void>;
}

const getFormatBadgeStyle = (format: ModFormat): string => {
  switch (format.toLowerCase()) {
    case 'pk3':
    case 'ipk3':
      return 'text-[#d8b4fe] bg-[#d8b4fe]/10 border-[#d8b4fe]/20';
    case 'wad':
    case 'zip':
      return 'text-[#93c5fd] bg-[#93c5fd]/10 border-[#93c5fd]/20';
    case 'pk7':
    case '7z':
      return 'text-[#86efac] bg-[#86efac]/10 border-[#86efac]/20';
    case 'deh':
    case 'bex':
      return 'text-[#fca5a5] bg-[#fca5a5]/10 border-[#fca5a5]/20';
    default:
      return 'text-zinc-300 bg-white/[0.05] border-white/[0.08]';
  }
};

const KNOWN_STRUCTURES = [
  { name: 'MAPINFO', desc: 'Map definitions, episode metadata, and clusters' },
  { name: 'ZSCRIPT', desc: 'Modern GZDoom object scripting language' },
  { name: 'DECORATE', desc: 'Actor, monster, and weapon definitions' },
  { name: 'SNDINFO', desc: 'Sound curve and lump associations' },
  { name: 'TEXTURES', desc: 'Custom wall and flat texture definitions' },
  { name: 'GLDEFS', desc: 'Dynamic lights and glowing flats shaders' },
  { name: 'ANIMATED', desc: 'Animated wall textures and flats' },
  { name: 'SWITCHES', desc: 'Interactive switch textures' },
  { name: 'DEHACKED', desc: 'DeHackEd vanilla game engine patch' },
  { name: 'CVARINFO', desc: 'Custom user console variables and options' },
  { name: 'MENUDEF', desc: 'Custom in-game menus and configuration GUI' },
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
  const [artwork, setArtwork] = useState<{ hasArt: boolean; lumpName: string; dataUri: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    acquireModalScrollLock();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      releaseModalScrollLock();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !mod) {
      setFileInfo(null);
      setArtwork(null);
      return;
    }

    let isCancelled = false;
    const fetchInspection = async () => {
      setIsLoading(true);
      try {
        const [info, art] = await Promise.all([
          api.inspectMod(mod.id),
          api.getModArtwork(mod.id).catch(() => ({ hasArt: false, lumpName: '', dataUri: '' })),
        ]);
        if (!isCancelled) {
          setFileInfo(info);
          setArtwork(art);
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

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const detectedStructures = fileInfo?.structures || mod?.structures || [];
  const detectedMaps = fileInfo?.maps || [];

  const content = (
    <AnimatePresence>
      {isOpen && mod && (
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden select-none">
          {/* Backdrop click to close */}
          <motion.div
            variants={scrimVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Slide-over Drawer Panel */}
          <motion.div
            variants={drawerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-[#2d2d34] bg-[#0f0f12] text-[#a1a1aa] shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[#2d2d34] px-6 py-4 bg-[#0c0c0f]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-[8px] p-2 bg-[#0c0c0f] text-[#5e7ce2] border border-[#2d2d34] shrink-0">
                  <FileCode className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium text-[#f4f4f5] tracking-tight truncate" title={mod.name}>
                      {mod.name}
                    </h2>
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-medium border uppercase tracking-wider shrink-0 ${getFormatBadgeStyle(
                        mod.format
                      )}`}
                    >
                      {mod.format.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-[#71717a] font-normal truncate mt-0.5">
                    {mod.category || 'General Mod'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-3">
                <button
                  type="button"
                  title={mod.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
                  onClick={() => onToggleFavorite(mod.id)}
                  className="rounded-[6px] p-1.5 text-[#71717a] hover:bg-white/[0.06] hover:text-amber-400 transition-colors"
                >
                  <Star
                    className={`h-4 w-4 ${mod.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`}
                  />
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close drawer"
                  className="text-[#71717a] hover:text-[#f4f4f5] rounded-md hover:bg-white/[0.06]"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {isLoading ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-zinc-400">
                  <Loader2 className="h-7 w-7 animate-spin text-zinc-400" />
                  <span className="font-mono text-xs">Parsing file headers and lump directory...</span>
                </div>
              ) : (
                <>
                  {/* Extracted Cover Artwork */}
                  {artwork?.hasArt && artwork.dataUri && (
                    <div className="relative overflow-hidden rounded-lg border border-[#22262d] bg-[#0c0e10]">
                      <div className="absolute top-2 right-2 z-10">
                        <span className="px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono font-medium uppercase tracking-wider text-zinc-300 border border-white/10">
                          {artwork.lumpName || 'ARTWORK'}
                        </span>
                      </div>
                      <div className="flex items-center justify-center p-3">
                        <img
                          src={artwork.dataUri}
                          alt={`${mod.name} ${artwork.lumpName}`}
                          className="max-h-48 w-auto object-contain rounded border border-[#22262d]"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Section 1: File Properties & Lump Directory Stats */}
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                      <HardDrive className="h-3.5 w-3.5 text-zinc-400" />
                      <span>File Properties</span>
                    </h3>

                    <div className="space-y-3 rounded-lg border border-[#22262d] bg-[#181c21] p-4 text-xs">
                      {/* File Path */}
                      <div>
                        <div className="text-[11px] text-zinc-400 mb-1 flex items-center justify-between">
                          <span>File Path</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(mod.path, 'path')}
                              className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                              {copiedField === 'path' ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              <span>{copiedField === 'path' ? 'Copied' : 'Copy'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenFolder(mod.path)}
                              className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Show in Folder</span>
                            </button>
                          </div>
                        </div>
                        <div className="break-all rounded bg-[#0c0e10] px-2.5 py-1.5 font-mono text-[11px] text-zinc-300 border border-[#22262d]">
                          {mod.path}
                        </div>
                      </div>

                      {/* Size & Lump Directory Stats Grid */}
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                          <span className="text-[11px] text-zinc-400">File Size</span>
                          <div className="mt-0.5 text-zinc-100 font-medium">
                            {formatBytes(fileInfo?.size || mod.size)}{' '}
                            <span className="text-zinc-500 font-normal font-mono text-[11px]">
                              ({(fileInfo?.size || mod.size).toLocaleString()} bytes)
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] text-zinc-400">Lump Directory Count</span>
                          <div className="mt-0.5 text-zinc-100 font-medium">
                            {fileInfo?.lumpCount || mod.lumpCount || 0}{' '}
                            <span className="text-zinc-500 font-normal text-[11px]">entries</span>
                          </div>
                        </div>
                      </div>

                      {/* SHA-256 Hash Copying */}
                      <div className="pt-2 border-t border-[#22262d]">
                        <div className="text-[11px] text-zinc-400 mb-1 flex items-center justify-between">
                          <span>SHA-256 Checksum</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(fileInfo?.sha256 || mod.sha256, 'hash')}
                            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                          >
                            {copiedField === 'hash' ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span>{copiedField === 'hash' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <div className="break-all rounded bg-[#0c0e10] px-2.5 py-1.5 font-mono text-[11px] text-zinc-300 border border-[#22262d]">
                          {fileInfo?.sha256 || mod.sha256 || 'Not computed'}
                        </div>
                      </div>

                      {/* Added / Modified Timestamps */}
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#22262d] text-[11px]">
                        <div>
                          <span className="text-zinc-400">Date Added</span>
                          <div className="mt-0.5 text-zinc-300">{formatDate(mod.createdAt)}</div>
                        </div>
                        <div>
                          <span className="text-zinc-400">Last Modified</span>
                          <div className="mt-0.5 text-zinc-300">{formatDate(mod.updatedAt)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Detected Engine Features & Script Structures */}
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                      <Cpu className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Script and Engine Lump Features</span>
                    </h3>

                    <div className="grid grid-cols-2 gap-2">
                      {KNOWN_STRUCTURES.map((struct) => {
                        const isPresent = detectedStructures.includes(struct.name);
                        return (
                          <div
                            key={struct.name}
                            className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                              isPresent
                                ? 'border-[#22262d] bg-[#181c21] text-zinc-200'
                                : 'border-[#22262d]/50 bg-[#14171c] text-zinc-500 opacity-60'
                            }`}
                          >
                            {isPresent ? (
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                            ) : (
                              <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
                            )}
                            <div className="min-w-0">
                              <div className="font-mono text-xs font-medium text-zinc-200">
                                {struct.name}
                              </div>
                              <div className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5">
                                {struct.desc}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 3: Embedded Map Markers */}
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                      <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Embedded Maps ({detectedMaps.length})</span>
                    </h3>

                    {detectedMaps.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto rounded-lg border border-[#22262d] bg-[#181c21] p-3">
                        {detectedMaps.map((mapName) => (
                          <span
                            key={mapName}
                            className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-amber-300"
                          >
                            {mapName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-[#22262d] bg-[#181c21] p-3 text-xs text-zinc-500">
                        No map markers (MAPxx or ExMx) detected in this file.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Drawer Bottom Actions */}
            <div className="flex items-center justify-between border-t border-[#2d2d34] px-6 py-4 bg-black/20">
              <Button
                variant="danger"
                onClick={() => onDelete(mod.id)}
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Delete Mod
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={onClose}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    onAddToProfile(mod);
                    onClose();
                  }}
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add to Setup
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
