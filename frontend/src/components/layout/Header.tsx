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
        'h-12 bg-[#101317] border-b border-[#22262d] px-4 flex items-center justify-between gap-4 select-none z-20 flex-shrink-0',
        className
      )}
    >
      {/* Single Header Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-mono font-medium text-zinc-500 uppercase tracking-wider">
          RNT
        </span>
        <span className="text-zinc-600 font-mono text-xs select-none">/</span>
        <h1 className="text-xs font-semibold text-zinc-200 tracking-wide truncate">
          {title}
        </h1>
        {activeProfileName && (
          <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-zinc-300 bg-white/[0.04] px-2 py-0.5 rounded border border-[#22262d]">
            <span className="text-zinc-500 font-normal">Active:</span>
            <span className="text-zinc-200 font-medium truncate max-w-[160px]">
              {activeProfileName}
            </span>
          </div>
        )}
      </div>

      {/* Center Global Search Trigger (Ctrl+K) */}
      {showSearch && (
        <div className="flex-1 max-w-sm mx-4 hidden sm:block">
          <button
            type="button"
            onClick={() => onSearchClick?.()}
            className="w-full h-7 pl-8 pr-2 bg-[#14171a] text-zinc-400 text-xs rounded border border-[#22262d] flex items-center justify-between hover:border-zinc-600 hover:text-zinc-200 transition-colors relative"
          >
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 pointer-events-none" />
            <span className="truncate text-[11px] text-zinc-400">
              {searchQuery || searchPlaceholder}
            </span>
            <kbd className="text-[9.5px] font-mono text-zinc-400 bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.08]">
              {isMac ? '⌘K' : 'Ctrl+K'}
            </kbd>
          </button>
        </div>
      )}

      {/* Right Controls: Status / Scan / Universal Crimson Play CTA */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Launch Status indicator */}
        {launchStatus && launchStatus !== 'IDLE' && (
          <div className="hidden lg:flex items-center">
            {launchStatus === 'RUNNING' && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                RUNNING
              </span>
            )}
            {launchStatus === 'LAUNCHING' && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                LAUNCHING
              </span>
            )}
            {launchStatus === 'READY' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                READY
              </span>
            )}
            {launchStatus === 'WARNING' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                WARNINGS
              </span>
            )}
            {launchStatus === 'ERROR' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
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
            className="h-7 px-2.5 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] disabled:text-zinc-600 rounded transition-colors"
          >
            <RefreshCw
              className={cn('w-3.5 h-3.5', isScanning && 'animate-spin text-red-400')}
            />
            <span>{isScanning ? 'Scanning...' : 'Scan'}</span>
          </button>
        )}

        {/* Universal Crimson Play Button */}
        {onQuickLaunch && (
          <button
            type="button"
            onClick={onQuickLaunch}
            disabled={launchStatus === 'RUNNING' || launchStatus === 'LAUNCHING'}
            className="h-7 px-3.5 inline-flex items-center gap-1.5 bg-[#dc2626] hover:bg-[#ef4444] active:bg-[#b91c1c] disabled:opacity-50 disabled:pointer-events-none text-white font-bold tracking-wider uppercase text-xs rounded transition-colors duration-150 shadow-sm"
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
