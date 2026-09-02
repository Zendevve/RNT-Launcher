import React from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { motion, HTMLMotionProps } from 'motion/react';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: React.ReactNode;
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
    'relative inline-flex items-center justify-center font-medium rounded-md transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-doom-red disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none';

  const variantClasses = {
    primary:
      'bg-[#dc2626] hover:bg-[#c02020] text-white font-semibold border border-red-500/30',
    secondary:
      'bg-[#181a1e] hover:bg-[#22252a] text-zinc-200 border border-white/[0.08]',
    danger:
      'bg-[#2d1416] hover:bg-[#3d1a1d] text-[#fca5a5] border border-red-800/30',
    ghost:
      'bg-transparent hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-100 border border-transparent',
    outline:
      'bg-transparent hover:bg-white/[0.04] text-zinc-200 border border-white/[0.1] hover:border-white/[0.2]',
    success:
      'bg-[#122419] hover:bg-[#1b3524] text-[#86efac] border border-emerald-800/30',
  }[variant];

  const sizeClasses = {
    xs: 'text-xs px-2 py-1 gap-1 tracking-tight',
    sm: 'text-xs px-2.5 py-1.5 gap-1.5 font-medium tracking-tight',
    md: 'text-sm px-3.5 py-2 gap-2 font-medium tracking-[-0.01em]',
    lg: 'text-base px-5 py-2.5 gap-2.5 font-semibold tracking-[-0.015em]',
    icon: 'p-1.5 aspect-square',
  }[size];

  return (
    <motion.button
      whileTap={disabled || isLoading ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
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
    </motion.button>
  );
};
