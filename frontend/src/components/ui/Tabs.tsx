import React from 'react';
import { cn } from '../../utils/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  badgeVariant?: 'default' | 'primary' | 'warning' | 'danger';
  disabled?: boolean;
}

export type TabsVariant = 'underline' | 'pills' | 'segmented';
export type TabsSize = 'sm' | 'md' | 'lg';

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: TabsVariant;
  size?: TabsSize;
  className?: string;
  fullWidth?: boolean;
}

const sizeStyles: Record<TabsSize, { tab: string; icon: string; badge: string }> = {
  sm: {
    tab: 'px-2.5 py-1 text-xs gap-1.5',
    icon: 'w-3.5 h-3.5',
    badge: 'text-[10px] px-1 py-0.2',
  },
  md: {
    tab: 'px-3.5 py-1.5 text-sm gap-2',
    icon: 'w-4 h-4',
    badge: 'text-xs px-1.5 py-0.5',
  },
  lg: {
    tab: 'px-4 py-2 text-base gap-2.5',
    icon: 'w-4.5 h-4.5',
    badge: 'text-xs px-2 py-0.5',
  },
};

const badgeVariantStyles = {
  default: 'bg-doom-surface text-doom-muted border-doom-border',
  primary: 'bg-doom-red/20 text-red-300 border-doom-red/40',
  warning: 'bg-amber-950/60 text-amber-300 border-amber-600/50',
  danger: 'bg-red-950/60 text-red-300 border-red-600/50',
};

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  size = 'md',
  className,
  fullWidth = false,
}) => {
  const currentSize = sizeStyles[size];

  if (variant === 'segmented') {
    return (
      <div
        role="tablist"
        className={cn(
          'inline-flex p-1 bg-doom-bg border border-doom-border rounded-md select-none',
          fullWidth && 'w-full',
          className
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative inline-flex items-center justify-center font-medium rounded transition-all duration-150',
                currentSize.tab,
                fullWidth && 'flex-1',
                isActive
                  ? 'bg-doom-surface text-doom-text shadow-sm border border-doom-border-bright/50'
                  : 'text-doom-muted hover:text-doom-text hover:bg-doom-card/40',
                tab.disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
              )}
            >
              {tab.icon && (
                <span className={cn('flex-shrink-0', currentSize.icon)}>{tab.icon}</span>
              )}
              <span className="truncate">{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'border rounded-full font-mono font-semibold leading-none',
                    currentSize.badge,
                    badgeVariantStyles[tab.badgeVariant || (isActive ? 'primary' : 'default')]
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'pills') {
    return (
      <div
        role="tablist"
        className={cn('flex flex-wrap items-center gap-1.5 select-none', className)}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={cn(
                'inline-flex items-center justify-center font-medium border rounded transition-all duration-150',
                currentSize.tab,
                fullWidth && 'flex-1',
                isActive
                  ? 'bg-doom-card border-doom-red text-white shadow-sm shadow-red-950/20'
                  : 'bg-doom-surface border-doom-border text-doom-muted hover:text-doom-text hover:border-doom-border-bright hover:bg-doom-card',
                tab.disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
              )}
            >
              {tab.icon && (
                <span className={cn('flex-shrink-0', currentSize.icon)}>{tab.icon}</span>
              )}
              <span className="truncate">{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'border rounded-full font-mono font-semibold leading-none',
                    currentSize.badge,
                    badgeVariantStyles[tab.badgeVariant || (isActive ? 'primary' : 'default')]
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Underline variant (default)
  return (
    <div
      role="tablist"
      className={cn('flex items-center border-b border-doom-border select-none gap-2', className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative inline-flex items-center justify-center font-medium transition-colors duration-150 pb-2.5 pt-1.5 px-3 -mb-px',
              fullWidth && 'flex-1',
              isActive
                ? 'text-white font-semibold'
                : 'text-doom-muted hover:text-doom-text hover:border-doom-border-bright',
              tab.disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
            )}
          >
            {tab.icon && (
              <span className={cn('flex-shrink-0 mr-1.5', currentSize.icon)}>{tab.icon}</span>
            )}
            <span className="truncate">{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'ml-2 border rounded-full font-mono font-semibold leading-none',
                  currentSize.badge,
                  badgeVariantStyles[tab.badgeVariant || (isActive ? 'primary' : 'default')]
                )}
              >
                {tab.badge}
              </span>
            )}

            {/* Active underline indicator */}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-doom-red shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export interface TabPanelProps {
  tabId: string;
  activeTab: string;
  children: React.ReactNode;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({ tabId, activeTab, children, className }) => {
  if (tabId !== activeTab) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${tabId}`}
      aria-labelledby={`tab-${tabId}`}
      className={cn('animate-in fade-in-50 duration-150 w-full', className)}
    >
      {children}
    </div>
  );
};
