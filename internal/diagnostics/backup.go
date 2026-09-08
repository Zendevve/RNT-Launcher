package diagnostics

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"rnt-launcher/internal/profiles"
)

// backupDBName is the fixed entry name of the SQLite database file inside a
// library backup zip.
const backupDBName = "rnt-launcher.db"

// backupProfilesPrefix namespaces per-profile YAML exports inside the zip.
const backupProfilesPrefix = "profiles/"

// ExportLibraryBackup zips the live SQLite database file plus one YAML
// export per profile into a temp zip and returns its path.
//
// Before copying, it runs a WAL checkpoint when the DB handle is available
// so recent transactions are folded into the main database file; without a
// handle it falls back to a straight file copy. The caller owns the
// returned file (rename or delete it when done).
func (s *DiagnosticsService) ExportLibraryBackup() (string, error) {
	if s == nil {
		return "", fmt.Errorf("diagnostics service is not initialized")
	}
	if strings.TrimSpace(s.dbPath) == "" || s.dbPath == ":memory:" || strings.Contains(s.dbPath, ":memory:") {
		return "", fmt.Errorf("cannot back up database: no database file path configured")
	}
	if _, err := os.Stat(s.dbPath); err != nil {
		return "", fmt.Errorf("cannot back up database at %s: %w", s.dbPath, err)
	}
	if s.db != nil {
		// Best effort: fold WAL content into the main file so the file
		// copy below is complete. A failed checkpoint must not fail the
		// backup; the copy still proceeds.
		_, _ = s.db.Exec(`PRAGMA wal_checkpoint(TRUNCATE);`)
	}

	tmp, err := os.CreateTemp("", "rnt-library-backup-*.zip")
	if err != nil {
		return "", fmt.Errorf("failed to create backup file: %w", err)
	}
	tmpPath := tmp.Name()
	zw := zip.NewWriter(tmp)

	addFile := func(entryName, srcPath string) error {
		src, err := os.Open(srcPath)
		if err != nil {
			return fmt.Errorf("failed to open %s: %w", srcPath, err)
		}
		defer src.Close()
		dst, err := zw.Create(entryName)
		if err != nil {
			return fmt.Errorf("failed to create zip entry %s: %w", entryName, err)
		}
		if _, err := io.Copy(dst, src); err != nil {
			return fmt.Errorf("failed to write zip entry %s: %w", entryName, err)
		}
		return nil
	}

	retErr := func() error {
		if err := addFile(backupDBName, s.dbPath); err != nil {
			return err
		}
		if err := s.exportProfilesToZip(zw); err != nil {
			return err
		}
		return nil
	}()

	if err := zw.Close(); err != nil && retErr == nil {
		retErr = fmt.Errorf("failed to finalize backup zip: %w", err)
	}
	// Close the underlying temp file regardless of zip outcome.
	_ = tmp.Close()
	if retErr != nil {
		_ = os.Remove(tmpPath)
		return "", retErr
	}
	return tmpPath, nil
}

// exportProfilesToZip appends one YAML export per profile to an open zip
// writer. Profiles that fail to export are skipped so a single broken
// profile never fails the whole backup.
func (s *DiagnosticsService) exportProfilesToZip(zw *zip.Writer) error {
	if s.profileRepo == nil {
		return nil
	}
	list, err := s.profileRepo.List()
	if err != nil {
		return fmt.Errorf("failed to list profiles for backup: %w", err)
	}
	if len(list) == 0 {
		return nil
	}
	svc := profiles.NewProfileService(s.profileRepo, s.modRepo, s.iwadRepo, s.engineRepo)
	ctx := context.Background()
	for i := range list {
		id := strings.TrimSpace(list[i].ID)
		if id == "" {
			continue
		}
		data, err := svc.ExportYAML(ctx, id)
		if err != nil {
			continue
		}
		dst, err := zw.Create(backupProfilesPrefix + sanitizeBackupComponent(id) + ".yaml")
		if err != nil {
			return fmt.Errorf("failed to create profile backup entry: %w", err)
		}
		if _, err := dst.Write(data); err != nil {
			return fmt.Errorf("failed to write profile backup entry: %w", err)
		}
	}
	return nil
}

// ImportBackup validates a backup zip produced by ExportLibraryBackup and
// swaps its database file into place at the configured database path.
//
// The running DB handle (if any) is left untouched, so the caller MUST close
// the database and restart (or re-run InitDB) before using the restored data.
// Only the database entry is restored; profile YAML entries are informational
// (they already describe the restored rows) and are validated but not applied.
func (s *DiagnosticsService) ImportBackup(zipPath string) error {
	if s == nil {
		return fmt.Errorf("diagnostics service is not initialized")
	}
	if strings.TrimSpace(s.dbPath) == "" || s.dbPath == ":memory:" || strings.Contains(s.dbPath, ":memory:") {
		return fmt.Errorf("cannot restore backup: no database file path configured")
	}
	if strings.TrimSpace(zipPath) == "" {
		return fmt.Errorf("backup path cannot be empty")
	}
	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return fmt.Errorf("failed to open backup %s: %w", zipPath, err)
	}
	defer zr.Close()

	var dbEntry *zip.File
	for _, f := range zr.File {
		name := f.Name
		if !isValidBackupEntry(name) {
			return fmt.Errorf("invalid entry in backup %q", name)
		}
		if name == backupDBName {
			dbEntry = f
		}
	}
	if dbEntry == nil {
		return fmt.Errorf("backup %s does not contain %s", zipPath, backupDBName)
	}
	if dbEntry.UncompressedSize64 == 0 {
		return fmt.Errorf("backup database entry is empty")
	}

	// Extract to a temp file in the destination directory so the final
	// rename is atomic on the same filesystem.
	destDir := filepath.Dir(s.dbPath)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory %s: %w", destDir, err)
	}
	staging, err := os.CreateTemp(destDir, ".rnt-restore-*.db")
	if err != nil {
		return fmt.Errorf("failed to stage restored database: %w", err)
	}
	stagingPath := staging.Name()
	src, err := dbEntry.Open()
	if err != nil {
		_ = staging.Close()
		_ = os.Remove(stagingPath)
		return fmt.Errorf("failed to read backup database entry: %w", err)
	}
	_, copyErr := io.Copy(staging, src)
	_ = src.Close()
	syncErr := staging.Sync()
	closeErr := staging.Close()
	if copyErr != nil || syncErr != nil || closeErr != nil {
		_ = os.Remove(stagingPath)
		return fmt.Errorf("failed to stage restored database: %w", firstBackupErr(copyErr, syncErr, closeErr))
	}

	if err := os.Rename(stagingPath, s.dbPath); err != nil {
		_ = os.Remove(stagingPath)
		return fmt.Errorf("failed to install restored database at %s: %w", s.dbPath, err)
	}
	// Drop stale WAL sidecars from the pre-restore database, if any.
	_ = os.Remove(s.dbPath + "-wal")
	_ = os.Remove(s.dbPath + "-shm")
	return nil
}

// isValidBackupEntry accepts only the layout ExportLibraryBackup writes and
// rejects absolute paths and zip-slip traversal.
func isValidBackupEntry(name string) bool {
	if name == "" {
		return false
	}
	// Zip entry names always use forward slashes; reject anything that
	// could escape the restore target (traversal, absolute paths,
	// Windows separators and drive letters).
	if filepath.IsAbs(name) || strings.Contains(name, "..") || strings.Contains(name, "\\") || strings.ContainsRune(name, ':') {
		return false
	}
	if name == backupDBName {
		return true
	}
	if !strings.HasPrefix(name, backupProfilesPrefix) {
		return false
	}
	rest := strings.TrimPrefix(name, backupProfilesPrefix)
	if rest == "" || strings.Contains(rest, "/") || !strings.HasSuffix(rest, ".yaml") {
		return false
	}
	return true
}

// sanitizeBackupComponent keeps only [A-Za-z0-9_-] for zip entry names.
func sanitizeBackupComponent(v string) string {
	var b strings.Builder
	b.Grow(len(v))
	for _, r := range v {
		if r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	if b.Len() == 0 {
		return "unknown"
	}
	return b.String()
}

func firstBackupErr(errs ...error) error {
	for _, err := range errs {
		if err != nil {
			return err
		}
	}
	return nil
}
