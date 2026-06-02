package database

const SchemaSQL = `
CREATE TABLE IF NOT EXISTS engines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    executable TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '',
    family TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS iwads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT '',
    lump_count INTEGER NOT NULL DEFAULT 0,
    size INTEGER NOT NULL DEFAULT 0,
    sha256 TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS mods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    format TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    modified_at DATETIME NOT NULL,
    sha256 TEXT NOT NULL DEFAULT '',
    lump_count INTEGER NOT NULL DEFAULT 0,
    structures TEXT NOT NULL DEFAULT '[]',
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    engine_id TEXT,
    iwad_id TEXT,
    arguments TEXT NOT NULL DEFAULT '[]',
    working_dir TEXT NOT NULL DEFAULT '',
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (engine_id) REFERENCES engines(id) ON DELETE SET NULL,
    FOREIGN KEY (iwad_id) REFERENCES iwads(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS profile_mods (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    mod_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (mod_id) REFERENCES mods(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS launch_history (
    id TEXT PRIMARY KEY,
    profile_id TEXT,
    profile_name TEXT NOT NULL DEFAULT '',
    engine_name TEXT NOT NULL DEFAULT '',
    iwad_name TEXT NOT NULL DEFAULT '',
    started_at DATETIME NOT NULL,
    finished_at DATETIME,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    exit_code INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT '',
    command_line TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mods_name ON mods(name);
CREATE INDEX IF NOT EXISTS idx_mods_path ON mods(path);
CREATE INDEX IF NOT EXISTS idx_mods_format ON mods(format);
CREATE INDEX IF NOT EXISTS idx_mods_category ON mods(category);
CREATE INDEX IF NOT EXISTS idx_mods_favorite ON mods(is_favorite);

CREATE INDEX IF NOT EXISTS idx_profile_mods_profile_order ON profile_mods(profile_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_profile_mods_mod ON profile_mods(mod_id);

CREATE INDEX IF NOT EXISTS idx_launch_history_started ON launch_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_launch_history_profile ON launch_history(profile_id);
`
