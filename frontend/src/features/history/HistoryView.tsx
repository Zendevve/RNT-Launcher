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
      toast.info('Launching Profile', `Starting "${record.profileName || 'Doom'}"...`);
      await api.launchProfile(record.profileId);
      toast.success('Game Launched', `Started "${record.profileName || 'Doom'}".`);
      loadHistoryData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not launch profile';
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0c0e12] text-zinc-100 select-none">
      {/* Desktop Toolbar */}
      <div className="border-b border-[#22262d] bg-[#101317] px-8 py-3.5 space-y-3 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history by profile, engine, IWAD..."
              className="w-full rounded-md border border-[#22262d] bg-black/40 pl-8 pr-16 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-red-600 focus:outline-hidden font-mono"
            />
            <span className="absolute right-2.5 top-2 text-[10px] font-mono text-zinc-500">
              {filteredHistory.length}/{history.length}
            </span>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5">
            {/* Status Filter Pills */}
            <div className="flex items-center rounded-md border border-[#22262d] bg-black/40 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded transition-colors duration-150 ${
                  statusFilter === 'all'
                    ? 'bg-white/[0.12] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                All ({history.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('success')}
                className={`px-2.5 py-1 rounded transition-colors duration-150 ${
                  statusFilter === 'success'
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Success
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('failed')}
                className={`px-2.5 py-1 rounded transition-colors duration-150 ${
                  statusFilter === 'failed'
                    ? 'bg-red-950/40 text-red-300 border border-red-800/40'
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
                className="bg-black/40 border border-[#22262d] rounded-md px-2 py-1 text-xs text-zinc-200 focus:outline-hidden focus:border-white/[0.2]"
              >
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
                <option value={250}>250 rows</option>
                <option value={500}>500 rows</option>
              </select>
            </div>

            <div className="h-4 w-px bg-[#22262d] mx-1 hidden sm:block" />

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

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {/* Summary Telemetry Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Launches */}
          <div className="p-3.5 rounded-lg border border-[#22262d] bg-[#14171c] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 font-medium block">Total Launches</span>
              <span className="text-lg font-semibold text-zinc-100 font-mono mt-0.5 block">
                {stats ? stats.totalLaunches : history.length}
              </span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1b1f26] text-red-400 border border-[#22262d]">
              <Flame className="h-4 w-4" />
            </div>
          </div>

          {/* Total Playtime */}
          <div className="p-3.5 rounded-lg border border-[#22262d] bg-[#14171c] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 font-medium block">Total Playtime</span>
              <span className="text-lg font-semibold text-zinc-100 font-mono mt-0.5 block">
                {stats && stats.totalPlayTimeMs
                  ? formatDuration(stats.totalPlayTimeMs)
                  : formatDuration(history.reduce((acc, curr) => acc + (curr.durationMs || 0), 0))}
              </span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1b1f26] text-blue-400 border border-[#22262d]">
              <Clock className="h-4 w-4" />
            </div>
          </div>

          {/* Last Played */}
          <div className="p-3.5 rounded-lg border border-[#22262d] bg-[#14171c] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 font-medium block">Last Played</span>
              <span className="text-xs text-zinc-300 mt-1 block truncate max-w-[140px]">
                {history[0]?.startedAt ? formatTimeAgo(history[0].startedAt) : 'No sessions yet'}
              </span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1b1f26] text-emerald-400 border border-[#22262d]">
              <Calendar className="h-4 w-4" />
            </div>
          </div>

          {/* Most Played Profile */}
          <div className="p-3.5 rounded-lg border border-[#22262d] bg-[#14171c] flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-2">
              <span className="text-[11px] text-zinc-400 font-medium block">Favorite Setup</span>
              <span className="text-xs font-semibold text-zinc-200 mt-1 block truncate">
                {stats?.mostPlayedProfileName || (history.length > 0 ? history[0].profileName : '-')}
              </span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1b1f26] text-amber-400 border border-[#22262d] shrink-0">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* History Table */}
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <RotateCw className="h-6 w-6 animate-spin text-zinc-400" />
            <span className="text-xs font-medium text-zinc-400">Loading launch history...</span>
          </div>
        ) : filteredHistory.length === 0 ? (
          /* Empty State */
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-[#22262d] bg-[#14171c]/50 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1b1f26] border border-[#22262d] text-zinc-400 mb-3">
              <HistoryIcon className="h-6 w-6" />
            </div>
            {history.length === 0 ? (
              <>
                <h3 className="text-sm font-semibold text-zinc-100">No Launch History Recorded</h3>
                <p className="mt-1 max-w-md text-xs text-zinc-400 leading-relaxed">
                  When you launch a Doom profile from the Launchpad, execution logs, runtimes, and status results will automatically appear here.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-zinc-100">No matching records found</h3>
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
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#22262d] bg-black/30 text-zinc-400 font-medium">
                <tr>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Profile</th>
                  <th className="px-4 py-2.5">Engine</th>
                  <th className="px-4 py-2.5">Base IWAD</th>
                  <th className="px-4 py-2.5">Duration</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22262d]">
                {filteredHistory.map((record) => {
                  const isSuccess = record.status === 'success' || record.exitCode === 0;
                  const isLaunching = launchingId === record.id;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-[#1b1f26] transition-colors duration-150 group cursor-pointer"
                      onClick={() => setSelectedRecord(record)}
                    >
                      {/* Status */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/30">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                            <span>Success</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-red-950/40 text-red-300 border border-red-800/30">
                            <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                            <span>Failed ({record.exitCode ?? 1})</span>
                          </span>
                        )}
                      </td>

                      {/* Profile Name */}
                      <td className="px-4 py-2.5 font-medium text-zinc-100">
                        <span className="truncate group-hover:text-white transition-colors duration-150 max-w-[180px] block">
                          {record.profileName || 'Unknown Profile'}
                        </span>
                      </td>

                      {/* Engine */}
                      <td className="px-4 py-2.5 text-zinc-300 font-mono text-[11px]">
                        {record.engineName || 'Default Port'}
                      </td>

                      {/* IWAD */}
                      <td className="px-4 py-2.5 text-zinc-300 font-mono text-[11px]">
                        {record.iwadName || 'DOOM2.WAD'}
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-2.5 font-mono text-zinc-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-zinc-500" />
                          <span>{formatDuration(record.durationMs)}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap">
                        <div>{formatDate(record.startedAt)}</div>
                        <div className="text-[10px] text-zinc-500">{formatTimeAgo(record.startedAt)}</div>
                      </td>

                      {/* Actions */}
                      <td
                        className="px-4 py-2.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
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
                            Play Again
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
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1b1f26] text-zinc-300 border border-[#22262d]">
              <Terminal className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-black/40 border border-[#22262d] text-xs font-mono">
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
              <div>
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-medium">
                  <span>Full Command Executed</span>
                  <button
                    type="button"
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
                <div className="bg-[#101214] border border-[#22262d] rounded-lg p-3 font-mono text-xs text-zinc-300 break-all select-all max-h-36 overflow-y-auto">
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
