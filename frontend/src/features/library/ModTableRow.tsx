import React, { useState } from 'react';
import {
  Star,
  Eye,
  Plus,
  FolderOpen,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { Mod, ModFormat, UiDensity } from '../../types';
import { formatBytes, formatRelativeTime } from '../../utils/formatters';
import { cn } from '../../utils/cn';

interface ModTableRowProps {
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

export const ModTableRow: React.FC<ModTableRowProps> = ({
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
  const cellPadding = isCompact ? 'px-3 py-2' : 'px-4 py-3';

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
    <tr
      onClick={() => onInspect(mod)}
      className="group border-b border-white/[0.05] transition-colors hover:bg-white/[0.03] cursor-pointer text-xs select-none"
    >
      {/* Favorite Star */}
      <td className={cn('w-8 text-center', cellPadding)}>
        <button
          type="button"
          title={mod.isFavorite ? 'Remove favorite' : 'Add favorite'}
          onClick={handleFavorite}
          disabled={isFavLoading}
          className="rounded p-1 text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-50"
        >
          <Star
            className={cn(
              'h-3.5 w-3.5 transition-colors',
              mod.isFavorite ? 'fill-amber-400 text-amber-400' : ''
            )}
          />
        </button>
      </td>

      {/* Mod Name & Path */}
      <td className={cellPadding}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider shrink-0',
              getFormatBadgeColor(mod.format)
            )}
          >
            {mod.format.toUpperCase()}
          </span>
          <div className="min-w-0">
            <span className="font-bold text-zinc-100 group-hover:text-white tracking-tight block truncate" title={mod.name}>
              {mod.name}
            </span>
            {showFilePaths ? (
              <span className="font-mono text-[10px] text-zinc-400 block truncate" title={mod.path}>
                {mod.path}
              </span>
            ) : fileName !== mod.name ? (
              <span className="font-mono text-[10px] text-zinc-500 block truncate" title={mod.path}>
                {fileName}
              </span>
            ) : null}
          </div>
        </div>
      </td>

      {/* Category */}
      <td className={cn('hidden sm:table-cell', cellPadding)}>
        <span className="inline-flex items-center rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-zinc-400 border border-white/[0.06]">
          {mod.category || 'Other'}
        </span>
      </td>

      {/* Detected Structures */}
      <td className={cn('hidden md:table-cell', cellPadding)}>
        <div className="flex flex-wrap gap-1">
          {mod.structures && mod.structures.length > 0 ? (
            mod.structures.slice(0, 2).map((struct) => (
              <span
                key={struct}
                className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] font-mono text-blue-400 border border-blue-800/30"
              >
                <CheckCircle2 className="h-2.5 w-2.5 text-blue-400" />
                {struct}
              </span>
            ))
          ) : (
            <span className="text-zinc-600 font-mono text-[10px]">-</span>
          )}
          {mod.structures && mod.structures.length > 2 && (
            <span className="inline-flex items-center rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-mono text-zinc-400 border border-white/[0.06]">
              +{mod.structures.length - 2}
            </span>
          )}
        </div>
      </td>

      {/* Size */}
      <td className={cn('font-mono text-[11px] text-zinc-400 whitespace-nowrap', cellPadding)}>
        {formatBytes(mod.size)}
      </td>

      {/* Profile Usage */}
      <td className={cn('hidden lg:table-cell whitespace-nowrap', cellPadding)}>
        {usageCount !== undefined && usageCount > 0 ? (
          <span className="inline-flex items-center rounded-full bg-[#132232] border border-blue-800/30 px-2 py-0.5 font-mono text-[10px] text-[#93c5fd]">
            {usageCount} profile{usageCount === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="font-mono text-[10px] text-zinc-600">-</span>
        )}
      </td>

      {/* Date Added */}
      <td className={cn('hidden xl:table-cell font-mono text-[10px] text-zinc-500 whitespace-nowrap', cellPadding)}>
        {formatRelativeTime(mod.createdAt)}
      </td>

      {/* Row Actions */}
      <td className={cn('text-right whitespace-nowrap', cellPadding)}>
        <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            title="Inspect Mod"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(mod);
            }}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-white/[0.08] hover:text-blue-400 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Add to Active Setup"
            onClick={(e) => {
              e.stopPropagation();
              onAddToProfile(mod);
            }}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-emerald-950/40 hover:text-emerald-300 transition-colors active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Show in Folder"
            onClick={(e) => {
              e.stopPropagation();
              onOpenFolder(mod.path);
            }}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-colors"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Delete Mod"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-red-950/40 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};
