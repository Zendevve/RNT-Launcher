package validator

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
)

// Validator defines the interface for launch profile validation.
type Validator interface {
	ValidateProfile(ctx context.Context, profileID string) (*domain.ValidationResult, error)
	ValidateProfileEntity(ctx context.Context, p *domain.Profile) (*domain.ValidationResult, error)
}

// ValidatorService validates Doom launch profiles against registered engines,
// game IWADs, modification files, and the local filesystem before execution.
type ValidatorService struct {
	profiles database.ProfileRepository
	engines  database.EngineRepository
	iwads    database.IWADRepository
	mods     database.ModRepository
}

// NewValidatorService creates and initializes a new ValidatorService instance.
func NewValidatorService(
	profiles database.ProfileRepository,
	engines database.EngineRepository,
	iwads database.IWADRepository,
	mods database.ModRepository,
) *ValidatorService {
	return &ValidatorService{
		profiles: profiles,
		engines:  engines,
		iwads:    iwads,
		mods:     mods,
	}
}

// ValidateProfile fetches a profile by its ID from the repository and validates it.
func (s *ValidatorService) ValidateProfile(ctx context.Context, profileID string) (*domain.ValidationResult, error) {
	if s.profiles == nil {
		return nil, fmt.Errorf("profile repository is not configured")
	}
	profile, err := s.profiles.Get(profileID)
	if err != nil {
		return nil, fmt.Errorf("failed to get profile %s: %w", profileID, err)
	}
	return s.ValidateProfileEntity(ctx, profile)
}

// ValidateProfileEntity executes all pre-launch validation rules on a given Profile.
//
// Rules checked:
// 1. Engine existence and executable file accessibility.
// 2. IWAD selection and file existence.
// 3. Mod files existence (errors for enabled missing mods, warnings for disabled missing mods, info for disabled mods).
// 4. Duplicate mod detection in the load order.
// 5. Working directory validity.
func (s *ValidatorService) ValidateProfileEntity(ctx context.Context, p *domain.Profile) (*domain.ValidationResult, error) {
	if p == nil {
		return nil, fmt.Errorf("profile cannot be nil")
	}

	result := &domain.ValidationResult{
		Status: domain.ValidationStatusReady,
		Items:  make([]domain.ValidationItem, 0),
	}

	// ----------------------------------------------------
	// Rule 1: Engine Check
	// ----------------------------------------------------
	if strings.TrimSpace(p.EngineID) == "" {
		result.AddItem(
			domain.ValidationSeverityError,
			"MISSING_ENGINE",
			"No source port engine selected",
			"engine",
		)
	} else {
		var engine *domain.Engine
		var err error
		if s.engines != nil {
			engine, err = s.engines.Get(p.EngineID)
		}

		if err != nil || engine == nil {
			result.AddItem(
				domain.ValidationSeverityError,
				"ENGINE_NOT_FOUND",
				fmt.Sprintf("Engine executable not found: %s", p.EngineID),
				"engine",
			)
		} else {
			// Check if executable exists on disk
			execPath := strings.TrimSpace(engine.Executable)
			if execPath == "" {
				result.AddItem(
					domain.ValidationSeverityError,
					"ENGINE_NOT_FOUND",
					"Engine executable not found: ",
					"engine",
				)
			} else if fi, statErr := os.Stat(execPath); statErr != nil || fi.IsDir() {
				result.AddItem(
					domain.ValidationSeverityError,
					"ENGINE_NOT_FOUND",
					fmt.Sprintf("Engine executable not found: %s", execPath),
					"engine",
				)
			} else {
				result.Engine = engine
			}
		}
	}

	// ----------------------------------------------------
	// Rule 2: IWAD Check
	// ----------------------------------------------------
	if strings.TrimSpace(p.IWADID) == "" {
		result.AddItem(
			domain.ValidationSeverityError,
			"MISSING_IWAD",
			"No IWAD selected",
			"iwad",
		)
	} else {
		var iwad *domain.IWAD
		var err error
		if s.iwads != nil {
			iwad, err = s.iwads.Get(p.IWADID)
		}

		if err != nil || iwad == nil {
			result.AddItem(
				domain.ValidationSeverityError,
				"IWAD_NOT_FOUND",
				fmt.Sprintf("IWAD file not found: %s", p.IWADID),
				"iwad",
			)
		} else {
			// Check if IWAD file exists on disk
			iwadPath := strings.TrimSpace(iwad.Path)
			if iwadPath == "" {
				result.AddItem(
					domain.ValidationSeverityError,
					"IWAD_NOT_FOUND",
					"IWAD file not found: ",
					"iwad",
				)
			} else if fi, statErr := os.Stat(iwadPath); statErr != nil || fi.IsDir() {
				result.AddItem(
					domain.ValidationSeverityError,
					"IWAD_NOT_FOUND",
					fmt.Sprintf("IWAD file not found: %s", iwadPath),
					"iwad",
				)
			} else {
				result.IWAD = iwad
			}
		}
	}

	// ----------------------------------------------------
	// Rule 3 & 4: Mods & Duplicate Detection
	// ----------------------------------------------------
	modsCopy := make([]domain.ProfileMod, len(p.Mods))
	copy(modsCopy, p.Mods)
	sort.SliceStable(modsCopy, func(i, j int) bool {
		return modsCopy[i].Order < modsCopy[j].Order
	})

	seenPaths := make(map[string]bool)
	seenIDs := make(map[string]bool)

	for _, pm := range modsCopy {
		modName := pm.ModName
		modPath := pm.ModPath
		target := pm.ModID
		if target == "" {
			target = pm.ID
		}
		if target == "" {
			target = pm.ModPath
		}

		// If path or name missing from ProfileMod, attempt DB hydration
		if (modPath == "" || modName == "") && s.mods != nil && pm.ModID != "" {
			if dbMod, err := s.mods.Get(pm.ModID); err == nil && dbMod != nil {
				if modPath == "" {
					modPath = dbMod.Path
				}
				if modName == "" {
					modName = dbMod.Name
				}
			}
		}

		if modName == "" {
			if modPath != "" {
				modName = filepath.Base(modPath)
			} else if pm.ModID != "" {
				modName = pm.ModID
			} else {
				modName = "Unknown Mod"
			}
		}

		// Rule 4: Duplicate Check in load order
		isDuplicate := false
		var cleanPathKey string
		if modPath != "" {
			cleanPathKey = filepath.Clean(modPath)
			if seenPaths[cleanPathKey] {
				isDuplicate = true
			}
		} else if pm.ModID != "" {
			if seenIDs[pm.ModID] {
				isDuplicate = true
			}
		}

		if isDuplicate {
			result.AddItem(
				domain.ValidationSeverityWarning,
				"DUPLICATE_MOD",
				fmt.Sprintf("Duplicate mod in load order: %s", modName),
				target,
			)
		} else {
			if cleanPathKey != "" {
				seenPaths[cleanPathKey] = true
			}
			if pm.ModID != "" {
				seenIDs[pm.ModID] = true
			}
		}

		// Rule 3: File existence & Readability
		var fileMissing bool
		if modPath == "" {
			fileMissing = true
		} else {
			fi, statErr := os.Stat(modPath)
			if statErr != nil || fi.IsDir() {
				fileMissing = true
			}
		}

		if pm.Enabled {
			if fileMissing {
				result.AddItem(
					domain.ValidationSeverityError,
					"MOD_NOT_FOUND",
					fmt.Sprintf("Mod file not found: %s", modPath),
					target,
				)
			}
		} else {
			// Mod is disabled
			result.AddItem(
				domain.ValidationSeverityInfo,
				"MOD_DISABLED",
				fmt.Sprintf("Mod %s is disabled in load order", modName),
				target,
			)

			if fileMissing {
				result.AddItem(
					domain.ValidationSeverityWarning,
					"DISABLED_MOD_MISSING",
					fmt.Sprintf("Disabled mod file missing: %s", modPath),
					target,
				)
			}
		}
	}

	// ----------------------------------------------------
	// Rule 5: Working Directory Validation
	// ----------------------------------------------------
	workDir := strings.TrimSpace(p.WorkingDir)
	if workDir != "" {
		fi, err := os.Stat(workDir)
		if err != nil || !fi.IsDir() {
			result.AddItem(
				domain.ValidationSeverityWarning,
				"INVALID_WORKING_DIR",
				fmt.Sprintf("Working directory does not exist: %s", workDir),
				"working_dir",
			)
		}
	}

	// Populate enabled mods (sorted by order)
	result.EnabledMods = p.EnabledMods()
	result.Status = result.ComputeStatus()

	return result, nil
}
