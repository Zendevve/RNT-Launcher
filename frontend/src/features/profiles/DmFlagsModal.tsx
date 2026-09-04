import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  CheckSquare,
  Square,
  RotateCcw,
  Copy,
  Check,
  Search,
  Terminal,
  ShieldAlert,
  Gamepad2,
  Cpu,
  Layers,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Tabs, TabItem } from '../../components/ui/Tabs';
import { Bitflag } from '../../types';

export const DMFLAGS_DATA: Bitflag[] = [
  { value: 1, name: 'DF_NO_HEALTH', description: 'No health items spawn in the map', category: 'Gameplay / Pickups' },
  { value: 2, name: 'DF_NO_ITEMS', description: 'No powerups or items spawn in the map', category: 'Gameplay / Pickups' },
  { value: 4, name: 'DF_WEAPONS_STAY', description: 'Weapons remain after being picked up (multiplayer)', category: 'Multiplayer / Pickups' },
  { value: 8, name: 'DF_FORCE_FALLING_HX', description: 'Enable Hexen-style falling damage', category: 'Physics / Damage' },
  { value: 16, name: 'DF_FORCE_FALLING_ZD', description: 'Enable ZDoom-style falling damage', category: 'Physics / Damage' },
  { value: 32, name: 'DF_SAME_LEVEL', description: 'Restart current map upon exit instead of advancing', category: 'Multiplayer / Match' },
  { value: 64, name: 'DF_SPAWN_FARTHEST', description: 'Spawn players farthest from other players', category: 'Multiplayer / Spawning' },
  { value: 128, name: 'DF_FORCE_RESPAWN', description: 'Force players to respawn automatically upon death', category: 'Multiplayer / Spawning' },
  { value: 256, name: 'DF_NO_ARMOR', description: 'No armor items spawn in the map', category: 'Gameplay / Pickups' },
  { value: 512, name: 'DF_NO_EXIT', description: 'Exiting the level is disabled (kills the player)', category: 'Multiplayer / Match' },
  { value: 1024, name: 'DF_INFINITE_AMMO', description: 'Weapons consume no ammunition', category: 'Weapons / Ammo' },
  { value: 2048, name: 'DF_NO_MONSTERS', description: 'No monsters spawn in the level', category: 'Monsters' },
  { value: 4096, name: 'DF_MONSTERS_RESPAWN', description: 'Monsters respawn a short time after being killed', category: 'Monsters' },
  { value: 8192, name: 'DF_ITEMS_RESPAWN', description: 'Items and pickups respawn after being collected', category: 'Gameplay / Pickups' },
  { value: 16384, name: 'DF_FAST_MONSTERS', description: 'Monsters move and attack with nightmare-like speed', category: 'Monsters' },
  { value: 32768, name: 'DF_NO_JUMP', description: 'Disable jumping', category: 'Movement / Physics' },
  { value: 65536, name: 'DF_NO_CROUCH', description: 'Disable crouching', category: 'Movement / Physics' },
  { value: 131072, name: 'DF_FORCE_FALLING_ST', description: 'Enable Strife-style falling damage', category: 'Physics / Damage' },
  { value: 262144, name: 'DF_NO_DOUBLE_AMMO', description: 'Disable double ammo drops in deathmatch', category: 'Weapons / Ammo' },
  { value: 524288, name: 'DF_COOP_DROP_ITEMS', description: 'Drop entire inventory when killed in cooperative mode', category: 'Multiplayer / Inventory' },
  { value: 1048576, name: 'DF_NO_RUN', description: 'Disable running / force walking speed', category: 'Movement / Physics' },
  { value: 2097152, name: 'DF_BARRELS_RESPAWN', description: 'Explosive barrels respawn after detonation', category: 'Gameplay / Spawning' },
  { value: 4194304, name: 'DF_NO_RESPAWN_SUPER', description: 'Super weapons (BFG, Soul Sphere) do not respawn', category: 'Weapons / Pickups' },
  { value: 16777216, name: 'DF_NO_FREELOOK', description: 'Disable mouse freelook / vertical aiming', category: 'Movement / View' },
  { value: 33554432, name: 'DF_NO_FOV', description: 'Disallow client-side FOV modifications', category: 'Movement / View' },
  { value: 67108864, name: 'DF_NO_COOP_WEAPON_SPAWN', description: 'Do not spawn extra multiplayer cooperative weapons', category: 'Multiplayer / Weapons' },
  { value: 134217728, name: 'DF_MAX_HEALTH', description: 'Players always spawn with maximum possible health', category: 'Multiplayer / Spawning' },
  { value: 268435456, name: 'DF_NO_CHECKPOINTS', description: 'Disable autosaves and level checkpoints', category: 'Gameplay / Saves' },
];

export const DMFLAGS2_DATA: Bitflag[] = [
  { value: 1, name: 'DF2_FORCE_RESPAWN', description: 'Force respawn immediately without delay', category: 'Multiplayer / Spawning' },
  { value: 2, name: 'DF2_YES_KEEPTEAMS', description: 'Retain team assignments across map changes', category: 'Multiplayer / Teams' },
  { value: 4, name: 'DF2_NO_RESPAWN_INVUL', description: 'Disable temporary invulnerability after respawn', category: 'Multiplayer / Spawning' },
  { value: 8, name: 'DF2_YES_LOSEFRAG', description: 'Subtract a frag upon dying or committing suicide', category: 'Multiplayer / Scoring' },
  { value: 16, name: 'DF2_YES_RESPAWN_SUPER', description: 'Allow super weapons and mega-powerups to respawn', category: 'Weapons / Pickups' },
  { value: 32, name: 'DF2_NO_DOUBLE_AMMO', description: "Do not give double ammo on skill 1 (I'm Too Young To Die) and 5 (Nightmare)", category: 'Weapons / Ammo' },
  { value: 64, name: 'DF2_YES_DOUBLEAMMO', description: 'Double all weapon ammo pickups in multiplayer', category: 'Weapons / Ammo' },
  { value: 128, name: 'DF2_NO_INTERMISSION', description: 'Skip level intermission score screen', category: 'Match / Flow' },
  { value: 256, name: 'DF2_NO_COOP_KEEP_INVENTORY', description: 'Co-op players lose inventory upon death', category: 'Multiplayer / Inventory' },
  { value: 512, name: 'DF2_YES_COOP_KEEP_KEYS', description: 'Co-op players retain keys when respawning', category: 'Multiplayer / Inventory' },
  { value: 1024, name: 'DF2_NO_TEAM_SELECT', description: 'Disable manual team selection by players', category: 'Multiplayer / Teams' },
  { value: 2048, name: 'DF2_NO_TEAM_SWITCHING', description: 'Prevent players from changing teams during a match', category: 'Multiplayer / Teams' },
  { value: 4096, name: 'DF2_NO_AUTOMAP', description: 'Disable the automap', category: 'Gameplay / Automap' },
  { value: 8192, name: 'DF2_NO_AUTOMAP_ALLIES', description: 'Do not display teammates on the automap', category: 'Gameplay / Automap' },
  { value: 16384, name: 'DF2_DISALLOW_SPYING', description: 'Disallow viewing other players through chasecam', category: 'Multiplayer / View' },
  { value: 32768, name: 'DF2_INFINITE_INVENTORY', description: 'Inventory items are never depleted upon use', category: 'Gameplay / Inventory' },
  { value: 65536, name: 'DF2_KILL_MONSTERS', description: 'Kill all remaining monsters when level is finished', category: 'Monsters' },
  { value: 131072, name: 'DF2_NO_RESPAWN', description: 'Disable respawning completely (sudden death elimination)', category: 'Multiplayer / Spawning' },
  { value: 262144, name: 'DF2_CHASECAM', description: 'Force all players into third-person chasecam', category: 'View' },
  { value: 524288, name: 'DF2_NOSUICIDE', description: 'Disallow player suicide / kill console command', category: 'Multiplayer / Rules' },
  { value: 1048576, name: 'DF2_NOAUTOAIM', description: 'Disable vertical autoaiming for weapons', category: 'Weapons / Aim' },
  { value: 2097152, name: 'DF2_DONTCHECKAMMO', description: 'Allow firing weapons even when out of ammo', category: 'Weapons / Ammo' },
  { value: 4194304, name: 'DF2_KILLALLMONSTERS', description: 'Kill all level monsters when a boss monster is slain', category: 'Monsters' },
  { value: 8388608, name: 'DF2_COOP_RAD', description: 'Radiation suits protect all cooperative teammates', category: 'Multiplayer / Inventory' },
  { value: 16777216, name: 'DF2_SAME_SPAWN_SPOT', description: 'Respawn players exactly where they were killed', category: 'Multiplayer / Spawning' },
];

export const COMPATFLAGS_DATA: Bitflag[] = [
  { value: 1, name: 'COMPATF_SHORTTEX', description: 'Find shortest textures like vanilla Doom', category: 'Rendering / Textures' },
  { value: 2, name: 'COMPATF_STAIRS', description: 'Stair-building does not exceed matching adjacent line height', category: 'Physics / Geometry' },
  { value: 4, name: 'COMPATF_LIMITPAIN', description: 'Limit Pain Elementals from spawning more than 21 Lost Souls', category: 'Monsters' },
  { value: 8, name: 'COMPATF_SILENTPICKUP', description: 'Do not play pickup sound when player cannot pick up item', category: 'Audio / Pickups' },
  { value: 16, name: 'COMPATF_NO_PASSMOBJ', description: 'Actors are infinitely tall (no 3D walking over/under monsters)', category: 'Physics / Clipping' },
  { value: 32, name: 'COMPATF_MAGICSILENCE', description: 'Quiet A_Pain sound / silent Lost Soul spawning quirks', category: 'Audio / Monsters' },
  { value: 64, name: 'COMPATF_WALLRUN', description: 'Enable original vanilla wall-running acceleration physics', category: 'Physics / Movement' },
  { value: 128, name: 'COMPATF_NOTOSSDROPS', description: 'Spawn dropped items without horizontal toss velocity', category: 'Physics / Drops' },
  { value: 256, name: 'COMPATF_USEBLOCKING', description: 'Special linedefs block use actions across adjacent lines', category: 'Interactions' },
  { value: 512, name: 'COMPATF_NODOORLIGHT', description: 'Door sectors do not copy neighboring light levels', category: 'Rendering / Lighting' },
  { value: 1024, name: 'COMPATF_RAVIOLI', description: 'Raven software scrolling wall calculation direction', category: 'Physics / Geometry' },
  { value: 2048, name: 'COMPATF_DEHHEALTH', description: 'Apply DeHackEd max health limit to health bonus pickups', category: 'Gameplay / DeHackEd' },
  { value: 4096, name: 'COMPATF_TRACE', description: 'Trace sightlines ignore translucent line specials', category: 'Physics / Tracing' },
  { value: 8192, name: 'COMPATF_DROPOFF', description: 'Monsters cannot walk off steep drop-offs or ledges', category: 'Monsters / AI' },
  { value: 16384, name: 'COMPATF_BOOMSCROLL', description: 'Apply Boom scrolling wall and floor friction behavior', category: 'Physics / Geometry' },
  { value: 32768, name: 'COMPATF_INVISIBILITY', description: 'Original Doom partial invisibility calculation against hitscans', category: 'Rendering / Monsters' },
  { value: 65536, name: 'COMPATF_SILENT_INSTANT_FLOORS', description: 'Instant-moving floors make no continuous sound', category: 'Physics / Geometry' },
  { value: 131072, name: 'COMPATF_SECTORSOUNDS', description: 'Sector action sounds originate from sector geometric center', category: 'Audio' },
  { value: 262144, name: 'COMPATF_MISSILECLIP', description: 'Vanilla Doom projectile clipping and hit detection bug', category: 'Physics / Projectiles' },
  { value: 524288, name: 'COMPATF_CROSSDROPOFF', description: 'Monsters refuse to walk across steep floor height changes', category: 'Monsters / AI' },
  { value: 1048576, name: 'COMPATF_ANYBOSSDEATH', description: 'Any boss death triggers level special 666 / 667', category: 'Map Actions / Triggers' },
  { value: 2097152, name: 'COMPATF_MINOTAUR', description: 'Heretic Minotaur charge bounce behavior quirks', category: 'Monsters / AI' },
  { value: 4194304, name: 'COMPATF_MUSHROOM', description: 'Original A_Mushroom projectile spread behavior', category: 'Weapons / Physics' },
  { value: 8388608, name: 'COMPATF_MBFMONSTER_MOVE', description: 'MBF monster bounce and landing movement physics', category: 'Monsters / AI' },
  { value: 16777216, name: 'COMPATF_CORPSESTAY', description: 'Original multiplayer corpse persistence behavior', category: 'Monsters / Multi' },
  { value: 33554432, name: 'COMPATF_SHARE_KEYS', description: 'Keys acquired by one player are shared by all in co-op', category: 'Multiplayer / Inventory' },
  { value: 67108864, name: 'COMPATF_HITSCAN', description: 'Hitscan attacks ignore non-solid decorations', category: 'Physics / Tracing' },
  { value: 134217728, name: 'COMPATF_LIGHT', description: 'Vanilla light diminishing with distance formula', category: 'Rendering / Lighting' },
  { value: 268435456, name: 'COMPATF_POLYOBJ', description: 'Polyobjects do not carry actors along with them', category: 'Physics / Geometry' },
  { value: 536870912, name: 'COMPATF_MASKEDMIDTEX', description: 'Render 2-sided masked midtextures with vanilla Doom behavior', category: 'Rendering / Textures' },
];

export const COMPATFLAGS2_DATA: Bitflag[] = [
  { value: 1, name: 'COMPATF2_BAD_DOOR_LIGHT', description: 'Original lighting bug for split sector doors', category: 'Rendering / Lighting' },
  { value: 2, name: 'COMPATF2_PUSHTHROUGH', description: 'Sector pushers and pullers affect actors through walls', category: 'Physics / Pushers' },
  { value: 4, name: 'COMPATF2_NOCLOSETLIGHT', description: 'Monster closets do not cast light into outer map sectors', category: 'Rendering / Lighting' },
  { value: 8, name: 'COMPATF2_CHECKPRG', description: 'Check PRG files for script variables', category: 'Scripting' },
  { value: 16, name: 'COMPATF2_EXPLODE_EXPLODE', description: 'Explosive thrust affects other active explosions', category: 'Physics / Damage' },
  { value: 32, name: 'COMPATF2_NO_STRIP_ITEMS', description: 'Retain collected items across hub episode transitions', category: 'Gameplay / Hubs' },
  { value: 64, name: 'COMPATF2_FULL_INFIGHTING', description: 'Monsters of the exact same species can damage each other', category: 'Monsters / AI' },
  { value: 128, name: 'COMPATF2_NO_FREE_AIM', description: 'Disable free pitch aiming on hitscan weapons', category: 'Weapons / Aim' },
  { value: 256, name: 'COMPATF2_NO_LANDING_TELEPORT', description: 'Falling actors do not trigger teleporters upon impact', category: 'Physics / Teleports' },
];

export function computeBitmask(values: Set<number> | number[]): number {
  let mask = 0;
  for (const v of values) {
    mask = (mask | v) >>> 0;
  }
  return mask;
}

export function parseBitmask(mask: number, flags: Bitflag[]): Set<number> {
  const result = new Set<number>();
  for (const f of flags) {
    if (f.value !== 0 && (mask & f.value) === f.value) {
      result.add(f.value);
    }
  }
  return result;
}

export function toHex(val: number): string {
  return '0x' + (val >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export interface DmFlagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingArgs?: string[];
  initialArguments?: string[];
  initialFlags?: {
    dmflags?: number;
    dmflags2?: number;
    compatflags?: number;
    compatflags2?: number;
  };
  onApply: (generatedArgs: string[]) => void;
}

type TabType = 'dmflags' | 'dmflags2' | 'compatflags' | 'compatflags2';

export const DmFlagsModal: React.FC<DmFlagsModalProps> = ({
  isOpen,
  onClose,
  existingArgs,
  initialArguments = [],
  initialFlags,
  onApply,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('dmflags');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const argsToUse = existingArgs ?? initialArguments;

  // Selections stored as Sets of flag bit values
  const [selectedDmflags, setSelectedDmflags] = useState<Set<number>>(new Set());
  const [selectedDmflags2, setSelectedDmflags2] = useState<Set<number>>(new Set());
  const [selectedCompatflags, setSelectedCompatflags] = useState<Set<number>>(new Set());
  const [selectedCompatflags2, setSelectedCompatflags2] = useState<Set<number>>(new Set());

  // Helper to extract flags from CLI argument list
  const extractFlagFromArgs = (args: string[], flagName: string): number => {
    for (let i = 0; i < args.length; i++) {
      const current = args[i].toLowerCase();
      // Supports both '+set dmflags 123' and '+dmflags 123'
      if ((current === '+set' && args[i + 1]?.toLowerCase() === flagName) || current === `+${flagName}`) {
        const valueIndex = current === '+set' ? i + 2 : i + 1;
        const val = parseInt(args[valueIndex], 10);
        if (!isNaN(val)) return val;
      }
      // Supports '+set dmflags=123' or 'dmflags=123'
      if (current.startsWith(`+set ${flagName}=`) || current.startsWith(`${flagName}=`)) {
        const parts = current.split('=');
        const val = parseInt(parts[1], 10);
        if (!isNaN(val)) return val;
      }
    }
    return 0;
  };

  // Initialize flags on open
  useEffect(() => {
    if (!isOpen) return;

    let d1 = initialFlags?.dmflags ?? 0;
    let d2 = initialFlags?.dmflags2 ?? 0;
    let c1 = initialFlags?.compatflags ?? 0;
    let c2 = initialFlags?.compatflags2 ?? 0;

    if (argsToUse.length > 0) {
      if (d1 === 0) d1 = extractFlagFromArgs(argsToUse, 'dmflags');
      if (d2 === 0) d2 = extractFlagFromArgs(argsToUse, 'dmflags2');
      if (c1 === 0) c1 = extractFlagFromArgs(argsToUse, 'compatflags');
      if (c2 === 0) c2 = extractFlagFromArgs(argsToUse, 'compatflags2');
    }

    setSelectedDmflags(parseBitmask(d1, DMFLAGS_DATA));
    setSelectedDmflags2(parseBitmask(d2, DMFLAGS2_DATA));
    setSelectedCompatflags(parseBitmask(c1, COMPATFLAGS_DATA));
    setSelectedCompatflags2(parseBitmask(c2, COMPATFLAGS2_DATA));
    setSearchQuery('');
  }, [isOpen, argsToUse, initialFlags]);

  // Computed integer values
  const dmflagsValue = useMemo(() => computeBitmask(selectedDmflags), [selectedDmflags]);
  const dmflags2Value = useMemo(() => computeBitmask(selectedDmflags2), [selectedDmflags2]);
  const compatflagsValue = useMemo(() => computeBitmask(selectedCompatflags), [selectedCompatflags]);
  const compatflags2Value = useMemo(() => computeBitmask(selectedCompatflags2), [selectedCompatflags2]);

  // Active dataset & selection accessors
  const { currentData, currentSelection, setCurrentSelection } = useMemo(() => {
    switch (activeTab) {
      case 'dmflags':
        return {
          currentData: DMFLAGS_DATA,
          currentSelection: selectedDmflags,
          setCurrentSelection: setSelectedDmflags,
        };
      case 'dmflags2':
        return {
          currentData: DMFLAGS2_DATA,
          currentSelection: selectedDmflags2,
          setCurrentSelection: setSelectedDmflags2,
        };
      case 'compatflags':
        return {
          currentData: COMPATFLAGS_DATA,
          currentSelection: selectedCompatflags,
          setCurrentSelection: setSelectedCompatflags,
        };
      case 'compatflags2':
        return {
          currentData: COMPATFLAGS2_DATA,
          currentSelection: selectedCompatflags2,
          setCurrentSelection: setSelectedCompatflags2,
        };
    }
  }, [activeTab, selectedDmflags, selectedDmflags2, selectedCompatflags, selectedCompatflags2]);

  // Filter items by search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return currentData;
    const q = searchQuery.toLowerCase();
    return currentData.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.value.toString().includes(q) ||
        toHex(f.value).toLowerCase().includes(q)
    );
  }, [currentData, searchQuery]);

  // Group filtered items by category
  const categorizedData = useMemo(() => {
    const map = new Map<string, Bitflag[]>();
    for (const flag of filteredData) {
      const list = map.get(flag.category) || [];
      list.push(flag);
      map.set(flag.category, list);
    }
    return map;
  }, [filteredData]);

  // Toggle single flag
  const toggleFlag = (val: number) => {
    setCurrentSelection((prev) => {
      const next = new Set(prev);
      if (next.has(val)) {
        next.delete(val);
      } else {
        next.add(val);
      }
      return next;
    });
  };

  // Quick actions
  const selectAllCurrentTab = () => {
    setCurrentSelection(new Set(currentData.map((f) => f.value)));
  };

  const clearCurrentTab = () => {
    setCurrentSelection(new Set());
  };

  const clearAllTabs = () => {
    setSelectedDmflags(new Set());
    setSelectedDmflags2(new Set());
    setSelectedCompatflags(new Set());
    setSelectedCompatflags2(new Set());
  };

  // Generated CLI arguments: only non-zero values
  const generatedArgs = useMemo(() => {
    const args: string[] = [];
    if (dmflagsValue > 0) args.push('+set', 'dmflags', dmflagsValue.toString());
    if (dmflags2Value > 0) args.push('+set', 'dmflags2', dmflags2Value.toString());
    if (compatflagsValue > 0) args.push('+set', 'compatflags', compatflagsValue.toString());
    if (compatflags2Value > 0) args.push('+set', 'compatflags2', compatflags2Value.toString());
    return args;
  }, [dmflagsValue, dmflags2Value, compatflagsValue, compatflags2Value]);

  const commandLineString = useMemo(() => {
    if (generatedArgs.length === 0) return '';
    return generatedArgs.join(' ');
  }, [generatedArgs]);

  const handleCopyCommand = async () => {
    if (!commandLineString) return;
    try {
      await navigator.clipboard.writeText(commandLineString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleApply = () => {
    onApply(generatedArgs);
    onClose();
  };

  const activeFlagsCount =
    (dmflagsValue > 0 ? 1 : 0) +
    (dmflags2Value > 0 ? 1 : 0) +
    (compatflagsValue > 0 ? 1 : 0) +
    (compatflags2Value > 0 ? 1 : 0);

  const tabsConfig: TabItem[] = [
    {
      id: 'dmflags',
      label: 'DMFlags (Gameplay)',
      icon: <Gamepad2 className="w-4 h-4" />,
      badge: selectedDmflags.size > 0 ? selectedDmflags.size : undefined,
      badgeVariant: 'primary',
    },
    {
      id: 'dmflags2',
      label: 'DMFlags2 (Extended)',
      icon: <Layers className="w-4 h-4" />,
      badge: selectedDmflags2.size > 0 ? selectedDmflags2.size : undefined,
      badgeVariant: 'primary',
    },
    {
      id: 'compatflags',
      label: 'CompatFlags (Engine Compatibility)',
      icon: <Cpu className="w-4 h-4" />,
      badge: selectedCompatflags.size > 0 ? selectedCompatflags.size : undefined,
      badgeVariant: 'primary',
    },
    {
      id: 'compatflags2',
      label: 'CompatFlags2 (Port Nuances)',
      icon: <ShieldAlert className="w-4 h-4" />,
      badge: selectedCompatflags2.size > 0 ? selectedCompatflags2.size : undefined,
      badgeVariant: 'primary',
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      title={
        <div className="flex items-center gap-2.5">
          <span className="rounded-[8px] bg-[#0c0c0f] border border-[#2d2d34] p-1.5 text-[#5e7ce2]">
            <Sliders className="h-4 w-4" />
          </span>
          <span>ZDoom Flags & Compatibility Calculator</span>
        </div>
      }
      description="Select flags to calculate bitfield integer values for multiplayer rules, physics, and vanilla engine compatibility."
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearAllTabs}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Clear All
            </Button>
            {commandLineString && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCommand}
                className="font-mono text-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1 text-green-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? 'Copied' : 'Copy CLI'}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleApply}>
              Apply Flags ({activeFlagsCount} active)
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 max-h-[72vh]">
        {/* Navigation Tabs */}
        <Tabs
          tabs={tabsConfig}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabType)}
          variant="pills"
          size="sm"
        />

        {/* Filter and Quick Action Toolbar */}
        <div className="flex items-center justify-between gap-3 bg-doom-surface/60 p-2.5 rounded-lg border border-doom-border">
          <div className="flex-1 max-w-md">
            <Input
              type="text"
              placeholder="Filter flags by name, description, or hex..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={selectAllCurrentTab}>
              <CheckSquare className="w-3.5 h-3.5 mr-1" />
              Select Tab
            </Button>
            <Button variant="ghost" size="sm" onClick={clearCurrentTab}>
              <Square className="w-3.5 h-3.5 mr-1" />
              Clear Tab
            </Button>
          </div>
        </div>

        {/* Flag Checkbox Grid Grouped by Category */}
        <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-5 min-h-[300px]">
          {filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-doom-muted text-sm text-center">
              <Sliders className="w-8 h-8 mb-2 opacity-40" />
              <p>No flags match &quot;{searchQuery}&quot;</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => setSearchQuery('')}
              >
                Clear filter
              </Button>
            </div>
          ) : (
            Array.from(categorizedData.entries()).map(([category, flags]) => {
              const allCategorySelected = flags.every((f) => currentSelection.has(f.value));

              return (
                <div key={category} className="flex flex-col gap-2.5">
                  {/* Category Header */}
                  <div className="flex items-center justify-between border-b border-doom-border/60 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-doom-accent">
                        {category}
                      </span>
                      <span className="text-[11px] font-mono text-doom-muted">
                        ({flags.filter((f) => currentSelection.has(f.value)).length}/{flags.length})
                      </span>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] text-doom-muted hover:text-doom-text underline font-mono"
                      onClick={() => {
                        setCurrentSelection((prev) => {
                          const next = new Set(prev);
                          if (allCategorySelected) {
                            flags.forEach((f) => next.delete(f.value));
                          } else {
                            flags.forEach((f) => next.add(f.value));
                          }
                          return next;
                        });
                      }}
                    >
                      {allCategorySelected ? 'Deselect Category' : 'Select Category'}
                    </button>
                  </div>

                  {/* Flag Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {flags.map((flag) => {
                      const isChecked = currentSelection.has(flag.value);
                      return (
                        <div
                          key={flag.name}
                          onClick={() => toggleFlag(flag.value)}
                          className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                            isChecked
                              ? 'bg-doom-accent/10 border-doom-accent/50 text-doom-text shadow-sm'
                              : 'bg-doom-surface/40 border-doom-border/50 text-doom-muted hover:bg-doom-surface hover:text-doom-text'
                          }`}
                        >
                          <div className="pt-0.5 shrink-0">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-doom-accent" />
                            ) : (
                              <Square className="w-4 h-4 text-doom-muted/60" />
                            )}
                          </div>
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-xs font-mono font-bold truncate ${
                                  isChecked ? 'text-doom-accent' : 'text-doom-text'
                                }`}
                              >
                                {flag.name}
                              </span>
                              <Badge
                                variant={isChecked ? 'primary' : 'outline'}
                                className="font-mono text-[10px] px-1.5 py-0 shrink-0"
                              >
                                {toHex(flag.value)}
                              </Badge>
                            </div>
                            <p className="text-xs text-doom-muted leading-relaxed">
                              {flag.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Live Summary Bar: Integer values, Hex representations, CLI Output */}
        <div className="border-t border-doom-border pt-3 flex flex-col gap-2.5 bg-doom-bg/80 p-3 rounded-lg border">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-doom-muted uppercase tracking-wider font-semibold">
              Live Computed Values:
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-doom-muted font-mono">dmflags:</span>
                <span className="text-doom-accent font-bold">{dmflagsValue}</span>
                <span className="text-[11px] text-doom-muted">({toHex(dmflagsValue)})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-doom-muted font-mono">dmflags2:</span>
                <span className="text-cyan-400 font-bold">{dmflags2Value}</span>
                <span className="text-[11px] text-doom-muted">({toHex(dmflags2Value)})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-doom-muted font-mono">compatflags:</span>
                <span className="text-amber-400 font-bold">{compatflagsValue}</span>
                <span className="text-[11px] text-doom-muted">({toHex(compatflagsValue)})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-doom-muted font-mono">compatflags2:</span>
                <span className="text-purple-400 font-bold">{compatflags2Value}</span>
                <span className="text-[11px] text-doom-muted">({toHex(compatflags2Value)})</span>
              </div>
            </div>
          </div>

          {/* CLI Arguments Output Preview */}
          <div className="flex items-center gap-2 bg-doom-surface/90 px-3 py-2 rounded border border-doom-border text-xs font-mono">
            <Terminal className="w-4 h-4 text-doom-accent shrink-0" />
            <div className="flex-1 overflow-x-auto whitespace-nowrap text-doom-text">
              {commandLineString ? (
                <span className="text-green-300 font-semibold">{commandLineString}</span>
              ) : (
                <span className="text-doom-muted italic">
                  No flags active (engine standard defaults will apply)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
