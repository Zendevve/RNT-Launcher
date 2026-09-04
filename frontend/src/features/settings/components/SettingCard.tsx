import React from 'react';
import { cn } from '../../../lib/utils';

export interface SettingCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  control?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function SettingCard({
  title,
  description,
  icon,
  badge,
  control,
  children,
  className,
}: SettingCardProps) {
  return (
    <section
      className={cn(
        'bg-[#0f0f12] border border-[#2d2d34] rounded-[12px] p-5',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-[#f4f4f5]">{title}</h3>
              {badge}
            </div>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{description}</p>
            ) : null}
          </div>
        </div>
        {control ? <div className="shrink-0">{control}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export default SettingCard;
