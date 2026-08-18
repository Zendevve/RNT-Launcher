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
import { formatBytes, formatRelativeTime } from '../../utils/formatters';

interface ModTableRowProps {
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

export const ModTableRow: React.FC<ModTableRowProps> = ({
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
    <tr
      onClick={() => onInspect(mod)}
      className="group cursor-pointer border-b border-doom-border/50 transition-colors hover:bg-doom-card/50"
    >
      {/* Favorite Star */}
      <td className="w-10 px-3 py-3 text-center">
        <button
          type="button"
          title={mod.isFavorite ? 'Remove favorite' : 'Add favorite'}
          onClick={handleFavorite}
          disabled={isFavLoading}
          className="rounded p-1 text-doom-muted transition-colors hover:text-doom-amber disabled:opacity-50"
        >
          <Star
            className={`h-4 w-4 transition-colors ${
              mod.isFavorite ? 'fill-doom-amber text-doom-amber' : ''
            }`}
          />
        </button>
      </td>

      {/* Mod Name & Filename */}
      <td className="max-w-[280px] px-4 py-3">
        <div className="flex flex-col">
          <span className="truncate font-mono text-xs font-bold text-doom-text group-hover:text-white" title={mod.name}>
            {mod.name}
          </span>
          <span className="truncate font-mono text-[11px] text-doom-muted" title={mod.path}>
            {fileName}
          </span>
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded bg-doom-card px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-doom-muted border border-doom-border/60">
          {mod.category || 'Other'}
        </span>
      </td>

      {/* Format */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${getFormatBadgeColor(
            mod.format
          )}`}
        >
          {mod.format.toUpperCase()}
        </span>
      </td>

      {/* Size */}
      <td className="px-4 py-3 font-mono text-xs text-doom-muted">
        {formatBytes(mod.size)}
      </td>

      {/* Lumps & Structures */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1 font-mono text-[11px] text-doom-muted">
          <span>{mod.lumpCount} lumps</span>
          {mod.structures && mod.structures.length > 0 && (
            <div className="flex items-center gap-1 ml-1">
              {mod.structures.slice(0, 2).map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-0.5 rounded bg-doom-card px-1.5 py-0.5 text-[9px] text-doom-cyan border border-doom-cyan/20"
                >
                  <CheckCircle2 className="h-2.5 w-2.5 text-doom-cyan" />
                  {s}
                </span>
              ))}
              {mod.structures.length > 2 && (
                <span className="text-[9px] text-doom-muted">+{mod.structures.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </td>

      {/* Modified / Added Date */}
      <td className="px-4 py-3 font-mono text-xs text-doom-muted">
        {formatRelativeTime(mod.modifiedAt || mod.createdAt)}
      </td>

      {/* Action Buttons */}
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            title="Inspect Mod"
            onClick={() => onInspect(mod)}
            className="rounded p-1.5 text-doom-muted transition-colors hover:bg-doom-card hover:text-doom-cyan"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Add to Profile"
            onClick={() => onAddToProfile(mod)}
            className="rounded p-1.5 text-doom-muted transition-colors hover:bg-doom-card hover:text-doom-green"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Open Folder in Explorer"
            onClick={() => onOpenFolder(mod.path)}
            className="rounded p-1.5 text-doom-muted transition-colors hover:bg-doom-card hover:text-doom-text"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Delete Mod"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded p-1.5 text-doom-muted transition-colors hover:bg-doom-red/20 hover:text-doom-red-bright disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};
