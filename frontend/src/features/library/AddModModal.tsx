import React, { useState } from 'react';
import {
  X,
  FolderOpen,
  UploadCloud,
  FilePlus,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Mod, ModCategory } from '../../types';
import { api } from '../../services/api';

interface AddModModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModAdded: (mod: Mod) => void;
}

const CATEGORIES: ModCategory[] = [
  'Gameplay',
  'Maps',
  'Megawads',
  'Weapons',
  'Monsters',
  'Textures',
  'Audio',
  'UI',
  'Utility',
  'Other',
];

export const AddModModal: React.FC<AddModModalProps> = ({
  isOpen,
  onClose,
  onModAdded,
}) => {
  const [filePath, setFilePath] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ModCategory>('Gameplay');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  if (!isOpen) return null;

  const handleBrowseFile = async () => {
    try {
      setErrorMessage(null);
      const selected = await api.openFileDialog(
        'Select Doom Mod or Archive',
        '',
        ['*.pk3', '*.wad', '*.pk7', '*.ipk3', '*.zip', '*.deh', '*.bex']
      );
      if (selected) {
        setFilePath(selected);
      }
    } catch (err: unknown) {
      console.error('File dialog error:', err);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPath = filePath.trim();
    if (!cleanPath) {
      setErrorMessage('Please specify or browse for a valid mod file path.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const importedMod = await api.importModFile(cleanPath);
      onModAdded(importedMod);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import mod file';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      let path = file.name;
      if ('path' in file && typeof file.path === 'string') {
        path = file.path;
      }
      if (path) {
        setFilePath(path);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-lg border border-doom-border bg-doom-surface text-doom-text shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-doom-border px-6 py-4 bg-doom-card/80">
          <div className="flex items-center gap-2.5">
            <FilePlus className="h-5 w-5 text-doom-red" />
            <h2 className="font-mono text-base font-bold uppercase tracking-wider text-white">
              Add Mod to Library
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-doom-muted hover:bg-doom-surface hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleImport} className="p-6 space-y-5">
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded border border-doom-red/40 bg-doom-red/10 p-3 text-xs font-mono text-doom-red-bright">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Drag & Drop Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all duration-200 ${
              isDragOver
                ? 'border-doom-red bg-doom-red/5'
                : 'border-doom-border/80 bg-doom-card/30 hover:border-doom-border-bright'
            }`}
          >
            <UploadCloud className="h-8 w-8 text-doom-muted mb-2" />
            <p className="font-mono text-xs font-semibold text-doom-text">
              {'Drag & Drop Doom Mod File Here'}
            </p>
            <p className="mt-1 text-[11px] font-mono text-doom-muted">
              Supports .WAD, .PK3, .PK7, .IPK3, .ZIP, .DEH, .BEX
            </p>
          </div>

          {/* File Path Input */}
          <div>
            <label className="block font-mono text-xs font-semibold uppercase tracking-wider text-doom-muted mb-1.5">
              File Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="e.g. D:/Doom/Mods/brutalv21.pk3"
                className="flex-1 rounded border border-doom-border bg-doom-card px-3 py-2 font-mono text-xs text-doom-text placeholder-doom-muted/50 focus:border-doom-red focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleBrowseFile}
                className="inline-flex items-center gap-1.5 rounded border border-doom-border bg-doom-card px-3.5 py-2 font-mono text-xs text-doom-text hover:bg-doom-surface hover:border-doom-border-bright transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5 text-doom-cyan" />
                <span>Browse...</span>
              </button>
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block font-mono text-xs font-semibold uppercase tracking-wider text-doom-muted mb-1.5">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as ModCategory)}
              className="w-full rounded border border-doom-border bg-doom-card px-3 py-2 font-mono text-xs text-doom-text focus:border-doom-red focus:outline-hidden"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-doom-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded px-4 py-2 font-mono text-xs text-doom-muted hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isLoading || !filePath.trim()}
              className="inline-flex items-center gap-2 rounded bg-doom-red px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-doom-red/20 transition-colors hover:bg-doom-red-bright disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Inspecting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Import Mod</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
