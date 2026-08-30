package database_test

import (
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
)

func BenchmarkDatabase_BulkModOperations(b *testing.B) {
	tempDir := b.TempDir()
	dbPath := filepath.Join(tempDir, "bench_mods.db")

	db, err := database.InitDB(dbPath)
	if err != nil {
		b.Fatalf("failed to init db: %v", err)
	}
	defer db.Close()

	modRepo := database.NewModRepository(db)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		b.StopTimer()
		// Seed 100 mods
		mods := make([]domain.Mod, 100)
		for j := 0; j < 100; j++ {
			mods[j] = domain.Mod{
				ID:         uuid.NewString(),
				Name:       fmt.Sprintf("Mega Mod Volume %d", j),
				Path:       fmt.Sprintf("/games/doom/mods/megamod_%d_%d.pk3", i, j),
				Format:     domain.ModFormatPK3,
				Category:   domain.ModCategoryGameplay,
				Size:       int64(1024 * 1024 * (j + 1)),
				ModifiedAt: time.Now().UTC(),
				SHA256:     fmt.Sprintf("sha256_hash_%04d_%s", j, uuid.NewString()),
				LumpCount:  50 + j,
				Structures: []string{"MAPINFO", "ZSCRIPT"},
				CreatedAt:  time.Now().UTC(),
				UpdatedAt:  time.Now().UTC(),
			}
		}
		b.StartTimer()

		startInsert := time.Now()
		for j := range mods {
			if err := modRepo.Create(&mods[j]); err != nil {
				b.Fatalf("insert failed: %v", err)
			}
		}
		insertDuration := time.Since(startInsert)
		if insertDuration > 500*time.Millisecond {
			b.Logf("Warning: 100 mod insert took %v", insertDuration)
		}

		// Search Query with Partial Match Filter
		startSearch := time.Now()
		searchRes, err := modRepo.List(domain.ModFilter{
			Search: "Volume 5",
		})
		searchDuration := time.Since(startSearch)
		if err != nil {
			b.Fatalf("search failed: %v", err)
		}
		if len(searchRes) == 0 {
			b.Fatalf("expected search matches, got 0")
		}
		if searchDuration > 50*time.Millisecond {
			b.Logf("Warning: search took %v", searchDuration)
		}
	}
}

func TestDatabase_ScalePerformance100Items(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "scale_test.db")

	db, err := database.InitDB(dbPath)
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	defer db.Close()

	engineRepo := database.NewEngineRepository(db)
	iwadRepo := database.NewIWADRepository(db)
	modRepo := database.NewModRepository(db)
	profileRepo := database.NewProfileRepository(db)

	// 1. Insert 5 Engines
	t0 := time.Now()
	engineIDs := make([]string, 5)
	for i := 0; i < 5; i++ {
		id := uuid.NewString()
		engineIDs[i] = id
		err := engineRepo.Create(&domain.Engine{
			ID:         id,
			Name:       fmt.Sprintf("SourcePort Engine %d", i+1),
			Executable: fmt.Sprintf("/bin/engine_%d", i+1),
			Family:     domain.EngineFamilyGZDoom,
		})
		if err != nil {
			t.Fatalf("failed to create engine %d: %v", i, err)
		}
	}

	// 2. Insert 10 IWADs
	iwadIDs := make([]string, 10)
	for i := 0; i < 10; i++ {
		id := uuid.NewString()
		iwadIDs[i] = id
		err := iwadRepo.Create(&domain.IWAD{
			ID:        id,
			Name:      fmt.Sprintf("DOOM_EXPANSION_%d.WAD", i+1),
			Path:      fmt.Sprintf("/iwads/doom_%d.wad", i+1),
			Type:      domain.IWADTypeDoom2,
			LumpCount: 2000 + i,
		})
		if err != nil {
			t.Fatalf("failed to create iwad %d: %v", i, err)
		}
	}

	// 3. Insert 100 Mods
	modIDs := make([]string, 100)
	for i := 0; i < 100; i++ {
		id := uuid.NewString()
		modIDs[i] = id
		err := modRepo.Create(&domain.Mod{
			ID:         id,
			Name:       fmt.Sprintf("Custom Mod Episode %03d", i+1),
			Path:       fmt.Sprintf("/mods/episode_%03d.pk3", i+1),
			Format:     domain.ModFormatPK3,
			Category:   domain.ModCategoryGameplay,
			Size:       int64(2048 * (i + 1)),
			SHA256:     fmt.Sprintf("sha256_scale_%04d_%s", i, uuid.NewString()),
			LumpCount:  100 + i,
			CreatedAt:  time.Now().UTC(),
			UpdatedAt:  time.Now().UTC(),
		})
		if err != nil {
			t.Fatalf("failed to create mod %d: %v", i, err)
		}
	}

	// 4. Create 10 Profiles with 10 mods each
	for i := 0; i < 10; i++ {
		pID := uuid.NewString()
		err := profileRepo.Create(&domain.Profile{
			ID:          pID,
			Name:        fmt.Sprintf("Ultimate Profile %d", i+1),
			Description: fmt.Sprintf("Heavy loadout profile %d", i+1),
			EngineID:    engineIDs[i%len(engineIDs)],
			IWADID:      iwadIDs[i%len(iwadIDs)],
		})
		if err != nil {
			t.Fatalf("failed to create profile %d: %v", i, err)
		}

		profileMods := make([]domain.ProfileMod, 10)
		for m := 0; m < 10; m++ {
			profileMods[m] = domain.ProfileMod{
				ModID:   modIDs[(i*10+m)%len(modIDs)],
				Enabled: true,
				Order:   m,
			}
		}
		err = profileRepo.SetProfileMods(pID, profileMods)
		if err != nil {
			t.Fatalf("failed to set profile mods for profile %d: %v", i, err)
		}
	}

	totalSetupTime := time.Since(t0)
	t.Logf("100 mods + 10 iwads + 5 engines + 10 profiles created in %v", totalSetupTime)

	// 5. Measure Query Latency: List all 100 mods
	tQuery := time.Now()
	allMods, err := modRepo.List(domain.ModFilter{})
	queryDuration := time.Since(tQuery)
	if err != nil || len(allMods) != 100 {
		t.Fatalf("expected 100 mods, got %d (err: %v)", len(allMods), err)
	}
	t.Logf("List 100 mods query latency: %v", queryDuration)
	if queryDuration > 20*time.Millisecond {
		t.Errorf("List query exceeded 20ms threshold: %v", queryDuration)
	}

	// 6. Measure Search Filter Latency with substring match
	tSearch := time.Now()
	searchResults, err := modRepo.List(domain.ModFilter{Search: "Episode 05"})
	searchDuration := time.Since(tSearch)
	if err != nil || len(searchResults) != 10 {
		t.Fatalf("expected 10 matching mods for 'Episode 05', got %d (err: %v)", len(searchResults), err)
	}
	t.Logf("Search 100 mods latency: %v", searchDuration)
	if searchDuration > 15*time.Millisecond {
		t.Errorf("Search query exceeded 15ms threshold: %v", searchDuration)
	}

	// 7. Measure Profile Listing with Full Load Order Hydration
	tProfiles := time.Now()
	allProfiles, err := profileRepo.List()
	profDuration := time.Since(tProfiles)
	if err != nil || len(allProfiles) != 10 {
		t.Fatalf("expected 10 profiles, got %d (err: %v)", len(allProfiles), err)
	}
	t.Logf("List 10 profiles (100 total mod links) latency: %v", profDuration)
	if profDuration > 25*time.Millisecond {
		t.Errorf("Profile listing exceeded 25ms threshold: %v", profDuration)
	}
}
