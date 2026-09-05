import {
  CheckSquare,
  Clock,
  Cpu,
  Disc,
  Eye,
  FileText,
  LayoutDashboard,
  Library,
  Maximize2,
  Minimize2,
  Play,
  ShieldCheck,
  Square,
  CheckCircle2,
} from 'lucide-react';
import type { DefaultNavView, Settings } from '../../../types';
import { FORMAT_DESCRIPTIONS, SUPPORTED_FORMATS } from '../../../lib/constants';
import { SettingCard } from '../components/SettingCard';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { useToast } from '../../../components/ui/Toast';
import { cn } from '../../../lib/utils';

export interface InterfaceTabProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  filter: string;
}

const RECENT_LAUNCH_OPTIONS = [3, 5, 10, 15] as const;

const DEFAULT_FORMATS: string[] = [...SUPPORTED_FORMATS];

const normalizeFormat = (fmt: string): string => {
  const clean = fmt.trim().toLowerCase();
  return clean.startsWith('.') ? clean : `.${clean}`;
};

interface DestinationOption {
  id: DefaultNavView;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
}

const DESTINATION_OPTIONS: DestinationOption[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Overview and quick game launch', icon: LayoutDashboard },
  { id: 'profiles', label: 'Launch Profiles', description: 'Preset launcher setups and load orders', icon: Play },
  { id: 'library', label: 'Mod Library', description: 'Catalog of scanned and imported mod files', icon: Library },
  { id: 'engines', label: 'Source Engines', description: 'Configured engine executables', icon: Cpu },
  { id: 'iwads', label: 'Base IWADs', description: 'Base game resource packages', icon: Disc },
  { id: 'history', label: 'Launch History', description: 'Session logs and duration telemetry', icon: Clock },
  { id: 'diagnostics', label: 'Diagnostics', description: 'System health and database integrity', icon: ShieldCheck },
];

export function InterfaceTab({ settings, update, filter }: InterfaceTabProps) {
  const toast = useToast();
  const query = filter.trim().toLowerCase();
  const matches = (...haystack: string[]): boolean =>
    query.length === 0 || haystack.some((h) => h.toLowerCase().includes(query));

  const density = settings.uiDensity ?? 'compact';
  const defaultView = settings.defaultView ?? 'dashboard';
  const showFilePaths = Boolean(settings.showFilePaths);
  const recentLimit = typeof settings.showRecentLaunches === 'number' ? settings.showRecentLaunches : 3;

  const rawVisibility = Array.isArray(settings.formatVisibility) ? settings.formatVisibility : DEFAULT_FORMATS;
  const visibleSet = new Set(rawVisibility.map(normalizeFormat));

  const handleToggleFormat = (fmt: string) => {
    const target = normalizeFormat(fmt);
    if (visibleSet.has(target)) {
      if (visibleSet.size <= 1) {
        toast.warning('Minimum One Format', 'At least one format must remain visible.');
        return;
      }
      update({
        formatVisibility: DEFAULT_FORMATS.filter((f) => visibleSet.has(normalizeFormat(f)) && normalizeFormat(f) !== target),
      });
    } else {
      update({
        formatVisibility: DEFAULT_FORMATS.filter((f) => visibleSet.has(normalizeFormat(f)) || normalizeFormat(f) === target),
      });
    }
  };

  const handleSelectAllFormats = () => {
    update({ formatVisibility: [...DEFAULT_FORMATS] });
  };

  const handleResetFormats = () => {
    update({ formatVisibility: [...DEFAULT_FORMATS] });
  };

  const showDensity = matches(
    'ui density',
    'density',
    'compact',
    'comfortable',
    'vertical rhythm',
    'table padding',
    'data density',
    'touch targets',
  );

  const matchingDestinations = DESTINATION_OPTIONS.filter((d) =>
    matches(d.id, d.label, d.description, 'default startup screen', 'startup view', 'launch view'),
  );
  const showDestinations = matchingDestinations.length > 0;

  const showFilePathsRow = matches(
    'file paths',
    'show file paths',
    'display full file paths',
    'library paths',
    'absolute paths',
    'asset titles',
  );

  const showRecentRow = matches(
    'recent launches',
    'dashboard recent launches limit',
    'recent limit',
    'history entries',
    'showcase',
  );

  const matchingFormats = DEFAULT_FORMATS.filter((fmt) =>
    matches(
      fmt,
      fmt.replace(/^\./, ''),
      FORMAT_DESCRIPTIONS[fmt]?.label ?? '',
      FORMAT_DESCRIPTIONS[fmt]?.description ?? '',
      'format visibility',
      'format filters',
      'extensions',
    ),
  );
  const showFormats = matchingFormats.length > 0;

  if (query.length > 0 && !showDensity && !showDestinations && !showFilePathsRow && !showRecentRow && !showFormats) {
    return (
      <div className="rounded-[12px] border border-dashed border-[#2d2d34] bg-[#0f0f12] px-5 py-10 text-center">
        <p className="text-sm font-medium text-zinc-300">No interface settings match &ldquo;{filter.trim()}&rdquo;.</p>
        <p className="mt-1 text-xs text-zinc-500">Try a different search, or switch tabs to keep looking.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showDensity && (
        <SettingCard
          title="UI Density Mode"
          description="Controls vertical rhythm and table padding across the launcher."
          icon={<LayoutDashboard className="h-4 w-4 text-[#5e7ce2]" />}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={density === 'compact'}
              onClick={() => update({ uiDensity: 'compact' })}
              className={cn(
                'relative rounded-[10px] border p-4 text-left transition-all duration-150 active:scale-[0.98]',
                density === 'compact'
                  ? 'border-[#5e7ce2] bg-[#5e7ce2]/[0.08] shadow-[0_0_24px_rgba(94,124,226,0.15)]'
                  : 'border-[#2d2d34] bg-[#0c0c0f] hover:border-[#3a3f4d]',
              )}
            >
              {density === 'compact' && (
                <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-[#5e7ce2]" />
              )}
              <div className="flex items-center gap-2">
                <Minimize2 className={cn('h-4 w-4', density === 'compact' ? 'text-[#5e7ce2]' : 'text-zinc-500')} />
                <span className="text-xs font-semibold text-[#f4f4f5]">Compact</span>
              </div>
              <div className="mt-3 space-y-1.5" aria-hidden="true">
                <div className="h-1.5 rounded-sm bg-zinc-600/60" />
                <div className="h-1.5 rounded-sm bg-zinc-600/60" />
                <div className="h-1.5 rounded-sm bg-zinc-600/60" />
                <div className="h-1.5 w-2/3 rounded-sm bg-zinc-700/50" />
              </div>
              <p className="mt-3 text-[11px] leading-snug text-zinc-400">
                Dense rows with an 8px rhythm for expansive mod catalogs.
              </p>
            </button>

            <button
              type="button"
              aria-pressed={density === 'comfortable'}
              onClick={() => update({ uiDensity: 'comfortable' })}
              className={cn(
                'relative rounded-[10px] border p-4 text-left transition-all duration-150 active:scale-[0.98]',
                density === 'comfortable'
                  ? 'border-[#5e7ce2] bg-[#5e7ce2]/[0.08] shadow-[0_0_24px_rgba(94,124,226,0.15)]'
                  : 'border-[#2d2d34] bg-[#0c0c0f] hover:border-[#3a3f4d]',
              )}
            >
              {density === 'comfortable' && (
                <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-[#5e7ce2]" />
              )}
              <div className="flex items-center gap-2">
                <Maximize2 className={cn('h-4 w-4', density === 'comfortable' ? 'text-[#5e7ce2]' : 'text-zinc-500')} />
                <span className="text-xs font-semibold text-[#f4f4f5]">Comfortable</span>
              </div>
              <div className="mt-3 space-y-2.5" aria-hidden="true">
                <div className="h-2.5 rounded-sm bg-zinc-600/60" />
                <div className="h-2.5 rounded-sm bg-zinc-600/60" />
                <div className="h-2.5 w-2/3 rounded-sm bg-zinc-700/50" />
              </div>
              <p className="mt-3 text-[11px] leading-snug text-zinc-400">
                Generous touch targets and relaxed padding.
              </p>
            </button>
          </div>
        </SettingCard>
      )}

      {showDestinations && (
        <SettingCard
          title="Default Startup Screen"
          description="Destination opened automatically when the launcher starts."
          icon={<Play className="h-4 w-4 text-[#5e7ce2]" />}
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {matchingDestinations.map((dest) => {
              const Icon = dest.icon;
              const selected = defaultView === dest.id;
              return (
                <button
                  key={dest.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => update({ defaultView: dest.id })}
                  className={cn(
                    'relative rounded-[10px] border p-3 text-left transition-all duration-150 active:scale-[0.98]',
                    selected
                      ? 'border-[#5e7ce2] bg-[#5e7ce2]/[0.08] shadow-[0_0_24px_rgba(94,124,226,0.15)]'
                      : 'border-[#2d2d34] bg-[#0c0c0f] hover:border-[#3a3f4d]',
                  )}
                >
                  {selected && (
                    <CheckCircle2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[#5e7ce2]" />
                  )}
                  <Icon className={cn('h-4 w-4', selected ? 'text-[#5e7ce2]' : 'text-zinc-500')} />
                  <span className="mt-2 block text-xs font-semibold text-[#f4f4f5]">{dest.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-zinc-400">{dest.description}</span>
                </button>
              );
            })}
          </div>
        </SettingCard>
      )}

      {showFilePathsRow && (
        <SettingCard
          title="Display Full File Paths in Library"
          description="Shows absolute filesystem paths beneath asset titles in mod library cards and table rows."
          icon={<FileText className="h-4 w-4 text-[#5e7ce2]" />}
          control={<ToggleSwitch checked={showFilePaths} onChange={(v) => update({ showFilePaths: v })} label="Display full file paths in library" />}
        />
      )}

      {showRecentRow && (
        <SettingCard
          title="Dashboard Recent Launches Limit"
          description="Number of recent launch history entries to showcase on the Dashboard overview."
          icon={<Clock className="h-4 w-4 text-[#5e7ce2]" />}
        >
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Recent launches display limit">
            {RECENT_LAUNCH_OPTIONS.map((n) => {
              const selected = recentLimit === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => update({ showRecentLaunches: n })}
                  className={cn(
                    'min-w-11 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.98]',
                    selected
                      ? 'border-transparent bg-[#5e7ce2] text-white shadow-[0_0_16px_rgba(94,124,226,0.35)]'
                      : 'border-[#2d2d34] bg-[#0c0c0f] text-zinc-400 hover:border-[#3a3f4d] hover:text-zinc-200',
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </SettingCard>
      )}

      {showFormats && (
        <SettingCard
          title="Format Visibility Filters"
          description="Choose which mod package formats appear across the launcher."
          icon={<Eye className="h-4 w-4 text-[#5e7ce2]" />}
          badge={
            <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              {visibleSet.size}/{DEFAULT_FORMATS.length} visible
            </span>
          }
          control={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAllFormats}
                className="text-[11px] font-medium text-zinc-400 transition-colors hover:text-zinc-100"
              >
                Select All Formats
              </button>
              <button
                type="button"
                onClick={handleResetFormats}
                className="text-[11px] font-medium text-zinc-400 transition-colors hover:text-zinc-100"
              >
                Reset to Defaults
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {matchingFormats.map((fmt) => {
              const isChecked = visibleSet.has(normalizeFormat(fmt));
              const meta = FORMAT_DESCRIPTIONS[fmt];
              return (
                <button
                  key={fmt}
                  type="button"
                  aria-pressed={isChecked}
                  onClick={() => handleToggleFormat(fmt)}
                  className={cn(
                    'flex items-center gap-2 rounded-[10px] border p-2.5 text-left transition-all duration-150 active:scale-[0.98]',
                    isChecked
                      ? 'border-[#5e7ce2]/60 bg-[#5e7ce2]/[0.08] text-zinc-200'
                      : 'border-[#2d2d34] bg-[#0c0c0f] text-zinc-500 hover:border-[#3a3f4d] hover:text-zinc-400',
                  )}
                >
                  {isChecked ? (
                    <CheckSquare className="h-3.5 w-3.5 shrink-0 text-[#5e7ce2]" />
                  ) : (
                    <Square className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                  )}
                  <span className="min-w-0">
                    <span className="block font-mono text-xs font-bold uppercase text-zinc-200">
                      {fmt}
                    </span>
                    <span className="block truncate text-[10px] text-zinc-500" title={meta?.description ?? fmt}>
                      {meta?.description ?? fmt}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </SettingCard>
      )}
    </div>
  );
}
