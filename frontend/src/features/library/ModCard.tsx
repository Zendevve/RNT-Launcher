import React, { useState } from 'react';
import {
  Star,
  Eye,
  Plus,
  FolderOpen,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Mod, ModFormat, UiDensity } from '../../types';
import { formatBytes } from '../../utils/formatters';
import { cn } from '../../utils/cn';

interface ModCardProps {
  mod: Mod;
  usageCount?: number;
  showFilePaths?: boolean;
  density?: UiDensity;
  onInspect: (mod: Mod) => void;
  onToggleFavorite: (modId: string) => Promise<void>;
  onAddToProfile: (mod: Mod) => void;
  onOpenFolder: (path: string) => Promise<void>;
  onDelete: (modId: string) => Promise<void>;
}

const getFormatBadgeColor = (format: ModFormat): string => {
  switch (format.toLowerCase()) {
    case 'pk3':
    case 'ipk3':
      return 'bg-[#231830] text-[#d8b4fe] border-purple-800/30';
    case 'wad':
    case 'zip':
      return 'bg-[#132232] text-[#93c5fd] border-blue-800/30';
    case 'pk7':
    case '7z':
      return 'bg-[#122419] text-[#86efac] border-emerald-800/30';
    case 'deh':
    case 'bex':
      return 'bg-[#2b1416] text-[#fca5a5] border-red-800/30';
    default:
      return 'bg-white/[0.04] text-zinc-300 border-white/[0.08]';
  }
};

export const ModCard: React.FC<ModCardProps> = ({
  mod,
  usageCount,
  showFilePaths = false,
  density = 'compact',
  onInspect,
  onToggleFavorite,
  onAddToProfile,
  onOpenFolder,
  onDelete,
}) => {
  const isCompact = density === 'compact';
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFavLoading, setIsFavLoading] = useState(false);

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavLoading(true);
    try {
      await onToggleFavorite(mod.id);
    } finally {
      setIsFavLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    setIsDeleting(true);
    if (window.confirm(`Delete "${mod.name}" from mod library?`)) {
      try {
        await onDelete(mod.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const fileName = mod.path ? mod.path.split(/[\/\\]/).pop() || mod.name : mod.name;

  return (
    <motion.div
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onInspect(mod)}
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#15181c] transition-colors duration-150 hover:border-white/[0.18] hover:bg-[#1a1e24] cursor-pointer select-none',
        isCompact ? 'p-3.5' : 'p-4.5'
      )}
    >
      {/* Top Header: Format, Category & Favorite Toggle */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Format Badge */}
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider',
                getFormatBadgeColor(mod.format)
              )}
            >
              {mod.format.toUpperCase()}
            </span>

            {/* Category Badge */}
            <span className="inline-flex items-center rounded-full bg-white/[0.04] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-zinc-400 border border-white/[0.06]">
              {mod.category || 'Other'}
            </span>

            {/* Profile Usage Badge */}
            {usageCount !== undefined && usageCount > 0 && (
              <span
                className="inline-flex items-center rounded-full bg-[#132232] border border-blue-800/30 px-2 py-0.5 text-[9.5px] font-medium text-[#93c5fd]"
                title={`Active in ${usageCount} profile${usageCount === 1 ? '' : 's'}`}
              >
                {usageCount} {usageCount === 1 ? 'profile' : 'profiles'}
              </span>
            )}
          </div>

          {/* Favorite Star */}
          <button
            type="button"
            title={mod.isFavorite ? 'Remove favorite' : 'Add favorite'}
            onClick={handleFavorite}
            disabled={isFavLoading}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-amber-400 disabled:opacity-50"
          >
            <Star
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                mod.isFavorite ? 'fill-amber-400 text-amber-400' : ''
              )}
            />
          </button>
        </div>

        {/* Mod Name & Filename */}
        <div className={cn(isCompact ? 'mt-2.5' : 'mt-3.5')}>
          <h3 className="line-clamp-1 text-xs font-bold text-zinc-100 group-hover:text-white tracking-tight" title={mod.name}>
            {mod.name}
          </h3>
          {showFilePaths ? (
            <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-400 tracking-tight" title={mod.path}>
              {mod.path}
            </p>
          ) : fileName !== mod.name ? (
            <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500 tracking-tight" title={mod.path}>
              {fileName}
            </p>
          ) : null}
        </div>

        {/* Metadata stats: Size & Lumps */}
        <div className={cn('flex items-center gap-2 text-[10px] font-mono text-zinc-400', isCompact ? 'mt-2' : 'mt-3')}>
          <span>{formatBytes(mod.size)}</span>
          <span>•</span>
          <span>{mod.lumpCount ?? 0} lumps</span>
        </div>

        {/* Detected Structures Chips */}
        {mod.structures && mod.structures.length > 0 && (
          <div className={cn('flex flex-wrap gap-1', isCompact ? 'mt-2' : 'mt-3')}>
            {mod.structures.slice(0, 3).map((struct) => (
              <span
                key={struct}
                className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[8.5px] font-mono text-blue-400 border border-blue-800/30"
              >
                <CheckCircle2 className="h-2 w-2 text-blue-400" />
                {struct}
              </span>
            ))}
            {mod.structures.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[8.5px] font-mono text-zinc-400 border border-white/[0.06]">
                +{mod.structures.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className={cn('pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-1.5', isCompact ? 'mt-2.5' : 'mt-3.5')}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Inspect Mod Internals"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(mod);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white border border-white/[0.06]"
          >
            <Eye className="h-3 w-3 text-blue-400" />
            <span>Inspect</span>
          </button>

          <button
            type="button"
            title="Add to Active Setup"
            onClick={(e) => {
              e.stopPropagation();
              onAddToProfile(mod);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-950/30 hover:bg-emerald-900/40 px-2 py-1 text-[11px] font-medium text-emerald-300 transition-colors hover:text-emerald-200 border border-emerald-800/40 active:scale-[0.98]"
          >
            <Plus className="h-3 w-3 text-emerald-400" />
            <span>+ Add Setup</span>
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Open Folder in Explorer"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFolder(mod.path);
            }}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Delete Mod"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
