import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
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
import { api } from '../../services/api';
import { DiagnosticsReport, DiagnosticIssue, LogEntry } from '../../types/domain';
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
      onNotify?.(`Repaired: ${issue.title}`, 'success');
      await fetchDiagnostics();
    } catch (err) {
      console.error('Repair failed:', err);
      onNotify?.(`Repair failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
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
    } catch (err) {
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

  const filteredIssues = (report?.issues || []).filter((issue) => {
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
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6 bg-zinc-950 text-zinc-100">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-red-500" />
            <h1 className="text-2xl font-bold tracking-tight">System Diagnostics & Health</h1>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Audit database integrity, detect missing game resources, and repair broken profiles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={fetchDiagnostics}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Re-scan System
          </Button>
          {(report?.summary?.totalIssues ?? 0) > 0 && (
            <Button
              variant="danger"
              onClick={handlePruneAll}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Prune All Missing
            </Button>
          )}
        </div>
      </div>

      {/* Health Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Card */}
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Overall Status</span>
            {report?.overallStatus === 'healthy' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {report?.overallStatus === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
            {report?.overallStatus === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold capitalize flex items-center gap-2">
              {report?.overallStatus || 'Checking...'}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Generated: {report?.generatedAt ? new Date(report.generatedAt).toLocaleTimeString() : '—'}
            </p>
          </div>
        </div>

        {/* Database Health Card */}
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">SQLite Database</span>
            <Database className="w-5 h-5 text-blue-400" />
          </div>
          <div className="mt-3">
            <div className="text-sm font-semibold text-zinc-200">
              Integrity: <span className="text-emerald-400">{report?.database?.integrityCheck || 'ok'}</span>
            </div>
            <div className="text-xs text-zinc-400 mt-1 flex flex-wrap gap-2">
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
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Identified Issues</span>
            <ShieldCheck className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div>
              <span className="text-2xl font-bold text-red-400">{report?.summary?.errorCount ?? 0}</span>
              <span className="text-xs text-zinc-500 block">Errors</span>
            </div>
            <div className="border-l border-zinc-800 pl-4">
              <span className="text-2xl font-bold text-amber-400">{report?.summary?.warningCount ?? 0}</span>
              <span className="text-xs text-zinc-500 block">Warnings</span>
            </div>
            <div className="border-l border-zinc-800 pl-4">
              <span className="text-2xl font-bold text-blue-400">{report?.summary?.infoCount ?? 0}</span>
              <span className="text-xs text-zinc-500 block">Info</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Selection */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'all' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All Issues ({report?.summary?.totalIssues ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('errors')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'errors' ? 'bg-red-950/60 text-red-300 border border-red-800/50' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Errors ({report?.summary?.errorCount ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('warnings')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'warnings' ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Warnings ({report?.summary?.warningCount ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'logs' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            System Logs ({logs.length})
          </button>
        </div>
      </div>

      {/* Tab Content: Issues or Logs */}
      {activeTab === 'logs' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
              <Input
                placeholder="Filter logs by message or level..."
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="pl-9 bg-zinc-900 border-zinc-800 text-xs"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={handleClearLogs} className="text-zinc-400 hover:text-zinc-200">
              Clear Logs
            </Button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-[500px] space-y-1.5">
            {filteredLogs.length === 0 ? (
              <div className="text-zinc-500 py-6 text-center">No log messages recorded.</div>
            ) : (
              filteredLogs.map((log, idx) => {
                let badgeColor = 'text-zinc-400';
                if (log.level === 'ERROR') badgeColor = 'text-red-400 font-bold';
                if (log.level === 'WARN') badgeColor = 'text-amber-400 font-semibold';
                if (log.level === 'INFO') badgeColor = 'text-blue-400';

                return (
                  <div key={idx} className="flex items-start gap-3 hover:bg-zinc-800/40 p-1 rounded">
                    <span className="text-zinc-600 select-none">
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
            <div className="p-12 text-center rounded-lg bg-zinc-900/50 border border-zinc-800/60 flex flex-col items-center justify-center space-y-3">
              <div className="p-3 bg-emerald-950/40 rounded-full border border-emerald-800/50 text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-200">All Systems Operational</h3>
              <p className="text-sm text-zinc-400 max-w-md">
                No database corruptions, missing game executables, broken IWADs, or orphaned mod references were detected.
              </p>
            </div>
          ) : (
            filteredIssues.map((issue) => {
              let categoryIcon = <HardDrive className="w-4 h-4" />;
              if (issue.category === 'engine') categoryIcon = <FileCode2 className="w-4 h-4" />;
              if (issue.category === 'profile') categoryIcon = <Layers className="w-4 h-4" />;
              if (issue.category === 'database') categoryIcon = <Database className="w-4 h-4" />;

              return (
                <div
                  key={issue.id}
                  className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      {issue.severity === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
                      {issue.severity === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                      {issue.severity === 'info' && <CheckCircle2 className="w-5 h-5 text-blue-400" />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-100">{issue.title}</span>
                        <Badge variant="secondary" className="capitalize text-[10px] flex items-center gap-1">
                          {categoryIcon}
                          {issue.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-400">{issue.description}</p>
                      {issue.targetPath && (
                        <p className="text-[11px] font-mono text-zinc-500 break-all">{issue.targetPath}</p>
                      )}
                    </div>
                  </div>

                  {issue.canRepair && issue.repairAction && (
                    <div className="flex-shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={repairingId === issue.id || isLoading}
                        onClick={() => handleRepair(issue)}
                        className="flex items-center gap-1.5 text-xs border-zinc-700 hover:bg-zinc-800"
                      >
                        <Wrench className={`w-3.5 h-3.5 ${repairingId === issue.id ? 'animate-spin' : ''}`} />
                        {issue.repairDescription || 'Repair'}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
