package settings_test

import (
	"context"
	"errors"
	"testing"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/settings"
)

func setupTestService(t *testing.T) (*settings.SettingsService, database.SettingsRepository) {
	t.Helper()
	db, err := database.InitDB(":memory:")
	if err != nil {
		t.Fatalf("database.InitDB failed: %v", err)
	}
	t.Cleanup(func() {
		db.Close()
	})

	repo := database.NewSettingsRepository(db)
	svc := settings.NewSettingsService(repo)
	return svc, repo
}

func TestSettingsService_Constructors(t *testing.T) {
	db, err := database.InitDB(":memory:")
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	repo := database.NewSettingsRepository(db)
	svc1 := settings.New(repo)
	if svc1 == nil {
		t.Fatal("settings.New returned nil")
	}

	svc2 := settings.NewSettingsService(repo)
	if svc2 == nil {
		t.Fatal("settings.NewSettingsService returned nil")
	}
}

func TestSettingsService_GetDefaults(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	// Initial fetch on fresh DB should return defaults
	s, err := svc.Get(ctx)
	if err != nil {
		t.Fatalf("Get() on fresh DB failed: %v", err)
	}
	if s == nil {
		t.Fatal("expected non-nil settings")
	}

	if s.Theme != "dark" {
		t.Errorf("expected default theme 'dark', got %q", s.Theme)
	}
	if !s.AutoScanOnStartup {
		t.Errorf("expected AutoScanOnStartup to default to true")
	}
	if s.ConfirmLaunch {
		t.Errorf("expected ConfirmLaunch to default to false")
	}
	if s.CloseOnLaunch {
		t.Errorf("expected CloseOnLaunch to default to false")
	}
	if s.UiDensity != "compact" {
		t.Errorf("expected default UiDensity 'compact', got %q", s.UiDensity)
	}
	if s.ShowFilePaths {
		t.Errorf("expected ShowFilePaths to default to false")
	}
	if s.ShowRecentLaunches != 3 {
		t.Errorf("expected default ShowRecentLaunches 3, got %d", s.ShowRecentLaunches)
	}
	if len(s.FormatVisibility) != 7 {
		t.Errorf("expected default 7 format visibility items, got %d", len(s.FormatVisibility))
	}
	if s.DefaultView != "dashboard" {
		t.Errorf("expected default DefaultView 'dashboard', got %q", s.DefaultView)
	}
	if s.DefaultWorkingDir != "" {
		t.Errorf("expected empty DefaultWorkingDir, got %q", s.DefaultWorkingDir)
	}
	if s.ModDirectories == nil || len(s.ModDirectories) != 0 {
		t.Errorf("expected non-nil empty ModDirectories slice, got %+v", s.ModDirectories)
	}
	if s.IWADDirectories == nil || len(s.IWADDirectories) != 0 {
		t.Errorf("expected non-nil empty IWADDirectories slice, got %+v", s.IWADDirectories)
	}
	if s.EngineDirectories == nil || len(s.EngineDirectories) != 0 {
		t.Errorf("expected non-nil empty EngineDirectories slice, got %+v", s.EngineDirectories)
	}
}

func TestSettingsService_Update(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	custom := domain.Settings{
		ModDirectories:     []string{"C:\\Doom\\Mods", "D:\\Mods"},
		IWADDirectories:    []string{"C:\\Doom\\IWADs"},
		EngineDirectories:  []string{"C:\\Doom\\Engines"},
		DefaultWorkingDir:  "C:\\Doom",
		Theme:              "light",
		ConfirmLaunch:      true,
		AutoScanOnStartup:  false,
		CloseOnLaunch:      true,
		UiDensity:          "comfortable",
		ShowFilePaths:      true,
		ShowRecentLaunches: 5,
		FormatVisibility:   []string{".wad", ".pk3"},
		DefaultView:        "profiles",
	}
	if err := svc.Update(ctx, custom); err != nil {
		t.Fatalf("Update() failed: %v", err)
	}

	loaded, err := svc.Get(ctx)
	if err != nil {
		t.Fatalf("Get() after update failed: %v", err)
	}

	if loaded.Theme != "light" {
		t.Errorf("expected theme 'light', got %q", loaded.Theme)
	}
	if !loaded.ConfirmLaunch {
		t.Errorf("expected ConfirmLaunch true")
	}
	if loaded.AutoScanOnStartup {
		t.Errorf("expected AutoScanOnStartup false")
	}
	if !loaded.CloseOnLaunch {
		t.Errorf("expected CloseOnLaunch true")
	}
	if loaded.UiDensity != "comfortable" {
		t.Errorf("expected UiDensity 'comfortable', got %q", loaded.UiDensity)
	}
	if !loaded.ShowFilePaths {
		t.Errorf("expected ShowFilePaths true")
	}
	if loaded.ShowRecentLaunches != 5 {
		t.Errorf("expected ShowRecentLaunches 5, got %d", loaded.ShowRecentLaunches)
	}
	if len(loaded.FormatVisibility) != 2 || loaded.FormatVisibility[0] != ".wad" {
		t.Errorf("expected custom FormatVisibility [.wad, .pk3], got %+v", loaded.FormatVisibility)
	}
	if loaded.DefaultView != "profiles" {
		t.Errorf("expected DefaultView 'profiles', got %q", loaded.DefaultView)
	}
	if loaded.DefaultWorkingDir != "C:\\Doom" {
		t.Errorf("expected DefaultWorkingDir 'C:\\Doom', got %q", loaded.DefaultWorkingDir)
	}
	if len(loaded.ModDirectories) != 2 || loaded.ModDirectories[1] != "D:\\Mods" {
		t.Errorf("unexpected ModDirectories: %+v", loaded.ModDirectories)
	}
	if len(loaded.IWADDirectories) != 1 || loaded.IWADDirectories[0] != "C:\\Doom\\IWADs" {
		t.Errorf("unexpected IWADDirectories: %+v", loaded.IWADDirectories)
	}
	if len(loaded.EngineDirectories) != 1 || loaded.EngineDirectories[0] != "C:\\Doom\\Engines" {
		t.Errorf("unexpected EngineDirectories: %+v", loaded.EngineDirectories)
	}
}

func TestSettingsService_AddModDirectory_Idempotent(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	// Empty path should return error
	if err := svc.AddModDirectory(ctx, ""); err == nil {
		t.Error("expected error for empty directory path")
	}
	if err := svc.AddModDirectory(ctx, "   "); err == nil {
		t.Error("expected error for whitespace directory path")
	}

	// Add first directory
	dir1 := "C:\\Doom\\Mods"
	if err := svc.AddModDirectory(ctx, dir1); err != nil {
		t.Fatalf("AddModDirectory(dir1) failed: %v", err)
	}

	dirs, err := svc.GetModDirectories(ctx)
	if err != nil || len(dirs) != 1 || dirs[0] != dir1 {
		t.Fatalf("unexpected mod dirs after first add: len=%d, err=%v", len(dirs), err)
	}

	// Add second directory
	dir2 := "D:\\MoreMods"
	if err := svc.AddModDirectory(ctx, dir2); err != nil {
		t.Fatalf("AddModDirectory(dir2) failed: %v", err)
	}

	dirs, err = svc.GetModDirectories(ctx)
	if err != nil || len(dirs) != 2 {
		t.Fatalf("expected 2 mod dirs, got: %d", len(dirs))
	}

	// Add duplicate of dir1 - should be idempotent
	if err := svc.AddModDirectory(ctx, dir1); err != nil {
		t.Fatalf("AddModDirectory(duplicate) failed: %v", err)
	}

	dirs, err = svc.GetModDirectories(ctx)
	if err != nil || len(dirs) != 2 {
		t.Fatalf("expected still 2 mod dirs after duplicate add, got: %d", len(dirs))
	}

	// Add with redundant trailing slash - should also be recognized as duplicate
	dir1WithSlash := "C:\\Doom\\Mods\\"
	if err := svc.AddModDirectory(ctx, dir1WithSlash); err != nil {
		t.Fatalf("AddModDirectory(dir1WithSlash) failed: %v", err)
	}

	dirs, err = svc.GetModDirectories(ctx)
	if err != nil || len(dirs) != 2 {
		t.Fatalf("expected still 2 mod dirs after cleaned duplicate add, got: %d", len(dirs))
	}
}

func TestSettingsService_RemoveModDirectory_Idempotent(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	dir1 := "C:\\Doom\\Mods"
	dir2 := "D:\\MoreMods"
	_ = svc.AddModDirectory(ctx, dir1)
	_ = svc.AddModDirectory(ctx, dir2)

	// Remove dir1
	if err := svc.RemoveModDirectory(ctx, dir1); err != nil {
		t.Fatalf("RemoveModDirectory(dir1) failed: %v", err)
	}

	dirs, err := svc.GetModDirectories(ctx)
	if err != nil || len(dirs) != 1 || dirs[0] != dir2 {
		t.Fatalf("expected only dir2 remaining, got: %+v", dirs)
	}

	// Remove dir1 again - should be idempotent no-op
	if err := svc.RemoveModDirectory(ctx, dir1); err != nil {
		t.Fatalf("RemoveModDirectory(dir1) duplicate removal failed: %v", err)
	}

	dirs, _ = svc.GetModDirectories(ctx)
	if len(dirs) != 1 {
		t.Fatalf("expected still 1 dir, got %d", len(dirs))
	}

	// Remove non-existent dir - should be idempotent no-op
	if err := svc.RemoveModDirectory(ctx, "E:\\NonExistent"); err != nil {
		t.Fatalf("RemoveModDirectory(nonExistent) failed: %v", err)
	}

	// Remove empty string - should be no-op
	if err := svc.RemoveModDirectory(ctx, ""); err != nil {
		t.Fatalf("RemoveModDirectory(empty) failed: %v", err)
	}
}

func TestSettingsService_AddRemoveIWADDirectory(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	// Empty path error
	if err := svc.AddIWADDirectory(ctx, ""); err == nil {
		t.Error("expected error for empty IWAD path")
	}

	dir1 := "C:\\Doom\\IWADs"
	dir2 := "D:\\IWADs"

	if err := svc.AddIWADDirectory(ctx, dir1); err != nil {
		t.Fatalf("AddIWADDirectory(dir1) failed: %v", err)
	}
	if err := svc.AddIWADDirectory(ctx, dir2); err != nil {
		t.Fatalf("AddIWADDirectory(dir2) failed: %v", err)
	}

	// Duplicate add
	if err := svc.AddIWADDirectory(ctx, dir1); err != nil {
		t.Fatalf("AddIWADDirectory duplicate failed: %v", err)
	}

	dirs, err := svc.GetIWADDirectories(ctx)
	if err != nil || len(dirs) != 2 {
		t.Fatalf("expected 2 IWAD dirs, got: %d", len(dirs))
	}

	// Remove dir1
	if err := svc.RemoveIWADDirectory(ctx, dir1); err != nil {
		t.Fatalf("RemoveIWADDirectory(dir1) failed: %v", err)
	}

	// Idempotent remove
	if err := svc.RemoveIWADDirectory(ctx, dir1); err != nil {
		t.Fatalf("RemoveIWADDirectory duplicate removal failed: %v", err)
	}
	if err := svc.RemoveIWADDirectory(ctx, ""); err != nil {
		t.Fatalf("RemoveIWADDirectory empty failed: %v", err)
	}

	dirs, err = svc.GetIWADDirectories(ctx)
	if err != nil || len(dirs) != 1 || dirs[0] != dir2 {
		t.Fatalf("expected only dir2 remaining, got: %+v", dirs)
	}
}

func TestSettingsService_AddRemoveEngineDirectory(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	// Empty path error
	if err := svc.AddEngineDirectory(ctx, ""); err == nil {
		t.Error("expected error for empty Engine path")
	}

	dir1 := "C:\\Doom\\Engines"
	dir2 := "D:\\Engines"

	if err := svc.AddEngineDirectory(ctx, dir1); err != nil {
		t.Fatalf("AddEngineDirectory(dir1) failed: %v", err)
	}
	if err := svc.AddEngineDirectory(ctx, dir2); err != nil {
		t.Fatalf("AddEngineDirectory(dir2) failed: %v", err)
	}

	// Duplicate add
	if err := svc.AddEngineDirectory(ctx, dir1); err != nil {
		t.Fatalf("AddEngineDirectory duplicate failed: %v", err)
	}

	dirs, err := svc.GetEngineDirectories(ctx)
	if err != nil || len(dirs) != 2 {
		t.Fatalf("expected 2 Engine dirs, got: %d", len(dirs))
	}

	// Remove dir1
	if err := svc.RemoveEngineDirectory(ctx, dir1); err != nil {
		t.Fatalf("RemoveEngineDirectory(dir1) failed: %v", err)
	}

	// Idempotent remove
	if err := svc.RemoveEngineDirectory(ctx, dir1); err != nil {
		t.Fatalf("RemoveEngineDirectory duplicate removal failed: %v", err)
	}
	if err := svc.RemoveEngineDirectory(ctx, ""); err != nil {
		t.Fatalf("RemoveEngineDirectory empty failed: %v", err)
	}

	dirs, err = svc.GetEngineDirectories(ctx)
	if err != nil || len(dirs) != 1 || dirs[0] != dir2 {
		t.Fatalf("expected only dir2 remaining, got: %+v", dirs)
	}
}

func TestSettingsService_ResetToDefaults(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	// Update to custom
	custom := domain.Settings{
		Theme:         "light",
		ConfirmLaunch: true,
		CloseOnLaunch: true,
	}
	if err := svc.Update(ctx, custom); err != nil {
		t.Fatalf("Update() failed: %v", err)
	}

	// Reset
	if err := svc.ResetToDefaults(ctx); err != nil {
		t.Fatalf("ResetToDefaults() failed: %v", err)
	}

	// Check reset values
	s, err := svc.Get(ctx)
	if err != nil {
		t.Fatalf("Get() after reset failed: %v", err)
	}
	if s.Theme != "dark" || !s.AutoScanOnStartup || s.ConfirmLaunch || s.CloseOnLaunch {
		t.Errorf("settings not reset to defaults: %+v", s)
	}
}

func TestSettingsService_ContextCancelled(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	if _, err := svc.Get(ctx); err == nil {
		t.Error("expected error for Get with cancelled context")
	}

	if err := svc.Update(ctx, domain.DefaultSettings()); err == nil {
		t.Error("expected error for Update with cancelled context")
	}

	if err := svc.AddModDirectory(ctx, "C:\\Mods"); err == nil {
		t.Error("expected error for AddModDirectory with cancelled context")
	}

	if err := svc.RemoveModDirectory(ctx, "C:\\Mods"); err == nil {
		t.Error("expected error for RemoveModDirectory with cancelled context")
	}

	if err := svc.AddIWADDirectory(ctx, "C:\\IWADs"); err == nil {
		t.Error("expected error for AddIWADDirectory with cancelled context")
	}

	if err := svc.RemoveIWADDirectory(ctx, "C:\\IWADs"); err == nil {
		t.Error("expected error for RemoveIWADDirectory with cancelled context")
	}

	if err := svc.AddEngineDirectory(ctx, "C:\\Engines"); err == nil {
		t.Error("expected error for AddEngineDirectory with cancelled context")
	}

	if err := svc.RemoveEngineDirectory(ctx, "C:\\Engines"); err == nil {
		t.Error("expected error for RemoveEngineDirectory with cancelled context")
	}

	if _, err := svc.GetModDirectories(ctx); err == nil {
		t.Error("expected error for GetModDirectories with cancelled context")
	}

	if _, err := svc.GetIWADDirectories(ctx); err == nil {
		t.Error("expected error for GetIWADDirectories with cancelled context")
	}

	if _, err := svc.GetEngineDirectories(ctx); err == nil {
		t.Error("expected error for GetEngineDirectories with cancelled context")
	}
}

func TestSettingsService_NilSafety(t *testing.T) {
	var nilSvc *settings.SettingsService
	ctx := context.Background()

	if _, err := nilSvc.Get(ctx); err == nil {
		t.Error("expected error on nil service Get")
	}

	if err := nilSvc.Update(ctx, domain.DefaultSettings()); err == nil {
		t.Error("expected error on nil service Update")
	}

	if err := nilSvc.AddModDirectory(ctx, "C:\\Mods"); err == nil {
		t.Error("expected error on nil service AddModDirectory")
	}

	if err := nilSvc.RemoveModDirectory(ctx, "C:\\Mods"); err == nil {
		t.Error("expected error on nil service RemoveModDirectory")
	}

	if err := nilSvc.AddIWADDirectory(ctx, "C:\\IWADs"); err == nil {
		t.Error("expected error on nil service AddIWADDirectory")
	}

	if err := nilSvc.RemoveIWADDirectory(ctx, "C:\\IWADs"); err == nil {
		t.Error("expected error on nil service RemoveIWADDirectory")
	}

	if err := nilSvc.AddEngineDirectory(ctx, "C:\\Engines"); err == nil {
		t.Error("expected error on nil service AddEngineDirectory")
	}

	if err := nilSvc.RemoveEngineDirectory(ctx, "C:\\Engines"); err == nil {
		t.Error("expected error on nil service RemoveEngineDirectory")
	}

	if _, err := nilSvc.GetModDirectories(ctx); err == nil {
		t.Error("expected error on nil service GetModDirectories")
	}

	if _, err := nilSvc.GetIWADDirectories(ctx); err == nil {
		t.Error("expected error on nil service GetIWADDirectories")
	}

	if _, err := nilSvc.GetEngineDirectories(ctx); err == nil {
		t.Error("expected error on nil service GetEngineDirectories")
	}

	emptySvc := &settings.SettingsService{}
	if _, err := emptySvc.Get(ctx); err == nil {
		t.Error("expected error on uninitialized repo Get")
	}
	if err := emptySvc.Update(ctx, domain.DefaultSettings()); err == nil {
		t.Error("expected error on uninitialized repo Update")
	}
}

type failingSettingsRepo struct{}

func (f *failingSettingsRepo) GetSettings() (domain.Settings, error) {
	return domain.Settings{}, errors.New("database get settings failure")
}

func (f *failingSettingsRepo) SaveSettings(s domain.Settings) error {
	return errors.New("database save settings failure")
}

func TestSettingsService_RepoErrors(t *testing.T) {
	failRepo := &failingSettingsRepo{}
	svc := settings.NewSettingsService(failRepo)
	ctx := context.Background()

	if _, err := svc.Get(ctx); err == nil {
		t.Error("expected error on Get with failing repo")
	}
	if err := svc.Update(ctx, domain.DefaultSettings()); err == nil {
		t.Error("expected error on Update with failing repo")
	}
	if err := svc.AddModDirectory(ctx, "C:\\Mods"); err == nil {
		t.Error("expected error on AddModDirectory with failing repo")
	}
	if err := svc.RemoveModDirectory(ctx, "C:\\Mods"); err == nil {
		t.Error("expected error on RemoveModDirectory with failing repo")
	}
	if err := svc.AddIWADDirectory(ctx, "C:\\IWADs"); err == nil {
		t.Error("expected error on AddIWADDirectory with failing repo")
	}
	if err := svc.RemoveIWADDirectory(ctx, "C:\\IWADs"); err == nil {
		t.Error("expected error on RemoveIWADDirectory with failing repo")
	}
	if err := svc.AddEngineDirectory(ctx, "C:\\Engines"); err == nil {
		t.Error("expected error on AddEngineDirectory with failing repo")
	}
	if err := svc.RemoveEngineDirectory(ctx, "C:\\Engines"); err == nil {
		t.Error("expected error on RemoveEngineDirectory with failing repo")
	}
	if _, err := svc.GetModDirectories(ctx); err == nil {
		t.Error("expected error on GetModDirectories with failing repo")
	}
	if _, err := svc.GetIWADDirectories(ctx); err == nil {
		t.Error("expected error on GetIWADDirectories with failing repo")
	}
	if _, err := svc.GetEngineDirectories(ctx); err == nil {
		t.Error("expected error on GetEngineDirectories with failing repo")
	}
}
