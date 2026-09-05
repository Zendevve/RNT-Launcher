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
} from 'lucide-react';
import { motion } from 'motion/react';
import { ProfileMod } from '../../types';
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

const getQuietFormatBadgeClass = (format?: string) => {
  const fmt = (format || '').toLowerCase();
  switch (fmt) {
    case 'wad':
    case 'iwad':
    case 'pwad':
      return 'bg-blue-950/40 text-blue-300 border-blue-800/30';
    case 'pk3':
    case 'ipk3':
      return 'bg-purple-950/40 text-purple-300 border-purple-800/30';
    case 'pk7':
    case '7z':
      return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/30';
    case 'deh':
    case 'bex':
      return 'bg-rose-950/40 text-rose-300 border-rose-800/30';
    case 'zip':
      return 'bg-sky-950/40 text-sky-300 border-sky-800/30';
    default:
      return 'bg-zinc-800/60 text-zinc-300 border-zinc-700/40';
  }
};

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
    <motion.div
      layout
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      draggable
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, index)}
      onDragOver={(e) => onDragOver(e as unknown as React.DragEvent, index)}
      onDragLeave={onDragLeave as unknown as () => void}
      onDrop={(e) => onDrop(e as unknown as React.DragEvent, index)}
      onDragEnd={onDragEnd}
      className={clsx(
        'group relative flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors duration-100 ease-out select-none',
        isDragging && 'opacity-40 border-red-500/60 bg-[#181f26]',
        isDragOver && 'border-blue-500/60 bg-[#141b24]',
        !isDragging && !isDragOver && mod.enabled && 'bg-[#14171c] hover:bg-[#181f26] border-[#22262d]',
        !isDragging && !isDragOver && !mod.enabled && 'bg-[#0c0e12]/60 hover:bg-[#14171c]/60 border-[#22262d]/60 opacity-60 hover:opacity-85'
      )}
    >
      {/* 1. Order Index */}
      <span className="font-mono text-xs font-medium text-zinc-500 w-5 text-center shrink-0">
        {index + 1}
      </span>

      {/* 2. Drag handle */}
      <div
        className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300 p-0.5 shrink-0 transition-colors"
        title="Drag to reorder"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* 3. Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(mod.modId, !mod.enabled)}
        className="text-zinc-500 hover:text-white transition-colors shrink-0 focus:outline-none"
        title={mod.enabled ? 'Disable mod' : 'Enable mod'}
      >
        {mod.enabled ? (
          <CheckSquare className="w-4 h-4 text-emerald-400" />
        ) : (
          <Square className="w-4 h-4 text-zinc-600" />
        )}
      </button>

      {/* 4. Mod Name */}
      <div className="w-48 sm:w-56 lg:w-64 shrink-0 min-w-0">
        <span
          className={clsx(
            'text-xs font-medium truncate block tracking-tight',
            mod.enabled ? 'text-zinc-100 group-hover:text-white' : 'text-zinc-500 line-through'
          )}
          title={mod.modName}
        >
          {mod.modName}
        </span>
      </div>

      {/* 5. Quiet Format Pill */}
      <div className="w-14 shrink-0">
        {mod.modFormat ? (
          <span
            className={clsx(
              'inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border',
              getQuietFormatBadgeClass(mod.modFormat)
            )}
          >
            {mod.modFormat}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-zinc-600">-</span>
        )}
      </div>

      {/* 6. File Path (Monospace, Quiet) */}
      <div className="flex-1 min-w-0">
        <span
          className="text-[11px] font-mono text-zinc-500 truncate block hover:text-zinc-400 transition-colors"
          title={mod.modPath}
        >
          {mod.modPath || ''}
        </span>
      </div>

      {/* 7. Action Controls: Reorder & Remove */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          disabled={isFirst}
          onClick={() => onMoveToTop(index)}
          title="Move to top"
          className="p-1 h-6 w-6 text-zinc-500 hover:text-zinc-200 disabled:opacity-20 rounded"
        >
          <ChevronsUp className="w-3.5 h-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          disabled={isFirst}
          onClick={() => onMoveUp(index)}
          title="Move up"
          className="p-1 h-6 w-6 text-zinc-500 hover:text-zinc-200 disabled:opacity-20 rounded"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          disabled={isLast}
          onClick={() => onMoveDown(index)}
          title="Move down"
          className="p-1 h-6 w-6 text-zinc-500 hover:text-zinc-200 disabled:opacity-20 rounded"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          disabled={isLast}
          onClick={() => onMoveToBottom(index)}
          title="Move to bottom"
          className="p-1 h-6 w-6 text-zinc-500 hover:text-zinc-200 disabled:opacity-20 rounded"
        >
          <ChevronsDown className="w-3.5 h-3.5" />
        </Button>

        <div className="w-px h-3.5 bg-[#22262d] mx-0.5" />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(mod.modId)}
          title="Remove from profile"
          className="p-1 h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
};
