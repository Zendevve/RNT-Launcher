package engines

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
)

func setupTestDB(t *testing.T) *database.Repositories {
	t.Helper()
	db, err := database.InitDB(":memory:")
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})
	return database.NewRepositories(db)
}

func TestEngineService_CRUD(t *testing.T) {
	repos := setupTestDB(t)
	svc := NewEngineService(repos.Engines)
	ctx := context.Background()

	// 1. List initially empty
	engines, err := svc.List(ctx)
	if err != nil {
		t.Fatalf("List() failed: %v", err)
	}
	if len(engines) != 0 {
		t.Fatalf("expected 0 engines, got %d", len(engines))
	}

	// 2. Add with full details
	e1, err := svc.Add(ctx, domain.Engine{
		Name:       "GZDoom",
		Executable: "C:\\Doom\\gzdoom.exe",
		Version:    "4.14.0",
		Family:     domain.EngineFamilyGZDoom,
	})
	if err != nil {
		t.Fatalf("Add(e1) failed: %v", err)
	}
	if e1.ID == "" {
		t.Fatal("expected non-empty ID")
	}

	// 3. Add with inferred family and name from path
	e2, err := svc.Add(ctx, domain.Engine{
		Executable: "C:\\Doom\\crispy-doom.exe",
	})
	if err != nil {
		t.Fatalf("Add(e2) failed: %v", err)
	}
	if e2.Family != domain.EngineFamilyCrispyDoom {
		t.Errorf("expected family Crispy Doom, got %s", e2.Family)
	}
	if e2.Name != "Crispy Doom" {
		t.Errorf("expected auto-name 'Crispy Doom', got %s", e2.Name)
	}

	// 4. Get by ID
	fetched, err := svc.Get(ctx, e1.ID)
	if err != nil {
		t.Fatalf("Get(%s) failed: %v", e1.ID, err)
	}
	if fetched.Name != "GZDoom" || fetched.Version != "4.14.0" {
		t.Errorf("unexpected fetched engine: %+v", fetched)
	}

	// 5. Get non-existent & empty
	if _, err := svc.Get(ctx, ""); err == nil {
		t.Fatal("expected error getting empty engine ID")
	}
	if _, err := svc.Get(ctx, "non-existent-id"); err == nil {
		t.Fatal("expected error getting non-existent ID")
	}

	// 6. List returns sorted items
	list, err := svc.List(ctx)
	if err != nil {
		t.Fatalf("List() failed: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 engines, got %d", len(list))
	}
	// "Crispy Doom" before "GZDoom"
	if list[0].Name != "Crispy Doom" || list[1].Name != "GZDoom" {
		t.Errorf("unexpected list ordering: %+v", list)
	}

	// 7. Update
	fetched.Version = "4.14.1"
	fetched.Name = "GZDoom v4.14.1"
	if err := svc.Update(ctx, *fetched); err != nil {
		t.Fatalf("Update() failed: %v", err)
	}
	updated, err := svc.Get(ctx, e1.ID)
	if err != nil {
		t.Fatalf("Get() after update failed: %v", err)
	}
	if updated.Version != "4.14.1" || updated.Name != "GZDoom v4.14.1" {
		t.Errorf("expected updated values, got %+v", updated)
	}

	// 8. Update errors
	if err := svc.Update(ctx, domain.Engine{}); err == nil {
		t.Fatal("expected error updating engine with empty ID")
	}
	if err := svc.Update(ctx, domain.Engine{ID: e1.ID, Executable: ""}); err == nil {
		t.Fatal("expected error updating engine with empty Executable")
	}

	// 9. Delete
	if err := svc.Delete(ctx, ""); err == nil {
		t.Fatal("expected error deleting with empty ID")
	}
	if err := svc.Delete(ctx, e2.ID); err != nil {
		t.Fatalf("Delete(e2) failed: %v", err)
	}
	listAfterDel, _ := svc.List(ctx)
	if len(listAfterDel) != 1 {
		t.Fatalf("expected 1 engine after delete, got %d", len(listAfterDel))
	}
}

func TestEngineService_DetectVersion_MockRunner(t *testing.T) {
	repos := setupTestDB(t)
	svc := New(repos.Engines)
	ctx := context.Background()

	tests := []struct {
		name           string
		execPath       string
		mockOutput     string
		mockErr        error
		expectedVer    string
		expectedFamily domain.EngineFamily
	}{
		{
			name:           "GZDoom banner output",
			execPath:       "/path/to/gzdoom",
			mockOutput:     "GZDoom g4.14.0 - 2024-04-18 12:00:00 +0200 - SDL version\nCompiled on Linux",
			mockErr:        nil,
			expectedVer:    "4.14.0",
			expectedFamily: domain.EngineFamilyGZDoom,
		},
		{
			name:           "GZDoom version text",
			execPath:       "C:\\Doom\\gzdoom.exe",
			mockOutput:     "GZDoom version 4.12.2 (64-bit)",
			mockErr:        nil,
			expectedVer:    "4.12.2",
			expectedFamily: domain.EngineFamilyGZDoom,
		},
		{
			name:           "Zandronum banner",
			execPath:       "/usr/bin/zandronum",
			mockOutput:     "Zandronum 3.1 - 20210901 - SDL version",
			mockErr:        nil,
			expectedVer:    "3.1",
			expectedFamily: domain.EngineFamilyZandronum,
		},
		{
			name:           "DSDA-Doom version",
			execPath:       "/usr/local/bin/dsda-doom",
			mockOutput:     "dsda-doom v0.27.5 (2024-01-15)",
			mockErr:        nil,
			expectedVer:    "0.27.5",
			expectedFamily: domain.EngineFamilyDSDADoom,
		},
		{
			name:           "Woof banner",
			execPath:       "C:\\Games\\woof.exe",
			mockOutput:     "Woof! 14.5.0 (x86_64-w64-mingw32)",
			mockErr:        nil,
			expectedVer:    "14.5.0",
			expectedFamily: domain.EngineFamilyWoof,
		},
		{
			name:           "PrBoom-Plus banner",
			execPath:       "/bin/prboom-plus",
			mockOutput:     "PrBoom-Plus v2.6.66 (Oct 10 2022)",
			mockErr:        nil,
			expectedVer:    "2.6.66",
			expectedFamily: domain.EngineFamilyPrBoomPlus,
		},
		{
			name:           "Crispy Doom output",
			execPath:       "/usr/bin/crispy-doom",
			mockOutput:     "Crispy Doom 5.12.0",
			mockErr:        nil,
			expectedVer:    "5.12.0",
			expectedFamily: domain.EngineFamilyCrispyDoom,
		},
		{
			name:           "Chocolate Doom output",
			execPath:       "/usr/bin/chocolate-doom",
			mockOutput:     "Chocolate Doom 3.0.1 (built Jan 1 2023)",
			mockErr:        nil,
			expectedVer:    "3.0.1",
			expectedFamily: domain.EngineFamilyChocolateDoom,
		},
		{
			name:           "Custom port with semver",
			execPath:       "/usr/bin/my-custom-port",
			mockOutput:     "Custom Port version 2.1.0-beta",
			mockErr:        nil,
			expectedVer:    "2.1.0-beta",
			expectedFamily: domain.EngineFamilyOther,
		},
		{
			name:           "Command failure with GZDoom path fallback",
			execPath:       "C:\\Games\\gzdoom.exe",
			mockOutput:     "",
			mockErr:        errors.New("executable crashed"),
			expectedVer:    "Unknown",
			expectedFamily: domain.EngineFamilyGZDoom,
		},
		{
			name:           "Command failure with unknown port fallback",
			execPath:       "C:\\Games\\unknown-engine.exe",
			mockOutput:     "",
			mockErr:        errors.New("executable timeout"),
			expectedVer:    "Unknown",
			expectedFamily: domain.EngineFamilyOther,
		},
		{
			name:           "Empty path",
			execPath:       "",
			mockOutput:     "",
			mockErr:        nil,
			expectedVer:    "Unknown",
			expectedFamily: domain.EngineFamilyOther,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc.SetCommandRunner(func(ctx context.Context, name string, args ...string) ([]byte, error) {
				return []byte(tt.mockOutput), tt.mockErr
			})

			ver, fam := svc.DetectVersion(ctx, tt.execPath)
			if ver != tt.expectedVer {
				t.Errorf("version mismatch: expected %q, got %q", tt.expectedVer, ver)
			}
			if fam != tt.expectedFamily {
				t.Errorf("family mismatch: expected %q, got %q", tt.expectedFamily, fam)
			}
		})
	}
}

func TestEngineService_DetectVersion_DashVersionFallback(t *testing.T) {
	repos := setupTestDB(t)
	svc := NewEngineService(repos.Engines)
	ctx := context.Background()

	// Mock runner that fails on --version but succeeds on -version (like Chocolate Doom)
	svc.SetCommandRunner(func(ctx context.Context, name string, args ...string) ([]byte, error) {
		if len(args) > 0 && args[0] == "--version" {
			return nil, errors.New("unrecognized option '--version'")
		}
		if len(args) > 0 && args[0] == "-version" {
			return []byte("Chocolate Doom 3.0.1"), nil
		}
		return nil, errors.New("unknown command")
	})

	ver, fam := svc.DetectVersion(ctx, "/usr/bin/chocolate-doom")
	if ver != "3.0.1" {
		t.Errorf("expected version 3.0.1, got %s", ver)
	}
	if fam != domain.EngineFamilyChocolateDoom {
		t.Errorf("expected family Chocolate Doom, got %s", fam)
	}
}

func TestEngineService_DetectFamilyFromPath(t *testing.T) {
	tests := []struct {
		path     string
		expected domain.EngineFamily
	}{
		{"gzdoom.exe", domain.EngineFamilyGZDoom},
		{"/usr/bin/gzdoom", domain.EngineFamilyGZDoom},
		{"lzdoom.exe", domain.EngineFamilyGZDoom},
		{"zdoom", domain.EngineFamilyGZDoom},
		{"zandronum.exe", domain.EngineFamilyZandronum},
		{"/opt/zandronum/zandronum", domain.EngineFamilyZandronum},
		{"dsda-doom.exe", domain.EngineFamilyDSDADoom},
		{"dsdadoom", domain.EngineFamilyDSDADoom},
		{"prboom-plus.exe", domain.EngineFamilyPrBoomPlus},
		{"prboom+.exe", domain.EngineFamilyPrBoomPlus},
		{"prboom", domain.EngineFamilyPrBoomPlus},
		{"woof.exe", domain.EngineFamilyWoof},
		{"woof", domain.EngineFamilyWoof},
		{"crispy-doom.exe", domain.EngineFamilyCrispyDoom},
		{"crispydoom", domain.EngineFamilyCrispyDoom},
		{"chocolate-doom.exe", domain.EngineFamilyChocolateDoom},
		{"chocodoom", domain.EngineFamilyChocolateDoom},
		{"unknown_port.exe", domain.EngineFamilyOther},
		{"", domain.EngineFamilyOther},
	}

	for _, tt := range tests {
		got := DetectFamilyFromPath(tt.path)
		if got != tt.expected {
			t.Errorf("DetectFamilyFromPath(%q) = %q, expected %q", tt.path, got, tt.expected)
		}
	}
}

func TestEngineService_ValidateExecutable(t *testing.T) {
	tempDir := t.TempDir()

	// 1. Empty path
	if err := ValidateExecutable(""); err == nil {
		t.Error("expected error on empty path")
	}

	// 2. Non-existent file
	if err := ValidateExecutable(filepath.Join(tempDir, "does-not-exist.exe")); err == nil {
		t.Error("expected error on non-existent file")
	}

	// 3. Directory path
	subDir := filepath.Join(tempDir, "subdir")
	if err := os.Mkdir(subDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := ValidateExecutable(subDir); err == nil {
		t.Error("expected error when path is a directory")
	}

	// 4. Valid executable file
	var validPath string
	if runtime.GOOS == "windows" {
		validPath = filepath.Join(tempDir, "testengine.exe")
		if err := os.WriteFile(validPath, []byte("fake binary"), 0755); err != nil {
			t.Fatal(err)
		}
	} else {
		validPath = filepath.Join(tempDir, "testengine")
		if err := os.WriteFile(validPath, []byte("#!/bin/sh\n"), 0755); err != nil {
			t.Fatal(err)
		}
	}

	if err := ValidateExecutable(validPath); err != nil {
		t.Errorf("expected valid executable to succeed, got: %v", err)
	}

	// 5. Invalid extension / permissions
	if runtime.GOOS == "windows" {
		invalidPath := filepath.Join(tempDir, "testengine.txt")
		if err := os.WriteFile(invalidPath, []byte("text file"), 0755); err != nil {
			t.Fatal(err)
		}
		if err := ValidateExecutable(invalidPath); err == nil {
			t.Error("expected error on non-executable extension on Windows")
		}
	} else {
		noPermPath := filepath.Join(tempDir, "noperm")
		if err := os.WriteFile(noPermPath, []byte("binary"), 0644); err != nil {
			t.Fatal(err)
		}
		if err := ValidateExecutable(noPermPath); err == nil {
			t.Error("expected error on missing execute permission on Unix")
		}
	}
}
