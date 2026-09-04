package main

import (
	"context"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"rnt-launcher/internal/idgames"
)

// Captured event for later download-progress assertions.
type idgamesTestEvent struct {
	name string
	data any
}

func TestApp_IdgamesFlow(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "idgames-flow.db")

	var mu sync.Mutex
	events := make([]idgamesTestEvent, 0)
	app := NewApp()
	app.SetDBPath(dbPath)
	app.SetEventEmitter(func(eventName string, data any) {
		mu.Lock()
		events = append(events, idgamesTestEvent{name: eventName, data: data})
		mu.Unlock()
	})
	app.startup(context.Background())
	defer app.Close()

	if app.db == nil {
		t.Fatal("expected app.db to be initialized after startup")
	}

	// Wait/poll up to 5s for background seed to populate the catalog (Count > 0).
	repo := idgames.NewCatalogRepository(app.db)
	seeded := false
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		n, err := repo.Count(context.Background())
		if err == nil && n > 0 {
			seeded = true
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if !seeded {
		n, err := repo.Count(context.Background())
		t.Fatalf("expected seeded idgames catalog Count>0 within 5s, got count=%d err=%v", n, err)
	}

	// Search for a known seed title; Eviternity (id 19342) must be the top hit.
	results, err := app.SearchIdgamesCatalog(idgames.SearchOptions{Query: "Eviternity", Limit: 10})
	if err != nil {
		t.Fatalf("SearchIdgamesCatalog failed: %v", err)
	}
	if len(results) == 0 {
		t.Fatal("SearchIdgamesCatalog(Eviternity) returned 0 results, expected at least 1")
	}
	if top := results[0]; !strings.Contains(strings.ToLower(top.Title), "eviternity") {
		t.Fatalf("expected top hit title to contain Eviternity, got %q (id=%d)", top.Title, top.ID)
	}

	// Curated showcase must serve offline seed data without network.
	showcase, err := app.GetIdgamesCuratedShowcase()
	if err != nil {
		t.Fatalf("GetIdgamesCuratedShowcase failed: %v", err)
	}
	if len(showcase.CacowardClassics) == 0 {
		t.Fatal("expected non-empty CacowardClassics in showcase")
	}
	if len(showcase.Top100) == 0 {
		t.Fatal("expected non-empty Top100 in showcase")
	}

	// Retain captured events for later download-progress assertions.
	// Download itself is intentionally skipped here to keep this test offline-safe.
	mu.Lock()
	_ = append([]idgamesTestEvent(nil), events...)
	mu.Unlock()
}
