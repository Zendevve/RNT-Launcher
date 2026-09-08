import { useEffect } from 'react';
import { events } from '../lib/events';
import { api } from '../services/api';
import { useToast } from '../components/ui/Toast';

function readString(source: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value: unknown = source[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

function nestedRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
  return undefined;
}

/**
 * Global crash toast: listens for the backend `launcher:crashed` event once,
 * surfaces the crash log path, restores the crashed profile's latest snapshot,
 * and points at Diagnostics & Health. Mount once at the app root.
 */
export function useCrashRecoveryToast(): void {
  const toast = useToast();

  useEffect(() => {
    return events.on<unknown>('launcher:crashed', (raw) => {
      const top = nestedRecord(raw) ?? {};
      const nested = nestedRecord(top.record) ?? nestedRecord(top.launch) ?? {};
      const profileId =
        readString(top, 'profileId', 'profile_id', 'profileID', 'profile') ??
        readString(nested, 'profileId', 'profile_id', 'profileID', 'profile');
      const logPath =
        readString(top, 'logPath', 'log_path', 'logFile', 'log_file', 'crashLog', 'crash_log') ??
        readString(nested, 'logPath', 'log_path', 'logFile', 'log_file', 'crashLog', 'crash_log') ??
        'the crash log next to the profile save folder';
      const launchId =
        readString(top, 'launchId', 'launch_id', 'launchID', 'id') ??
        readString(nested, 'launchId', 'launch_id', 'launchID', 'id');

      toast.error(
        'Game session crashed',
        `Session${launchId ? ` ${launchId}` : ''} ended abnormally. Crash log: ${logPath}. See Diagnostics & Health for details.`
      );

      if (!profileId) {
        toast.info('No profile linked', 'Open Diagnostics & Health to inspect this crash.');
        return;
      }

      (async () => {
        try {
          const snapshots = (await api.listProfileSnapshots(profileId)) ?? [];
          if (snapshots.length === 0) {
            toast.info(
              'No snapshots available',
              'Enable snapshot-before-launch on the profile, then check Diagnostics & Health.'
            );
            return;
          }
          const stamp = (s: { createdAt?: string; created_at?: string; modifiedAt?: string; modified_at?: string }) =>
            s.createdAt ?? s.created_at ?? s.modifiedAt ?? s.modified_at ?? '';
          const latest = [...snapshots].sort((a, b) => (stamp(a) < stamp(b) ? 1 : -1))[0];
          if (!latest) return;
          await api.restoreProfileSnapshot(profileId, latest.id);
          toast.success(
            'Snapshot restored',
            `Restored "${latest.label || latest.name || latest.id}" for the crashed profile.`
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Could not restore the latest snapshot';
          toast.warning('Snapshot restore failed', `${message}. Open Diagnostics & Health to retry manually.`);
        }
      })();
    });
  }, [toast]);
}
