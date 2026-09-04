import React, { useState } from 'react';
import {
  FolderOpen,
  UploadCloud,
  FilePlus,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Mod, ModCategory } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2.5">
          <span className="rounded-[8px] bg-[#0c0c0f] border border-[#2d2d34] p-1.5 text-[#5e7ce2]">
            <FilePlus className="h-4 w-4" />
          </span>
          <span>Add Mod to Library</span>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-mod-form"
            variant="primary"
            disabled={isLoading || !filePath.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Inspecting...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Import Mod</span>
              </>
            )}
          </Button>
        </div>
      }
    >
      <form id="add-mod-form" onSubmit={handleImport} className="space-y-5">
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-[8px] border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
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
          className={`flex flex-col items-center justify-center rounded-[8px] border-2 border-dashed p-6 transition-all duration-200 ${
            isDragOver
              ? 'border-[#5e7ce2] bg-[#5e7ce2]/10'
              : 'border-[#2d2d34] bg-[#0c0c0f]/50 hover:border-[#3a3a45]'
          }`}
        >
          <UploadCloud className="h-8 w-8 text-[#71717a] mb-2" />
          <p className="text-xs font-medium text-[#f4f4f5]">
            {'Drag & Drop Doom Mod File Here'}
          </p>
          <p className="mt-1 text-[11px] text-[#71717a]">
            Supports .WAD, .PK3, .PK7, .IPK3, .ZIP, .DEH, .BEX
          </p>
        </div>

        {/* File Path Input */}
        <div>
          <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">
            File Path
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="e.g. D:/Doom/Mods/brutalv21.pk3"
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleBrowseFile}
              className="shrink-0"
            >
              <FolderOpen className="h-4 w-4 text-[#5e7ce2]" />
              <span>Browse...</span>
            </Button>
          </div>
        </div>

        {/* Category Selector */}
        <div>
          <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">
            Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ModCategory)}
            className="w-full rounded-[8px] border border-[#2d2d34] bg-[#0c0c0f] px-3 py-2 text-xs text-[#f4f4f5] focus:border-[#5e7ce2] focus:outline-hidden"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="bg-[#0c0c0f] text-[#f4f4f5]">
                {cat}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
};
