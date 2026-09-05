import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  CheckSquare,
  Square,
  Layers,
  Plus,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Mod, ModCategory } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';

export interface SelectModsModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingModIds: string[];
  onAddMods: (selectedMods: Mod[]) => void;
}

const CATEGORIES: { id: ModCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Categories' },
  { id: 'gameplay', label: 'Gameplay' },
  { id: 'maps', label: 'Maps' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'monsters', label: 'Monsters' },
  { id: 'textures', label: 'Textures' },
  { id: 'sound', label: 'Sound' },
  { id: 'total-conversion', label: 'Total Conv.' },
  { id: 'utility', label: 'Utility' },
  { id: 'other', label: 'Other' },
];

export const SelectModsModal: React.FC<SelectModsModalProps> = ({
  isOpen,
  onClose,
  existingModIds,
  onAddMods,
}) => {
  const [allMods, setAllMods] = useState<Mod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ModCategory | 'all'>('all');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [selectedModIds, setSelectedModIds] = useState<Set<string>>(new Set());

  // Load mods from library on modal open
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      api
        .listMods()
        .then((mods) => {
          setAllMods(mods || []);
        })
        .catch((err: unknown) => {
          console.error('Failed to load mods library:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
      // Reset selections
      setSelectedModIds(new Set());
      setSearchQuery('');
      setSelectedCategory('all');
      setSelectedFormat('all');
    }
  }, [isOpen]);

  const existingSet = useMemo(() => new Set(existingModIds), [existingModIds]);

  // Filter mods
  const filteredMods = useMemo(() => {
    return allMods.filter((mod) => {
      const matchesSearch =
        searchQuery === '' ||
        mod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (mod.path && mod.path.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategory === 'all' || mod.category?.toLowerCase() === selectedCategory.toLowerCase();

      const matchesFormat =
        selectedFormat === 'all' || mod.format?.toLowerCase() === selectedFormat.toLowerCase();

      return matchesSearch && matchesCat && matchesFormat;
    });
  }, [allMods, searchQuery, selectedCategory, selectedFormat]);

  // Unadded mods currently in filtered view
  const availableFilteredMods = useMemo(() => {
    return filteredMods.filter((m) => !existingSet.has(m.id));
  }, [filteredMods, existingSet]);

  const toggleSelectMod = (id: string) => {
    if (existingSet.has(id)) return;
    setSelectedModIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedModIds);
    availableFilteredMods.forEach((m) => next.add(m.id));
    setSelectedModIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedModIds(new Set());
  };

  const handleInvertSelection = () => {
    const next = new Set<string>();
    availableFilteredMods.forEach((m) => {
      if (!selectedModIds.has(m.id)) {
        next.add(m.id);
      }
    });
    setSelectedModIds(next);
  };

  const handleConfirm = () => {
    const toAdd = allMods.filter((m) => selectedModIds.has(m.id));
    onAddMods(toAdd);
    onClose();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span className="rounded-[8px] bg-[#0c0c0f] border border-[#2d2d34] p-1.5 text-[#5e7ce2]">
            <Layers className="h-4 w-4" />
          </span>
          <span>Select Mods from Library</span>
        </div>
      }
      description="Choose one or more mods to add to the active profile load order."
      size="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-doom-muted font-mono">
            {selectedModIds.size} mod{selectedModIds.size === 1 ? '' : 's'} selected
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={selectedModIds.size === 0}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add {selectedModIds.size > 0 ? `(${selectedModIds.size}) ` : ''}Selected Mods
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search mods by name or path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Format dropdown */}
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="bg-doom-surface border border-doom-border rounded text-xs text-doom-text px-3 py-2 focus:outline-none focus:ring-1 focus:ring-doom-red"
            >
              <option value="all">All Formats</option>
              <option value="pk3">PK3 / IPK3</option>
              <option value="wad">WAD</option>
              <option value="pk7">PK7</option>
              <option value="deh">DEH / BEX</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-doom-red text-white border-red-500 shadow-sm'
                  : 'bg-doom-surface text-doom-muted border-doom-border hover:border-doom-border-bright hover:text-doom-text'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Bulk Selection Actions Bar */}
        <div className="flex items-center justify-between text-xs py-1 border-y border-doom-border/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              disabled={availableFilteredMods.length === 0}
              className="text-doom-muted hover:text-doom-text disabled:opacity-40 flex items-center gap-1 transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Select All
            </button>
            <span className="text-doom-border">|</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={selectedModIds.size === 0}
              className="text-doom-muted hover:text-doom-text disabled:opacity-40 flex items-center gap-1 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              Deselect All
            </button>
            <span className="text-doom-border">|</span>
            <button
              type="button"
              onClick={handleInvertSelection}
              disabled={availableFilteredMods.length === 0}
              className="text-doom-muted hover:text-doom-text disabled:opacity-40 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Invert
            </button>
          </div>

          <div className="text-doom-muted font-mono text-[11px]">
            Showing {filteredMods.length} of {allMods.length} mods
          </div>
        </div>

        {/* Mod List */}
        <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="p-8 text-center text-doom-muted text-sm flex items-center justify-center gap-2">
              <span className="animate-spin">⚙️</span> Loading mods library...
            </div>
          ) : filteredMods.length === 0 ? (
            <div className="p-8 text-center text-doom-muted text-sm border border-dashed border-doom-border rounded bg-doom-card/30">
              No mods found matching current filter criteria.
            </div>
          ) : (
            filteredMods.map((mod) => {
              const isAlreadyAdded = existingSet.has(mod.id);
              const isSelected = selectedModIds.has(mod.id);

              return (
                <div
                  key={mod.id}
                  onClick={() => !isAlreadyAdded && toggleSelectMod(mod.id)}
                  className={`flex items-center gap-3 p-2.5 rounded border transition-all duration-150 select-none ${
                    isAlreadyAdded
                      ? 'bg-zinc-900/60 border-zinc-800/80 opacity-50 cursor-not-allowed'
                      : isSelected
                      ? 'bg-red-950/30 border-doom-red text-doom-text shadow-sm cursor-pointer'
                      : 'bg-doom-surface border-doom-border hover:border-doom-border-bright text-doom-text cursor-pointer'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="shrink-0 text-doom-muted">
                    {isAlreadyAdded ? (
                      <Check className="w-4 h-4 text-zinc-500" />
                    ) : isSelected ? (
                      <CheckSquare className="w-4 h-4 text-doom-red" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-600 hover:text-zinc-400" />
                    )}
                  </div>

                  {/* Mod Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate text-doom-text">
                        {mod.name}
                      </span>
                      <Badge variant={mod.format} size="xs">
                        {mod.format || 'MOD'}
                      </Badge>
                      {mod.category && (
                        <Badge variant={mod.category} size="xs">
                          {mod.category}
                        </Badge>
                      )}
                      {isAlreadyAdded && (
                        <Badge variant="muted" size="xs">
                          In Profile
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-mono text-doom-muted mt-0.5 truncate">
                      {mod.size > 0 && <span>{formatFileSize(mod.size)}</span>}
                      {mod.lumpCount ? <span>{mod.lumpCount} lumps</span> : null}
                      <span className="truncate">{mod.path}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
