package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"rnt-launcher/internal/domain"
)
func setupOrganizeApp(t *testing.T) (*App, string, string) {
	t.Helper()
	tempDir := t.TempDir()
	app := NewApp()
	app.SetDBPath(filepath.Join(tempDir, "organize-app.db"))
	app.SetEventEmitter(func(eventName string, data any) {})
	app.startup(context.Background())
	t.Cleanup(func() { app.Close() })

	src := filepath.Join(tempDir, "inbox")
	if err := os.MkdirAll(src, 0755); err != nil {
		t.Fatal(err)
	}
	// Messy flat library: IWAD magic, PWAD, PK3, patch, engine zip, collision pair.
	createTestWAD(t, filepath.Join(src, "doom2.wad"), true, []string{"MAP01", "E1M1"})
	createTestWAD(t, filepath.Join(src, "chaos.wad"), false, []string{"MAP01", "MAP02"})
	createTestPK3(t, filepath.Join(src, "guns.pk3"), map[string]string{"ZSCRIPT": "class {}"})
	if err := os.WriteFile(filepath.Join(src, "fix.deh"), []byte("Patch File\n"), 0644); err != nil {
		t.Fatal(err)
	}
	sub := filepath.Join(src, "nested")
	if err := os.MkdirAll(sub, 0755); err != nil {
		t.Fatal(err)
	}
	createTestWAD(t, filepath.Join(sub, "chaos.wad"), false, []string{"MAP03"})
	return app, src, filepath.Join(tempDir, "library")
}

func TestOrganizeDirectoryDryRun(t *testing.T) {
	app, src, lib := setupOrganizeApp(t)

	report, err := app.OrganizeDirectory(src, lib, true)
	if err != nil {
		t.Fatalf("dry run failed: %v", err)
	}
	if !report.DryRun {
		t.Error("expected DryRun report flag")
	}
	if report.MovedCount != 0 {
		t.Errorf("dry run moved %d files", report.MovedCount)
	}
	// 4 classifiable moves (nested chaos.wad collides) plus 1 error.
	if len(report.Moves) != 4 {
		t.Fatalf("expected 4 planned moves, got %d: %+v", len(report.Moves), report.Moves)
	}
	if len(report.Errors) != 1 {
		t.Fatalf("expected 1 collision error, got %v", report.Errors)
	}
	// Nothing touched on disk.
	if _, err := os.Stat(lib); !os.IsNotExist(err) {
		t.Error("dry run created library directory")
	}
	if _, err := os.Stat(filepath.Join(src, "chaos.wad")); err != nil {
		t.Error("dry run moved source file")
	}
}

func TestOrganizeDirectoryMovesAndImports(t *testing.T) {
	app, src, lib := setupOrganizeApp(t)

	report, err := app.OrganizeDirectory(src, lib, false)
	if err != nil {
		t.Fatalf("organize failed: %v", err)
	}
	if report.MovedCount != 4 {
		t.Errorf("expected 4 moved, got %d (errors %v)", report.MovedCount, report.Errors)
	}
	if report.ImportedMods != 4 {
		t.Errorf("expected 4 imported mods, got %d", report.ImportedMods)
	}
	for _, want := range []string{
		filepath.Join(lib, "iwads", "doom2.wad"),
		filepath.Join(lib, "wads", "chaos.wad"),
		filepath.Join(lib, "mods", "guns.pk3"),
		filepath.Join(lib, "mods", "fix.deh"),
	} {
		if _, err := os.Stat(want); err != nil {
			t.Errorf("expected organized file %s: %v", want, err)
		}
	}
	// Collision loser stays put.
	if _, err := os.Stat(filepath.Join(src, "nested", "chaos.wad")); err != nil {
		t.Errorf("collision file should remain: %v", err)
	}

	mods, err := app.ListMods(domain.ModFilter{})
	if err != nil || len(mods) != 4 {
		t.Fatalf("ListMods after organize: %+v err=%v", mods, err)
	}
	iwads, err := app.ListIWADs()
	if err != nil || len(iwads) != 1 {
		t.Fatalf("ListIWADs after organize: %+v err=%v", iwads, err)
	}
}

func TestOrganizeDirectoryRejectsSelfTarget(t *testing.T) {
	app, src, _ := setupOrganizeApp(t)

	if _, err := app.OrganizeDirectory(src, src, false); err == nil {
		t.Error("expected error organizing directory into itself")
	}
	if _, err := app.OrganizeDirectory(src, filepath.Join(src, "sub", "lib"), true); err == nil {
		t.Error("expected error organizing into child directory")
	}
	if _, err := app.OrganizeDirectory(filepath.Join(src, "missing"), filepath.Join(src, "lib"), false); err == nil {
		t.Error("expected error for missing source directory")
	}
}
