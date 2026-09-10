import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { OrganizeReport } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface OrganizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrganized: () => void;
}

type Phase = 'setup' | 'preview' | 'report';

const FOLDER_STYLES: Record<string, string> = {
  engines: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  iwads: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  wads: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  mods: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
};

const baseName = (p: string): string => p.split(/[/\\]/).pop() || p;

export const OrganizeModal: React.FC<OrganizeModalProps> = ({
  isOpen,
  onClose,
  onOrganized,
}) => {
  const [srcDir, setSrcDir] = useState('');
  const [libDir, setLibDir] = useState('');
  const [phase, setPhase] = useState<Phase>('setup');
  const [report, setReport] = useState<OrganizeReport | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset on open; prefill the library dir from the first scan directory.
  useEffect(() => {
    if (!isOpen) return;
    setPhase('setup');
    setReport(null);
    setErrorMessage(null);
    setSrcDir('');
    api
      .getSettings()
      .then((s) => setLibDir(s.modDirectories?.[0] ?? ''))
      .catch(() => setLibDir(''));
  }, [isOpen]);

  const browse = async (setter: (v: string) => void, title: string, initial: string) => {
    try {
      const selected = await api.openDirectoryDialog(title, initial);
      if (selected) setter(selected);
    } catch (err: unknown) {
      console.error('Directory dialog error:', err);
    }
  };

  const runOrganize = async (dryRun: boolean) => {
    if (!srcDir.trim() || !libDir.trim()) {
      setErrorMessage('Select both a source folder and a library folder.');
      return;
    }
    setIsWorking(true);
    setErrorMessage(null);
    try {
      const res = await api.organizeDirectory(srcDir.trim(), libDir.trim(), dryRun);
      setReport(res);
      setPhase(dryRun ? 'preview' : 'report');
      if (!dryRun) onOrganized();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Organize failed');
    } finally {
      setIsWorking(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
      {phase !== 'setup' && (
        <Button variant="ghost" onClick={() => setPhase('setup')} disabled={isWorking}>
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Adjust</span>
        </Button>
      )}
      {phase === 'setup' && (
        <Button variant="secondary" onClick={() => runOrganize(true)} disabled={isWorking}>
          {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          <span>Preview</span>
        </Button>
      )}
      {phase === 'preview' && (
        <Button variant="primary" onClick={() => runOrganize(false)} disabled={isWorking}>
          {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          <span>Organize {(report?.moves.length ?? 0)} files</span>
        </Button>
      )}
      {phase === 'report' && (
        <Button variant="primary" onClick={onClose}>
          <span>Done</span>
        </Button>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Organize Library Folder"
      description="Sort a messy folder into engines / iwads / wads / mods. Preview first — nothing moves until you confirm."
      footer={footer}
      size="xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Source folder (messy)"
                value={srcDir}
                onChange={(e) => setSrcDir(e.target.value)}
                placeholder="C:\Doom\downloads"
              />
            </div>
            <Button variant="secondary" onClick={() => browse(setSrcDir, 'Select Messy Source Folder', srcDir)}>
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Browse</span>
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Library folder (neat)"
                value={libDir}
                onChange={(e) => setLibDir(e.target.value)}
                placeholder="C:\Doom\library"
              />
            </div>
            <Button variant="secondary" onClick={() => browse(setLibDir, 'Select Library Folder', libDir)}>
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Browse</span>
            </Button>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {report && phase !== 'setup' && (
          <div className="space-y-3">
            {!report.dryRun && (
              <div className="flex items-start gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Moved {report.movedCount} files, imported {report.importedMods} mods
                  {report.importedIWADs > 0 ? ` (incl. ${report.importedIWADs} IWADs)` : ''}.
                </span>
              </div>
            )}
            {report.moves.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded border border-[#22262d]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#14171c] text-zinc-400">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">File</th>
                      <th className="px-3 py-1.5 text-left font-medium">Folder</th>
                      <th className="px-3 py-1.5 text-left font-medium">Destination</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.moves.map((m) => (
                      <tr key={m.source} className="border-t border-[#1c2026] text-zinc-300">
                        <td className="px-3 py-1.5 font-mono text-[11px]">{baseName(m.source)}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-block rounded border px-1.5 py-px text-[10px] font-semibold ${FOLDER_STYLES[m.folder] ?? FOLDER_STYLES.mods}`}>
                            {m.folder}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <ArrowRight className="h-3 w-3 shrink-0" />
                            {baseName(m.destination)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {report.errors.length > 0 && (
              <div className="space-y-1 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                {report.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-amber-300">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="break-all">{e}</span>
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
