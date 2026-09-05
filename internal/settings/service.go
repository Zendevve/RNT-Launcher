package settings

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
)

// Settings is an alias for domain.Settings.
type Settings = domain.Settings

// SettingsService manages application preferences, configuration, and directory paths.
type SettingsService struct {
	repo database.SettingsRepository
}

// New creates a new SettingsService with the provided database repository.
func New(repo database.SettingsRepository) *SettingsService {
	return &SettingsService{repo: repo}
}

// NewSettingsService creates a new SettingsService with the provided database repository.
func NewSettingsService(repo database.SettingsRepository) *SettingsService {
	return &SettingsService{repo: repo}
}

// Get retrieves application settings. If no settings are stored in the database yet,
// it returns default settings.
func (s *SettingsService) Get(ctx context.Context) (*domain.Settings, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if s == nil || s.repo == nil {
		return nil, errors.New("settings repository is not initialized")
	}

	settings, err := s.repo.GetSettings()
	if err != nil {
		return nil, fmt.Errorf("failed to get settings: %w", err)
	}

	normalizeSettings(&settings)
	return &settings, nil
}

// Update persists updated application settings into the database.
func (s *SettingsService) Update(ctx context.Context, settings domain.Settings) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if s == nil || s.repo == nil {
		return errors.New("settings repository is not initialized")
	}

	normalizeSettings(&settings)
	if err := s.repo.SaveSettings(settings); err != nil {
		return fmt.Errorf("failed to save settings: %w", err)
	}
	return nil
}

// ResetToDefaults resets application settings to the factory default configuration.
func (s *SettingsService) ResetToDefaults(ctx context.Context) error {
	return s.Update(ctx, domain.DefaultSettings())
}

// AddModDirectory adds a directory path to the scanned mod directories list idempotently.
func (s *SettingsService) AddModDirectory(ctx context.Context, dir string) error {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return errors.New("directory path cannot be empty")
	}
	settings, err := s.Get(ctx)
	if err != nil {
		return err
	}
	if containsDir(settings.ModDirectories, dir) {
		return nil
	}
	settings.ModDirectories = append(settings.ModDirectories, dir)
	return s.Update(ctx, *settings)
}

// RemoveModDirectory removes a directory path from the mod directories list idempotently.
func (s *SettingsService) RemoveModDirectory(ctx context.Context, dir string) error {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return nil
	}
	settings, err := s.Get(ctx)
	if err != nil {
		return err
	}
	updated, removed := removeDir(settings.ModDirectories, dir)
	if !removed {
		return nil
	}
	settings.ModDirectories = updated
	return s.Update(ctx, *settings)
}

// AddIWADDirectory adds a directory path to the scanned IWAD directories list idempotently.
func (s *SettingsService) AddIWADDirectory(ctx context.Context, dir string) error {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return errors.New("directory path cannot be empty")
	}
	settings, err := s.Get(ctx)
	if err != nil {
		return err
	}
	if containsDir(settings.IWADDirectories, dir) {
		return nil
	}
	settings.IWADDirectories = append(settings.IWADDirectories, dir)
	return s.Update(ctx, *settings)
}

// RemoveIWADDirectory removes a directory path from the IWAD directories list idempotently.
func (s *SettingsService) RemoveIWADDirectory(ctx context.Context, dir string) error {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return nil
	}
	settings, err := s.Get(ctx)
	if err != nil {
		return err
	}
	updated, removed := removeDir(settings.IWADDirectories, dir)
	if !removed {
		return nil
	}
	settings.IWADDirectories = updated
	return s.Update(ctx, *settings)
}

// AddEngineDirectory adds a directory path to the scanned Engine directories list idempotently.
func (s *SettingsService) AddEngineDirectory(ctx context.Context, dir string) error {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return errors.New("directory path cannot be empty")
	}
	settings, err := s.Get(ctx)
	if err != nil {
		return err
	}
	if containsDir(settings.EngineDirectories, dir) {
		return nil
	}
	settings.EngineDirectories = append(settings.EngineDirectories, dir)
	return s.Update(ctx, *settings)
}

// RemoveEngineDirectory removes a directory path from the Engine directories list idempotently.
func (s *SettingsService) RemoveEngineDirectory(ctx context.Context, dir string) error {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return nil
	}
	settings, err := s.Get(ctx)
	if err != nil {
		return err
	}
	updated, removed := removeDir(settings.EngineDirectories, dir)
	if !removed {
		return nil
	}
	settings.EngineDirectories = updated
	return s.Update(ctx, *settings)
}

// GetModDirectories retrieves the current list of scanned mod directories.
func (s *SettingsService) GetModDirectories(ctx context.Context) ([]string, error) {
	settings, err := s.Get(ctx)
	if err != nil {
		return nil, err
	}
	return settings.ModDirectories, nil
}

// GetIWADDirectories retrieves the current list of scanned IWAD directories.
func (s *SettingsService) GetIWADDirectories(ctx context.Context) ([]string, error) {
	settings, err := s.Get(ctx)
	if err != nil {
		return nil, err
	}
	return settings.IWADDirectories, nil
}

// GetEngineDirectories retrieves the current list of scanned Engine directories.
func (s *SettingsService) GetEngineDirectories(ctx context.Context) ([]string, error) {
	settings, err := s.Get(ctx)
	if err != nil {
		return nil, err
	}
	return settings.EngineDirectories, nil
}

func containsDir(list []string, target string) bool {
	cleanTarget := filepath.Clean(target)
	for _, d := range list {
		if d == target || filepath.Clean(d) == cleanTarget {
			return true
		}
	}
	return false
}

func removeDir(list []string, target string) ([]string, bool) {
	cleanTarget := filepath.Clean(target)
	result := make([]string, 0, len(list))
	removed := false
	for _, d := range list {
		if d == target || filepath.Clean(d) == cleanTarget {
			removed = true
			continue
		}
		result = append(result, d)
	}
	return result, removed
}

func normalizeSettings(s *domain.Settings) {
	if s.ModDirectories == nil {
		s.ModDirectories = []string{}
	}
	if s.IWADDirectories == nil {
		s.IWADDirectories = []string{}
	}
	if s.EngineDirectories == nil {
		s.EngineDirectories = []string{}
	}
	if s.Theme == "" {
		s.Theme = "dark"
	}
	if s.UiDensity == "" {
		s.UiDensity = "compact"
	}
	if s.FormatVisibility == nil || len(s.FormatVisibility) == 0 {
		s.FormatVisibility = []string{".wad", ".pk3", ".pk7", ".ipk3", ".zip", ".deh", ".bex"}
	}
	if s.DefaultView == "" {
		s.DefaultView = "dashboard"
	}
}
