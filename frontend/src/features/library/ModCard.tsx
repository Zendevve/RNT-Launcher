import React, { useState } from 'react';
import {
  Star,
  Eye,
  Plus,
  FolderOpen,
  Trash2,
} from 'lucide-react';
import { Mod, ModFormat, UiDensity } from '../../types';
import { formatBytes } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { DeleteModConfirmModal } from './DeleteModConfirmModal';

interface ModCardProps {
  mod: Mod;
  usageCount?: number;
  showFilePaths?: boolean;
  density?: UiDensity;
  onInspect: (mod: Mod) => void;
  onToggleFavorite: (modId: string) => Promise<void>;
  onDelete: (modId: string) => Promise<void>;
  onAddToProfile: (mod: Mod) => void;
  onOpenFolder?: (path: string) => Promise<void>;
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

export const ModCard: React.FC<ModCardProps> = ({
  mod,
  usageCount = 0,
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(mod.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const fileName = mod.path ? mod.path.split(/[\/\\]/).pop() || mod.name : mod.name;

  return (
    <>
    <div
      onClick={() => onInspect(mod)}
      className={cn(
        'group relative flex flex-col justify-between rounded-lg border border-[#22262d] bg-[#14171c] transition-colors duration-100 ease-out hover:border-[#2f3540] hover:bg-[#181c21] cursor-pointer select-none',
        isCompact ? 'p-3' : 'p-4'
      )}
    >
      {/* Top Header: Format Pill, Category Text, Favorite Star */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Single quiet format pill */}
            <span
              className={cn(
                'inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-medium border uppercase tracking-wider shrink-0',
                getFormatBadgeStyle(mod.format)
              )}
            >
              {mod.format.toUpperCase()}
            </span>

            {/* Category text (plain text, no badge soup) */}
            <span className="text-xs text-zinc-400 truncate">
              {mod.category || 'Other'}
            </span>
          </div>

          {/* Favorite Star */}
          <button
            type="button"
            title={mod.isFavorite ? 'Remove favorite' : 'Add favorite'}
            onClick={handleFavorite}
            disabled={isFavLoading}
            className="rounded p-1 text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-50 shrink-0"
          >
            <Star
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                mod.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-zinc-600 group-hover:text-zinc-400'
              )}
            />
          </button>
        </div>

        {/* Mod Name & Filename */}
        <div className="mt-2">
          <h3
            className="line-clamp-1 text-sm font-medium text-zinc-100 group-hover:text-white"
            title={mod.name}
          >
            {mod.name}
          </h3>
          {showFilePaths ? (
            <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500" title={mod.path}>
              {mod.path}
            </p>
          ) : fileName !== mod.name ? (
            <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500" title={mod.path}>
              {fileName}
            </p>
          ) : null}
        </div>

        {/* Metadata: Size & Setup Usage */}
        <div className="mt-2.5 flex items-center justify-between text-xs text-zinc-400">
          <span className="font-mono text-[11px] text-zinc-400">
            {formatBytes(mod.size)}
          </span>

          {usageCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Active in {usageCount} {usageCount === 1 ? 'setup' : 'setups'}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-500">Not in setups</span>
          )}
        </div>
      </div>

      {/* Action Footer: 1-click "+ Add to Setup" button and secondary actions */}
      <div className="mt-3 pt-2.5 border-t border-[#22262d] flex items-center justify-between gap-1.5">
        <button
          type="button"
          title="Add to Active Setup"
          onClick={(e) => {
            e.stopPropagation();
            onAddToProfile(mod);
          }}
          className="inline-flex items-center gap-1 rounded bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#86efac] border border-[#10b981]/30 px-2.5 py-1 text-xs font-medium transition-colors"
        >
          <Plus className="h-3 w-3" />
          <span>+ Add to Setup</span>
        </button>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Inspect Mod"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(mod);
            }}
            className="rounded p-1 text-zinc-400 hover:bg-[#22262d] hover:text-zinc-200 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Show in Folder"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFolder?.(mod.path);
            }}
            className="rounded p-1 text-zinc-400 hover:bg-[#22262d] hover:text-zinc-200 transition-colors"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Delete Mod"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded p-1 text-zinc-400 hover:bg-red-950/40 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
    <DeleteModConfirmModal
      isOpen={showDeleteConfirm}
      modName={mod.name}
      isDeleting={isDeleting}
      onClose={() => setShowDeleteConfirm(false)}
      onConfirm={handleConfirmDelete}
    />
    </>
  );
};
