package saves

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// snapshotsSubdir is the SaveService base-dir child holding all profile snapshots.
const snapshotsSubdir = "snapshots"

// maxSnapshotLabelLen bounds a sanitized snapshot label so file names stay portable.
const maxSnapshotLabelLen = 64

// sanitizeSnapshotComponent keeps only [A-Za-z0-9_-], returning fallback when empty.
func sanitizeSnapshotComponent(s, fallback string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	out := b.String()
	if out == "" {
		return fallback
	}
	if len(out) > maxSnapshotLabelLen {
		out = out[:maxSnapshotLabelLen]
	}
	return out
}

// snapshotsDir returns the directory holding a profile's snapshot zips.
func (s *SaveService) snapshotsDir(profileID string) string {
	cleanID := strings.TrimSpace(profileID)
	if cleanID == "" {
		cleanID = "default"
	}
	return filepath.Join(s.baseDir, snapshotsSubdir, cleanID)
}

// Snapshot zips the profile's save directory into
// <base>/snapshots/<profileID>/<timestamp>-<label>.zip and returns the zip path.
// The label is sanitized to [A-Za-z0-9_-] ("snapshot" when empty).
// SnapshotID is the zip basename; pass it to Restore.
func (s *SaveService) Snapshot(profileID, label string) (string, error) {
	if s == nil {
		return "", fmt.Errorf("save service is not initialized")
	}
	saveDir, err := s.EnsureProfileSaveDir(profileID)
	if err != nil {
		return "", err
	}
	snapDir := s.snapshotsDir(profileID)
	if err := os.MkdirAll(snapDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create snapshots directory %q: %w", snapDir, err)
	}
	cleanLabel := sanitizeSnapshotComponent(strings.TrimSpace(label), "snapshot")
	stamp := time.Now().UTC().Format("20060102-150405")
	zipPath := filepath.Join(snapDir, stamp+"-"+cleanLabel+".zip")
	for i := 1; ; i++ {
		if _, err := os.Stat(zipPath); os.IsNotExist(err) {
			break
		}
		zipPath = filepath.Join(snapDir, fmt.Sprintf("%s-%s-%d.zip", stamp, cleanLabel, i))
		if i > 1000 {
			return "", fmt.Errorf("too many snapshots for timestamp %q", stamp)
		}
	}

	out, err := os.Create(zipPath)
	if err != nil {
		return "", fmt.Errorf("failed to create snapshot %q: %w", zipPath, err)
	}
	zw := zip.NewWriter(out)
	walkErr := filepath.Walk(saveDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if path == saveDir {
			return nil
		}
		rel, err := filepath.Rel(saveDir, path)
		if err != nil {
			return err
		}
		name := filepath.ToSlash(rel)
		if info.IsDir() {
			_, err := zw.Create(name + "/")
			return err
		}
		w, err := zw.Create(name)
		if err != nil {
			return err
		}
		return copyFileInto(w, path)
	})
	closeErr := zw.Close()
	syncErr := out.Close()
	if walkErr != nil {
		_ = os.Remove(zipPath)
		return "", fmt.Errorf("failed to zip save directory %q: %w", saveDir, walkErr)
	}
	if closeErr != nil {
		_ = os.Remove(zipPath)
		return "", fmt.Errorf("failed to finalize snapshot %q: %w", zipPath, closeErr)
	}
	if syncErr != nil {
		_ = os.Remove(zipPath)
		return "", fmt.Errorf("failed to write snapshot %q: %w", zipPath, syncErr)
	}
	return zipPath, nil
}

// Restore unzips the snapshot identified by snapshotID (zip basename, with or
// without the .zip suffix) over the profile's save directory. Archive entries
// escaping the save directory (Zip-Slip) abort the restore with an error.
func (s *SaveService) Restore(profileID, snapshotID string) error {
	if s == nil {
		return fmt.Errorf("save service is not initialized")
	}
	base := filepath.Base(strings.TrimSpace(snapshotID))
	if base == "" || base == "." || base == string(os.PathSeparator) {
		return fmt.Errorf("snapshot id cannot be empty")
	}
	if !strings.HasSuffix(strings.ToLower(base), ".zip") {
		base += ".zip"
	}
	snapDir := s.snapshotsDir(profileID)
	zipPath := filepath.Join(snapDir, base)
	if rel, err := filepath.Rel(snapDir, filepath.Clean(zipPath)); err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return fmt.Errorf("snapshot id %q escapes snapshots directory", snapshotID)
	}
	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return fmt.Errorf("failed to open snapshot %q: %w", zipPath, err)
	}
	defer zr.Close()

	saveDir, err := s.EnsureProfileSaveDir(profileID)
	if err != nil {
		return err
	}
	// Clear current contents so restore yields exactly the snapshotted tree.
	if err := os.RemoveAll(saveDir); err != nil {
		return fmt.Errorf("failed to clear save directory %q: %w", saveDir, err)
	}
	saveDir, err = s.EnsureProfileSaveDir(profileID)
	if err != nil {
		return err
	}
	for _, entry := range zr.File {
		name := filepath.FromSlash(entry.Name)
		if name == "" || name == "." {
			continue
		}
		target := filepath.Join(saveDir, name)
		rel, err := filepath.Rel(saveDir, target)
		if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
			return fmt.Errorf("snapshot entry %q escapes save directory", entry.Name)
		}
		if entry.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0755); err != nil {
				return fmt.Errorf("failed to restore directory %q: %w", target, err)
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return fmt.Errorf("failed to restore directory %q: %w", filepath.Dir(target), err)
		}
		if err := extractFile(target, entry); err != nil {
			return err
		}
	}
	return nil
}

func copyFileInto(w io.Writer, path string) error {
	in, err := os.Open(path)
	if err != nil {
		return err
	}
	defer in.Close()
	if _, err := io.Copy(w, in); err != nil {
		return fmt.Errorf("failed to zip file %q: %w", path, err)
	}
	return nil
}

func extractFile(target string, entry *zip.File) error {
	in, err := entry.Open()
	if err != nil {
		return fmt.Errorf("failed to read snapshot entry %q: %w", entry.Name, err)
	}
	defer in.Close()
	out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return fmt.Errorf("failed to restore file %q: %w", target, err)
	}
	defer out.Close()
	if _, err := io.Copy(out, in); err != nil {
		return fmt.Errorf("failed to restore file %q: %w", target, err)
	}
	return nil
}
