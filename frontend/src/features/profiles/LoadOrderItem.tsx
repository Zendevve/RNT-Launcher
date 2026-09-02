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
import { motion } from 'motion/react';
import { ProfileMod } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { springSnappy } from '../../lib/springs';

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
    <motion.div
      layout
      transition={springSnappy}
      draggable
      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, index)}
      onDragOver={(e) => onDragOver(e as unknown as React.DragEvent, index)}
      onDragLeave={onDragLeave as unknown as () => void}
      onDrop={(e) => onDrop(e as unknown as React.DragEvent, index)}
      onDragEnd={onDragEnd}
      className={clsx(
        'group relative flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-colors select-none',
        isDragging && 'opacity-30 border-red-500 scale-[0.98]',
        isDragOver && 'border-blue-400 bg-[#132232]',
        !isDragging && !isDragOver && mod.enabled
          ? 'bg-[#15181c] border-white/[0.08] hover:border-white/[0.18] hover:bg-[#1a1e24]'
          : !isDragging && !isDragOver && !mod.enabled
          ? 'bg-black/30 border-white/[0.04] opacity-55 hover:opacity-85'
          : ''
      )}
    >
      {/* Left side: Grip, Order Number, Checkbox, Mod Name */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Drag handle */}
        <div
          className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300 p-0.5"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Index / Load Order position */}
        <span className="font-mono text-xs font-semibold text-zinc-400 w-5 text-center shrink-0">
          {index + 1}
        </span>

        {/* Checkbox */}
        <button
          type="button"
          onClick={() => onToggle(mod.modId, !mod.enabled)}
          className="text-zinc-400 hover:text-white transition-colors shrink-0 focus:outline-none"
          title={mod.enabled ? 'Disable mod' : 'Enable mod'}
        >
          {mod.enabled ? (
            <CheckSquare className="w-4 h-4 text-emerald-400" />
          ) : (
            <Square className="w-4 h-4 text-zinc-600" />
          )}
        </button>

        {/* Format Icon / Badge */}
        <FileCode className="w-3.5 h-3.5 text-zinc-400 shrink-0 hidden sm:block" />

        {/* Mod details */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'text-xs font-bold truncate tracking-tight',
                mod.enabled ? 'text-zinc-100 group-hover:text-white' : 'text-zinc-500 line-through'
              )}
              title={mod.modName}
            >
              {mod.modName}
            </span>
            {mod.modFormat && (
              <Badge variant={mod.modFormat} size="xs" mono>
                {mod.modFormat.toUpperCase()}
              </Badge>
            )}
          </div>
          {mod.modPath && (
            <span className="text-[10px] font-mono text-zinc-400 truncate -mt-0.5" title={mod.modPath}>
              {mod.modPath}
            </span>
          )}
        </div>
      </div>

      {/* Right side: Reorder Actions and Remove */}
      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
        {/* Move to Top */}
        <Button
          variant="ghost"
          size="icon"
          disabled={isFirst}
          onClick={() => onMoveToTop(index)}
          title="Move to top"
          className="p-1 h-7 w-7 text-zinc-400 hover:text-white rounded-md"
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
          className="p-1 h-7 w-7 text-zinc-400 hover:text-white rounded-md"
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
          className="p-1 h-7 w-7 text-zinc-400 hover:text-white rounded-md"
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
          className="p-1 h-7 w-7 text-zinc-400 hover:text-white rounded-md"
        >
          <ChevronsDown className="w-3.5 h-3.5" />
        </Button>

        {/* Remove */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(mod.modId)}
          title="Remove from profile"
          className="p-1 h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-950/40 rounded-md"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
};
