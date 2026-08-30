import React, { useState, useEffect, useMemo } from 'react';
import YAML from 'yaml';
import {
  FileUp,
  FileCode,
  AlertTriangle,
  AlertOctagon,
  Cpu,
  Disc,
  Layers,
  Terminal,
  FolderOpen,
  ClipboardPaste,
  FileText,
} from 'lucide-react';
import { Profile, Engine, IWAD, Mod, ValidationItem } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

export interface ImportProfileModalProps {
  isOpen: boolean;
  initialFormat?: 'yaml' | 'zdl';
  onClose: () => void;
  onImportSuccess: (profile: Profile, warnings: ValidationItem[]) => void;
}

interface ParsedProfileData {
  name: string;
  description?: string;
  engineQuery: string;
  iwadQuery: string;
  mods: Array<{
    name: string;
    path: string;
    enabled: boolean;
    order: number;
  }>;
  arguments?: string[];
  workingDir?: string;
}

export const ImportProfileModal: React.FC<ImportProfileModalProps> = ({
  isOpen,
  initialFormat = 'yaml',
  onClose,
  onImportSuccess,
}) => {
  const toast = useToast();
  const [importFormat, setImportFormat] = useState<'yaml' | 'zdl'>(initialFormat);
  const [fileContent, setFileContent] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'paste' | 'file'>('paste');

  // Existing library references to check matching
  const [engines, setEngines] = useState<Engine[]>([]);
  const [iwads, setIwads] = useState<IWAD[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);

  useEffect(() => {
    if (isOpen) {
      setFileContent('');
      setImportFormat(initialFormat);
      setActiveTab('paste');
      // Load library data for preview matching
      Promise.all([api.listEngines(), api.listIWADs(), api.listMods()])
        .then(([engs, iws, ms]) => {
          setEngines(engs || []);
          setIwads(iws || []);
          setMods(ms || []);
        })
        .catch((err: unknown) => console.error('Failed to load library resources:', err));
    }
  }, [isOpen, initialFormat]);

  // Parse content client-side for live preview
  const parseResult = useMemo<{
    data: ParsedProfileData | null;
    error: string | null;
  }>(() => {
    if (!fileContent.trim()) {
      return { data: null, error: null };
    }

    if (importFormat === 'yaml') {
      try {
        const parsed = YAML.parse(fileContent) as unknown;
        if (!parsed || typeof parsed !== 'object') {
          return { data: null, error: 'YAML content must be an object' };
        }
        const p = parsed as {
          version?: number;
          profile?: {
            name?: string;
            description?: string;
            engine?: { id?: string; name?: string };
            iwad?: { id?: string; name?: string };
            mods?: Array<{ name?: string; path?: string; enabled?: boolean; order?: number }>;
            arguments?: string[];
            working_dir?: string;
          };
        };
        if (typeof p.version !== 'number') {
          return { data: null, error: "Missing required 'version' field in YAML" };
        }
        if (!p.profile || typeof p.profile !== 'object' || !p.profile.name) {
          return { data: null, error: "Missing required 'profile.name' in YAML" };
        }
        return {
          data: {
            name: p.profile.name,
            description: p.profile.description,
            engineQuery: p.profile.engine?.name || p.profile.engine?.id || '',
            iwadQuery: p.profile.iwad?.name || p.profile.iwad?.id || '',
            mods: (p.profile.mods || []).map((m, i) => ({
              name: m.name || (m.path ? m.path.split(/[/\\]/).pop() || 'Mod' : 'Mod'),
              path: m.path || '',
              enabled: m.enabled !== false,
              order: m.order || i + 1,
            })),
            arguments: p.profile.arguments || [],
            workingDir: p.profile.working_dir || '',
          },
          error: null,
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Invalid YAML syntax';
        return { data: null, error: msg };
      }
    } else {
      // ZDL INI parsing
      try {
        const lines = fileContent.split('\n');
        let port = '';
        let iwad = '';
        let name = '';
        const zdlMods: Array<{ name: string; path: string; enabled: boolean; order: number }> = [];
        const fileMap: { [key: number]: { path: string; enabled: boolean } } = {};
        const customArgs: string[] = [];

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith(';') || line.startsWith('#') || (line.startsWith('[') && line.endsWith(']'))) {
            continue;
          }
          const eqIdx = line.indexOf('=');
          if (eqIdx === -1) continue;
          const key = line.substring(0, eqIdx).trim().toLowerCase();
          let val = line.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }

          const fileIndexedMatch = key.match(/^file_?([0-9]+)$/);
          if (fileIndexedMatch) {
            const idx = parseInt(fileIndexedMatch[1], 10);
            fileMap[idx] = { ...(fileMap[idx] || { enabled: true }), path: val };
            continue;
          }
          const fileEnabledMatch = key.match(/^file_?([0-9]+)_(?:enabled|active)$/);
          if (fileEnabledMatch) {
            const idx = parseInt(fileEnabledMatch[1], 10);
            const isTrue = val === '1' || val.toLowerCase() === 'true' || val.toLowerCase() === 'yes';
            fileMap[idx] = { ...(fileMap[idx] || { path: '' }), enabled: isTrue };
            continue;
          }

          if (['port', 'engine', 'sourceport'].includes(key)) {
            if (!port) port = val;
          } else if (['iwad', 'base', 'iwadpath'].includes(key)) {
            if (!iwad) iwad = val;
          } else if (['name', 'title', 'profile'].includes(key)) {
            if (!name) name = val;
          } else if (['custom_params', 'customargs', 'params', 'args'].includes(key)) {
            if (val) customArgs.push(val);
          } else if (['warp', 'map'].includes(key)) {
            if (val) customArgs.push('-warp', val);
          } else if (['skill'].includes(key)) {
            if (val) customArgs.push('-skill', val);
          }
        }

        const sortedIndices = Object.keys(fileMap)
          .map((k) => parseInt(k, 10))
          .sort((a, b) => a - b);
        for (const idx of sortedIndices) {
          const entry = fileMap[idx];
          if (entry.path) {
            zdlMods.push({
              name: entry.path.split(/[/\\]/).pop() || 'Mod',
              path: entry.path,
              enabled: entry.enabled,
              order: zdlMods.length + 1,
            });
          }
        }

        const resolvedName = name || (iwad ? `ZDL Import - ${iwad.split(/[/\\]/).pop()}` : 'ZDL Imported Profile');
        return {
          data: {
            name: resolvedName,
            engineQuery: port,
            iwadQuery: iwad,
            mods: zdlMods,
            arguments: customArgs,
          },
          error: null,
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Invalid .zdl INI syntax';
        return { data: null, error: msg };
      }
    }
  }, [fileContent, importFormat]);

  // Match resolutions for preview
  const previewMatching = useMemo(() => {
    if (!parseResult.data) return null;
    const { data } = parseResult;

    // Engine resolution
    const matchedEngine = engines.find(
      (e) =>
        e.id === data.engineQuery ||
        (data.engineQuery && e.name.toLowerCase() === data.engineQuery.toLowerCase()) ||
        (data.engineQuery && e.executable.toLowerCase().includes(data.engineQuery.toLowerCase()))
    );

    // IWAD resolution
    const matchedIWAD = iwads.find(
      (w) =>
        w.id === data.iwadQuery ||
        (data.iwadQuery && w.name.toLowerCase() === data.iwadQuery.toLowerCase()) ||
        (data.iwadQuery && w.path.toLowerCase().endsWith(data.iwadQuery.toLowerCase()))
    );

    // Mods resolution
    const modResolutions = (data.mods || []).map((m) => {
      const reqBase = m.name.toLowerCase();
      const matched = mods.find(
        (libMod) =>
          libMod.id === m.path ||
          libMod.name.toLowerCase() === reqBase ||
          libMod.path.toLowerCase() === m.path.toLowerCase() ||
          libMod.path.toLowerCase().endsWith(reqBase)
      );
      return {
        ...m,
        isMatched: !!matched,
        matchedMod: matched,
      };
    });

    const missingModsCount = modResolutions.filter((m) => !m.isMatched).length;

    return {
      engineQuery: data.engineQuery,
      matchedEngine,
      iwadQuery: data.iwadQuery,
      matchedIWAD,
      modResolutions,
      missingModsCount,
      hasWarnings: !matchedEngine || !matchedIWAD || missingModsCount > 0,
    };
  }, [parseResult.data, engines, iwads, mods]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.toLowerCase();
      if (ext.endsWith('.zdl') || ext.endsWith('.ini')) {
        setImportFormat('zdl');
      } else if (ext.endsWith('.yaml') || ext.endsWith('.yml')) {
        setImportFormat('yaml');
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setFileContent(text);
          setActiveTab('paste');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!fileContent.trim() || parseResult.error || !parseResult.data) {
      toast.error('Invalid Content', 'Please provide a valid configuration file');
      return;
    }

    setIsImporting(true);
    try {
      let result: { profile: Profile; warnings: ValidationItem[] };
      if (importFormat === 'zdl') {
        result = await api.importProfileZDL(fileContent);
      } else {
        result = await api.importProfileYAML(fileContent);
      }

      toast.success(
        'Profile Imported',
        `Successfully imported profile "${result.profile.name}"`
      );
      onImportSuccess(result.profile, result.warnings || []);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      toast.error('Import Failed', msg);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <FileUp className="w-5 h-5 text-doom-red" />
          {importFormat === 'zdl' ? 'Import .zdl Configuration' : 'Import Profile YAML'}
        </span>
      }
      description={
        importFormat === 'zdl'
          ? 'Import a legacy qZDL or ZDL-3 preset configuration directly into a native profile.'
          : 'Import a portable Doom profile specification conforming to version 1 schema.'
      }
      size="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-doom-muted">
            {previewMatching && previewMatching.hasWarnings && (
              <span className="text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Missing content will be imported with warnings
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isImporting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={!parseResult.data || !!parseResult.error || isImporting}
              isLoading={isImporting}
              leftIcon={<FileUp className="w-4 h-4" />}
            >
              Import Profile
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Format Selector */}
        <div className="flex items-center justify-between border-b border-doom-border pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportFormat('yaml')}
              className={`text-xs px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
                importFormat === 'yaml'
                  ? 'bg-doom-red text-white'
                  : 'bg-doom-card text-doom-muted hover:text-doom-text border border-doom-border'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              YAML (v1)
            </button>
            <button
              type="button"
              onClick={() => setImportFormat('zdl')}
              className={`text-xs px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
                importFormat === 'zdl'
                  ? 'bg-doom-red text-white'
                  : 'bg-doom-card text-doom-muted hover:text-doom-text border border-doom-border'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              qZDL / ZDL-3 (.zdl)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`text-xs px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                activeTab === 'paste'
                  ? 'bg-doom-card text-doom-text border border-doom-border'
                  : 'text-doom-muted hover:text-doom-text'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Paste Text
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`text-xs px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                activeTab === 'file'
                  ? 'bg-doom-card text-doom-text border border-doom-border'
                  : 'text-doom-muted hover:text-doom-text'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Upload File
            </button>
          </div>
        </div>

        {/* Input Area */}
        {activeTab === 'paste' ? (
          <div>
            <textarea
              rows={7}
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              placeholder={
                importFormat === 'zdl'
                  ? `[zdl.save]\nport=GZDoom\niwad=DOOM2.WAD\nfile_0=C:\\mods\\brutal.pk3\nfile_0_enabled=1\ncustom_params=-fast\nwarp=MAP01`
                  : `version: 1\nprofile:\n  name: "My Doom Setup"\n  engine:\n    name: "GZDoom"\n  iwad:\n    name: "DOOM2.WAD"\n  mods:\n    - name: "smoothdoom.pk3"\n      enabled: true`
              }
              className="w-full bg-doom-bg font-mono text-xs text-doom-text p-3 rounded border border-doom-border focus:border-doom-red focus:outline-none resize-y"
            />
            {parseResult.error && (
              <div className="mt-1.5 text-xs text-red-400 flex items-center gap-1 font-mono">
                <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                <span>{parseResult.error}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="border-2 border-dashed border-doom-border rounded-lg p-6 text-center hover:border-doom-red/60 transition-colors bg-doom-surface/40">
            <input
              type="file"
              accept={importFormat === 'zdl' ? '.zdl,.ini,.txt' : '.yaml,.yml,.txt'}
              id="profile-file-input"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <label
              htmlFor="profile-file-input"
              className="cursor-pointer flex flex-col items-center gap-2 text-doom-muted hover:text-doom-text"
            >
              <FileUp className="w-8 h-8 text-doom-red/80" />
              <span className="text-sm font-medium">Click to select {importFormat === 'zdl' ? '.zdl' : '.yaml'} file</span>
              <span className="text-xs text-doom-muted">or drag and drop here</span>
            </label>
          </div>
        )}

        {/* Live Matching Preview */}
        {parseResult.data && (
          <div className="flex flex-col gap-2.5 border border-doom-border rounded-lg p-3 bg-doom-surface/60">
            <div className="flex items-center justify-between border-b border-doom-border pb-1.5">
              <span className="text-xs font-semibold text-doom-text flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-doom-red" />
                Parsed Profile: <span className="text-white font-mono">{parseResult.data.name}</span>
              </span>
              <span className="text-[10px] font-mono text-doom-muted">
                {parseResult.data.mods.length} mod(s)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {/* Engine Preview */}
              <div className="flex items-center justify-between p-2 rounded bg-doom-bg border border-doom-border">
                <div className="flex items-center gap-1.5 truncate">
                  <Cpu className="w-3.5 h-3.5 text-doom-muted shrink-0" />
                  <span className="text-doom-muted">Engine:</span>
                  <span className="font-mono truncate">{parseResult.data.engineQuery || '(None)'}</span>
                </div>
                {previewMatching?.matchedEngine ? (
                  <Badge variant="success" size="sm">Matched</Badge>
                ) : (
                  <Badge variant="warning" size="sm">Missing</Badge>
                )}
              </div>

              {/* IWAD Preview */}
              <div className="flex items-center justify-between p-2 rounded bg-doom-bg border border-doom-border">
                <div className="flex items-center gap-1.5 truncate">
                  <Disc className="w-3.5 h-3.5 text-doom-muted shrink-0" />
                  <span className="text-doom-muted">IWAD:</span>
                  <span className="font-mono truncate">{parseResult.data.iwadQuery || '(None)'}</span>
                </div>
                {previewMatching?.matchedIWAD ? (
                  <Badge variant="success" size="sm">Matched</Badge>
                ) : (
                  <Badge variant="warning" size="sm">Missing</Badge>
                )}
              </div>
            </div>

            {/* Custom Arguments */}
            {parseResult.data.arguments && parseResult.data.arguments.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-doom-muted font-mono bg-doom-bg p-2 rounded border border-doom-border">
                <Terminal className="w-3.5 h-3.5 text-doom-muted shrink-0" />
                <span className="text-doom-text truncate">
                  {parseResult.data.arguments.join(' ')}
                </span>
              </div>
            )}

            {/* Mods Match List */}
            {previewMatching && previewMatching.modResolutions.length > 0 && (
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                <div className="text-[11px] font-semibold text-doom-muted uppercase tracking-wider">
                  Mod Resolution ({previewMatching.modResolutions.length - previewMatching.missingModsCount}/{previewMatching.modResolutions.length} found)
                </div>
                {previewMatching.modResolutions.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1 px-2 rounded bg-doom-bg text-xs border border-doom-border/50"
                  >
                    <span className="font-mono text-[11px] truncate flex-1 mr-2 text-doom-text">
                      {m.order}. {m.name}
                    </span>
                    {m.isMatched ? (
                      <span className="text-[10px] text-green-400 font-medium">Found</span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-medium">Missing</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
