package saves

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// SaveService manages isolated per-profile savegame directories.
type SaveService struct {
	baseDir string
}

// New creates a new SaveService with a designated base directory.
func New(baseDir string) *SaveService {
	if strings.TrimSpace(baseDir) == "" {
		userConfig, err := os.UserConfigDir()
		if err != nil {
			baseDir = filepath.Join(".", "data", "saves")
		} else {
			baseDir = filepath.Join(userConfig, "RNTLauncher", "saves")
		}
	}
	return &SaveService{
		baseDir: filepath.Clean(baseDir),
	}
}

// BaseDir returns the root savegames directory.
func (s *SaveService) BaseDir() string {
	return s.baseDir
}

// GetProfileSaveDir returns the absolute path to a profile's isolated savegame folder.
func (s *SaveService) GetProfileSaveDir(profileID string) string {
	cleanID := strings.TrimSpace(profileID)
	if cleanID == "" {
		cleanID = "default"
	}
	return filepath.Join(s.baseDir, cleanID)
}

// EnsureProfileSaveDir creates the profile's savegame folder on disk if it does not exist.
func (s *SaveService) EnsureProfileSaveDir(profileID string) (string, error) {
	dir := s.GetProfileSaveDir(profileID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create profile save directory %q: %w", dir, err)
	}
	return dir, nil
}
