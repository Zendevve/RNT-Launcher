import { FULL_VERSION } from '../../version';
import React from 'react';
import {
  LayoutDashboard,
  Library,
  Crosshair,
  Cpu,
  Disc,
  Clock,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Flame,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { UiDensity } from '../../types';

export type NavViewId =
  | 'dashboard'
  | 'library'
  | 'profiles'
  | 'engines'
  | 'iwads'
  | 'history'
  | 'diagnostics'
  | 'settings';

export interface NavItemConfig {
  id: NavViewId;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeVariant?: 'default' | 'primary' | 'warning' | 'danger';
}

export interface SidebarProps {
  activeView: NavViewId;
  onViewChange: (view: NavViewId) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  density?: UiDensity;
  onToggleDensity?: () => void;
  counts?: {
    mods?: number;
    profiles?: number;
    engines?: number;
    iwads?: number;
    history?: number;
    warnings?: number;
  };
  systemStatus?: {
    ready: boolean;
    engineName?: string;
    iwadName?: string;
  };
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onViewChange,
  collapsed = false,
  onToggleCollapse,
  density = 'compact',
  onToggleDensity,
  counts = {},
  systemStatus,
  className,
}) => {
  const isCompact = density === 'compact';
  const iconSize = isCompact ? 'w-4 h-4 flex-shrink-0' : 'w-5 h-5 flex-shrink-0';

  const navItems: NavItemConfig[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className={iconSize} />,
    },
    {
      id: 'library',
      label: 'Mod Library',
      icon: <Library className={iconSize} />,
      badge: counts.mods,
    },
    {
      id: 'profiles',
      label: 'Profiles',
      icon: <Crosshair className={iconSize} />,
      badge: counts.profiles,
      badgeVariant: counts.warnings ? 'warning' : undefined,
    },
    {
      id: 'engines',
      label: 'Engines',
      icon: <Cpu className={iconSize} />,
      badge: counts.engines,
    },
    {
      id: 'iwads',
      label: 'IWADs',
      icon: <Disc className={iconSize} />,
      badge: counts.iwads,
    },
    {
      id: 'history',
      label: 'History',
      icon: <Clock className={iconSize} />,
      badge: counts.history,
    },
    {
      id: 'diagnostics',
      label: 'Diagnostics',
      icon: <Activity className={iconSize} />,
      badge: counts.warnings ? counts.warnings : undefined,
      badgeVariant: counts.warnings ? 'warning' : undefined,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className={iconSize} />,
    },
  ];

  return (
    <aside
      className={cn(
        'h-full bg-doom-surface border-r border-doom-border flex flex-col justify-between transition-all duration-200 select-none z-30',
        collapsed ? 'w-16' : isCompact ? 'w-56' : 'w-60',
        className
      )}
    >
      {/* Top Branding Section */}
      <div className="flex flex-col flex-shrink-0">
        <div
          className={cn(
            'flex items-center border-b border-doom-border/80 px-3.5 gap-2.5 bg-doom-card/40 transition-all',
            isCompact ? 'h-12' : 'h-14',
            collapsed ? 'justify-center px-2' : 'justify-between'
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <div
              className={cn(
                'rounded bg-doom-red flex items-center justify-center flex-shrink-0 shadow-md shadow-red-950/60 border border-red-500/40 transition-all',
                isCompact ? 'w-7 h-7' : 'w-8 h-8'
              )}
            >
              <Flame className={cn('text-white transition-all', isCompact ? 'w-4 h-4' : 'w-5 h-5')} />
            </div>

            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className={cn('font-extrabold tracking-wider uppercase text-doom-text truncate', isCompact ? 'text-xs' : 'text-sm')}>
                  RNT Launcher
                </span>
                <span className="font-mono text-[9px] text-doom-muted tracking-tight -mt-0.5">
                  DOOM MOD MANAGER
                </span>
              </div>
            )}
          </div>

          {!collapsed && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
              className="text-doom-muted hover:text-doom-text p-1 rounded hover:bg-doom-card transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className={cn('overflow-y-auto space-y-0.5', isCompact ? 'p-1.5' : 'p-2 space-y-1')}>
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const hasBadge =
              item.badge !== undefined &&
              (typeof item.badge === 'number' ? item.badge > 0 : Boolean(item.badge));

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded font-medium transition-all duration-150 relative group',
                  isCompact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2.5 text-xs',
                  collapsed ? 'justify-center px-0' : 'justify-between',
                  isActive
                    ? 'bg-doom-card text-white border border-doom-border-bright/50 shadow-sm'
                    : 'text-doom-muted hover:text-doom-text hover:bg-doom-card/50 border border-transparent'
                )}
              >
                {/* Active left indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1 bottom-1 w-1 bg-doom-red rounded-r" />
                )}

                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className={cn(
                      'transition-colors',
                      isActive ? 'text-doom-red-bright' : 'group-hover:text-doom-text'
                    )}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!collapsed && hasBadge && (
                  <span
                    className={cn(
                      'font-mono px-1.5 rounded-full border flex-shrink-0 font-semibold',
                      isCompact ? 'text-[9px] py-0' : 'text-[10px] py-0.5',
                      item.badgeVariant === 'warning'
                        ? 'bg-amber-950/70 text-amber-300 border-amber-600/60'
                        : item.badgeVariant === 'danger'
                        ? 'bg-red-950/70 text-red-300 border-red-600/60'
                        : isActive
                        ? 'bg-doom-red/20 text-red-300 border-doom-red/40'
                        : 'bg-doom-surface text-doom-muted border-doom-border'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section / Status & Expand toggle */}
      <div className={cn('border-t border-doom-border/80 bg-doom-card/30 flex-shrink-0 flex flex-col gap-1.5', isCompact ? 'p-1.5' : 'p-2 gap-2')}>
        {/* Quick Density & Collapse Row */}
        <div className="flex items-center justify-between gap-1 px-1">
          {onToggleDensity && (
            <button
              type="button"
              onClick={onToggleDensity}
              title={isCompact ? 'Switch to Comfortable Density' : 'Switch to Compact Density'}
              className={cn(
                'flex items-center gap-1.5 text-doom-muted hover:text-doom-text rounded transition-colors text-[10px] font-mono',
                collapsed ? 'w-full justify-center p-1.5' : 'px-1.5 py-1 hover:bg-doom-card'
              )}
            >
              {isCompact ? <Maximize2 className="w-3.5 h-3.5 text-doom-cyan" /> : <Minimize2 className="w-3.5 h-3.5 text-doom-red" />}
              {!collapsed && (
                <span>{isCompact ? 'Compact' : 'Comfortable'}</span>
              )}
            </button>
          )}

          {collapsed && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              className="flex items-center justify-center p-1.5 text-doom-muted hover:text-doom-text rounded hover:bg-doom-card transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="px-2 py-1.5 bg-doom-bg/60 border border-doom-border/50 rounded flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span
                    className={cn(
                      'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                      systemStatus?.ready !== false ? 'bg-emerald-400' : 'bg-amber-400'
                    )}
                  />
                  <span
                    className={cn(
                      'relative inline-flex rounded-full h-2 w-2',
                      systemStatus?.ready !== false ? 'bg-emerald-500' : 'bg-amber-500'
                    )}
                  />
                </span>
                <span className="text-[10px] font-semibold text-doom-text uppercase tracking-wider">
                  {systemStatus?.ready !== false ? 'READY' : 'SETUP REQ'}
                </span>
              </div>
              <span className="font-mono text-[9px] text-doom-muted">{FULL_VERSION}</span>
            </div>

            {systemStatus?.engineName && (
              <div className="text-[9.5px] text-doom-muted truncate font-mono">
                Port: <span className="text-doom-text">{systemStatus.engineName}</span>
              </div>
            )}
            {systemStatus?.iwadName && (
              <div className="text-[9.5px] text-doom-muted truncate font-mono">
                IWAD: <span className="text-doom-text">{systemStatus.iwadName}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
