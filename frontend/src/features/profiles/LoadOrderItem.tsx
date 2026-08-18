import React from 'react';
import clsx from 'clsx';
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Trash2,
  CheckSquare,
  Square,
  FileCode,
} from 'lucide-react';
import { ProfileMod } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export interface LoadOrderItemProps {
  mod: ProfileMod;
  index: number;
  totalCount: number;
  isDragging?: boolean;
  isDragOver?: boolean;
  onToggle: (modId: string, enabled: boolean) => void;
  onRemove: (modId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onMoveToTop: (index: number) => void;
  onMoveToBottom: (index: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
}

export const LoadOrderItem: React.FC<LoadOrderItemProps> = ({
  mod,
  index,
  totalCount,
  isDragging = false,
  isDragOver = false,
  onToggle,
  onRemove,
  onMoveUp,
  onMoveDown,
  onMoveToTop,
  onMoveToBottom,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}) => {
  const isFirst = index === 0;
  const isLast = index === totalCount - 1;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={clsx(
        'group relative flex items-center gap-3 px-3.5 py-2.5 rounded-md border transition-all duration-150',
        mod.enabled
          ? 'bg-doom-surface border-doom-border hover:border-doom-border-bright text-doom-text'
          : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-500 opacity-60 hover:opacity-80',
        isDragging && 'opacity-30 border-dashed border-red-500 scale-[0.99]',
        isDragOver && 'border-t-2 border-t-doom-red bg-red-950/20 shadow-md',
        'hover:shadow-sm'
      )}
    >
      {/* Drag Grip Handle */}
      <div
        className="cursor-grab active:cursor-grabbing text-doom-muted group-hover:text-doom-text p-0.5 rounded hover:bg-zinc-800 transition-colors"
        title="Drag to reorder mod"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Order Position Badge */}
      <div className="flex items-center justify-center w-6 h-6 rounded bg-doom-card text-[11px] font-mono font-bold text-doom-muted shrink-0 border border-doom-border/60">
        {index + 1}
      </div>

      {/* Enabled/Disabled Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(mod.modId, !mod.enabled)}
        className={clsx(
          'p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-doom-red transition-colors shrink-0',
          mod.enabled
            ? 'text-emerald-400 hover:text-emerald-300'
            : 'text-zinc-500 hover:text-zinc-400'
        )}
        title={mod.enabled ? 'Click to disable mod' : 'Click to enable mod'}
      >
        {mod.enabled ? (
          <CheckSquare className="w-5 h-5" />
        ) : (
          <Square className="w-5 h-5" />
        )}
      </button>

      {/* Mod Info (Icon, Name, Path) */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <FileCode className={clsx('w-4 h-4 shrink-0', mod.enabled ? 'text-doom-muted' : 'text-zinc-600')} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'text-sm font-semibold truncate',
                mod.enabled ? 'text-doom-text' : 'text-zinc-400 line-through'
              )}
              title={mod.modName}
            >
              {mod.modName}
            </span>
            <Badge variant={mod.modFormat || 'wad'} size="xs">
              {mod.modFormat || 'MOD'}
            </Badge>
            {!mod.enabled && (
              <Badge variant="muted" size="xs">
                DISABLED
              </Badge>
            )}
          </div>
          {mod.modPath && (
            <p className="text-[11px] font-mono text-doom-muted truncate mt-0.5" title={mod.modPath}>
              {mod.modPath}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons: Move controls & Remove */}
      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
        {/* Move to Top */}
        <Button
          variant="ghost"
          size="icon"
          disabled={isFirst}
          onClick={() => onMoveToTop(index)}
          title="Move to top"
          className="h-7 w-7 text-doom-muted hover:text-doom-text hover:bg-zinc-800 disabled:opacity-20"
        >
          <ChevronsUp className="w-3.5 h-3.5" />
        </Button>

        {/* Move Up */}
        <Button
          variant="ghost"
          size="icon"
          disabled={isFirst}
          onClick={() => onMoveUp(index)}
          title="Move up"
          className="h-7 w-7 text-doom-muted hover:text-doom-text hover:bg-zinc-800 disabled:opacity-20"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>

        {/* Move Down */}
        <Button
          variant="ghost"
          size="icon"
          disabled={isLast}
          onClick={() => onMoveDown(index)}
          title="Move down"
          className="h-7 w-7 text-doom-muted hover:text-doom-text hover:bg-zinc-800 disabled:opacity-20"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>

        {/* Move to Bottom */}
        <Button
          variant="ghost"
          size="icon"
          disabled={isLast}
          onClick={() => onMoveToBottom(index)}
          title="Move to bottom"
          className="h-7 w-7 text-doom-muted hover:text-doom-text hover:bg-zinc-800 disabled:opacity-20"
        >
          <ChevronsDown className="w-3.5 h-3.5" />
        </Button>

        {/* Separator */}
        <div className="w-px h-4 bg-doom-border mx-0.5" />

        {/* Remove Mod */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(mod.modId)}
          title="Remove mod from profile"
          className="h-7 w-7 text-doom-muted hover:text-red-400 hover:bg-red-950/40"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
