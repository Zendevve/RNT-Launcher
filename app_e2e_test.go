package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"

	"rnt-launcher/internal/domain"
)

// Helper to create synthetic WAD fixture
func createTestWAD(t *testing.T, path string, isIWAD bool, lumpNames []string) {
	var buf bytes.Buffer
	magic := "PWAD"
	if isIWAD {
		magic = "IWAD"
	}
	buf.WriteString(magic)

	lumpCount := uint32(len(lumpNames))
	_ = binary.Write(&buf, binary.LittleEndian, lumpCount)

	headerSize := uint32(12)
	dataSize := uint32(0)
	for range lumpNames {
		dataSize += 8 // 8 bytes dummy data per lump
	}
	dirOffset := headerSize + dataSize
	_ = binary.Write(&buf, binary.LittleEndian, dirOffset)

	// Write dummy data
	for range lumpNames {
		buf.WriteString("12345678")
	}

	// Write directory entries (16 bytes each)
	offset := headerSize
	for _, name := range lumpNames {
		_ = binary.Write(&buf, binary.LittleEndian, offset)
		_ = binary.Write(&buf, binary.LittleEndian, uint32(8))
		var nameBytes [8]byte
		copy(nameBytes[:], []byte(name))
		buf.Write(nameBytes[:])
		offset += 8
	}

	err := os.WriteFile(path, buf.Bytes(), 0644)
	if err != nil {
		t.Fatalf("failed to write test wad: %v", err)
	}
}

// Helper to create synthetic PK3 fixture
func createTestPK3(t *testing.T, path string, entries map[string]string) {
	file, err := os.Create(path)
	if err != nil {
		t.Fatalf("failed to create pk3 file: %v", err)
	}
	defer file.Close()

	w := zip.NewWriter(file)
	for name, content := range entries {
		f, err := w.Create(name)
		if err != nil {
			t.Fatalf("failed to create pk3 entry %s: %v", name, err)
		}
		_, _ = f.Write([]byte(content))
	}
	_ = w.Close()
}

func TestEndToEndUserWorkflow(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "e2e-app.db")
	modsDir := filepath.Join(tempDir, "mods")
	iwadsDir := filepath.Join(tempDir, "iwads")
	enginesDir := filepath.Join(tempDir, "engines")

	_ = os.MkdirAll(modsDir, 0755)
	_ = os.MkdirAll(iwadsDir, 0755)
	_ = os.MkdirAll(enginesDir, 0755)

	// 1. Create test files
	iwadPath := filepath.Join(iwadsDir, "DOOM2.WAD")
	createTestWAD(t, iwadPath, true, []string{"MAP01", "MAP02", "TEXTURE1", "PNAMES"})

	mod1Path := filepath.Join(modsDir, "brutal-doom.pk3")
	createTestPK3(t, mod1Path, map[string]string{
		"zscript.zs":   "class BrutalPlayer : PlayerPawn {}",
		"decorate.txt": "actor BrutalWeapon {}",
	})

	mod2Path := filepath.Join(modsDir, "maps-of-chaos.wad")
	createTestWAD(t, mod2Path, false, []string{"MAP01", "MAP02", "MAP03", "MAPINFO"})

	engineExePath := filepath.Join(enginesDir, "gzdoom.exe")
	_ = os.WriteFile(engineExePath, []byte("fake gzdoom binary"), 0755)

	// 2. Initialize App
	app := NewApp()
	app.SetDBPath(dbPath)
	app.SetEventEmitter(func(eventName string, data any) {})
	app.startup(context.Background())
	defer app.Close()

	// 3. Configure directories
	settings, err := app.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	settings.ModDirectories = []string{modsDir}
	settings.IWADDirectories = []string{iwadsDir}
	settings.EngineDirectories = []string{enginesDir}
	err = app.UpdateSettings(*settings)
	if err != nil {
		t.Fatalf("UpdateSettings failed: %v", err)
	}

	// 4. Run Scanner
	scanRes, err := app.StartScan()
	if err != nil {
		t.Fatalf("StartScan failed: %v", err)
	}
	if scanRes.DiscoveredMods != 2 {
		t.Fatalf("Expected 2 discovered mods, got %d", scanRes.DiscoveredMods)
	}
	if scanRes.DiscoveredIWADs != 1 {
		t.Fatalf("Expected 1 discovered IWAD, got %d", scanRes.DiscoveredIWADs)
	}

	// 5. Verify registered entities
	mods, err := app.ListMods(domain.ModFilter{})
	if err != nil || len(mods) != 2 {
		t.Fatalf("ListMods failed: count %d, err: %v", len(mods), err)
	}

	iwads, err := app.ListIWADs()
	if err != nil || len(iwads) != 1 {
		t.Fatalf("ListIWADs failed: count %d, err: %v", len(iwads), err)
	}

	// Add engine
	engine, err := app.AddEngine(domain.Engine{
		Name:       "GZDoom 4.14.0",
		Executable: engineExePath,
		Version:    "4.14.0",
		Family:     domain.EngineFamilyGZDoom,
	})
	if err != nil {
		t.Fatalf("AddEngine failed: %v", err)
	}

	// 6. Create Profile
	profile, err := app.CreateProfile(domain.Profile{
		Name:        "Brutal Chaos",
		Description: "Brutal Doom + Maps of Chaos",
		EngineID:    engine.ID,
		IWADID:      iwads[0].ID,
		Arguments:   []string{"-skill", "4", "-warp", "MAP01"},
	})
	if err != nil {
		t.Fatalf("CreateProfile failed: %v", err)
	}

	// Attach mods to profile
	err = app.AddModToProfile(profile.ID, mods[0].ID)
	if err != nil {
		t.Fatalf("AddModToProfile 1 failed: %v", err)
	}
	err = app.AddModToProfile(profile.ID, mods[1].ID)
	if err != nil {
		t.Fatalf("AddModToProfile 2 failed: %v", err)
	}

	// Reorder mods (reverse order)
	err = app.ReorderProfileMods(profile.ID, []string{mods[1].ID, mods[0].ID})
	if err != nil {
		t.Fatalf("ReorderProfileMods failed: %v", err)
	}

	// Disable 1 mod
	err = app.ToggleProfileMod(profile.ID, mods[1].ID, false)
	if err != nil {
		t.Fatalf("ToggleProfileMod failed: %v", err)
	}

	// 7. Validate Profile (Should be READY since engine, iwad, enabled mod exist; disabled mod is info)
	valRes, err := app.ValidateProfile(profile.ID)
	if err != nil {
		t.Fatalf("ValidateProfile failed: %v", err)
	}
	if valRes.Status != domain.ValidationStatusReady {
		t.Fatalf("Expected READY status, got %s", valRes.Status)
	}

	// 8. Export Profile to YAML
	yamlStr, err := app.ExportProfileYAML(profile.ID)
	if err != nil {
		t.Fatalf("ExportProfileYAML failed: %v", err)
	}

	// 9. Delete Profile
	err = app.DeleteProfile(profile.ID)
	if err != nil {
		t.Fatalf("DeleteProfile failed: %v", err)
	}

	profilesList, err := app.ListProfiles()
	if err != nil || len(profilesList) != 0 {
		t.Fatalf("Expected 0 profiles after delete, got %d", len(profilesList))
	}

	// 10. Import Profile from YAML
	importRes, err := app.ImportProfileYAML(yamlStr)
	if err != nil {
		t.Fatalf("ImportProfileYAML failed: %v", err)
	}
	importedProf, ok := importRes["profile"].(*domain.Profile)
	if !ok || importedProf == nil {
		t.Fatalf("Expected imported profile")
	}
	if importedProf.Name != "Brutal Chaos" {
		t.Fatalf("Expected imported profile name 'Brutal Chaos', got %s", importedProf.Name)
	}
	if len(importedProf.Mods) != 2 {
		t.Fatalf("Expected 2 mods in imported profile, got %d", len(importedProf.Mods))
	}

	// 11. Re-validate imported profile
	revalRes, err := app.ValidateProfile(importedProf.ID)
	if err != nil {
		t.Fatalf("Re-validate failed: %v", err)
	}
	if revalRes.Status != domain.ValidationStatusReady {
		t.Fatalf("Expected READY status for imported profile, got %s", revalRes.Status)
	}
}
