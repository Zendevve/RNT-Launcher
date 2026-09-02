import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCode2,
  HardDrive,
  Layers,
  RefreshCw,
  Trash2,
  Wrench,
  XCircle,
  Terminal,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../../services/api';
import { DiagnosticsReport, DiagnosticIssue, LogEntry } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

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

  const handlePruneAll = async () => {
    setIsLoading(true);
    try {
      await api.repairDiagnosticIssue('prune_all_missing', '');
      onNotify?.('Successfully pruned all missing files and cleaned profiles', 'success');
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0c0e10] text-zinc-100 select-none">
      {/* Streamlined Single Desktop Toolbar */}
      <div className="border-b border-white/[0.07] bg-[#14171a] px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
            {'System Health & Integrity Audit'}
          </span>
          {report?.overallStatus && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase ${
                report.overallStatus === 'healthy'
                  ? 'bg-[#122419] text-[#86efac] border border-emerald-800/40'
                  : report.overallStatus === 'warning'
                  ? 'bg-[#2b2011] text-[#fde047] border border-amber-800/40'
                  : 'bg-[#2b1416] text-[#fca5a5] border border-red-800/40'
              }`}
            >
              {report.overallStatus}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="xs"
            onClick={fetchDiagnostics}
            disabled={isLoading}
            leftIcon={<RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Re-scan
          </Button>
          {(report?.summary?.totalIssues ?? 0) > 0 && (
            <Button
              variant="danger"
              size="xs"
              onClick={handlePruneAll}
              disabled={isLoading}
              leftIcon={<Trash2 className="w-3 h-3" />}
            >
              Prune All Missing
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {/* Health Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Status Card */}
          <div className="p-4.5 rounded-xl bg-[#15181c] border border-white/[0.08] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Overall Status</span>
              {report?.overallStatus === 'healthy' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {report?.overallStatus === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
              {report?.overallStatus === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
            </div>
            <div className="mt-2.5">
              <div className="text-xl font-bold capitalize flex items-center gap-2 text-white">
                {report?.overallStatus || 'Checking...'}
              </div>
              <p className="text-[10.5px] text-zinc-400 mt-1">
                Generated: {report?.generatedAt ? new Date(report.generatedAt).toLocaleTimeString() : '-'}
              </p>
            </div>
          </div>

          {/* Database Health Card */}
          <div className="p-4.5 rounded-xl bg-[#15181c] border border-white/[0.08] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">SQLite Database</span>
              <Database className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-2.5">
              <div className="text-sm font-semibold text-zinc-200">
                Integrity: <span className="text-emerald-400 font-mono">{report?.database?.integrityCheck || 'ok'}</span>
              </div>
              <div className="text-[10.5px] text-zinc-400 mt-1 flex flex-wrap gap-2 font-mono">
                <span>Mods: {report?.database?.modCount ?? 0}</span>
                <span>•</span>
                <span>IWADs: {report?.database?.iwadCount ?? 0}</span>
                <span>•</span>
                <span>Engines: {report?.database?.engineCount ?? 0}</span>
                <span>•</span>
                <span>Profiles: {report?.database?.profileCount ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Issues Summary Card */}
          <div className="p-4.5 rounded-xl bg-[#15181c] border border-white/[0.08] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Identified Issues</span>
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="mt-2.5 flex items-center gap-4">
              <div>
                <span className="text-xl font-bold text-red-400">{report?.summary?.errorCount ?? 0}</span>
                <span className="text-[10.5px] text-zinc-400 block font-medium">Errors</span>
              </div>
              <div className="border-l border-white/[0.08] pl-3.5">
                <span className="text-xl font-bold text-amber-400">{report?.summary?.warningCount ?? 0}</span>
                <span className="text-[10.5px] text-zinc-400 block font-medium">Warnings</span>
              </div>
              <div className="border-l border-white/[0.08] pl-3.5">
                <span className="text-xl font-bold text-blue-400">{report?.summary?.infoCount ?? 0}</span>
                <span className="text-[10.5px] text-zinc-400 block font-medium">Info</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Selection */}
        <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                activeTab === 'all'
                  ? 'bg-white/[0.1] text-white font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              All Issues ({report?.summary?.totalIssues ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('errors')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                activeTab === 'errors'
                  ? 'bg-[#2b1416] text-[#fca5a5] border border-red-800/40 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Errors ({report?.summary?.errorCount ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('warnings')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                activeTab === 'warnings'
                  ? 'bg-[#2b2011] text-[#fde047] border border-amber-800/40 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Warnings ({report?.summary?.warningCount ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${
                activeTab === 'logs'
                  ? 'bg-[#132232] text-[#93c5fd] border border-blue-800/40 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              System Logs ({logs.length})
            </button>
          </div>
        </div>

        {/* Tab Content: Issues or Logs */}
        {activeTab === 'logs' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
                <Input
                  placeholder="Filter logs by message or level..."
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="pl-8 bg-black/40 border-white/[0.08] text-xs py-1.5 font-mono"
                />
              </div>
              <Button variant="ghost" size="xs" onClick={handleClearLogs} className="text-zinc-400 hover:text-white">
                Clear Logs
              </Button>
            </div>

            <div className="bg-[#101214] border border-white/[0.08] rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-[500px] space-y-1.5">
              {filteredLogs.length === 0 ? (
                <div className="text-zinc-500 py-6 text-center">No log messages recorded.</div>
              ) : (
                filteredLogs.map((log, idx) => {
                  let badgeColor = 'text-zinc-400';
                  if (log.level === 'ERROR') badgeColor = 'text-red-400 font-bold';
                  if (log.level === 'WARN') badgeColor = 'text-amber-400 font-semibold';
                  if (log.level === 'INFO') badgeColor = 'text-blue-400';

                  return (
                    <div key={idx} className="flex items-start gap-3 hover:bg-white/[0.04] p-1 rounded-md">
                      <span className="text-zinc-500 select-none">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`w-14 uppercase ${badgeColor}`}>[{log.level}]</span>
                      <span className="text-zinc-300 flex-1">{log.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIssues.length === 0 ? (
              <div className="p-12 text-center rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col items-center justify-center space-y-3">
                <div className="p-3 bg-[#122419] rounded-full border border-emerald-800/40 text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white">All Systems Operational</h3>
                <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
                  No database corruptions, missing game executables, broken IWADs, or orphaned mod references were detected.
                </p>
              </div>
            ) : (
              filteredIssues.map((issue: DiagnosticIssue) => {
                let categoryIcon = <HardDrive className="w-4 h-4" />;
                if (issue.category === 'engine') categoryIcon = <FileCode2 className="w-4 h-4" />;
                if (issue.category === 'profile') categoryIcon = <Layers className="w-4 h-4" />;
                if (issue.category === 'database') categoryIcon = <Database className="w-4 h-4" />;

                return (
                  <motion.div
                    key={issue.id}
                    whileTap={{ scale: 0.995 }}
                    className="p-4 rounded-xl bg-[#15181c] border border-white/[0.08] hover:border-white/[0.18] transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {issue.severity === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
                        {issue.severity === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                        {issue.severity === 'info' && <CheckCircle2 className="w-5 h-5 text-blue-400" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white tracking-tight">{issue.title}</span>
                          <Badge variant="secondary" className="capitalize text-[10px] flex items-center gap-1">
                            {categoryIcon}
                            {issue.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-300">{issue.description}</p>
                        {issue.targetPath && (
                          <p className="text-[11px] font-mono text-zinc-400 break-all">{issue.targetPath}</p>
                        )}
                      </div>
                    </div>

                    {issue.canRepair && issue.repairAction && (
                      <div className="flex-shrink-0">
                        <Button
                          variant="secondary"
                          size="xs"
                          disabled={repairingId === issue.id || isLoading}
                          onClick={() => handleRepair(issue)}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <Wrench className={`w-3.5 h-3.5 ${repairingId === issue.id ? 'animate-spin' : ''}`} />
                          {issue.repairDescription || 'Repair'}
                        </Button>
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
