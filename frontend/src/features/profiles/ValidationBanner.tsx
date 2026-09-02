import React, { useState } from 'react';
import clsx from 'clsx';
import {
  AlertTriangle,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ValidationResult, ValidationSeverity } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export interface ValidationBannerProps {
  validation: ValidationResult | null;
  isValidating?: boolean;
  onValidate?: () => void;
  className?: string;
}

export const ValidationBanner: React.FC<ValidationBannerProps> = ({
  validation,
  isValidating = false,
  onValidate,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!validation) {
    return (
      <div
        className={clsx(
          'flex items-center justify-between px-4 py-3 bg-[#15181c] border border-white/[0.08] rounded-xl shadow-sm',
          className
        )}
      >
        <div className="flex items-center gap-2.5 text-xs text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-zinc-400" />
          <span>Profile configuration not validated yet</span>
        </div>
        {onValidate && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onValidate}
            disabled={isValidating}
            leftIcon={
              <RefreshCw className={clsx('w-3.5 h-3.5', isValidating && 'animate-spin text-doom-red')} />
            }
          >
            {isValidating ? 'Validating...' : 'Validate Profile'}
          </Button>
        )}
      </div>
    );
  }

  const { status, items = [] } = validation;
  const errorCount = items.filter((i) => i.severity === 'error').length;
  const warningCount = items.filter((i) => i.severity === 'warning').length;

  const statusConfig = {
    READY: {
      border: 'border-emerald-800/30',
      bg: 'bg-[#122419]',
      text: 'text-emerald-300',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      title: 'Profile Ready for Launch',
      description: 'All engine, IWAD, and mod dependencies are satisfied.',
    },
    READY_WITH_WARNINGS: {
      border: 'border-amber-800/30',
      bg: 'bg-[#2b2011]',
      text: 'text-amber-300',
      icon: <ShieldAlert className="w-5 h-5 text-amber-400" />,
      title: `Pre-flight Warnings (${warningCount})`,
      description: 'Profile will launch, but some configuration warnings were detected.',
    },
    CANNOT_LAUNCH: {
      border: 'border-red-800/30',
      bg: 'bg-[#2b1416]',
      text: 'text-red-300',
      icon: <ShieldX className="w-5 h-5 text-red-400" />,
      title: `Cannot Launch: Critical Errors (${errorCount})`,
      description: 'Required files or compatibility requirements are missing.',
    },
  }[status] || {
    border: 'border-white/[0.08]',
    bg: 'bg-white/[0.02]',
    text: 'text-zinc-300',
    icon: <ShieldCheck className="w-5 h-5 text-zinc-400" />,
    title: 'Validation Status',
    description: '',
  };

  const getSeverityIcon = (severity: ValidationSeverity) => {
    switch (severity) {
      case 'error':
        return <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
    }
  };

  return (
    <div
      className={clsx(
        'rounded-xl border overflow-hidden transition-colors',
        statusConfig.border,
        statusConfig.bg,
        className
      )}
    >
      {/* Header Summary */}
      <div className="flex items-center justify-between p-4 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">{statusConfig.icon}</div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className={clsx('text-xs font-bold tracking-tight', statusConfig.text)}>
                {statusConfig.title}
              </span>
              <Badge variant={status === 'READY' ? 'ready' : status === 'READY_WITH_WARNINGS' ? 'warning-status' : 'error-status'} size="xs" mono>
                {status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 tracking-tight truncate">
              {statusConfig.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsExpanded(!isExpanded)}
              rightIcon={
                isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )
              }
              className="text-zinc-400 hover:text-white"
            >
              {isExpanded ? 'Hide Details' : `View Issues (${items.length})`}
            </Button>
          )}

          {onValidate && (
            <Button
              variant="secondary"
              size="xs"
              onClick={onValidate}
              disabled={isValidating}
              leftIcon={
                <RefreshCw
                  className={clsx('w-3 h-3', isValidating && 'animate-spin text-doom-red')}
                />
              }
            >
              {isValidating ? 'Checking...' : 'Recheck'}
            </Button>
          )}
        </div>
      </div>

      {/* Expandable Issues List */}
      <AnimatePresence>
        {isExpanded && items.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
            className="border-t border-white/[0.08] bg-black/30 overflow-hidden"
          >
            <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className={clsx(
                    'flex items-start gap-2.5 p-2.5 rounded-lg border text-xs leading-relaxed',
                    item.severity === 'error' && 'bg-[#2b1416] border-red-800/40 text-red-200',
                    item.severity === 'warning' && 'bg-[#2b2011] border-amber-800/40 text-amber-200',
                    item.severity === 'info' && 'bg-[#132232] border-blue-800/40 text-blue-200'
                  )}
                >
                  <div className="mt-0.5">{getSeverityIcon(item.severity)}</div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold tracking-tight">{item.code}</span>
                      {item.target && (
                        <span className="font-mono text-[10px] text-zinc-400 bg-black/40 px-1.5 py-0.2 rounded border border-white/[0.06]">
                          {item.target}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-300 mt-0.5 tracking-tight">{item.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
