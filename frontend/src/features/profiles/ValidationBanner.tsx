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
          'flex items-center justify-between p-3 rounded-lg border border-doom-border bg-doom-card/50 text-doom-muted text-xs',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-doom-muted" />
          <span>Profile not yet validated.</span>
        </div>
        {onValidate && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onValidate}
            isLoading={isValidating}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Validate Now
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
      border: 'border-emerald-700/60 bg-emerald-950/30 text-emerald-300',
      badgeVariant: 'READY' as const,
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />,
      title: 'Ready for Launch',
      summary: 'All required game engine, IWAD, and mod files verified.',
    },
    READY_WITH_WARNINGS: {
      border: 'border-amber-700/60 bg-amber-950/30 text-amber-300',
      badgeVariant: 'READY_WITH_WARNINGS' as const,
      icon: <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />,
      title: `Launchable with Warnings (${warningCount})`,
      summary: `${warningCount} warning(s) detected. Profile will launch, but some options or mods may be skipped.`,
    },
    CANNOT_LAUNCH: {
      border: 'border-red-700/60 bg-red-950/40 text-red-300',
      badgeVariant: 'CANNOT_LAUNCH' as const,
      icon: <ShieldX className="w-5 h-5 text-red-400 shrink-0" />,
      title: `Cannot Launch (${errorCount} Error${errorCount > 1 ? 's' : ''})`,
      summary: 'Required configuration missing or invalid. Fix the issues below before playing.',
    },
  }[status] || {
    border: 'border-doom-border bg-doom-card/50 text-doom-text',
    badgeVariant: 'default' as const,
    icon: <Info className="w-5 h-5 text-doom-muted shrink-0" />,
    title: 'Unknown Validation State',
    summary: 'Status could not be evaluated.',
  };

  const getSeverityIcon = (severity: ValidationSeverity) => {
    switch (severity) {
      case 'error':
        return <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div
      className={clsx(
        'rounded-lg border shadow-md overflow-hidden transition-all duration-200',
        statusConfig.border,
        className
      )}
    >
      {/* Banner Top Row */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {statusConfig.icon}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold tracking-wide uppercase">
                {statusConfig.title}
              </h4>
              <Badge variant={statusConfig.badgeVariant} size="xs">
                {status}
              </Badge>
            </div>
            <p className="text-xs opacity-85 truncate mt-0.5">{statusConfig.summary}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onValidate && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onValidate}
              isLoading={isValidating}
              leftIcon={<RefreshCw className={clsx('w-3.5 h-3.5', isValidating && 'animate-spin')} />}
              className="text-doom-muted hover:text-doom-text"
              title="Re-run pre-launch validation"
            >
              <span className="hidden sm:inline">Re-validate</span>
            </Button>
          )}

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
              className="text-xs font-semibold px-2 py-1 bg-black/20 hover:bg-black/40 text-inherit border border-current/20"
            >
              {isExpanded ? 'Hide Details' : `Issues (${items.length})`}
            </Button>
          )}
        </div>
      </div>

      {/* Expandable Issue Details */}
      {isExpanded && items.length > 0 && (
        <div className="border-t border-current/20 bg-black/40 px-4 py-3 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-150">
          <div className="text-[11px] uppercase tracking-wider font-mono text-doom-muted font-bold mb-1">
            Validation Findings ({items.length})
          </div>

          <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
            {items.map((item, idx) => (
              <div
                key={`${item.code}-${idx}`}
                className="flex items-start gap-2.5 p-2 rounded bg-doom-surface/80 border border-doom-border/60 text-xs text-doom-text shadow-sm"
              >
                {getSeverityIcon(item.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.target && (
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-doom-card text-doom-text border border-doom-border">
                        {item.target}
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-doom-muted">{item.code}</span>
                    <Badge variant={item.severity} size="xs">
                      {item.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-doom-text opacity-95">{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
