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
  Flame,
} from 'lucide-react';
import { motion, LayoutGroup, useReducedMotion, AnimatePresence } from 'motion/react';
import { cn } from '../../utils/cn';
import { UiDensity } from '../../types';
import { springDefault, springSheet } from '../../lib/springs';

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
      ],
    },
  ];

  const isSettingsActive = activeView === 'settings';
  const settingsBadge = !isReady ? 'Setup' : undefined;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 56 : isCompact ? 224 : 240 }}
      transition={shouldReduceMotion ? { duration: 0 } : springSheet}
      className={cn(
        'h-full bg-[#101010] border-r border-[#2d2d34] flex flex-col justify-between select-none z-30 flex-shrink-0 overflow-hidden',
        className
      )}
    >
      {/* Brand Header - 8px rhythm, Geist 500 */}
      <div className="flex flex-col flex-shrink-0">
        <div
          className={cn(
            'h-12 border-b border-[#2d2d34] flex items-center px-3 transition-colors overflow-hidden',
            collapsed ? 'justify-center' : 'justify-between'
          )}
        >
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2 overflow-hidden min-w-0"
              >
                <div className="w-7 h-7 rounded-[8px] bg-[#5e7ce2] flex items-center justify-center flex-shrink-0">
                  <Flame className="w-4 h-4 text-white fill-white/20" />
                </div>

                <div className="flex flex-col min-w-0 overflow-hidden whitespace-nowrap">
                  <span className="font-medium text-xs text-[#f4f4f5] tracking-tight leading-tight truncate" style={{ fontFamily: 'var(--font-sans)' }}>
                    RNT Launcher
                  </span>
                  <span className="font-medium text-[10px] text-[#a1a1aa] uppercase tracking-[0.08em] leading-tight" style={{ fontFamily: 'var(--font-sans)' }}>
                    DOOM MOD MANAGER
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded hover:bg-white/[0.04] transition-colors flex-shrink-0"
            >
              <motion.div
                animate={{ rotate: collapsed ? 180 : 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : springDefault}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </motion.div>
            </button>
          )}
        </div>
        {/* Navigation Sections - LayoutGroup enables fluid shared active pill | compact = 8px rhythm */}
        <LayoutGroup>
          <nav className={cn('flex-1 overflow-y-auto space-y-3', isCompact ? 'p-2' : 'p-2')}>
          {sections.map((section, sIdx) => (
            <div key={section.title || sIdx} className="space-y-1">
              <AnimatePresence initial={false}>
                {!collapsed && section.title && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden text-[11px] font-medium uppercase tracking-[0.08em] text-[#71717a] px-2 pt-2 pb-1 whitespace-nowrap"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {section.title}
                  </motion.div>
                )}
              </AnimatePresence>

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
                      'w-full flex items-center rounded-[8px] font-medium relative text-left transition-colors duration-150',
                      isCompact ? 'px-2 py-2 text-xs gap-2' : 'px-3 py-2 text-xs gap-2',
                      collapsed ? 'justify-center px-0 py-2' : 'justify-between',
                      isActive
                        ? 'text-[#f4f4f5]'
                        : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[rgba(244,244,245,0.05)] border border-transparent'
                    )}
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active-bg"
                        className="absolute inset-0 bg-[rgba(244,244,245,0.05)] rounded-[8px]"
                        transition={shouldReduceMotion ? { duration: 0 } : springDefault}
                        initial={false}
                      >
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#5e7ce2] rounded-r" />
                      </motion.div>
                    )}
                    <div className="flex items-center gap-2 min-w-0 truncate relative z-10">
                      <span
                        className={cn(
                          'flex-shrink-0 transition-colors duration-100',
                          isActive ? 'text-[#5e7ce2]' : 'text-[#71717a]'
                        )}
                      >
                        {item.icon}
                      </span>

                      <AnimatePresence initial={false}>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            className={cn(
                              'truncate tracking-tight font-medium overflow-hidden whitespace-nowrap',
                              isActive ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]'
                            )}
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

                    <AnimatePresence initial={false}>
                      {!collapsed && hasBadge && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
                          className={cn(
                            'font-mono text-[10px] px-1.5 py-0.5 rounded-[8px] relative z-10 flex-shrink-0 font-medium leading-none border overflow-hidden whitespace-nowrap',
                            item.badgeVariant === 'warning'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : isActive
                              ? 'bg-white/[0.08] text-[#f4f4f5] border-white/[0.08]'
                              : 'bg-[rgba(244,244,245,0.05)] text-[#a1a1aa] border-[#2d2d34]'
                          )}
                        >
                          {item.badge}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          ))}
        </nav>
        </LayoutGroup>
      </div>

      {/* Pinned Settings at very bottom - Slate border */}
      <div className="mt-auto border-t border-[#2d2d34] p-2 shrink-0">
        <motion.button
          type="button"
          onClick={() => onViewChange('settings')}
          title={collapsed ? 'Settings' : undefined}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
          className={cn(
            'w-full flex items-center rounded-[8px] font-medium relative text-left transition-colors duration-150 gap-2',
            isCompact ? 'px-2 py-2 text-xs' : 'px-3 py-2 text-xs',
            collapsed ? 'justify-center px-0 py-2' : 'justify-between',
            isSettingsActive
              ? 'text-[#f4f4f5]'
              : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[rgba(244,244,245,0.05)] border border-transparent'
          )}
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {isSettingsActive && (
            <motion.div
              layoutId="sidebar-active-bg"
              className="absolute inset-0 bg-[rgba(244,244,245,0.05)] rounded-[8px]"
              transition={shouldReduceMotion ? { duration: 0 } : springDefault}
              initial={false}
            >
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#5e7ce2] rounded-r" />
            </motion.div>
          )}
          <div className="flex items-center gap-2 min-w-0 truncate relative z-10">
            <span className={cn('flex-shrink-0 transition-colors duration-100', isSettingsActive ? 'text-[#5e7ce2]' : 'text-[#71717a]')}>
              <Settings className="w-4 h-4" />
            </span>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className={cn('truncate tracking-tight font-medium overflow-hidden whitespace-nowrap', isSettingsActive ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]')}
                >
                  Settings
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && settingsBadge && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
                className="font-mono text-[10px] px-1.5 py-0.5 rounded-[8px] relative z-10 flex-shrink-0 font-medium leading-none bg-amber-500/10 text-amber-400 border border-amber-500/20 overflow-hidden whitespace-nowrap"
              >
                {settingsBadge}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.aside>
  );
};
