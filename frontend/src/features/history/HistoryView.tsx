import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History as HistoryIcon,
  Play,
  Clock,
  Calendar,
  Trophy,
  RotateCw,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Terminal,
  Copy,
  Check,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import { LaunchRecord, HistoryStats } from '../../types';
import { api } from '../../services/api';
import { onLaunchStart, onLaunchExit } from '../../lib/events';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { formatDuration, formatDate, formatTimeAgo } from '../../lib/utils';

export const HistoryView: React.FC = () => {
  const toast = useToast();

  const [history, setHistory] = useState<LaunchRecord[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [limit, setLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');

  // Detail modal state
  const [selectedRecord, setSelectedRecord] = useState<LaunchRecord | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Clear history confirm modal state
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Fast re-launch loading per record id
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  // Load history records and aggregate stats
  const loadHistoryData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [records, statsData] = await Promise.all([
        api.listLaunchHistory(limit),
        api.getHistoryStats().catch(() => null),
      ]);
      setHistory(records || []);
      if (statsData) {
        setStats(statsData);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch launch history';
      toast.error('History Error', message);
    } finally {
      setIsLoading(false);
    }
  }, [limit, toast]);

  useEffect(() => {
    loadHistoryData();
  }, [loadHistoryData]);

  // Subscribe to live launch events so history stays updated automatically
  useEffect(() => {
    const unsubStart = onLaunchStart(() => {
      loadHistoryData();
    });
    const unsubExit = onLaunchExit(() => {
      loadHistoryData();
    });

    return () => {
      unsubStart();
      unsubExit();
    };
  }, [loadHistoryData]);

  // Re-launch a profile directly from history record
  const handleLaunchAgain = async (record: LaunchRecord) => {
    if (!record.profileId) {
      toast.error('Cannot Launch', 'Profile identifier is missing from this history record.');
      return;
    }

    setLaunchingId(record.id);
    try {
      await api.launchProfile(record.profileId);
      toast.success('Launch Initiated', `Starting session for "${record.profileName}"...`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to launch profile';
      toast.error('Launch Error', message);
    } finally {
      setLaunchingId(null);
    }
  };

  // Clear all history
  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      await api.clearLaunchHistory();
      setHistory([]);
      setStats({
        totalLaunches: 0,
        totalPlayTimeMs: 0,
      });
      toast.success('History Cleared', 'All launch history records have been deleted.');
      setIsClearModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to clear history';
      toast.error('Error Clearing History', message);
    } finally {
      setIsClearing(false);
    }
  };

  // Copy command line
  const handleCopyCommandLine = async (cmd: string) => {
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(true);
      toast.success('Command Copied', 'Launch command copied to clipboard.');
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      toast.error('Clipboard Error', 'Could not copy command line.');
    }
  };

  // Filtered history
  const filteredHistory = useMemo(() => {
    return history.filter((record) => {
      // Status filter
      if (statusFilter === 'success' && record.status !== 'success' && record.exitCode !== 0) {
        return false;
      }
      if (statusFilter === 'failed' && (record.status === 'success' || record.exitCode === 0)) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesProfile = record.profileName?.toLowerCase().includes(q);
        const matchesEngine = record.engineName?.toLowerCase().includes(q);
        const matchesIWAD = record.iwadName?.toLowerCase().includes(q);
        const matchesCmd = record.commandLine?.toLowerCase().includes(q);
        return matchesProfile || matchesEngine || matchesIWAD || matchesCmd;
      }

      return true;
    });
  }, [history, statusFilter, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-doom-bg text-doom-text">
      {/* Header Bar */}
      <div className="border-b border-doom-border bg-doom-surface px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-doom-cyan/20 text-doom-cyan border border-doom-cyan/40 shadow-inner">
                <HistoryIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black uppercase tracking-wider text-zinc-100">
                    Launch History
                  </h1>
                  <span className="rounded-full bg-doom-card px-2.5 py-0.5 text-xs font-mono font-semibold text-doom-muted border border-doom-border">
                    {history.length} Sessions Logged
                  </span>
                </div>
                <p className="text-xs text-doom-muted mt-0.5">
                  Detailed execution records, session runtimes, exit codes, and rapid re-launch
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadHistoryData}
              isLoading={isLoading}
              leftIcon={<RotateCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsClearModalOpen(true)}
              disabled={history.length === 0}
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
            >
              Clear History
            </Button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded border border-doom-border bg-doom-card p-0.5 text-xs font-medium">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                    : 'text-doom-muted hover:text-zinc-200'
                }`}
              >
                All Statuses
              </button>
              <button
                onClick={() => setStatusFilter('success')}
                className={`px-3 py-1 rounded transition-colors ${
                  statusFilter === 'success'
                    ? 'bg-emerald-950/80 text-emerald-300 font-semibold shadow-sm border border-emerald-700/50'
                    : 'text-doom-muted hover:text-zinc-200'
                }`}
              >
                Success Only
              </button>
              <button
                onClick={() => setStatusFilter('failed')}
                className={`px-3 py-1 rounded transition-colors ${
                  statusFilter === 'failed'
                    ? 'bg-red-950/80 text-red-300 font-semibold shadow-sm border border-red-700/50'
                    : 'text-doom-muted hover:text-zinc-200'
                }`}
              >
                Failed Only
              </button>
            </div>

            {/* Limit Selector */}
            <div className="flex items-center gap-1.5 text-xs text-doom-muted">
              <span>Show:</span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-doom-card border border-doom-border rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-doom-cyan"
              >
                <option value={25}>Last 25</option>
                <option value={50}>Last 50</option>
                <option value={100}>Last 100</option>
                <option value={250}>Last 250</option>
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div className="w-full md:w-72">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search profile, engine, IWAD..."
              leftIcon={<Search className="h-4 w-4 text-doom-muted" />}
              className="text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Summary Stats Cards Strip */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Launches */}
          <div className="p-4 rounded-lg border border-doom-border bg-doom-surface/60 flex items-center justify-between">
            <div>
              <span className="text-xs text-doom-muted uppercase tracking-wider block">
                Total Launches
              </span>
              <span className="text-xl font-bold font-mono text-zinc-100 mt-1 block">
                {stats ? stats.totalLaunches : history.length}
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-doom-red/10 text-doom-red border border-doom-red/30">
              <Flame className="h-5 w-5" />
            </div>
          </div>

          {/* Total Playtime */}
          <div className="p-4 rounded-lg border border-doom-border bg-doom-surface/60 flex items-center justify-between">
            <div>
              <span className="text-xs text-doom-muted uppercase tracking-wider block">
                Total Playtime
              </span>
              <span className="text-xl font-bold font-mono text-zinc-100 mt-1 block">
                {stats && stats.totalPlayTimeMs
                  ? formatDuration(stats.totalPlayTimeMs)
                  : formatDuration(
                      history.reduce((acc, curr) => acc + (curr.durationMs || 0), 0)
                    )}
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-doom-cyan/10 text-doom-cyan border border-doom-cyan/30">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          {/* Last Played */}
          <div className="p-4 rounded-lg border border-doom-border bg-doom-surface/60 flex items-center justify-between">
            <div>
              <span className="text-xs text-doom-muted uppercase tracking-wider block">
                Last Played
              </span>
              <span className="text-sm font-semibold text-zinc-200 mt-1 block truncate max-w-[150px]">
                {history.length > 0
                  ? formatTimeAgo(history[0].startedAt)
                  : 'No sessions yet'}
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-doom-green/10 text-doom-green border border-doom-green/30">
              <Calendar className="h-5 w-5" />
            </div>
          </div>

          {/* Most Played Profile */}
          <div className="p-4 rounded-lg border border-doom-border bg-doom-surface/60 flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-2">
              <span className="text-xs text-doom-muted uppercase tracking-wider block">
                Favorite Profile
              </span>
              <span className="text-sm font-bold text-doom-amber mt-1 block truncate">
                {stats?.mostPlayedProfileName ||
                  (history.length > 0 ? history[0].profileName : '—')}
              </span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-doom-amber/10 text-doom-amber border border-doom-amber/30 shrink-0">
              <Trophy className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* History Table */}
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <RotateCw className="h-8 w-8 animate-spin text-doom-cyan" />
            <span className="text-sm font-medium text-doom-muted">Loading launch logs...</span>
          </div>
        ) : filteredHistory.length === 0 ? (
          /* Empty State */
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-doom-border bg-doom-surface/40 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 border border-doom-border text-zinc-500 mb-4">
              <HistoryIcon className="h-8 w-8" />
            </div>
            {history.length === 0 ? (
              <>
                <h3 className="text-lg font-bold text-zinc-200">No Launch History Recorded</h3>
                <p className="mt-1 max-w-md text-xs text-doom-muted">
                  When you launch a Doom profile from the Dashboard or Profiles view, execution logs,
                  runtimes, and status results will automatically appear here.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-zinc-200">No matching records found</h3>
                <p className="mt-1 text-xs text-doom-muted">
                  Try adjusting your search query or switching status filters.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              </>
            )}
          </div>
        ) : (
          /* Table of Launch Logs */
          <div className="overflow-hidden rounded-lg border border-doom-border bg-doom-card shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-doom-border bg-doom-surface text-zinc-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Profile</th>
                  <th className="py-3 px-4">Engine</th>
                  <th className="py-3 px-4">Base IWAD</th>
                  <th className="py-3 px-4">Started At</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Exit</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-doom-border/60">
                {filteredHistory.map((record) => {
                  const isSuccess = record.status === 'success' || record.exitCode === 0;
                  const isLaunching = launchingId === record.id;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedRecord(record)}
                    >
                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-700/50">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            SUCCESS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-950/60 text-red-300 border border-red-700/50">
                            <XCircle className="h-3.5 w-3.5" />
                            FAILED
                          </span>
                        )}
                      </td>

                      {/* Profile Name */}
                      <td className="py-3 px-4 font-semibold text-zinc-100">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate group-hover:text-doom-red transition-colors max-w-[180px]">
                            {record.profileName || 'Unknown Profile'}
                          </span>
                        </div>
                      </td>

                      {/* Engine */}
                      <td className="py-3 px-4 text-zinc-300 font-mono text-[11px]">
                        {record.engineName || 'Default Port'}
                      </td>

                      {/* IWAD */}
                      <td className="py-3 px-4 text-zinc-300 font-mono text-[11px]">
                        {record.iwadName || 'DOOM2.WAD'}
                      </td>

                      {/* Started At */}
                      <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                        <div>{formatDate(record.startedAt)}</div>
                        <div className="text-[10px] text-doom-muted">{formatTimeAgo(record.startedAt)}</div>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 font-mono text-zinc-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-doom-muted" />
                          <span>{formatDuration(record.durationMs)}</span>
                        </div>
                      </td>

                      {/* Exit Code */}
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <span
                          className={`text-[11px] ${
                            isSuccess ? 'text-emerald-400' : 'text-red-400 font-bold'
                          }`}
                        >
                          {record.exitCode ?? 0}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => setSelectedRecord(record)}
                            leftIcon={<Terminal className="h-3 w-3" />}
                          >
                            Details
                          </Button>
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => handleLaunchAgain(record)}
                            isLoading={isLaunching}
                            leftIcon={<Play className="h-3 w-3 fill-current" />}
                          >
                            Launch Again
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Launch Details Modal */}
      <Modal
        isOpen={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        title={
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-bold tracking-wide text-zinc-100 uppercase">
                Launch Execution Details
              </div>
              <div className="text-xs text-doom-muted font-normal">
                Profile: {selectedRecord?.profileName}
              </div>
            </div>
          </div>
        }
        size="lg"
      >
        {selectedRecord && (
          <div className="space-y-4">
            {/* Metadata Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded bg-doom-surface border border-doom-border text-xs">
              <div>
                <span className="text-[10px] text-doom-muted uppercase tracking-wider block">
                  Status
                </span>
                <span
                  className={`font-bold font-mono text-[11px] ${
                    selectedRecord.status === 'success' || selectedRecord.exitCode === 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {(selectedRecord.status || 'success').toUpperCase()} (Exit: {selectedRecord.exitCode})
                </span>
              </div>

              <div>
                <span className="text-[10px] text-doom-muted uppercase tracking-wider block">
                  Engine Port
                </span>
                <span className="font-mono text-zinc-200 text-[11px] truncate block">
                  {selectedRecord.engineName}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-doom-muted uppercase tracking-wider block">
                  Base IWAD
                </span>
                <span className="font-mono text-zinc-200 text-[11px] truncate block">
                  {selectedRecord.iwadName}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-doom-muted uppercase tracking-wider block">
                  Session Runtime
                </span>
                <span className="font-mono text-zinc-200 text-[11px] block">
                  {formatDuration(selectedRecord.durationMs)}
                </span>
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-3 rounded bg-zinc-900/50 border border-zinc-800">
              <div>
                <span className="text-doom-muted">Execution Started:</span>{' '}
                <span className="text-zinc-200 font-mono">{formatDate(selectedRecord.startedAt)}</span>
              </div>
              <div>
                <span className="text-doom-muted">Execution Finished:</span>{' '}
                <span className="text-zinc-200 font-mono">
                  {selectedRecord.finishedAt ? formatDate(selectedRecord.finishedAt) : 'In progress / exited'}
                </span>
              </div>
            </div>

            {/* Full Command Line String */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300 uppercase tracking-wider">
                  Full Command Line Invocation
                </span>
                {selectedRecord.commandLine && (
                  <button
                    onClick={() => handleCopyCommandLine(selectedRecord.commandLine || '')}
                    className="flex items-center gap-1 text-xs text-doom-cyan hover:underline"
                  >
                    {copiedCmd ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Command</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="p-3 rounded bg-black/80 border border-zinc-800 font-mono text-xs text-emerald-400 break-all select-all whitespace-pre-wrap max-h-48 overflow-y-auto">
                {selectedRecord.commandLine || 'Command line parameters not logged for this session.'}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-doom-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRecord(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  handleLaunchAgain(selectedRecord);
                  setSelectedRecord(null);
                }}
                leftIcon={<Play className="h-4 w-4 fill-current" />}
              >
                Launch Profile Again
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Clear History Confirmation Modal */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider">
            <ShieldAlert className="h-5 w-5" />
            <span>Clear Launch History</span>
          </div>
        }
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-zinc-300">
            Are you sure you want to delete all <strong className="text-white">{history.length}</strong> recorded launch history logs?
          </p>
          <div className="p-3 bg-red-950/30 border border-red-900/50 rounded text-xs text-red-300">
            This action is permanent. All historical play records and session metrics will be cleared from SQLite.
          </div>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-doom-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsClearModalOpen(false)}
              disabled={isClearing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleClearHistory}
              isLoading={isClearing}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Clear All Logs
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
