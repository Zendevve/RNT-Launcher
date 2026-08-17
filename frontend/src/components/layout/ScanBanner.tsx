import React from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, X, StopCircle } from 'lucide-react';
import { ProgressBar } from '../ui/ProgressBar';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export interface ScanBannerProps {
  isScanning: boolean;
  current?: number;
  total?: number;
  currentFile?: string;
  lastResult?: {
    discoveredMods?: number;
    discoveredIWADs?: number;
    discoveredEngines?: number;
    errors?: string[];
  } | null;
  onCancel?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const ScanBanner: React.FC<ScanBannerProps> = ({
  isScanning,
  current = 0,
  total = 0,
  currentFile,
  lastResult,
  onCancel,
  onDismiss,
  className,
}) => {
  // If not scanning and no result to show, hide banner
  if (!isScanning && !lastResult) {
    return null;
  }

  const isComplete = !isScanning && Boolean(lastResult);
  const hasErrors = (lastResult?.errors?.length ?? 0) > 0;

  return (
    <div
      className={cn(
        'w-full border-b transition-all duration-200 select-none z-10',
        isScanning
          ? 'bg-doom-surface/95 border-doom-border-bright shadow-lg shadow-black/40'
          : hasErrors
          ? 'bg-red-950/40 border-red-800/80 text-red-200'
          : 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200',
        className
      )}
    >
      <div className="px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Icon & Progress description */}
        <div className="flex items-center gap-3 min-w-0 flex-1 w-full md:w-auto">
          <div className="flex-shrink-0">
            {isScanning ? (
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
            ) : hasErrors ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-doom-text uppercase tracking-wider">
                {isScanning
                  ? 'DIRECTORY SCAN IN PROGRESS'
                  : hasErrors
                  ? 'SCAN COMPLETED WITH WARNINGS'
                  : 'SCAN COMPLETED'}
              </span>

              {isScanning && total > 0 && (
                <span className="font-mono text-[11px] text-cyan-400">
                  {current} / {total} files ({Math.round((current / total) * 100)}%)
                </span>
              )}
            </div>

            {/* Current file / result summary */}
            <div className="text-[11px] text-doom-muted truncate font-mono mt-0.5">
              {isScanning ? (
                currentFile ? (
                  <span>
                    Processing: <span className="text-doom-text">{currentFile}</span>
                  </span>
                ) : (
                  'Analyzing files...'
                )
              ) : (
                <span>
                  Discovered{' '}
                  <span className="text-emerald-300 font-semibold">
                    {lastResult?.discoveredMods ?? 0} mods
                  </span>
                  ,{' '}
                  <span className="text-cyan-300 font-semibold">
                    {lastResult?.discoveredIWADs ?? 0} IWADs
                  </span>
                  ,{' '}
                  <span className="text-purple-300 font-semibold">
                    {lastResult?.discoveredEngines ?? 0} engines
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Live ProgressBar during scan */}
        {isScanning && (
          <div className="w-full md:w-64 flex-shrink-0">
            <ProgressBar
              value={current}
              max={total > 0 ? total : 100}
              indeterminate={total === 0}
              variant="cyan"
              size="xs"
              animated
            />
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-auto">
          {isScanning && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              leftIcon={<StopCircle className="w-3.5 h-3.5 text-doom-red" />}
              className="text-xs text-doom-red hover:bg-doom-red/10"
            >
              Cancel
            </Button>
          )}

          {isComplete && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss scan results"
              className="text-doom-muted hover:text-doom-text p-1 rounded hover:bg-doom-card transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
