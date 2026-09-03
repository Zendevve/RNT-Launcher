import React from 'react';
import { Search, RefreshCw, Play, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearchClick?: () => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  onQuickScan?: () => void;
  isScanning?: boolean;
  activeProfileName?: string;
  launchStatus?: 'IDLE' | 'READY' | 'WARNING' | 'ERROR' | 'LAUNCHING' | 'RUNNING';
  onQuickLaunch?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  searchQuery = '',
  onSearchClick,
  searchPlaceholder = 'Search mods, profiles, commands...',
  showSearch = true,
  onQuickScan,
  isScanning = false,
  activeProfileName,
  launchStatus,
  onQuickLaunch,
  actions,
  className,
}) => {
  const isMac =
    typeof window !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(window.navigator.userAgent);

  return (
    <header
      className={cn(
        'h-12 bg-[#09090b] border-b border-[#2d2d34] px-4 flex items-center justify-between gap-4 select-none z-20 flex-shrink-0',
        className
      )}
    >
      {/* Breadcrumb - Geist 500, caption tracking */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-[0.08em]" style={{ fontFamily: 'var(--font-sans)' }}>
          RNT
        </span>
        <span className="text-[#2d2d34] font-mono text-xs select-none">/</span>
        <h1 className="text-xs font-medium text-[#f4f4f5] tracking-tight truncate" style={{ fontFamily: 'var(--font-sans)' }}>
          {title}
        </h1>
        {activeProfileName && (
          <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-[#a1a1aa] bg-[rgba(244,244,245,0.05)] px-2 py-0.5 rounded-[8px] border border-[#2d2d34]">
            <span className="text-[#71717a] font-medium tracking-[0.04em] uppercase text-[10px]" style={{ fontFamily: 'var(--font-sans)' }}>Active:</span>
            <span className="text-[#f4f4f5] font-medium truncate max-w-[160px]" style={{ fontFamily: 'var(--font-sans)' }}>
              {activeProfileName}
            </span>
          </div>
        )}
      </div>

      {/* Center Global Search Trigger (Ctrl+K) - 8px rhythm */}
      {showSearch && (
        <div className="flex-1 max-w-sm mx-4 hidden sm:block">
          <button
            type="button"
            onClick={() => onSearchClick?.()}
            className="w-full h-8 pl-8 pr-2 bg-[#101010] text-[#a1a1aa] text-xs rounded-[8px] border border-[#2d2d34] flex items-center justify-between hover:border-[#3a3a44] hover:text-[#f4f4f5] transition-colors relative"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 pointer-events-none" />
            <span className="truncate text-[12px] text-[#71717a] tracking-[0.01em]">
              {searchQuery || searchPlaceholder}
            </span>
            <kbd className="text-[10px] font-medium text-[#a1a1aa] bg-[rgba(244,244,245,0.05)] px-1.5 py-0.5 rounded-[6px] border border-[#2d2d34] tracking-[0.04em]">
              {isMac ? '⌘K' : 'Ctrl+K'}
            </kbd>
          </button>
        </div>
      )}

      {/* Right Controls: Status / Scan / Periwinkle Play CTA - 8px rhythm, Geist */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Launch Status indicator */}
        {launchStatus && launchStatus !== 'IDLE' && (
          <div className="hidden lg:flex items-center">
            {launchStatus === 'RUNNING' && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-[0.04em]" style={{ fontFamily: 'var(--font-sans)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                RUNNING
              </span>
            )}
            {launchStatus === 'LAUNCHING' && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-[0.04em]" style={{ fontFamily: 'var(--font-sans)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                LAUNCHING
              </span>
            )}
            {launchStatus === 'READY' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-[0.04em]" style={{ fontFamily: 'var(--font-sans)' }}>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                READY
              </span>
            )}
            {launchStatus === 'WARNING' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-[0.04em]" style={{ fontFamily: 'var(--font-sans)' }}>
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                WARNINGS
              </span>
            )}
            {launchStatus === 'ERROR' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-[8px] bg-red-500/10 text-red-400 border border-red-500/20 tracking-[0.04em]" style={{ fontFamily: 'var(--font-sans)' }}>
                <ShieldAlert className="w-3 h-3 text-red-400" />
                CANNOT LAUNCH
              </span>
            )}
          </div>
        )}

        {/* Quick Scan Button */}
        {onQuickScan && (
          <button
            type="button"
            onClick={onQuickScan}
            disabled={isScanning}
            className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[rgba(244,244,245,0.05)] disabled:text-[#71717a] rounded-[8px] transition-colors"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            <RefreshCw
              className={cn('w-3.5 h-3.5', isScanning && 'animate-spin text-[#5e7ce2]')}
            />
            <span>{isScanning ? 'Scanning...' : 'Scan'}</span>
          </button>
        )}

        {/* Universal Periwinkle Play Button */}
        {onQuickLaunch && (
          <button
            type="button"
            onClick={onQuickLaunch}
            disabled={launchStatus === 'RUNNING' || launchStatus === 'LAUNCHING'}
            className="h-8 px-4 inline-flex items-center gap-1.5 bg-[#5e7ce2] hover:bg-[#6b8bf0] active:bg-[#4a62c6] disabled:opacity-50 disabled:pointer-events-none text-white font-medium tracking-[0.04em] uppercase text-xs rounded-[8px] transition-colors duration-150"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>PLAY</span>
          </button>
        )}

        {actions}
      </div>
    </header>
  );
};
