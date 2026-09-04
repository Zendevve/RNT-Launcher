package idgames_test

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/binary"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/idgames"
)

// buildSyntheticPWAD generates a minimal valid Doom PWAD with specified map names.
func buildSyntheticPWAD(mapName string) []byte {
	var buf bytes.Buffer
	buf.WriteString("PWAD")

	// 2 lumps: map marker lump and an empty lump
	numLumps := int32(2)
	_ = binary.Write(&buf, binary.LittleEndian, numLumps)

	// Directory offset will be after the 12-byte header
	dirOffset := int32(12)
	_ = binary.Write(&buf, binary.LittleEndian, dirOffset)

	// Lump directory entries: 16 bytes each (offset: int32, size: int32, name: [8]byte)
	// Lump 1: map marker (size 0, offset 12)
	_ = binary.Write(&buf, binary.LittleEndian, int32(12))
	_ = binary.Write(&buf, binary.LittleEndian, int32(0))
	var name1 [8]byte
	copy(name1[:], mapName)
	buf.Write(name1[:])

	// Lump 2: THINGS (size 0, offset 12)
	_ = binary.Write(&buf, binary.LittleEndian, int32(12))
	_ = binary.Write(&buf, binary.LittleEndian, int32(0))
	var name2 [8]byte
	copy(name2[:], "THINGS")
	buf.Write(name2[:])

	return buf.Bytes()
}

// buildSyntheticZip creates an in-memory zip archive containing a primary WAD file and a text readme.
func buildSyntheticZip(archiveWadName, mapName string) []byte {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	// Add readme.txt
	txtWriter, _ := zw.Create("readme.txt")
	_, _ = txtWriter.Write([]byte("Classic Doom community test mod"))

	// Add primary wad
	wadWriter, _ := zw.Create(archiveWadName)
	_, _ = wadWriter.Write(buildSyntheticPWAD(mapName))

	_ = zw.Close()
	return buf.Bytes()
}

type mockRegistrar struct {
	mu       sync.Mutex
	imported map[string]*domain.Mod
}

func (m *mockRegistrar) ImportFile(ctx context.Context, filePath string) (*domain.Mod, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	clean := filepath.Clean(filePath)
	mod := &domain.Mod{
		ID:       "mod-imported-test",
		Name:     filepath.Base(clean),
		Path:     clean,
		Format:   "PWAD",
		Category: "Megawad",
	}
	m.imported[clean] = mod
	return mod, nil
}

func TestDownloader_FailoverAndIngest(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tempDir := t.TempDir()

	// 1. Mirror 1: Fails with HTTP 500
	server1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server1.Close()

	// 2. Mirror 2: Fails with HTTP 404
	server2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server2.Close()

	// 3. Mirror 3: Succeeds and serves the zip payload
	zipBytes := buildSyntheticZip("testmod.wad", "MAP01")
	server3 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/zip")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(zipBytes)
	}))
	defer server3.Close()

	mirrors := []string{
		server1.URL + "/",
		server2.URL + "/",
		server3.URL + "/",
	}

	downloader := idgames.NewDownloader(
		idgames.WithDownloaderMirrors(mirrors),
		idgames.WithMirrorTimeout(2*time.Second),
	)

	var (
		progressEvents []idgames.DownloadProgress
		progressMu     sync.Mutex
	)

	recordProgress := func(p idgames.DownloadProgress) {
		progressMu.Lock()
		defer progressMu.Unlock()
		progressEvents = append(progressEvents, p)
	}

	testItem := idgames.CatalogItem{
		ID:       99999,
		Title:    "Test Synthetic Mod",
		Dir:      "levels/doom2/Ports/megawads",
		Filename: "testmod.zip",
		Size:     int64(len(zipBytes)),
	}

	registrar := &mockRegistrar{imported: make(map[string]*domain.Mod)}

	// Execute full download and ingest cycle
	mod, err := downloader.DownloadAndIngest(ctx, testItem, tempDir, registrar, recordProgress)
	if err != nil {
		t.Fatalf("DownloadAndIngest failed: %v", err)
	}
	if mod == nil {
		t.Fatalf("expected non-nil imported mod")
	}

	// Verify destination folder structure: <tempDir>/idgames/testmod/
	expectedDir := filepath.Join(tempDir, "idgames", "testmod")
	if _, err := os.Stat(expectedDir); err != nil {
		t.Fatalf("expected target extraction directory to exist at %s", expectedDir)
	}

	// Verify primary extracted file is testmod.wad
	expectedFile := filepath.Join(expectedDir, "testmod.wad")
	if mod.Path != expectedFile {
		t.Errorf("expected mod.Path to be %s, got %s", expectedFile, mod.Path)
	}

	// Verify binary lump inspection works on primary file
	info, err := idgames.InspectModFile(mod.Path)
	if err != nil {
		t.Fatalf("InspectModFile failed: %v", err)
	}
	if info.Format != "PWAD" {
		t.Errorf("expected format PWAD, got %s", info.Format)
	}
	if len(info.Maps) == 0 || info.Maps[0] != "MAP01" {
		t.Errorf("expected map MAP01, got %v", info.Maps)
	}

	// Verify progress events recorded connecting, downloading, extracting, inspecting, completed
	progressMu.Lock()
	defer progressMu.Unlock()

	hasConnecting := false
	hasDownloading := false
	hasExtracting := false
	hasInspecting := false
	hasCompleted := false

	for _, ev := range progressEvents {
		switch ev.Status {
		case "connecting":
			hasConnecting = true
		case "downloading":
			hasDownloading = true
		case "extracting":
			hasExtracting = true
		case "inspecting":
			hasInspecting = true
		case "completed":
			hasCompleted = true
		}
	}

	if !hasConnecting || !hasDownloading || !hasExtracting || !hasInspecting || !hasCompleted {
		t.Errorf("missing expected lifecycle states in progress events: %+v", progressEvents)
	}
}

func TestDownloader_AllMirrorsFail(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tempDir := t.TempDir()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	downloader := idgames.NewDownloader(
		idgames.WithDownloaderMirrors([]string{server.URL}),
		idgames.WithMirrorTimeout(1*time.Second),
	)

	var lastStatus string
	progress := func(p idgames.DownloadProgress) {
		lastStatus = p.Status
	}

	item := idgames.CatalogItem{
		ID:       1234,
		Title:    "Ghost Mod",
		Dir:      "levels",
		Filename: "ghost.zip",
	}

	_, err := downloader.Download(ctx, item, tempDir, progress)
	if err == nil {
		t.Fatalf("expected download error when all mirrors fail")
	}
	if lastStatus != "failed" {
		t.Errorf("expected final progress status to be 'failed', got '%s'", lastStatus)
	}
}
