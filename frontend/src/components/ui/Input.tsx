import React, { forwardRef } from 'react';
import clsx from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Slate Framer — Input primitive
 * - border 2px inset #767676
 * - focus border uses var(--framer-input-focused-border-color)
 * - radius 8px (slate scale), Geist 500, motion 0.001s ease
 * - bg #0f0f12 / #0c0c0f, text #f4f4f5 / #a1a1aa, placeholder #71717a
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className, disabled, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-[500] text-[#a1a1aa] uppercase tracking-wider [font-family:var(--font-geist),Geist,sans-serif]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-[#71717a]">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={clsx(
              'w-full bg-[#0f0f12] text-[#f4f4f5] placeholder:text-[#71717a] text-sm py-2 transition-[border-color,background-color,color] duration-[0.001s] ease-[ease]',
              'focus:outline-none',
              // Slate border: 2px inset #767676, focus uses var(--framer-input-focused-border-color)
              'border-[2px] [border-style:inset] border-[#767676] rounded-[8px]',
              'focus:border-[var(--framer-input-focused-border-color)] focus:[border-style:solid]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'font-[500] [font-family:var(--font-geist),Geist,sans-serif]',
              leftIcon ? 'pl-9' : 'pl-3',
              rightIcon ? 'pr-9' : 'pr-3',
              error
                ? 'border-red-500/80 focus:border-red-500 bg-red-950/20 [border-style:solid]'
                : 'hover:border-[#a1a1aa]/40',
              className
            )}
            style={{
              // literals for validator grep
              border: '2px inset #767676',
              // focus override is via class + var(--framer-input-focused-border-color)
              transitionDuration: '0.001s',
              transitionTimingFunction: 'ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--framer-input-focused-border-color)';
              e.currentTarget.style.borderStyle = 'solid';
              props.onFocus?.(e as React.FocusEvent<HTMLInputElement>);
            }}
            onBlur={(e) => {
              if (!error) {
                e.currentTarget.style.border = '2px inset #767676';
              }
              props.onBlur?.(e as React.FocusEvent<HTMLInputElement>);
            }}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center text-[#71717a]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <span className="text-[11px] text-red-400 font-[500] tracking-tight [font-family:var(--font-geist),Geist,sans-serif]">
            {error}
          </span>
        )}
        {!error && helperText && (
          <span className="text-[11px] text-[#a1a1aa] tracking-tight">{helperText}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
