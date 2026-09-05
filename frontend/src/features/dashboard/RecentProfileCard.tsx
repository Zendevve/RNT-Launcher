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

/**
 * Slate Framer — RecentProfileCard
 * - Card radius 12px, bg #0f0f12 / hover #0c0c0f, border #2d2d34
 * - Button bg #0f0f12 / #0c0c0f, radius 14px/32px, padding 8px 14px 8px 18px
 * - Text #f4f4f5 / #a1a1aa / #71717a, accent #5e7ce2, Geist 500, motion 0.001s ease
 */
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
      className="group relative flex flex-col justify-between rounded-[12px] border border-[#2d2d34] bg-[#0f0f12] hover:bg-[#0c0c0f] hover:border-[#3a3a44] p-4 transition-[background-color,border-color] duration-[0.001s] ease-[ease] cursor-pointer select-none"
    >
      <div>
        {/* Header: Title and Star */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3
              className="text-sm font-[500] text-[#f4f4f5] group-hover:text-white truncate [font-family:var(--font-geist),Geist,sans-serif] tracking-tight"
              title={profile.name}
            >
              {profile.name}
            </h3>
            {profile.description && (
              <p
                className="text-xs text-[#a1a1aa] truncate mt-0.5 font-[500] [font-family:var(--font-geist),Geist,sans-serif]"
                title={profile.description}
              >
                {profile.description}
              </p>
            )}
          </div>

          <button
            type="button"
            title={profile.isFavorite ? 'Remove favorite' : 'Add to favorites'}
            onClick={handleFavoriteClick}
            disabled={isFavLoading}
            className="text-[#71717a] hover:text-[#5e7ce2] p-1 rounded-[8px] hover:bg-[#0c0c0f] transition-[color,background-color] duration-[0.001s] ease-[ease] shrink-0"
          >
            <Star
              className={cn(
                'w-4 h-4 transition-[color] duration-[0.001s] ease-[ease]',
                profile.isFavorite ? 'fill-[#5e7ce2] text-[#5e7ce2]' : 'text-[#71717a]'
              )}
            />
          </button>
        </div>

        {/* Engine & IWAD Specs */}
        <div className="mt-3 flex flex-col gap-1 text-xs text-[#a1a1aa] font-[500] [font-family:var(--font-geist),Geist,sans-serif]">
          <div className="flex items-center gap-1.5 truncate">
            <Cpu className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
            <span className="truncate text-[#a1a1aa]">{profile.engineName || 'No Port Configured'}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <Disc className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
            <span className="truncate text-[#a1a1aa]">{profile.iwadName || 'No IWAD Configured'}</span>
          </div>
        </div>
      </div>

      {/* Footer: Mod count & Launch CTA */}
      <div className="mt-4 pt-3 border-t border-[#2d2d34] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-[#71717a] font-[500] [font-family:var(--font-geist),Geist,sans-serif]">
          <Layers className="w-3.5 h-3.5 text-[#71717a]" />
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
            className="p-1.5 text-[#71717a] hover:text-[#f4f4f5] rounded-[8px] hover:bg-[#0c0c0f] transition-[color,background-color] duration-[0.001s] ease-[ease]"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleLaunch}
            disabled={isLaunching}
            className="inline-flex items-center gap-1.5 rounded-[14px] bg-[#0f0f12] hover:bg-[#0c0c0f] text-[#f4f4f5] border border-[#2d2d34] hover:border-[#3a3a44] pt-[8px] pr-[14px] pb-[8px] pl-[18px] text-xs font-[500] transition-[background-color,color,border-color] duration-[0.001s] ease-[ease] disabled:opacity-50 [font-family:var(--font-geist),Geist,sans-serif]"
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
