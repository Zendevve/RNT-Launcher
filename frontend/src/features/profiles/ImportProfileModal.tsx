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
} from 'lucide-react';
import { Profile, Engine, IWAD, Mod, ValidationItem } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

export interface ImportProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (profile: Profile, warnings: ValidationItem[]) => void;
}

interface ParsedYAMLData {
  version: number;
  profile: {
    id?: string;
    name: string;
    description?: string;
    engine?: { id?: string; name?: string };
    iwad?: { id?: string; name?: string };
    mods?: Array<{
      id?: string;
      name?: string;
      path?: string;
      enabled?: boolean;
      order?: number;
    }>;
    arguments?: string[];
    working_dir?: string;
  };
}

export const ImportProfileModal: React.FC<ImportProfileModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const toast = useToast();
  const [yamlContent, setYamlContent] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'paste' | 'file'>('paste');

  // Existing library references to check matching
  const [engines, setEngines] = useState<Engine[]>([]);
  const [iwads, setIwads] = useState<IWAD[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);

  useEffect(() => {
    if (isOpen) {
      setYamlContent('');
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
  }, [isOpen]);

  // Parse YAML client-side for live preview
  const parseResult = useMemo<{
    data: ParsedYAMLData | null;
    error: string | null;
  }>(() => {
    if (!yamlContent.trim()) {
      return { data: null, error: null };
    }
    try {
      const parsed = YAML.parse(yamlContent) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        return { data: null, error: 'YAML content must be an object' };
      }
      const p = parsed as ParsedYAMLData;
      if (typeof p.version !== 'number') {
        return { data: null, error: "Missing required 'version' field in YAML" };
      }
      if (!p.profile || typeof p.profile !== 'object' || !p.profile.name) {
        return { data: null, error: "Missing required 'profile.name' in YAML" };
      }
      return { data: p, error: null };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid YAML syntax';
      return { data: null, error: msg };
    }
  }, [yamlContent]);

  // Match resolutions for preview
  const previewMatching = useMemo(() => {
    if (!parseResult.data) return null;
    const { profile } = parseResult.data;

    // Engine resolution
    const engineQuery = profile.engine?.name || profile.engine?.id || '';
    const matchedEngine = engines.find(
      (e) =>
        e.id === profile.engine?.id ||
        (profile.engine?.name && e.name.toLowerCase() === profile.engine.name.toLowerCase())
    );

    // IWAD resolution
    const iwadQuery = profile.iwad?.name || profile.iwad?.id || '';
    const matchedIWAD = iwads.find(
      (w) =>
        w.id === profile.iwad?.id ||
        (profile.iwad?.name && w.name.toLowerCase() === profile.iwad.name.toLowerCase()) ||
        (profile.iwad?.name && w.path.toLowerCase().endsWith(profile.iwad.name.toLowerCase()))
    );

    // Mods resolution
    const modResolutions = (profile.mods || []).map((m) => {
      const matched = mods.find(
        (libMod) =>
          (m.id && libMod.id === m.id) ||
          (m.name && libMod.name.toLowerCase() === m.name.toLowerCase()) ||
          (m.path && libMod.path.toLowerCase() === m.path.toLowerCase()) ||
          (m.path && libMod.path.toLowerCase().endsWith(m.path.toLowerCase()))
      );
      return {
        ...m,
        isMatched: !!matched,
        matchedMod: matched,
      };
    });

    const missingModsCount = modResolutions.filter((m) => !m.isMatched).length;

    return {
      engineQuery,
      matchedEngine,
      iwadQuery,
      matchedIWAD,
      modResolutions,
      missingModsCount,
      hasWarnings: !matchedEngine || !matchedIWAD || missingModsCount > 0,
    };
  }, [parseResult.data, engines, iwads, mods]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setYamlContent(text);
          setActiveTab('paste');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!yamlContent.trim() || parseResult.error || !parseResult.data) {
      toast.error('Invalid YAML', 'Please provide a valid YAML profile specification');
      return;
    }

    setIsImporting(true);
    try {
      const result = await api.importProfileYAML(yamlContent);
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
          Import Profile YAML
        </span>
      }
      description="Import a portable Doom profile specification conforming to version 1 schema."
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
        {/* Source Switcher Tabs */}
        <div className="flex items-center justify-between border-b border-doom-border pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`text-xs px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'paste'
                  ? 'bg-doom-card text-doom-text border border-doom-border'
                  : 'text-doom-muted hover:text-doom-text'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Paste YAML Text
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`text-xs px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'file'
                  ? 'bg-doom-card text-doom-text border border-doom-border'
                  : 'text-doom-muted hover:text-doom-text'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Load from File
            </button>
          </div>

          <span className="text-xs font-mono text-doom-muted">YAML Spec v1</span>
        </div>

        {/* Tab 1: File selector */}
        {activeTab === 'file' && (
          <div className="p-6 border-2 border-dashed border-doom-border rounded-lg bg-doom-card/20 flex flex-col items-center justify-center gap-3">
            <FileCode className="w-10 h-10 text-doom-muted" />
            <div className="text-center">
              <p className="text-sm font-semibold text-doom-text">Select YAML Profile File</p>
              <p className="text-xs text-doom-muted mt-0.5">Supports .yaml and .yml files</p>
            </div>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-doom-card hover:bg-zinc-800 border border-doom-border hover:border-doom-border-bright text-xs font-semibold rounded text-doom-text transition-colors">
                <FolderOpen className="w-4 h-4 text-doom-red" />
                Browse File...
              </span>
              <input
                type="file"
                accept=".yaml,.yml"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Tab 2: Paste YAML */}
        {activeTab === 'paste' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-doom-muted uppercase">
              Profile YAML Payload:
            </label>
            <textarea
              value={yamlContent}
              onChange={(e) => setYamlContent(e.target.value)}
              placeholder={`version: 1\nprofile:\n  name: "My Custom Mod Pack"\n  description: "Epic gameplay overhaul"\n  engine:\n    name: "GZDoom"\n  iwad:\n    name: "DOOM2.WAD"\n  mods:\n    - name: "brutalv21.pk3"\n      enabled: true\n      order: 0\n  arguments:\n    - "-skill"\n    - "4"`}
              rows={8}
              className="w-full bg-doom-bg border border-doom-border rounded p-3 font-mono text-xs text-doom-text placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-doom-red focus:border-doom-red"
            />
          </div>
        )}

        {/* Error message if YAML parse fails */}
        {parseResult.error && (
          <div className="flex items-start gap-2.5 p-3 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
            <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <div className="min-w-0">
              <span className="font-bold uppercase tracking-wide">YAML Parse Error:</span>
              <p className="mt-0.5 font-mono text-[11px] break-words">{parseResult.error}</p>
            </div>
          </div>
        )}

        {/* Live Preview Panel */}
        {parseResult.data && previewMatching && (
          <div className="flex flex-col gap-3 p-4 rounded-lg border border-doom-border bg-doom-card/40">
            <div className="flex items-center justify-between border-b border-doom-border/60 pb-2">
              <div>
                <h4 className="text-sm font-bold text-doom-text tracking-wide">
                  {parseResult.data.profile.name}
                </h4>
                {parseResult.data.profile.description && (
                  <p className="text-xs text-doom-muted mt-0.5">
                    {parseResult.data.profile.description}
                  </p>
                )}
              </div>
              <Badge variant="cyan" size="xs">
                Spec v{parseResult.data.version}
              </Badge>
            </div>

            {/* Resolved Engine & IWAD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Engine preview */}
              <div className="flex items-center justify-between p-2.5 rounded bg-doom-surface border border-doom-border">
                <div className="flex items-center gap-2 min-w-0">
                  <Cpu className="w-4 h-4 text-doom-red shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-mono text-doom-muted block">Engine</span>
                    <span className="font-semibold text-doom-text truncate block">
                      {parseResult.data.profile.engine?.name || 'Unspecified'}
                    </span>
                  </div>
                </div>
                {previewMatching.matchedEngine ? (
                  <Badge variant="green" size="xs">Matched</Badge>
                ) : (
                  <Badge variant="amber" size="xs">Missing in Library</Badge>
                )}
              </div>

              {/* IWAD preview */}
              <div className="flex items-center justify-between p-2.5 rounded bg-doom-surface border border-doom-border">
                <div className="flex items-center gap-2 min-w-0">
                  <Disc className="w-4 h-4 text-doom-red shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-mono text-doom-muted block">IWAD</span>
                    <span className="font-semibold text-doom-text truncate block">
                      {parseResult.data.profile.iwad?.name || 'Unspecified'}
                    </span>
                  </div>
                </div>
                {previewMatching.matchedIWAD ? (
                  <Badge variant="green" size="xs">Matched</Badge>
                ) : (
                  <Badge variant="amber" size="xs">Missing in Library</Badge>
                )}
              </div>
            </div>

            {/* Resolved Mods Preview */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-doom-muted">
                <span className="font-mono uppercase font-bold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-doom-muted" />
                  Included Mods ({previewMatching.modResolutions.length})
                </span>
                {previewMatching.missingModsCount > 0 && (
                  <span className="text-amber-400 font-mono text-[11px]">
                    {previewMatching.missingModsCount} missing locally
                  </span>
                )}
              </div>

              {previewMatching.modResolutions.length === 0 ? (
                <div className="text-xs text-doom-muted italic p-2 rounded bg-doom-surface border border-doom-border">
                  No mods included in profile
                </div>
              ) : (
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                  {previewMatching.modResolutions.map((mod, idx) => (
                    <div
                      key={`${mod.name}-${idx}`}
                      className="flex items-center justify-between p-1.5 rounded bg-doom-surface border border-doom-border/70 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono text-doom-muted w-4 shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="truncate font-medium text-doom-text">
                          {mod.name || mod.path || 'Unknown mod'}
                        </span>
                      </div>
                      {mod.isMatched ? (
                        <Badge variant="green" size="xs">Matched</Badge>
                      ) : (
                        <Badge variant="amber" size="xs">Missing</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Launch Arguments preview if any */}
            {parseResult.data.profile.arguments &&
              parseResult.data.profile.arguments.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Terminal className="w-3.5 h-3.5 text-doom-muted shrink-0" />
                  <span className="text-[11px] font-mono text-doom-muted shrink-0">Arguments:</span>
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {parseResult.data.profile.arguments.map((arg, idx) => (
                      <span
                        key={idx}
                        className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-doom-surface border border-doom-border text-cyan-300"
                      >
                        {arg}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </Modal>
  );
};
