package scanner_test

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/scanner"
)

func createSyntheticWAD(t testing.TB, path string, magic string, maps []string) {
	var buf bytes.Buffer
	buf.WriteString(magic)

	lumpCount := uint32(len(maps))
	_ = binary.Write(&buf, binary.LittleEndian, lumpCount)
	headerSize := uint32(12)
	dirOffset := headerSize + uint32(len(maps)*8)
	_ = binary.Write(&buf, binary.LittleEndian, dirOffset)

	for range maps {
		buf.WriteString("12345678")
	}

	offset := headerSize
	for _, m := range maps {
		_ = binary.Write(&buf, binary.LittleEndian, offset)
		_ = binary.Write(&buf, binary.LittleEndian, uint32(8))
		var nameBytes [8]byte
		copy(nameBytes[:], []byte(m))
		buf.Write(nameBytes[:])
		offset += 8
	}

	if err := os.WriteFile(path, buf.Bytes(), 0644); err != nil {
		t.Fatalf("failed to create synthetic wad: %v", err)
	}
}

func createSyntheticPK3(t testing.TB, path string) {
	file, err := os.Create(path)
	if err != nil {
		t.Fatalf("failed to create pk3: %v", err)
	}
	defer file.Close()

	w := zip.NewWriter(file)
	f, _ := w.Create("zscript.txt")
	_, _ = f.Write([]byte("version \"4.10\"; class MyMod : Actor {}"))
	_ = w.Close()
}

func BenchmarkScanner_Scan50Mods(b *testing.B) {
	tempDir := b.TempDir()
	modsDir := filepath.Join(tempDir, "mods")
	_ = os.MkdirAll(modsDir, 0755)

	// Create 50 synthetic mod files
	for i := 0; i < 25; i++ {
		p := filepath.Join(modsDir, fmt.Sprintf("wad_mod_%02d.wad", i))
		createSyntheticWAD(b, p, "PWAD", []string{fmt.Sprintf("MAP%02d", i+1)})
	}
	for i := 0; i < 25; i++ {
		p := filepath.Join(modsDir, fmt.Sprintf("pk3_mod_%02d.pk3", i))
		createSyntheticPK3(b, p)
	}

	dbPath := filepath.Join(tempDir, "bench_scan.db")
	db, err := database.InitDB(dbPath)
	if err != nil {
		b.Fatalf("failed to init db: %v", err)
	}
	defer db.Close()

	modRepo := database.NewModRepository(db)
	iwadRepo := database.NewIWADRepository(db)
	engineRepo := database.NewEngineRepository(db)
	settingsRepo := database.NewSettingsRepository(db)

	svc := scanner.NewScannerService(modRepo, iwadRepo, engineRepo, settingsRepo)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		res, err := svc.ScanModDirectory(ctx, modsDir, nil)
		if err != nil {
			b.Fatalf("scan failed: %v", err)
		}
		if res != 50 {
			b.Fatalf("expected 50 discovered mods, got %d", res)
		}
	}
}

func TestScanner_ScalePerformance50Mods(t *testing.T) {
	tempDir := t.TempDir()
	modsDir := filepath.Join(tempDir, "mods")
	_ = os.MkdirAll(modsDir, 0755)

	for i := 0; i < 25; i++ {
		p := filepath.Join(modsDir, fmt.Sprintf("perf_wad_%02d.wad", i))
		createSyntheticWAD(t, p, "PWAD", []string{fmt.Sprintf("MAP%02d", i+1)})
	}
	for i := 0; i < 25; i++ {
		p := filepath.Join(modsDir, fmt.Sprintf("perf_pk3_%02d.pk3", i))
		createSyntheticPK3(t, p)
	}

	dbPath := filepath.Join(tempDir, "test_scale_scan.db")
	db, err := database.InitDB(dbPath)
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}
	defer db.Close()

	modRepo := database.NewModRepository(db)
	iwadRepo := database.NewIWADRepository(db)
	engineRepo := database.NewEngineRepository(db)
	settingsRepo := database.NewSettingsRepository(db)

	svc := scanner.NewScannerService(modRepo, iwadRepo, engineRepo, settingsRepo)
	ctx := context.Background()

	start := time.Now()
	discovered, err := svc.ScanModDirectory(ctx, modsDir, nil)
	scanDuration := time.Since(start)

	if err != nil {
		t.Fatalf("scan error: %v", err)
	}
	if discovered != 50 {
		t.Fatalf("expected 50 discovered mods, got %d", discovered)
	}

	t.Logf("Scanned, inspected, and hashed 50 mods in %v (avg %v/mod)",
		scanDuration, scanDuration/50)

	// Verify all 50 items are in repository
	mods, err := modRepo.List(domain.ModFilter{})
	if err != nil || len(mods) != 50 {
		t.Fatalf("expected 50 mods in repository, got %d", len(mods))
	}
}
