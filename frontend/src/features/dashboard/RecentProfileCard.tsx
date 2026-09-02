import React, { useState } from 'react';
import { Play, Star, Disc, Cpu, Layers, Loader2, ArrowUpRight } from 'lucide-react';
import { Profile } from '../../types';
import { cn } from '../../utils/cn';

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

  const activeModsCount = profile.mods?.filter((m) => m.enabled).length || 0;
  const totalModsCount = profile.mods?.length || 0;

  const handleLaunch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLaunching) return;
    setIsLaunching(true);
    try {
      await onLaunch(profile.id);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFavLoading) return;
    setIsFavLoading(true);
    try {
      await onToggleFavorite(profile.id);
    } finally {
      setIsFavLoading(false);
    }
  };

  return (
    <div
      onClick={() => onSelectProfile?.(profile.id)}
      className="group relative flex flex-col justify-between rounded-lg border border-[#22262d] bg-[#14171c] hover:bg-[#181c22] hover:border-[#2f3540] p-4 transition-colors duration-100 cursor-pointer select-none"
    >
      <div>
        {/* Header: Title and Star */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-white truncate" title={profile.name}>
              {profile.name}
            </h3>
            {profile.description && (
              <p className="text-xs text-zinc-400 truncate mt-0.5" title={profile.description}>
                {profile.description}
              </p>
            )}
          </div>

          <button
            type="button"
            title={profile.isFavorite ? 'Remove favorite' : 'Add to favorites'}
            onClick={handleFavoriteClick}
            disabled={isFavLoading}
            className="text-zinc-500 hover:text-amber-400 p-1 rounded hover:bg-white/[0.04] transition-colors shrink-0"
          >
            <Star
              className={cn(
                'w-4 h-4 transition-colors',
                profile.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-zinc-500'
              )}
            />
          </button>
        </div>

        {/* Engine & IWAD Specs */}
        <div className="mt-3 flex flex-col gap-1 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5 truncate">
            <Cpu className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="truncate">{profile.engineName || 'No Port Configured'}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <Disc className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="truncate">{profile.iwadName || 'No IWAD Configured'}</span>
          </div>
        </div>
      </div>

      {/* Footer: Mod count & Launch CTA */}
      <div className="mt-4 pt-3 border-t border-[#22262d] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Layers className="w-3.5 h-3.5 text-zinc-500" />
          <span>
            {totalModsCount === 0 ? 'Vanilla' : `${activeModsCount}/${totalModsCount} mods`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectProfile?.(profile.id);
            }}
            title="Configure setup"
            className="p-1.5 text-zinc-500 hover:text-zinc-200 rounded hover:bg-white/[0.04] transition-colors"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleLaunch}
            disabled={isLaunching}
            className="inline-flex items-center gap-1.5 rounded bg-[#dc2626] hover:bg-[#ef4444] px-3 py-1 text-xs font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isLaunching ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Running</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
