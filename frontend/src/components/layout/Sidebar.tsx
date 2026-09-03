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
} from 'lucide-react';
import { motion, LayoutGroup, useReducedMotion } from 'motion/react';
import { cn } from '../../utils/cn';
import { UiDensity } from '../../types';
import { springDefault } from '../../lib/springs';

export type NavViewId =
  | 'dashboard'
  | 'profiles'
  | 'library'
  | 'engines'
  | 'iwads'
  | 'history'
  | 'diagnostics'
  | 'settings'
  | 'play'
  | 'mods';

export interface NavItemConfig {
  id: NavViewId;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeVariant?: 'default' | 'warning';
  matchViews?: NavViewId[];
}

export interface NavSection {
  title?: string;
  items: NavItemConfig[];
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
  counts = {},
  systemStatus,
  className,
}) => {
  const isCompact = density === 'compact';
  const isReady = systemStatus?.ready !== false;
  const shouldReduceMotion = useReducedMotion();

  const sections: NavSection[] = [
    {
      title: 'Main',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: <LayoutDashboard className="w-4 h-4" />,
          matchViews: ['dashboard'],
        },
        {
          id: 'profiles',
          label: 'Profiles',
          icon: <Crosshair className="w-4 h-4" />,
          badge: counts.profiles && counts.profiles > 0 ? counts.profiles : undefined,
          matchViews: ['profiles', 'play'],
        },
        {
          id: 'library',
          label: 'Mod Library',
          icon: <Library className="w-4 h-4" />,
          badge: counts.mods && counts.mods > 0 ? counts.mods : undefined,
          matchViews: ['library', 'mods'],
        },
      ],
    },
    {
      title: 'Assets',
      items: [
        {
          id: 'engines',
          label: 'Source Ports',
          icon: <Cpu className="w-4 h-4" />,
          badge: counts.engines && counts.engines > 0 ? counts.engines : undefined,
          matchViews: ['engines'],
        },
        {
          id: 'iwads',
          label: 'Base IWADs',
          icon: <Disc className="w-4 h-4" />,
          badge: counts.iwads && counts.iwads > 0 ? counts.iwads : undefined,
          matchViews: ['iwads'],
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          id: 'history',
          label: 'Launch History',
          icon: <Clock className="w-4 h-4" />,
          badge: counts.history && counts.history > 0 ? counts.history : undefined,
          matchViews: ['history'],
        },
        {
          id: 'diagnostics',
          label: 'Diagnostics',
          icon: <Activity className="w-4 h-4" />,
          badge: counts.warnings && counts.warnings > 0 ? counts.warnings : undefined,
          badgeVariant: 'warning',
          matchViews: ['diagnostics'],
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: <Settings className="w-4 h-4" />,
          badge: !isReady ? 'Setup' : undefined,
          badgeVariant: 'warning',
          matchViews: ['settings'],
        },
      ],
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
          {!collapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded bg-[#dc2626] flex items-center justify-center flex-shrink-0">
                <Flame className="w-4 h-4 text-white fill-white/20" />
              </div>

              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-xs text-zinc-100 tracking-tight leading-tight truncate">
                  RNT Launcher
                </span>
                <span className="font-mono text-[9px] text-zinc-500 tracking-wider leading-tight">
                  DOOM MOD MANAGER
                </span>
              </div>
            </div>
          ) : null}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-white/[0.04] transition-colors"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        {/* Navigation Sections - LayoutGroup enables fluid shared active pill */}
        <LayoutGroup>
          <nav className={cn('flex-1 overflow-y-auto space-y-3', isCompact ? 'p-1.5' : 'p-2')}>
          {sections.map((section, sIdx) => (
            <div key={section.title || sIdx} className="space-y-0.5">
              {!collapsed && section.title && (
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-2.5 pt-1.5 pb-1">
                  {section.title}
                </div>
              )}

              {section.items.map((item) => {
                const isActive = item.matchViews
                  ? item.matchViews.includes(activeView)
                  : activeView === item.id;
                const hasBadge = item.badge !== undefined && item.badge !== null && item.badge !== 0;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    onClick={() => onViewChange(item.id)}
                    title={collapsed ? item.label : undefined}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                    className={cn(
                      'w-full flex items-center rounded-md font-medium relative text-left',
                      isCompact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs',
                      collapsed ? 'justify-center px-0 py-2' : 'justify-between',
                      isActive
                        ? 'text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] border border-transparent'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active-bg"
                        className="absolute inset-0 bg-[#1c2026] border border-[#2c323d] rounded-md shadow-xs"
                        transition={shouldReduceMotion ? { duration: 0 } : springDefault}
                        initial={false}
                      >
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#dc2626] rounded-r" />
                      </motion.div>
                    )}
                    <div className="flex items-center gap-2.5 min-w-0 truncate relative z-10">
                      <span
                        className={cn(
                          'flex-shrink-0 transition-colors duration-100',
                          isActive ? 'text-[#ef4444]' : 'text-zinc-400 group-hover:text-zinc-200'
                        )}
                      >
                        {item.icon}
                      </span>

                      {!collapsed && (
                        <span
                          className={cn(
                            'truncate tracking-tight',
                            isActive ? 'text-zinc-100 font-medium' : 'text-zinc-300'
                          )}
                        >
                          {item.label}
                        </span>
                      )}
                    </div>

                    {!collapsed && hasBadge && (
                      <span
                        className={cn(
                          'font-mono text-[10px] px-1.5 py-0.5 rounded relative z-10 flex-shrink-0 font-medium leading-none',
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
                  </motion.button>
                );
              })}
            </div>
          ))}
        </nav>
        </LayoutGroup>
      </div>

    </aside>
  );
};
