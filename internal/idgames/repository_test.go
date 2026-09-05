package idgames_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/idgames"
	"rnt-launcher/internal/idgames/seed"
)

func setupTestDB(t *testing.T) (*database.Repositories, *idgames.CatalogRepository) {
	t.Helper()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")
	db, err := database.InitDB(dbPath)
	if err != nil {
		t.Fatalf("failed to initialize test database: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	repos := database.NewRepositories(db)
	catalogRepo := idgames.NewCatalogRepository(db)
	return repos, catalogRepo
}

func TestCatalogSeedAndFTS5(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	repos, catalogRepo := setupTestDB(t)

	// 1. Initial count must be 0
	count, err := catalogRepo.Count(ctx)
	if err != nil {
		t.Fatalf("failed to count catalog items: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected empty catalog, got %d items", count)
	}

	// 2. Seed from embedded gzipped stream
	reader, err := seed.OpenCatalogReader()
	if err != nil {
		t.Fatalf("failed to open catalog reader: %v", err)
	}
	defer reader.Close()

	inserted, err := catalogRepo.SeedIfEmpty(ctx, reader)
	if err != nil {
		t.Fatalf("failed to seed catalog: %v", err)
	}
	if inserted == 0 {
		t.Fatalf("expected non-zero inserted items from seed")
	}

	// 3. Verify idempotent re-seeding
	reader2, err := seed.OpenCatalogReader()
	if err != nil {
		t.Fatalf("failed to open second catalog reader: %v", err)
	}
	defer reader2.Close()

	secondInsert, err := catalogRepo.SeedIfEmpty(ctx, reader2)
	if err != nil {
		t.Fatalf("second seed failed: %v", err)
	}
	if secondInsert != 0 {
		t.Fatalf("expected 0 inserts on re-seed, got %d", secondInsert)
	}

	// 4. Test FTS5 search with prefix matching
	evitResults, err := catalogRepo.Search(ctx, idgames.SearchOptions{
		Query: "evit",
	})
	if err != nil {
		t.Fatalf("searching for 'evit': %v", err)
	}
	if len(evitResults) == 0 {
		t.Fatalf("expected to find Eviternity with prefix 'evit'")
	}
	if evitResults[0].Title != "Eviternity" {
		t.Errorf("expected top result to be Eviternity, got %s", evitResults[0].Title)
	}
	if !evitResults[0].IsCacoward {
		t.Errorf("expected Eviternity to be flagged as Cacoward winner")
	}
	if evitResults[0].CacowardYear != 2019 {
		t.Errorf("expected Eviternity Cacoward year 2019, got %d", evitResults[0].CacowardYear)
	}

	// 5. Test multi-word query
	aliensResults, err := catalogRepo.Search(ctx, idgames.SearchOptions{
		Query: "Ancient Aliens",
	})
	if err != nil {
		t.Fatalf("searching for 'Ancient Aliens': %v", err)
	}
	if len(aliensResults) == 0 || aliensResults[0].Filename != "aaliens.zip" {
		t.Fatalf("expected to find Ancient Aliens (aaliens.zip), got %v", aliensResults)
	}

	// 6. Test cross-referencing with mods table for installed state
	evit := evitResults[0]
	if evit.IsInstalled {
		t.Errorf("expected Eviternity to be uninstalled initially")
	}

	// Insert mod matching eviternity filename into mods table
	err = repos.Mods.Create(&domain.Mod{
		ID:       "mod-evit-123",
		Name:     "eviternity.zip",
		Path:     "/games/doom/mods/eviternity.zip",
		Format:   "zip",
		Category: "Megawad",
	})
	if err != nil {
		t.Fatalf("failed to insert test mod: %v", err)
	}

	// Re-query by ID and verify IsInstalled and InstalledModID
	reloaded, err := catalogRepo.GetByID(ctx, evit.ID)
	if err != nil {
		t.Fatalf("failed to get reloaded catalog item: %v", err)
	}
	if !reloaded.IsInstalled {
		t.Errorf("expected reloaded item to be marked installed")
	}
	if reloaded.InstalledModID != "mod-evit-123" {
		t.Errorf("expected installed mod ID 'mod-evit-123', got '%s'", reloaded.InstalledModID)
	}
}

func TestCuratedShowcase(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, catalogRepo := setupTestDB(t)

	reader, err := seed.OpenCatalogReader()
	if err != nil {
		t.Fatalf("failed to open catalog reader: %v", err)
	}
	defer reader.Close()

	if _, err := catalogRepo.SeedIfEmpty(ctx, reader); err != nil {
		t.Fatalf("failed to seed catalog: %v", err)
	}

	showcase, err := catalogRepo.GetShowcase(ctx)
	if err != nil {
		t.Fatalf("failed to retrieve showcase: %v", err)
	}

	if len(showcase.CacowardClassics) == 0 {
		t.Errorf("expected showcase CacowardClassics to be populated")
	}
	for _, item := range showcase.CacowardClassics {
		if !item.IsCacoward {
			t.Errorf("expected %s in CacowardClassics to have IsCacoward == true", item.Title)
		}
	}

	if len(showcase.Top100) == 0 {
		t.Errorf("expected showcase Top100 to be populated")
	}
	for _, item := range showcase.Top100 {
		if !item.IsTop100 {
			t.Errorf("expected %s in Top100 to have IsTop100 == true", item.Title)
		}
	}

	if len(showcase.TopRated) == 0 {
		t.Errorf("expected showcase TopRated to be populated")
	}
	if len(showcase.RecentUploads) == 0 {
		t.Errorf("expected showcase RecentUploads to be populated")
	}

	// Filter by category
	megawads, err := catalogRepo.Search(ctx, idgames.SearchOptions{
		Category: "Megawad",
		Limit:    10,
	})
	if err != nil {
		t.Fatalf("filtering by Megawad category: %v", err)
	}
	if len(megawads) == 0 {
		t.Errorf("expected to find Megawad category entries")
	}
	for _, m := range megawads {
		if m.Category != "Megawad" {
			t.Errorf("expected category Megawad, got %s for %s", m.Category, m.Title)
		}
	}
}
