import { Cpu, Disc, ExternalLink, Folder, FolderPlus, HardDrive, Layers, Trash2 } from 'lucide-react';
import type { Settings } from '../../../types/domain';
import { SettingCard } from '../components/SettingCard';

export interface DirectoriesTabProps {
  settings: Settings;
  onAdd: (kind: 'mod' | 'iwad' | 'engine') => void;
  onRemove: (kind: 'mod' | 'iwad' | 'engine', index: number) => void;
  onOpen: (path: string) => void;
  onWorkingDirChange: (v: string) => void;
  onBrowseWorkingDir: () => void;
  onClearWorkingDir: () => void;
  filter: string;
}

type DirectoryKind = 'mod' | 'iwad' | 'engine';

function matchesFilter(haystack: string, filter: string): boolean {
  const q = filter.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}

interface DirectoryRowsProps {
  kind: DirectoryKind;
  paths: string[];
  onRemove: (kind: DirectoryKind, index: number) => void;
  onOpen: (path: string) => void;
}

function DirectoryRows({ kind, paths, onRemove, onOpen }: DirectoryRowsProps) {
  return (
    <div className="space-y-2">
      {paths.map((dir, index) => (
        <div
          key={`${dir}-${index}`}
          className="flex items-center gap-3 rounded-[8px] border border-[#2d2d34] bg-[#0c0c0f] px-3 py-2"
        >
          <Folder className="h-4 w-4 shrink-0 text-zinc-500" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#f4f4f5]" title={dir}>
            {dir}
          </span>
          <button
            type="button"
            onClick={() => onOpen(dir)}
            title="Open in file explorer"
            aria-label={`Open ${dir} in file explorer`}
            className="rounded-[6px] p-1.5 text-zinc-400 transition hover:bg-[#1a1d24] hover:text-[#f4f4f5] active:scale-[0.98]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(kind, index)}
            title="Remove from scan list"
            aria-label={`Remove ${dir} from scan list`}
            className="rounded-[6px] p-1.5 text-zinc-400 transition hover:bg-red-950/40 hover:text-red-400 active:scale-[0.98]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function DirectoryEmptyState({ kind, onAdd }: { kind: DirectoryKind; onAdd: (kind: DirectoryKind) => void }) {
  const guidance =
    kind === 'mod'
      ? 'No mod directories configured. Add a folder to start scanning for custom content.'
      : kind === 'iwad'
        ? 'No IWAD directories configured. Add a folder containing your base game WADs.'
        : 'No source port directories configured. Add a folder containing engine executables.';
  const addLabel =
    kind === 'mod' ? 'Add Mod Directory' : kind === 'iwad' ? 'Add IWAD Directory' : 'Add Engine Directory';
  return (
    <div className="rounded-[8px] border border-dashed border-[#2d2d34] px-4 py-6 text-center">
      <Folder className="mx-auto h-5 w-5 text-zinc-600" />
      <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">{guidance}</p>
      <button
        type="button"
        onClick={() => onAdd(kind)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-[8px] border border-[#2d2d34] bg-[#1a1d24] px-3 py-1.5 text-xs font-medium text-[#f4f4f5] transition duration-150 ease-out hover:border-[#3a3f4d] active:scale-[0.98]"
      >
        <FolderPlus className="h-3.5 w-3.5" />
        {addLabel}
      </button>
    </div>
  );
}

export function DirectoriesTab({
  settings,
  onAdd,
  onRemove,
  onOpen,
  onWorkingDirChange,
  onBrowseWorkingDir,
  onClearWorkingDir,
  filter,
}: DirectoriesTabProps) {
  const modDirs = settings.modDirectories ?? [];
  const iwadDirs = settings.iwadDirectories ?? [];
  const engineDirs = settings.engineDirectories ?? [];
  const workingDir = settings.defaultWorkingDir ?? '';

  const showMod = matchesFilter(
    `Mod PWAD directories Monitored recursively for custom content (.wad, .pk3, .pk7, .zip, .deh, .bex). ${modDirs.join(' ')}`,
    filter,
  );
  const showIwad = matchesFilter(
    `Base IWAD directories Monitored for base game packages (DOOM.WAD, DOOM2.WAD, PLUTONIA.WAD, TNT.WAD, etc.). ${iwadDirs.join(' ')}`,
    filter,
  );
  const showEngine = matchesFilter(
    `Source Port directories Monitored for Doom source port executables (GZDoom, PRBoom+, DSDA-Doom, Woof, etc.). ${engineDirs.join(' ')}`,
    filter,
  );
  const showWorkingDir = matchesFilter(
    `Default Working Directory Execution working directory passed to source ports when launched. Defaults to the engine executable's directory if empty. ${workingDir}`,
    filter,
  );

  const visibleCount = [showMod, showIwad, showEngine, showWorkingDir].filter(Boolean).length;

  if (visibleCount === 0) {
    return (
      <div className="rounded-[12px] border border-[#2d2d34] bg-[#0f0f12] p-8 text-center">
        <p className="text-sm text-zinc-400">No directories match &ldquo;{filter.trim()}&rdquo;.</p>
      </div>
    );
  }

  const addButtonClass =
    'inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-[#2d2d34] bg-[#1a1d24] px-3 py-1.5 text-xs font-medium text-[#f4f4f5] transition duration-150 ease-out hover:border-[#3a3f4d] active:scale-[0.98]';

  return (
    <div className="space-y-4">
      {showMod && (
        <SettingCard
          title="Mod & PWAD Directories"
          description="Monitored recursively for custom content (.wad, .pk3, .pk7, .zip, .deh, .bex)."
          icon={<Layers className="h-4 w-4 text-[#5e7ce2]" />}
          badge={
            <span className="rounded-full border border-[#2d2d34] bg-[#0c0c0f] px-2 py-0.5 text-[11px] font-medium text-zinc-400">
              {modDirs.length}
            </span>
          }
          control={
            <button type="button" onClick={() => onAdd('mod')} className={addButtonClass}>
              <FolderPlus className="h-3.5 w-3.5" />
              Add Directory
            </button>
          }
        >
          {modDirs.length > 0 ? (
            <DirectoryRows kind="mod" paths={modDirs} onRemove={onRemove} onOpen={onOpen} />
          ) : (
            <DirectoryEmptyState kind="mod" onAdd={onAdd} />
          )}
        </SettingCard>
      )}

      {showIwad && (
        <SettingCard
          title="Base IWAD Directories"
          description="Monitored for base game packages (DOOM.WAD, DOOM2.WAD, PLUTONIA.WAD, TNT.WAD, etc.)."
          icon={<Disc className="h-4 w-4 text-[#f59e0b]" />}
          badge={
            <span className="rounded-full border border-[#2d2d34] bg-[#0c0c0f] px-2 py-0.5 text-[11px] font-medium text-zinc-400">
              {iwadDirs.length}
            </span>
          }
          control={
            <button type="button" onClick={() => onAdd('iwad')} className={addButtonClass}>
              <FolderPlus className="h-3.5 w-3.5" />
              Add Directory
            </button>
          }
        >
          {iwadDirs.length > 0 ? (
            <DirectoryRows kind="iwad" paths={iwadDirs} onRemove={onRemove} onOpen={onOpen} />
          ) : (
            <DirectoryEmptyState kind="iwad" onAdd={onAdd} />
          )}
        </SettingCard>
      )}

      {showEngine && (
        <SettingCard
          title="Source Port Directories"
          description="Monitored for Doom source port executables (GZDoom, PRBoom+, DSDA-Doom, Woof, etc.)."
          icon={<Cpu className="h-4 w-4 text-[#10b981]" />}
          badge={
            <span className="rounded-full border border-[#2d2d34] bg-[#0c0c0f] px-2 py-0.5 text-[11px] font-medium text-zinc-400">
              {engineDirs.length}
            </span>
          }
          control={
            <button type="button" onClick={() => onAdd('engine')} className={addButtonClass}>
              <FolderPlus className="h-3.5 w-3.5" />
              Add Directory
            </button>
          }
        >
          {engineDirs.length > 0 ? (
            <DirectoryRows kind="engine" paths={engineDirs} onRemove={onRemove} onOpen={onOpen} />
          ) : (
            <DirectoryEmptyState kind="engine" onAdd={onAdd} />
          )}
        </SettingCard>
      )}

      {showWorkingDir && (
        <SettingCard
          title="Default Working Directory"
          description="Execution working directory passed to source ports when launched. Defaults to the engine executable's directory if empty."
          icon={<HardDrive className="h-4 w-4 text-[#a1a1aa]" />}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Folder className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={workingDir}
                onChange={(e) => onWorkingDirChange(e.target.value)}
                placeholder="Engine executable's directory (default)"
                aria-label="Default working directory"
                className="w-full rounded-[8px] border border-[#2d2d34] bg-[#0c0c0f] py-2 pl-9 pr-3 font-mono text-xs text-[#f4f4f5] placeholder:text-zinc-600 focus:border-[#5e7ce2] focus:outline-none"
              />
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onBrowseWorkingDir}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#2d2d34] bg-[#1a1d24] px-3 py-2 text-xs font-medium text-[#f4f4f5] transition duration-150 ease-out hover:border-[#3a3f4d] active:scale-[0.98]"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Browse&hellip;
              </button>
              {workingDir && (
                <button
                  type="button"
                  onClick={onClearWorkingDir}
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#2d2d34] bg-transparent px-3 py-2 text-xs font-medium text-zinc-400 transition duration-150 ease-out hover:border-[#3a3f4d] hover:text-[#f4f4f5] active:scale-[0.98]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </SettingCard>
      )}
    </div>
  );
}
