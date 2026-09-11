package main

import (
	"context"
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/launcher"
	"rnt-launcher/internal/saves"
	"rnt-launcher/internal/validator"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Headless launch mode (no window): `rnt-launcher --launch
	// <profileNameOrID>` or `rnt-launcher rnt://launch/<id>` starts a
	// profile through the same launcher path the GUI uses and exits with
	// the engine's exit code. Used by desktop shortcuts.
	if target, ok := parseLaunchTarget(os.Args[1:]); ok {
		os.Exit(runHeadlessLaunch(target))
	}

	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "RNT Launcher",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 9, G: 9, B: 11, A: 255},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

// parseLaunchTarget extracts a headless launch target from CLI args. It
// accepts `--launch <profileNameOrID>`, `--launch=<profileNameOrID>`, and
// the `rnt://launch/<id>` deeplink form. The second return value reports
// whether headless mode was requested at all.
func parseLaunchTarget(args []string) (string, bool) {
	for i, arg := range args {
		if arg == "--launch" {
			if i+1 < len(args) {
				return strings.TrimSpace(args[i+1]), true
			}
			return "", true
		}
		if strings.HasPrefix(arg, "--launch=") {
			return strings.TrimSpace(strings.TrimPrefix(arg, "--launch=")), true
		}
		if strings.HasPrefix(arg, "rnt://launch/") {
			return strings.Trim(strings.TrimPrefix(arg, "rnt://launch/"), "/"), true
		}
	}
	return "", false
}

// runHeadlessLaunch initializes the database and launcher services exactly
// like the GUI startup path (without a window), launches the resolved
// profile, waits for the engine process to exit, prints the result, and
// returns the engine's exit code as the process exit code.
func runHeadlessLaunch(target string) int {
	if strings.TrimSpace(target) == "" {
		fmt.Fprintln(os.Stderr, "error: missing profile name or ID (usage: rnt-launcher --launch <profileNameOrID>)")
		return 2
	}

	// Same database location as the GUI startup path in app.startup.
	var dbPath string
	if configDir, err := os.UserConfigDir(); err == nil {
		appDir := filepath.Join(configDir, "rnt-launcher")
		_ = os.MkdirAll(appDir, 0755)
		dbPath = filepath.Join(appDir, "rnt-launcher.db")
	} else {
		dbPath = "rnt-launcher.db"
	}

	db, err := database.InitDB(dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: failed to open database at %s: %v\n", dbPath, err)
		return 1
	}
	defer db.Close()

	engineRepo := database.NewEngineRepository(db)
	iwadRepo := database.NewIWADRepository(db)
	modRepo := database.NewModRepository(db)
	profileRepo := database.NewProfileRepository(db)
	historyRepo := database.NewHistoryRepository(db)

	validatorService := validator.NewValidatorService(profileRepo, engineRepo, iwadRepo, modRepo)
	savesService := saves.New("")
	launcherService := launcher.NewLauncherService(
		validatorService,
		profileRepo,
		historyRepo,
		launcher.NewOSProcessRunner(),
		func(eventName string, data any) {},
	)
	launcherService.SetSaveService(savesService)

	profile, err := resolveHeadlessProfile(profileRepo, target)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return 1
	}

	record, err := launcherService.LaunchProfile(context.Background(), profile.ID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: failed to launch profile %q: %v\n", profile.Name, err)
		return 1
	}
	launchID := record.ID
	if active, ok := launcherService.GetActiveLaunch(launchID); ok {
		fmt.Printf("Launched profile %q (pid %d): %s\n", profile.Name, active.GetPid(), record.CommandLine)
	} else {
		fmt.Printf("Launched profile %q: %s\n", profile.Name, record.CommandLine)
	}

	// Wait until the engine process exits (monitorProcess unregisters it).
	for {
		if _, ok := launcherService.GetActiveLaunch(launchID); !ok {
			break
		}
		time.Sleep(500 * time.Millisecond)
	}

	// The monitor persists the final record under the same launch ID.
	if records, err := historyRepo.List(100); err == nil {
		for i := range records {
			if records[i].ID == launchID {
				fmt.Printf("Profile %q exited with code %d\n", profile.Name, records[i].ExitCode)
				return records[i].ExitCode
			}
		}
	}
	fmt.Printf("Launch %s finished (final record unavailable)\n", launchID)
	return 0
}

// resolveHeadlessProfile resolves a profile by ID first, then by
// case-insensitive name match.
func resolveHeadlessProfile(repo database.ProfileRepository, target string) (*domain.Profile, error) {
	target = strings.TrimSpace(target)
	if p, err := repo.Get(target); err == nil && p != nil {
		return p, nil
	}
	list, err := repo.List()
	if err != nil {
		return nil, fmt.Errorf("profile %q not found: %w", target, err)
	}
	for i := range list {
		if strings.EqualFold(list[i].Name, target) {
			p := list[i]
			return &p, nil
		}
	}
	return nil, fmt.Errorf("profile %q not found", target)
}
