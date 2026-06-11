package database

import (
	"path/filepath"
	"testing"
	"time"

	"rnt-launcher/internal/domain"
)

func setupTestDB(t *testing.T) *Repositories {
	t.Helper()
	db, err := InitDB(":memory:")
	if err != nil {
		t.Fatalf("InitDB(:memory:) failed: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})
	return NewRepositories(db)
}

func setupTempFileDB(t *testing.T) *Repositories {
	t.Helper()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")
	db, err := InitDB(dbPath)
	if err != nil {
		t.Fatalf("InitDB(%s) failed: %v", dbPath, err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})
	return NewRepositories(db)
}

func TestInitDB_Disk(t *testing.T) {
	repos := setupTempFileDB(t)
	if repos == nil {
		t.Fatal("expected non-nil Repositories")
	}

	settings, err := repos.Settings.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	if settings.Theme != "dark" {
		t.Errorf("expected default theme 'dark', got %s", settings.Theme)
	}
}

func TestEngineRepository_CRUD(t *testing.T) {
	repos := setupTestDB(t)

	// List empty
	list, err := repos.Engines.List()
	if err != nil {
		t.Fatalf("List() failed: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("expected 0 engines, got %d", len(list))
	}

	// Create
	engine1 := &domain.Engine{
		Name:       "GZDoom",
		Executable: "C:\\Doom\\gzdoom.exe",
		Version:    "4.12.2",
		Family:     domain.EngineFamilyGZDoom,
	}
	if err := repos.Engines.Create(engine1); err != nil {
		t.Fatalf("Create() engine1 failed: %v", err)
	}
	if engine1.ID == "" {
		t.Fatal("expected engine1.ID to be populated with UUID")
	}
	if engine1.CreatedAt.IsZero() {
		t.Fatal("expected engine1.CreatedAt to be populated")
	}

	engine2 := &domain.Engine{
		Name:       "Crispy Doom",
		Executable: "C:\\Doom\\crispy-doom.exe",
		Version:    "6.0.0",
		Family:     domain.EngineFamilyCrispyDoom,
	}
	if err := repos.Engines.Create(engine2); err != nil {
		t.Fatalf("Create() engine2 failed: %v", err)
	}

	// Get
	fetched, err := repos.Engines.Get(engine1.ID)
	if err != nil {
		t.Fatalf("Get(%s) failed: %v", engine1.ID, err)
	}
	if fetched.Name != "GZDoom" || fetched.Family != domain.EngineFamilyGZDoom || fetched.Version != "4.12.2" {
		t.Errorf("unexpected fetched engine: %+v", fetched)
	}

	// List
	list, err = repos.Engines.List()
	if err != nil {
		t.Fatalf("List() failed: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 engines, got %d", len(list))
	}
	// Alphabetical order: Crispy Doom before GZDoom
	if list[0].Name != "Crispy Doom" || list[1].Name != "GZDoom" {
		t.Errorf("engines not sorted alphabetically: %+v", list)
	}

	// Update
	fetched.Version = "4.13.0"
	fetched.Name = "GZDoom Latest"
	if err := repos.Engines.Update(fetched); err != nil {
		t.Fatalf("Update() failed: %v", err)
	}

	updated, err := repos.Engines.Get(engine1.ID)
	if err != nil {
		t.Fatalf("Get(%s) after update failed: %v", engine1.ID, err)
	}
	if updated.Version != "4.13.0" || updated.Name != "GZDoom Latest" {
		t.Errorf("engine update not reflected: %+v", updated)
	}

	// Delete
	if err := repos.Engines.Delete(engine2.ID); err != nil {
		t.Fatalf("Delete() failed: %v", err)
	}

	listAfterDelete, err := repos.Engines.List()
	if err != nil {
		t.Fatalf("List() after delete failed: %v", err)
	}
	if len(listAfterDelete) != 1 {
		t.Fatalf("expected 1 engine after delete, got %d", len(listAfterDelete))
	}

	// Get non-existent
	_, err = repos.Engines.Get("non-existent-id")
	if err == nil {
		t.Fatal("expected error getting non-existent engine")
	}
}

func TestIWADRepository_CRUD(t *testing.T) {
	repos := setupTestDB(t)

	// Create
	iwad1 := &domain.IWAD{
		Name:      "DOOM2.WAD",
		Path:      "C:\\Doom\\DOOM2.WAD",
		Type:      domain.IWADTypeDoom2,
		LumpCount: 2919,
		Size:      14604584,
		SHA256:    "abc123sha",
	}
	if err := repos.IWADs.Create(iwad1); err != nil {
		t.Fatalf("Create() iwad1 failed: %v", err)
	}
	if iwad1.ID == "" {
		t.Fatal("expected iwad1.ID to be populated")
	}

	iwad2 := &domain.IWAD{
		Name:      "DOOM.WAD",
		Path:      "C:\\Doom\\DOOM.WAD",
		Type:      domain.IWADTypeDoom,
		LumpCount: 2306,
		Size:      12408252,
		SHA256:    "def456sha",
	}
	if err := repos.IWADs.Create(iwad2); err != nil {
		t.Fatalf("Create() iwad2 failed: %v", err)
	}

	// Get & GetByPath
	byID, err := repos.IWADs.Get(iwad1.ID)
	if err != nil {
		t.Fatalf("Get(%s) failed: %v", iwad1.ID, err)
	}
	if byID.Name != "DOOM2.WAD" || byID.Type != domain.IWADTypeDoom2 || byID.LumpCount != 2919 {
		t.Errorf("unexpected iwad by ID: %+v", byID)
	}

	byPath, err := repos.IWADs.GetByPath("C:\\Doom\\DOOM.WAD")
	if err != nil {
		t.Fatalf("GetByPath failed: %v", err)
	}
	if byPath.ID != iwad2.ID || byPath.Type != domain.IWADTypeDoom {
		t.Errorf("unexpected iwad by Path: %+v", byPath)
	}

	// List
	list, err := repos.IWADs.List()
	if err != nil {
		t.Fatalf("List() failed: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 iwads, got %d", len(list))
	}
	// DOOM.WAD before DOOM2.WAD
	if list[0].Name != "DOOM.WAD" || list[1].Name != "DOOM2.WAD" {
		t.Errorf("unexpected sorting: %+v", list)
	}

	// Update
	iwad1.LumpCount = 2920
	if err := repos.IWADs.Update(iwad1); err != nil {
		t.Fatalf("Update() failed: %v", err)
	}
	updated, err := repos.IWADs.Get(iwad1.ID)
	if err != nil {
		t.Fatalf("Get() failed: %v", err)
	}
	if updated.LumpCount != 2920 {
		t.Errorf("expected lump count 2920, got %d", updated.LumpCount)
	}

	// Delete
	if err := repos.IWADs.Delete(iwad2.ID); err != nil {
		t.Fatalf("Delete() failed: %v", err)
	}
	listAfterDel, _ := repos.IWADs.List()
	if len(listAfterDel) != 1 {
		t.Fatalf("expected 1 iwad remaining, got %d", len(listAfterDel))
	}
}

func TestModRepository_CRUD_Filters_Favorites(t *testing.T) {
	repos := setupTestDB(t)

	now := time.Now().UTC().Truncate(time.Second)

	mod1 := &domain.Mod{
		Name:        "Brutal Doom",
		Path:        "C:\\Doom\\Mods\\bdv21.pk3",
		Format:      domain.ModFormatPK3,
		Category:    domain.ModCategoryGameplay,
		Size:        52428800,
		ModifiedAt:  now,
		SHA256:      "sha_bdv21",
		LumpCount:   150,
		Structures:  []string{"DECORATE", "ZSCRIPT", "SNDINFO"},
		IsFavorite:  true,
	}
	if err := repos.Mods.Create(mod1); err != nil {
		t.Fatalf("Create() mod1 failed: %v", err)
	}
	if mod1.ID == "" {
		t.Fatal("expected mod1.ID to be populated")
	}

	mod2 := &domain.Mod{
		Name:        "Eviternity",
		Path:        "C:\\Doom\\Mods\\eviternity.wad",
		Format:      domain.ModFormatWAD,
		Category:    domain.ModCategoryMegawads,
		Size:        36700160,
		ModifiedAt:  now,
		SHA256:      "sha_evit",
		LumpCount:   32,
		Structures:  []string{"MAPINFO"},
		IsFavorite:  false,
	}
	if err := repos.Mods.Create(mod2); err != nil {
		t.Fatalf("Create() mod2 failed: %v", err)
	}

	mod3 := &domain.Mod{
		Name:        "Ancient Aliens",
		Path:        "C:\\Doom\\Mods\\ancient_aliens.wad",
		Format:      domain.ModFormatWAD,
		Category:    domain.ModCategoryMegawads,
		Size:        45000000,
		ModifiedAt:  now,
		SHA256:      "sha_aa",
		LumpCount:   32,
		Structures:  []string{"MAPINFO", "DEHACKED"},
		IsFavorite:  false,
	}
	if err := repos.Mods.Create(mod3); err != nil {
		t.Fatalf("Create() mod3 failed: %v", err)
	}

	// Get & GetByPath
	byID, err := repos.Mods.Get(mod1.ID)
	if err != nil {
		t.Fatalf("Get(%s) failed: %v", mod1.ID, err)
	}
	if byID.Name != "Brutal Doom" || !byID.IsFavorite || len(byID.Structures) != 3 {
		t.Errorf("unexpected mod by ID: %+v", byID)
	}

	byPath, err := repos.Mods.GetByPath("C:\\Doom\\Mods\\eviternity.wad")
	if err != nil {
		t.Fatalf("GetByPath failed: %v", err)
	}
	if byPath.ID != mod2.ID || byPath.Category != domain.ModCategoryMegawads {
		t.Errorf("unexpected mod by Path: %+v", byPath)
	}

	// Filter: search by name
	searchRes, err := repos.Mods.List(domain.ModFilter{Search: "Aliens"})
	if err != nil {
		t.Fatalf("List(Search) failed: %v", err)
	}
	if len(searchRes) != 1 || searchRes[0].Name != "Ancient Aliens" {
		t.Errorf("search failed: %+v", searchRes)
	}

	// Filter: by Category
	catRes, err := repos.Mods.List(domain.ModFilter{Category: domain.ModCategoryMegawads})
	if err != nil {
		t.Fatalf("List(Category) failed: %v", err)
	}
	if len(catRes) != 2 {
		t.Errorf("expected 2 megawads, got %d", len(catRes))
	}

	// Filter: by Format
	formatRes, err := repos.Mods.List(domain.ModFilter{Format: domain.ModFormatPK3})
	if err != nil {
		t.Fatalf("List(Format) failed: %v", err)
	}
	if len(formatRes) != 1 || formatRes[0].Name != "Brutal Doom" {
		t.Errorf("expected 1 pk3 mod, got %d", len(formatRes))
	}

	// Filter: FavoritesOnly
	favTrue := true
	favRes, err := repos.Mods.List(domain.ModFilter{IsFavorite: &favTrue})
	if err != nil {
		t.Fatalf("List(FavoritesOnly) failed: %v", err)
	}
	if len(favRes) != 1 || favRes[0].Name != "Brutal Doom" {
		t.Errorf("expected 1 favorite, got %d", len(favRes))
	}

	// Toggle Favorite
	newFav, err := repos.Mods.ToggleFavorite(mod2.ID)
	if err != nil {
		t.Fatalf("ToggleFavorite failed: %v", err)
	}
	if !newFav {
		t.Errorf("expected new favorite state true, got false")
	}

	favRes2, _ := repos.Mods.List(domain.ModFilter{IsFavorite: &favTrue})
	if len(favRes2) != 2 {
		t.Errorf("expected 2 favorites after toggle, got %d", len(favRes2))
	}

	// Toggle back to false
	newFav2, err := repos.Mods.ToggleFavorite(mod2.ID)
	if err != nil || newFav2 {
		t.Errorf("expected toggle back to false, got %v (err: %v)", newFav2, err)
	}

	// Pagination limit & offset
	pagedRes, err := repos.Mods.List(domain.ModFilter{Limit: 2, Offset: 0})
	if err != nil {
		t.Fatalf("List(Limit: 2) failed: %v", err)
	}
	if len(pagedRes) != 2 {
		t.Errorf("expected 2 items with limit 2, got %d", len(pagedRes))
	}

	// Update mod
	mod1.Category = domain.ModCategoryWeapons
	mod1.Structures = append(mod1.Structures, "CVARINFO")
	if err := repos.Mods.Update(mod1); err != nil {
		t.Fatalf("Update() failed: %v", err)
	}
	updatedMod, _ := repos.Mods.Get(mod1.ID)
	if updatedMod.Category != domain.ModCategoryWeapons || len(updatedMod.Structures) != 4 {
		t.Errorf("mod update not reflected: %+v", updatedMod)
	}

	// Delete
	if err := repos.Mods.Delete(mod3.ID); err != nil {
		t.Fatalf("Delete() failed: %v", err)
	}
	allMods, _ := repos.Mods.List(domain.ModFilter{})
	if len(allMods) != 2 {
		t.Errorf("expected 2 mods remaining, got %d", len(allMods))
	}
}

func TestProfileRepository_CRUD_Mods_Cascades(t *testing.T) {
	repos := setupTestDB(t)

	// Create dependencies: Engine, IWAD, Mods
	engine := &domain.Engine{Name: "GZDoom 4.12", Executable: "C:\\gzdoom.exe", Family: domain.EngineFamilyGZDoom}
	if err := repos.Engines.Create(engine); err != nil {
		t.Fatalf("failed to create engine: %v", err)
	}

	iwad := &domain.IWAD{Name: "DOOM2", Path: "C:\\doom2.wad", Type: domain.IWADTypeDoom2}
	if err := repos.IWADs.Create(iwad); err != nil {
		t.Fatalf("failed to create iwad: %v", err)
	}

	mod1 := &domain.Mod{Name: "NashGore", Path: "C:\\nashgore.pk3", Format: domain.ModFormatPK3, Category: domain.ModCategoryGameplay}
	if err := repos.Mods.Create(mod1); err != nil {
		t.Fatalf("failed to create mod1: %v", err)
	}
	mod2 := &domain.Mod{Name: "SmoothDoom", Path: "C:\\smoothdoom.pk3", Format: domain.ModFormatPK3, Category: domain.ModCategoryGameplay}
	if err := repos.Mods.Create(mod2); err != nil {
		t.Fatalf("failed to create mod2: %v", err)
	}

	// Create Profile with Mods
	prof := &domain.Profile{
		Name:        "Classic Enhanced",
		Description: "Doom 2 with NashGore and SmoothDoom",
		EngineID:    engine.ID,
		IWADID:      iwad.ID,
		Arguments:   []string{"+set", "cl_run", "1", "-skill", "4"},
		WorkingDir:  "C:\\Doom",
		IsFavorite:  true,
		Mods: []domain.ProfileMod{
			{ModID: mod1.ID, Enabled: true, Order: 0},
			{ModID: mod2.ID, Enabled: true, Order: 1},
		},
	}

	if err := repos.Profiles.Create(prof); err != nil {
		t.Fatalf("Create() profile failed: %v", err)
	}
	if prof.ID == "" {
		t.Fatal("expected profile ID to be set")
	}

	// Fetch Profile
	fetched, err := repos.Profiles.Get(prof.ID)
	if err != nil {
		t.Fatalf("Get(%s) failed: %v", prof.ID, err)
	}
	if fetched.Name != "Classic Enhanced" || fetched.EngineName != "GZDoom 4.12" || fetched.IWADName != "DOOM2" {
		t.Errorf("unexpected profile details: %+v", fetched)
	}
	if len(fetched.Arguments) != 5 || fetched.Arguments[0] != "+set" {
		t.Errorf("unexpected arguments: %+v", fetched.Arguments)
	}
	if len(fetched.Mods) != 2 {
		t.Fatalf("expected 2 profile mods, got %d", len(fetched.Mods))
	}
	if fetched.Mods[0].ModName != "NashGore" || fetched.Mods[1].ModName != "SmoothDoom" {
		t.Errorf("profile mods not hydrated properly: %+v", fetched.Mods)
	}

	// Reorder / update profile mods via SetProfileMods
	reorderedMods := []domain.ProfileMod{
		{ModID: mod2.ID, Enabled: true, Order: 0},
		{ModID: mod1.ID, Enabled: false, Order: 1},
	}
	if err := repos.Profiles.SetProfileMods(prof.ID, reorderedMods); err != nil {
		t.Fatalf("SetProfileMods failed: %v", err)
	}

	pmList, err := repos.Profiles.GetProfileMods(prof.ID)
	if err != nil {
		t.Fatalf("GetProfileMods failed: %v", err)
	}
	if len(pmList) != 2 {
		t.Fatalf("expected 2 profile mods after reorder, got %d", len(pmList))
	}
	if pmList[0].ModID != mod2.ID || !pmList[0].Enabled {
		t.Errorf("expected mod2 first and enabled: %+v", pmList[0])
	}
	if pmList[1].ModID != mod1.ID || pmList[1].Enabled {
		t.Errorf("expected mod1 second and disabled: %+v", pmList[1])
	}

	// Test Duplicate
	dup, err := repos.Profiles.Duplicate(prof.ID, "Classic Enhanced (Copy)")
	if err != nil {
		t.Fatalf("Duplicate failed: %v", err)
	}
	if dup.ID == prof.ID {
		t.Fatal("duplicated profile must have a different ID")
	}
	if dup.Name != "Classic Enhanced (Copy)" {
		t.Errorf("unexpected dup name: %s", dup.Name)
	}
	if dup.IsFavorite {
		t.Errorf("duplicated profile should start as non-favorite")
	}
	if len(dup.Mods) != 2 {
		t.Fatalf("duplicated profile should have 2 mods, got %d", len(dup.Mods))
	}
	if dup.Mods[0].ProfileID != dup.ID {
		t.Errorf("profile mod profile_id should match dup ID, got %s", dup.Mods[0].ProfileID)
	}

	// Test ToggleFavorite on Profile
	newFavState, err := repos.Profiles.ToggleFavorite(prof.ID)
	if err != nil {
		t.Fatalf("ToggleFavorite failed: %v", err)
	}
	if newFavState { // was true, should become false
		t.Errorf("expected favorite to toggle from true to false")
	}

	// Test Foreign Key ON DELETE CASCADE on Mod delete
	// When mod2 is deleted, it should be removed from all profile_mods
	if err := repos.Mods.Delete(mod2.ID); err != nil {
		t.Fatalf("Delete(mod2) failed: %v", err)
	}
	pmAfterModDel, _ := repos.Profiles.GetProfileMods(prof.ID)
	if len(pmAfterModDel) != 1 || pmAfterModDel[0].ModID != mod1.ID {
		t.Errorf("expected only mod1 to remain after mod2 deletion, got %+v", pmAfterModDel)
	}

	// Test Foreign Key ON DELETE SET NULL on Engine delete
	if err := repos.Engines.Delete(engine.ID); err != nil {
		t.Fatalf("Delete(engine) failed: %v", err)
	}
	profAfterEngDel, err := repos.Profiles.Get(prof.ID)
	if err != nil {
		t.Fatalf("Get(profile) after engine delete failed: %v", err)
	}
	if profAfterEngDel.EngineID != "" || profAfterEngDel.EngineName != "" {
		t.Errorf("expected EngineID to be null/empty after engine deleted, got ID: %s, Name: %s", profAfterEngDel.EngineID, profAfterEngDel.EngineName)
	}

	// Test Delete Profile
	if err := repos.Profiles.Delete(prof.ID); err != nil {
		t.Fatalf("Delete(profile) failed: %v", err)
	}
	_, err = repos.Profiles.Get(prof.ID)
	if err == nil {
		t.Fatal("expected error getting deleted profile")
	}
}

func TestHistoryRepository_Stats_Clear(t *testing.T) {
	repos := setupTestDB(t)

	// Initial stats empty
	stats, err := repos.History.GetStats()
	if err != nil {
		t.Fatalf("GetStats() on empty DB failed: %v", err)
	}
	if stats.TotalLaunches != 0 || stats.TotalPlayTimeMs != 0 || stats.LastLaunchedAt != nil {
		t.Errorf("unexpected empty stats: %+v", stats)
	}

	now := time.Now().UTC().Truncate(time.Second)
	t1 := now.Add(-2 * time.Hour)
	t2 := now.Add(-1 * time.Hour)

	rec1 := domain.LaunchRecord{
		ProfileID:   "p1",
		ProfileName: "Doom 2 Brutal",
		EngineName:  "GZDoom",
		IWADName:    "DOOM2",
		StartedAt:   t1,
		FinishedAt:  t1.Add(15 * time.Minute),
		DurationMs:  900000,
		ExitCode:    0,
		Status:      domain.LaunchStatusSuccess,
		CommandLine: "gzdoom -iwad doom2.wad",
	}
	if err := repos.History.Add(rec1); err != nil {
		t.Fatalf("Add(rec1) failed: %v", err)
	}

	rec2 := domain.LaunchRecord{
		ProfileID:   "p1",
		ProfileName: "Doom 2 Brutal",
		EngineName:  "GZDoom",
		IWADName:    "DOOM2",
		StartedAt:   t2,
		FinishedAt:  t2.Add(30 * time.Minute),
		DurationMs:  1800000,
		ExitCode:    0,
		Status:      domain.LaunchStatusSuccess,
		CommandLine: "gzdoom -iwad doom2.wad",
	}
	if err := repos.History.Add(rec2); err != nil {
		t.Fatalf("Add(rec2) failed: %v", err)
	}

	rec3 := domain.LaunchRecord{
		ProfileID:   "p2",
		ProfileName: "Sigil",
		EngineName:  "Crispy Doom",
		IWADName:    "DOOM",
		StartedAt:   now,
		FinishedAt:  now.Add(5 * time.Minute),
		DurationMs:  300000,
		ExitCode:    1,
		Status:      domain.LaunchStatusFailed,
		CommandLine: "crispy-doom -iwad doom.wad",
	}
	if err := repos.History.Add(rec3); err != nil {
		t.Fatalf("Add(rec3) failed: %v", err)
	}

	// List history
	list, err := repos.History.List(0)
	if err != nil {
		t.Fatalf("List() failed: %v", err)
	}
	if len(list) != 3 {
		t.Fatalf("expected 3 history records, got %d", len(list))
	}
	// Ordered by started_at DESC (rec3 is newest)
	if list[0].ProfileName != "Sigil" {
		t.Errorf("expected newest record first, got %s", list[0].ProfileName)
	}

	// List with limit
	limited, err := repos.History.List(2)
	if err != nil {
		t.Fatalf("List(2) failed: %v", err)
	}
	if len(limited) != 2 {
		t.Fatalf("expected 2 records with limit, got %d", len(limited))
	}

	// Check Stats
	stats, err = repos.History.GetStats()
	if err != nil {
		t.Fatalf("GetStats() failed: %v", err)
	}
	if stats.TotalLaunches != 3 {
		t.Errorf("expected 3 total launches, got %d", stats.TotalLaunches)
	}
	expectedPlayTime := int64(900000 + 1800000 + 300000)
	if stats.TotalPlayTimeMs != expectedPlayTime {
		t.Errorf("expected %d total playtime ms, got %d", expectedPlayTime, stats.TotalPlayTimeMs)
	}
	if stats.MostPlayedProfileID != "p1" || stats.MostPlayedProfileName != "Doom 2 Brutal" {
		t.Errorf("expected most played profile p1, got id=%s name=%s", stats.MostPlayedProfileID, stats.MostPlayedProfileName)
	}
	if stats.LastLaunchedAt == nil {
		t.Fatal("expected LastLaunchedAt to be populated")
	}

	// Clear history
	if err := repos.History.Clear(); err != nil {
		t.Fatalf("Clear() failed: %v", err)
	}
	clearedList, _ := repos.History.List(0)
	if len(clearedList) != 0 {
		t.Errorf("expected 0 history records after Clear, got %d", len(clearedList))
	}
}

func TestSettingsRepository_Persistence(t *testing.T) {
	repos := setupTestDB(t)

	// Default settings
	defaults, err := repos.Settings.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings failed: %v", err)
	}
	if defaults.Theme != "dark" || !defaults.AutoScanOnStartup || defaults.ConfirmLaunch {
		t.Errorf("unexpected default settings: %+v", defaults)
	}

	// Save modified settings
	custom := domain.Settings{
		ModDirectories:    []string{"C:\\Doom\\Mods", "D:\\Games\\DoomMods"},
		IWADDirectories:   []string{"C:\\Doom\\IWADs"},
		EngineDirectories: []string{"C:\\Doom\\Engines"},
		DefaultWorkingDir: "C:\\Doom",
		Theme:             "light",
		ConfirmLaunch:     true,
		AutoScanOnStartup: false,
		CloseOnLaunch:     true,
	}
	if err := repos.Settings.SaveSettings(custom); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}

	loaded, err := repos.Settings.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings after save failed: %v", err)
	}
	if loaded.Theme != "light" {
		t.Errorf("expected theme light, got %s", loaded.Theme)
	}
	if !loaded.ConfirmLaunch || loaded.AutoScanOnStartup || !loaded.CloseOnLaunch {
		t.Errorf("boolean flags mismatch: %+v", loaded)
	}
	if len(loaded.ModDirectories) != 2 || loaded.ModDirectories[1] != "D:\\Games\\DoomMods" {
		t.Errorf("mod directories mismatch: %+v", loaded.ModDirectories)
	}
	if len(loaded.IWADDirectories) != 1 || len(loaded.EngineDirectories) != 1 {
		t.Errorf("directories mismatch: %+v", loaded)
	}
	if loaded.DefaultWorkingDir != "C:\\Doom" {
		t.Errorf("expected working dir 'C:\\Doom', got %s", loaded.DefaultWorkingDir)
	}
}
func TestModRepository_NonExistentAndEdgeFilters(t *testing.T) {
	repos := setupTestDB(t)

	// Get non-existent mod
	_, err := repos.Mods.Get("unknown-id")
	if err == nil {
		t.Error("expected error for non-existent mod Get")
	}

	// GetByPath non-existent mod
	_, err = repos.Mods.GetByPath("C:\\nonexistent.wad")
	if err == nil {
		t.Error("expected error for non-existent mod GetByPath")
	}

	// Update non-existent mod
	fakeMod := &domain.Mod{ID: "non-existent", Name: "Fake", Path: "C:\\fake.wad"}
	err = repos.Mods.Update(fakeMod)
	if err == nil {
		t.Error("expected error for non-existent mod Update")
	}

	// Delete non-existent mod
	err = repos.Mods.Delete("non-existent")
	if err == nil {
		t.Error("expected error for non-existent mod Delete")
	}
}

func TestProfileRepository_UpdateWithModsAndList(t *testing.T) {
	repos := setupTestDB(t)

	// Create engine and iwad
	eng := &domain.Engine{Name: "GZDoom", Executable: "gzdoom.exe", Family: domain.EngineFamilyGZDoom}
	_ = repos.Engines.Create(eng)
	iwad := &domain.IWAD{Name: "DOOM2", Path: "doom2.wad", Type: domain.IWADTypeDoom2}
	_ = repos.IWADs.Create(iwad)

	mod1 := &domain.Mod{Name: "Mod A", Path: "a.pk3", Format: domain.ModFormatPK3}
	_ = repos.Mods.Create(mod1)
	mod2 := &domain.Mod{Name: "Mod B", Path: "b.pk3", Format: domain.ModFormatPK3}
	_ = repos.Mods.Create(mod2)
	mod3 := &domain.Mod{Name: "Mod C", Path: "c.pk3", Format: domain.ModFormatPK3}
	_ = repos.Mods.Create(mod3)

	p1 := &domain.Profile{
		Name:     "Profile 1",
		EngineID: eng.ID,
		IWADID:   iwad.ID,
		Mods: []domain.ProfileMod{
			{ModID: mod1.ID, Enabled: true, Order: 0},
			{ModID: mod2.ID, Enabled: false, Order: 1},
		},
	}
	if err := repos.Profiles.Create(p1); err != nil {
		t.Fatalf("Create p1 failed: %v", err)
	}

	// Update profile by replacing mods with mod2 and mod3
	p1.Mods = []domain.ProfileMod{
		{ModID: mod2.ID, Enabled: true, Order: 0},
		{ModID: mod3.ID, Enabled: true, Order: 1},
	}
	p1.Description = "Updated description"
	if err := repos.Profiles.Update(p1); err != nil {
		t.Fatalf("Update p1 failed: %v", err)
	}

	fetched, err := repos.Profiles.Get(p1.ID)
	if err != nil {
		t.Fatalf("Get p1 failed: %v", err)
	}
	if fetched.Description != "Updated description" {
		t.Errorf("description not updated: %s", fetched.Description)
	}
	if len(fetched.Mods) != 2 {
		t.Fatalf("expected 2 mods, got %d", len(fetched.Mods))
	}
	if fetched.Mods[0].ModID != mod2.ID || fetched.Mods[1].ModID != mod3.ID {
		t.Errorf("profile mods not correctly replaced: %+v", fetched.Mods)
	}

	// List profiles
	profiles, err := repos.Profiles.List()
	if err != nil {
		t.Fatalf("List profiles failed: %v", err)
	}
	if len(profiles) != 1 {
		t.Errorf("expected 1 profile, got %d", len(profiles))
	}
	if len(profiles[0].Mods) != 2 {
		t.Errorf("expected profile in List() to have hydrated mods, got %d", len(profiles[0].Mods))
	}
}

func TestLaunchHistory_AutoDurationCalculation(t *testing.T) {
	repos := setupTestDB(t)

	now := time.Now().UTC()
	start := now.Add(-10 * time.Second)
	finish := now

	rec := domain.LaunchRecord{
		ProfileName: "Test Profile",
		EngineName:  "GZDoom",
		IWADName:    "DOOM2",
		StartedAt:   start,
		FinishedAt:  finish,
		DurationMs:  0, // should auto-calculate to ~10000ms
		Status:      domain.LaunchStatusSuccess,
	}

	if err := repos.History.Add(rec); err != nil {
		t.Fatalf("Add history record failed: %v", err)
	}

	list, err := repos.History.List(1)
	if err != nil {
		t.Fatalf("List history failed: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 history record, got %d", len(list))
	}
	if list[0].DurationMs < 9900 || list[0].DurationMs > 10100 {
		t.Errorf("expected auto-calculated duration ~10000ms, got %d", list[0].DurationMs)
	}
}
