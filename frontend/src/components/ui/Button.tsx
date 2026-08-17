import React from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-doom-red disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-red-700 to-doom-red hover:from-red-600 hover:to-red-500 text-white font-semibold shadow-lg shadow-red-950/40 border border-red-500/40 hover:border-red-400',
    secondary:
      'bg-doom-card hover:bg-zinc-800 text-doom-text border border-doom-border hover:border-doom-border-bright shadow-sm',
    danger:
      'bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-700/60 hover:border-red-500 shadow-sm',
    ghost:
      'bg-transparent hover:bg-zinc-800/60 text-doom-muted hover:text-doom-text border border-transparent',
    outline:
      'bg-transparent hover:bg-zinc-800/40 text-doom-text border border-doom-border hover:border-doom-border-bright',
    success:
      'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 hover:border-emerald-500 shadow-sm',
  }[variant];

  const sizeClasses = {
    xs: 'text-xs px-2 py-1 gap-1',
    sm: 'text-xs px-2.5 py-1.5 gap-1.5 font-medium',
    md: 'text-sm px-3.5 py-2 gap-2 font-medium',
    lg: 'text-base px-5 py-2.5 gap-2.5 font-semibold tracking-wide',
    icon: 'p-1.5 aspect-square',
  }[size];

  return (
    <button
      className={clsx(baseClasses, variantClasses, sizeClasses, className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
