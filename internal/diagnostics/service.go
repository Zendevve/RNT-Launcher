package diagnostics

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/logger"
)

// DiagnosticsService inspects application health, database integrity, file existence, and profile validity.
type DiagnosticsService struct {
	db          *sql.DB
	engineRepo  database.EngineRepository
	iwadRepo    database.IWADRepository
	modRepo     database.ModRepository
	profileRepo database.ProfileRepository
	historyRepo database.HistoryRepository
	dbPath      string
}

// NewDiagnosticsService creates a new DiagnosticsService instance.
func NewDiagnosticsService(
	db *sql.DB,
	engineRepo database.EngineRepository,
	iwadRepo database.IWADRepository,
	modRepo database.ModRepository,
	profileRepo database.ProfileRepository,
	historyRepo database.HistoryRepository,
	dbPath string,
) *DiagnosticsService {
	return &DiagnosticsService{
		db:          db,
		engineRepo:  engineRepo,
		iwadRepo:    iwadRepo,
		modRepo:     modRepo,
		profileRepo: profileRepo,
		historyRepo: historyRepo,
		dbPath:      dbPath,
	}
}

// RunDiagnostics executes all health checks and returns a comprehensive report.
func (s *DiagnosticsService) RunDiagnostics(ctx context.Context) (*domain.DiagnosticsReport, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	report := &domain.DiagnosticsReport{
		OverallStatus: "healthy",
		Database: domain.DatabaseHealth{
			Status:         "healthy",
			Path:           s.dbPath,
			IntegrityCheck: "ok",
		},
		Issues:      make([]domain.DiagnosticIssue, 0),
		Summary:     domain.DiagnosticsSummary{},
		GeneratedAt: time.Now().UTC(),
	}

	// 1. Database Health Check
	s.checkDatabase(ctx, report)

	// 2. Engines Check
	s.checkEngines(ctx, report)

	// 3. IWADs Check
	s.checkIWADs(ctx, report)

	// 4. Mod Library Check
	s.checkLibrary(ctx, report)

	// 5. Profiles Check
	s.checkProfiles(ctx, report)

	// 6. Compute summary counts and overall health status
	for _, issue := range report.Issues {
		report.Summary.TotalIssues++
		switch issue.Severity {
		case domain.SeverityError:
			report.Summary.ErrorCount++
		case domain.SeverityWarning:
			report.Summary.WarningCount++
		case domain.SeverityInfo:
			report.Summary.InfoCount++
		}
	}

	if report.Summary.ErrorCount > 0 || report.Database.Status == "error" {
		report.OverallStatus = "error"
	} else if report.Summary.WarningCount > 0 || report.Database.Status == "warning" {
		report.OverallStatus = "warning"
	} else {
		report.OverallStatus = "healthy"
	}

	return report, nil
}

func (s *DiagnosticsService) checkDatabase(ctx context.Context, report *domain.DiagnosticsReport) {
	if s.db == nil {
		report.Database.Status = "error"
		report.Database.IntegrityCheck = "database connection is nil"
		report.Issues = append(report.Issues, domain.DiagnosticIssue{
			ID:          uuid.NewString(),
			Category:    domain.CategoryDatabase,
			Severity:    domain.SeverityError,
			Title:       "Database Not Connected",
			Description: "The SQLite database handle is not initialized.",
			CanRepair:   false,
		})
		return
	}

	// Run SQLite integrity check
	var integrityResult string
	err := s.db.QueryRowContext(ctx, "PRAGMA integrity_check;").Scan(&integrityResult)
	if err != nil {
		report.Database.Status = "error"
		report.Database.IntegrityCheck = err.Error()
		report.Issues = append(report.Issues, domain.DiagnosticIssue{
			ID:          uuid.NewString(),
			Category:    domain.CategoryDatabase,
			Severity:    domain.SeverityError,
			Title:       "SQLite Integrity Check Failed",
			Description: fmt.Sprintf("Integrity check query failed: %v", err),
			CanRepair:   false,
		})
	} else {
		report.Database.IntegrityCheck = integrityResult
		if strings.ToLower(integrityResult) != "ok" {
			report.Database.Status = "error"
			report.Issues = append(report.Issues, domain.DiagnosticIssue{
				ID:          uuid.NewString(),
				Category:    domain.CategoryDatabase,
				Severity:    domain.SeverityError,
				Title:       "Database Corruption Detected",
				Description: fmt.Sprintf("SQLite integrity check returned: %s", integrityResult),
				CanRepair:   false,
			})
		}
	}

	// Populate item counts
	_ = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM mods;").Scan(&report.Database.ModCount)
	_ = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM iwads;").Scan(&report.Database.IWADCount)
	_ = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM engines;").Scan(&report.Database.EngineCount)
	_ = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM profiles;").Scan(&report.Database.ProfileCount)
	_ = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM launch_history;").Scan(&report.Database.HistoryCount)
}

func (s *DiagnosticsService) checkEngines(ctx context.Context, report *domain.DiagnosticsReport) {
	if s.engineRepo == nil {
		return
	}

	enginesList, err := s.engineRepo.List()
	if err != nil {
		report.Issues = append(report.Issues, domain.DiagnosticIssue{
			ID:          uuid.NewString(),
			Category:    domain.CategoryEngine,
			Severity:    domain.SeverityError,
			Title:       "Failed to Query Engines",
			Description: err.Error(),
			CanRepair:   false,
		})
		return
	}

	seenPaths := make(map[string]string) // path -> engineID

	for _, eng := range enginesList {
		cleanPath := filepath.Clean(eng.Executable)
		stat, err := os.Stat(cleanPath)
		if err != nil {
			report.Issues = append(report.Issues, domain.DiagnosticIssue{
				ID:                uuid.NewString(),
				Category:          domain.CategoryEngine,
				Severity:          domain.SeverityError,
				Title:             fmt.Sprintf("Engine Executable Missing: %s", eng.Name),
				Description:       fmt.Sprintf("Executable file does not exist on disk: %s", eng.Executable),
				TargetID:          eng.ID,
				TargetPath:        eng.Executable,
				CanRepair:         true,
				RepairAction:      "remove_engine",
				RepairDescription: "Remove invalid engine entry from database",
			})
		} else if stat.IsDir() {
			report.Issues = append(report.Issues, domain.DiagnosticIssue{
				ID:                uuid.NewString(),
				Category:          domain.CategoryEngine,
				Severity:          domain.SeverityError,
				Title:             fmt.Sprintf("Engine Path is a Directory: %s", eng.Name),
				Description:       fmt.Sprintf("Path points to a directory, expected an executable: %s", eng.Executable),
				TargetID:          eng.ID,
				TargetPath:        eng.Executable,
				CanRepair:         true,
				RepairAction:      "remove_engine",
				RepairDescription: "Remove invalid engine entry from database",
			})
		}

		if prevID, duplicate := seenPaths[strings.ToLower(cleanPath)]; duplicate && prevID != eng.ID {
			report.Issues = append(report.Issues, domain.DiagnosticIssue{
				ID:                uuid.NewString(),
				Category:          domain.CategoryEngine,
				Severity:          domain.SeverityWarning,
				Title:             fmt.Sprintf("Duplicate Engine Registered: %s", eng.Name),
				Description:       fmt.Sprintf("Multiple engine entries point to identical executable: %s", eng.Executable),
				TargetID:          eng.ID,
				TargetPath:        eng.Executable,
				CanRepair:         true,
				RepairAction:      "remove_engine",
				RepairDescription: "Remove duplicate engine entry",
			})
		} else {
			seenPaths[strings.ToLower(cleanPath)] = eng.ID
		}
	}
}

func (s *DiagnosticsService) checkIWADs(ctx context.Context, report *domain.DiagnosticsReport) {
	if s.iwadRepo == nil {
		return
	}

	iwadsList, err := s.iwadRepo.List()
	if err != nil {
		report.Issues = append(report.Issues, domain.DiagnosticIssue{
			ID:          uuid.NewString(),
			Category:    domain.CategoryIWAD,
			Severity:    domain.SeverityError,
			Title:       "Failed to Query IWADs",
			Description: err.Error(),
			CanRepair:   false,
		})
		return
	}

	for _, iwad := range iwadsList {
		cleanPath := filepath.Clean(iwad.Path)
		stat, err := os.Stat(cleanPath)
		if err != nil {
			report.Issues = append(report.Issues, domain.DiagnosticIssue{
				ID:                uuid.NewString(),
				Category:          domain.CategoryIWAD,
				Severity:          domain.SeverityError,
				Title:             fmt.Sprintf("Base IWAD File Missing: %s", iwad.Name),
				Description:       fmt.Sprintf("IWAD file does not exist on disk: %s", iwad.Path),
				TargetID:          iwad.ID,
				TargetPath:        iwad.Path,
				CanRepair:         true,
				RepairAction:      "remove_iwad",
				RepairDescription: "Remove missing IWAD entry from database",
			})
		} else if stat.IsDir() {
			report.Issues = append(report.Issues, domain.DiagnosticIssue{
				ID:                uuid.NewString(),
				Category:          domain.CategoryIWAD,
				Severity:          domain.SeverityError,
				Title:             fmt.Sprintf("IWAD Path is a Directory: %s", iwad.Name),
				Description:       fmt.Sprintf("Path points to a directory, expected a WAD file: %s", iwad.Path),
				TargetID:          iwad.ID,
				TargetPath:        iwad.Path,
				CanRepair:         true,
				RepairAction:      "remove_iwad",
				RepairDescription: "Remove invalid IWAD entry",
			})
		} else if stat.Size() < 12 {
			report.Issues = append(report.Issues, domain.DiagnosticIssue{
				ID:                uuid.NewString(),
				Category:          domain.CategoryIWAD,
				Severity:          domain.SeverityWarning,
				Title:             fmt.Sprintf("Corrupt IWAD Header: %s", iwad.Name),
				Description:       fmt.Sprintf("File size (%d bytes) is too small to contain a valid WAD header.", stat.Size()),
				TargetID:          iwad.ID,
				TargetPath:        iwad.Path,
				CanRepair:         false,
			})
		}
	}
}

func (s *DiagnosticsService) checkLibrary(ctx context.Context, report *domain.DiagnosticsReport) {
	if s.modRepo == nil {
		return
	}

	modsList, err := s.modRepo.List(domain.ModFilter{})
	if err != nil {
		report.Issues = append(report.Issues, domain.DiagnosticIssue{
			ID:          uuid.NewString(),
			Category:    domain.CategoryLibrary,
			Severity:    domain.SeverityError,
			Title:       "Failed to Query Mod Library",
			Description: err.Error(),
			CanRepair:   false,
		})
		return
	}

	seenHashes := make(map[string]string) // sha256 -> modID

	for _, mod := range modsList {
		cleanPath := filepath.Clean(mod.Path)
		stat, err := os.Stat(cleanPath)
		if err != nil {
			report.Issues = append(report.Issues, domain.DiagnosticIssue{
				ID:                uuid.NewString(),
				Category:          domain.CategoryLibrary,
				Severity:          domain.SeverityWarning,
				Title:             fmt.Sprintf("Mod File Missing: %s", mod.Name),
				Description:       fmt.Sprintf("File not found on disk: %s", mod.Path),
				TargetID:          mod.ID,
				TargetPath:        mod.Path,
				CanRepair:         true,
				RepairAction:      "remove_mod",
				RepairDescription: "Remove missing mod entry from library",
			})
		} else if stat.IsDir() {
			report.Issues = append(report.Issues, domain.DiagnosticIssue{
				ID:                uuid.NewString(),
				Category:          domain.CategoryLibrary,
				Severity:          domain.SeverityWarning,
				Title:             fmt.Sprintf("Mod File is Directory: %s", mod.Name),
				Description:       fmt.Sprintf("Path is a directory: %s", mod.Path),
				TargetID:          mod.ID,
				TargetPath:        mod.Path,
				CanRepair:         true,
				RepairAction:      "remove_mod",
				RepairDescription: "Remove invalid mod entry",
			})
		}

		if mod.SHA256 != "" {
			if prevID, duplicate := seenHashes[mod.SHA256]; duplicate && prevID != mod.ID {
				report.Issues = append(report.Issues, domain.DiagnosticIssue{
					ID:                uuid.NewString(),
					Category:          domain.CategoryLibrary,
					Severity:          domain.SeverityInfo,
					Title:             fmt.Sprintf("Duplicate Mod File Hash: %s", mod.Name),
					Description:       fmt.Sprintf("Matches identical SHA-256 hash (%s) of another mod in library.", mod.SHA256[:12]),
					TargetID:          mod.ID,
					TargetPath:        mod.Path,
					CanRepair:         true,
					RepairAction:      "remove_mod",
					RepairDescription: "Remove redundant duplicate mod entry",
				})
			} else {
				seenHashes[mod.SHA256] = mod.ID
			}
		}
	}
}

func (s *DiagnosticsService) checkProfiles(ctx context.Context, report *domain.DiagnosticsReport) {
	if s.profileRepo == nil {
		return
	}

	profilesList, err := s.profileRepo.List()
	if err != nil {
		report.Issues = append(report.Issues, domain.DiagnosticIssue{
			ID:          uuid.NewString(),
			Category:    domain.CategoryProfile,
			Severity:    domain.SeverityError,
			Title:       "Failed to Query Profiles",
			Description: err.Error(),
			CanRepair:   false,
		})
		return
	}

	// Cache valid IDs
	engineMap := make(map[string]bool)
	if s.engineRepo != nil {
		if engs, err := s.engineRepo.List(); err == nil {
			for _, e := range engs {
				engineMap[e.ID] = true
			}
		}
	}

	iwadMap := make(map[string]bool)
	if s.iwadRepo != nil {
		if iwads, err := s.iwadRepo.List(); err == nil {
			for _, w := range iwads {
				iwadMap[w.ID] = true
			}
		}
	}

	modMap := make(map[string]bool)
	if s.modRepo != nil {
		if mods, err := s.modRepo.List(domain.ModFilter{}); err == nil {
			for _, m := range mods {
				modMap[m.ID] = true
			}
		}
	}

	for _, p := range profilesList {
		// Check Engine
		if p.EngineID != "" && !engineMap[p.EngineID] {
			report.Issues = append(report.Issues, domain.DiagnosticIssue{
				ID:          uuid.NewString(),
				Category:    domain.CategoryProfile,
				Severity:    domain.SeverityWarning,
				Title:       fmt.Sprintf("Profile %q References Missing Engine", p.Name),
				Description: fmt.Sprintf("Profile references Engine ID %s which does not exist in database.", p.EngineID),
				TargetID:    p.ID,
				CanRepair:   false,
			})
		}

		// Check IWAD
		if p.IWADID != "" && !iwadMap[p.IWADID] {
			report.Issues = append(report.Issues, domain.DiagnosticIssue{
				ID:          uuid.NewString(),
				Category:    domain.CategoryProfile,
				Severity:    domain.SeverityWarning,
				Title:       fmt.Sprintf("Profile %q References Missing IWAD", p.Name),
				Description: fmt.Sprintf("Profile references IWAD ID %s which does not exist in database.", p.IWADID),
				TargetID:    p.ID,
				CanRepair:   false,
			})
		}

		// Check Orphaned Mods in Profile
		hasOrphan := false
		for _, pm := range p.Mods {
			if !modMap[pm.ModID] {
				hasOrphan = true
				break
			}
		}

		if hasOrphan {
			report.Issues = append(report.Issues, domain.DiagnosticIssue{
				ID:                uuid.NewString(),
				Category:          domain.CategoryProfile,
				Severity:          domain.SeverityWarning,
				Title:             fmt.Sprintf("Profile %q Has Deleted Mods in Load Order", p.Name),
				Description:       "Profile load order contains references to mods that have been deleted from the library.",
				TargetID:          p.ID,
				CanRepair:         true,
				RepairAction:      "clean_profile_orphans",
				RepairDescription: "Strip missing/deleted mod references from load order",
			})
		}
	}
}

// Repair executes the requested recovery action to fix an identified diagnostic issue.
func (s *DiagnosticsService) Repair(ctx context.Context, action string, targetID string) error {
	logger.Infof("executing diagnostic repair: action=%s targetID=%s", action, targetID)

	switch action {
	case "remove_mod":
		if s.modRepo == nil {
			return errors.New("mod repository not configured")
		}
		return s.modRepo.Delete(targetID)

	case "remove_missing_mods":
		if s.modRepo == nil {
			return errors.New("mod repository not configured")
		}
		mods, err := s.modRepo.List(domain.ModFilter{})
		if err != nil {
			return err
		}
		for _, m := range mods {
			if _, err := os.Stat(filepath.Clean(m.Path)); err != nil {
				_ = s.modRepo.Delete(m.ID)
			}
		}
		return nil

	case "remove_engine":
		if s.engineRepo == nil {
			return errors.New("engine repository not configured")
		}
		return s.engineRepo.Delete(targetID)

	case "remove_invalid_engines":
		if s.engineRepo == nil {
			return errors.New("engine repository not configured")
		}
		engs, err := s.engineRepo.List()
		if err != nil {
			return err
		}
		for _, e := range engs {
			if _, err := os.Stat(filepath.Clean(e.Executable)); err != nil {
				_ = s.engineRepo.Delete(e.ID)
			}
		}
		return nil

	case "remove_iwad":
		if s.iwadRepo == nil {
			return errors.New("iwad repository not configured")
		}
		return s.iwadRepo.Delete(targetID)

	case "remove_missing_iwads":
		if s.iwadRepo == nil {
			return errors.New("iwad repository not configured")
		}
		iwads, err := s.iwadRepo.List()
		if err != nil {
			return err
		}
		for _, w := range iwads {
			if _, err := os.Stat(filepath.Clean(w.Path)); err != nil {
				_ = s.iwadRepo.Delete(w.ID)
			}
		}
		return nil

	case "clean_profile_orphans":
		if s.profileRepo == nil || s.modRepo == nil {
			return errors.New("profile or mod repository not configured")
		}

		// If targetID is provided, clean specific profile; otherwise clean all
		profilesToClean := make([]domain.Profile, 0)
		if targetID != "" && targetID != "all" {
			p, err := s.profileRepo.Get(targetID)
			if err != nil {
				return err
			}
			if p != nil {
				profilesToClean = append(profilesToClean, *p)
			}
		} else {
			all, err := s.profileRepo.List()
			if err != nil {
				return err
			}
			profilesToClean = all
		}

		// Build valid mod lookup
		mods, err := s.modRepo.List(domain.ModFilter{})
		if err != nil {
			return err
		}
		validMods := make(map[string]bool, len(mods))
		for _, m := range mods {
			validMods[m.ID] = true
		}

		for _, p := range profilesToClean {
			cleaned := make([]domain.ProfileMod, 0, len(p.Mods))
			changed := false
			for _, pm := range p.Mods {
				if validMods[pm.ModID] {
					pm.Order = len(cleaned)
					cleaned = append(cleaned, pm)
				} else {
					changed = true
				}
			}
			if changed {
				if err := s.profileRepo.SetProfileMods(p.ID, cleaned); err != nil {
					return fmt.Errorf("failed to clean profile %s: %w", p.ID, err)
				}
			}
		}
		return nil

	case "prune_all_missing":
		// Execute all cleanup operations in cascade
		_ = s.Repair(ctx, "remove_missing_mods", "")
		_ = s.Repair(ctx, "remove_missing_iwads", "")
		_ = s.Repair(ctx, "remove_invalid_engines", "")
		_ = s.Repair(ctx, "clean_profile_orphans", "all")
		return nil

	default:
		return fmt.Errorf("unrecognized repair action: %s", action)
	}
}
