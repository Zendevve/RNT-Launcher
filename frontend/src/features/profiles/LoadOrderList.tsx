import React, { useState } from 'react';
import { Layers, Plus, CheckSquare, Square, Trash2, Search } from 'lucide-react';
import { ProfileMod } from '../../types';
import { LoadOrderItem } from './LoadOrderItem';
import { Button } from '../../components/ui/Button';

export interface LoadOrderListProps {
  mods: ProfileMod[];
  onReorder: (newOrderedMods: ProfileMod[]) => void;
  onToggle: (modId: string, enabled: boolean) => void;
  onRemove: (modId: string) => void;
  onAddModsClick: () => void;
  onToggleAll?: (enabled: boolean) => void;
  onClearAll?: () => void;
}

export const LoadOrderList: React.FC<LoadOrderListProps> = ({
  mods,
  onReorder,
  onToggle,
  onRemove,
  onAddModsClick,
  onToggleAll,
  onClearAll,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const enabledCount = mods.filter((m) => m.enabled).length;
  const totalCount = mods.length;

  const filteredMods = mods.filter(
    (m) =>
      m.modName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (m.modPath && m.modPath.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index.toString());
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    // Keep clean
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...mods];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);

    const reordered = updated.map((m, idx) => ({ ...m, order: idx }));
    onReorder(reordered);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...mods];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    onReorder(updated.map((m, idx) => ({ ...m, order: idx })));
  };

  const handleMoveDown = (index: number) => {
    if (index >= mods.length - 1) return;
    const updated = [...mods];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    onReorder(updated.map((m, idx) => ({ ...m, order: idx })));
  };

  const handleMoveToTop = (index: number) => {
    if (index === 0) return;
    const updated = [...mods];
    const [item] = updated.splice(index, 1);
    updated.unshift(item);
    onReorder(updated.map((m, idx) => ({ ...m, order: idx })));
  };

  const handleMoveToBottom = (index: number) => {
    if (index === mods.length - 1) return;
    const updated = [...mods];
    const [item] = updated.splice(index, 1);
    updated.push(item);
    onReorder(updated.map((m, idx) => ({ ...m, order: idx })));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden gap-3">
      {/* Workshop Header & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#22262d]">
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-zinc-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
            Mod Load Order
          </h3>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#101317] text-zinc-400 border border-[#22262d]">
            {enabledCount} of {totalCount} active
          </span>
        </div>

        {/* Clear toolbar: + Add Mods, Enable All, Disable All, Clear */}
        <div className="flex items-center gap-2">
          {totalCount > 4 && (
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter load order..."
                className="bg-[#101317] border border-[#22262d] rounded-md text-xs text-zinc-200 pl-7 pr-2.5 py-1 focus:outline-none focus:border-zinc-500 w-36 placeholder-zinc-500 font-normal"
              />
            </div>
          )}

          {totalCount > 0 && onToggleAll && (
            <div className="flex items-center rounded-md border border-[#22262d] bg-[#101317] overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => onToggleAll(true)}
                className="px-2.5 py-1 text-zinc-400 hover:text-emerald-400 hover:bg-[#181f26] transition-colors flex items-center gap-1.5"
                title="Enable all mods"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Enable All</span>
              </button>
              <div className="w-px h-3.5 bg-[#22262d]" />
              <button
                type="button"
                onClick={() => onToggleAll(false)}
                className="px-2.5 py-1 text-zinc-400 hover:text-zinc-200 hover:bg-[#181f26] transition-colors flex items-center gap-1.5"
                title="Disable all mods"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Disable All</span>
              </button>
            </div>
          )}

          {totalCount > 0 && onClearAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="text-zinc-500 hover:text-red-400 text-xs px-2.5 h-7"
              title="Remove all mods from this preset"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={onAddModsClick}
            leftIcon={<Plus className="w-3.5 h-3.5 text-zinc-300" />}
            className="text-xs h-7 px-3 bg-[#181f26] hover:bg-[#202732] border-[#22262d] text-zinc-100 font-medium"
          >
            + Add Mods
          </Button>
        </div>
      </div>

      {/* Mods List / Dense Table / Empty State */}
      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-6 rounded-lg border border-dashed border-[#22262d] bg-[#101317]/50 text-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#14171c] border border-[#22262d] flex items-center justify-center text-zinc-500">
            <Layers className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-zinc-200">
              No mods loaded in this setup. Playing vanilla Doom.
            </h4>
            <p className="text-[11px] text-zinc-500 max-w-sm">
              Add WADs, PK3s, or DEH patches to customize this launch preset. Mods load in top-to-bottom order.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onAddModsClick}
            leftIcon={<Plus className="w-3.5 h-3.5 text-zinc-300" />}
            className="mt-1 text-xs bg-[#181f26] hover:bg-[#202732] border-[#22262d] text-zinc-100"
          >
            Add Mods from Library
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Dense Clean Table Header Row */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 border-b border-[#22262d]/60 mb-1.5 select-none">
            <span className="w-5 text-center shrink-0">#</span>
            <span className="w-3.5 shrink-0" />
            <span className="w-4 shrink-0" />
            <span className="w-48 sm:w-56 lg:w-64 shrink-0">Mod Name</span>
            <span className="w-14 shrink-0">Format</span>
            <span className="flex-1 min-w-0">File Path</span>
            <span className="shrink-0 text-right pr-2">Actions</span>
          </div>

          {filteredMods.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-500 border border-[#22262d] rounded-lg bg-[#101317]">
              No mods matching &quot;{searchFilter}&quot;
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 flex flex-col gap-1.5">
              {filteredMods.map((mod, idx) => (
                <LoadOrderItem
                  mod={mod}
                  index={idx}
                  totalCount={filteredMods.length}
                  isDragging={draggedIndex === idx}
                  isDragOver={dragOverIndex === idx}
                  onToggle={onToggle}
                  onRemove={onRemove}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onMoveToTop={handleMoveToTop}
                  onMoveToBottom={handleMoveToBottom}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
