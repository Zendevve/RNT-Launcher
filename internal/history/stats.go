package history

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"rnt-launcher/internal/domain"
)

// maxProfileStatsRecords bounds how many history rows ProfileStats scans.
// List is newest-first, so a huge library still yields the most relevant
// per-profile aggregates.
const maxProfileStatsRecords = 100000

// profileAccum folds one profile's launch records into running totals.
type profileAccum struct {
	name       string
	runs       int
	failed     int
	totalMs    int64
	lastPlayed time.Time
}

// ProfileStats aggregates per-profile launch statistics: total runs, total
// hours, last-played time, and crash rate (failed runs / total runs, 0 when
// there are no runs). A launch counts as crashed when it did not succeed
// (nonzero exit or failed status). Results sort by runs descending, then
// profile ID ascending for stability. Records without a profile ID are
// skipped because they cannot be attributed.
func (s *HistoryService) ProfileStats(ctx context.Context) ([]domain.ProfileStats, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if s == nil || s.repo == nil {
		return nil, errors.New("history repository is not initialized")
	}
	records, err := s.repo.List(maxProfileStatsRecords)
	if err != nil {
		return nil, fmt.Errorf("failed to list launch history: %w", err)
	}
	byID := make(map[string]*profileAccum)
	for _, rec := range records {
		if rec.ProfileID == "" {
			continue
		}
		a, ok := byID[rec.ProfileID]
		if !ok {
			a = &profileAccum{}
			byID[rec.ProfileID] = a
		}
		// Records arrive newest-first, so the first non-empty name is the
		// most recent one.
		if a.name == "" {
			a.name = rec.ProfileName
		}
		a.runs++
		a.totalMs += rec.Duration().Milliseconds()
		if !rec.IsSuccess() {
			a.failed++
		}
		if rec.StartedAt.After(a.lastPlayed) {
			a.lastPlayed = rec.StartedAt
		}
	}
	out := make([]domain.ProfileStats, 0, len(byID))
	for id, a := range byID {
		var lastPlayed *time.Time
		if !a.lastPlayed.IsZero() {
			utc := a.lastPlayed.UTC()
			lastPlayed = &utc
		}
		var crashRate float64
		if a.runs > 0 {
			crashRate = float64(a.failed) / float64(a.runs)
		}
		out = append(out, domain.ProfileStats{
			ProfileID:   id,
			ProfileName: a.name,
			Runs:        a.runs,
			TotalHours:  float64(a.totalMs) / 3600000.0,
			LastPlayed:  lastPlayed,
			CrashRate:   crashRate,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Runs != out[j].Runs {
			return out[i].Runs > out[j].Runs
		}
		return out[i].ProfileID < out[j].ProfileID
	})
	return out, nil
}
