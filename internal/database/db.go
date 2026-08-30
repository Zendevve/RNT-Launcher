package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

// InitDB opens and initializes a SQLite database connection with WAL mode and foreign keys enabled,
// and ensures all required tables and indexes are created.
func InitDB(dbPath string) (*sql.DB, error) {
	if dbPath == "" {
		dbPath = ":memory:"
	}

	// Create directory if not in-memory database
	if dbPath != ":memory:" && !strings.HasPrefix(dbPath, "file:") && !strings.Contains(dbPath, ":memory:") {
		dir := filepath.Dir(dbPath)
		if dir != "" && dir != "." {
			if err := os.MkdirAll(dir, 0755); err != nil {
				return nil, fmt.Errorf("failed to create database directory %s: %w", dir, err)
			}
		}
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database at %s: %w", dbPath, err)
	}

	// Set connection pool settings appropriate for SQLite
	if dbPath == ":memory:" || strings.Contains(dbPath, ":memory:") {
		db.SetMaxOpenConns(1) // Keep single in-memory connection so state persists across calls
	} else {
		db.SetMaxOpenConns(10)
	}

	// Configure PRAGMAs
	pragmas := []string{
		"PRAGMA foreign_keys = ON;",
		"PRAGMA journal_mode = WAL;",
		"PRAGMA busy_timeout = 5000;",
		"PRAGMA synchronous = NORMAL;",
	}
	for _, pragma := range pragmas {
		if _, err := db.Exec(pragma); err != nil {
			db.Close()
			return nil, fmt.Errorf("failed to execute %q: %w", pragma, err)
		}
	}

	// Run migrations / schema creation
	if _, err := db.Exec(SchemaSQL); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to execute database schema migrations: %w", err)
	}

	// Backward compatibility column additions for existing databases
	_, _ = db.Exec(`ALTER TABLE profiles ADD COLUMN isolate_saves INTEGER NOT NULL DEFAULT 0;`)
	_, _ = db.Exec(`ALTER TABLE profiles ADD COLUMN parent_profile_id TEXT DEFAULT NULL;`)

	return db, nil
}
