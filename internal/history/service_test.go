package history_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/history"
)

func setupTestService(t *testing.T) (*history.HistoryService, database.HistoryRepository) {
	t.Helper()
	db, err := database.InitDB(":memory:")
	if err != nil {
		t.Fatalf("database.InitDB failed: %v", err)
	}
	t.Cleanup(func() {
		db.Close()
	})

	repo := database.NewHistoryRepository(db)
	svc := history.NewHistoryService(repo)
	return svc, repo
}

func TestHistoryService_Constructors(t *testing.T) {
	db, err := database.InitDB(":memory:")
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	repo := database.NewHistoryRepository(db)
	svc1 := history.New(repo)
	if svc1 == nil {
		t.Fatal("history.New returned nil")
	}

	svc2 := history.NewHistoryService(repo)
	if svc2 == nil {
		t.Fatal("history.NewHistoryService returned nil")
	}
}

func TestHistoryService_List_DefaultLimitAndOrder(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	// Initial list should be empty non-nil slice
	initial, err := svc.List(ctx, 0)
	if err != nil {
		t.Fatalf("List(0) on empty DB failed: %v", err)
	}
	if initial == nil || len(initial) != 0 {
		t.Fatalf("expected empty non-nil slice, got: %+v", initial)
	}

	baseTime := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

	// Insert 60 records
	for i := 1; i <= 60; i++ {
		startTime := baseTime.Add(time.Duration(i) * time.Minute)
		rec := domain.LaunchRecord{
			ID:          "",
			ProfileID:   "prof-1",
			ProfileName: "Classic Doom",
			EngineName:  "GZDoom",
			IWADName:    "DOOM2",
			StartedAt:   startTime,
			FinishedAt:  startTime.Add(5 * time.Minute),
			DurationMs:  300000,
			ExitCode:    0,
			Status:      domain.LaunchStatusSuccess,
			CommandLine: "gzdoom.exe -iwad doom2.wad",
		}
		if err := svc.Add(ctx, rec); err != nil {
			t.Fatalf("Add record %d failed: %v", i, err)
		}
	}

	// List with 0 should use default limit of 50
	records50, err := svc.List(ctx, 0)
	if err != nil {
		t.Fatalf("List(0) failed: %v", err)
	}
	if len(records50) != history.DefaultHistoryLimit {
		t.Fatalf("expected %d records for default limit, got %d", history.DefaultHistoryLimit, len(records50))
	}

	// Verify ordering: newest first (record 60 was inserted with latest started_at)
	lastTime := time.Date(2099, 1, 1, 0, 0, 0, 0, time.UTC)
	for _, rec := range records50 {
		if rec.StartedAt.After(lastTime) {
			t.Errorf("records not ordered descending by StartedAt: %v after %v", rec.StartedAt, lastTime)
		}
		lastTime = rec.StartedAt
	}

	// List with negative limit should also use default limit of 50
	recordsNeg, err := svc.List(ctx, -10)
	if err != nil {
		t.Fatalf("List(-10) failed: %v", err)
	}
	if len(recordsNeg) != history.DefaultHistoryLimit {
		t.Fatalf("expected %d records for negative limit, got %d", history.DefaultHistoryLimit, len(recordsNeg))
	}

	// List with specific smaller limit
	records10, err := svc.List(ctx, 10)
	if err != nil {
		t.Fatalf("List(10) failed: %v", err)
	}
	if len(records10) != 10 {
		t.Fatalf("expected 10 records, got %d", len(records10))
	}

	// List with large limit returns all 60 records
	recordsAll, err := svc.List(ctx, 100)
	if err != nil {
		t.Fatalf("List(100) failed: %v", err)
	}
	if len(recordsAll) != 60 {
		t.Fatalf("expected 60 records, got %d", len(recordsAll))
	}
}

func TestHistoryService_Clear(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	// Insert test records
	rec := domain.LaunchRecord{
		ProfileName: "Sigil Run",
		EngineName:  "Crispy Doom",
		IWADName:    "DOOM",
		StartedAt:   time.Now().UTC(),
		DurationMs:  120000,
		Status:      domain.LaunchStatusSuccess,
	}
	if err := svc.Add(ctx, rec); err != nil {
		t.Fatalf("Add failed: %v", err)
	}

	// Confirm records exist
	list, err := svc.List(ctx, 50)
	if err != nil || len(list) != 1 {
		t.Fatalf("expected 1 record before clear, got: len=%d, err=%v", len(list), err)
	}

	// Clear history
	if err := svc.Clear(ctx); err != nil {
		t.Fatalf("Clear() failed: %v", err)
	}

	// Verify empty list
	afterClear, err := svc.List(ctx, 50)
	if err != nil {
		t.Fatalf("List() after clear failed: %v", err)
	}
	if len(afterClear) != 0 {
		t.Fatalf("expected 0 records after clear, got %d", len(afterClear))
	}

	// Verify stats reset
	stats, err := svc.GetStats(ctx)
	if err != nil {
		t.Fatalf("GetStats() after clear failed: %v", err)
	}
	if stats.TotalLaunches != 0 || stats.TotalPlayTimeMs != 0 || stats.LastLaunchedAt != nil {
		t.Errorf("unexpected stats after clear: %+v", stats)
	}
}

func TestHistoryService_GetStats_Calculation(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx := context.Background()

	// Empty DB stats
	emptyStats, err := svc.GetStats(ctx)
	if err != nil {
		t.Fatalf("GetStats() on empty DB failed: %v", err)
	}
	if emptyStats.TotalLaunches != 0 || emptyStats.TotalPlayTimeMs != 0 || emptyStats.LastLaunchedAt != nil {
		t.Errorf("unexpected empty stats: %+v", emptyStats)
	}

	t1 := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)
	t3 := time.Date(2026, 3, 1, 14, 0, 0, 0, time.UTC)

	// Add 2 launches for profile 1 ("Doom 2 Brutal")
	_ = svc.Add(ctx, domain.LaunchRecord{
		ProfileID:   "p1",
		ProfileName: "Doom 2 Brutal",
		EngineName:  "GZDoom",
		IWADName:    "DOOM2",
		StartedAt:   t1,
		FinishedAt:  t1.Add(15 * time.Minute),
		DurationMs:  900000, // 15 mins
		ExitCode:    0,
		Status:      domain.LaunchStatusSuccess,
	})

	_ = svc.Add(ctx, domain.LaunchRecord{
		ProfileID:   "p1",
		ProfileName: "Doom 2 Brutal",
		EngineName:  "GZDoom",
		IWADName:    "DOOM2",
		StartedAt:   t2,
		FinishedAt:  t2.Add(30 * time.Minute),
		DurationMs:  1800000, // 30 mins
		ExitCode:    0,
		Status:      domain.LaunchStatusSuccess,
	})

	// Add 1 launch for profile 2 ("Sigil")
	_ = svc.Add(ctx, domain.LaunchRecord{
		ProfileID:   "p2",
		ProfileName: "Sigil",
		EngineName:  "Crispy Doom",
		IWADName:    "DOOM",
		StartedAt:   t3,
		FinishedAt:  t3.Add(5 * time.Minute),
		DurationMs:  300000, // 5 mins
		ExitCode:    1,
		Status:      domain.LaunchStatusFailed,
	})

	stats, err := svc.GetStats(ctx)
	if err != nil {
		t.Fatalf("GetStats() failed: %v", err)
	}

	if stats.TotalLaunches != 3 {
		t.Errorf("expected 3 total launches, got %d", stats.TotalLaunches)
	}

	expectedPlayTime := int64(900000 + 1800000 + 300000)
	if stats.TotalPlayTimeMs != expectedPlayTime {
		t.Errorf("expected %d total playtime ms, got %d", expectedPlayTime, stats.TotalPlayTimeMs)
	}

	if stats.MostPlayedProfileID != "p1" {
		t.Errorf("expected most played profile 'p1', got %q", stats.MostPlayedProfileID)
	}
	if stats.MostPlayedProfileName != "Doom 2 Brutal" {
		t.Errorf("expected most played profile name 'Doom 2 Brutal', got %q", stats.MostPlayedProfileName)
	}

	if stats.LastLaunchedAt == nil {
		t.Fatal("expected LastLaunchedAt to be populated")
	}
	if !stats.LastLaunchedAt.Equal(t3) {
		t.Errorf("expected LastLaunchedAt %v, got %v", t3, *stats.LastLaunchedAt)
	}
}

func TestHistoryService_ContextCancelled(t *testing.T) {
	svc, _ := setupTestService(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	if _, err := svc.List(ctx, 10); err == nil {
		t.Error("expected error for List with cancelled context")
	}

	if err := svc.Clear(ctx); err == nil {
		t.Error("expected error for Clear with cancelled context")
	}

	if _, err := svc.GetStats(ctx); err == nil {
		t.Error("expected error for GetStats with cancelled context")
	}

	if err := svc.Add(ctx, domain.LaunchRecord{}); err == nil {
		t.Error("expected error for Add with cancelled context")
	}
}

func TestHistoryService_NilSafety(t *testing.T) {
	var nilSvc *history.HistoryService
	ctx := context.Background()

	if _, err := nilSvc.List(ctx, 10); err == nil {
		t.Error("expected error on nil service List")
	}

	if err := nilSvc.Clear(ctx); err == nil {
		t.Error("expected error on nil service Clear")
	}

	if _, err := nilSvc.GetStats(ctx); err == nil {
		t.Error("expected error on nil service GetStats")
	}

	if err := nilSvc.Add(ctx, domain.LaunchRecord{}); err == nil {
		t.Error("expected error on nil service Add")
	}

	emptySvc := &history.HistoryService{}
	if _, err := emptySvc.List(ctx, 10); err == nil {
		t.Error("expected error on uninitialized repo List")
	}
	if err := emptySvc.Clear(ctx); err == nil {
		t.Error("expected error on uninitialized repo Clear")
	}
	if _, err := emptySvc.GetStats(ctx); err == nil {
		t.Error("expected error on uninitialized repo GetStats")
	}
	if err := emptySvc.Add(ctx, domain.LaunchRecord{}); err == nil {
		t.Error("expected error on uninitialized repo Add")
	}
}

type failingHistoryRepo struct{}

func (f *failingHistoryRepo) List(limit int) ([]domain.LaunchRecord, error) {
	return nil, errors.New("database list failure")
}
func (f *failingHistoryRepo) Add(record domain.LaunchRecord) error {
	return errors.New("database add failure")
}
func (f *failingHistoryRepo) Clear() error {
	return errors.New("database clear failure")
}
func (f *failingHistoryRepo) GetStats() (domain.HistoryStats, error) {
	return domain.HistoryStats{}, errors.New("database stats failure")
}

func TestHistoryService_RepoErrors(t *testing.T) {
	failRepo := &failingHistoryRepo{}
	svc := history.NewHistoryService(failRepo)
	ctx := context.Background()

	if _, err := svc.List(ctx, 10); err == nil {
		t.Error("expected error on List with failing repo")
	}
	if err := svc.Clear(ctx); err == nil {
		t.Error("expected error on Clear with failing repo")
	}
	if _, err := svc.GetStats(ctx); err == nil {
		t.Error("expected error on GetStats with failing repo")
	}
	if err := svc.Add(ctx, domain.LaunchRecord{}); err == nil {
		t.Error("expected error on Add with failing repo")
	}
}
