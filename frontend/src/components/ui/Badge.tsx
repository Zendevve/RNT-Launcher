import React from 'react';
import { cn } from '../../utils/cn';
import type { ValidationSeverity, ValidationStatus, ModFormat, ModCategory } from '../../types';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline'
  | 'muted'
  | 'red'
  | 'amber'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'ready'
  | 'warning-status'
  | 'error-status'
  | 'info-status'
  | 'wad'
  | 'pk3'
  | 'ipk3'
  | 'zip'
  | 'pk7'
  | '7z'
  | 'deh'
  | 'bex'
  | 'gzdoom'
  | 'zandronum'
  | 'prboom'
  | 'dsda'
  | 'crispy'
  | 'chocolate'
  | 'eternity'
  | ValidationSeverity
  | ValidationStatus
  | ModFormat
  | ModCategory
  | string;

export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  mono?: boolean;
  dot?: boolean;
  dotPulse?: boolean;
  icon?: React.ReactNode;
}

const getVariantClasses = (variant: BadgeVariant): string => {
  switch (variant) {
    // Statuses & Severities
    case 'READY':
    case 'ready':
    case 'green':
    case 'success':
      return 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60 shadow-emerald-950/30';
    case 'READY_WITH_WARNINGS':
    case 'warning':
    case 'warning-status':
    case 'amber':
      return 'bg-amber-950/70 text-amber-300 border-amber-700/60 shadow-amber-950/30';
    case 'CANNOT_LAUNCH':
    case 'error':
    case 'error-status':
    case 'danger':
    case 'red':
      return 'bg-red-950/70 text-red-300 border-red-700/60 shadow-red-950/30';
    case 'primary':
      return 'bg-doom-red/20 text-red-300 border-doom-red/50 shadow-sm shadow-red-950/40';
    case 'INFO':
    case 'info':
    case 'info-status':
    case 'cyan':
      return 'bg-cyan-950/70 text-cyan-300 border-cyan-700/60 shadow-cyan-950/30';
    case 'blue':
      return 'bg-blue-950/70 text-blue-300 border-blue-700/60 shadow-blue-950/30';

    // Formats
    case 'wad':
    case 'iwad':
    case 'pwad':
      return 'bg-amber-950/70 text-amber-300 border-amber-600/60 font-semibold';
    case 'pk3':
    case 'ipk3':
      return 'bg-cyan-950/70 text-cyan-300 border-cyan-600/60 font-semibold';
    case 'zip':
      return 'bg-blue-950/70 text-blue-300 border-blue-600/60 font-semibold';
    case 'pk7':
    case '7z':
      return 'bg-purple-950/70 text-purple-300 border-purple-600/60 font-semibold';
    case 'deh':
    case 'bex':
      return 'bg-orange-950/70 text-orange-300 border-orange-600/60 font-semibold';

    // Engine families
    case 'gzdoom':
      return 'bg-purple-950/60 text-purple-300 border-purple-700/60';
    case 'zandronum':
      return 'bg-orange-950/60 text-orange-300 border-orange-700/60';
    case 'prboom':
      return 'bg-green-950/60 text-green-300 border-green-700/60';
    case 'dsda':
      return 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60';
    case 'crispy':
      return 'bg-yellow-950/60 text-yellow-300 border-yellow-700/60';
    case 'chocolate':
      return 'bg-amber-950/60 text-amber-300 border-amber-700/60';
    case 'eternity':
      return 'bg-cyan-950/60 text-cyan-300 border-cyan-700/60';

    // Categories
    case 'gameplay':
      return 'bg-rose-950/70 text-rose-300 border-rose-700/50';
    case 'maps':
      return 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50';
    case 'weapons':
      return 'bg-amber-950/70 text-amber-300 border-amber-700/50';
    case 'monsters':
      return 'bg-red-950/70 text-red-300 border-red-700/50';
    case 'textures':
      return 'bg-teal-950/70 text-teal-300 border-teal-700/50';
    case 'sound':
      return 'bg-blue-950/70 text-blue-300 border-blue-700/50';
    case 'total-conversion':
      return 'bg-fuchsia-950/70 text-fuchsia-300 border-fuchsia-700/50';

    case 'secondary':
      return 'bg-doom-surface text-doom-muted border-doom-border';
    case 'outline':
      return 'bg-transparent text-doom-text border-doom-border hover:border-doom-border-bright';
    case 'muted':
      return 'bg-zinc-800/80 text-zinc-400 border-zinc-700/40';
    default:
      return 'bg-doom-card text-doom-text border-doom-border';
  }
};

const getDotColor = (variant: BadgeVariant): string => {
  switch (variant) {
    case 'READY':
    case 'ready':
    case 'green':
    case 'success':
    case 'dsda':
    case 'maps':
      return 'bg-emerald-400';
    case 'READY_WITH_WARNINGS':
    case 'warning':
    case 'warning-status':
    case 'amber':
    case 'weapons':
    case 'chocolate':
      return 'bg-amber-400';
    case 'CANNOT_LAUNCH':
    case 'error':
    case 'error-status':
    case 'danger':
    case 'red':
    case 'primary':
    case 'monsters':
      return 'bg-doom-red-bright';
    case 'INFO':
    case 'info':
    case 'info-status':
    case 'cyan':
    case 'pk3':
    case 'eternity':
      return 'bg-cyan-400';
    case 'wad':
      return 'bg-amber-400';
    case 'zip':
    case 'blue':
      return 'bg-blue-400';
    case 'pk7':
    case 'gzdoom':
      return 'bg-purple-400';
    default:
      return 'bg-doom-muted';
  }
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: 'text-[10px] px-1.5 py-0.5 gap-1',
  sm: 'text-xs px-2 py-0.5 gap-1.5',
  md: 'text-sm px-2.5 py-1 gap-2',
};

export function getBadgeVariantForFormat(format: string): BadgeVariant {
  const normalized = format.toLowerCase().replace(/^\./, '');
  if (['wad', 'iwad', 'pwad'].includes(normalized)) return 'wad';
  if (['pk3', 'ipk3'].includes(normalized)) return 'pk3';
  if (['zip'].includes(normalized)) return 'zip';
  if (['pk7', '7z'].includes(normalized)) return 'pk7';
  if (['deh'].includes(normalized)) return 'deh';
  if (['bex'].includes(normalized)) return 'bex';
  return 'default';
}

export function getBadgeVariantForStatus(status: string): BadgeVariant {
  const normalized = status.toUpperCase();
  if (normalized === 'READY') return 'ready';
  if (normalized === 'READY_WITH_WARNINGS' || normalized === 'WARNING') return 'warning-status';
  if (normalized === 'CANNOT_LAUNCH' || normalized === 'ERROR') return 'error-status';
  if (normalized === 'INFO') return 'info-status';
  return 'default';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'sm',
  mono = false,
  dot = false,
  dotPulse = false,
  icon,
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-medium border rounded select-none uppercase tracking-wide',
        mono && 'font-mono text-[11px] tracking-tight',
        getVariantClasses(variant),
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 items-center justify-center">
          {dotPulse && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                getDotColor(variant)
              )}
            />
          )}
          <span
            className={cn('relative inline-flex rounded-full h-1.5 w-1.5', getDotColor(variant))}
          />
        </span>
      )}
      {icon && <span className="inline-flex items-center flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
};
