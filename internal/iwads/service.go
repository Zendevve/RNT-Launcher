package iwads

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/filesystem"
)

// IWADService coordinates management, type identification, and registration of Doom IWADs.
type IWADService struct {
	repo database.IWADRepository
}

// New creates a new IWADService instance.
func New(repo database.IWADRepository) *IWADService {
	return NewIWADService(repo)
}

// NewIWADService creates a new IWADService instance.
func NewIWADService(repo database.IWADRepository) *IWADService {
	return &IWADService{
		repo: repo,
	}
}

// List retrieves all registered IWADs from persistence.
func (s *IWADService) List(ctx context.Context) ([]domain.IWAD, error) {
	return s.repo.List()
}

// Get retrieves an IWAD by its unique ID.
func (s *IWADService) Get(ctx context.Context, id string) (*domain.IWAD, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("iwad ID cannot be empty")
	}
	return s.repo.Get(id)
}

// Add registers a new IWAD with the service.
func (s *IWADService) Add(ctx context.Context, iwad domain.IWAD) (*domain.IWAD, error) {
	if strings.TrimSpace(iwad.Path) == "" {
		return nil, errors.New("iwad path is required")
	}

	if iwad.Type == "" || !iwad.Type.IsValid() || iwad.Type == domain.IWADTypeUnknown {
		iwad.Type = AutoIdentifyType(iwad.Path, iwad.LumpCount)
	}

	if iwad.Name == "" {
		if iwad.Type.IsValid() && iwad.Type != domain.IWADTypeOther && iwad.Type != domain.IWADTypeUnknown {
			iwad.Name = iwad.Type.DisplayName()
		} else {
			iwad.Name = filepath.Base(iwad.Path)
		}
	}

	if err := s.repo.Create(&iwad); err != nil {
		return nil, err
	}
	return &iwad, nil
}

// Update modifies an existing IWAD entry.
func (s *IWADService) Update(ctx context.Context, iwad domain.IWAD) error {
	if strings.TrimSpace(iwad.ID) == "" {
		return errors.New("iwad ID is required")
	}
	if strings.TrimSpace(iwad.Path) == "" {
		return errors.New("iwad path is required")
	}

	if iwad.Type == "" || !iwad.Type.IsValid() {
		iwad.Type = AutoIdentifyType(iwad.Path, iwad.LumpCount)
	}
	if iwad.Name == "" {
		iwad.Name = filepath.Base(iwad.Path)
	}

	return s.repo.Update(&iwad)
}

// Delete removes an IWAD from persistence by ID.
func (s *IWADService) Delete(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("iwad ID is required")
	}
	return s.repo.Delete(id)
}

// AutoIdentifyType identifies standard commercial and free Doom game IWADs by filename and lump count.
func (s *IWADService) AutoIdentifyType(nameOrPath string, lumpCount int) domain.IWADType {
	return AutoIdentifyType(nameOrPath, lumpCount)
}

// RegisterFile inspects a WAD file on disk and registers it as an IWAD in the database.
// If the IWAD is already registered, its metadata is refreshed and the existing record is returned.
func (s *IWADService) RegisterFile(ctx context.Context, path string) (*domain.IWAD, error) {
	if strings.TrimSpace(path) == "" {
		return nil, errors.New("path cannot be empty")
	}

	fileInfo, err := filesystem.InspectFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect IWAD file: %w", err)
	}

	existing, err := s.repo.GetByPath(path)
	if err == nil && existing != nil {
		existing.LumpCount = fileInfo.LumpCount
		existing.Size = fileInfo.Size
		existing.SHA256 = fileInfo.SHA256
		if existing.Type == "" || existing.Type == domain.IWADTypeUnknown {
			existing.Type = AutoIdentifyType(path, fileInfo.LumpCount)
		}
		if err := s.repo.Update(existing); err != nil {
			return nil, fmt.Errorf("failed to update existing IWAD: %w", err)
		}
		return existing, nil
	}

	iwadType := AutoIdentifyType(path, fileInfo.LumpCount)
	name := fileInfo.Filename
	if iwadType.IsValid() && iwadType != domain.IWADTypeOther && iwadType != domain.IWADTypeUnknown {
		name = iwadType.DisplayName()
	}

	iwad := domain.IWAD{
		Name:      name,
		Path:      path,
		Type:      iwadType,
		LumpCount: fileInfo.LumpCount,
		Size:      fileInfo.Size,
		SHA256:    fileInfo.SHA256,
	}

	if err := s.repo.Create(&iwad); err != nil {
		return nil, fmt.Errorf("failed to register IWAD in database: %w", err)
	}

	return &iwad, nil
}

// AutoIdentifyType classifies an IWAD based on filename pattern matching and lump count heuristics.
func AutoIdentifyType(nameOrPath string, lumpCount int) domain.IWADType {
	base := strings.ToUpper(filepath.Base(nameOrPath))
	ext := filepath.Ext(base)
	baseNoExt := strings.TrimSuffix(base, ext)

	// Direct exact name matches
	switch baseNoExt {
	case "DOOM", "DOOM1", "DOOMU", "ULTIMATE", "ULTIMATEDOOM":
		return domain.IWADTypeDoom
	case "DOOM2", "DOOM2F", "DOOM2_BFG", "DOOM2-BFG", "DOOMII":
		return domain.IWADTypeDoom2
	case "TNT", "TNTEVIL", "EVILUTION":
		return domain.IWADTypeTNT
	case "PLUTONIA", "PLUTON":
		return domain.IWADTypePlutonia
	case "HERETIC", "HERETIC1", "HERETIC_SHW":
		return domain.IWADTypeHeretic
	case "HEXEN", "HEXENDEMO", "HEXEN95", "HEXEN-DEMO":
		return domain.IWADTypeHexen
	case "STRIFE1", "STRIFE0", "STRIFE", "STRIFE-VOICES":
		return domain.IWADTypeStrife
	case "FREEDOOM1", "FREEDOOM", "FREEDOOM_PHASE1", "FREEDOOM-PHASE1":
		return domain.IWADTypeFreedoom
	case "FREEDOOM2", "FREEDM", "FREEDOOM_PHASE2", "FREEDOOM-PHASE2":
		return domain.IWADTypeFreedoom2
	}

	// Substring matches for variants / custom names
	switch {
	case strings.Contains(baseNoExt, "FREEDOOM2") || strings.Contains(baseNoExt, "FREEDM") ||
		strings.Contains(baseNoExt, "FREEDOOM-PHASE2") || strings.Contains(baseNoExt, "FREEDOOM_PHASE2") ||
		strings.Contains(baseNoExt, "PHASE 2") || strings.Contains(baseNoExt, "PHASE2"):
		return domain.IWADTypeFreedoom2

	case strings.Contains(baseNoExt, "FREEDOOM1") || strings.Contains(baseNoExt, "FREEDOOM-PHASE1") ||
		strings.Contains(baseNoExt, "FREEDOOM_PHASE1") || strings.Contains(baseNoExt, "PHASE 1") ||
		strings.Contains(baseNoExt, "PHASE1") || strings.Contains(baseNoExt, "FREEDOOM"):
		return domain.IWADTypeFreedoom

	case strings.Contains(baseNoExt, "PLUTONIA") || strings.Contains(baseNoExt, "PLUTON"):
		return domain.IWADTypePlutonia

	case strings.Contains(baseNoExt, "TNT") || strings.Contains(baseNoExt, "EVILUTION"):
		return domain.IWADTypeTNT

	case strings.Contains(baseNoExt, "HERETIC"):
		return domain.IWADTypeHeretic

	case strings.Contains(baseNoExt, "HEXEN"):
		return domain.IWADTypeHexen

	case strings.Contains(baseNoExt, "STRIFE"):
		return domain.IWADTypeStrife

	case strings.Contains(baseNoExt, "DOOM2") || strings.Contains(baseNoExt, "DOOM 2") ||
		strings.Contains(baseNoExt, "DOOM_2") || strings.Contains(baseNoExt, "DOOMII"):
		return domain.IWADTypeDoom2

	case strings.Contains(baseNoExt, "DOOM") || strings.Contains(baseNoExt, "ULTIMATE"):
		return domain.IWADTypeDoom
	}

	// Lump count heuristics for unrecognized filenames
	switch {
	case lumpCount >= 2100 && lumpCount <= 2500:
		// Ultimate Doom: ~2306 lumps
		return domain.IWADTypeDoom
	case lumpCount >= 2800 && lumpCount <= 2990:
		// Doom II: ~2919 lumps
		return domain.IWADTypeDoom2
	case lumpCount >= 3000 && lumpCount <= 3200:
		// Final Doom TNT: ~3056 lumps
		return domain.IWADTypeTNT
	case lumpCount >= 1200 && lumpCount <= 1450:
		// Heretic: ~1300-1400 lumps
		return domain.IWADTypeHeretic
	case lumpCount >= 1500 && lumpCount <= 1750:
		// Hexen: ~1550 lumps
		return domain.IWADTypeHexen
	case lumpCount > 0:
		return domain.IWADTypeOther
	default:
		return domain.IWADTypeUnknown
	}
}
