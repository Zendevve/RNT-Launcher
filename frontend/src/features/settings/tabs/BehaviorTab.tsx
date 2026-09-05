import { Activity, Minimize2, RotateCw, ShieldCheck } from 'lucide-react';
import type { Settings } from '../../../types/domain';
import { SettingCard } from '../components/SettingCard';
import { ToggleSwitch } from '../components/ToggleSwitch';

export interface BehaviorTabProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  filter: string;
}

function matchesFilter(haystack: string, filter: string): boolean {
  const q = filter.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}

export function BehaviorTab({ settings, update, filter }: BehaviorTabProps) {
  const showConfirm = matchesFilter(
    'Pre-Flight Launch Verification Inspects engine binary availability, base IWAD compatibility, and mod resource collisions before spawning child processes. confirmLaunch',
    filter,
  );
  const showClose = matchesFilter(
    'Close Launcher While Game Runs Frees desktop system memory while the source port executable is actively running, reopening automatically upon process exit. closeOnLaunch minimize close',
    filter,
  );
  const showAutoScan = matchesFilter(
    'Automatic Background Scan on Startup Silently checks configured folders in the background for newly added WAD, PK3, and engine files upon application launch. autoScanOnStartup scan startup',
    filter,
  );
  const showTelemetry = matchesFilter(
    'Process Supervisor Telemetry stdout stderr stream capture exit code monitoring session playtime telemetry logging',
    filter,
  );

  const visible = [showConfirm, showClose, showAutoScan, showTelemetry].filter(Boolean).length;
  if (visible === 0) {
    return (
      <div className="rounded-[12px] border border-[#2d2d34] bg-[#0f0f12] p-8 text-center">
        <p className="text-sm text-zinc-400">No behavior settings match &ldquo;{filter.trim()}&rdquo;.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showConfirm && (
        <SettingCard
          title="Pre-Flight Launch Verification"
          description="Inspects engine binary availability, base IWAD compatibility, and mod resource collisions before spawning child processes."
          icon={<ShieldCheck className="h-4 w-4 text-[#5e7ce2]" />}
          control={
            <ToggleSwitch
              checked={Boolean(settings.confirmLaunch)}
              onChange={(v) => update({ confirmLaunch: v })}
              label="Pre-Flight Launch Verification"
            />
          }
        />
      )}

      {showClose && (
        <SettingCard
          title="Close Launcher While Game Runs"
          description="Frees desktop system memory while the source port executable is actively running, reopening automatically upon process exit."
          icon={<Minimize2 className="h-4 w-4 text-zinc-400" />}
          control={
            <ToggleSwitch
              checked={Boolean(settings.closeOnLaunch)}
              onChange={(v) => update({ closeOnLaunch: v })}
              label="Close Launcher While Game Runs"
            />
          }
        />
      )}

      {showAutoScan && (
        <SettingCard
          title="Automatic Background Scan on Startup"
          description="Silently checks configured folders in the background for newly added WAD, PK3, and engine files upon application launch."
          icon={<RotateCw className="h-4 w-4 text-zinc-400" />}
          control={
            <ToggleSwitch
              checked={settings.autoScanOnStartup ?? true}
              onChange={(v) => update({ autoScanOnStartup: v })}
              label="Automatic Background Scan on Startup"
            />
          }
        />
      )}

      {showTelemetry && (
        <SettingCard
          title="Process Supervisor Telemetry"
          description="Every launch runs under a supervised child process. The launcher captures real-time stdout and stderr streams, records exit codes, and logs session playtime telemetry to launch history automatically — no configuration needed."
          icon={<Activity className="h-4 w-4 text-zinc-500" />}
        >
          <ul className="space-y-1.5 text-xs leading-relaxed text-zinc-400">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
              Real-time stdout/stderr stream capture while the game runs.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
              Exit code monitoring to flag abnormal terminations.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
              Session playtime telemetry written to launch history on exit.
            </li>
          </ul>
        </SettingCard>
      )}
    </div>
  );
}
