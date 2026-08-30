package idgames

import (
	"archive/zip"
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Helper to create a valid in-memory zip archive with given files and contents
func createTestZip(files map[string][]byte) ([]byte, error) {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			return nil, err
		}
		if _, err := w.Write(content); err != nil {
			return nil, err
		}
	}

	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func TestSearch_Success_MultipleFiles(t *testing.T) {
	mockResponse := `{
		"content": {
			"file": [
				{
					"id": 19485,
					"title": "Eviternity",
					"dir": "levels/doom2/Ports/megawads/",
					"filename": "eviternity.zip",
					"size": 75234120,
					"age": 1544400000,
					"date": "2018-12-10",
					"author": "Dragonfly et al.",
					"description": "Eviternity is a 32-level megawad designed for MBF-compatible source ports.",
					"rating": 4.85,
					"votes": 142,
					"url": "https://www.doomworld.com/idgames/levels/doom2/Ports/megawads/eviternity"
				},
				{
					"id": 12345,
					"title": "Scythe",
					"dir": "levels/doom2/megawads/",
					"filename": "scythe.zip",
					"size": 4512300,
					"age": 1054400000,
					"date": "2003-05-01",
					"author": "Erik Alm",
					"description": "A 32-level fast-paced megawad.",
					"rating": 4.70,
					"votes": 98,
					"url": ""
				}
			]
		}
	}`

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("action") != "search" {
			t.Errorf("expected action=search, got %s", r.URL.Query().Get("action"))
		}
		if r.URL.Query().Get("query") != "eviternity" {
			t.Errorf("expected query=eviternity, got %s", r.URL.Query().Get("query"))
		}
		if r.URL.Query().Get("out") != "json" {
			t.Errorf("expected out=json, got %s", r.URL.Query().Get("out"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(mockResponse))
	}))
	defer ts.Close()

	client := NewClient(
		WithBaseURL(ts.URL),
		WithHTTPClient(ts.Client()),
	)

	files, err := client.Search(context.Background(), "eviternity")
	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}

	if len(files) != 2 {
		t.Fatalf("expected 2 files, got %d", len(files))
	}

	f1 := files[0]
	if f1.ID != 19485 || f1.Title != "Eviternity" || f1.Filename != "eviternity.zip" {
		t.Errorf("unexpected file 0: %+v", f1)
	}
	if f1.Rating != 4.85 || f1.Votes != 142 || f1.Size != 75234120 {
		t.Errorf("unexpected numeric fields for file 0: %+v", f1)
	}
	if f1.URL != "https://www.doomworld.com/idgames/levels/doom2/Ports/megawads/eviternity" {
		t.Errorf("unexpected URL for file 0: %s", f1.URL)
	}

	f2 := files[1]
	if f2.ID != 12345 || f2.Title != "Scythe" || f2.Filename != "scythe.zip" {
		t.Errorf("unexpected file 1: %+v", f2)
	}
	// Verify auto-generated URL when empty
	if !strings.Contains(f2.URL, "doomworld.com/idgames/levels/doom2/megawads/scythe") {
		t.Errorf("expected auto-generated URL for file 1, got %s", f2.URL)
	}
}

func TestSearch_Success_SingleFile(t *testing.T) {
	mockResponse := `{
		"content": {
			"file": {
				"id": "18000",
				"title": "Ancient Aliens",
				"dir": "levels/doom2/Ports/megawads/",
				"filename": "aaliens.zip",
				"size": "95000000",
				"age": "1460000000",
				"date": "2016-04-10",
				"author": "skillsaw et al.",
				"description": "Ancient Aliens is a 32-level set.",
				"rating": "4.92",
				"votes": "210",
				"url": "https://www.doomworld.com/idgames/levels/doom2/Ports/megawads/aaliens"
			}
		}
	}`

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(mockResponse))
	}))
	defer ts.Close()

	client := NewClient(
		WithBaseURL(ts.URL),
		WithHTTPClient(ts.Client()),
	)

	files, err := client.Search(context.Background(), "aaliens")
	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}

	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}

	f := files[0]
	if f.ID != 18000 || f.Title != "Ancient Aliens" || f.Filename != "aaliens.zip" {
		t.Errorf("unexpected file: %+v", f)
	}
	if f.Size != 95000000 || f.Rating != 4.92 || f.Votes != 210 {
		t.Errorf("unexpected string-parsed numeric fields: %+v", f)
	}
}

func TestSearch_NoResults(t *testing.T) {
	t.Run("Content error: No files found", func(t *testing.T) {
		mockResponse := `{
			"content": {
				"error": {
					"type": "No files found",
					"message": "No files found matching query."
				}
			}
		}`
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(mockResponse))
		}))
		defer ts.Close()

		client := NewClient(WithBaseURL(ts.URL), WithHTTPClient(ts.Client()))
		files, err := client.Search(context.Background(), "nonexistentxyz123")
		if err != nil {
			t.Fatalf("expected nil error for empty search, got: %v", err)
		}
		if len(files) != 0 {
			t.Errorf("expected 0 files, got %d", len(files))
		}
	})

	t.Run("Top level error: No files found", func(t *testing.T) {
		mockResponse := `{
			"error": {
				"type": "Not found",
				"message": "No results found"
			}
		}`
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(mockResponse))
		}))
		defer ts.Close()

		client := NewClient(WithBaseURL(ts.URL), WithHTTPClient(ts.Client()))
		files, err := client.Search(context.Background(), "emptyquery")
		if err != nil {
			t.Fatalf("expected nil error, got: %v", err)
		}
		if len(files) != 0 {
			t.Errorf("expected 0 files, got %d", len(files))
		}
	})

	t.Run("Empty content", func(t *testing.T) {
		mockResponse := `{"content": {}}`
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(mockResponse))
		}))
		defer ts.Close()

		client := NewClient(WithBaseURL(ts.URL), WithHTTPClient(ts.Client()))
		files, err := client.Search(context.Background(), "empty")
		if err != nil {
			t.Fatalf("expected nil error, got: %v", err)
		}
		if len(files) != 0 {
			t.Errorf("expected 0 files, got %d", len(files))
		}
	})
}

func TestSearch_APIError(t *testing.T) {
	t.Run("HTTP 500", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}))
		defer ts.Close()

		client := NewClient(WithBaseURL(ts.URL), WithHTTPClient(ts.Client()))
		_, err := client.Search(context.Background(), "test")
		if err == nil {
			t.Fatalf("expected error for HTTP 500, got nil")
		}
	})

	t.Run("Fatal API Error Response", func(t *testing.T) {
		mockResponse := `{
			"error": {
				"type": "DatabaseError",
				"message": "Database query timeout"
			}
		}`
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(mockResponse))
		}))
		defer ts.Close()

		client := NewClient(WithBaseURL(ts.URL), WithHTTPClient(ts.Client()))
		_, err := client.Search(context.Background(), "test")
		if err == nil {
			t.Fatalf("expected error for API database error, got nil")
		}
		if !strings.Contains(err.Error(), "Database query timeout") {
			t.Errorf("expected error message to contain details, got: %v", err)
		}
	})
}

func TestSearch_EmptyQuery(t *testing.T) {
	client := NewClient()
	files, err := client.Search(context.Background(), "   ")
	if err != nil {
		t.Fatalf("expected nil error for empty string query, got %v", err)
	}
	if len(files) != 0 {
		t.Errorf("expected 0 files, got %d", len(files))
	}
}

func TestSearch_ContextCanceled(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	client := NewClient(WithBaseURL(ts.URL), WithHTTPClient(ts.Client()))

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := client.Search(ctx, "fastcancel")
	if err == nil {
		t.Fatalf("expected context error, got nil")
	}
}

func TestSearch_MalformedJSON(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{not valid json`))
	}))
	defer ts.Close()

	client := NewClient(WithBaseURL(ts.URL), WithHTTPClient(ts.Client()))
	_, err := client.Search(context.Background(), "badjson")
	if err == nil {
		t.Fatalf("expected JSON parse error, got nil")
	}
}

func TestDownload_Success_ExtractsPrimaryWad(t *testing.T) {
	// Create zip bytes with "eviternity.wad" and "eviternity.txt"
	wadData := []byte("PWAD\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00")
	txtData := []byte("Eviternity readme file\nAuthor: Dragonfly\n")

	zipBytes, err := createTestZip(map[string][]byte{
		"eviternity.wad": wadData,
		"eviternity.txt": txtData,
	})
	if err != nil {
		t.Fatalf("failed creating test zip: %v", err)
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(zipBytes)
	}))
	defer ts.Close()

	client := NewClient(
		WithMirrors([]string{ts.URL}),
		WithHTTPClient(ts.Client()),
	)

	tempDest := t.TempDir()
	targetFile := IdgamesFile{
		ID:       19485,
		Title:    "Eviternity",
		Dir:      "levels/doom2/Ports/megawads/",
		Filename: "eviternity.zip",
	}

	extractedPath, err := client.Download(context.Background(), targetFile, tempDest)
	if err != nil {
		t.Fatalf("Download failed: %v", err)
	}

	// Verify extracted primary file is eviternity.wad
	expectedWadPath := filepath.Join(tempDest, "eviternity.wad")
	if filepath.Clean(extractedPath) != filepath.Clean(expectedWadPath) {
		t.Errorf("expected extracted primary path %s, got %s", expectedWadPath, extractedPath)
	}

	// Verify files actually exist on disk
	if _, err := os.Stat(expectedWadPath); err != nil {
		t.Errorf("extracted WAD file does not exist on disk: %v", err)
	}
	expectedTxtPath := filepath.Join(tempDest, "eviternity.txt")
	if _, err := os.Stat(expectedTxtPath); err != nil {
		t.Errorf("extracted TXT file does not exist on disk: %v", err)
	}
}

func TestDownload_MirrorFallback(t *testing.T) {
	wadData := []byte("PWAD\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00")
	zipBytes, err := createTestZip(map[string][]byte{
		"fallback.wad": wadData,
	})
	if err != nil {
		t.Fatalf("failed creating zip: %v", err)
	}

	// Server 1 always returns 404
	ts1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer ts1.Close()

	// Server 2 returns 200 with zip
	ts2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(zipBytes)
	}))
	defer ts2.Close()

	client := NewClient(
		WithMirrors([]string{ts1.URL, ts2.URL}),
		WithHTTPClient(http.DefaultClient),
	)

	tempDest := t.TempDir()
	targetFile := IdgamesFile{
		Filename: "fallback.zip",
		Dir:      "levels/doom2/",
	}

	path, err := client.Download(context.Background(), targetFile, tempDest)
	if err != nil {
		t.Fatalf("expected fallback to succeed, got: %v", err)
	}

	expectedPath := filepath.Join(tempDest, "fallback.wad")
	if filepath.Clean(path) != filepath.Clean(expectedPath) {
		t.Errorf("expected path %s, got %s", expectedPath, path)
	}
}

func TestDownload_AllMirrorsFail(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "server error", http.StatusInternalServerError)
	}))
	defer ts.Close()

	client := NewClient(
		WithMirrors([]string{ts.URL}),
		WithHTTPClient(ts.Client()),
	)

	tempDest := t.TempDir()
	targetFile := IdgamesFile{
		Filename: "broken.zip",
	}

	_, err := client.Download(context.Background(), targetFile, tempDest)
	if err == nil {
		t.Fatalf("expected error when all mirrors fail, got nil")
	}
}

func TestDownload_ZipSlipProtection(t *testing.T) {
	// Create malicious zip containing path traversal entry
	zipBytes, err := createTestZip(map[string][]byte{
		"../../outside.txt": []byte("should not be written"),
	})
	if err != nil {
		t.Fatalf("failed creating test zip: %v", err)
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(zipBytes)
	}))
	defer ts.Close()

	client := NewClient(
		WithMirrors([]string{ts.URL}),
		WithHTTPClient(ts.Client()),
	)

	tempDest := t.TempDir()
	targetFile := IdgamesFile{
		Filename: "malicious.zip",
	}

	_, err = client.Download(context.Background(), targetFile, tempDest)
	if err == nil {
		t.Fatalf("expected error on zip slip entry, got nil")
	}
	if !strings.Contains(err.Error(), "illegal entry path") {
		t.Errorf("expected illegal entry path error, got: %v", err)
	}
}

func TestDownload_CorruptedArchive(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write([]byte("not a real zip file"))
	}))
	defer ts.Close()

	client := NewClient(
		WithMirrors([]string{ts.URL}),
		WithHTTPClient(ts.Client()),
	)

	tempDest := t.TempDir()
	targetFile := IdgamesFile{
		Filename: "corrupt.zip",
	}

	_, err := client.Download(context.Background(), targetFile, tempDest)
	if err == nil {
		t.Fatalf("expected error on corrupt zip, got nil")
	}
}

func TestDownload_EmptyFilename(t *testing.T) {
	client := NewClient()
	_, err := client.Download(context.Background(), IdgamesFile{Filename: ""}, t.TempDir())
	if err == nil {
		t.Fatalf("expected error on empty filename, got nil")
	}
}

func TestSelectPrimaryModFile(t *testing.T) {
	t.Run("Matches stem name", func(t *testing.T) {
		paths := []string{
			"/mods/other.wad",
			"/mods/scythe.wad",
			"/mods/scythe.txt",
		}
		res := selectPrimaryModFile(paths, "scythe.zip", "/mods/scythe.zip")
		if res != "/mods/scythe.wad" {
			t.Errorf("expected /mods/scythe.wad, got %s", res)
		}
	})

	t.Run("Selects dehacked when no wad", func(t *testing.T) {
		paths := []string{
			"/mods/patch.deh",
			"/mods/readme.txt",
		}
		res := selectPrimaryModFile(paths, "patch.zip", "/mods/patch.zip")
		if res != "/mods/patch.deh" {
			t.Errorf("expected /mods/patch.deh, got %s", res)
		}
	})

	t.Run("Falls back to zipPath when empty", func(t *testing.T) {
		res := selectPrimaryModFile(nil, "unknown.zip", "/mods/unknown.zip")
		if res != "/mods/unknown.zip" {
			t.Errorf("expected /mods/unknown.zip, got %s", res)
		}
	})
}
