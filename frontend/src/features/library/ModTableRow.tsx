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

export const ModTableRow: React.FC<ModTableRowProps> = ({
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
    } else {
      setIsDeleting(false);
    }
  };

  const fileName = mod.path ? mod.path.split(/[\/\\]/).pop() || mod.name : mod.name;

  return (
    <tr
      onClick={() => onInspect(mod)}
      className="group border-b border-[#22262d] transition-colors duration-100 hover:bg-[#181c21] cursor-pointer text-xs select-none"
    >
      {/* 1. Star */}
      <td className={cn('w-9 text-center', cellPadding)}>
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
              mod.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-zinc-600 group-hover:text-zinc-400'
            )}
          />
        </button>
      </td>

      {/* 2. Format: Single quiet format pill */}
      <td className={cn('w-16 whitespace-nowrap', cellPadding)}>
        <span
          className={cn(
            'inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-medium border uppercase tracking-wider',
            getFormatBadgeStyle(mod.format)
          )}
        >
          {mod.format.toUpperCase()}
        </span>
      </td>

      {/* 3. Name */}
      <td className={cellPadding}>
        <div className="min-w-0 max-w-md">
          <span
            className="font-medium text-zinc-100 group-hover:text-white tracking-normal block truncate"
            title={mod.name}
          >
            {mod.name}
          </span>
          {showFilePaths ? (
            <span className="font-mono text-[10px] text-zinc-500 block truncate" title={mod.path}>
              {mod.path}
            </span>
          ) : fileName !== mod.name ? (
            <span className="font-mono text-[10px] text-zinc-500 block truncate" title={mod.path}>
              {fileName}
            </span>
          ) : null}
        </div>
      </td>

      {/* 4. Category: Plain text, no badge soup */}
      <td className={cn('hidden sm:table-cell whitespace-nowrap text-zinc-400 font-normal', cellPadding)}>
        {mod.category || 'Other'}
      </td>

      {/* 5. Size */}
      <td className={cn('font-mono text-[11px] text-zinc-400 whitespace-nowrap', cellPadding)}>
        {formatBytes(mod.size)}
      </td>

      {/* 6. Usage: "Active in X setups" */}
      <td className={cn('hidden md:table-cell whitespace-nowrap text-zinc-400', cellPadding)}>
        {usageCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-400/90 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Active in {usageCount} {usageCount === 1 ? 'setup' : 'setups'}
          </span>
        ) : (
          <span className="text-zinc-600">-</span>
        )}
      </td>

      {/* 7. Actions */}
      <td className={cn('text-right whitespace-nowrap', cellPadding)}>
        <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
          {/* 1-click "+ Add to Setup" action */}
          <button
            type="button"
            title="Add to Setup"
            onClick={(e) => {
              e.stopPropagation();
              onAddToProfile(mod);
            }}
            className="inline-flex items-center gap-1 rounded bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#86efac] border border-[#10b981]/30 px-2 py-0.5 text-xs font-medium transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>+ Add to Setup</span>
          </button>

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
              onOpenFolder(mod.path);
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
      </td>
    </tr>
  );
};
