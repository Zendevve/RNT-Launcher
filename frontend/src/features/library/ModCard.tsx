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
      return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50';
    case 'wad':
    case 'pwad':
      return 'bg-sky-950/60 text-sky-400 border-sky-800/50';
    case 'pk7':
    case 'ipk3':
      return 'bg-amber-950/60 text-amber-400 border-amber-800/50';
    case 'zip':
      return 'bg-purple-950/60 text-purple-400 border-purple-800/50';
    case 'deh':
    case 'bex':
      return 'bg-rose-950/60 text-rose-400 border-rose-800/50';
    default:
      return 'bg-zinc-800 text-zinc-300 border-zinc-700';
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
    if (isFavLoading) return;
    try {
      setIsFavLoading(true);
      await onToggleFavorite(mod.id);
    } finally {
      setIsFavLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    if (window.confirm(`Delete "${mod.name}" from mod library?`)) {
      try {
        setIsDeleting(true);
        await onDelete(mod.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const fileName = mod.path ? mod.path.split(/[\/\\]/).pop() || mod.name : mod.name;

  return (
    <div
      onClick={() => onInspect(mod)}
      className={cn(
        'group relative flex flex-col justify-between rounded-lg border border-doom-border bg-doom-surface/80 transition-all duration-200 hover:border-doom-border-bright hover:bg-doom-surface hover:shadow-lg hover:shadow-black/50 cursor-pointer',
        isCompact ? 'p-3' : 'p-4'
      )}
    >
      {/* Top Header: Format, Category & Favorite Toggle */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Format Badge */}
            <span
              className={cn(
                'inline-flex items-center rounded border px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase tracking-wider',
                getFormatBadgeColor(mod.format)
              )}
            >
              {mod.format.toUpperCase()}
            </span>

            {/* Category Badge */}
            <span className="inline-flex items-center rounded bg-doom-card px-1.5 py-0.2 font-mono text-[9px] font-semibold uppercase tracking-wider text-doom-muted border border-doom-border/60">
              {mod.category || 'Other'}
            </span>

            {/* Profile Usage Badge */}
            {usageCount !== undefined && usageCount > 0 && (
              <span
                className="inline-flex items-center rounded bg-doom-cyan/15 border border-doom-cyan/30 px-1.5 py-0.2 font-mono text-[9px] font-medium text-doom-cyan"
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
            className="rounded p-1 text-doom-muted transition-colors hover:bg-doom-card hover:text-doom-amber disabled:opacity-50"
          >
            <Star
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                mod.isFavorite ? 'fill-doom-amber text-doom-amber' : ''
              )}
            />
          </button>
        </div>

        {/* Mod Name & Filename */}
        <div className={cn(isCompact ? 'mt-2' : 'mt-3')}>
          <h3 className="line-clamp-1 font-mono text-xs font-bold text-doom-text group-hover:text-white" title={mod.name}>
            {mod.name}
          </h3>
          {showFilePaths ? (
            <p className="mt-0.5 truncate font-mono text-[10px] text-doom-muted" title={mod.path}>
              {mod.path}
            </p>
          ) : fileName !== mod.name ? (
            <p className="mt-0.5 truncate font-mono text-[10px] text-doom-muted/70" title={mod.path}>
              {fileName}
            </p>
          ) : null}
        </div>

        {/* Metadata stats: Size & Lumps */}
        <div className={cn('flex items-center gap-2 text-[10px] font-mono text-doom-muted', isCompact ? 'mt-1.5' : 'mt-2.5')}>
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
                className="inline-flex items-center gap-1 rounded bg-doom-card/90 px-1 py-0.2 text-[8.5px] font-mono text-doom-cyan border border-doom-cyan/20"
              >
                <CheckCircle2 className="h-2 w-2 text-doom-cyan" />
                {struct}
              </span>
            ))}
            {mod.structures.length > 3 && (
              <span className="inline-flex items-center rounded bg-doom-card px-1 py-0.2 text-[8.5px] font-mono text-doom-muted">
                +{mod.structures.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className={cn('pt-2 border-t border-doom-border/60 flex items-center justify-between gap-1.5', isCompact ? 'mt-2.5' : 'mt-3.5')}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Inspect Mod Internals"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(mod);
            }}
            className="inline-flex items-center gap-1 rounded bg-doom-card px-2 py-0.5 text-[11px] font-mono text-doom-text transition-colors hover:bg-doom-border hover:text-white"
          >
            <Eye className="h-3 w-3 text-doom-cyan" />
            <span>Inspect</span>
          </button>

          <button
            type="button"
            title="Add to Profile"
            onClick={(e) => {
              e.stopPropagation();
              onAddToProfile(mod);
            }}
            className="inline-flex items-center gap-1 rounded bg-doom-card px-1.5 py-0.5 text-[11px] font-mono text-doom-text transition-colors hover:bg-doom-border hover:text-white"
          >
            <Plus className="h-3 w-3 text-doom-green" />
            <span>Profile</span>
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
            className="rounded p-1 text-doom-muted transition-colors hover:bg-doom-card hover:text-doom-text"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Delete Mod"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded p-1 text-doom-muted transition-colors hover:bg-doom-red/20 hover:text-doom-red-bright disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
