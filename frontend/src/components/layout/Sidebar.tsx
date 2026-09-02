import { FULL_VERSION } from '../../version';
import React from 'react';
import {
  Play,
  Library,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Flame,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../utils/cn';
import { UiDensity } from '../../types';
import { springSnappy } from '../../lib/springs';
export type NavViewId =
  | 'play'
  | 'mods'
  | 'settings'
  | 'dashboard'
  | 'library'
  | 'profiles'
  | 'engines'
  | 'iwads'
  | 'history'
  | 'diagnostics';

export interface NavHubConfig {
  id: NavViewId;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeVariant?: 'default' | 'primary' | 'warning' | 'danger';
  isMatchingView: (view: NavViewId) => boolean;
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
  const iconSize = 'w-4 h-4';

  const navHubs: NavHubConfig[] = [
    {
      id: 'play',
      label: 'Play',
      sublabel: 'Launchpad',
      icon: <Play className={cn(iconSize, 'fill-current')} />,
      badge: counts.profiles,
      isMatchingView: (v) => v === 'play' || v === 'dashboard' || v === 'profiles',
    },
    {
      id: 'mods',
      label: 'Mods',
      sublabel: 'The Collection',
      icon: <Library className={iconSize} />,
      badge: counts.mods,
      isMatchingView: (v) => v === 'mods' || v === 'library',
    },
    {
      id: 'settings',
      label: 'Settings & Assets',
      sublabel: 'The Engine Room',
      icon: <Sliders className={iconSize} />,
      badge:
        systemStatus?.ready === false
          ? 'SETUP'
          : counts.warnings
          ? counts.warnings
          : undefined,
      badgeVariant:
        systemStatus?.ready === false || counts.warnings ? 'warning' : undefined,
      isMatchingView: (v) =>
        v === 'settings' ||
        v === 'engines' ||
        v === 'iwads' ||
        v === 'history' ||
        v === 'diagnostics',
    },
  ];

  return (
    <aside
      className={cn(
        'h-full glass-sidebar flex flex-col justify-between transition-all duration-150 select-none z-30',
        collapsed ? 'w-16' : isCompact ? 'w-56' : 'w-60',
        className
      )}
    >
      {/* Top Branding Section */}
      <div className="flex flex-col flex-shrink-0">
        <div
          className={cn(
            'flex items-center border-b border-white/[0.07] px-3.5 gap-2.5 bg-white/[0.02] transition-all',
            isCompact ? 'h-12' : 'h-14',
            collapsed ? 'justify-center px-2' : 'justify-between'
          )}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              className={cn(
                'rounded-lg bg-[#dc2626] flex items-center justify-center flex-shrink-0 border border-red-500/30 transition-all',
                isCompact ? 'w-7 h-7' : 'w-8 h-8'
              )}
            >
              <Flame className={cn('text-white transition-all', isCompact ? 'w-4 h-4' : 'w-4.5 h-4.5')} />
            </div>

            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span
                  className={cn(
                    'font-bold tracking-tight uppercase text-zinc-100 truncate',
                    isCompact ? 'text-xs' : 'text-sm'
                  )}
                >
                  RNT Launcher
                </span>
                <span className="font-mono text-[9px] text-zinc-400 tracking-wider -mt-0.5">
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
              className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/[0.06] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className={cn('overflow-y-auto space-y-0.5', isCompact ? 'p-1.5' : 'p-2 space-y-1')}>
          {navHubs.map((item) => {
            const isActive = item.isMatchingView(activeView);
            const hasBadge =
              item.badge !== undefined &&
              (typeof item.badge === 'number' ? item.badge > 0 : Boolean(item.badge));

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                title={collapsed ? `${item.label} (${item.sublabel})` : undefined}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-lg font-medium transition-colors duration-150 relative group active:scale-[0.98]',
                  isCompact ? 'px-2.5 py-2 text-[11px]' : 'px-3 py-2.5 text-xs',
                  collapsed ? 'justify-center px-0' : 'justify-between',
                  isActive ? 'text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                )}
              >
                {/* Active Minimalist Spring Indicator Pill */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    transition={springSnappy}
                    className="absolute inset-0 bg-[#1c2026] border border-white/[0.08] rounded-lg"
                  >
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#dc2626] rounded-r" />
                  </motion.div>
                )}

                <div className="flex items-center gap-2.5 truncate relative z-10">
                  <span
                    className={cn(
                      'transition-colors',
                      isActive ? 'text-red-400' : 'group-hover:text-zinc-200'
                    )}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <div className="flex flex-col text-left truncate leading-tight">
                      <span className="truncate tracking-tight font-semibold text-zinc-100">
                        {item.label}
                      </span>
                      {item.sublabel && (
                        <span className="truncate text-[9.5px] font-mono text-zinc-400 font-normal">
                          {item.sublabel}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {!collapsed && hasBadge && (
                  <span
                    className={cn(
                      'font-mono px-1.5 rounded-full border flex-shrink-0 font-semibold relative z-10',
                      isCompact ? 'text-[9px] py-0' : 'text-[10px] py-0.5',
                      item.badgeVariant === 'warning'
                        ? 'bg-[#2b2011] text-[#fde047] border-amber-800/40'
                        : item.badgeVariant === 'danger'
                        ? 'bg-[#2b1416] text-[#fca5a5] border-red-800/40'
                        : isActive
                        ? 'bg-[#2b1416] text-[#fca5a5] border-red-800/40'
                        : 'bg-black/30 text-zinc-400 border-white/[0.08]'
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
      <div
        className={cn(
          'border-t border-white/[0.07] bg-black/20 flex-shrink-0 flex flex-col gap-1.5',
          isCompact ? 'p-1.5' : 'p-2 gap-2'
        )}
      >
        {/* Quick Density & Collapse Row */}
        <div className="flex items-center justify-between gap-1 px-1">
          {onToggleDensity && (
            <button
              type="button"
              onClick={onToggleDensity}
              title={isCompact ? 'Switch to Comfortable Density' : 'Switch to Compact Density'}
              className={cn(
                'flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 rounded-md transition-colors text-[10px] font-mono',
                collapsed ? 'w-full justify-center p-1.5' : 'px-1.5 py-1 hover:bg-white/[0.06]'
              )}
            >
              {isCompact ? (
                <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5 text-red-400" />
              )}
              {!collapsed && <span>{isCompact ? 'Compact' : 'Comfortable'}</span>}
            </button>
          )}

          {collapsed && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              className="flex items-center justify-center p-1.5 text-zinc-400 hover:text-white rounded-md hover:bg-white/[0.06] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="px-2.5 py-2 bg-[#121417] border border-white/[0.07] rounded-lg flex flex-col gap-1">
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
                <span className="text-[10px] font-semibold text-zinc-300 uppercase tracking-wider">
                  {systemStatus?.ready !== false ? 'READY' : 'SETUP NEEDED'}
                </span>
              </div>
              <span className="font-mono text-[9px] text-zinc-400">{FULL_VERSION}</span>
            </div>

            {systemStatus?.engineName && (
              <div className="text-[9.5px] text-zinc-400 truncate font-mono">
                Port: <span className="text-zinc-200">{systemStatus.engineName}</span>
              </div>
            )}
            {systemStatus?.iwadName && (
              <div className="text-[9.5px] text-zinc-400 truncate font-mono">
                IWAD: <span className="text-zinc-200">{systemStatus.iwadName}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
