import React, { useState } from 'react';
import {
  Star,
  Eye,
  Plus,
  FolderOpen,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { Mod, ModFormat } from '../../types';
import { formatBytes } from '../../utils/formatters';

interface ModCardProps {
  mod: Mod;
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
  onInspect,
  onToggleFavorite,
  onAddToProfile,
  onOpenFolder,
  onDelete,
}) => {
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
      className="group relative flex flex-col justify-between rounded-lg border border-doom-border bg-doom-surface/80 p-4 transition-all duration-200 hover:border-doom-border-bright hover:bg-doom-surface hover:shadow-lg hover:shadow-black/50 cursor-pointer"
    >
      {/* Top Header: Format, Category & Favorite Toggle */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Format Badge */}
            <span
              className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${getFormatBadgeColor(
                mod.format
              )}`}
            >
              {mod.format.toUpperCase()}
            </span>

            {/* Category Badge */}
            <span className="inline-flex items-center rounded bg-doom-card px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-doom-muted border border-doom-border/60">
              {mod.category || 'Other'}
            </span>
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
              className={`h-4 w-4 transition-colors ${
                mod.isFavorite ? 'fill-doom-amber text-doom-amber' : ''
              }`}
            />
          </button>
        </div>

        {/* Mod Name & Filename */}
        <div className="mt-3">
          <h3 className="line-clamp-1 font-mono text-sm font-bold text-doom-text group-hover:text-white" title={mod.name}>
            {mod.name}
          </h3>
          <p className="mt-0.5 truncate font-mono text-[11px] text-doom-muted" title={mod.path}>
            {fileName}
          </p>
        </div>

        {/* Metadata stats: Size & Lumps */}
        <div className="mt-3 flex items-center gap-3 text-[11px] font-mono text-doom-muted">
          <span>{formatBytes(mod.size)}</span>
          <span>•</span>
          <span>{mod.lumpCount} lumps</span>
        </div>

        {/* Detected Structures Chips */}
        {mod.structures && mod.structures.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {mod.structures.slice(0, 4).map((struct) => (
              <span
                key={struct}
                className="inline-flex items-center gap-1 rounded bg-doom-card/90 px-1.5 py-0.5 text-[9px] font-mono text-doom-cyan border border-doom-cyan/20"
              >
                <CheckCircle2 className="h-2.5 w-2.5 text-doom-cyan" />
                {struct}
              </span>
            ))}
            {mod.structures.length > 4 && (
              <span className="inline-flex items-center rounded bg-doom-card px-1.5 py-0.5 text-[9px] font-mono text-doom-muted">
                +{mod.structures.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-doom-border/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Inspect Mod Internals"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(mod);
            }}
            className="inline-flex items-center gap-1 rounded bg-doom-card px-2.5 py-1 text-xs font-mono text-doom-text transition-colors hover:bg-doom-border hover:text-white"
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
            className="inline-flex items-center gap-1 rounded bg-doom-card px-2 py-1 text-xs font-mono text-doom-text transition-colors hover:bg-doom-border hover:text-white"
          >
            <Plus className="h-3 w-3 text-doom-green" />
            <span>Profile</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
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
