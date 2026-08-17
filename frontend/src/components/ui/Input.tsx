import React, { forwardRef } from 'react';
import clsx from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className, disabled, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-doom-muted uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-doom-muted">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={clsx(
              'w-full bg-doom-surface border rounded text-sm text-doom-text placeholder-zinc-500 py-2 transition-all duration-150',
              'focus:outline-none focus:ring-1 focus:ring-doom-red focus:border-doom-red',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftIcon ? 'pl-9' : 'pl-3',
              rightIcon ? 'pr-9' : 'pr-3',
              error ? 'border-red-500 focus:ring-red-500' : 'border-doom-border hover:border-doom-border-bright',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center text-doom-muted">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <span className="text-xs text-red-400 font-medium">{error}</span>}
        {!error && helperText && <span className="text-xs text-doom-muted">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
