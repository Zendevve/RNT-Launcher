import React from 'react';
import { cn } from '../../utils/cn';

export type ProgressVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'cyan';
export type ProgressSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: ProgressVariant;
  size?: ProgressSize;
  striped?: boolean;
  animated?: boolean;
  indeterminate?: boolean;
  showLabel?: boolean;
  label?: string;
  statusText?: string;
}

const heightStyles: Record<ProgressSize, string> = {
  xs: 'h-1',
  sm: 'h-2',
  md: 'h-3.5',
  lg: 'h-5',
};

const barColors: Record<ProgressVariant, string> = {
  default: 'bg-doom-red shadow-[0_0_8px_rgba(220,38,38,0.5)]',
  primary: 'bg-gradient-to-r from-doom-red-dark to-doom-red-bright shadow-[0_0_8px_rgba(239,68,68,0.5)]',
  success: 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
  warning: 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  danger: 'bg-gradient-to-r from-red-800 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
  cyan: 'bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value = 0,
  max = 100,
  variant = 'primary',
  size = 'sm',
  striped = false,
  animated = false,
  indeterminate = false,
  showLabel = false,
  label,
  statusText,
  className,
  ...props
}) => {
  const safeMax = max <= 0 ? 100 : max;
  const percentage = indeterminate ? 100 : Math.min(100, Math.max(0, (value / safeMax) * 100));
  const roundedPercentage = Math.round(percentage);

  return (
    <div className={cn('w-full flex flex-col gap-1 select-none', className)} {...props}>
      {(showLabel || label || statusText) && (
        <div className="flex items-center justify-between text-xs text-doom-muted font-medium">
          <div className="flex items-center gap-2 truncate">
            {label && <span className="text-doom-text font-semibold truncate">{label}</span>}
            {statusText && <span className="truncate text-doom-muted/80">{statusText}</span>}
          </div>
          {showLabel && !indeterminate && (
            <span className="font-mono text-[11px] text-doom-text/90 ml-2">
              {roundedPercentage}%
            </span>
          )}
        </div>
      )}

      {/* Progress Track */}
      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        className={cn(
          'w-full bg-doom-card/80 border border-doom-border/80 rounded overflow-hidden relative',
          heightStyles[size]
        )}
      >
        {/* Progress Fill */}
        <div
          style={{ width: indeterminate ? '100%' : `${percentage}%` }}
          className={cn(
            'h-full transition-all duration-200 relative',
            barColors[variant],
            (striped || animated) &&
              'bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:16px_16px]',
            animated && 'animate-[move-stripes_1s_linear_infinite]',
            indeterminate && 'animate-pulse'
          )}
        />
      </div>
    </div>
  );
};
