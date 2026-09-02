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
import { motion, AnimatePresence } from 'motion/react';
import { Mod, FileInfo } from '../../types';
import { api } from '../../services/api';
import { formatBytes, formatDate } from '../../utils/formatters';
import { drawerVariants, scrimVariants } from '../../lib/springs';

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
  const [artwork, setArtwork] = useState<{ hasArt: boolean; lumpName: string; dataUri: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  return (
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
            className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-white/[0.08] bg-[#15181c] text-zinc-200 shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-[#132232] p-2 text-[#93c5fd] border border-blue-800/30">
                  <FileCode className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white line-clamp-1 tracking-tight" title={mod.name}>
                      {mod.name}
                    </h2>
                    <span className="rounded-full bg-[#132232] px-2.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-[#93c5fd] border border-blue-800/30">
                      {mod.format.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium">{mod.category || 'General Mod'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title={mod.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
                  onClick={() => onToggleFavorite(mod.id)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-amber-400 transition-colors"
                >
                  <Star
                    className={`h-4 w-4 ${mod.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {isLoading ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 text-zinc-400">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                  <span className="font-mono text-xs">Parsing file headers and lump directory...</span>
                </div>
              ) : (
                <>
                  {/* Artwork Banner Card */}
                  {artwork?.hasArt && artwork.dataUri && (
                    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-black/40">
                      <div className="absolute top-2 right-2 z-10">
                        <span className="px-2 py-0.5 rounded-full bg-black/80 text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#93c5fd] border border-white/[0.1]">
                          {artwork.lumpName || 'ARTWORK'}
                        </span>
                      </div>
                      <div className="flex items-center justify-center p-3">
                        <img
                          src={artwork.dataUri}
                          alt={`${mod.name} ${artwork.lumpName}`}
                          className="max-h-52 w-auto object-contain rounded-lg border border-white/[0.08]"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Section 1: File Properties & Metadata */}
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                      <HardDrive className="h-3.5 w-3.5 text-blue-400" />
                      <span>File Properties</span>
                    </h3>

                    <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs font-mono">
                      {/* File Path */}
                      <div>
                        <div className="text-[11px] text-zinc-400 mb-1 flex items-center justify-between">
                          <span>Full Path</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(mod.path, 'path')}
                              className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition-colors"
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
                              className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-blue-400 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Show in Folder</span>
                            </button>
                          </div>
                        </div>
                        <div className="break-all rounded-lg bg-black/40 px-2.5 py-1.5 text-zinc-200 border border-white/[0.06]">
                          {mod.path}
                        </div>
                      </div>

                      {/* Size & Lump Count Grid */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <span className="text-[11px] text-zinc-400">File Size</span>
                          <div className="mt-0.5 text-white font-semibold">
                            {formatBytes(fileInfo?.size || mod.size)}{' '}
                            <span className="text-zinc-400 font-normal">
                              ({(fileInfo?.size || mod.size).toLocaleString()} bytes)
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] text-zinc-400">Total Lumps / Files</span>
                          <div className="mt-0.5 text-white font-semibold">
                            {fileInfo?.lumpCount || mod.lumpCount || 0}{' '}
                            <span className="text-zinc-400 font-normal">entries</span>
                          </div>
                        </div>
                      </div>

                      {/* SHA-256 Hash */}
                      <div className="pt-2">
                        <div className="text-[11px] text-zinc-400 mb-1 flex items-center justify-between">
                          <span>SHA-256 Checksum</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(fileInfo?.sha256 || mod.sha256, 'hash')}
                            className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition-colors"
                          >
                            {copiedField === 'hash' ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span>{copiedField === 'hash' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <div className="break-all rounded-lg bg-black/40 px-2.5 py-1.5 text-[11px] text-zinc-300 border border-white/[0.06]">
                          {fileInfo?.sha256 || mod.sha256 || 'Not computed'}
                        </div>
                      </div>

                      {/* Created / Modified Date */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/[0.06]">
                        <div>
                          <span className="text-[11px] text-zinc-400">Date Added</span>
                          <div className="mt-0.5 text-zinc-300">{formatDate(mod.createdAt)}</div>
                        </div>
                        <div>
                          <span className="text-[11px] text-zinc-400">Last Modified</span>
                          <div className="mt-0.5 text-zinc-300">{formatDate(mod.updatedAt)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Detected Engine Features & Script Structures */}
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                      <Cpu className="h-3.5 w-3.5 text-blue-400" />
                      <span>{'Script & Engine Lump Features'}</span>
                    </h3>

                    <div className="grid grid-cols-2 gap-2">
                      {KNOWN_STRUCTURES.map((struct) => {
                        const isPresent = detectedStructures.includes(struct.name);
                        return (
                          <div
                            key={struct.name}
                            className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition-colors ${
                              isPresent
                                ? 'border-blue-800/40 bg-[#132232] text-zinc-100'
                                : 'border-white/[0.04] bg-black/20 text-zinc-500 opacity-60'
                            }`}
                          >
                            {isPresent ? (
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
                            ) : (
                              <MinusCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
                            )}
                            <div className="min-w-0">
                              <div className="font-mono text-xs font-bold">{struct.name}</div>
                              <div className="text-[10px] leading-tight text-zinc-400 line-clamp-2">
                                {struct.desc}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 3: Embedded Maps */}
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                      <MapPin className="h-3.5 w-3.5 text-amber-400" />
                      <span>
                        Embedded Maps ({detectedMaps.length})
                      </span>
                    </h3>

                    {detectedMaps.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/30 p-3">
                        {detectedMaps.map((mapName) => (
                          <span
                            key={mapName}
                            className="rounded-full border border-amber-800/40 bg-[#2b2011] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#fde047]"
                          >
                            {mapName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3 text-xs font-mono text-zinc-500">
                        No map markers (MAPxx / ExMx) detected in this file.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Drawer Bottom Actions */}
            <div className="flex items-center justify-between border-t border-white/[0.07] px-6 py-4 bg-black/30">
              <button
                type="button"
                onClick={() => onDelete(mod.id)}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-800/30 bg-[#2b1416] px-3 py-2 text-xs font-semibold text-[#fca5a5] hover:bg-red-950/60 hover:text-white transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Mod</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddToProfile(mod);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#dc2626] hover:bg-[#c02020] px-4 py-2 text-xs font-semibold text-white border border-red-500/30 transition-colors active:scale-[0.98]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add to Profile</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
