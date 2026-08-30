package profiles_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"gopkg.in/yaml.v3"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/profiles"
)

type testHarness struct {
	svc      *profiles.ProfileService
	profiles database.ProfileRepository
	mods     database.ModRepository
	iwads    database.IWADRepository
	engines  database.EngineRepository
}

func setupTestHarness(t *testing.T) *testHarness {
	t.Helper()
	db, err := database.InitDB(":memory:")
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	repos := database.NewRepositories(db)
	svc := profiles.NewProfileService(repos.Profiles, repos.Mods, repos.IWADs, repos.Engines)

	return &testHarness{
		svc:      svc,
		profiles: repos.Profiles,
		mods:     repos.Mods,
		iwads:    repos.IWADs,
		engines:  repos.Engines,
	}
}

func seedEngine(t *testing.T, h *testHarness, id, name, exe string) *domain.Engine {
	t.Helper()
	eng := &domain.Engine{
		ID:         id,
		Name:       name,
		Executable: exe,
		Version:    "4.14.3",
		Family:     domain.EngineFamilyGZDoom,
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	}
	if err := h.engines.Create(eng); err != nil {
		t.Fatalf("seedEngine failed: %v", err)
	}
	return eng
}

func seedIWAD(t *testing.T, h *testHarness, id, name, path string, iwadType domain.IWADType) *domain.IWAD {
	t.Helper()
	iwad := &domain.IWAD{
		ID:        id,
		Name:      name,
		Path:      path,
		Type:      iwadType,
		LumpCount: 2345,
		Size:      14677988,
		SHA256:    "abcdef1234567890",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := h.iwads.Create(iwad); err != nil {
		t.Fatalf("seedIWAD failed: %v", err)
	}
	return iwad
}

func seedMod(t *testing.T, h *testHarness, id, name, path string, format domain.ModFormat) *domain.Mod {
	t.Helper()
	mod := &domain.Mod{
		ID:         id,
		Name:       name,
		Path:       path,
		Format:     format,
		Category:   domain.ModCategoryGameplay,
		Size:       5000000,
		ModifiedAt: time.Now().UTC(),
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	}
	if err := h.mods.Create(mod); err != nil {
		t.Fatalf("seedMod failed: %v", err)
	}
	return mod
}

func TestProfileService_Constructors(t *testing.T) {
	h := setupTestHarness(t)

	svc1 := profiles.New(h.profiles, h.mods, h.iwads, h.engines)
	if svc1 == nil {
		t.Fatal("profiles.New returned nil")
	}

	svc2 := profiles.NewProfileService(h.profiles, h.mods, h.iwads, h.engines)
	if svc2 == nil {
		t.Fatal("profiles.NewProfileService returned nil")
	}
}

func TestProfileService_CRUD(t *testing.T) {
	ctx := context.Background()
	h := setupTestHarness(t)

	eng := seedEngine(t, h, "eng-gzdoom", "GZDoom", "C:/Games/Doom/gzdoom.exe")
	iwad := seedIWAD(t, h, "iwad-doom2", "Doom II", "C:/Games/Doom/DOOM2.WAD", domain.IWADTypeDoom2)
	mod1 := seedMod(t, h, "mod-brutal", "Brutal Doom", "C:/Games/Doom/mods/brutalv21.pk3", domain.ModFormatPK3)
	mod2 := seedMod(t, h, "mod-nashgore", "NashGore", "C:/Games/Doom/mods/nashgore.pk3", domain.ModFormatPK3)

	// 1. Create Profile with valid inputs
	newProf := domain.Profile{
		Name:        "Brutal Doom Run",
		Description: "Action packed campaign",
		EngineID:    eng.ID,
		IWADID:      iwad.ID,
		Arguments:   []string{"-skill", "4", "-warp", "01"},
		WorkingDir:  "C:/Games/Doom",
		Mods: []domain.ProfileMod{
			{ModID: mod1.ID, Enabled: true, Order: 1},
			{ModID: mod2.ID, Enabled: true, Order: 2},
		},
	}

	created, err := h.svc.Create(ctx, newProf)
	if err != nil {
		t.Fatalf("Create profile failed: %v", err)
	}
	if created == nil {
		t.Fatal("expected created profile not to be nil")
	}
	if created.ID == "" {
		t.Error("expected generated profile ID")
	}
	if created.Name != "Brutal Doom Run" {
		t.Errorf("expected name 'Brutal Doom Run', got %q", created.Name)
	}
	if created.EngineName != "GZDoom" {
		t.Errorf("expected engine name 'GZDoom', got %q", created.EngineName)
	}
	if created.IWADName != "Doom II" {
		t.Errorf("expected IWAD name 'Doom II', got %q", created.IWADName)
	}
	if len(created.Mods) != 2 {
		t.Fatalf("expected 2 mods, got %d", len(created.Mods))
	}
	if len(created.Arguments) != 4 {
		t.Fatalf("expected 4 arguments, got %d", len(created.Arguments))
	}

	// 2. Get Profile
	fetched, err := h.svc.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("Get profile failed: %v", err)
	}
	if fetched == nil || fetched.ID != created.ID {
		t.Fatalf("expected profile ID %q, got %+v", created.ID, fetched)
	}
	if len(fetched.Mods) != 2 {
		t.Fatalf("expected 2 mods on fetched profile, got %d", len(fetched.Mods))
	}

	// 3. List Profiles
	all, err := h.svc.List(ctx)
	if err != nil {
		t.Fatalf("List profiles failed: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("expected 1 profile in list, got %d", len(all))
	}
	if all[0].ID != created.ID {
		t.Errorf("expected profile ID %q in list, got %q", created.ID, all[0].ID)
	}

	// 4. Update Profile
	fetched.Name = "Brutal Doom Ultra Run"
	fetched.Description = "Updated description"
	fetched.Arguments = []string{"-skill", "5"}
	if err := h.svc.Update(ctx, *fetched); err != nil {
		t.Fatalf("Update profile failed: %v", err)
	}

	updated, err := h.svc.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("Get profile after update failed: %v", err)
	}
	if updated.Name != "Brutal Doom Ultra Run" {
		t.Errorf("expected updated name, got %q", updated.Name)
	}
	if len(updated.Arguments) != 2 || updated.Arguments[1] != "5" {
		t.Errorf("expected updated arguments [-skill 5], got %v", updated.Arguments)
	}

	// 5. Delete Profile
	if err := h.svc.Delete(ctx, created.ID); err != nil {
		t.Fatalf("Delete profile failed: %v", err)
	}

	deleted, err := h.svc.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("Get after delete returned error: %v", err)
	}
	if deleted != nil {
		t.Errorf("expected nil profile after delete, got %+v", deleted)
	}
}

func TestProfileService_CreateValidationErrors(t *testing.T) {
	ctx := context.Background()
	h := setupTestHarness(t)

	// Empty name
	_, err := h.svc.Create(ctx, domain.Profile{Name: "  "})
	if err == nil {
		t.Error("expected error creating profile with empty name, got nil")
	}

	// Empty ID in update
	err = h.svc.Update(ctx, domain.Profile{ID: "", Name: "Valid"})
	if err == nil {
		t.Error("expected error updating profile with empty ID, got nil")
	}

	// Empty Name in update
	err = h.svc.Update(ctx, domain.Profile{ID: "some-id", Name: ""})
	if err == nil {
		t.Error("expected error updating profile with empty Name, got nil")
	}

	// Empty ID in Get, Delete, Duplicate, ToggleFavorite
	if _, err := h.svc.Get(ctx, ""); err == nil {
		t.Error("expected error getting empty profile ID")
	}
	if err := h.svc.Delete(ctx, ""); err == nil {
		t.Error("expected error deleting empty profile ID")
	}
	if _, err := h.svc.Duplicate(ctx, "", "Copy"); err == nil {
		t.Error("expected error duplicating empty profile ID")
	}
	if err := h.svc.ToggleFavorite(ctx, ""); err == nil {
		t.Error("expected error toggling favorite for empty profile ID")
	}
}

func TestProfileService_Duplicate(t *testing.T) {
	ctx := context.Background()
	h := setupTestHarness(t)

	eng := seedEngine(t, h, "eng-1", "GZDoom", "gzdoom.exe")
	mod1 := seedMod(t, h, "mod-1", "Mod One", "mod1.pk3", domain.ModFormatPK3)

	p, err := h.svc.Create(ctx, domain.Profile{
		Name:      "Original Profile",
		EngineID:  eng.ID,
		Arguments: []string{"-fast"},
		Mods: []domain.ProfileMod{
			{ModID: mod1.ID, Enabled: true, Order: 1},
		},
	})
	if err != nil {
		t.Fatalf("Create profile failed: %v", err)
	}

	// Duplicate with custom name
	dup1, err := h.svc.Duplicate(ctx, p.ID, "Cloned Profile")
	if err != nil {
		t.Fatalf("Duplicate with custom name failed: %v", err)
	}
	if dup1.ID == p.ID {
		t.Error("expected duplicated profile to have unique ID")
	}
	if dup1.Name != "Cloned Profile" {
		t.Errorf("expected name 'Cloned Profile', got %q", dup1.Name)
	}
	if len(dup1.Mods) != 1 || dup1.Mods[0].ModID != mod1.ID {
		t.Errorf("expected duplicated mods, got %+v", dup1.Mods)
	}

	// Duplicate with empty name (fallback to (Copy))
	dup2, err := h.svc.Duplicate(ctx, p.ID, "")
	if err != nil {
		t.Fatalf("Duplicate with empty name failed: %v", err)
	}
	if dup2.Name != "Original Profile (Copy)" {
		t.Errorf("expected default copy name 'Original Profile (Copy)', got %q", dup2.Name)
	}

	// Duplicate non-existent profile
	_, err = h.svc.Duplicate(ctx, "non-existent-id", "Copy")
	if err == nil {
		t.Error("expected error duplicating non-existent profile, got nil")
	}
}

func TestProfileService_ToggleFavorite(t *testing.T) {
	ctx := context.Background()
	h := setupTestHarness(t)

	p, err := h.svc.Create(ctx, domain.Profile{
		Name: "Favorite Test Profile",
	})
	if err != nil {
		t.Fatalf("Create profile failed: %v", err)
	}
	if p.IsFavorite {
		t.Error("expected default IsFavorite to be false")
	}

	// Toggle to true
	if err := h.svc.ToggleFavorite(ctx, p.ID); err != nil {
		t.Fatalf("ToggleFavorite failed: %v", err)
	}
	fav1, _ := h.svc.Get(ctx, p.ID)
	if !fav1.IsFavorite {
		t.Error("expected IsFavorite to be true after toggle")
	}

	// Toggle back to false
	if err := h.svc.ToggleFavorite(ctx, p.ID); err != nil {
		t.Fatalf("ToggleFavorite (second) failed: %v", err)
	}
	fav2, _ := h.svc.Get(ctx, p.ID)
	if fav2.IsFavorite {
		t.Error("expected IsFavorite to be false after second toggle")
	}
}

func TestProfileService_ModManagement(t *testing.T) {
	ctx := context.Background()
	h := setupTestHarness(t)

	mod1 := seedMod(t, h, "mod-1", "Mod Alpha", "alpha.pk3", domain.ModFormatPK3)
	mod2 := seedMod(t, h, "mod-2", "Mod Beta", "beta.pk3", domain.ModFormatPK3)
	mod3 := seedMod(t, h, "mod-3", "Mod Gamma", "gamma.pk3", domain.ModFormatPK3)

	p, err := h.svc.Create(ctx, domain.Profile{
		Name: "Mod Operations Profile",
		Mods: []domain.ProfileMod{
			{ModID: mod1.ID, Enabled: true, Order: 1},
		},
	})
	if err != nil {
		t.Fatalf("Create profile failed: %v", err)
	}

	// 1. AddMod
	if err := h.svc.AddMod(ctx, p.ID, mod2.ID); err != nil {
		t.Fatalf("AddMod failed: %v", err)
	}
	if err := h.svc.AddMod(ctx, p.ID, mod3.ID); err != nil {
		t.Fatalf("AddMod failed: %v", err)
	}

	// AddMod duplicate should be no-op
	if err := h.svc.AddMod(ctx, p.ID, mod2.ID); err != nil {
		t.Fatalf("AddMod duplicate returned unexpected error: %v", err)
	}

	// AddMod with invalid profile / mod
	if err := h.svc.AddMod(ctx, "non-existent-profile", mod1.ID); err == nil {
		t.Error("expected error adding mod to non-existent profile")
	}
	if err := h.svc.AddMod(ctx, p.ID, "non-existent-mod"); err == nil {
		t.Error("expected error adding non-existent mod")
	}
	if err := h.svc.AddMod(ctx, "", mod1.ID); err == nil {
		t.Error("expected error with empty profile ID")
	}
	if err := h.svc.AddMod(ctx, p.ID, ""); err == nil {
		t.Error("expected error with empty mod ID")
	}

	pUpdated, _ := h.svc.Get(ctx, p.ID)
	if len(pUpdated.Mods) != 3 {
		t.Fatalf("expected 3 mods, got %d", len(pUpdated.Mods))
	}
	if pUpdated.Mods[0].ModID != mod1.ID || pUpdated.Mods[1].ModID != mod2.ID || pUpdated.Mods[2].ModID != mod3.ID {
		t.Errorf("unexpected mod order after additions: %+v", pUpdated.Mods)
	}

	// 2. ToggleMod
	if err := h.svc.ToggleMod(ctx, p.ID, mod2.ID, false); err != nil {
		t.Fatalf("ToggleMod to false failed: %v", err)
	}
	pToggled, _ := h.svc.Get(ctx, p.ID)
	for _, m := range pToggled.Mods {
		if m.ModID == mod2.ID && m.Enabled {
			t.Errorf("expected mod2 to be disabled, got enabled")
		}
	}

	// Toggle non-existent mod
	if err := h.svc.ToggleMod(ctx, p.ID, "non-existent-mod", true); err == nil {
		t.Error("expected error toggling non-existent mod, got nil")
	}
	if err := h.svc.ToggleMod(ctx, "", mod1.ID, true); err == nil {
		t.Error("expected error toggling mod with empty profile ID")
	}
	if err := h.svc.ToggleMod(ctx, p.ID, "", true); err == nil {
		t.Error("expected error toggling mod with empty mod ID")
	}

	// 3. ReorderMods
	// Reorder to: mod3, mod1, mod2
	if err := h.svc.ReorderMods(ctx, p.ID, []string{mod3.ID, mod1.ID, mod2.ID}); err != nil {
		t.Fatalf("ReorderMods failed: %v", err)
	}
	pReordered, _ := h.svc.Get(ctx, p.ID)
	if len(pReordered.Mods) != 3 {
		t.Fatalf("expected 3 mods after reorder, got %d", len(pReordered.Mods))
	}
	if pReordered.Mods[0].ModID != mod3.ID || pReordered.Mods[0].Order != 1 {
		t.Errorf("expected first mod to be mod3, got %+v", pReordered.Mods[0])
	}
	if pReordered.Mods[1].ModID != mod1.ID || pReordered.Mods[1].Order != 2 {
		t.Errorf("expected second mod to be mod1, got %+v", pReordered.Mods[1])
	}
	if pReordered.Mods[2].ModID != mod2.ID || pReordered.Mods[2].Order != 3 {
		t.Errorf("expected third mod to be mod2, got %+v", pReordered.Mods[2])
	}

	if err := h.svc.ReorderMods(ctx, "", []string{mod1.ID}); err == nil {
		t.Error("expected error reordering mods with empty profile ID")
	}
	if err := h.svc.ReorderMods(ctx, "non-existent-profile", []string{mod1.ID}); err == nil {
		t.Error("expected error reordering mods on non-existent profile")
	}

	// 4. RemoveMod
	if err := h.svc.RemoveMod(ctx, p.ID, mod1.ID); err != nil {
		t.Fatalf("RemoveMod failed: %v", err)
	}
	pRemoved, _ := h.svc.Get(ctx, p.ID)
	if len(pRemoved.Mods) != 2 {
		t.Fatalf("expected 2 mods after remove, got %d", len(pRemoved.Mods))
	}
	if pRemoved.Mods[0].ModID != mod3.ID || pRemoved.Mods[0].Order != 1 {
		t.Errorf("expected mod3 at order 1, got %+v", pRemoved.Mods[0])
	}
	if pRemoved.Mods[1].ModID != mod2.ID || pRemoved.Mods[1].Order != 2 {
		t.Errorf("expected mod2 at order 2, got %+v", pRemoved.Mods[1])
	}

	if err := h.svc.RemoveMod(ctx, "", mod2.ID); err == nil {
		t.Error("expected error removing mod with empty profile ID")
	}
	if err := h.svc.RemoveMod(ctx, p.ID, ""); err == nil {
		t.Error("expected error removing mod with empty mod ID")
	}
	if err := h.svc.RemoveMod(ctx, "non-existent-profile", mod2.ID); err == nil {
		t.Error("expected error removing mod on non-existent profile")
	}
}

func TestProfileService_ExportYAML(t *testing.T) {
	ctx := context.Background()
	h := setupTestHarness(t)

	eng := seedEngine(t, h, "eng-gzdoom", "GZDoom 4.14", "gzdoom.exe")
	iwad := seedIWAD(t, h, "iwad-doom2", "Doom II", "DOOM2.WAD", domain.IWADTypeDoom2)
	mod1 := seedMod(t, h, "mod-brutal", "Brutal Doom", "mods/brutal.pk3", domain.ModFormatPK3)
	mod2 := seedMod(t, h, "mod-nashgore", "NashGore", "mods/nashgore.pk3", domain.ModFormatPK3)

	p, err := h.svc.Create(ctx, domain.Profile{
		Name:        "Export Test Profile",
		Description: "Testing YAML Export",
		EngineID:    eng.ID,
		IWADID:      iwad.ID,
		Arguments:   []string{"-skill", "4"},
		WorkingDir:  "C:/Games/Doom",
		Mods: []domain.ProfileMod{
			{ModID: mod2.ID, Enabled: false, Order: 2},
			{ModID: mod1.ID, Enabled: true, Order: 1},
		},
	})
	if err != nil {
		t.Fatalf("Create profile failed: %v", err)
	}

	yamlBytes, err := h.svc.ExportYAML(ctx, p.ID)
	if err != nil {
		t.Fatalf("ExportYAML failed: %v", err)
	}
	if len(yamlBytes) == 0 {
		t.Fatal("expected non-empty YAML bytes")
	}

	// Verify unmarshaling the exported YAML
	var exportFile profiles.ProfileExportFile
	if err := yaml.Unmarshal(yamlBytes, &exportFile); err != nil {
		t.Fatalf("yaml.Unmarshal exported payload failed: %v", err)
	}

	if exportFile.Version != 1 {
		t.Errorf("expected version 1, got %d", exportFile.Version)
	}
	if exportFile.Profile.Name != "Export Test Profile" {
		t.Errorf("expected profile name 'Export Test Profile', got %q", exportFile.Profile.Name)
	}
	if exportFile.Profile.Engine.ID != eng.ID || exportFile.Profile.Engine.Name != eng.Name {
		t.Errorf("unexpected engine metadata in export: %+v", exportFile.Profile.Engine)
	}
	if exportFile.Profile.IWAD.ID != iwad.ID || exportFile.Profile.IWAD.Name != iwad.Name {
		t.Errorf("unexpected IWAD metadata in export: %+v", exportFile.Profile.IWAD)
	}
	if len(exportFile.Profile.Mods) != 2 {
		t.Fatalf("expected 2 mods in export, got %d", len(exportFile.Profile.Mods))
	}
	// Verify mods are exported in order (order 1 then order 2)
	if exportFile.Profile.Mods[0].ID != mod1.ID || exportFile.Profile.Mods[0].Order != 1 {
		t.Errorf("expected mod1 first in export, got %+v", exportFile.Profile.Mods[0])
	}
	if exportFile.Profile.Mods[1].ID != mod2.ID || exportFile.Profile.Mods[1].Order != 2 || exportFile.Profile.Mods[1].Enabled {
		t.Errorf("expected mod2 second in export (disabled), got %+v", exportFile.Profile.Mods[1])
	}
	if len(exportFile.Profile.Arguments) != 2 || exportFile.Profile.Arguments[0] != "-skill" {
		t.Errorf("unexpected arguments in export: %v", exportFile.Profile.Arguments)
	}
	if exportFile.Profile.WorkingDir != "C:/Games/Doom" {
		t.Errorf("unexpected working dir: %q", exportFile.Profile.WorkingDir)
	}

	// Test ExportYAML errors
	if _, err := h.svc.ExportYAML(ctx, ""); err == nil {
		t.Error("expected error exporting empty profile ID")
	}
	if _, err := h.svc.ExportYAML(ctx, "non-existent-profile"); err == nil {
		t.Error("expected error exporting non-existent profile")
	}
}

func TestProfileService_ImportYAML_FullResolution(t *testing.T) {
	ctx := context.Background()
	h := setupTestHarness(t)

	eng := seedEngine(t, h, "eng-gzdoom", "GZDoom", "gzdoom.exe")
	iwad := seedIWAD(t, h, "iwad-doom2", "Doom II", "DOOM2.WAD", domain.IWADTypeDoom2)
	mod1 := seedMod(t, h, "mod-brutal", "Brutal Doom", "mods/brutal.pk3", domain.ModFormatPK3)
	mod2 := seedMod(t, h, "mod-maps", "Map Pack", "mods/maps.wad", domain.ModFormatWAD)

	yamlContent := `
version: 1
profile:
  id: brutal-doom-import
  name: Imported Brutal Profile
  description: Profile imported from friend
  engine:
    id: eng-gzdoom
    name: GZDoom
  iwad:
    id: iwad-doom2
    name: Doom II
  mods:
    - id: mod-brutal
      name: Brutal Doom
      path: mods/brutal.pk3
      enabled: true
      order: 1
    - id: mod-maps
      name: Map Pack
      path: mods/maps.wad
      enabled: false
      order: 2
  arguments:
    - "-fast"
    - "-respawn"
  working_dir: "C:/Doom"
`

	imported, warnings, err := h.svc.ImportYAML(ctx, []byte(yamlContent))
	if err != nil {
		t.Fatalf("ImportYAML failed: %v", err)
	}
	if imported == nil {
		t.Fatal("expected imported profile not to be nil")
	}
	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings on full resolution import, got %d: %+v", len(warnings), warnings)
	}
	if imported.Name != "Imported Brutal Profile" {
		t.Errorf("expected name 'Imported Brutal Profile', got %q", imported.Name)
	}
	if imported.EngineID != eng.ID {
		t.Errorf("expected engine ID %q, got %q", eng.ID, imported.EngineID)
	}
	if imported.IWADID != iwad.ID {
		t.Errorf("expected IWAD ID %q, got %q", iwad.ID, imported.IWADID)
	}
	if len(imported.Mods) != 2 {
		t.Fatalf("expected 2 mods, got %d", len(imported.Mods))
	}
	if imported.Mods[0].ModID != mod1.ID || !imported.Mods[0].Enabled {
		t.Errorf("expected mod1 enabled, got %+v", imported.Mods[0])
	}
	if imported.Mods[1].ModID != mod2.ID || imported.Mods[1].Enabled {
		t.Errorf("expected mod2 disabled, got %+v", imported.Mods[1])
	}

	// Verify persistence in DB
	stored, err := h.svc.Get(ctx, imported.ID)
	if err != nil {
		t.Fatalf("Get imported profile from DB failed: %v", err)
	}
	if stored == nil || len(stored.Mods) != 2 {
		t.Fatalf("expected stored profile with 2 mods, got %+v", stored)
	}
}

func TestProfileService_ImportYAML_MatchByNameAndPath(t *testing.T) {
	ctx := context.Background()
	h := setupTestHarness(t)

	eng := seedEngine(t, h, "eng-123", "GZDoom Custom Port", "C:/Engine/gzdoom.exe")
	iwad := seedIWAD(t, h, "iwad-456", "Ultimate Doom IWAD", "C:/IWAD/DOOM.WAD", domain.IWADTypeDoom)
	mod := seedMod(t, h, "mod-789", "Smooth Doom Mod", "C:/DoomMods/smooth.pk3", domain.ModFormatPK3)

	// In YAML, we don't provide IDs for engine, iwad, or mod, but match by Name/Path
	yamlContent := `
version: 1
profile:
  name: Name Matched Profile
  engine:
    name: GZDoom Custom Port
  iwad:
    name: Ultimate Doom IWAD
  mods:
    - name: Smooth Doom Mod
      path: C:/DoomMods/smooth.pk3
      enabled: true
      order: 1
`

	imported, warnings, err := h.svc.ImportYAML(ctx, []byte(yamlContent))
	if err != nil {
		t.Fatalf("ImportYAML failed: %v", err)
	}
	if len(warnings) != 0 {
		t.Errorf("expected 0 warnings on name/path resolution, got %d: %+v", len(warnings), warnings)
	}
	if imported.EngineID != eng.ID {
		t.Errorf("expected matched engine ID %q, got %q", eng.ID, imported.EngineID)
	}
	if imported.IWADID != iwad.ID {
		t.Errorf("expected matched IWAD ID %q, got %q", iwad.ID, imported.IWADID)
	}
	if len(imported.Mods) != 1 || imported.Mods[0].ModID != mod.ID {
		t.Errorf("expected matched mod ID %q, got %+v", mod.ID, imported.Mods)
	}
}

func TestProfileService_ImportYAML_PartialResolution_MissingItems(t *testing.T) {
	ctx := context.Background()
	h := setupTestHarness(t)

	// Local library has only one mod registered
	existingMod := seedMod(t, h, "mod-local", "Local Mod", "mods/local.pk3", domain.ModFormatPK3)

	yamlContent := `
version: 1
profile:
  name: Missing Content Profile
  description: Has missing engine, iwad, and some mods
  engine:
    id: unknown-engine-id
    name: Unknown Port 9.9
  iwad:
    id: unknown-iwad-id
    name: Plutonia Experiment
  mods:
    - id: mod-local
      name: Local Mod
      path: mods/local.pk3
      enabled: true
      order: 1
    - id: missing-mod-1
      name: Missing Weapon Pack
      path: mods/weapons.pk3
      enabled: true
      order: 2
  arguments:
    - "-nomonsters"
`

	imported, warnings, err := h.svc.ImportYAML(ctx, []byte(yamlContent))
	if err != nil {
		t.Fatalf("ImportYAML with missing items should succeed, but failed: %v", err)
	}
	if imported == nil {
		t.Fatal("expected imported profile not to be nil")
	}

	// Expect 3 warnings: missing engine, missing iwad, missing mod
	if len(warnings) != 3 {
		t.Fatalf("expected 3 validation warnings, got %d: %+v", len(warnings), warnings)
	}

	hasMissingEngine := false
	hasMissingIWAD := false
	hasMissingMod := false

	for _, w := range warnings {
		if w.Severity != domain.ValidationSeverityWarning {
			t.Errorf("expected warning severity, got %v", w.Severity)
		}
		if w.Code == "MISSING_ENGINE" {
			hasMissingEngine = true
		}
		if w.Code == "MISSING_IWAD" {
			hasMissingIWAD = true
		}
		if w.Code == "MISSING_MOD" {
			hasMissingMod = true
		}
	}

	if !hasMissingEngine {
		t.Error("missing expected MISSING_ENGINE warning")
	}
	if !hasMissingIWAD {
		t.Error("missing expected MISSING_IWAD warning")
	}
	if !hasMissingMod {
		t.Error("missing expected MISSING_MOD warning")
	}

	// The profile should still have both mods preserved
	if len(imported.Mods) != 2 {
		t.Fatalf("expected 2 mods in imported profile, got %d", len(imported.Mods))
	}
	if imported.Mods[0].ModID != existingMod.ID {
		t.Errorf("expected first mod to match existingMod.ID, got %q", imported.Mods[0].ModID)
	}

	// Second mod should have placeholder properties and be stored
	missingModEntry := imported.Mods[1]
	if missingModEntry.ModName != "Missing Weapon Pack" {
		t.Errorf("expected mod name 'Missing Weapon Pack', got %q", missingModEntry.ModName)
	}

	// Verify imported profile can be fetched from DB
	stored, err := h.svc.Get(ctx, imported.ID)
	if err != nil {
		t.Fatalf("Get stored profile failed: %v", err)
	}
	if stored == nil {
		t.Fatal("expected stored profile in DB")
	}
	if len(stored.Mods) != 2 {
		t.Errorf("expected 2 stored mods, got %d", len(stored.Mods))
	}
}

func TestProfileService_ImportYAML_ValidationErrors(t *testing.T) {
	ctx := context.Background()
	h := setupTestHarness(t)

	// 1. Empty data
	_, _, err := h.svc.ImportYAML(ctx, []byte(""))
	if err == nil {
		t.Error("expected error on empty YAML data, got nil")
	}

	// 2. Invalid syntax
	_, _, err = h.svc.ImportYAML(ctx, []byte("version: [invalid yaml"))
	if err == nil {
		t.Error("expected error on invalid syntax, got nil")
	}

	// 3. Unsupported version
	unsupportedVer := `
version: 2
profile:
  name: Future Version Profile
`
	_, _, err = h.svc.ImportYAML(ctx, []byte(unsupportedVer))
	if err == nil || !strings.Contains(err.Error(), "unsupported profile YAML version") {
		t.Errorf("expected unsupported version error, got %v", err)
	}

	// 4. Missing profile name
	missingName := `
version: 1
profile:
  name: "   "
`
	_, _, err = h.svc.ImportYAML(ctx, []byte(missingName))
	if err == nil || !strings.Contains(err.Error(), "profile name is required") {
		t.Errorf("expected missing name error, got %v", err)
	}
}

func TestProfileService_ContextCancellationAndNilSafety(t *testing.T) {
	h := setupTestHarness(t)

	cancellingCtx, cancel := context.WithCancel(context.Background())
	cancel()

	// Operations should return context error when context is cancelled
	if _, err := h.svc.List(cancellingCtx); err == nil {
		t.Error("expected context error on List")
	}
	if _, err := h.svc.Get(cancellingCtx, "id"); err == nil {
		t.Error("expected context error on Get")
	}
	if _, err := h.svc.Create(cancellingCtx, domain.Profile{Name: "X"}); err == nil {
		t.Error("expected context error on Create")
	}
	if err := h.svc.Update(cancellingCtx, domain.Profile{ID: "1", Name: "X"}); err == nil {
		t.Error("expected context error on Update")
	}
	if err := h.svc.Delete(cancellingCtx, "id"); err == nil {
		t.Error("expected context error on Delete")
	}
	if _, err := h.svc.Duplicate(cancellingCtx, "id", "name"); err == nil {
		t.Error("expected context error on Duplicate")
	}
	if err := h.svc.ToggleFavorite(cancellingCtx, "id"); err == nil {
		t.Error("expected context error on ToggleFavorite")
	}
	if err := h.svc.AddMod(cancellingCtx, "p", "m"); err == nil {
		t.Error("expected context error on AddMod")
	}
	if err := h.svc.RemoveMod(cancellingCtx, "p", "m"); err == nil {
		t.Error("expected context error on RemoveMod")
	}
	if err := h.svc.ReorderMods(cancellingCtx, "p", []string{"m"}); err == nil {
		t.Error("expected context error on ReorderMods")
	}
	if err := h.svc.ToggleMod(cancellingCtx, "p", "m", true); err == nil {
		t.Error("expected context error on ToggleMod")
	}
	if _, err := h.svc.ExportYAML(cancellingCtx, "id"); err == nil {
		t.Error("expected context error on ExportYAML")
	}
	if _, _, err := h.svc.ImportYAML(cancellingCtx, []byte("version: 1")); err == nil {
		t.Error("expected context error on ImportYAML")
	}

	// Nil service safety
	var nilSvc *profiles.ProfileService
	ctx := context.Background()
	if _, err := nilSvc.List(ctx); err == nil {
		t.Error("expected error on nil service List")
	}
	if _, err := nilSvc.Get(ctx, "id"); err == nil {
		t.Error("expected error on nil service Get")
	}
}

func TestProfileService_ImportZDL(t *testing.T) {
	h := setupTestHarness(t)
	ctx := context.Background()

	// Seed Engine, IWAD, and Mod in SQLite
	eng := seedEngine(t, h, "eng-1", "GZDoom", "C:/Games/Doom/gzdoom.exe")
	iwad := seedIWAD(t, h, "iwad-1", "DOOM 2: Hell on Earth", "C:/Games/Doom/DOOM2.WAD", domain.IWADTypeDoom2)
	mod1 := seedMod(t, h, "mod-1", "Brutal Doom", "C:/Games/Doom/mods/bd21.pk3", domain.ModFormatPK3)

	zdlContent := `
[zdl.save]
port=GZDoom
iwad=DOOM2.WAD
file_0=C:\Games\Doom\mods\bd21.pk3
file_0_enabled=1
file_1=C:\Games\Doom\mods\unresolved_mod.pk3
file_1_enabled=0
custom_params=-fast -nomonsters
warp=MAP01
skill=4
`

	prof, warnings, err := h.svc.ImportZDL(ctx, []byte(zdlContent))
	if err != nil {
		t.Fatalf("ImportZDL failed: %v", err)
	}

	if prof == nil {
		t.Fatal("expected non-nil profile")
	}

	if prof.EngineID != eng.ID {
		t.Errorf("expected engine ID %s, got %s", eng.ID, prof.EngineID)
	}
	if prof.IWADID != iwad.ID {
		t.Errorf("expected iwad ID %s, got %s", iwad.ID, prof.IWADID)
	}

	if len(prof.Mods) != 2 {
		t.Fatalf("expected 2 mods, got %d", len(prof.Mods))
	}

	if prof.Mods[0].ModID != mod1.ID || !prof.Mods[0].Enabled {
		t.Errorf("unexpected mod 0: %+v", prof.Mods[0])
	}
	if prof.Mods[1].ModName != "unresolved_mod.pk3" || prof.Mods[1].Enabled {
		t.Errorf("unexpected mod 1: %+v", prof.Mods[1])
	}
	// Warnings should contain missing mod warning for unresolved_mod.pk3
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d: %+v", len(warnings), warnings)
	}
	if warnings[0].Code != "MISSING_MOD" {
		t.Errorf("expected MISSING_MOD warning, got %+v", warnings[0])
	}

	// Check custom arguments include -fast, -nomonsters, -warp MAP01, -skill 4
	argStr := strings.Join(prof.Arguments, " ")
	if !strings.Contains(argStr, "-fast") || !strings.Contains(argStr, "-nomonsters") ||
		!strings.Contains(argStr, "-warp MAP01") || !strings.Contains(argStr, "-skill 4") {
		t.Errorf("unexpected arguments: %v", prof.Arguments)
	}
}
