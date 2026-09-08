package diagnostics

import (
	"archive/zip"
	"io"
	"os"
	"path/filepath"
	"testing"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
)

// setupBackupService creates a temp-dir database with one profile and the
// DiagnosticsService wired to it.
func setupBackupService(t *testing.T) (*DiagnosticsService, string) {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	db, err := database.InitDB(dbPath)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	profileRepo := database.NewProfileRepository(db)
	if err := profileRepo.Create(&domain.Profile{Name: "Backup Test"}); err != nil {
		t.Fatalf("failed to create profile: %v", err)
	}
	svc := NewDiagnosticsService(db, nil, nil, nil, profileRepo, nil, dbPath)
	return svc, dbPath
}

func zipEntryNames(t *testing.T, zipPath string) map[string]bool {
	t.Helper()
	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		t.Fatalf("failed to open backup zip: %v", err)
	}
	defer zr.Close()
	names := make(map[string]bool, len(zr.File))
	for _, f := range zr.File {
		names[f.Name] = true
	}
	return names
}

func TestLibraryBackup(t *testing.T) {
	t.Run("export contains database and profile yaml", func(t *testing.T) {
		svc, _ := setupBackupService(t)
		zipPath, err := svc.ExportLibraryBackup()
		if err != nil {
			t.Fatalf("ExportLibraryBackup failed: %v", err)
		}
		defer os.Remove(zipPath)
		names := zipEntryNames(t, zipPath)
		if !names[backupDBName] {
			t.Fatalf("backup missing %s entry: %v", backupDBName, names)
		}
		foundProfile := false
		for name := range names {
			if len(name) > len(backupProfilesPrefix) && name[:len(backupProfilesPrefix)] == backupProfilesPrefix {
				foundProfile = true
			}
		}
		if !foundProfile {
			t.Fatalf("backup missing profiles/*.yaml entry: %v", names)
		}
	})

	t.Run("import round-trip restores profiles", func(t *testing.T) {
		svc, _ := setupBackupService(t)
		zipPath, err := svc.ExportLibraryBackup()
		if err != nil {
			t.Fatalf("ExportLibraryBackup failed: %v", err)
		}
		defer os.Remove(zipPath)

		targetDir := t.TempDir()
		targetPath := filepath.Join(targetDir, "restored.db")
		// Import-only instance: no open handle, matching the documented
		// restart-before-use flow.
		target := NewDiagnosticsService(nil, nil, nil, nil, nil, nil, targetPath)
		if err := target.ImportBackup(zipPath); err != nil {
			t.Fatalf("ImportBackup failed: %v", err)
		}
		db, err := database.InitDB(targetPath)
		if err != nil {
			t.Fatalf("InitDB on restored database failed: %v", err)
		}
		defer db.Close()
		list, err := database.NewProfileRepository(db).List()
		if err != nil {
			t.Fatalf("failed to list restored profiles: %v", err)
		}
		if len(list) != 1 || list[0].Name != "Backup Test" {
			t.Fatalf("unexpected restored profiles: %+v", list)
		}
	})

	t.Run("export without file path fails", func(t *testing.T) {
		svc := NewDiagnosticsService(nil, nil, nil, nil, nil, nil, ":memory:")
		if _, err := svc.ExportLibraryBackup(); err == nil {
			t.Fatal("expected error for :memory: database, got nil")
		}
	})

	t.Run("import rejects zip without database", func(t *testing.T) {
		dir := t.TempDir()
		zipPath := filepath.Join(dir, "nodb.zip")
		w := mustCreateZip(t, zipPath)
		mustAddZipEntry(t, w, "profiles/x.yaml", "version: 1\n")
		if err := w.Close(); err != nil {
			t.Fatalf("failed to close zip: %v", err)
		}
		target := NewDiagnosticsService(nil, nil, nil, nil, nil, nil, filepath.Join(dir, "out.db"))
		if err := target.ImportBackup(zipPath); err == nil {
			t.Fatal("expected error for backup without database entry, got nil")
		}
	})

	t.Run("import rejects traversal entry", func(t *testing.T) {
		svc, _ := setupBackupService(t)
		goodPath, err := svc.ExportLibraryBackup()
		if err != nil {
			t.Fatalf("ExportLibraryBackup failed: %v", err)
		}
		defer os.Remove(goodPath)

		// Rebuild the zip with a hostile extra entry.
		dir := t.TempDir()
		evilPath := filepath.Join(dir, "evil.zip")
		copyZipWithExtra(t, goodPath, evilPath, "../evil.db", "evil")
		target := NewDiagnosticsService(nil, nil, nil, nil, nil, nil, filepath.Join(dir, "out.db"))
		if err := target.ImportBackup(evilPath); err == nil {
			t.Fatal("expected error for traversal entry, got nil")
		}
	})
}

func copyZipWithExtra(t *testing.T, srcPath, dstPath, extraName, extraContent string) {
	t.Helper()
	src, err := zip.OpenReader(srcPath)
	if err != nil {
		t.Fatalf("failed to open source zip: %v", err)
	}
	defer src.Close()
	out, err := os.Create(dstPath)
	if err != nil {
		t.Fatalf("failed to create dest zip: %v", err)
	}
	defer out.Close()
	w := zip.NewWriter(out)
	defer w.Close()
	for _, f := range src.File {
		rc, err := f.Open()
		if err != nil {
			t.Fatalf("failed to open entry %s: %v", f.Name, err)
		}
		dst, err := w.Create(f.Name)
		if err != nil {
			rc.Close()
			t.Fatalf("failed to copy entry %s: %v", f.Name, err)
		}
		if _, err := io.Copy(dst, rc); err != nil {
			rc.Close()
			t.Fatalf("failed to copy entry %s: %v", f.Name, err)
		}
		rc.Close()
	}
	mustAddZipEntry(t, w, extraName, extraContent)
}

func mustCreateZip(t *testing.T, zipPath string) *zip.Writer {
	t.Helper()
	f, err := os.Create(zipPath)
	if err != nil {
		t.Fatalf("failed to create zip %s: %v", zipPath, err)
	}
	t.Cleanup(func() { _ = f.Close() })
	return zip.NewWriter(f)
}

func mustAddZipEntry(t *testing.T, w *zip.Writer, name, content string) {
	t.Helper()
	dst, err := w.Create(name)
	if err != nil {
		t.Fatalf("failed to create zip entry %s: %v", name, err)
	}
	if _, err := io.WriteString(dst, content); err != nil {
		t.Fatalf("failed to write zip entry %s: %v", name, err)
	}
}
