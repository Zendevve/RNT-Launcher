package profiles_test

import (
	"archive/zip"
	"context"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/filesystem"
	"rnt-launcher/internal/profiles"
)

// buildBundleWAD builds a minimal valid PWAD with the given lump names and
// zero-length lump data.
func buildBundleWAD(lumps []string) []byte {
	headerSize := 12
	dirOffset := headerSize
	buf := make([]byte, 0, headerSize+len(lumps)*16)
	buf = append(buf, 'P', 'W', 'A', 'D')
	buf = append(buf, byte(len(lumps)), 0, 0, 0)
	buf = append(buf, byte(dirOffset), 0, 0, 0)
	for _, lump := range lumps {
		// offset (headerSize: lump data is empty), size 0, 8-byte name.
		buf = append(buf, byte(headerSize), 0, 0, 0)
		buf = append(buf, 0, 0, 0, 0)
		name := make([]byte, 8)
		copy(name, lump)
		buf = append(buf, name...)
	}
	return buf
}

// seedBundleMod writes data to dir/name and registers it as a library mod.
func seedBundleMod(t *testing.T, h *testHarness, id, name, dir string, data []byte) *domain.Mod {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, data, 0644); err != nil {
		t.Fatalf("failed to write fixture mod: %v", err)
	}
	hash, err := filesystem.ComputeSHA256(path)
	if err != nil {
		t.Fatalf("failed to hash fixture mod: %v", err)
	}
	mod := &domain.Mod{
		ID:         id,
		Name:       strings.TrimSuffix(name, filepath.Ext(name)),
		Path:       path,
		Format:     domain.ModFormatWAD,
		Category:   domain.ModCategoryMaps,
		Size:       int64(len(data)),
		ModifiedAt: time.Now().UTC(),
		SHA256:     hash,
		LumpCount:  2,
		Structures: []string{},
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	}
	if err := h.mods.Create(mod); err != nil {
		t.Fatalf("seedBundleMod failed: %v", err)
	}
	return mod
}

func setupBundleProfile(t *testing.T, h *testHarness, dir string) *domain.Profile {
	t.Helper()
	ctx := context.Background()
	eng := seedEngine(t, h, "eng-gzdoom", "GZDoom", "C:/Games/Doom/gzdoom.exe")
	iwad := seedIWAD(t, h, "iwad-doom2", "Doom II", "C:/Games/Doom/DOOM2.WAD", domain.IWADTypeDoom2)
	mod1 := seedBundleMod(t, h, "mod-maps1", "eviternity.wad", dir, buildBundleWAD([]string{"MAP01", "MAPINFO"}))
	mod2 := seedBundleMod(t, h, "mod-maps2", "resurgence.wad", dir, buildBundleWAD([]string{"MAP01", "DECORATE"}))

	p, err := h.svc.Create(ctx, domain.Profile{
		Name:     "Bundle Test",
		EngineID: eng.ID,
		IWADID:   iwad.ID,
		Mods: []domain.ProfileMod{
			{ModID: mod1.ID, Enabled: true, Order: 1},
			{ModID: mod2.ID, Enabled: true, Order: 2},
		},
	})
	if err != nil {
		t.Fatalf("Create profile failed: %v", err)
	}
	return p
}

func profileModHashes(t *testing.T, mods []domain.ProfileMod) []string {
	t.Helper()
	hashes := make([]string, 0, len(mods))
	for _, m := range mods {
		h, err := filesystem.ComputeSHA256(m.ModPath)
		if err != nil {
			t.Fatalf("failed to hash profile mod %q: %v", m.ModPath, err)
		}
		hashes = append(hashes, h)
	}
	sort.Strings(hashes)
	return hashes
}

func TestProfileBundle_RoundTrip(t *testing.T) {
	ctx := context.Background()
	h := setupTestHarness(t)
	dir := t.TempDir()
	original := setupBundleProfile(t, h, dir)

	zipPath, shareCode, err := h.svc.ExportBundle(ctx, original.ID)
	if err != nil {
		t.Fatalf("ExportBundle failed: %v", err)
	}
	t.Cleanup(func() { _ = os.Remove(zipPath) })

	if !strings.HasPrefix(shareCode, profiles.ShareCodePrefix) {
		t.Fatalf("share code missing prefix: %q", shareCode)
	}
	manifest, err := profiles.ParseShareCode(shareCode)
	if err != nil {
		t.Fatalf("ParseShareCode failed: %v", err)
	}
	if manifest.Name != "Bundle Test" {
		t.Errorf("manifest name = %q, want %q", manifest.Name, "Bundle Test")
	}
	if manifest.EngineFamily != string(domain.EngineFamilyGZDoom) {
		t.Errorf("manifest engineFamily = %q, want %q", manifest.EngineFamily, domain.EngineFamilyGZDoom)
	}
	if manifest.IWADType != string(domain.IWADTypeDoom2) {
		t.Errorf("manifest iwadType = %q, want %q", manifest.IWADType, domain.IWADTypeDoom2)
	}
	if manifest.Version != profiles.BundleVersion {
		t.Errorf("manifest version = %d, want %d", manifest.Version, profiles.BundleVersion)
	}
	if len(manifest.ModHashes) != 2 {
		t.Fatalf("manifest modHashes len = %d, want 2", len(manifest.ModHashes))
	}

	imported, err := h.svc.ImportBundle(ctx, zipPath)
	if err != nil {
		t.Fatalf("ImportBundle failed: %v", err)
	}
	if imported.Name != "Bundle Test (imported)" {
		t.Errorf("imported name = %q, want %q", imported.Name, "Bundle Test (imported)")
	}
	if imported.EngineID != original.EngineID {
		t.Errorf("imported engineID = %q, want %q", imported.EngineID, original.EngineID)
	}
	if imported.IWADID != original.IWADID {
		t.Errorf("imported iwadID = %q, want %q", imported.IWADID, original.IWADID)
	}
	if len(imported.Mods) != len(original.Mods) {
		t.Fatalf("imported mods len = %d, want %d", len(imported.Mods), len(original.Mods))
	}
	wantHashes := profileModHashes(t, original.Mods)
	gotHashes := profileModHashes(t, imported.Mods)
	for i := range wantHashes {
		if gotHashes[i] != wantHashes[i] {
			t.Errorf("mod hash %d = %s, want %s", i, gotHashes[i], wantHashes[i])
		}
	}
}

// rewriteBundleZip copies src to a new temp zip, replacing the content of
// entryName with tampered bytes.
func rewriteBundleZip(t *testing.T, src, entryName string, tampered []byte) string {
	t.Helper()
	r, err := zip.OpenReader(src)
	if err != nil {
		t.Fatalf("failed to open bundle: %v", err)
	}
	defer r.Close()
	dst, err := os.CreateTemp("", "rntpack-tampered-*.zip")
	if err != nil {
		t.Fatalf("failed to create tampered bundle: %v", err)
	}
	dstPath := dst.Name()
	w := zip.NewWriter(dst)
	for _, f := range r.File {
		rc, err := f.Open()
		if err != nil {
			t.Fatalf("failed to read entry %q: %v", f.Name, err)
		}
		data, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			t.Fatalf("failed to read entry %q: %v", f.Name, err)
		}
		if f.Name == entryName {
			data = tampered
		}
		ew, err := w.Create(f.Name)
		if err != nil {
			t.Fatalf("failed to write entry %q: %v", f.Name, err)
		}
		if _, err := ew.Write(data); err != nil {
			t.Fatalf("failed to write entry %q: %v", f.Name, err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("failed to close tampered bundle: %v", err)
	}
	if err := dst.Close(); err != nil {
		t.Fatalf("failed to close tampered bundle: %v", err)
	}
	t.Cleanup(func() { _ = os.Remove(dstPath) })
	return dstPath
}

func TestProfileBundle_TamperedFileErrors(t *testing.T) {
	ctx := context.Background()
	h := setupTestHarness(t)
	dir := t.TempDir()
	original := setupBundleProfile(t, h, dir)

	zipPath, _, err := h.svc.ExportBundle(ctx, original.ID)
	if err != nil {
		t.Fatalf("ExportBundle failed: %v", err)
	}
	t.Cleanup(func() { _ = os.Remove(zipPath) })

	r, err := zip.OpenReader(zipPath)
	if err != nil {
		t.Fatalf("failed to open bundle: %v", err)
	}
	var modEntry string
	for _, f := range r.File {
		if strings.HasPrefix(f.Name, "mods/") {
			modEntry = f.Name
			break
		}
	}
	r.Close()
	if modEntry == "" {
		t.Fatal("bundle holds no mods/* entry")
	}

	tampered := rewriteBundleZip(t, zipPath, modEntry, buildBundleWAD([]string{"MAP99", "HACKED!!"}))
	if _, err := h.svc.ImportBundle(ctx, tampered); err == nil {
		t.Fatal("expected error importing tampered bundle, got nil")
	}
}

func TestProfileBundle_ParseShareCodeErrors(t *testing.T) {
	t.Run("missing prefix", func(t *testing.T) {
		if _, err := profiles.ParseShareCode("https://example.com/pack/abc"); err == nil {
			t.Error("expected error for missing prefix, got nil")
		}
	})
	t.Run("bad encoding", func(t *testing.T) {
		if _, err := profiles.ParseShareCode(profiles.ShareCodePrefix + "!!!not-base64!!!"); err == nil {
			t.Error("expected error for bad encoding, got nil")
		}
	})
	t.Run("bad payload", func(t *testing.T) {
		if _, err := profiles.ParseShareCode(profiles.ShareCodePrefix + "aGk"); err == nil {
			t.Error("expected error for non-manifest payload, got nil")
		}
	})
}
