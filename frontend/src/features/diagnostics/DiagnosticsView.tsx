import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  Layers,
  RotateCw,
  Trash2,
  Wrench,
  XCircle,
  Terminal,
  ShieldCheck,
  Search,
  X,
  Cpu,
  Disc,
} from 'lucide-react';
import { api } from '../../services/api';
import { DiagnosticsReport, DiagnosticIssue, LogEntry } from '../../types';
import { cn } from '../../utils/cn';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

interface DiagnosticsViewProps {
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}
export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({ onNotify }) => {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'errors' | 'warnings' | 'logs'>('all');
  const [logFilter, setLogFilter] = useState('');
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [showPruneConfirm, setShowPruneConfirm] = useState(false);

  const fetchDiagnostics = useCallback(async () => {
    setIsLoading(true);
    try {
      const [diagData, logsData] = await Promise.all([
        api.runDiagnostics(),
        api.getSystemLogs(),
      ]);
      setReport(diagData);
      setLogs(logsData || []);
    } catch (err) {
      console.error('Failed to run diagnostics:', err);
      onNotify?.('Failed to run diagnostics check', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  const handleRepair = async (issue: DiagnosticIssue) => {
    if (!issue.repairAction) return;
    setRepairingId(issue.id);
    try {
      await api.repairDiagnosticIssue(issue.repairAction, issue.targetId || '');
      onNotify?.(issue.title ? `Repaired: ${issue.title}` : 'Repaired issue successfully', 'success');
      await fetchDiagnostics();
    } catch (err: unknown) {
      console.error('Repair failed:', err);
      onNotify?.('Failed to repair diagnostic issue', 'error');
    } finally {
      setRepairingId(null);
    }
  };

  const handlePruneAll = () => {
    setShowPruneConfirm(true);
  };

  const handleConfirmPruneAll = async () => {
    setShowPruneConfirm(false);
    setIsLoading(true);
    try {
      await api.repairDiagnosticIssue('prune_all_missing', '');
      onNotify?.('Successfully pruned missing files and cleaned profiles', 'success');
      await fetchDiagnostics();
    } catch (err: unknown) {
      console.error('Prune failed:', err);
      onNotify?.('Failed to prune missing resources', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      await api.clearSystemLogs();
      setLogs([]);
      onNotify?.('System logs cleared', 'info');
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  const filteredIssues = (report?.issues || []).filter((issue: DiagnosticIssue) => {
    if (activeTab === 'errors') return issue.severity === 'error';
    if (activeTab === 'warnings') return issue.severity === 'warning';
    return true;
  });

  const filteredLogs = logs.filter(
    (l) =>
      l.message.toLowerCase().includes(logFilter.toLowerCase()) ||
      l.level.toLowerCase().includes(logFilter.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-[#0c0e12] text-zinc-100 select-none">
      {/* TOOLBAR: Title, Status Badge, Re-scan, Prune All (44px) */}
      <div className="border-b border-[#22262d] bg-[#14171c] px-6 py-2.5 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-zinc-100 tracking-tight">
            Diagnostics & Health
          </h1>
          {report?.overallStatus && (
            <span
              className={cn(
                'rounded px-2 py-0.5 text-[11px] font-mono font-medium uppercase tracking-wider',
                report.overallStatus === 'healthy'
                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                  : report.overallStatus === 'warning'
                  ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
                  : 'bg-red-950/40 text-red-400 border border-red-800/40'
              )}
            >
              {report.overallStatus}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchDiagnostics}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded border border-[#22262d] bg-[#181c21] hover:bg-[#1f242e] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RotateCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            <span>Re-scan Health</span>
          </button>

          {(report?.summary?.totalIssues ?? 0) > 0 && (
            <button
              type="button"
              onClick={handlePruneAll}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded border border-red-900/40 bg-red-950/20 hover:bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Prune Missing Resources</span>
            </button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT VIEWPORT */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Health Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Card */}
          <div className="p-4 rounded-lg bg-[#14171c] border border-[#22262d] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">System Integrity</span>
              {report?.overallStatus === 'healthy' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {report?.overallStatus === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
              {report?.overallStatus === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
            </div>
            <div className="mt-3">
              <div className="text-base font-bold capitalize text-zinc-100">
                {report?.overallStatus || 'Checking...'}
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                Audited: {report?.generatedAt ? new Date(report.generatedAt).toLocaleTimeString() : '-'}
              </p>
            </div>
          </div>

          {/* Database Health Card */}
          <div className="p-4 rounded-lg bg-[#14171c] border border-[#22262d] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">SQLite Database Engine</span>
              <Database className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-3">
              <div className="text-xs font-semibold text-zinc-200">
                Integrity: <span className="text-emerald-400 font-mono">{report?.database?.integrityCheck || 'ok'}</span>
              </div>
              <div className="text-[11px] text-zinc-400 mt-1 flex flex-wrap gap-2 font-mono">
                <span>{report?.database?.modCount ?? 0} mods</span>
                <span className="text-zinc-600">•</span>
                <span>{report?.database?.iwadCount ?? 0} IWADs</span>
                <span className="text-zinc-600">•</span>
                <span>{report?.database?.engineCount ?? 0} ports</span>
                <span className="text-zinc-600">•</span>
                <span>{report?.database?.profileCount ?? 0} presets</span>
              </div>
            </div>
          </div>

          {/* Issues Summary Card */}
          <div className="p-4 rounded-lg bg-[#14171c] border border-[#22262d] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">Identified Issues</span>
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div>
                <span className="text-base font-bold font-mono text-red-400">{report?.summary?.errorCount ?? 0}</span>
                <span className="text-[11px] text-zinc-400 block font-medium">Errors</span>
              </div>
              <div className="border-l border-[#22262d] pl-3.5">
                <span className="text-base font-bold font-mono text-amber-400">{report?.summary?.warningCount ?? 0}</span>
                <span className="text-[11px] text-zinc-400 block font-medium">Warnings</span>
              </div>
              <div className="border-l border-[#22262d] pl-3.5">
                <span className="text-base font-bold font-mono text-blue-400">{report?.summary?.infoCount ?? 0}</span>
                <span className="text-[11px] text-zinc-400 block font-medium">Notices</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Selection (Issues vs Logs) */}
        <div className="flex items-center justify-between border-b border-[#22262d] pb-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded transition-colors',
                activeTab === 'all'
                  ? 'bg-[#1c2026] text-white border border-[#2c323d] font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              )}
            >
              All Issues ({report?.summary?.totalIssues ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('errors')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded transition-colors',
                activeTab === 'errors'
                  ? 'bg-red-950/40 text-red-300 border border-red-800/40 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              )}
            >
              Errors ({report?.summary?.errorCount ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('warnings')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded transition-colors',
                activeTab === 'warnings'
                  ? 'bg-amber-950/40 text-amber-300 border border-amber-800/40 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              )}
            >
              Warnings ({report?.summary?.warningCount ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5',
                activeTab === 'logs'
                  ? 'bg-blue-950/40 text-blue-300 border border-blue-800/40 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              )}
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>System Logs ({logs.length})</span>
            </button>
          </div>
        </div>

        {/* Tab Content: Issues or Logs */}
        {activeTab === 'logs' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter logs by message or level..."
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="w-full rounded border border-[#22262d] bg-[#101317] pl-9 pr-8 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none font-mono"
                />
                {logFilter && (
                  <button
                    type="button"
                    onClick={() => setLogFilter('')}
                    className="absolute right-2.5 p-0.5 text-zinc-500 hover:text-zinc-300"
                    title="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleClearLogs}
                className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded hover:bg-white/[0.04] transition-colors"
              >
                Clear Logs
              </button>
            </div>

            <div className="bg-[#101317] border border-[#22262d] rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-[500px] space-y-1.5">
              {filteredLogs.length === 0 ? (
                <div className="text-zinc-500 py-6 text-center">No log messages recorded.</div>
              ) : (
                filteredLogs.map((log, idx) => {
                  let badgeColor = 'text-zinc-400';
                  if (log.level === 'ERROR') badgeColor = 'text-red-400 font-semibold';
                  if (log.level === 'WARN') badgeColor = 'text-amber-400 font-semibold';
                  if (log.level === 'INFO') badgeColor = 'text-blue-400';

                  return (
                    <div key={idx} className="flex items-start gap-3 hover:bg-white/[0.02] p-1 rounded">
                      <span className="text-zinc-500 select-none shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`w-14 uppercase shrink-0 ${badgeColor}`}>[{log.level}]</span>
                      <span className="text-zinc-300 flex-1 break-all">{log.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIssues.length === 0 ? (
              <div className="p-12 text-center rounded-lg bg-[#14171c]/40 border border-[#22262d] flex flex-col items-center justify-center space-y-3">
                <div className="p-3 bg-emerald-950/40 rounded-full border border-emerald-800/40 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-100">All Systems Operational</h3>
                <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
                  No database corruptions, missing game executables, broken IWADs, or orphaned mod references were detected.
                </p>
              </div>
            ) : (
              filteredIssues.map((issue: DiagnosticIssue) => {
                let categoryIcon = <HardDrive className="w-3.5 h-3.5" />;
                if (issue.category === 'engine') categoryIcon = <Cpu className="w-3.5 h-3.5" />;
                if (issue.category === 'profile') categoryIcon = <Layers className="w-3.5 h-3.5" />;
                if (issue.category === 'iwad') categoryIcon = <Disc className="w-3.5 h-3.5" />;
                if (issue.category === 'database') categoryIcon = <Database className="w-3.5 h-3.5" />;

                return (
                  <div
                    key={issue.id}
                    className="p-4 rounded-lg bg-[#14171c] border border-[#22262d] hover:border-zinc-700 transition-colors duration-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-0.5 shrink-0">
                        {issue.severity === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
                        {issue.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                        {issue.severity === 'info' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-zinc-100">{issue.title}</span>
                          <span className="inline-flex items-center gap-1 rounded bg-[#101317] border border-[#22262d] px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 uppercase">
                            {categoryIcon}
                            <span>{issue.category}</span>
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300">{issue.description}</p>
                        {issue.targetPath && (
                          <p className="text-[11px] font-mono text-zinc-500 break-all">{issue.targetPath}</p>
                        )}
                      </div>
                    </div>

                    {issue.canRepair && issue.repairAction && (
                      <div className="shrink-0">
                        <button
                          type="button"
                          disabled={repairingId === issue.id || isLoading}
                          onClick={() => handleRepair(issue)}
                          className="inline-flex items-center gap-1.5 rounded border border-[#22262d] bg-[#181c21] hover:bg-[#202732] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:text-white transition-colors disabled:opacity-40"
                        >
                          <Wrench className={cn('w-3.5 h-3.5', repairingId === issue.id && 'animate-spin')} />
                          <span>{issue.repairDescription || 'Repair'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showPruneConfirm}
        onClose={() => setShowPruneConfirm(false)}
        size="sm"
        title="Prune Missing Resources?"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="ghost" onClick={() => setShowPruneConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmPruneAll}>
              Prune
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[#a1a1aa] leading-relaxed">
          Are you sure you want to prune <span className="text-[#f4f4f5] font-medium">all missing files and broken profile references</span>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};
