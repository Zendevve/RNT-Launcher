package diagnostics_test

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"
	"rnt-launcher/internal/database"
	"rnt-launcher/internal/diagnostics"
	"rnt-launcher/internal/domain"
)

func setupTestDiagnostics(t *testing.T) (*diagnostics.DiagnosticsService, *sql.DB) {
	t.Helper()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test-diag.db")

	db, err := database.InitDB(dbPath)
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}

	engineRepo := database.NewEngineRepository(db)
	iwadRepo := database.NewIWADRepository(db)
	modRepo := database.NewModRepository(db)
	profileRepo := database.NewProfileRepository(db)
	historyRepo := database.NewHistoryRepository(db)

	svc := diagnostics.NewDiagnosticsService(
		db,
		engineRepo,
		iwadRepo,
		modRepo,
		profileRepo,
		historyRepo,
		dbPath,
	)

	return svc, db
}

func TestDiagnostics_HealthyState(t *testing.T) {
	svc, db := setupTestDiagnostics(t)
	defer db.Close()

	ctx := context.Background()
	report, err := svc.RunDiagnostics(ctx)
	if err != nil {
		t.Fatalf("unexpected error running diagnostics: %v", err)
	}

	if report.OverallStatus != "healthy" {
		t.Errorf("expected overallStatus 'healthy', got %q", report.OverallStatus)
	}

	if report.Database.IntegrityCheck != "ok" {
		t.Errorf("expected integrity check 'ok', got %q", report.Database.IntegrityCheck)
	}

	if report.Summary.ErrorCount != 0 || report.Summary.WarningCount != 0 {
		t.Errorf("expected 0 errors/warnings on clean state, got %d errors, %d warnings",
			report.Summary.ErrorCount, report.Summary.WarningCount)
	}
}

func TestDiagnostics_MissingEngineAndIWAD(t *testing.T) {
	svc, db := setupTestDiagnostics(t)
	defer db.Close()

	engineRepo := database.NewEngineRepository(db)
	iwadRepo := database.NewIWADRepository(db)

	// Register non-existent engine & IWAD
	_ = engineRepo.Create(&domain.Engine{
		ID:         "eng-missing",
		Name:       "GZDoom Missing",
		Executable: filepath.Join(t.TempDir(), "nonexistent-gzdoom.exe"),
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	})

	_ = iwadRepo.Create(&domain.IWAD{
		ID:        "iwad-missing",
		Name:      "DOOM2 Missing",
		Path:      filepath.Join(t.TempDir(), "nonexistent-doom2.wad"),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	})

	ctx := context.Background()
	report, err := svc.RunDiagnostics(ctx)
	if err != nil {
		t.Fatalf("failed to run diagnostics: %v", err)
	}

	if report.OverallStatus != "error" {
		t.Errorf("expected overallStatus 'error', got %q", report.OverallStatus)
	}

	if report.Summary.ErrorCount < 2 {
		t.Errorf("expected at least 2 errors for missing engine and iwad, got %d", report.Summary.ErrorCount)
	}

	// Test Repairing Missing Engine and IWAD
	err = svc.Repair(ctx, "remove_invalid_engines", "")
	if err != nil {
		t.Errorf("failed to repair invalid engines: %v", err)
	}

	err = svc.Repair(ctx, "remove_missing_iwads", "")
	if err != nil {
		t.Errorf("failed to repair missing iwads: %v", err)
	}

	// Re-run diagnostics
	reportAfter, err := svc.RunDiagnostics(ctx)
	if err != nil {
		t.Fatalf("failed to run diagnostics after repair: %v", err)
	}

	if reportAfter.Summary.ErrorCount != 0 {
		t.Errorf("expected 0 errors after repair, got %d", reportAfter.Summary.ErrorCount)
	}
}

func TestDiagnostics_ProfileOrphanedMods(t *testing.T) {
	svc, db := setupTestDiagnostics(t)
	defer db.Close()

	tempDir := t.TempDir()
	modFile := filepath.Join(tempDir, "testmod.pk3")
	_ = os.WriteFile(modFile, []byte("PK\x05\x06\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"), 0644)

	modRepo := database.NewModRepository(db)
	profileRepo := database.NewProfileRepository(db)

	m := domain.Mod{
		ID:        "mod-1",
		Name:      "Test Mod",
		Path:      modFile,
		Format:    domain.ModFormatPK3,
		Category:  domain.ModCategoryGameplay,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_ = modRepo.Create(&m)

	m2File := filepath.Join(tempDir, "testmod2.pk3")
	_ = os.WriteFile(m2File, []byte("PK\x05\x06\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"), 0644)

	m2 := domain.Mod{
		ID:        "mod-2",
		Name:      "Test Mod 2",
		Path:      m2File,
		Format:    domain.ModFormatPK3,
		Category:  domain.ModCategoryGameplay,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_ = modRepo.Create(&m2)

	p := domain.Profile{
		ID:        "prof-1",
		Name:      "Test Profile",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_ = profileRepo.Create(&p)

	// Add mod-1 and mod-2 to profile
	_ = profileRepo.SetProfileMods(p.ID, []domain.ProfileMod{
		{ModID: "mod-1", Enabled: true, Order: 0},
		{ModID: "mod-2", Enabled: true, Order: 1},
	})

	// Now simulate orphan by removing mod-2 directly from mods table with FK check temporarily disabled
	_, _ = db.Exec("PRAGMA foreign_keys = OFF;")
	_, _ = db.Exec("DELETE FROM mods WHERE id = 'mod-2';")
	_, _ = db.Exec("PRAGMA foreign_keys = ON;")

	ctx := context.Background()
	report, err := svc.RunDiagnostics(ctx)
	if err != nil {
		t.Fatalf("failed to run diagnostics: %v", err)
	}
	hasOrphanWarning := false
	for _, issue := range report.Issues {
		if issue.RepairAction == "clean_profile_orphans" {
			hasOrphanWarning = true
			break
		}
	}
	if !hasOrphanWarning {
		t.Errorf("expected clean_profile_orphans issue in report")
	}

	// Execute Repair
	err = svc.Repair(ctx, "clean_profile_orphans", p.ID)
	if err != nil {
		t.Fatalf("failed to clean profile orphans: %v", err)
	}

	// Verify profile load order has only 1 valid mod now
	updatedMods, err := profileRepo.GetProfileMods(p.ID)
	if err != nil {
		t.Fatalf("failed to get profile mods: %v", err)
	}
	if len(updatedMods) != 1 || updatedMods[0].ModID != "mod-1" {
		t.Errorf("expected 1 valid mod after orphan cleaning, got %v", updatedMods)
	}
}
