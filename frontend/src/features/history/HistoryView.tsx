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
  Copy,
  Check,
  Flame,
  X,
  Loader2,
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
      const [records, statsData] = await Promise.all([
        api.listLaunchHistory(limit),
        api.getHistoryStats(),
      ]);
      setHistory(records || []);
      setStats(statsData || null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load history';
      toast.error('History Load Error', message);
    } finally {
      setIsLoading(false);
    }
  }, [limit, toast]);

  useEffect(() => {
    loadHistoryData();
  }, [loadHistoryData]);

  // Re-launch a profile directly from history record
  const handleLaunchAgain = async (record: LaunchRecord) => {
    setLaunchingId(record.id);
    try {
      toast.info('Launching Preset', `Starting "${record.profileName || 'Doom'}"...`);
      await api.launchProfile(record.profileId);
      toast.success('Game Launched', `Started "${record.profileName || 'Doom'}".`);
      loadHistoryData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not launch preset';
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
      toast.success('Command Copied', 'Launch command copied to clipboard.');
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      toast.error('Clipboard Error', 'Could not copy command.');
    }
  };

  // Filtered history
  const filteredHistory = useMemo(() => {
    return history.filter((record) => {
      // Status filter
      if (statusFilter === 'success' && record.status !== 'success' && record.exitCode !== 0) {
        return false;
      }
      if (statusFilter === 'failed' && record.status !== 'failed' && record.exitCode === 0) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesProfile = record.profileName ? record.profileName.toLowerCase().includes(q) : false;
        const matchesEngine = record.engineName ? record.engineName.toLowerCase().includes(q) : false;
        const matchesIwad = record.iwadName ? record.iwadName.toLowerCase().includes(q) : false;
        const matchesCmd = record.commandLine ? record.commandLine.toLowerCase().includes(q) : false;
        return matchesProfile || matchesEngine || matchesIwad || matchesCmd;
      }

      return true;
    });
  }, [history, statusFilter, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-[#0c0e12] text-zinc-100 select-none">
      {/* TOOLBAR: Search, Status Filters, Row Limit, Refresh, Clear (44px) */}
      <div className="border-b border-[#22262d] bg-[#14171c] px-6 py-2.5 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        {/* Left: Search input */}
        <div className="relative flex items-center flex-1 max-w-md">
          <Search className="absolute left-3 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history by preset, engine, IWAD..."
            className="w-full rounded-md border border-[#22262d] bg-[#0c0e12] pl-9 pr-8 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-hidden transition-colors font-normal"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Right: Status Filters, Limit, Refresh, Clear */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Status Filter Pills */}
          <div className="flex items-center rounded border border-[#22262d] bg-[#0c0e10] p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === 'all'
                  ? 'bg-[#1b1f26] text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({history.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('success')}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === 'success'
                  ? 'bg-emerald-950/40 text-emerald-300 font-semibold border border-emerald-800/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Success
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('failed')}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === 'failed'
                  ? 'bg-red-950/40 text-red-300 font-semibold border border-red-800/40'
                  : 'text-zinc-400 hover:text-zinc-200'
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
              aria-label="Row limit"
              className="bg-[#14171c] border border-[#22262d] rounded px-2.5 py-1 text-xs text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={250}>250 rows</option>
              <option value={500}>500 rows</option>
            </select>
          </div>

          <div className="h-4 w-px bg-[#22262d]" />

          <button
            type="button"
            onClick={loadHistoryData}
            title="Refresh history"
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsClearModalOpen(true)}
            disabled={history.length === 0}
            className="inline-flex items-center gap-1.5 rounded border border-red-900/40 bg-red-950/20 hover:bg-red-950/40 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT VIEWPORT */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Compact Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Total Launches */}
          <div className="p-3.5 rounded-lg border border-[#22262d] bg-[#14171c] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 font-medium block">Total Launches</span>
              <span className="text-base font-bold text-zinc-100 font-mono mt-0.5 block">
                {stats ? stats.totalLaunches : history.length}
              </span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[#181c22] text-[#dc2626] border border-[#22262d]">
              <Flame className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Total Playtime */}
          <div className="p-3.5 rounded-lg border border-[#22262d] bg-[#14171c] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 font-medium block">Total Playtime</span>
              <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
                {stats && stats.totalPlayTimeMs
                  ? formatDuration(stats.totalPlayTimeMs)
                  : formatDuration(history.reduce((acc, curr) => acc + (curr.durationMs || 0), 0))}
              </span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[#181c22] text-blue-400 border border-[#22262d]">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Last Played */}
          <div className="p-3.5 rounded-lg border border-[#22262d] bg-[#14171c] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 font-medium block">Last Session</span>
              <span className="text-xs text-zinc-300 mt-1 block truncate max-w-[140px]">
                {history[0]?.startedAt ? formatTimeAgo(history[0].startedAt) : 'No sessions yet'}
              </span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[#181c22] text-emerald-400 border border-[#22262d]">
              <Calendar className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Favorite Setup */}
          <div className="p-3.5 rounded-lg border border-[#22262d] bg-[#14171c] flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-2">
              <span className="text-[11px] text-zinc-400 font-medium block">Most Played</span>
              <span className="text-xs font-semibold text-zinc-200 mt-1 block truncate">
                {stats?.mostPlayedProfileName || (history.length > 0 ? history[0].profileName : 'None')}
              </span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[#181c22] text-amber-400 border border-[#22262d] shrink-0">
              <Trophy className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* History Table / Empty State */}
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-zinc-500">
            <RotateCw className="h-6 w-6 animate-spin" />
            <span className="text-xs">Loading launch history...</span>
          </div>
        ) : filteredHistory.length === 0 ? (
          /* Empty State */
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-[#22262d] bg-[#14171c]/40 p-8 text-center">
            <HistoryIcon className="h-10 w-10 text-zinc-600 mb-3" />
            {history.length === 0 ? (
              <>
                <h3 className="text-sm font-semibold text-zinc-200">No Launch History Recorded</h3>
                <p className="mt-1 max-w-md text-xs text-zinc-400 leading-relaxed">
                  When you launch a Doom preset, execution runtimes, exit codes, and durations will automatically be logged here.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-zinc-200">No matching records found</h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Try adjusting your search query or switching status filters.
                </p>
                <Button
                  variant="outline"
                  size="xs"
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              </>
            )}
          </div>
        ) : (
          /* History Table */
          <div className="overflow-hidden rounded-lg border border-[#22262d] bg-[#14171c]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#22262d] bg-[#101317] text-[11px] font-semibold text-zinc-400 select-none">
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Preset</th>
                    <th className="px-4 py-2.5">Port</th>
                    <th className="px-4 py-2.5">Base IWAD</th>
                    <th className="px-4 py-2.5">Duration</th>
                    <th className="px-4 py-2.5">When</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2229]">
                  {filteredHistory.map((record) => {
                    const isSuccess = record.status === 'success' || record.exitCode === 0;
                    const isLaunching = launchingId === record.id;

                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-[#181c22] transition-colors duration-100 group cursor-pointer"
                        onClick={() => setSelectedRecord(record)}
                      >
                        {/* Status */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                              <span>Success</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-red-950/40 text-red-400 border border-red-800/40">
                              <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                              <span>Failed ({record.exitCode ?? 1})</span>
                            </span>
                          )}
                        </td>

                        {/* Preset Name */}
                        <td className="px-4 py-2.5 font-semibold text-zinc-100">
                          <span className="truncate group-hover:text-white transition-colors max-w-[200px] block">
                            {record.profileName || 'Default Setup'}
                          </span>
                        </td>

                        {/* Engine */}
                        <td className="px-4 py-2.5 text-zinc-400 font-mono text-[11px]">
                          {record.engineName || 'Port'}
                        </td>

                        {/* IWAD */}
                        <td className="px-4 py-2.5 text-zinc-400 font-mono text-[11px]">
                          {record.iwadName || 'DOOM2.WAD'}
                        </td>

                        {/* Duration */}
                        <td className="px-4 py-2.5 font-mono text-zinc-400 whitespace-nowrap">
                          {formatDuration(record.durationMs)}
                        </td>

                        {/* When */}
                        <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap" title={formatDate(record.startedAt)}>
                          {formatTimeAgo(record.startedAt)}
                        </td>

                        {/* Actions */}
                        <td
                          className="px-4 py-2.5 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(record)}
                              className="px-2 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] rounded transition-colors"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLaunchAgain(record)}
                              disabled={isLaunching}
                              className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#5e7ce2] hover:bg-[#4d6bd4] px-2.5 py-1 text-xs font-[600] text-[#09090b] transition-colors disabled:opacity-50"
                            >
                              {isLaunching ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Starting</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-3 w-3 fill-current" />
                                  <span>Play</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Launch Details Modal */}
      <Modal
        isOpen={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        title="Launch Execution Details"
        size="lg"
      >
        {selectedRecord && (
          <div className="space-y-4">
            {/* Metadata Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-[#101317] border border-[#22262d] text-xs font-mono">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Status</span>
                <span
                  className={`font-semibold text-xs mt-0.5 block ${
                    selectedRecord.status === 'success' || selectedRecord.exitCode === 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {(selectedRecord.status || 'success').toUpperCase()} (Exit: {selectedRecord.exitCode})
                </span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Duration</span>
                <span className="text-zinc-200 font-medium mt-0.5 block">
                  {formatDuration(selectedRecord.durationMs)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Source Port</span>
                <span className="text-zinc-200 truncate mt-0.5 block" title={selectedRecord.engineName}>
                  {selectedRecord.engineName || 'Default'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Base IWAD</span>
                <span className="text-zinc-200 truncate mt-0.5 block" title={selectedRecord.iwadName}>
                  {selectedRecord.iwadName || 'DOOM2.WAD'}
                </span>
              </div>
            </div>

            {/* Execution Command Line */}
            {selectedRecord.commandLine && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                  <span>Executed Command</span>
                  <button
                    type="button"
                    onClick={() => handleCopyCommandLine(selectedRecord.commandLine)}
                    className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    {copiedCmd ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-[#101317] border border-[#22262d] font-mono text-xs text-zinc-300 break-all leading-relaxed select-all">
                  {selectedRecord.commandLine}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-[#22262d] font-mono">
              <span>Started: {formatDate(selectedRecord.startedAt)}</span>
              {selectedRecord.finishedAt && (
                <span>Finished: {formatDate(selectedRecord.finishedAt)}</span>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Clear History Confirmation Modal */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title="Clear Launch History"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="ghost" onClick={() => setIsClearModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleClearHistory}
              isLoading={isClearing}
            >
              Clear
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[#a1a1aa] leading-relaxed">
          Are you sure you want to clear <span className="text-[#f4f4f5] font-medium">all launch history records</span>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};
