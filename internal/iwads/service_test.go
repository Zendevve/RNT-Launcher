package iwads

import (
	"bytes"
	"context"
	"encoding/binary"
	"os"
	"path/filepath"
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

func buildSyntheticWADFile(t *testing.T, path string, magic string, lumps []string) {
	t.Helper()
	buf := new(bytes.Buffer)

	numLumps := uint32(len(lumps))
	infotableOfs := uint32(12) // directory immediately follows 12-byte header

	buf.WriteString(magic)
	_ = binary.Write(buf, binary.LittleEndian, numLumps)
	_ = binary.Write(buf, binary.LittleEndian, infotableOfs)

	for _, name := range lumps {
		_ = binary.Write(buf, binary.LittleEndian, uint32(0)) // filepos
		_ = binary.Write(buf, binary.LittleEndian, uint32(0)) // size
		var nameBytes [8]byte
		copy(nameBytes[:], []byte(name))
		buf.Write(nameBytes[:])
	}

	if err := os.WriteFile(path, buf.Bytes(), 0644); err != nil {
		t.Fatalf("failed to write synthetic WAD file: %v", err)
	}
}

func TestIWADService_CRUD(t *testing.T) {
	repos := setupTestDB(t)
	svc := NewIWADService(repos.IWADs)
	ctx := context.Background()

	// 1. List initially empty
	list, err := svc.List(ctx)
	if err != nil {
		t.Fatalf("List() failed: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("expected 0 iwads, got %d", len(list))
	}

	// 2. Add with full details
	w1, err := svc.Add(ctx, domain.IWAD{
		Name:      "Doom II: Hell on Earth",
		Path:      "C:\\Doom\\DOOM2.WAD",
		Type:      domain.IWADTypeDoom2,
		LumpCount: 2919,
		Size:      14604584,
		SHA256:    "dummy-sha-doom2",
	})
	if err != nil {
		t.Fatalf("Add(w1) failed: %v", err)
	}
	if w1.ID == "" {
		t.Fatal("expected non-empty ID")
	}

	// 3. Add with inferred type and name from path
	w2, err := svc.Add(ctx, domain.IWAD{
		Path:      "C:\\Doom\\HERETIC.WAD",
		LumpCount: 1300,
		Size:      12000000,
	})
	if err != nil {
		t.Fatalf("Add(w2) failed: %v", err)
	}
	if w2.Type != domain.IWADTypeHeretic {
		t.Errorf("expected type Heretic, got %s", w2.Type)
	}
	if w2.Name != "Heretic" {
		t.Errorf("expected auto-name 'Heretic', got %s", w2.Name)
	}

	// 4. Get by ID
	fetched, err := svc.Get(ctx, w1.ID)
	if err != nil {
		t.Fatalf("Get(%s) failed: %v", w1.ID, err)
	}
	if fetched.Type != domain.IWADTypeDoom2 || fetched.LumpCount != 2919 {
		t.Errorf("unexpected fetched IWAD: %+v", fetched)
	}

	// 5. Get non-existent & empty
	if _, err := svc.Get(ctx, ""); err == nil {
		t.Fatal("expected error on empty ID")
	}
	if _, err := svc.Get(ctx, "unknown-id"); err == nil {
		t.Fatal("expected error on non-existent ID")
	}

	// 6. List returns sorted by name
	list, err = svc.List(ctx)
	if err != nil {
		t.Fatalf("List() failed: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 iwads, got %d", len(list))
	}
	// "Doom II: Hell on Earth" before "Heretic"
	if list[0].Name != "Doom II: Hell on Earth" || list[1].Name != "Heretic" {
		t.Errorf("unexpected list ordering: %+v", list)
	}

	// 7. Update
	fetched.LumpCount = 2920
	fetched.Name = "Doom II"
	if err := svc.Update(ctx, *fetched); err != nil {
		t.Fatalf("Update() failed: %v", err)
	}
	updated, err := svc.Get(ctx, w1.ID)
	if err != nil {
		t.Fatalf("Get() after update failed: %v", err)
	}
	if updated.LumpCount != 2920 || updated.Name != "Doom II" {
		t.Errorf("expected updated values, got %+v", updated)
	}

	// 8. Update errors
	if err := svc.Update(ctx, domain.IWAD{}); err == nil {
		t.Fatal("expected error on updating IWAD with empty ID")
	}
	if err := svc.Update(ctx, domain.IWAD{ID: w1.ID, Path: ""}); err == nil {
		t.Fatal("expected error on updating IWAD with empty Path")
	}

	// 9. Delete
	if err := svc.Delete(ctx, ""); err == nil {
		t.Fatal("expected error on deleting with empty ID")
	}
	if err := svc.Delete(ctx, w2.ID); err != nil {
		t.Fatalf("Delete(w2) failed: %v", err)
	}
	listAfterDel, _ := svc.List(ctx)
	if len(listAfterDel) != 1 {
		t.Fatalf("expected 1 iwad after delete, got %d", len(listAfterDel))
	}
}

func TestIWADService_AutoIdentifyType(t *testing.T) {
	repos := setupTestDB(t)
	svc := New(repos.IWADs)

	tests := []struct {
		name      string
		path      string
		lumpCount int
		expected  domain.IWADType
	}{
		// DOOM 1 variants
		{"DOOM.WAD", "C:\\Doom\\DOOM.WAD", 0, domain.IWADTypeDoom},
		{"doom.wad lowercase", "/games/doom/doom.wad", 0, domain.IWADTypeDoom},
		{"DOOM1.WAD", "DOOM1.WAD", 0, domain.IWADTypeDoom},
		{"doomu.wad", "doomu.wad", 0, domain.IWADTypeDoom},
		{"ultimate.wad", "ultimate.wad", 0, domain.IWADTypeDoom},
		{"ultimatedoom.wad", "ultimatedoom.wad", 0, domain.IWADTypeDoom},

		// DOOM 2 variants
		{"DOOM2.WAD", "DOOM2.WAD", 0, domain.IWADTypeDoom2},
		{"doom2.wad lowercase", "/usr/share/games/doom2.wad", 0, domain.IWADTypeDoom2},
		{"doom2f.wad", "doom2f.wad", 0, domain.IWADTypeDoom2},
		{"doom2_bfg.wad", "doom2_bfg.wad", 0, domain.IWADTypeDoom2},
		{"doomii.wad", "doomii.wad", 0, domain.IWADTypeDoom2},

		// TNT
		{"TNT.WAD", "TNT.WAD", 0, domain.IWADTypeTNT},
		{"tntevil.wad", "tntevil.wad", 0, domain.IWADTypeTNT},
		{"evilution.wad", "evilution.wad", 0, domain.IWADTypeTNT},

		// Plutonia
		{"PLUTONIA.WAD", "PLUTONIA.WAD", 0, domain.IWADTypePlutonia},
		{"pluton.wad", "pluton.wad", 0, domain.IWADTypePlutonia},

		// Heretic
		{"HERETIC.WAD", "HERETIC.WAD", 0, domain.IWADTypeHeretic},
		{"heretic1.wad", "heretic1.wad", 0, domain.IWADTypeHeretic},

		// Hexen
		{"HEXEN.WAD", "HEXEN.WAD", 0, domain.IWADTypeHexen},
		{"hexendemo.wad", "hexendemo.wad", 0, domain.IWADTypeHexen},
		{"hexen95.wad", "hexen95.wad", 0, domain.IWADTypeHexen},

		// Strife
		{"STRIFE1.WAD", "STRIFE1.WAD", 0, domain.IWADTypeStrife},
		{"strife.wad", "strife.wad", 0, domain.IWADTypeStrife},
		{"strife0.wad", "strife0.wad", 0, domain.IWADTypeStrife},

		// Freedoom
		{"FREEDOOM1.WAD", "FREEDOOM1.WAD", 0, domain.IWADTypeFreedoom},
		{"freedoom.wad", "freedoom.wad", 0, domain.IWADTypeFreedoom},
		{"freedoom-phase1.wad", "freedoom-phase1.wad", 0, domain.IWADTypeFreedoom},
		{"FREEDOOM2.WAD", "FREEDOOM2.WAD", 0, domain.IWADTypeFreedoom2},
		{"freedm.wad", "freedm.wad", 0, domain.IWADTypeFreedoom2},
		{"freedoom-phase2.wad", "freedoom-phase2.wad", 0, domain.IWADTypeFreedoom2},

		// Lump count heuristics for unrecognized filenames
		{"generic wad with 2306 lumps", "game_data.wad", 2306, domain.IWADTypeDoom},
		{"generic wad with 2919 lumps", "custom.wad", 2919, domain.IWADTypeDoom2},
		{"generic wad with 3056 lumps", "iwad.wad", 3056, domain.IWADTypeTNT},
		{"generic wad with 1300 lumps", "data.wad", 1300, domain.IWADTypeHeretic},
		{"generic wad with 1550 lumps", "data.wad", 1550, domain.IWADTypeHexen},
		{"generic wad with other lump count", "mod.wad", 42, domain.IWADTypeOther},
		{"generic wad with 0 lumps", "unknown.wad", 0, domain.IWADTypeUnknown},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotPkg := AutoIdentifyType(tt.path, tt.lumpCount)
			if gotPkg != tt.expected {
				t.Errorf("AutoIdentifyType(%q, %d) = %s, expected %s", tt.path, tt.lumpCount, gotPkg, tt.expected)
			}

			gotMethod := svc.AutoIdentifyType(tt.path, tt.lumpCount)
			if gotMethod != tt.expected {
				t.Errorf("svc.AutoIdentifyType(%q, %d) = %s, expected %s", tt.path, tt.lumpCount, gotMethod, tt.expected)
			}
		})
	}
}

func TestIWADService_RegisterFile(t *testing.T) {
	repos := setupTestDB(t)
	svc := NewIWADService(repos.IWADs)
	ctx := context.Background()

	tempDir := t.TempDir()

	// 1. Synthetic DOOM2.WAD
	doom2Path := filepath.Join(tempDir, "DOOM2.WAD")
	lumps := []string{"MAP01", "MAP02", "PLAYPAL", "COLORMAP", "ENDOOM"}
	buildSyntheticWADFile(t, doom2Path, "IWAD", lumps)

	iwad, err := svc.RegisterFile(ctx, doom2Path)
	if err != nil {
		t.Fatalf("RegisterFile(doom2) failed: %v", err)
	}

	if iwad.ID == "" {
		t.Error("expected registered IWAD to have ID")
	}
	if iwad.Type != domain.IWADTypeDoom2 {
		t.Errorf("expected type %s, got %s", domain.IWADTypeDoom2, iwad.Type)
	}
	if iwad.Name != "Doom II: Hell on Earth" {
		t.Errorf("expected display name %q, got %q", "Doom II: Hell on Earth", iwad.Name)
	}
	if iwad.LumpCount != len(lumps) {
		t.Errorf("expected %d lumps, got %d", len(lumps), iwad.LumpCount)
	}
	if iwad.Size <= 0 {
		t.Errorf("expected positive size, got %d", iwad.Size)
	}
	if iwad.SHA256 == "" {
		t.Error("expected non-empty SHA256")
	}

	// 2. Re-registering existing file returns existing record
	reRegistered, err := svc.RegisterFile(ctx, doom2Path)
	if err != nil {
		t.Fatalf("RegisterFile() second time failed: %v", err)
	}
	if reRegistered.ID != iwad.ID {
		t.Errorf("expected same ID %s, got %s", iwad.ID, reRegistered.ID)
	}

	// 3. Registering non-existent file returns error
	if _, err := svc.RegisterFile(ctx, filepath.Join(tempDir, "non-existent.wad")); err == nil {
		t.Error("expected error on non-existent file")
	}

	// 4. Registering empty path returns error
	if _, err := svc.RegisterFile(ctx, ""); err == nil {
		t.Error("expected error on empty path")
	}

	// 5. Verify registered IWAD is queryable in DB
	all, err := svc.List(ctx)
	if err != nil {
		t.Fatalf("List() failed: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("expected 1 IWAD in repo, got %d", len(all))
	}
	if all[0].ID != iwad.ID {
		t.Errorf("expected ID %s, got %s", iwad.ID, all[0].ID)
	}
}
