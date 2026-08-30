package domain

// Bitflag represents a single configurable engine bitflag with descriptive metadata.
type Bitflag struct {
	Value       uint64 `json:"value"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
}

// DMFlags represents standard ZDoom gameplay dmflags (CVAR: dmflags).
var DMFlags = []Bitflag{
	{Value: 1, Name: "DF_NO_HEALTH", Description: "No health items spawn in the map", Category: "Gameplay / Pickups"},
	{Value: 2, Name: "DF_NO_ITEMS", Description: "No powerups or items spawn in the map", Category: "Gameplay / Pickups"},
	{Value: 4, Name: "DF_WEAPONS_STAY", Description: "Weapons remain after being picked up (multiplayer)", Category: "Multiplayer / Pickups"},
	{Value: 8, Name: "DF_FORCE_FALLING_HX", Description: "Enable Hexen-style falling damage", Category: "Physics / Damage"},
	{Value: 16, Name: "DF_FORCE_FALLING_ZD", Description: "Enable ZDoom-style falling damage", Category: "Physics / Damage"},
	{Value: 32, Name: "DF_SAME_LEVEL", Description: "Restart current map upon exit instead of advancing", Category: "Multiplayer / Match"},
	{Value: 64, Name: "DF_SPAWN_FARTHEST", Description: "Spawn players farthest from other players", Category: "Multiplayer / Spawning"},
	{Value: 128, Name: "DF_FORCE_RESPAWN", Description: "Force players to respawn automatically upon death", Category: "Multiplayer / Spawning"},
	{Value: 256, Name: "DF_NO_ARMOR", Description: "No armor items spawn in the map", Category: "Gameplay / Pickups"},
	{Value: 512, Name: "DF_NO_EXIT", Description: "Exiting the level is disabled (kills the player)", Category: "Multiplayer / Match"},
	{Value: 1024, Name: "DF_INFINITE_AMMO", Description: "Weapons consume no ammunition", Category: "Weapons / Ammo"},
	{Value: 2048, Name: "DF_NO_MONSTERS", Description: "No monsters spawn in the level", Category: "Monsters"},
	{Value: 4096, Name: "DF_MONSTERS_RESPAWN", Description: "Monsters respawn a short time after being killed", Category: "Monsters"},
	{Value: 8192, Name: "DF_ITEMS_RESPAWN", Description: "Items and pickups respawn after being collected", Category: "Gameplay / Pickups"},
	{Value: 16384, Name: "DF_FAST_MONSTERS", Description: "Monsters move and attack with nightmare-like speed", Category: "Monsters"},
	{Value: 32768, Name: "DF_NO_JUMP", Description: "Disable jumping", Category: "Movement / Physics"},
	{Value: 65536, Name: "DF_NO_CROUCH", Description: "Disable crouching", Category: "Movement / Physics"},
	{Value: 131072, Name: "DF_FORCE_FALLING_ST", Description: "Enable Strife-style falling damage", Category: "Physics / Damage"},
	{Value: 262144, Name: "DF_NO_DOUBLE_AMMO", Description: "Disable double ammo drops in deathmatch", Category: "Weapons / Ammo"},
	{Value: 524288, Name: "DF_COOP_DROP_ITEMS", Description: "Drop entire inventory when killed in cooperative mode", Category: "Multiplayer / Inventory"},
	{Value: 1048576, Name: "DF_NO_RUN", Description: "Disable running / force walking speed", Category: "Movement / Physics"},
	{Value: 2097152, Name: "DF_BARRELS_RESPAWN", Description: "Explosive barrels respawn after detonation", Category: "Gameplay / Spawning"},
	{Value: 4194304, Name: "DF_NO_RESPAWN_SUPER", Description: "Super weapons (BFG, Soul Sphere) do not respawn", Category: "Weapons / Pickups"},
	{Value: 16777216, Name: "DF_NO_FREELOOK", Description: "Disable mouse freelook / vertical aiming", Category: "Movement / View"},
	{Value: 33554432, Name: "DF_NO_FOV", Description: "Disallow client-side FOV modifications", Category: "Movement / View"},
	{Value: 67108864, Name: "DF_NO_COOP_WEAPON_SPAWN", Description: "Do not spawn extra multiplayer cooperative weapons", Category: "Multiplayer / Weapons"},
	{Value: 134217728, Name: "DF_MAX_HEALTH", Description: "Players always spawn with maximum possible health", Category: "Multiplayer / Spawning"},
	{Value: 268435456, Name: "DF_NO_CHECKPOINTS", Description: "Disable autosaves and level checkpoints", Category: "Gameplay / Saves"},
}

// DMFlags2 represents extended ZDoom gameplay dmflags (CVAR: dmflags2).
var DMFlags2 = []Bitflag{
	{Value: 1, Name: "DF2_FORCE_RESPAWN", Description: "Force respawn immediately without delay", Category: "Multiplayer / Spawning"},
	{Value: 2, Name: "DF2_YES_KEEPTEAMS", Description: "Retain team assignments across map changes", Category: "Multiplayer / Teams"},
	{Value: 4, Name: "DF2_NO_RESPAWN_INVUL", Description: "Disable temporary invulnerability after respawn", Category: "Multiplayer / Spawning"},
	{Value: 8, Name: "DF2_YES_LOSEFRAG", Description: "Subtract a frag upon dying or committing suicide", Category: "Multiplayer / Scoring"},
	{Value: 16, Name: "DF2_YES_RESPAWN_SUPER", Description: "Allow super weapons and mega-powerups to respawn", Category: "Weapons / Pickups"},
	{Value: 32, Name: "DF2_NO_DOUBLE_AMMO", Description: "Do not give double ammo on skill 1 (I'm Too Young To Die) and 5 (Nightmare)", Category: "Weapons / Ammo"},
	{Value: 64, Name: "DF2_YES_DOUBLEAMMO", Description: "Double all weapon ammo pickups in multiplayer", Category: "Weapons / Ammo"},
	{Value: 128, Name: "DF2_NO_INTERMISSION", Description: "Skip level intermission score screen", Category: "Match / Flow"},
	{Value: 256, Name: "DF2_NO_COOP_KEEP_INVENTORY", Description: "Co-op players lose inventory upon death", Category: "Multiplayer / Inventory"},
	{Value: 512, Name: "DF2_YES_COOP_KEEP_KEYS", Description: "Co-op players retain keys when respawning", Category: "Multiplayer / Inventory"},
	{Value: 1024, Name: "DF2_NO_TEAM_SELECT", Description: "Disable manual team selection by players", Category: "Multiplayer / Teams"},
	{Value: 2048, Name: "DF2_NO_TEAM_SWITCHING", Description: "Prevent players from changing teams during a match", Category: "Multiplayer / Teams"},
	{Value: 4096, Name: "DF2_NO_AUTOMAP", Description: "Disable the automap", Category: "Gameplay / Automap"},
	{Value: 8192, Name: "DF2_NO_AUTOMAP_ALLIES", Description: "Do not display teammates on the automap", Category: "Gameplay / Automap"},
	{Value: 16384, Name: "DF2_DISALLOW_SPYING", Description: "Disallow viewing other players through chasecam", Category: "Multiplayer / View"},
	{Value: 32768, Name: "DF2_INFINITE_INVENTORY", Description: "Inventory items are never depleted upon use", Category: "Gameplay / Inventory"},
	{Value: 65536, Name: "DF2_KILL_MONSTERS", Description: "Kill all remaining monsters when level is finished", Category: "Monsters"},
	{Value: 131072, Name: "DF2_NO_RESPAWN", Description: "Disable respawning completely (sudden death elimination)", Category: "Multiplayer / Spawning"},
	{Value: 262144, Name: "DF2_CHASECAM", Description: "Force all players into third-person chasecam", Category: "View"},
	{Value: 524288, Name: "DF2_NOSUICIDE", Description: "Disallow player suicide / kill console command", Category: "Multiplayer / Rules"},
	{Value: 1048576, Name: "DF2_NOAUTOAIM", Description: "Disable vertical autoaiming for weapons", Category: "Weapons / Aim"},
	{Value: 2097152, Name: "DF2_DONTCHECKAMMO", Description: "Allow firing weapons even when out of ammo", Category: "Weapons / Ammo"},
	{Value: 4194304, Name: "DF2_KILLALLMONSTERS", Description: "Kill all level monsters when a boss monster is slain", Category: "Monsters"},
	{Value: 8388608, Name: "DF2_COOP_RAD", Description: "Radiation suits protect all cooperative teammates", Category: "Multiplayer / Inventory"},
	{Value: 16777216, Name: "DF2_SAME_SPAWN_SPOT", Description: "Respawn players exactly where they were killed", Category: "Multiplayer / Spawning"},
}

// CompatFlags represents ZDoom vanilla compatibility flags (CVAR: compatflags).
var CompatFlags = []Bitflag{
	{Value: 1, Name: "COMPATF_SHORTTEX", Description: "Find shortest textures like vanilla Doom", Category: "Rendering / Textures"},
	{Value: 2, Name: "COMPATF_STAIRS", Description: "Stair-building does not exceed matching adjacent line height", Category: "Physics / Geometry"},
	{Value: 4, Name: "COMPATF_LIMITPAIN", Description: "Limit Pain Elementals from spawning more than 21 Lost Souls", Category: "Monsters"},
	{Value: 8, Name: "COMPATF_SILENTPICKUP", Description: "Do not play pickup sound when player cannot pick up item", Category: "Audio / Pickups"},
	{Value: 16, Name: "COMPATF_NO_PASSMOBJ", Description: "Actors are infinitely tall (no 3D walking over/under monsters)", Category: "Physics / Clipping"},
	{Value: 32, Name: "COMPATF_MAGICSILENCE", Description: "Quiet A_Pain sound / silent Lost Soul spawning quirks", Category: "Audio / Monsters"},
	{Value: 64, Name: "COMPATF_WALLRUN", Description: "Enable original vanilla wall-running acceleration physics", Category: "Physics / Movement"},
	{Value: 128, Name: "COMPATF_NOTOSSDROPS", Description: "Spawn dropped items without horizontal toss velocity", Category: "Physics / Drops"},
	{Value: 256, Name: "COMPATF_USEBLOCKING", Description: "Special linedefs block use actions across adjacent lines", Category: "Interactions"},
	{Value: 512, Name: "COMPATF_NODOORLIGHT", Description: "Door sectors do not copy neighboring light levels", Category: "Rendering / Lighting"},
	{Value: 1024, Name: "COMPATF_RAVIOLI", Description: "Raven software scrolling wall calculation direction", Category: "Physics / Geometry"},
	{Value: 2048, Name: "COMPATF_DEHHEALTH", Description: "Apply DeHackEd max health limit to health bonus pickups", Category: "Gameplay / DeHackEd"},
	{Value: 4096, Name: "COMPATF_TRACE", Description: "Trace sightlines ignore translucent line specials", Category: "Physics / Tracing"},
	{Value: 8192, Name: "COMPATF_DROPOFF", Description: "Monsters cannot walk off steep drop-offs or ledges", Category: "Monsters / AI"},
	{Value: 16384, Name: "COMPATF_BOOMSCROLL", Description: "Apply Boom scrolling wall and floor friction behavior", Category: "Physics / Geometry"},
	{Value: 32768, Name: "COMPATF_INVISIBILITY", Description: "Original Doom partial invisibility calculation against hitscans", Category: "Rendering / Monsters"},
	{Value: 65536, Name: "COMPATF_SILENT_INSTANT_FLOORS", Description: "Instant-moving floors make no continuous sound", Category: "Physics / Geometry"},
	{Value: 131072, Name: "COMPATF_SECTORSOUNDS", Description: "Sector action sounds originate from sector geometric center", Category: "Audio"},
	{Value: 262144, Name: "COMPATF_MISSILECLIP", Description: "Vanilla Doom projectile clipping and hit detection bug", Category: "Physics / Projectiles"},
	{Value: 524288, Name: "COMPATF_CROSSDROPOFF", Description: "Monsters refuse to walk across steep floor height changes", Category: "Monsters / AI"},
	{Value: 1048576, Name: "COMPATF_ANYBOSSDEATH", Description: "Any boss death triggers level special 666 / 667", Category: "Map Actions / Triggers"},
	{Value: 2097152, Name: "COMPATF_MINOTAUR", Description: "Heretic Minotaur charge bounce behavior quirks", Category: "Monsters / AI"},
	{Value: 4194304, Name: "COMPATF_MUSHROOM", Description: "Original A_Mushroom projectile spread behavior", Category: "Weapons / Physics"},
	{Value: 8388608, Name: "COMPATF_MBFMONSTER_MOVE", Description: "MBF monster bounce and landing movement physics", Category: "Monsters / AI"},
	{Value: 16777216, Name: "COMPATF_CORPSESTAY", Description: "Original multiplayer corpse persistence behavior", Category: "Monsters / Multi"},
	{Value: 33554432, Name: "COMPATF_SHARE_KEYS", Description: "Keys acquired by one player are shared by all in co-op", Category: "Multiplayer / Inventory"},
	{Value: 67108864, Name: "COMPATF_HITSCAN", Description: "Hitscan attacks ignore non-solid decorations", Category: "Physics / Tracing"},
	{Value: 134217728, Name: "COMPATF_LIGHT", Description: "Vanilla light diminishing with distance formula", Category: "Rendering / Lighting"},
	{Value: 268435456, Name: "COMPATF_POLYOBJ", Description: "Polyobjects do not carry actors along with them", Category: "Physics / Geometry"},
	{Value: 536870912, Name: "COMPATF_MASKEDMIDTEX", Description: "Render 2-sided masked midtextures with vanilla Doom behavior", Category: "Rendering / Textures"},
}

// CompatFlags2 represents extended ZDoom compatibility flags (CVAR: compatflags2).
var CompatFlags2 = []Bitflag{
	{Value: 1, Name: "COMPATF2_BAD_DOOR_LIGHT", Description: "Original lighting bug for split sector doors", Category: "Rendering / Lighting"},
	{Value: 2, Name: "COMPATF2_PUSHTHROUGH", Description: "Sector pushers and pullers affect actors through walls", Category: "Physics / Pushers"},
	{Value: 4, Name: "COMPATF2_NOCLOSETLIGHT", Description: "Monster closets do not cast light into outer map sectors", Category: "Rendering / Lighting"},
	{Value: 8, Name: "COMPATF2_CHECKPRG", Description: "Check PRG files for script variables", Category: "Scripting"},
	{Value: 16, Name: "COMPATF2_EXPLODE_EXPLODE", Description: "Explosive thrust affects other active explosions", Category: "Physics / Damage"},
	{Value: 32, Name: "COMPATF2_NO_STRIP_ITEMS", Description: "Retain collected items across hub episode transitions", Category: "Gameplay / Hubs"},
	{Value: 64, Name: "COMPATF2_FULL_INFIGHTING", Description: "Monsters of the exact same species can damage each other", Category: "Monsters / AI"},
	{Value: 128, Name: "COMPATF2_NO_FREE_AIM", Description: "Disable free pitch aiming on hitscan weapons", Category: "Weapons / Aim"},
	{Value: 256, Name: "COMPATF2_NO_LANDING_TELEPORT", Description: "Falling actors do not trigger teleporters upon impact", Category: "Physics / Teleports"},
}

// ComputeBitmask combines selected bitflag values into a single integer mask.
func ComputeBitmask(selected []uint64) uint64 {
	var mask uint64
	for _, v := range selected {
		mask |= v
	}
	return mask
}

// ParseBitmask decomposes an integer mask into the individual matching Bitflags.
func ParseBitmask(mask uint64, flags []Bitflag) []Bitflag {
	var result []Bitflag
	for _, f := range flags {
		if f.Value != 0 && (mask&f.Value) == f.Value {
			result = append(result, f)
		}
	}
	return result
}
