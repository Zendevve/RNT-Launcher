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

  // Count active mods
  const enabledCount = mods.filter((m) => m.enabled).length;
  const totalCount = mods.length;

  // Filtered mods if user types search
  const filteredMods = mods.filter(
    (m) =>
      m.modName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (m.modPath && m.modPath.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    // Minimal handler to prevent flicker
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...mods];
    const [movedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, movedItem);

    // Update order indices
    const updated = reordered.map((item, idx) => ({
      ...item,
      order: idx,
    }));

    onReorder(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Reorder button actions
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const reordered = [...mods];
    const temp = reordered[index - 1];
    reordered[index - 1] = reordered[index];
    reordered[index] = temp;

    const updated = reordered.map((item, idx) => ({ ...item, order: idx }));
    onReorder(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= mods.length - 1) return;
    const reordered = [...mods];
    const temp = reordered[index + 1];
    reordered[index + 1] = reordered[index];
    reordered[index] = temp;

    const updated = reordered.map((item, idx) => ({ ...item, order: idx }));
    onReorder(updated);
  };

  const handleMoveToTop = (index: number) => {
    if (index <= 0) return;
    const reordered = [...mods];
    const [item] = reordered.splice(index, 1);
    reordered.unshift(item);

    const updated = reordered.map((modItem, idx) => ({ ...modItem, order: idx }));
    onReorder(updated);
  };

  const handleMoveToBottom = (index: number) => {
    if (index >= mods.length - 1) return;
    const reordered = [...mods];
    const [item] = reordered.splice(index, 1);
    reordered.push(item);

    const updated = reordered.map((modItem, idx) => ({ ...modItem, order: idx }));
    onReorder(updated);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-doom-border/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-doom-red" />
            <h3 className="text-sm font-bold tracking-wide uppercase text-doom-text">
              Mod Load Order
            </h3>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-doom-card text-doom-muted border border-doom-border">
            {enabledCount} of {totalCount} active
          </span>
        </div>

        <div className="flex items-center gap-2">
          {totalCount > 0 && (
            <>
              {/* Quick filter in load order */}
              {totalCount > 5 && (
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-doom-muted pointer-events-none" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter load order..."
                    className="bg-doom-surface border border-doom-border rounded text-xs text-doom-text pl-7 pr-2 py-1 focus:outline-none focus:ring-1 focus:ring-doom-red w-36 placeholder-zinc-600"
                  />
                </div>
              )}

              {/* Toggle all */}
              {onToggleAll && (
                <div className="flex items-center rounded border border-doom-border overflow-hidden bg-doom-card">
                  <button
                    type="button"
                    onClick={() => onToggleAll(true)}
                    className="px-2 py-1 text-xs text-doom-muted hover:text-emerald-400 hover:bg-zinc-800 transition-colors flex items-center gap-1"
                    title="Enable all mods"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">All</span>
                  </button>
                  <div className="w-px h-3 bg-doom-border" />
                  <button
                    type="button"
                    onClick={() => onToggleAll(false)}
                    className="px-2 py-1 text-xs text-doom-muted hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-1"
                    title="Disable all mods"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">None</span>
                  </button>
                </div>
              )}

              {/* Clear all */}
              {onClearAll && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearAll}
                  className="text-doom-muted hover:text-red-400 text-xs px-2"
                  title="Remove all mods from profile"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </>
          )}

          {/* Add Mods Trigger */}
          <Button
            variant="primary"
            size="sm"
            onClick={onAddModsClick}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Mods
          </Button>
        </div>
      </div>

      {/* Mods List / Empty State */}
      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed border-doom-border/70 bg-doom-card/20 text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-doom-card border border-doom-border flex items-center justify-center text-doom-muted">
            <Layers className="w-6 h-6 text-doom-muted" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-doom-text">No Mods in Load Order</h4>
            <p className="text-xs text-doom-muted max-w-sm mt-1">
              Add WADs, PK3s, or patches to customize your gameplay. Mods are loaded in top-to-bottom sequence.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onAddModsClick}
            leftIcon={<Plus className="w-4 h-4 text-doom-red" />}
            className="mt-1"
          >
            Select Mods from Library
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 min-h-[100px]">
          {filteredMods.length === 0 ? (
            <div className="p-4 text-center text-xs text-doom-muted border border-doom-border rounded bg-doom-surface">
              No mods matching filter &quot;{searchFilter}&quot;
            </div>
          ) : (
            filteredMods.map((mod, idx) => (
              <LoadOrderItem
                key={mod.modId || `${mod.id}-${idx}`}
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
            ))
          )}
        </div>
      )}
    </div>
  );
};
