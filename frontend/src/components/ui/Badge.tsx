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
      return 'bg-[#122419] text-[#86efac] border border-emerald-800/30';
    case 'READY_WITH_WARNINGS':
    case 'warning':
    case 'warning-status':
    case 'amber':
      return 'bg-[#2b2011] text-[#fde047] border border-amber-800/30';
    case 'CANNOT_LAUNCH':
    case 'error':
    case 'error-status':
    case 'danger':
    case 'red':
      return 'bg-[#2b1416] text-[#fca5a5] border border-red-800/30';
    case 'primary':
      return 'bg-[#2b1416] text-[#fca5a5] border border-red-700/40';
    case 'INFO':
    case 'info':
    case 'info-status':
    case 'cyan':
    case 'blue':
      return 'bg-[#132232] text-[#93c5fd] border border-blue-800/30';

    // Formats
    case 'wad':
    case 'iwad':
    case 'pwad':
      return 'bg-[#132232] text-[#93c5fd] border border-blue-800/30 font-semibold';
    case 'pk3':
    case 'ipk3':
      return 'bg-[#231830] text-[#d8b4fe] border border-purple-800/30 font-semibold';
    case 'zip':
      return 'bg-[#132232] text-[#93c5fd] border border-blue-800/30 font-semibold';
    case 'pk7':
    case '7z':
      return 'bg-[#122419] text-[#86efac] border border-emerald-800/30 font-semibold';
    case 'deh':
    case 'bex':
      return 'bg-[#2b1416] text-[#fca5a5] border border-red-800/30 font-semibold';

    // Engine families
    case 'gzdoom':
      return 'bg-[#231830] text-[#d8b4fe] border border-purple-800/30';
    case 'zandronum':
      return 'bg-[#132232] text-[#93c5fd] border border-blue-800/30';
    case 'prboom':
    case 'dsda':
      return 'bg-[#122419] text-[#86efac] border border-emerald-800/30';
    case 'crispy':
    case 'chocolate':
      return 'bg-[#2b2011] text-[#fde047] border border-amber-800/30';
    case 'eternity':
      return 'bg-[#132232] text-[#93c5fd] border border-blue-800/30';

    // Categories
    case 'gameplay':
      return 'bg-[#231830] text-[#d8b4fe] border border-purple-800/30';
    case 'maps':
      return 'bg-[#122419] text-[#86efac] border border-emerald-800/30';
    case 'weapons':
      return 'bg-[#2b2011] text-[#fde047] border border-amber-800/30';
    case 'monsters':
      return 'bg-[#2b1416] text-[#fca5a5] border border-red-800/30';
    case 'textures':
    case 'sound':
      return 'bg-[#132232] text-[#93c5fd] border border-blue-800/30';
    case 'total-conversion':
      return 'bg-[#231830] text-[#d8b4fe] border border-purple-800/30';

    case 'secondary':
      return 'bg-white/[0.04] text-zinc-400 border border-white/[0.08]';
    case 'outline':
      return 'bg-transparent text-zinc-300 border border-white/[0.08] hover:border-white/[0.16]';
    case 'muted':
      return 'bg-white/[0.03] text-zinc-500 border border-white/[0.06]';
    default:
      return 'bg-white/[0.04] text-zinc-300 border border-white/[0.08]';
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
    case 'crispy':
    case 'chocolate':
    case 'wad':
    case 'iwad':
    case 'pwad':
      return 'bg-amber-400';
    case 'CANNOT_LAUNCH':
    case 'error':
    case 'error-status':
    case 'danger':
    case 'red':
    case 'primary':
    case 'monsters':
    case 'deh':
    case 'bex':
      return 'bg-red-400';
    case 'INFO':
    case 'info':
    case 'info-status':
    case 'cyan':
    case 'blue':
    case 'pk3':
    case 'ipk3':
    case 'zip':
    case 'eternity':
    case 'sound':
    case 'textures':
      return 'bg-cyan-400';
    case 'gzdoom':
    case 'pk7':
    case '7z':
    case 'gameplay':
    case 'total-conversion':
      return 'bg-purple-400';
    default:
      return 'bg-zinc-400';
  }
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: 'text-[10px] px-2 py-0.5 tracking-wider',
  sm: 'text-[11px] px-2.5 py-0.5 tracking-wider',
  md: 'text-xs px-3 py-1 tracking-wider',
};

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
  const variantClass = getVariantClasses(variant);
  const dotColor = getDotColor(variant);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors select-none',
        mono && 'font-mono uppercase',
        sizeStyles[size],
        variantClass,
        className
      )}
      {...props}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {dotPulse && (
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                dotColor
              )}
            />
          )}
          <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', dotColor)} />
        </span>
      )}
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
    </span>
  );
};
