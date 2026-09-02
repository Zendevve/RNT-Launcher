import React from 'react';
import { Search, RefreshCw, Play, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
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
  searchPlaceholder = 'Global search (Ctrl+K)...',
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
        'h-12 bg-[#121417] border-b border-white/[0.08] px-5 flex items-center justify-between gap-4 select-none z-20 flex-shrink-0',
        className
      )}
    >
      {/* Single Header Breadcrumb */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
          RNT
        </span>
        <span className="text-zinc-600 font-mono text-xs">/</span>
        <h1 className="text-xs font-bold uppercase tracking-wider text-zinc-100 truncate">
          {title}
        </h1>
        {activeProfileName && (
          <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-300 bg-white/[0.04] px-2.5 py-0.5 rounded-md border border-white/[0.08]">
            <span className="text-zinc-500 font-normal">Profile:</span>
            <span className="text-white font-semibold truncate max-w-[140px]">{activeProfileName}</span>
          </span>
        )}
      </div>

      {/* Center Global Search Trigger (Ctrl+K) */}
      {showSearch && (
        <div className="flex-1 max-w-sm mx-3 hidden sm:block">
          <button
            type="button"
            onClick={() => onSearchClick?.()}
            className="w-full h-7 pl-8 pr-2.5 bg-black/40 text-zinc-400 text-xs rounded-md border border-white/[0.08] flex items-center justify-between hover:border-white/[0.2] hover:bg-black/60 transition-colors relative"
          >
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
            <span className="truncate text-[11px] text-zinc-400 font-mono">
              {searchQuery || searchPlaceholder}
            </span>
            <kbd className="text-[9.5px] font-mono text-zinc-400 bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.08]">
              {isMac ? '⌘K' : 'Ctrl+K'}
            </kbd>
          </button>
        </div>
      )}

      {/* Right Controls: Status / Scan / Universal Play CTA */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Launch Status indicator */}
        {launchStatus && launchStatus !== 'IDLE' && (
          <div className="hidden lg:flex items-center">
            {launchStatus === 'RUNNING' && (
              <Badge variant="primary" dot dotPulse size="xs">
                RUNNING
              </Badge>
            )}
            {launchStatus === 'LAUNCHING' && (
              <Badge variant="warning-status" dot size="xs">
                LAUNCHING
              </Badge>
            )}
            {launchStatus === 'READY' && (
              <Badge variant="ready" icon={<CheckCircle2 className="w-3 h-3 mr-1" />} size="xs">
                READY
              </Badge>
            )}
            {launchStatus === 'WARNING' && (
              <Badge variant="warning-status" icon={<ShieldAlert className="w-3 h-3 mr-1" />} size="xs">
                WARNINGS
              </Badge>
            )}
            {launchStatus === 'ERROR' && (
              <Badge variant="error-status" icon={<ShieldAlert className="w-3 h-3 mr-1" />} size="xs">
                CANNOT LAUNCH
              </Badge>
            )}
          </div>
        )}

        {/* Quick Scan Button */}
        {onQuickScan && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onQuickScan}
            disabled={isScanning}
            leftIcon={
              <RefreshCw
                className={cn('w-3.5 h-3.5', isScanning && 'animate-spin text-red-400')}
              />
            }
            className="text-zinc-400 hover:text-white text-xs h-7"
          >
            {isScanning ? 'Scanning...' : 'Scan'}
          </Button>
        )}

        {/* Universal Quick Play Action */}
        {onQuickLaunch && (
          <motion.div whileTap={{ scale: 0.97 }} className="inline-flex">
            <Button
              variant="primary"
              size="xs"
              onClick={onQuickLaunch}
              disabled={launchStatus === 'RUNNING' || launchStatus === 'LAUNCHING'}
              leftIcon={<Play className="w-3 h-3 fill-current" />}
              className="px-3.5 h-7 font-bold tracking-wider uppercase text-xs"
            >
              PLAY
            </Button>
          </motion.div>
        )}

        {actions}
      </div>
    </header>
  );
};
