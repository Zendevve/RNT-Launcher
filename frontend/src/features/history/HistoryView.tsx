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
} from 'lucide-react';
import { LaunchRecord, HistoryStats } from '../../types';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
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
      const [historyData, statsData] = await Promise.all([
        api.listLaunchHistory(limit),
        api.getHistoryStats(),
      ]);
      setHistory(historyData || []);
      setStats(statsData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch history';
      toast.error('Error Loading History', message);
    } finally {
      setIsLoading(false);
    }
  }, [limit, toast]);

  useEffect(() => {
    loadHistoryData();
  }, [loadHistoryData]);

  // Re-launch a profile directly from history record
  const handleLaunchAgain = async (record: LaunchRecord) => {
    if (launchingId === record.id) return;
    setLaunchingId(record.id);
    try {
      toast.info('Launching Profile', `Executing "${record.profileName}"...`);
      await api.launchProfile(record.profileId);
      toast.success('Launched Successfully', `Process started for "${record.profileName}".`);
      await loadHistoryData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Re-launch failed';
      toast.error('Launch Failed', message);
    } finally {
      setLaunchingId(null);
    }
  };

  // Clear all history
  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      await api.clearLaunchHistory();
      toast.success('History Cleared', 'All launch session records have been deleted.');
      setHistory([]);
      setStats(null);
      setIsClearModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to clear history';
      toast.error('Clear Error', message);
    } finally {
      setIsClearing(false);
    }
  };

  // Copy command line
  const handleCopyCommandLine = async (cmd?: string) => {
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(true);
      toast.success('Command Copied', 'Execution parameters copied to clipboard.');
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      toast.error('Clipboard Error', 'Could not copy command.');
    }
  };

  // Filtered history
  const filteredHistory = useMemo(() => {
    return history.filter((record) => {
      if (statusFilter === 'success' && record.status !== 'success' && record.exitCode !== 0) {
        return false;
      }
      if (statusFilter === 'failed' && (record.status === 'success' || record.exitCode === 0)) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesProfile = record.profileName?.toLowerCase().includes(q) || false;
        const matchesEngine = record.engineName?.toLowerCase().includes(q) || false;
        const matchesIWAD = record.iwadName?.toLowerCase().includes(q) || false;
        const matchesCmd = record.commandLine?.toLowerCase().includes(q) || false;
        return matchesProfile || matchesEngine || matchesIWAD || matchesCmd;
      }

      return true;
    });
  }, [history, statusFilter, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0c0e10] text-zinc-100 select-none">
      {/* Streamlined Single Desktop Toolbar */}
      <div className="border-b border-white/[0.07] bg-[#14171a] px-8 py-3.5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history by profile, engine, IWAD..."
              className="w-full rounded-md border border-white/[0.08] bg-black/40 pl-8 pr-16 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-doom-red focus:outline-hidden font-mono"
            />
            <span className="absolute right-2.5 top-2 text-[10px] font-mono text-zinc-500">
              {filteredHistory.length}/{history.length}
            </span>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5">
            {/* Status Filter Tabs */}
            <div className="flex items-center rounded-md border border-white/[0.08] bg-black/40 p-0.5 text-xs font-medium">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white/[0.12] text-white font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('success')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'success'
                    ? 'bg-[#122419] text-[#86efac] font-semibold border border-emerald-800/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Success
              </button>
              <button
                onClick={() => setStatusFilter('failed')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'failed'
                    ? 'bg-[#2b1416] text-[#fca5a5] font-semibold border border-red-800/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Failed
              </button>
            </div>

            {/* Limit Selector */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-black/40 border border-white/[0.08] rounded-md px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-400"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>

            <div className="h-4 w-px bg-white/[0.08] mx-1 hidden sm:block" />

            <Button
              variant="secondary"
              size="xs"
              onClick={loadHistoryData}
              isLoading={isLoading}
              leftIcon={<RotateCw className="h-3 w-3" />}
            >
              Refresh
            </Button>
            <Button
              variant="danger"
              size="xs"
              onClick={() => setIsClearModalOpen(true)}
              disabled={history.length === 0}
              leftIcon={<Trash2 className="h-3 w-3" />}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {/* Summary Stats Cards Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Launches */}
          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#15181c] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block font-semibold">
                Total Launches
              </span>
              <span className="text-xl font-bold font-mono text-white mt-1 block">
                {stats ? stats.totalLaunches : history.length}
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2b1416] text-[#fca5a5] border border-red-800/30">
              <Flame className="h-4 w-4" />
            </div>
          </div>

          {/* Total Playtime */}
          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#15181c] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block font-semibold">
                Total Playtime
              </span>
              <span className="text-xl font-bold font-mono text-white mt-1 block">
                {stats && stats.totalPlayTimeMs
                  ? formatDuration(stats.totalPlayTimeMs)
                  : formatDuration(
                      history.reduce((acc, curr) => acc + (curr.durationMs || 0), 0)
                    )}
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#132232] text-[#93c5fd] border border-blue-800/30">
              <Clock className="h-4 w-4" />
            </div>
          </div>

          {/* Last Played */}
          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#15181c] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block font-semibold">
                Last Played
              </span>
              <span className="text-xs font-semibold text-zinc-200 mt-1.5 block truncate max-w-[150px]">
                {history.length > 0
                  ? formatTimeAgo(history[0].startedAt)
                  : 'No sessions yet'}
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#122419] text-[#86efac] border border-emerald-800/30">
              <Calendar className="h-4 w-4" />
            </div>
          </div>

          {/* Most Played Profile */}
          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#15181c] flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-2">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block font-semibold">
                Favorite Profile
              </span>
              <span className="text-xs font-bold text-amber-400 mt-1.5 block truncate">
                {stats?.mostPlayedProfileName ||
                  (history.length > 0 ? history[0].profileName : '-')}
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2b2011] text-[#fde047] border border-amber-800/30 shrink-0">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* History Table */}
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <RotateCw className="h-8 w-8 animate-spin text-blue-400" />
            <span className="text-sm font-medium text-zinc-400">Loading launch logs...</span>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.08] text-zinc-400 mb-4">
              <HistoryIcon className="h-8 w-8" />
            </div>
            {history.length === 0 ? (
              <>
                <h3 className="text-lg font-bold text-white tracking-tight">No Launch History Recorded</h3>
                <p className="mt-1 max-w-md text-xs text-zinc-400 leading-relaxed">
                  When you launch a Doom profile from the Dashboard or Profiles view, execution logs,
                  runtimes, and status results will automatically appear here.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-white">No matching records found</h3>
                <p className="mt-1 text-xs text-zinc-400">
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
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#15181c]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.07] bg-white/[0.02] text-zinc-400 uppercase tracking-wider font-semibold text-[10.5px]">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Profile</th>
                  <th className="px-4 py-3">Engine</th>
                  <th className="px-4 py-3">Base IWAD</th>
                  <th className="px-4 py-3">Started At</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Exit</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredHistory.map((record) => {
                  const isSuccess = record.status === 'success' || record.exitCode === 0;
                  const isLaunching = launchingId === record.id;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-white/[0.04] transition-colors group cursor-pointer"
                      onClick={() => setSelectedRecord(record)}
                    >
                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-semibold bg-[#122419] text-[#86efac] border border-emerald-800/30">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            SUCCESS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-semibold bg-[#2b1416] text-[#fca5a5] border border-red-800/30">
                            <XCircle className="h-3.5 w-3.5 text-red-400" />
                            FAILED
                          </span>
                        )}
                      </td>

                      {/* Profile Name */}
                      <td className="px-4 py-3 font-semibold text-white">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate group-hover:text-red-400 transition-colors max-w-[180px]">
                            {record.profileName || 'Unknown Profile'}
                          </span>
                        </div>
                      </td>

                      {/* Engine */}
                      <td className="px-4 py-3 text-zinc-300 font-mono text-[11px]">
                        {record.engineName || 'Default Port'}
                      </td>

                      {/* IWAD */}
                      <td className="px-4 py-3 text-zinc-300 font-mono text-[11px]">
                        {record.iwadName || 'DOOM2.WAD'}
                      </td>

                      {/* Started At */}
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                        <div>{formatDate(record.startedAt)}</div>
                        <div className="text-[10px] text-zinc-500">{formatTimeAgo(record.startedAt)}</div>
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3 font-mono text-zinc-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-zinc-500" />
                          <span>{formatDuration(record.durationMs)}</span>
                        </div>
                      </td>

                      {/* Exit Code */}
                      <td className="px-4 py-3 font-mono whitespace-nowrap">
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
                        className="px-4 py-3 text-right whitespace-nowrap"
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-300 border border-white/[0.08]">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-white uppercase">
                Launch Execution Details
              </div>
              <div className="text-xs text-zinc-400 font-normal">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-black/40 border border-white/[0.06] text-xs font-mono">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                  Status
                </span>
                <span
                  className={`font-bold text-[11px] ${
                    selectedRecord.status === 'success' || selectedRecord.exitCode === 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {(selectedRecord.status || 'success').toUpperCase()} (Exit: {selectedRecord.exitCode})
                </span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                  Duration
                </span>
                <span className="text-zinc-200 font-semibold">
                  {formatDuration(selectedRecord.durationMs)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                  Source Port
                </span>
                <span className="text-zinc-200 truncate block" title={selectedRecord.engineName}>
                  {selectedRecord.engineName || 'Default'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                  Base IWAD
                </span>
                <span className="text-zinc-200 truncate block" title={selectedRecord.iwadName}>
                  {selectedRecord.iwadName || 'DOOM2.WAD'}
                </span>
              </div>
            </div>

            {/* Execution Command Line */}
            {selectedRecord.commandLine && (
              <div>
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-semibold">
                  <span>Full Command Executed</span>
                  <button
                    onClick={() => handleCopyCommandLine(selectedRecord.commandLine)}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors"
                  >
                    {copiedCmd ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedCmd ? 'Copied' : 'Copy Command'}</span>
                  </button>
                </div>
                <div className="bg-[#101214] border border-white/[0.06] rounded-xl p-3 font-mono text-xs text-zinc-300 break-all select-all max-h-36 overflow-y-auto">
                  {selectedRecord.commandLine}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Confirm Clear History Modal */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title="Clear Launch History"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsClearModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isClearing}
              onClick={handleClearHistory}
            >
              Clear All Records
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-300 leading-relaxed">
          Are you sure you want to delete all <span className="font-semibold text-white">{history.length}</span> logged
          launch history sessions? This will reset your logged playtime telemetry statistics.
        </p>
      </Modal>
    </div>
  );
};
