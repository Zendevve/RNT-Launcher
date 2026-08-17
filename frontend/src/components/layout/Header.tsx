import React, { useEffect, useRef } from 'react';
import { Search, RefreshCw, Play, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
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
  subtitle,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search library, profiles, engines...',
  showSearch = true,
  onQuickScan,
  isScanning = false,
  activeProfileName,
  launchStatus,
  onQuickLaunch,
  actions,
  className,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K / Cmd+K listener to focus search input
  useEffect(() => {
    if (!showSearch || !onSearchChange) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, onSearchChange]);

  const isMac =
    typeof window !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(window.navigator.userAgent);

  return (
    <header
      className={cn(
        'h-14 bg-doom-surface/90 backdrop-blur-sm border-b border-doom-border px-6 flex items-center justify-between gap-4 select-none z-20 flex-shrink-0',
        className
      )}
    >
      {/* Title & context */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-doom-text uppercase truncate">
              {title}
            </h1>
            {activeProfileName && (
              <span className="hidden md:inline-flex items-center gap-1 font-mono text-xs text-doom-muted bg-doom-card px-2 py-0.5 rounded border border-doom-border">
                Profile: <span className="text-doom-text font-semibold">{activeProfileName}</span>
              </span>
            )}
          </div>
          {subtitle && (
            <span className="text-xs text-doom-muted truncate leading-tight -mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Center Search Bar */}
      {showSearch && onSearchChange && (
        <div className="flex-1 max-w-md mx-4 hidden sm:block">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-doom-muted absolute left-3 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                'w-full h-8 pl-9 pr-14 bg-doom-bg/80 text-doom-text placeholder:text-doom-muted/60 text-xs rounded border border-doom-border',
                'hover:border-doom-border-bright focus:border-doom-red focus:ring-1 focus:ring-doom-red focus:outline-none transition-colors'
              )}
            />

            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 text-doom-muted hover:text-doom-text p-0.5 rounded hover:bg-doom-card"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2 text-[10px] font-mono text-doom-muted/70 bg-doom-surface px-1.5 py-0.5 rounded border border-doom-border/70 pointer-events-none">
                {isMac ? '⌘K' : 'Ctrl+K'}
              </kbd>
            )}
          </div>
        </div>
      )}

      {/* Right Actions & Status */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Launch Status indicator */}
        {launchStatus && launchStatus !== 'IDLE' && (
          <div className="hidden lg:flex items-center">
            {launchStatus === 'RUNNING' && (
              <Badge variant="primary" dot dotPulse size="sm">
                RUNNING
              </Badge>
            )}
            {launchStatus === 'LAUNCHING' && (
              <Badge variant="warning-status" dot size="sm">
                LAUNCHING
              </Badge>
            )}
            {launchStatus === 'READY' && (
              <Badge variant="ready" icon={<CheckCircle2 className="w-3 h-3 mr-1" />} size="sm">
                READY
              </Badge>
            )}
            {launchStatus === 'WARNING' && (
              <Badge variant="warning-status" icon={<ShieldAlert className="w-3 h-3 mr-1" />} size="sm">
                WARNINGS
              </Badge>
            )}
            {launchStatus === 'ERROR' && (
              <Badge variant="error-status" icon={<ShieldAlert className="w-3 h-3 mr-1" />} size="sm">
                CANNOT LAUNCH
              </Badge>
            )}
          </div>
        )}

        {/* Quick Scan Button */}
        {onQuickScan && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onQuickScan}
            disabled={isScanning}
            leftIcon={
              <RefreshCw
                className={cn('w-3.5 h-3.5', isScanning && 'animate-spin text-doom-red-bright')}
              />
            }
          >
            {isScanning ? 'Scanning...' : 'Scan Files'}
          </Button>
        )}

        {/* Quick Play Action */}
        {onQuickLaunch && (
          <Button
            variant="primary"
            size="sm"
            onClick={onQuickLaunch}
            disabled={launchStatus === 'RUNNING' || launchStatus === 'LAUNCHING'}
            leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
          >
            PLAY
          </Button>
        )}

        {actions}
      </div>
    </header>
  );
};
