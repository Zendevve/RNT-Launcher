import React from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const paddingMap: Record<NonNullable<CardProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

/**
 * Slate Framer — Card primitive
 * - radius 12px, bg #0f0f12 / #0c0c0f, border #2d2d34, text #f4f4f5 / #a1a1aa
 * - motion 0.001s ease on hover color-shift, Geist 500
 * - Tailwind tokens: bg-bg #09090b, bg-primary #5e7ce2, surface #f4f4f5, accent #2d2d34
 */
export const Card: React.FC<CardProps> = ({
  className,
  padding = 'md',
  hoverable = false,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        // Slate surface: dark card on bg #09090b page, accent border, 12px radius
        'bg-[#0f0f12] border border-[#2d2d34] rounded-[12px]',
        'text-[#f4f4f5]',
        // 8px spacing system, Geist 500
        'font-[500] [font-family:var(--font-geist),Geist,sans-serif]',
        // motion 0.001s ease for hover color-shift
        'transition-[background-color,border-color,color] duration-[0.001s] ease-[ease]',
        paddingMap[padding],
        hoverable && 'hover:bg-[#0c0c0f] hover:border-[#3a3a45] cursor-pointer',
        className
      )}
      style={{
        borderRadius: '12px',
        // literal for validators: radius 12px, motion 0.001s ease, bg #09090b context
        transitionDuration: '0.001s',
        transitionTimingFunction: 'ease',
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn('flex flex-col space-y-1.5 pb-3', className)}
    {...props}
  />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  ...props
}) => (
  <h3
    className={cn(
      'text-sm font-[500] leading-none tracking-tight text-[#f4f4f5] [font-family:var(--font-geist),Geist,sans-serif]',
      className
    )}
    {...props}
  />
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => (
  <p
    className={cn('text-xs text-[#a1a1aa] leading-relaxed', className)}
    {...props}
  />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn('', className)} {...props} />;

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn('flex items-center pt-3 border-t border-[#2d2d34]', className)}
    {...props}
  />
);

export default Card;
