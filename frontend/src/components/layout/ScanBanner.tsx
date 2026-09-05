import React from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, X, StopCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const isVisible = isScanning || Boolean(lastResult);
  const isComplete = !isScanning && Boolean(lastResult);
  const hasErrors = (lastResult?.errors?.length ?? 0) > 0;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } }}
          exit={{ height: 0, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }}
          className={cn(
            'w-full border-b overflow-hidden select-none z-10',
            isScanning
              ? 'bg-[#14171a] border-b-white/[0.08]'
              : hasErrors
              ? 'bg-[#2b1416] border-b-red-800/40 text-red-200'
              : 'bg-[#122419] border-b-emerald-800/40 text-emerald-200',
            className
          )}
        >
          <div className="px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
            {isScanning ? (
              <>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <RefreshCw className="w-4 h-4 text-doom-red-bright animate-spin shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white tracking-tight">
                        Scanning Directory Tree...
                      </span>
                      {total > 0 && (
                        <span className="text-[11px] font-mono text-zinc-400">
                          ({current}/{total})
                        </span>
                      )}
                    </div>
                    {currentFile && (
                      <p className="text-[11px] font-mono text-zinc-400 truncate tracking-tight">
                        {currentFile}
                      </p>
                    )}
                  </div>
                </div>

                <div className="w-full md:w-48 flex items-center gap-2">
                  <ProgressBar
                    value={total > 0 ? (current / total) * 100 : 0}
                    variant="primary"
                    size="sm"
                    className="flex-1"
                  />
                  {onCancel && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={onCancel}
                      leftIcon={<StopCircle className="w-3.5 h-3.5 text-red-400" />}
                      className="text-red-400 hover:bg-red-950/40"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </>
            ) : isComplete ? (
              <>
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {hasErrors ? (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-semibold text-white">Scan Complete:</span>
                    <span className="text-zinc-300">
                      Discovered {lastResult?.discoveredMods ?? 0} Mods,{' '}
                      {lastResult?.discoveredIWADs ?? 0} IWADs,{' '}
                      {lastResult?.discoveredEngines ?? 0} Engines.
                    </span>
                    {hasErrors && (
                      <span className="text-red-300 font-medium">
                        ({lastResult?.errors?.length} issues detected)
                      </span>
                    )}
                  </div>
                </div>

                {onDismiss && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={onDismiss}
                    aria-label="Dismiss scan results"
                    className="text-zinc-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
