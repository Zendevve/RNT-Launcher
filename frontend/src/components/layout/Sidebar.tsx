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
import { cn } from '../../utils/cn';
import { UiDensity } from '../../types';

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
  sublabel: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeVariant?: 'default' | 'warning';
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
  const isReady = systemStatus?.ready !== false;

  const navHubs: NavHubConfig[] = [
    {
      id: 'play',
      label: 'Play',
      sublabel: 'Launchpad',
      icon: <Play className="w-4 h-4 fill-current" />,
      badge: counts.profiles && counts.profiles > 0 ? counts.profiles : undefined,
      isMatchingView: (v) => v === 'play' || v === 'dashboard' || v === 'profiles',
    },
    {
      id: 'mods',
      label: 'Mods',
      sublabel: 'The Collection',
      icon: <Library className="w-4 h-4" />,
      badge: counts.mods && counts.mods > 0 ? counts.mods : undefined,
      isMatchingView: (v) => v === 'mods' || v === 'library',
    },
    {
      id: 'settings',
      label: 'Settings & Assets',
      sublabel: 'The Engine Room',
      icon: <Sliders className="w-4 h-4" />,
      badge:
        !isReady
          ? 'Setup'
          : counts.warnings && counts.warnings > 0
          ? counts.warnings
          : undefined,
      badgeVariant: !isReady || (counts.warnings && counts.warnings > 0) ? 'warning' : 'default',
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
        'h-full bg-[#101317] border-r border-[#22262d] flex flex-col justify-between select-none z-30 flex-shrink-0 transition-[width] duration-150',
        collapsed ? 'w-14' : isCompact ? 'w-56' : 'w-60',
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex flex-col flex-shrink-0">
        <div
          className={cn(
            'h-12 border-b border-[#22262d] flex items-center transition-all',
            collapsed ? 'justify-center px-2' : 'justify-between px-3'
          )}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded bg-[#dc2626] flex items-center justify-center flex-shrink-0">
              <Flame className="w-4 h-4 text-white fill-white/20" />
            </div>

            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-xs text-zinc-100 tracking-tight leading-tight truncate">
                  RNT Launcher
                </span>
                <span className="font-mono text-[9px] text-zinc-500 tracking-wider leading-tight">
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
              className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-white/[0.04] transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 3 Clean Navigation Hub Items */}
        <nav className={cn('space-y-1', isCompact ? 'p-1.5' : 'p-2')}>
          {navHubs.map((item) => {
            const isActive = item.isMatchingView(activeView);
            const hasBadge = item.badge !== undefined && item.badge !== null && item.badge !== 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                title={collapsed ? `${item.label} (${item.sublabel})` : undefined}
                className={cn(
                  'w-full flex items-center rounded-md font-medium relative text-left transition-colors duration-150',
                  isCompact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs',
                  collapsed ? 'justify-center px-0 py-2' : 'justify-between',
                  isActive
                    ? 'bg-[#1c2026] text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                )}
              >
                {/* Active Indicator Accent Bar */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#dc2626] rounded-r" />
                )}

                <div className="flex items-center gap-2.5 min-w-0 truncate">
                  <span
                    className={cn(
                      'flex-shrink-0 transition-colors duration-150',
                      isActive ? 'text-[#ef4444]' : 'text-zinc-400'
                    )}
                  >
                    {item.icon}
                  </span>

                  {!collapsed && (
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span
                        className={cn(
                          'truncate tracking-tight',
                          isActive ? 'text-zinc-100 font-medium' : 'text-zinc-300'
                        )}
                      >
                        {item.label}
                      </span>
                      <span className="truncate text-[10px] text-zinc-500 font-normal">
                        {item.sublabel}
                      </span>
                    </div>
                  )}
                </div>

                {!collapsed && hasBadge && (
                  <span
                    className={cn(
                      'font-mono text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 font-medium leading-none',
                      item.badgeVariant === 'warning'
                        ? 'bg-[#2b2011] text-[#fbbf24] border border-amber-500/20'
                        : isActive
                        ? 'bg-white/[0.08] text-zinc-200 border border-white/[0.08]'
                        : 'bg-white/[0.04] text-zinc-400 border border-white/[0.06]'
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

      {/* Footer Section: Density Switcher, Readiness Status, Version */}
      <div
        className={cn(
          'border-t border-[#22262d] flex flex-col gap-1.5 flex-shrink-0',
          isCompact ? 'p-1.5' : 'p-2'
        )}
      >
        {/* Density Toggle & Collapse Row */}
        <div className="flex items-center justify-between gap-1">
          {onToggleDensity && (
            <button
              type="button"
              onClick={onToggleDensity}
              title={isCompact ? 'Switch to Comfortable Density' : 'Switch to Compact Density'}
              className={cn(
                'flex items-center gap-2 text-zinc-400 hover:text-zinc-200 rounded hover:bg-white/[0.04] transition-colors text-[11px]',
                collapsed ? 'w-full justify-center p-1.5' : 'w-full px-2 py-1'
              )}
            >
              {isCompact ? (
                <Maximize2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              )}
              {!collapsed && (
                <span className="flex-1 text-left truncate">
                  Density: <span className="text-zinc-300 font-mono capitalize">{density}</span>
                </span>
              )}
            </button>
          )}

          {collapsed && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              className="flex items-center justify-center p-1.5 text-zinc-400 hover:text-zinc-200 rounded hover:bg-white/[0.04] transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* System Readiness Status Card */}
        {!collapsed ? (
          <div className="px-2.5 py-2 bg-[#14171a] border border-[#22262d] rounded flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span
                    className={cn(
                      'absolute inline-flex h-full w-full rounded-full opacity-75',
                      isReady ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                    )}
                  />
                  <span
                    className={cn(
                      'relative inline-flex rounded-full h-2 w-2',
                      isReady ? 'bg-emerald-500' : 'bg-amber-500'
                    )}
                  />
                </span>
                <span
                  className={cn(
                    'text-[10px] font-semibold tracking-wider uppercase',
                    isReady ? 'text-emerald-400' : 'text-amber-400'
                  )}
                >
                  {isReady ? 'Ready' : 'Setup Needed'}
                </span>
              </div>
              <span className="font-mono text-[9px] text-zinc-500">v{FULL_VERSION}</span>
            </div>

            {(systemStatus?.engineName || systemStatus?.iwadName) && (
              <div className="flex flex-col gap-0.5 text-[9.5px] font-mono text-zinc-400 truncate pt-1 border-t border-[#22262d]">
                {systemStatus?.engineName && (
                  <div className="truncate">
                    Port: <span className="text-zinc-200">{systemStatus.engineName}</span>
                  </div>
                )}
                {systemStatus?.iwadName && (
                  <div className="truncate">
                    IWAD: <span className="text-zinc-200">{systemStatus.iwadName}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex flex-col items-center py-1.5 cursor-default"
            title={`${isReady ? 'Ready' : 'Setup Needed'} (v${FULL_VERSION})`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={cn(
                  'absolute inline-flex h-full w-full rounded-full opacity-75',
                  isReady ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                )}
              />
              <span
                className={cn(
                  'relative inline-flex rounded-full h-2.5 w-2.5',
                  isReady ? 'bg-emerald-500' : 'bg-amber-500'
                )}
              />
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};
