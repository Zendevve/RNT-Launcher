package saves_test

import (
	"os"
	"path/filepath"
	"testing"

	"rnt-launcher/internal/saves"
)

func TestSaveService(t *testing.T) {
	tempDir := t.TempDir()
	svc := saves.New(tempDir)

	if svc.BaseDir() != filepath.Clean(tempDir) {
		t.Errorf("expected baseDir %s, got %s", tempDir, svc.BaseDir())
	}

	profileID := "test-profile-123"
	saveDir := svc.GetProfileSaveDir(profileID)
	expectedDir := filepath.Join(tempDir, profileID)
	if saveDir != expectedDir {
		t.Errorf("expected saveDir %s, got %s", expectedDir, saveDir)
	}

	ensuredDir, err := svc.EnsureProfileSaveDir(profileID)
	if err != nil {
		t.Fatalf("EnsureProfileSaveDir failed: %v", err)
	}
	if ensuredDir != expectedDir {
		t.Errorf("expected ensuredDir %s, got %s", expectedDir, ensuredDir)
	}

	fi, err := os.Stat(ensuredDir)
	if err != nil {
		t.Fatalf("expected directory to exist: %v", err)
	}
	if !fi.IsDir() {
		t.Fatalf("expected path to be a directory")
	}
}
