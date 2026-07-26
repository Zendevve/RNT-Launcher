package main

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"rnt-launcher/internal/domain"
)

func TestAppIntegration(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test-app.db")

	app := NewApp()
	app.SetDBPath(dbPath)
	app.SetEventEmitter(func(eventName string, data any) {
		// Mock event emitter for tests
	})
	app.startup(context.Background())
	defer app.Close()

	// 1. Settings test
	settings, err := app.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	if settings == nil {
		t.Fatalf("Expected default settings, got nil")
	}

	settings.Theme = "dark"
	err = app.UpdateSettings(*settings)
	if err != nil {
		t.Fatalf("UpdateSettings failed: %v", err)
	}

	// 2. Engine test
	engine, err := app.AddEngine(domain.Engine{
		Name:       "GZDoom Test",
		Executable: "gzdoom.exe",
		Version:    "4.14.0",
		Family:     domain.EngineFamilyGZDoom,
	})
	if err != nil {
		t.Fatalf("AddEngine failed: %v", err)
	}
	if engine.ID == "" {
		t.Fatalf("Expected generated engine ID")
	}

	engines, err := app.ListEngines()
	if err != nil || len(engines) != 1 {
		t.Fatalf("ListEngines failed: count %d, err: %v", len(engines), err)
	}

	// 3. IWAD test
	iwad, err := app.AddIWAD(domain.IWAD{
		Name:      "Doom 2",
		Path:      filepath.Join(tempDir, "DOOM2.WAD"),
		Type:      domain.IWADTypeDoom2,
		LumpCount: 2919,
	})
	if err != nil {
		t.Fatalf("AddIWAD failed: %v", err)
	}

	iwads, err := app.ListIWADs()
	if err != nil || len(iwads) != 1 {
		t.Fatalf("ListIWADs failed: count %d, err: %v", len(iwads), err)
	}

	// 4. Profile test
	profile, err := app.CreateProfile(domain.Profile{
		Name:        "Test Brutal Doom Profile",
		Description: "A profile for testing",
		EngineID:    engine.ID,
		IWADID:      iwad.ID,
		Arguments:   []string{"-skill", "4"},
	})
	if err != nil {
		t.Fatalf("CreateProfile failed: %v", err)
	}
	if profile.ID == "" {
		t.Fatalf("Expected generated profile ID")
	}

	// Duplicate
	dup, err := app.DuplicateProfile(profile.ID, "Duplicated Profile")
	if err != nil {
		t.Fatalf("DuplicateProfile failed: %v", err)
	}
	if dup.Name != "Duplicated Profile" {
		t.Fatalf("Expected duplicated profile name 'Duplicated Profile', got %s", dup.Name)
	}

	// Export YAML
	yamlStr, err := app.ExportProfileYAML(profile.ID)
	if err != nil {
		t.Fatalf("ExportProfileYAML failed: %v", err)
	}
	if yamlStr == "" {
		t.Fatalf("Expected non-empty YAML string")
	}

	// Import YAML
	importedMap, err := app.ImportProfileYAML(yamlStr)
	if err != nil {
		t.Fatalf("ImportProfileYAML failed: %v", err)
	}
	if importedMap["profile"] == nil {
		t.Fatalf("Expected imported profile in result map")
	}

	// 5. History test
	histories, err := app.ListLaunchHistory(10)
	if err != nil {
		t.Fatalf("ListLaunchHistory failed: %v", err)
	}
	if len(histories) != 0 {
		t.Fatalf("Expected 0 history records initially, got %d", len(histories))
	}

	stats, err := app.GetHistoryStats()
	if err != nil {
		t.Fatalf("GetHistoryStats failed: %v", err)
	}
	if stats.TotalLaunches != 0 {
		t.Fatalf("Expected 0 total launches, got %d", stats.TotalLaunches)
	}

	// Clean up
	_ = app.DeleteProfile(dup.ID)
	_ = app.DeleteProfile(profile.ID)
	_ = app.DeleteIWAD(iwad.ID)
	_ = app.DeleteEngine(engine.ID)
	_ = time.Now()
}
