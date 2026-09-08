package history

import (
	"context"
	"testing"
	"time"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
)

// stubHistoryRepo is an in-memory database.HistoryRepository for stats tests.
type stubHistoryRepo struct {
	records []domain.LaunchRecord
	listErr error
}

func (f *stubHistoryRepo) List(limit int) ([]domain.LaunchRecord, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	if limit > 0 && len(f.records) > limit {
		return f.records[:limit], nil
	}
	return f.records, nil
}

func (f *stubHistoryRepo) Add(record domain.LaunchRecord) error {
	f.records = append(f.records, record)
	return nil
}

func (f *stubHistoryRepo) Clear() error {
	f.records = nil
	return nil
}

func (f *stubHistoryRepo) GetStats() (domain.HistoryStats, error) {
	return domain.HistoryStats{TotalLaunches: len(f.records)}, nil
}

var _ database.HistoryRepository = (*stubHistoryRepo)(nil)

func TestProfileStats(t *testing.T) {
	base := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	rec := func(profileID, name string, offset time.Duration, dur time.Duration, exitCode int, status string) domain.LaunchRecord {
		start := base.Add(offset)
		return domain.LaunchRecord{
			ProfileID:   profileID,
			ProfileName: name,
			StartedAt:   start,
			FinishedAt:  start.Add(dur),
			DurationMs:  dur.Milliseconds(),
			ExitCode:    exitCode,
			Status:      status,
		}
	}

	tests := []struct {
		name    string
		records []domain.LaunchRecord
		want    map[string]domain.ProfileStats
		wantLen int
	}{
		{
			name: "mixed runs aggregate per profile",
			records: []domain.LaunchRecord{
				// Newest-first order, matching repository List.
				rec("p1", "Brutal", 3*time.Hour, 30*time.Minute, 1, domain.LaunchStatusFailed),
				rec("p1", "Brutal", 2*time.Hour, time.Hour, 0, domain.LaunchStatusSuccess),
				rec("p1", "Brutal", time.Hour, 30*time.Minute, 0, domain.LaunchStatusSuccess),
				rec("p2", "Sigil", 90*time.Minute, 15*time.Minute, 0, domain.LaunchStatusSuccess),
			},
			want: map[string]domain.ProfileStats{
				"p1": {ProfileID: "p1", ProfileName: "Brutal", Runs: 3, TotalHours: 2.0, CrashRate: 1.0 / 3.0},
				"p2": {ProfileID: "p2", ProfileName: "Sigil", Runs: 1, TotalHours: 0.25, CrashRate: 0},
			},
			wantLen: 2,
		},
		{
			name:    "empty history yields empty stats",
			records: nil,
			want:    map[string]domain.ProfileStats{},
			wantLen: 0,
		},
		{
			name: "nonzero exit with empty status counts as crash",
			records: []domain.LaunchRecord{
				rec("p9", "Crashy", time.Hour, 5*time.Minute, 3, ""),
			},
			want: map[string]domain.ProfileStats{
				"p9": {ProfileID: "p9", ProfileName: "Crashy", Runs: 1, TotalHours: 5.0 / 60.0, CrashRate: 1},
			},
			wantLen: 1,
		},
		{
			name: "records without profile id are skipped",
			records: []domain.LaunchRecord{
				rec("", "Orphan", time.Hour, 10*time.Minute, 0, domain.LaunchStatusSuccess),
				rec("p1", "Kept", time.Hour, 10*time.Minute, 0, domain.LaunchStatusSuccess),
			},
			want: map[string]domain.ProfileStats{
				"p1": {ProfileID: "p1", ProfileName: "Kept", Runs: 1, TotalHours: 10.0 / 60.0, CrashRate: 0},
			},
			wantLen: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := NewHistoryService(&stubHistoryRepo{records: tt.records})
			got, err := svc.ProfileStats(context.Background())
			if err != nil {
				t.Fatalf("ProfileStats failed: %v", err)
			}
			if len(got) != tt.wantLen {
				t.Fatalf("expected %d profiles, got %d (%+v)", tt.wantLen, len(got), got)
			}
			for _, ps := range got {
				w, ok := tt.want[ps.ProfileID]
				if !ok {
					t.Fatalf("unexpected profile %q in %+v", ps.ProfileID, got)
				}
				if ps.ProfileName != w.ProfileName || ps.Runs != w.Runs {
					t.Errorf("profile %q: got %+v, want name=%q runs=%d", ps.ProfileID, ps, w.ProfileName, w.Runs)
				}
				if ps.TotalHours != w.TotalHours {
					t.Errorf("profile %q: total hours got %v, want %v", ps.ProfileID, ps.TotalHours, w.TotalHours)
				}
				if ps.CrashRate != w.CrashRate {
					t.Errorf("profile %q: crash rate got %v, want %v", ps.ProfileID, ps.CrashRate, w.CrashRate)
				}
				if ps.LastPlayed == nil {
					t.Errorf("profile %q: expected non-nil last played", ps.ProfileID)
				}
			}
			// Results sort by runs descending.
			for i := 1; i < len(got); i++ {
				if got[i].Runs > got[i-1].Runs {
					t.Fatalf("stats not sorted by runs desc: %+v", got)
				}
			}
		})
	}
}

func TestProfileStats_LastPlayedIsNewest(t *testing.T) {
	base := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	svc := NewHistoryService(&stubHistoryRepo{records: []domain.LaunchRecord{
		{ProfileID: "p1", ProfileName: "P", StartedAt: base.Add(2 * time.Hour), DurationMs: 1000, Status: domain.LaunchStatusSuccess},
		{ProfileID: "p1", ProfileName: "P", StartedAt: base, DurationMs: 1000, Status: domain.LaunchStatusSuccess},
	}})
	got, err := svc.ProfileStats(context.Background())
	if err != nil {
		t.Fatalf("ProfileStats failed: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 profile, got %+v", got)
	}
	if got[0].LastPlayed == nil || !got[0].LastPlayed.Equal(base.Add(2*time.Hour)) {
		t.Fatalf("expected last played %v, got %+v", base.Add(2*time.Hour), got[0].LastPlayed)
	}
}

func TestGetStats_IncludesPerProfile(t *testing.T) {
	base := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	svc := NewHistoryService(&stubHistoryRepo{records: []domain.LaunchRecord{
		{ProfileID: "p1", ProfileName: "P", StartedAt: base, DurationMs: 60000, Status: domain.LaunchStatusSuccess},
	}})
	stats, err := svc.GetStats(context.Background())
	if err != nil {
		t.Fatalf("GetStats failed: %v", err)
	}
	if len(stats.PerProfile) != 1 || stats.PerProfile[0].ProfileID != "p1" {
		t.Fatalf("expected per-profile breakdown, got %+v", stats.PerProfile)
	}
}
