package history

import (
	"context"
	"errors"
	"fmt"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
)

// DefaultHistoryLimit is the default maximum number of launch records returned when limit <= 0.
const DefaultHistoryLimit = 50

// HistoryStats is an alias for domain.HistoryStats.
type HistoryStats = domain.HistoryStats

// LaunchRecord is an alias for domain.LaunchRecord.
type LaunchRecord = domain.LaunchRecord

// HistoryService manages launch history records and gameplay statistics.
type HistoryService struct {
	repo database.HistoryRepository
}

// New creates a new HistoryService with the provided database repository.
func New(repo database.HistoryRepository) *HistoryService {
	return &HistoryService{repo: repo}
}

// NewHistoryService creates a new HistoryService with the provided database repository.
func NewHistoryService(repo database.HistoryRepository) *HistoryService {
	return &HistoryService{repo: repo}
}

// List retrieves launch history records up to the specified limit, ordered by start time descending.
// If limit <= 0, DefaultHistoryLimit (50) is used.
func (s *HistoryService) List(ctx context.Context, limit int) ([]domain.LaunchRecord, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if s == nil || s.repo == nil {
		return nil, errors.New("history repository is not initialized")
	}
	if limit <= 0 {
		limit = DefaultHistoryLimit
	}
	records, err := s.repo.List(limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list launch history: %w", err)
	}
	if records == nil {
		records = []domain.LaunchRecord{}
	}
	return records, nil
}

// Clear deletes all launch history records from the database.
func (s *HistoryService) Clear(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if s == nil || s.repo == nil {
		return errors.New("history repository is not initialized")
	}
	if err := s.repo.Clear(); err != nil {
		return fmt.Errorf("failed to clear launch history: %w", err)
	}
	return nil
}

// GetStats calculates and returns aggregated gameplay statistics.
func (s *HistoryService) GetStats(ctx context.Context) (*domain.HistoryStats, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if s == nil || s.repo == nil {
		return nil, errors.New("history repository is not initialized")
	}
	stats, err := s.repo.GetStats()
	if err != nil {
		return nil, fmt.Errorf("failed to get history stats: %w", err)
	}
	return &stats, nil
}

// Add adds a new launch record to the history repository.
func (s *HistoryService) Add(ctx context.Context, record domain.LaunchRecord) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if s == nil || s.repo == nil {
		return errors.New("history repository is not initialized")
	}
	if err := s.repo.Add(record); err != nil {
		return fmt.Errorf("failed to add launch record: %w", err)
	}
	return nil
}
