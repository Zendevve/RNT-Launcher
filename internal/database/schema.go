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
    parent_profile_id TEXT,
    isolate_saves INTEGER NOT NULL DEFAULT 0,
    arguments TEXT NOT NULL DEFAULT '[]',
    working_dir TEXT NOT NULL DEFAULT '',
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (engine_id) REFERENCES engines(id) ON DELETE SET NULL,
    FOREIGN KEY (iwad_id) REFERENCES iwads(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_profile_id) REFERENCES profiles(id) ON DELETE SET NULL
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
CREATE TABLE IF NOT EXISTS idgames_catalog (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    dir TEXT NOT NULL,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL,
    age INTEGER NOT NULL,
    date TEXT NOT NULL,
    author TEXT NOT NULL,
    description TEXT NOT NULL,
    rating REAL NOT NULL,
    votes INTEGER NOT NULL,
    is_cacoward INTEGER NOT NULL DEFAULT 0,
    cacoward_year INTEGER NOT NULL DEFAULT 0,
    is_top100 INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT '',
    curator_note TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS idgames_fts USING fts5(
    title,
    author,
    filename,
    description,
    content='idgames_catalog',
    content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS idgames_ai AFTER INSERT ON idgames_catalog BEGIN
    INSERT INTO idgames_fts(rowid, title, author, filename, description)
    VALUES (new.id, new.title, new.author, new.filename, new.description);
END;

CREATE TRIGGER IF NOT EXISTS idgames_ad AFTER DELETE ON idgames_catalog BEGIN
    INSERT INTO idgames_fts(idgames_fts, rowid, title, author, filename, description)
    VALUES ('delete', old.id, old.title, old.author, old.filename, old.description);
END;

CREATE TRIGGER IF NOT EXISTS idgames_au AFTER UPDATE ON idgames_catalog BEGIN
    INSERT INTO idgames_fts(idgames_fts, rowid, title, author, filename, description)
    VALUES ('delete', old.id, old.title, old.author, old.filename, old.description);
    INSERT INTO idgames_fts(rowid, title, author, filename, description)
    VALUES (new.id, new.title, new.author, new.filename, new.description);
END;

CREATE INDEX IF NOT EXISTS idx_idgames_rating_votes ON idgames_catalog(rating DESC, votes DESC);
CREATE INDEX IF NOT EXISTS idx_idgames_cacoward ON idgames_catalog(is_cacoward, cacoward_year DESC);
CREATE INDEX IF NOT EXISTS idx_idgames_date ON idgames_catalog(date DESC);
CREATE INDEX IF NOT EXISTS idx_idgames_filename ON idgames_catalog(filename);
`
