package profiles

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"gopkg.in/yaml.v3"

	"rnt-launcher/internal/domain"
)

// ProfileYAMLEngine represents engine metadata in a profile YAML file.
type ProfileYAMLEngine struct {
	ID   string `yaml:"id,omitempty"`
	Name string `yaml:"name,omitempty"`
}

// ProfileYAMLIWAD represents IWAD metadata in a profile YAML file.
type ProfileYAMLIWAD struct {
	ID   string `yaml:"id,omitempty"`
	Name string `yaml:"name,omitempty"`
}

// ProfileYAMLMod represents an individual mod in a profile YAML file.
type ProfileYAMLMod struct {
	ID      string `yaml:"id,omitempty"`
	Name    string `yaml:"name,omitempty"`
	Path    string `yaml:"path,omitempty"`
	Enabled bool   `yaml:"enabled"`
	Order   int    `yaml:"order"`
}

// ProfileYAMLData represents the profile payload in a profile YAML file.
type ProfileYAMLData struct {
	ID          string            `yaml:"id,omitempty"`
	Name        string            `yaml:"name"`
	Description string            `yaml:"description,omitempty"`
	Engine      ProfileYAMLEngine `yaml:"engine"`
	IWAD        ProfileYAMLIWAD   `yaml:"iwad"`
	Mods        []ProfileYAMLMod  `yaml:"mods,omitempty"`
	Arguments   []string          `yaml:"arguments,omitempty"`
	WorkingDir  string            `yaml:"working_dir,omitempty"`
}

// ProfileExportFile represents the top-level schema (version 1) for profile export/import.
type ProfileExportFile struct {
	Version int             `yaml:"version"`
	Profile ProfileYAMLData `yaml:"profile"`
}

// ExportYAML exports an existing profile to a YAML byte array conforming to specification version 1.
func (s *ProfileService) ExportYAML(ctx context.Context, profileID string) ([]byte, error) {
	if err := s.checkInitialized(ctx); err != nil {
		return nil, err
	}
	if strings.TrimSpace(profileID) == "" {
		return nil, errors.New("profile id cannot be empty")
	}

	p, err := s.profiles.Get(profileID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("profile %q not found", profileID)
		}
		return nil, fmt.Errorf("failed to get profile %q: %w", profileID, err)
	}
	if p == nil {
		return nil, fmt.Errorf("profile %q not found", profileID)
	}

	engineName := p.EngineName
	if engineName == "" && p.EngineID != "" && s.engines != nil {
		if eng, err := s.engines.Get(p.EngineID); err == nil && eng != nil {
			engineName = eng.Name
		}
	}

	iwadName := p.IWADName
	if iwadName == "" && p.IWADID != "" && s.iwads != nil {
		if iwad, err := s.iwads.Get(p.IWADID); err == nil && iwad != nil {
			iwadName = iwad.Name
		}
	}

	// Sort mods ascending by Order
	mods := make([]domain.ProfileMod, len(p.Mods))
	copy(mods, p.Mods)
	sort.SliceStable(mods, func(i, j int) bool {
		return mods[i].Order < mods[j].Order
	})

	yamlMods := make([]ProfileYAMLMod, 0, len(mods))
	for _, m := range mods {
		modName := m.ModName
		modPath := m.ModPath
		if (modName == "" || modPath == "") && m.ModID != "" && s.mods != nil {
			if modObj, err := s.mods.Get(m.ModID); err == nil && modObj != nil {
				if modName == "" {
					modName = modObj.Name
				}
				if modPath == "" {
					modPath = modObj.Path
				}
			}
		}
		yamlMods = append(yamlMods, ProfileYAMLMod{
			ID:      m.ModID,
			Name:    modName,
			Path:    modPath,
			Enabled: m.Enabled,
			Order:   m.Order,
		})
	}

	args := p.Arguments
	if args == nil {
		args = []string{}
	}

	exportFile := ProfileExportFile{
		Version: 1,
		Profile: ProfileYAMLData{
			ID:          p.ID,
			Name:        p.Name,
			Description: p.Description,
			Engine: ProfileYAMLEngine{
				ID:   p.EngineID,
				Name: engineName,
			},
			IWAD: ProfileYAMLIWAD{
				ID:   p.IWADID,
				Name: iwadName,
			},
			Mods:       yamlMods,
			Arguments:  args,
			WorkingDir: p.WorkingDir,
		},
	}

	out, err := yaml.Marshal(&exportFile)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal profile YAML: %w", err)
	}

	return out, nil
}

// ImportYAML parses a version 1 profile YAML payload, matches/resolves engines, IWADs, and mods against the local library,
// creates the profile in the database, and returns the persisted profile along with any unresolved warning findings.
func (s *ProfileService) ImportYAML(ctx context.Context, data []byte) (*domain.Profile, []domain.ValidationItem, error) {
	if err := s.checkInitialized(ctx); err != nil {
		return nil, nil, err
	}
	if len(data) == 0 {
		return nil, nil, errors.New("empty YAML data")
	}

	var file ProfileExportFile
	if err := yaml.Unmarshal(data, &file); err != nil {
		return nil, nil, fmt.Errorf("invalid YAML syntax: %w", err)
	}

	if file.Version != 1 {
		return nil, nil, fmt.Errorf("unsupported profile YAML version: %d (expected 1)", file.Version)
	}

	profileName := strings.TrimSpace(file.Profile.Name)
	if profileName == "" {
		return nil, nil, errors.New("profile name is required")
	}

	var warnings []domain.ValidationItem

	// 1. Resolve Engine
	var resolvedEngineID, resolvedEngineName string
	engIDReq := strings.TrimSpace(file.Profile.Engine.ID)
	engNameReq := strings.TrimSpace(file.Profile.Engine.Name)

	if engIDReq != "" || engNameReq != "" {
		var allEngines []domain.Engine
		if s.engines != nil {
			if list, err := s.engines.List(); err == nil {
				allEngines = list
			}
		}

		var matchedEngine *domain.Engine
		// Check by exact ID
		if engIDReq != "" {
			for i := range allEngines {
				if allEngines[i].ID == engIDReq {
					matchedEngine = &allEngines[i]
					break
				}
			}
		}
		// Check by Name
		if matchedEngine == nil && engNameReq != "" {
			for i := range allEngines {
				if strings.EqualFold(allEngines[i].Name, engNameReq) {
					matchedEngine = &allEngines[i]
					break
				}
			}
		}
		// Check by ID matching Name
		if matchedEngine == nil && engIDReq != "" {
			for i := range allEngines {
				if strings.EqualFold(allEngines[i].Name, engIDReq) {
					matchedEngine = &allEngines[i]
					break
				}
			}
		}
		// Check by Executable file name
		if matchedEngine == nil {
			for i := range allEngines {
				exeName := filepath.Base(allEngines[i].Executable)
				if (engNameReq != "" && strings.EqualFold(exeName, engNameReq)) ||
					(engIDReq != "" && strings.EqualFold(exeName, engIDReq)) {
					matchedEngine = &allEngines[i]
					break
				}
			}
		}

		if matchedEngine != nil {
			resolvedEngineID = matchedEngine.ID
			resolvedEngineName = matchedEngine.Name
		} else {
			// Engine missing in library
			label := engNameReq
			if label == "" {
				label = engIDReq
			}
			resolvedEngineName = label
			warnings = append(warnings, domain.ValidationItem{
				Severity: domain.ValidationSeverityWarning,
				Code:     "MISSING_ENGINE",
				Message:  fmt.Sprintf("Engine %q not found in local library", label),
				Target:   "engine",
			})
		}
	}

	// 2. Resolve IWAD
	var resolvedIWADID, resolvedIWADName string
	iwadIDReq := strings.TrimSpace(file.Profile.IWAD.ID)
	iwadNameReq := strings.TrimSpace(file.Profile.IWAD.Name)

	if iwadIDReq != "" || iwadNameReq != "" {
		var allIWADs []domain.IWAD
		if s.iwads != nil {
			if list, err := s.iwads.List(); err == nil {
				allIWADs = list
			}
		}

		var matchedIWAD *domain.IWAD
		// Check by exact ID
		if iwadIDReq != "" {
			for i := range allIWADs {
				if allIWADs[i].ID == iwadIDReq {
					matchedIWAD = &allIWADs[i]
					break
				}
			}
		}
		// Check by Name
		if matchedIWAD == nil && iwadNameReq != "" {
			for i := range allIWADs {
				if strings.EqualFold(allIWADs[i].Name, iwadNameReq) {
					matchedIWAD = &allIWADs[i]
					break
				}
			}
		}
		// Check by ID matching Name
		if matchedIWAD == nil && iwadIDReq != "" {
			for i := range allIWADs {
				if strings.EqualFold(allIWADs[i].Name, iwadIDReq) {
					matchedIWAD = &allIWADs[i]
					break
				}
			}
		}
		// Check by IWAD file name or type
		if matchedIWAD == nil {
			for i := range allIWADs {
				fn := allIWADs[i].FileName()
				iwType := string(allIWADs[i].Type)
				if (iwadNameReq != "" && (strings.EqualFold(fn, iwadNameReq) || strings.EqualFold(iwType, strings.ToLower(iwadNameReq)))) ||
					(iwadIDReq != "" && (strings.EqualFold(fn, iwadIDReq) || strings.EqualFold(iwType, strings.ToLower(iwadIDReq)))) {
					matchedIWAD = &allIWADs[i]
					break
				}
			}
		}

		if matchedIWAD != nil {
			resolvedIWADID = matchedIWAD.ID
			resolvedIWADName = matchedIWAD.Name
		} else {
			// IWAD missing in library
			label := iwadNameReq
			if label == "" {
				label = iwadIDReq
			}
			resolvedIWADName = label
			warnings = append(warnings, domain.ValidationItem{
				Severity: domain.ValidationSeverityWarning,
				Code:     "MISSING_IWAD",
				Message:  fmt.Sprintf("IWAD %q not found in local library", label),
				Target:   "iwad",
			})
		}
	}

	// 3. Resolve Mods
	var allMods []domain.Mod
	if s.mods != nil {
		if list, err := s.mods.List(domain.ModFilter{}); err == nil {
			allMods = list
		}
	}

	profileID := uuid.NewString()
	if strings.TrimSpace(file.Profile.ID) != "" {
		// Check if ID is already used
		if existing, err := s.profiles.Get(file.Profile.ID); existing == nil || errors.Is(err, sql.ErrNoRows) {
			profileID = file.Profile.ID
		}
	}

	var resolvedMods []domain.ProfileMod
	for i, ym := range file.Profile.Mods {
		order := ym.Order
		if order <= 0 {
			order = i + 1
		}

		ymID := strings.TrimSpace(ym.ID)
		ymName := strings.TrimSpace(ym.Name)
		ymPath := strings.TrimSpace(ym.Path)

		var matchedMod *domain.Mod
		// Match 1: Exact ID
		if ymID != "" {
			for idx := range allMods {
				if allMods[idx].ID == ymID {
					matchedMod = &allMods[idx]
					break
				}
			}
		}
		// Match 2: Path match
		if matchedMod == nil && ymPath != "" {
			cleanYMPath := filepath.Clean(ymPath)
			for idx := range allMods {
				if strings.EqualFold(filepath.Clean(allMods[idx].Path), cleanYMPath) {
					matchedMod = &allMods[idx]
					break
				}
			}
		}
		// Match 3: Name match
		if matchedMod == nil && ymName != "" {
			for idx := range allMods {
				if strings.EqualFold(allMods[idx].Name, ymName) {
					matchedMod = &allMods[idx]
					break
				}
			}
		}
		// Match 4: Filename of path match
		if matchedMod == nil && ymPath != "" {
			baseName := filepath.Base(ymPath)
			for idx := range allMods {
				if strings.EqualFold(allMods[idx].FileName(), baseName) {
					matchedMod = &allMods[idx]
					break
				}
			}
		}
		// Match 5: Filename of Name match
		if matchedMod == nil && ymName != "" {
			for idx := range allMods {
				if strings.EqualFold(allMods[idx].FileName(), ymName) {
					matchedMod = &allMods[idx]
					break
				}
			}
		}

		if matchedMod != nil {
			resolvedMods = append(resolvedMods, domain.ProfileMod{
				ID:        uuid.NewString(),
				ProfileID: profileID,
				ModID:     matchedMod.ID,
				ModName:   matchedMod.Name,
				ModPath:   matchedMod.Path,
				ModFormat: matchedMod.Format,
				Enabled:   ym.Enabled,
				Order:     order,
			})
		} else {
			// Mod not found in local library: create placeholder mod in DB to satisfy foreign keys
			placeholderID := ymID
			if placeholderID == "" {
				placeholderID = uuid.NewString()
			}
			placeholderName := ymName
			if placeholderName == "" && ymPath != "" {
				placeholderName = filepath.Base(ymPath)
			}
			if placeholderName == "" || placeholderName == "." {
				placeholderName = "Missing Mod"
			}
			placeholderPath := ymPath
			if placeholderPath == "" {
				placeholderPath = "missing://" + placeholderID
			}

			// Ensure unique path in database if path already taken
			if s.mods != nil {
				if existingByPath, _ := s.mods.GetByPath(placeholderPath); existingByPath != nil && existingByPath.ID != placeholderID {
					placeholderPath = placeholderPath + "_" + placeholderID
				}
			}

			format := domain.DetectModFormat(placeholderPath)
			if !format.IsValid() {
				format = domain.ModFormatPK3
			}

			placeholderMod := domain.Mod{
				ID:         placeholderID,
				Name:       placeholderName,
				Path:       placeholderPath,
				Format:     format,
				Category:   domain.ModCategoryGameplay,
				CreatedAt:  time.Now().UTC(),
				UpdatedAt:  time.Now().UTC(),
				Structures: []string{},
			}

			if s.mods != nil {
				_ = s.mods.Create(&placeholderMod)
				allMods = append(allMods, placeholderMod)
			}

			resolvedMods = append(resolvedMods, domain.ProfileMod{
				ID:        uuid.NewString(),
				ProfileID: profileID,
				ModID:     placeholderMod.ID,
				ModName:   placeholderMod.Name,
				ModPath:   placeholderMod.Path,
				ModFormat: placeholderMod.Format,
				Enabled:   ym.Enabled,
				Order:     order,
			})

			displayLabel := ymName
			if displayLabel == "" {
				displayLabel = ymPath
			}
			if displayLabel == "" {
				displayLabel = placeholderID
			}

			warnings = append(warnings, domain.ValidationItem{
				Severity: domain.ValidationSeverityWarning,
				Code:     "MISSING_MOD",
				Message:  fmt.Sprintf("Mod %q not found in local library", displayLabel),
				Target:   placeholderMod.ID,
			})
		}
	}

	args := file.Profile.Arguments
	if args == nil {
		args = []string{}
	}

	now := time.Now().UTC()
	newProfile := domain.Profile{
		ID:          profileID,
		Name:        profileName,
		Description: file.Profile.Description,
		EngineID:    resolvedEngineID,
		EngineName:  resolvedEngineName,
		IWADID:      resolvedIWADID,
		IWADName:    resolvedIWADName,
		Mods:        resolvedMods,
		Arguments:   args,
		WorkingDir:  file.Profile.WorkingDir,
		IsFavorite:  false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.profiles.Create(&newProfile); err != nil {
		return nil, nil, fmt.Errorf("failed to persist imported profile: %w", err)
	}

	saved, err := s.profiles.Get(profileID)
	if err == nil && saved != nil {
		return saved, warnings, nil
	}

	return &newProfile, warnings, nil
}
