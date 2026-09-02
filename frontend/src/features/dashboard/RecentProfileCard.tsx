import React, { useState } from 'react';
import { Play, Star, Disc, Cpu, Layers, Terminal, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Profile } from '../../types';

interface RecentProfileCardProps {
  profile: Profile;
  onLaunch: (profileId: string) => Promise<void>;
  onToggleFavorite: (profileId: string) => Promise<void>;
  onSelectProfile?: (profileId: string) => void;
}

export const RecentProfileCard: React.FC<RecentProfileCardProps> = ({
  profile,
  onLaunch,
  onToggleFavorite,
  onSelectProfile,
}) => {
  const [isLaunching, setIsLaunching] = useState(false);
  const [isFavLoading, setIsFavLoading] = useState(false);

  const enabledModsCount = profile.mods?.filter((m) => m.enabled).length || 0;
  const totalModsCount = profile.mods?.length || 0;
  const argsText = Array.isArray(profile.arguments) && profile.arguments.length > 0 ? profile.arguments.join(' ') : '';

  const handleLaunch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLaunching) return;
    try {
      setIsLaunching(true);
      await onLaunch(profile.id);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFavLoading) return;
    try {
      setIsFavLoading(true);
      await onToggleFavorite(profile.id);
    } finally {
      setIsFavLoading(false);
    }
  };

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onSelectProfile?.(profile.id)}
      className="group relative flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#15181c] p-4 transition-colors duration-150 hover:border-white/[0.18] hover:bg-[#1a1e24] cursor-pointer select-none"
    >
      {/* Top row: Title and Favorite Toggle */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3
              className="line-clamp-1 text-sm font-bold text-zinc-100 group-hover:text-white tracking-tight"
              title={profile.name}
            >
              {profile.name}
            </h3>
            {profile.description && (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-400 leading-snug">
                {profile.description}
              </p>
            )}
          </div>

          <button
            type="button"
            title={profile.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
            onClick={handleFavoriteClick}
            disabled={isFavLoading}
            className="rounded-md p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-amber-400 transition-colors disabled:opacity-50 shrink-0"
          >
            <Star
              className={`h-4 w-4 transition-colors ${
                profile.isFavorite ? 'fill-amber-400 text-amber-400' : ''
              }`}
            />
          </button>
        </div>

        {/* Engine & IWAD Specs Badges */}
        <div className="mt-3 flex flex-col gap-1.5 text-xs font-mono">
          {/* Source Port */}
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Cpu className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="truncate text-[11px]">{profile.engineName || 'Default Port'}</span>
          </div>

          {/* Base IWAD */}
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Disc className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="truncate text-[11px]">{profile.iwadName || 'DOOM2.WAD'}</span>
          </div>

          {/* Active Mods Count */}
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Layers className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px]">
              {enabledModsCount} / {totalModsCount} mods active
            </span>
          </div>

          {/* Custom Params Indicator if present */}
          {argsText && (
            <div className="flex items-center gap-1.5 text-zinc-500">
              <Terminal className="h-3 w-3 shrink-0" />
              <span className="truncate text-[10px]" title={argsText}>
                {argsText}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: 1-Click Launch Button */}
      <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
        <span className="text-[10px] font-mono text-zinc-400 truncate">
          {profile.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : 'Ready'}
        </span>

        <motion.button
          whileTap={{ scale: 0.96 }}
          type="button"
          onClick={handleLaunch}
          disabled={isLaunching}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#dc2626] hover:bg-[#c02020] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white border border-red-500/30 transition-colors disabled:opacity-50"
        >
          {isLaunching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>STARTING</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>LAUNCH</span>
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};
