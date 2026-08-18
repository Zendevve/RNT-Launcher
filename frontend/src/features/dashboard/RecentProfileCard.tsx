import React, { useState } from 'react';
import { Play, Star, Disc, Cpu, Layers, Terminal, Loader2, CheckCircle2 } from 'lucide-react';
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
    <div
      onClick={() => onSelectProfile?.(profile.id)}
      className="group relative flex flex-col justify-between rounded-lg border border-doom-border bg-doom-surface/80 p-4 transition-all duration-200 hover:border-doom-border-bright hover:bg-doom-surface hover:shadow-lg hover:shadow-black/40 cursor-pointer"
    >
      {/* Top row: Title and Favorite Toggle */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-mono text-base font-semibold text-doom-text group-hover:text-white">
                {profile.name}
              </h3>
              {profile.isFavorite && (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-doom-amber/15 text-doom-amber border border-doom-amber/30">
                  Fav
                </span>
              )}
            </div>
            {profile.description ? (
              <p className="mt-1 line-clamp-1 text-xs text-doom-muted">{profile.description}</p>
            ) : (
              <p className="mt-1 text-xs italic text-doom-muted/60">No description</p>
            )}
          </div>

          <button
            type="button"
            title={profile.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={handleFavoriteClick}
            disabled={isFavLoading}
            className="rounded p-1 text-doom-muted transition-colors hover:bg-doom-card hover:text-doom-amber disabled:opacity-50"
          >
            <Star
              className={`h-4 w-4 transition-colors ${
                profile.isFavorite ? 'fill-doom-amber text-doom-amber' : ''
              }`}
            />
          </button>
        </div>

        {/* Status Indicators Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          {/* Engine */}
          <div className="flex items-center gap-1.5 rounded bg-doom-card/80 px-2 py-1.5 text-doom-muted">
            <Cpu className="h-3.5 w-3.5 shrink-0 text-doom-cyan" />
            <span className="truncate font-mono text-[11px] text-doom-text">
              {profile.engineName || 'No Engine'}
            </span>
          </div>

          {/* IWAD */}
          <div className="flex items-center gap-1.5 rounded bg-doom-card/80 px-2 py-1.5 text-doom-muted">
            <Disc className="h-3.5 w-3.5 shrink-0 text-doom-blue" />
            <span className="truncate font-mono text-[11px] text-doom-text">
              {profile.iwadName || 'No IWAD'}
            </span>
          </div>

          {/* Mod Count */}
          <div className="flex items-center gap-1.5 rounded bg-doom-card/80 px-2 py-1.5 text-doom-muted">
            <Layers className="h-3.5 w-3.5 shrink-0 text-doom-amber" />
            <span className="font-mono text-[11px] text-doom-text">
              {totalModsCount === 0
                ? 'Vanilla'
                : `${enabledModsCount}${
                    enabledModsCount !== totalModsCount ? `/${totalModsCount}` : ''
                  } ${totalModsCount === 1 ? 'Mod' : 'Mods'}`}
            </span>
          </div>

          {/* Arguments Badge */}
          <div className="flex items-center gap-1.5 rounded bg-doom-card/80 px-2 py-1.5 text-doom-muted">
            <Terminal className="h-3.5 w-3.5 shrink-0 text-doom-text/60" />
            <span className="truncate font-mono text-[11px] text-doom-muted">
              {profile.arguments && profile.arguments.length > 0
                ? `${profile.arguments.length} args`
                : 'Default args'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Row: 1-Click Launch Button */}
      <div className="mt-4 pt-3 border-t border-doom-border/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-doom-muted">
          <CheckCircle2 className="h-3.5 w-3.5 text-doom-green" />
          <span>Ready to launch</span>
        </div>

        <button
          type="button"
          onClick={handleLaunch}
          disabled={isLaunching}
          className="relative inline-flex items-center justify-center gap-2 rounded bg-doom-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-doom-red/20 transition-all hover:bg-doom-red-bright hover:shadow-doom-red/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLaunching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>LAUNCHING...</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>PLAY</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
