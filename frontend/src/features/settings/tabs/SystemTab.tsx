import {
  AlertTriangle,
  AppWindow,
  Database,
  HardDrive,
  Palette,
  RotateCcw,
  Tag,
} from 'lucide-react';
import type { Settings } from '../../../types';
import { FULL_VERSION } from '../../../version';
import { SettingCard } from '../components/SettingCard';
import { Button } from '../../../components/ui/Button';

export interface SystemTabProps {
  settings: Settings;
  onResetRequest: () => void;
  filter: string;
}

const ENV_CARDS = [
  {
    key: 'version',
    label: 'App Version',
    keywords: ['version', 'app version', 'build', 'release'],
  },
  {
    key: 'database',
    label: 'Database Engine',
    keywords: ['database', 'sqlite', 'wal', 'storage engine'],
  },
  {
    key: 'runtime',
    label: 'Desktop Runtime',
    keywords: ['runtime', 'desktop', 'wails', 'bridge'],
  },
  {
    key: 'theme',
    label: 'Theme Engine',
    keywords: ['theme', 'slate', 'appearance', 'dark'],
  },
] as const;

export function SystemTab({ settings, onResetRequest, filter }: SystemTabProps) {
  const query = filter.trim().toLowerCase();
  const matches = (...haystack: string[]): boolean =>
    query.length === 0 || haystack.some((h) => h.toLowerCase().includes(query));

  const modCount = settings.modDirectories?.length ?? 0;
  const iwadCount = settings.iwadDirectories?.length ?? 0;
  const engineCount = settings.engineDirectories?.length ?? 0;
  const totalPaths = modCount + iwadCount + engineCount;
  const workingDir = settings.defaultWorkingDir?.trim() ? settings.defaultWorkingDir : 'Engine directory (default)';

  const showEnv = matches(
    'environment',
    'runtime specifications',
    'system info',
    'application info',
    ...ENV_CARDS.flatMap((c) => [c.label, ...c.keywords]),
  );
  const showStorage = matches(
    'storage',
    'system health',
    'storage overview',
    'search paths',
    'diagnostics',
    'database integrity',
    'working directory',
  );
  const showDanger = matches(
    'factory reset',
    'reset defaults',
    'danger zone',
    'restore preferences',
    'factory defaults',
  );

  if (query.length > 0 && !showEnv && !showStorage && !showDanger) {
    return (
      <div className="rounded-[12px] border border-dashed border-[#2d2d34] bg-[#0f0f12] px-5 py-10 text-center">
        <p className="text-sm font-medium text-zinc-300">No system settings match &ldquo;{filter.trim()}&rdquo;.</p>
        <p className="mt-1 text-xs text-zinc-500">Try a different search, or switch tabs to keep looking.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showEnv && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-[12px] border border-[#2d2d34] bg-[#0f0f12] p-5">
            <Tag className="h-4 w-4 text-[#5e7ce2]" />
            <p className="mt-3 text-[11px] font-medium text-zinc-400">App Version</p>
            <p className="mt-0.5 block font-mono text-xs font-semibold text-[#f4f4f5]">{FULL_VERSION}</p>
          </div>
          <div className="rounded-[12px] border border-[#2d2d34] bg-[#0f0f12] p-5">
            <Database className="h-4 w-4 text-[#10b981]" />
            <p className="mt-3 text-[11px] font-medium text-zinc-400">Database Engine</p>
            <p className="mt-0.5 block font-mono text-xs font-semibold text-[#f4f4f5]">SQLite 3 (Pure Go, WAL Mode)</p>
          </div>
          <div className="rounded-[12px] border border-[#2d2d34] bg-[#0f0f12] p-5">
            <AppWindow className="h-4 w-4 text-[#f59e0b]" />
            <p className="mt-3 text-[11px] font-medium text-zinc-400">Desktop Runtime</p>
            <p className="mt-0.5 block font-mono text-xs font-semibold text-[#f4f4f5]">Wails v2 Desktop Bridge</p>
          </div>
          <div className="rounded-[12px] border border-[#2d2d34] bg-[#0f0f12] p-5">
            <Palette className="h-4 w-4 text-zinc-400" />
            <p className="mt-3 text-[11px] font-medium text-zinc-400">Theme Engine</p>
            <p className="mt-0.5 block font-mono text-xs font-semibold text-[#f4f4f5]">Slate Industrial Dark</p>
          </div>
        </div>
      )}

      {showStorage && (
        <SettingCard
          title="System Health & Storage Overview"
          description="Configured search paths and database health at a glance."
          icon={<HardDrive className="h-4 w-4 text-[#5e7ce2]" />}
          badge={
            <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              {totalPaths} {totalPaths === 1 ? 'path' : 'paths'}
            </span>
          }
        >
          <dl className="grid grid-cols-3 gap-3">
            <div className="rounded-[10px] border border-[#2d2d34] bg-[#0c0c0f] px-3 py-2.5">
              <dt className="text-[11px] font-medium text-zinc-400">Mod paths</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold text-[#f4f4f5]">{modCount}</dd>
            </div>
            <div className="rounded-[10px] border border-[#2d2d34] bg-[#0c0c0f] px-3 py-2.5">
              <dt className="text-[11px] font-medium text-zinc-400">IWAD paths</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold text-[#f4f4f5]">{iwadCount}</dd>
            </div>
            <div className="rounded-[10px] border border-[#2d2d34] bg-[#0c0c0f] px-3 py-2.5">
              <dt className="text-[11px] font-medium text-zinc-400">Engine paths</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold text-[#f4f4f5]">{engineCount}</dd>
            </div>
          </dl>
          <p className="truncate font-mono text-[11px] text-zinc-500" title={workingDir}>
            Working dir: <span className="text-zinc-400">{workingDir}</span>
          </p>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            For a full integrity report, open the Diagnostics view from the sidebar.
          </p>
        </SettingCard>
      )}

      {showDanger && (
        <div className="rounded-[12px] border border-red-900/30 bg-red-950/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-200">Factory Reset Preferences</p>
                <p className="mt-1 text-xs leading-relaxed text-red-200/60">
                  Restores folder paths and UI options to factory defaults without deleting scanned
                  mods, base IWADs, or custom profiles.
                </p>
              </div>
            </div>
            <Button
              variant="danger"
              size="xs"
              onClick={onResetRequest}
              leftIcon={<RotateCcw className="h-3 w-3" />}
              className="shrink-0 transition-transform duration-150 active:scale-[0.98]"
            >
              Reset Defaults...
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
