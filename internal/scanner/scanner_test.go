package scanner

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
)

// Helper to build a synthetic WAD in bytes
func buildTestWAD(magic string, lumps []string) []byte {
	buf := new(bytes.Buffer)
	numLumps := uint32(len(lumps))
	infotableOfs := uint32(12)

	buf.WriteString(magic)
	_ = binary.Write(buf, binary.LittleEndian, numLumps)
	_ = binary.Write(buf, binary.LittleEndian, infotableOfs)

	for _, name := range lumps {
		_ = binary.Write(buf, binary.LittleEndian, uint32(0))
		_ = binary.Write(buf, binary.LittleEndian, uint32(0))

		var nameBytes [8]byte
		copy(nameBytes[:], []byte(name))
		buf.Write(nameBytes[:])
	}

	return buf.Bytes()
}

// Helper to build a synthetic ZIP/PK3 in bytes
func buildTestZip(entries map[string]string) []byte {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	for name, content := range entries {
		w, err := zw.Create(name)
		if err != nil {
			panic(err)
		}
		_, _ = w.Write([]byte(content))
	}

	_ = zw.Close()
	return buf.Bytes()
}

func setupTestScanner(t *testing.T) (*ScannerService, *database.Repositories) {
	t.Helper()
	db, err := database.InitDB(":memory:")
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	repos := database.NewRepositories(db)
	svc := NewScannerService(repos.Mods, repos.IWADs, repos.Engines, repos.Settings)
	return svc, repos
}

func TestScannerService_ScanModDirectory(t *testing.T) {
	svc, repos := setupTestScanner(t)
	tempDir := t.TempDir()

	// 1. Create PWAD
	pwadData := buildTestWAD("PWAD", []string{"MAP01", "MAP02", "MAPINFO", "TEXTURES"})
	pwadPath := filepath.Join(tempDir, "mymod.wad")
	if err := os.WriteFile(pwadPath, pwadData, 0644); err != nil {
		t.Fatalf("failed to write pwad: %v", err)
	}

	// 2. Create PK3
	pk3Data := buildTestZip(map[string]string{
		"zscript/main.txt": "class MyZScriptActor {}",
		"decorate.txt":     "actor MyActor {}",
		"maps/map01.wad":   "dummy map content",
	})
	pk3Path := filepath.Join(tempDir, "gameplay.pk3")
	if err := os.WriteFile(pk3Path, pk3Data, 0644); err != nil {
		t.Fatalf("failed to write pk3: %v", err)
	}

	// 3. Create DEHACKED patch
	dehPath := filepath.Join(tempDir, "patch.deh")
	if err := os.WriteFile(dehPath, []byte("Patch File for DeHackEd v3.0\nDoom version = 19\n"), 0644); err != nil {
		t.Fatalf("failed to write deh: %v", err)
	}

	// 4. Create hidden folder & file (must be ignored)
	hiddenDir := filepath.Join(tempDir, ".git")
	_ = os.MkdirAll(hiddenDir, 0755)
	_ = os.WriteFile(filepath.Join(hiddenDir, "ignored.wad"), pwadData, 0644)

	hiddenFile := filepath.Join(tempDir, ".hidden.pk3")
	_ = os.WriteFile(hiddenFile, pk3Data, 0644)

	// 5. Create non-mod file (must be ignored)
	_ = os.WriteFile(filepath.Join(tempDir, "notes.txt"), []byte("not a mod"), 0644)

	// Run ScanModDirectory
	var progressCalls int
	count, err := svc.ScanModDirectory(context.Background(), tempDir, func(current, total int, currentFile string) {
		progressCalls++
		if current < 1 || current > total {
			t.Errorf("invalid progress: %d of %d", current, total)
		}
		if currentFile == "" {
			t.Errorf("expected non-empty currentFile")
		}
	})

	if err != nil {
		t.Fatalf("ScanModDirectory failed: %v", err)
	}

	if count != 3 {
		t.Fatalf("expected 3 mods discovered, got %d", count)
	}

	if progressCalls != 3 {
		t.Fatalf("expected 3 progress callbacks, got %d", progressCalls)
	}

	// Verify persistence in ModRepository
	mods, err := repos.Mods.List(domain.ModFilter{})
	if err != nil {
		t.Fatalf("repos.Mods.List failed: %v", err)
	}
	if len(mods) != 3 {
		t.Fatalf("expected 3 mods in repository, got %d", len(mods))
	}

	modMap := make(map[string]domain.Mod)
	for _, m := range mods {
		modMap[m.FileName()] = m
	}

	// Verify mymod.wad
	pwadMod, ok := modMap["mymod.wad"]
	if !ok {
		t.Fatalf("mymod.wad not found in DB")
	}
	if pwadMod.Format != domain.ModFormatWAD {
		t.Errorf("expected format WAD, got %s", pwadMod.Format)
	}
	if pwadMod.LumpCount != 4 {
		t.Errorf("expected 4 lumps, got %d", pwadMod.LumpCount)
	}
	if !pwadMod.HasStructure("MAPINFO") {
		t.Errorf("expected structure MAPINFO")
	}

	// Verify gameplay.pk3
	pk3Mod, ok := modMap["gameplay.pk3"]
	if !ok {
		t.Fatalf("gameplay.pk3 not found in DB")
	}
	if pk3Mod.Format != domain.ModFormatPK3 {
		t.Errorf("expected format PK3, got %s", pk3Mod.Format)
	}
	if !pk3Mod.HasStructure("ZSCRIPT") || !pk3Mod.HasStructure("DECORATE") {
		t.Errorf("expected structures ZSCRIPT and DECORATE, got %v", pk3Mod.Structures)
	}

	// Verify patch.deh
	dehMod, ok := modMap["patch.deh"]
	if !ok {
		t.Fatalf("patch.deh not found in DB")
	}
	if dehMod.Format != domain.ModFormatDEH {
		t.Errorf("expected format DEH, got %s", dehMod.Format)
	}
}

func TestScannerService_ScanIWADDirectory(t *testing.T) {
	svc, repos := setupTestScanner(t)
	tempDir := t.TempDir()

	// 1. Create standard IWAD: doom2.wad
	doom2Data := buildTestWAD("IWAD", []string{"MAP01", "MAP02", "MAP03", "PLAYPAL", "COLORMAP"})
	doom2Path := filepath.Join(tempDir, "doom2.wad")
	if err := os.WriteFile(doom2Path, doom2Data, 0644); err != nil {
		t.Fatalf("failed to write doom2.wad: %v", err)
	}

	// 2. Create standard IWAD: heretic.wad
	hereticData := buildTestWAD("IWAD", []string{"E1M1", "E1M2", "PLAYPAL"})
	hereticPath := filepath.Join(tempDir, "heretic.wad")
	if err := os.WriteFile(hereticPath, hereticData, 0644); err != nil {
		t.Fatalf("failed to write heretic.wad: %v", err)
	}

	// 3. Create PWAD in IWAD dir
	pwadData := buildTestWAD("PWAD", []string{"MAP01"})
	pwadPath := filepath.Join(tempDir, "custom_mod.wad")
	if err := os.WriteFile(pwadPath, pwadData, 0644); err != nil {
		t.Fatalf("failed to write custom_mod.wad: %v", err)
	}

	count, err := svc.ScanIWADDirectory(context.Background(), tempDir)
	if err != nil {
		t.Fatalf("ScanIWADDirectory failed: %v", err)
	}

	if count != 3 {
		t.Fatalf("expected 3 items discovered (2 IWADs + 1 PWAD), got %d", count)
	}

	// Verify IWAD repository
	iwads, err := repos.IWADs.List()
	if err != nil {
		t.Fatalf("IWADs.List failed: %v", err)
	}
	if len(iwads) != 2 {
		t.Fatalf("expected 2 IWADs in DB, got %d", len(iwads))
	}

	iwadMap := make(map[domain.IWADType]domain.IWAD)
	for _, w := range iwads {
		iwadMap[w.Type] = w
	}

	if _, ok := iwadMap[domain.IWADTypeDoom2]; !ok {
		t.Errorf("expected doom2 IWAD in DB")
	}
	if _, ok := iwadMap[domain.IWADTypeHeretic]; !ok {
		t.Errorf("expected heretic IWAD in DB")
	}

	// Verify that PWAD in IWAD dir was saved into Mod repository
	mods, err := repos.Mods.List(domain.ModFilter{})
	if err != nil {
		t.Fatalf("Mods.List failed: %v", err)
	}
	if len(mods) != 1 {
		t.Fatalf("expected 1 mod in DB from PWAD in IWAD dir, got %d", len(mods))
	}
	if mods[0].FileName() != "custom_mod.wad" {
		t.Errorf("expected custom_mod.wad, got %s", mods[0].FileName())
	}
}

func TestScannerService_ScanEngineDirectory(t *testing.T) {
	svc, repos := setupTestScanner(t)
	tempDir := t.TempDir()

	// 1. Create engine files
	gzPath := filepath.Join(tempDir, "gzdoom.exe")
	_ = os.WriteFile(gzPath, []byte("fake gzdoom binary"), 0755)

	dsdaPath := filepath.Join(tempDir, "dsda-doom.exe")
	_ = os.WriteFile(dsdaPath, []byte("fake dsda-doom binary"), 0755)

	woofPath := filepath.Join(tempDir, "woof.exe")
	_ = os.WriteFile(woofPath, []byte("fake woof binary"), 0755)

	// 2. Create non-engine files that should be ignored
	_ = os.WriteFile(filepath.Join(tempDir, "unins000.exe"), []byte("uninstaller"), 0755)
	_ = os.WriteFile(filepath.Join(tempDir, "crashrpt.dll"), []byte("dll"), 0644)
	_ = os.WriteFile(filepath.Join(tempDir, "readme.txt"), []byte("docs"), 0644)

	count, err := svc.ScanEngineDirectory(context.Background(), tempDir)
	if err != nil {
		t.Fatalf("ScanEngineDirectory failed: %v", err)
	}

	if count != 3 {
		t.Fatalf("expected 3 engines discovered, got %d", count)
	}

	// Verify persistence in EngineRepository
	engines, err := repos.Engines.List()
	if err != nil {
		t.Fatalf("Engines.List failed: %v", err)
	}
	if len(engines) != 3 {
		t.Fatalf("expected 3 engines in DB, got %d", len(engines))
	}

	engMap := make(map[domain.EngineFamily]domain.Engine)
	for _, e := range engines {
		engMap[e.Family] = e
	}

	if gz, ok := engMap[domain.EngineFamilyGZDoom]; !ok {
		t.Errorf("expected GZDoom in DB")
	} else if gz.Name != "GZDoom" {
		t.Errorf("expected name GZDoom, got %s", gz.Name)
	}

	if dsda, ok := engMap[domain.EngineFamilyDSDADoom]; !ok {
		t.Errorf("expected dsda-doom in DB")
	} else if dsda.Name != "dsda-doom" {
		t.Errorf("expected name dsda-doom, got %s", dsda.Name)
	}

	if woof, ok := engMap[domain.EngineFamilyWoof]; !ok {
		t.Errorf("expected Woof! in DB")
	} else if woof.Name != "Woof!" {
		t.Errorf("expected name Woof!, got %s", woof.Name)
	}
}

func TestScannerService_ScanDirectories_Combined(t *testing.T) {
	svc, _ := setupTestScanner(t)

	modDir := t.TempDir()
	iwadDir := t.TempDir()
	engineDir := t.TempDir()

	// Mod dir setup
	pwadData := buildTestWAD("PWAD", []string{"MAP01", "DECORATE"})
	_ = os.WriteFile(filepath.Join(modDir, "mod1.wad"), pwadData, 0644)

	// IWAD dir setup
	iwadData := buildTestWAD("IWAD", []string{"E1M1", "PLAYPAL"})
	_ = os.WriteFile(filepath.Join(iwadDir, "doom.wad"), iwadData, 0644)

	// Engine dir setup
	_ = os.WriteFile(filepath.Join(engineDir, "zandronum.exe"), []byte("binary"), 0755)

	var reportedProgress bool
	result, err := svc.ScanDirectories(
		context.Background(),
		[]string{modDir},
		[]string{iwadDir},
		[]string{engineDir},
		func(current, total int, currentFile string) {
			reportedProgress = true
		},
	)

	if err != nil {
		t.Fatalf("ScanDirectories failed: %v", err)
	}

	if !reportedProgress {
		t.Errorf("expected progress reporting to occur")
	}

	if result.DiscoveredMods != 1 {
		t.Errorf("expected 1 mod, got %d", result.DiscoveredMods)
	}
	if result.DiscoveredIWADs != 1 {
		t.Errorf("expected 1 iwad, got %d", result.DiscoveredIWADs)
	}
	if result.DiscoveredEngines != 1 {
		t.Errorf("expected 1 engine, got %d", result.DiscoveredEngines)
	}
	if result.TotalDiscovered() != 3 {
		t.Errorf("expected total discovered 3, got %d", result.TotalDiscovered())
	}
	if result.HasErrors() {
		t.Errorf("unexpected errors in scan: %v", result.Errors)
	}
}

func TestScannerService_ScanAll(t *testing.T) {
	svc, repos := setupTestScanner(t)

	modDir := t.TempDir()
	iwadDir := t.TempDir()
	engineDir := t.TempDir()

	_ = os.WriteFile(filepath.Join(modDir, "test.pk3"), buildTestZip(map[string]string{"mapinfo.txt": "map MAP01 {}"}), 0644)
	_ = os.WriteFile(filepath.Join(iwadDir, "tnt.wad"), buildTestWAD("IWAD", []string{"MAP01"}), 0644)
	_ = os.WriteFile(filepath.Join(engineDir, "crispy-doom.exe"), []byte("binary"), 0755)

	// Save settings
	settings := domain.Settings{
		ModDirectories:    []string{modDir},
		IWADDirectories:   []string{iwadDir},
		EngineDirectories: []string{engineDir},
	}
	if err := repos.Settings.SaveSettings(settings); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}

	result, err := svc.ScanAll(context.Background(), nil)
	if err != nil {
		t.Fatalf("ScanAll failed: %v", err)
	}

	if result.TotalDiscovered() != 3 {
		t.Errorf("expected total discovered 3, got %d", result.TotalDiscovered())
	}
}

func TestScannerService_ImportFile(t *testing.T) {
	svc, repos := setupTestScanner(t)
	tempDir := t.TempDir()

	t.Run("Import valid PWAD", func(t *testing.T) {
		pwadData := buildTestWAD("PWAD", []string{"MAP01", "MAPINFO"})
		path := filepath.Join(tempDir, "single_pwad.wad")
		_ = os.WriteFile(path, pwadData, 0644)

		mod, err := svc.ImportFile(context.Background(), path)
		if err != nil {
			t.Fatalf("ImportFile failed: %v", err)
		}
		if mod == nil {
			t.Fatalf("expected non-nil mod")
		}
		if mod.Name != "single_pwad" {
			t.Errorf("expected name single_pwad, got %s", mod.Name)
		}
		if mod.Format != domain.ModFormatWAD {
			t.Errorf("expected format WAD, got %s", mod.Format)
		}
		if mod.LumpCount != 2 {
			t.Errorf("expected 2 lumps, got %d", mod.LumpCount)
		}

		// Check repository
		dbMod, err := repos.Mods.Get(mod.ID)
		if err != nil {
			t.Fatalf("failed to retrieve mod by ID: %v", err)
		}
		if dbMod.Path != filepath.Clean(path) {
			t.Errorf("expected path %s, got %s", path, dbMod.Path)
		}
	})

	t.Run("Import valid IWAD", func(t *testing.T) {
		iwadData := buildTestWAD("IWAD", []string{"MAP01", "PLAYPAL"})
		path := filepath.Join(tempDir, "plutonia.wad")
		_ = os.WriteFile(path, iwadData, 0644)

		mod, err := svc.ImportFile(context.Background(), path)
		if err != nil {
			t.Fatalf("ImportFile failed: %v", err)
		}
		if mod == nil {
			t.Fatalf("expected non-nil mod")
		}

		// Verify it was also registered in IWAD repository
		iwads, err := repos.IWADs.List()
		if err != nil {
			t.Fatalf("IWADs.List failed: %v", err)
		}
		var found bool
		for _, w := range iwads {
			if w.Type == domain.IWADTypePlutonia {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected plutonia in IWAD repository")
		}
	})

	t.Run("Import non-existent file", func(t *testing.T) {
		_, err := svc.ImportFile(context.Background(), filepath.Join(tempDir, "ghost.wad"))
		if err == nil {
			t.Errorf("expected error for non-existent file")
		}
	})

	t.Run("Import directory", func(t *testing.T) {
		_, err := svc.ImportFile(context.Background(), tempDir)
		if err == nil {
			t.Errorf("expected error when importing directory")
		}
	})

	t.Run("Import unsupported format", func(t *testing.T) {
		path := filepath.Join(tempDir, "document.pdf")
		_ = os.WriteFile(path, []byte("some pdf bytes"), 0644)
		_, err := svc.ImportFile(context.Background(), path)
		if err == nil {
			t.Errorf("expected error for unsupported format")
		}
	})
}

func TestScannerService_DuplicateRescan(t *testing.T) {
	svc, repos := setupTestScanner(t)
	tempDir := t.TempDir()

	pwadData := buildTestWAD("PWAD", []string{"MAP01"})
	pwadPath := filepath.Join(tempDir, "rescan.wad")
	_ = os.WriteFile(pwadPath, pwadData, 0644)

	// First scan
	count1, err := svc.ScanModDirectory(context.Background(), tempDir, nil)
	if err != nil || count1 != 1 {
		t.Fatalf("first scan failed: count=%d err=%v", count1, err)
	}

	// Second scan (should update, not insert duplicate)
	count2, err := svc.ScanModDirectory(context.Background(), tempDir, nil)
	if err != nil || count2 != 1 {
		t.Fatalf("second scan failed: count=%d err=%v", count2, err)
	}

	mods, err := repos.Mods.List(domain.ModFilter{})
	if err != nil {
		t.Fatalf("Mods.List failed: %v", err)
	}
	if len(mods) != 1 {
		t.Fatalf("expected exactly 1 mod after rescan, got %d", len(mods))
	}
}

func TestScannerService_ContextCancellation(t *testing.T) {
	svc, _ := setupTestScanner(t)
	tempDir := t.TempDir()

	_ = os.WriteFile(filepath.Join(tempDir, "m1.wad"), buildTestWAD("PWAD", []string{"MAP01"}), 0644)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	_, err := svc.ScanModDirectory(ctx, tempDir, nil)
	if err == nil {
		t.Errorf("expected context error on cancelled scan")
	}

	result, err := svc.ScanDirectories(ctx, []string{tempDir}, nil, nil, nil)
	if err == nil && !result.HasErrors() {
		t.Errorf("expected context error or result cancellation")
	}
}

func TestDetectEngineFamily(t *testing.T) {
	tests := []struct {
		input          string
		expectedFamily domain.EngineFamily
		expectedName   string
	}{
		{"C:\\Games\\Doom\\gzdoom.exe", domain.EngineFamilyGZDoom, "GZDoom"},
		{"/usr/bin/zandronum", domain.EngineFamilyZandronum, "Zandronum"},
		{"dsda-doom.exe", domain.EngineFamilyDSDADoom, "dsda-doom"},
		{"woof.exe", domain.EngineFamilyWoof, "Woof!"},
		{"crispy-doom.exe", domain.EngineFamilyCrispyDoom, "Crispy Doom"},
		{"chocolate-doom.exe", domain.EngineFamilyChocolateDoom, "Chocolate Doom"},
		{"prboom-plus.exe", domain.EngineFamilyPrBoomPlus, "PrBoom+"},
		{"lzdoom.exe", domain.EngineFamilyOther, "LZDoom"},
		{"my-custom-engine.exe", domain.EngineFamilyOther, "My Custom Engine"},
	}

	for _, tt := range tests {
		family, name := DetectEngineFamily(tt.input)
		if family != tt.expectedFamily {
			t.Errorf("DetectEngineFamily(%s): expected family %s, got %s", tt.input, tt.expectedFamily, family)
		}
		if name != tt.expectedName {
			t.Errorf("DetectEngineFamily(%s): expected name %s, got %s", tt.input, tt.expectedName, name)
		}
	}
}

func TestDetectIWADType(t *testing.T) {
	tests := []struct {
		input        string
		expectedType domain.IWADType
		expectedName string
	}{
		{"doom.wad", domain.IWADTypeDoom, "The Ultimate Doom"},
		{"DOOM2.WAD", domain.IWADTypeDoom2, "Doom II"},
		{"tnt.wad", domain.IWADTypeTNT, "Final Doom: TNT - Evilution"},
		{"plutonia.wad", domain.IWADTypePlutonia, "Final Doom: The Plutonia Experiment"},
		{"heretic.wad", domain.IWADTypeHeretic, "Heretic"},
		{"hexen.wad", domain.IWADTypeHexen, "Hexen"},
		{"strife1.wad", domain.IWADTypeStrife, "Strife"},
		{"freedoom1.wad", domain.IWADTypeFreedoom, "Freedoom: Phase 1"},
		{"freedoom2.wad", domain.IWADTypeFreedoom2, "Freedoom: Phase 2"},
		{"freedm.wad", domain.IWADTypeFreedoom, "FreeDM"},
		{"chex.wad", domain.IWADTypeOther, "Chex Quest"},
		{"hacx.wad", domain.IWADTypeOther, "HACX"},
		{"my_custom_game.wad", domain.IWADTypeOther, "My Custom Game"},
	}

	for _, tt := range tests {
		iwadType, name := DetectIWADType(tt.input)
		if iwadType != tt.expectedType {
			t.Errorf("DetectIWADType(%s): expected type %s, got %s", tt.input, tt.expectedType, iwadType)
		}
		if name != tt.expectedName {
			t.Errorf("DetectIWADType(%s): expected name %s, got %s", tt.input, tt.expectedName, name)
		}
	}
}

func TestScannerService_InvalidDirectories(t *testing.T) {
	svc, _ := setupTestScanner(t)

	result, err := svc.ScanDirectories(
		context.Background(),
		[]string{"/non/existent/mod/dir"},
		[]string{"/non/existent/iwad/dir"},
		[]string{"/non/existent/engine/dir"},
		nil,
	)

	if err != nil {
		t.Fatalf("ScanDirectories should not return fatal error on bad dirs: %v", err)
	}

	if len(result.Errors) != 3 {
		t.Errorf("expected 3 errors recorded in result, got %d: %v", len(result.Errors), result.Errors)
	}
}

func TestScannerService_ScanEngineDirectory_UpdateExisting(t *testing.T) {
	svc, repos := setupTestScanner(t)
	tempDir := t.TempDir()

	gzPath := filepath.Join(tempDir, "gzdoom.exe")
	_ = os.WriteFile(gzPath, []byte("fake gzdoom"), 0755)

	// First scan
	count1, err := svc.ScanEngineDirectory(context.Background(), tempDir)
	if err != nil || count1 != 1 {
		t.Fatalf("first scan failed: count=%d, err=%v", count1, err)
	}

	// Second scan (should update existing, not fail or create duplicate)
	count2, err := svc.ScanEngineDirectory(context.Background(), tempDir)
	if err != nil || count2 != 1 {
		t.Fatalf("second scan failed: count=%d, err=%v", count2, err)
	}

	engines, err := repos.Engines.List()
	if err != nil {
		t.Fatalf("Engines.List failed: %v", err)
	}
	if len(engines) != 1 {
		t.Fatalf("expected 1 engine in DB, got %d", len(engines))
	}
}

func TestScannerService_ScanAll_NilSettingsRepo(t *testing.T) {
	svc := NewScannerService(nil, nil, nil, nil)
	_, err := svc.ScanAll(context.Background(), nil)
	if err == nil {
		t.Errorf("expected error when settings repo is nil")
	}
}

func TestScannerService_ProbeEngineVersion_NonRunnable(t *testing.T) {
	tempDir := t.TempDir()
	dummyPath := filepath.Join(tempDir, "not_runnable.exe")
	_ = os.WriteFile(dummyPath, []byte("dummy binary"), 0755)

	ver := ProbeEngineVersion(context.Background(), dummyPath)
	if ver != "Unknown" {
		t.Errorf("expected Unknown version, got %s", ver)
	}
}

func TestScannerService_ImportFile_UpdateExisting(t *testing.T) {
	svc, repos := setupTestScanner(t)
	tempDir := t.TempDir()

	pwadData := buildTestWAD("PWAD", []string{"MAP01"})
	path := filepath.Join(tempDir, "dup_mod.wad")
	_ = os.WriteFile(path, pwadData, 0644)

	mod1, err := svc.ImportFile(context.Background(), path)
	if err != nil {
		t.Fatalf("first ImportFile failed: %v", err)
	}

	mod2, err := svc.ImportFile(context.Background(), path)
	if err != nil {
		t.Fatalf("second ImportFile failed: %v", err)
	}

	if mod1.ID != mod2.ID {
		t.Errorf("expected same ID on re-import, got %s and %s", mod1.ID, mod2.ID)
	}

	mods, err := repos.Mods.List(domain.ModFilter{})
	if err != nil || len(mods) != 1 {
		t.Fatalf("expected 1 mod in repository, got %d", len(mods))
	}
}
