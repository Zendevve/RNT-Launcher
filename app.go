package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/diagnostics"
	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/engines"
	"rnt-launcher/internal/filesystem"
	"rnt-launcher/internal/history"
	"rnt-launcher/internal/iwads"
	"rnt-launcher/internal/launcher"
	"rnt-launcher/internal/logger"
	"rnt-launcher/internal/profiles"
	"rnt-launcher/internal/scanner"
	"rnt-launcher/internal/settings"
	"rnt-launcher/internal/validator"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct manages application state and exposes bridge API to frontend
type App struct {
	ctx              context.Context
	db               *sql.DB
	dbPath           string
	emitter          func(eventName string, data any)
	engineRepo       database.EngineRepository
	iwadRepo         database.IWADRepository
	modRepo          database.ModRepository
	profileRepo      database.ProfileRepository
	historyRepo      database.HistoryRepository
	settingsRepo     database.SettingsRepository
	engineService    *engines.EngineService
	iwadService      *iwads.IWADService
	profileService   *profiles.ProfileService
	validatorService *validator.ValidatorService
	launcherService  *launcher.LauncherService
	scannerService   *scanner.ScannerService
	historyService     *history.HistoryService
	settingsService    *settings.SettingsService
	diagnosticsService *diagnostics.DiagnosticsService
	isScanning         bool
	scanMu             sync.Mutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		emitter: func(eventName string, data any) {},
	}
}

// Close releases open resources such as active engine processes and SQLite DB handle
func (a *App) Close() {
	if a.launcherService != nil {
		_ = a.launcherService.KillAll()
	}
	if a.db != nil {
		_ = a.db.Close()
		a.db = nil
	}
}

// SetDBPath sets custom database path (useful for testing or custom configs)
func (a *App) SetDBPath(path string) {
	a.dbPath = path
}

// SetEventEmitter configures custom event emitter (useful for testing)
func (a *App) SetEventEmitter(emitter func(eventName string, data any)) {
	if emitter != nil {
		a.emitter = emitter
	}
}

func (a *App) emitSafe(eventName string, data any) {
	if a.emitter != nil {
		a.emitter(eventName, data)
	}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// If emitter was not overridden by test, use wails runtime
	if a.emitter == nil {
		a.emitter = func(eventName string, data any) {
			if a.ctx != nil {
				wailsRuntime.EventsEmit(a.ctx, eventName, data)
			}
		}
	}

	if a.dbPath == "" {
		configDir, err := os.UserConfigDir()
		if err == nil {
			appDir := filepath.Join(configDir, "rnt-launcher")
			_ = os.MkdirAll(appDir, 0755)
			a.dbPath = filepath.Join(appDir, "rnt-launcher.db")
		} else {
			a.dbPath = "rnt-launcher.db"
		}
	}

	db, err := database.InitDB(a.dbPath)
	if err != nil {
		fmt.Printf("Error initializing database at %s: %v\n", a.dbPath, err)
		return
	}
	a.db = db

	a.engineRepo = database.NewEngineRepository(db)
	a.iwadRepo = database.NewIWADRepository(db)
	a.modRepo = database.NewModRepository(db)
	a.profileRepo = database.NewProfileRepository(db)
	a.historyRepo = database.NewHistoryRepository(db)
	a.settingsRepo = database.NewSettingsRepository(db)

	a.engineService = engines.NewEngineService(a.engineRepo)
	a.iwadService = iwads.NewIWADService(a.iwadRepo)
	a.profileService = profiles.NewProfileService(a.profileRepo, a.modRepo, a.iwadRepo, a.engineRepo)
	a.validatorService = validator.NewValidatorService(a.profileRepo, a.engineRepo, a.iwadRepo, a.modRepo)

	eventEmitter := func(eventName string, data any) {
		a.emitSafe(eventName, data)
	}

	a.launcherService = launcher.NewLauncherService(
		a.validatorService,
		a.profileRepo,
		a.historyRepo,
		launcher.NewOSProcessRunner(),
		eventEmitter,
	)

	a.scannerService = scanner.NewScannerService(
		a.modRepo,
		a.iwadRepo,
		a.engineRepo,
		a.settingsRepo,
	)

	a.historyService = history.NewHistoryService(a.historyRepo)
	a.settingsService = settings.NewSettingsService(a.settingsRepo)
	a.diagnosticsService = diagnostics.NewDiagnosticsService(
		a.db,
		a.engineRepo,
		a.iwadRepo,
		a.modRepo,
		a.profileRepo,
		a.historyRepo,
		a.dbPath,
	)

	// Check if AutoScanOnStartup is enabled
	go func() {
		s, err := a.settingsService.Get(context.Background())
		if err == nil && s.AutoScanOnStartup {
			_, _ = a.StartScan()
		}
	}()
}

// -------------------------------------------------------------
// Mods API
// -------------------------------------------------------------

func (a *App) ListMods(filter domain.ModFilter) ([]domain.Mod, error) {
	return a.modRepo.List(filter)
}

func (a *App) GetMod(id string) (*domain.Mod, error) {
	return a.modRepo.Get(id)
}

func (a *App) InspectMod(id string) (*filesystem.FileInfo, error) {
	mod, err := a.modRepo.Get(id)
	if err != nil {
		return nil, err
	}
	return filesystem.InspectFile(mod.Path)
}

func (a *App) ToggleModFavorite(id string) (bool, error) {
	return a.modRepo.ToggleFavorite(id)
}

func (a *App) DeleteMod(id string) error {
	return a.modRepo.Delete(id)
}

func (a *App) ImportModFile(path string) (*domain.Mod, error) {
	return a.scannerService.ImportFile(a.ctx, path)
}

// -------------------------------------------------------------
// IWADs API
// -------------------------------------------------------------

func (a *App) ListIWADs() ([]domain.IWAD, error) {
	return a.iwadService.List(a.ctx)
}

func (a *App) GetIWAD(id string) (*domain.IWAD, error) {
	return a.iwadService.Get(a.ctx, id)
}

func (a *App) RegisterIWADFile(path string) (*domain.IWAD, error) {
	return a.iwadService.RegisterFile(a.ctx, path)
}

func (a *App) AddIWAD(iwad domain.IWAD) (*domain.IWAD, error) {
	return a.iwadService.Add(a.ctx, iwad)
}

func (a *App) UpdateIWAD(iwad domain.IWAD) error {
	return a.iwadService.Update(a.ctx, iwad)
}

func (a *App) DeleteIWAD(id string) error {
	return a.iwadService.Delete(a.ctx, id)
}

// -------------------------------------------------------------
// Engines API
// -------------------------------------------------------------

func (a *App) ListEngines() ([]domain.Engine, error) {
	return a.engineService.List(a.ctx)
}

func (a *App) GetEngine(id string) (*domain.Engine, error) {
	return a.engineService.Get(a.ctx, id)
}

func (a *App) AddEngine(engine domain.Engine) (*domain.Engine, error) {
	return a.engineService.Add(a.ctx, engine)
}

func (a *App) UpdateEngine(engine domain.Engine) error {
	return a.engineService.Update(a.ctx, engine)
}

func (a *App) DeleteEngine(id string) error {
	return a.engineService.Delete(a.ctx, id)
}

func (a *App) DetectEngineVersion(execPath string) (map[string]string, error) {
	ver, family := a.engineService.DetectVersion(a.ctx, execPath)
	return map[string]string{
		"version": ver,
		"family":  string(family),
	}, nil
}

func (a *App) ValidateEngineExecutable(execPath string) error {
	return a.engineService.ValidateExecutable(execPath)
}

// -------------------------------------------------------------
// Profiles API
// -------------------------------------------------------------

func (a *App) ListProfiles() ([]domain.Profile, error) {
	return a.profileService.List(a.ctx)
}

func (a *App) GetProfile(id string) (*domain.Profile, error) {
	return a.profileService.Get(a.ctx, id)
}

func (a *App) CreateProfile(p domain.Profile) (*domain.Profile, error) {
	return a.profileService.Create(a.ctx, p)
}

func (a *App) UpdateProfile(p domain.Profile) error {
	return a.profileService.Update(a.ctx, p)
}

func (a *App) DeleteProfile(id string) error {
	return a.profileService.Delete(a.ctx, id)
}

func (a *App) DuplicateProfile(id string, newName string) (*domain.Profile, error) {
	return a.profileService.Duplicate(a.ctx, id, newName)
}

func (a *App) ToggleProfileFavorite(id string) error {
	return a.profileService.ToggleFavorite(a.ctx, id)
}

func (a *App) AddModToProfile(profileID string, modID string) error {
	return a.profileService.AddMod(a.ctx, profileID, modID)
}

func (a *App) RemoveModFromProfile(profileID string, modID string) error {
	return a.profileService.RemoveMod(a.ctx, profileID, modID)
}

func (a *App) ReorderProfileMods(profileID string, modIDsInOrder []string) error {
	return a.profileService.ReorderMods(a.ctx, profileID, modIDsInOrder)
}

func (a *App) ToggleProfileMod(profileID string, modID string, enabled bool) error {
	return a.profileService.ToggleMod(a.ctx, profileID, modID, enabled)
}

func (a *App) ExportProfileYAML(profileID string) (string, error) {
	data, err := a.profileService.ExportYAML(a.ctx, profileID)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (a *App) ImportProfileYAML(yamlContent string) (map[string]any, error) {
	prof, warnings, err := a.profileService.ImportYAML(a.ctx, []byte(yamlContent))
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"profile":  prof,
		"warnings": warnings,
	}, nil
}

// -------------------------------------------------------------
// Validator & Launcher API
// -------------------------------------------------------------

func (a *App) ValidateProfile(profileID string) (*domain.ValidationResult, error) {
	return a.validatorService.ValidateProfile(a.ctx, profileID)
}

func (a *App) LaunchProfile(profileID string) (*domain.LaunchRecord, error) {
	return a.launcherService.LaunchProfile(a.ctx, profileID)
}

func (a *App) GetActiveLaunches() []*launcher.ActiveLaunch {
	return a.launcherService.GetActiveLaunches()
}

func (a *App) KillLaunch(id string) error {
	return a.launcherService.KillLaunch(id)
}

// -------------------------------------------------------------
// Scanner API
// -------------------------------------------------------------

func (a *App) StartScan() (scanRes *domain.ScanResult, scanErr error) {
	a.scanMu.Lock()
	if a.isScanning {
		a.scanMu.Unlock()
		return nil, fmt.Errorf("scan is already in progress")
	}
	a.isScanning = true
	a.scanMu.Unlock()

	defer func() {
		if r := recover(); r != nil {
			scanRes = &domain.ScanResult{
				DiscoveredMods:    0,
				DiscoveredIWADs:   0,
				DiscoveredEngines: 0,
				Errors:            []string{fmt.Sprintf("internal scan panic: %v", r)},
			}
			scanErr = fmt.Errorf("scan panic: %v", r)
			a.emitSafe("scan:complete", scanRes)
		}
		a.scanMu.Lock()
		a.isScanning = false
		a.scanMu.Unlock()
	}()

	a.emitSafe("scan:start", nil)

	progressCallback := func(current int, total int, currentFile string) {
		a.emitSafe("scan:progress", map[string]any{
			"current":     current,
			"total":       total,
			"currentFile": currentFile,
		})
	}

	res, err := a.scannerService.ScanAll(a.ctx, progressCallback)
	a.emitSafe("scan:complete", res)

	return res, err
}

func (a *App) IsScanning() bool {
	a.scanMu.Lock()
	defer a.scanMu.Unlock()
	return a.isScanning
}

// -------------------------------------------------------------
// History & Settings API
// -------------------------------------------------------------

func (a *App) ListLaunchHistory(limit int) ([]domain.LaunchRecord, error) {
	return a.historyService.List(a.ctx, limit)
}

func (a *App) GetHistoryStats() (*domain.HistoryStats, error) {
	return a.historyService.GetStats(a.ctx)
}

func (a *App) ClearLaunchHistory() error {
	return a.historyService.Clear(a.ctx)
}

func (a *App) GetSettings() (*domain.Settings, error) {
	return a.settingsService.Get(a.ctx)
}

func (a *App) UpdateSettings(s domain.Settings) error {
	return a.settingsService.Update(a.ctx, s)
}

// -------------------------------------------------------------
// Native Dialog & System Helpers
// -------------------------------------------------------------

func (a *App) OpenFileDialog(title string, defaultDir string, extensions []string) (string, error) {
	if a.ctx == nil {
		return "", fmt.Errorf("context not initialized")
	}

	filters := []wailsRuntime.FileFilter{}
	if len(extensions) > 0 {
		pattern := ""
		for i, ext := range extensions {
			if i > 0 {
				pattern += ";"
			}
			pattern += "*." + ext
		}
		filters = append(filters, wailsRuntime.FileFilter{
			DisplayName: "Doom Files (" + pattern + ")",
			Pattern:     pattern,
		})
	}
	filters = append(filters, wailsRuntime.FileFilter{
		DisplayName: "All Files (*.*)",
		Pattern:     "*.*",
	})

	return wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title:            title,
		DefaultDirectory: defaultDir,
		Filters:          filters,
	})
}

func (a *App) OpenDirectoryDialog(title string, defaultDir string) (string, error) {
	if a.ctx == nil {
		return "", fmt.Errorf("context not initialized")
	}
	return wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title:            title,
		DefaultDirectory: defaultDir,
	})
}

func (a *App) OpenPathInExplorer(path string) error {
	if path == "" {
		return fmt.Errorf("empty path")
	}

	fi, err := os.Stat(path)
	if err != nil {
		return err
	}

	targetDir := path
	if !fi.IsDir() {
		targetDir = filepath.Dir(path)
	}

	switch runtime.GOOS {
	case "windows":
		if !fi.IsDir() {
			return exec.Command("explorer", "/select,", filepath.Clean(path)).Start()
		}
		return exec.Command("explorer", filepath.Clean(targetDir)).Start()
	case "darwin":
		if !fi.IsDir() {
			return exec.Command("open", "-R", path).Start()
		}
		return exec.Command("open", targetDir).Start()
	default:
		return exec.Command("xdg-open", targetDir).Start()
	}
}

// -------------------------------------------------------------
// System Diagnostics & Health API
// -------------------------------------------------------------

func (a *App) RunDiagnostics() (*domain.DiagnosticsReport, error) {
	if a.diagnosticsService == nil {
		return nil, fmt.Errorf("diagnostics service is not initialized")
	}
	return a.diagnosticsService.RunDiagnostics(a.ctx)
}

func (a *App) RepairDiagnosticIssue(action string, targetID string) error {
	if a.diagnosticsService == nil {
		return fmt.Errorf("diagnostics service is not initialized")
	}
	return a.diagnosticsService.Repair(a.ctx, action, targetID)
}

func (a *App) GetSystemLogs() ([]logger.LogEntry, error) {
	return logger.GetRecentLogs(), nil
}

func (a *App) ClearSystemLogs() error {
	logger.ClearLogs()
	return nil
}
