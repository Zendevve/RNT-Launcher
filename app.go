package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"rnt-launcher/internal/database"
	"rnt-launcher/internal/diagnostics"
	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/engines"
	"rnt-launcher/internal/filesystem"
	"rnt-launcher/internal/history"
	"rnt-launcher/internal/idgames"
	"rnt-launcher/internal/idgames/seed"
	"rnt-launcher/internal/iwads"
	"rnt-launcher/internal/launcher"
	"rnt-launcher/internal/logger"
	"rnt-launcher/internal/profiles"
	"rnt-launcher/internal/saves"
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
	launcherService    *launcher.LauncherService
	savesService       *saves.SaveService
	scannerService     *scanner.ScannerService
	historyService     *history.HistoryService
	settingsService    *settings.SettingsService
	diagnosticsService *diagnostics.DiagnosticsService
	idgamesClient      *idgames.IdgamesClient
	idgamesRepo        *idgames.CatalogRepository
	idgamesDownloader  *idgames.Downloader
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

	a.savesService = saves.New("")
	a.launcherService = launcher.NewLauncherService(
		a.validatorService,
		a.profileRepo,
		a.historyRepo,
		launcher.NewOSProcessRunner(),
		eventEmitter,
	)
	a.launcherService.SetSaveService(a.savesService)
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
	a.idgamesClient = idgames.NewClient()
	a.idgamesRepo = idgames.NewCatalogRepository(db)
	a.idgamesDownloader = idgames.NewDownloader()

	// Seed /idgames offline catalog in background if empty
	go func() {
		reader, err := seed.OpenCatalogReader()
		if err != nil {
			return
		}
		defer reader.Close()
		_, _ = a.idgamesRepo.SeedIfEmpty(context.Background(), reader)
	}()

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

func (a *App) GetModArtwork(modIdOrPath string) (map[string]any, error) {
	targetPath := modIdOrPath
	if a.modRepo != nil {
		if mod, err := a.modRepo.Get(modIdOrPath); err == nil && mod != nil {
			targetPath = mod.Path
		}
	}
	pngBytes, lumpName, err := filesystem.ExtractArtwork(targetPath)
	if err != nil || len(pngBytes) == 0 {
		return map[string]any{
			"hasArt":   false,
			"lumpName": "",
			"dataUri":  "",
		}, nil
	}
	b64 := base64.StdEncoding.EncodeToString(pngBytes)
	return map[string]any{
		"hasArt":   true,
		"lumpName": lumpName,
		"dataUri":  "data:image/png;base64," + b64,
	}, nil
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
func (a *App) GetModUsageCounts() (map[string]int, error) {
	if a.modRepo == nil {
		return make(map[string]int), nil
	}
	return a.modRepo.GetUsageCounts()
}

// -------------------------------------------------------------
// /idgames API
// -------------------------------------------------------------

func (a *App) SearchIdgames(query string) ([]idgames.IdgamesFile, error) {
	if a.idgamesClient == nil {
		a.idgamesClient = idgames.NewClient()
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return a.idgamesClient.Search(ctx, query)
}

func (a *App) DownloadIdgamesMod(file idgames.IdgamesFile) (*domain.Mod, error) {
	if a.idgamesClient == nil {
		a.idgamesClient = idgames.NewClient()
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var destDir string
	if a.settingsService != nil {
		s, err := a.settingsService.Get(ctx)
		if err == nil && len(s.ModDirectories) > 0 {
			destDir = s.ModDirectories[0]
		}
	}
	if destDir == "" {
		configDir, err := os.UserConfigDir()
		if err == nil {
			destDir = filepath.Join(configDir, "rnt-launcher", "mods")
		} else {
			destDir = "mods"
		}
	}
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create mod directory: %w", err)
	}

	extractedPath, err := a.idgamesClient.Download(ctx, file, destDir)
	if err != nil {
		return nil, fmt.Errorf("failed to download from /idgames: %w", err)
	}

	if a.scannerService == nil {
		return nil, errors.New("scanner service is not initialized")
	}

	mod, err := a.scannerService.ImportFile(ctx, extractedPath)

	if err != nil {
		return nil, fmt.Errorf("downloaded but failed to import mod: %w", err)
	}

	return mod, nil
}

// SearchIdgamesCatalog queries the offline SQLite catalog with FTS5 full-text
// search. It never touches the network.
func (a *App) SearchIdgamesCatalog(opts idgames.SearchOptions) ([]idgames.CatalogItem, error) {
	if a.idgamesRepo == nil {
		a.idgamesRepo = idgames.NewCatalogRepository(a.db)
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	items, err := a.idgamesRepo.Search(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("searching idgames catalog: %w", err)
	}
	if items == nil {
		return []idgames.CatalogItem{}, nil
	}
	return items, nil
}

// GetIdgamesCuratedShowcase returns curated, top rated, and recent catalog sets
// for the zero-state mod store view.
func (a *App) GetIdgamesCuratedShowcase() (idgames.ShowcaseResult, error) {
	if a.idgamesRepo == nil {
		a.idgamesRepo = idgames.NewCatalogRepository(a.db)
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	result, err := a.idgamesRepo.GetShowcase(ctx)
	if err != nil {
		return idgames.ShowcaseResult{}, fmt.Errorf("fetching idgames showcase: %w", err)
	}
	if result == nil {
		return idgames.ShowcaseResult{}, nil
	}
	return *result, nil
}

// SyncIdgamesHighWatermark fetches catalog entries newer than the local maximum
// ID and inserts the difference. It returns the number of newly inserted rows.
// When the remote archive is unreachable, it returns the current maximum ID
// with a nil error so offline startups stay quiet.
func (a *App) SyncIdgamesHighWatermark() (int, error) {
	if a.idgamesRepo == nil {
		a.idgamesRepo = idgames.NewCatalogRepository(a.db)
	}
	if a.idgamesClient == nil {
		a.idgamesClient = idgames.NewClient()
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	maxID, err := a.idgamesRepo.GetMaxID(ctx)
	if err != nil {
		return 0, fmt.Errorf("querying idgames high watermark: %w", err)
	}
	fresh, err := a.fetchIdgamesNewer(ctx, maxID)
	if err != nil {
		return maxID, nil
	}
	if len(fresh) == 0 {
		return 0, nil
	}
	inserted, err := a.idgamesRepo.InsertItems(ctx, fresh)
	if err != nil {
		return 0, fmt.Errorf("inserting synced idgames items: %w", err)
	}
	return inserted, nil
}

// maxIdgamesSyncProbe caps how many new archive IDs a single watermark sync pulls.
const maxIdgamesSyncProbe = 50

// errIdgamesFileNotFound marks a remote lookup for an archive ID that does not
// exist yet, which terminates a watermark sync without failing it.
var errIdgamesFileNotFound = errors.New("idgames file not found")

// fetchIdgamesNewer probes sequential archive IDs above maxID via the remote
// API, stopping at the first unknown ID. Transport failures surface as errors
// only when nothing was collected; a partial batch ends the probe quietly.
func (a *App) fetchIdgamesNewer(ctx context.Context, maxID int) ([]idgames.CatalogItem, error) {
	var fresh []idgames.CatalogItem
	for id := maxID + 1; len(fresh) < maxIdgamesSyncProbe; id++ {
		file, err := a.fetchIdgamesFileByID(ctx, id)
		if err != nil {
			if errors.Is(err, errIdgamesFileNotFound) {
				break
			}
			if len(fresh) == 0 {
				return nil, err
			}
			break
		}
		fresh = append(fresh, idgames.CatalogItem{
			ID:          file.ID,
			Title:       file.Title,
			Dir:         file.Dir,
			Filename:    file.Filename,
			Size:        file.Size,
			Age:         file.Age,
			Date:        file.Date,
			Author:      file.Author,
			Description: file.Description,
			Rating:      file.Rating,
			Votes:       file.Votes,
			URL:         file.URL,
		})
	}
	return fresh, nil
}

// idgamesGetResponse mirrors the Doomworld archive get-action payload.
type idgamesGetResponse struct {
	Content *idgamesGetContent `json:"content"`
	Error   *idgamesGetError   `json:"error"`
}

type idgamesGetContent struct {
	File  json.RawMessage  `json:"file"`
	Error *idgamesGetError `json:"error"`
}

type idgamesGetError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

type idgamesGetFile struct {
	ID          any `json:"id"`
	Title       any `json:"title"`
	Dir         any `json:"dir"`
	Filename    any `json:"filename"`
	Size        any `json:"size"`
	Age         any `json:"age"`
	Date        any `json:"date"`
	Author      any `json:"author"`
	Description any `json:"description"`
	Rating      any `json:"rating"`
	Votes       any `json:"votes"`
	URL         any `json:"url"`
}

// fetchIdgamesFileByID retrieves a single archive record through the client's
// configured API endpoint, so tests can point it at a stub server.
func (a *App) fetchIdgamesFileByID(ctx context.Context, id int) (*idgames.IdgamesFile, error) {
	baseURL := idgames.DefaultBaseURL
	httpClient := http.DefaultClient
	if a.idgamesClient != nil {
		if a.idgamesClient.BaseURL != "" {
			baseURL = a.idgamesClient.BaseURL
		}
		if a.idgamesClient.HTTPClient != nil {
			httpClient = a.idgamesClient.HTTPClient
		}
	}

	reqURL, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid idgames base URL %q: %w", baseURL, err)
	}
	q := reqURL.Query()
	q.Set("action", "get")
	q.Set("id", strconv.Itoa(id))
	q.Set("out", "json")
	reqURL.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create idgames get request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 RNT-Launcher/1.0")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Referer", "https://www.doomworld.com/idgames/")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("idgames get request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("idgames get returned HTTP %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read idgames get response: %w", err)
	}

	var payload idgamesGetResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("failed to parse idgames get response: %w", err)
	}
	if payload.Error != nil && payload.Error.Message != "" {
		if isIdgamesMissing(payload.Error.Message) {
			return nil, errIdgamesFileNotFound
		}
		return nil, fmt.Errorf("idgames API error: %s (%s)", payload.Error.Message, payload.Error.Type)
	}
	if payload.Content == nil {
		return nil, errIdgamesFileNotFound
	}
	if payload.Content.Error != nil && payload.Content.Error.Message != "" {
		if isIdgamesMissing(payload.Content.Error.Message) {
			return nil, errIdgamesFileNotFound
		}
		return nil, fmt.Errorf("idgames API error: %s (%s)", payload.Content.Error.Message, payload.Content.Error.Type)
	}
	trimmed := strings.TrimSpace(string(payload.Content.File))
	if trimmed == "" || trimmed == "null" {
		return nil, errIdgamesFileNotFound
	}
	var raw idgamesGetFile
	if err := json.Unmarshal(payload.Content.File, &raw); err != nil {
		return nil, fmt.Errorf("failed to decode idgames file: %w", err)
	}

	file := &idgames.IdgamesFile{
		ID:          idgamesAnyInt(raw.ID),
		Title:       idgamesAnyString(raw.Title),
		Dir:         idgamesAnyString(raw.Dir),
		Filename:    idgamesAnyString(raw.Filename),
		Size:        idgamesAnyInt64(raw.Size),
		Age:         idgamesAnyInt64(raw.Age),
		Date:        idgamesAnyString(raw.Date),
		Author:      idgamesAnyString(raw.Author),
		Description: idgamesAnyString(raw.Description),
		Rating:      idgamesAnyFloat64(raw.Rating),
		Votes:       idgamesAnyInt(raw.Votes),
		URL:         idgamesAnyString(raw.URL),
	}
	if file.ID == 0 {
		file.ID = id
	}
	if file.URL == "" && file.Dir != "" && file.Filename != "" {
		cleanDir := strings.Trim(filepath.ToSlash(file.Dir), "/")
		file.URL = fmt.Sprintf("https://www.doomworld.com/idgames/%s/%s", cleanDir, strings.TrimSuffix(file.Filename, filepath.Ext(file.Filename)))
	}
	return file, nil
}

func isIdgamesMissing(msg string) bool {
	lower := strings.ToLower(msg)
	return strings.Contains(lower, "no file") ||
		strings.Contains(lower, "not found") ||
		strings.Contains(lower, "no result") ||
		strings.Contains(lower, "zero result")
}

func idgamesAnyString(v any) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case bool:
		if t {
			return "1"
		}
		return "0"
	case float64:
		if t == float64(int64(t)) {
			return strconv.FormatInt(int64(t), 10)
		}
		return strconv.FormatFloat(t, 'f', -1, 64)
	case json.Number:
		return t.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}

func idgamesAnyInt(v any) int {
	return int(idgamesAnyInt64(v))
}

func idgamesAnyInt64(v any) int64 {
	switch t := v.(type) {
	case nil:
		return 0
	case float64:
		return int64(t)
	case string:
		n, err := strconv.ParseInt(strings.TrimSpace(t), 10, 64)
		if err == nil {
			return n
		}
		if f, err := strconv.ParseFloat(strings.TrimSpace(t), 64); err == nil {
			return int64(f)
		}
		return 0
	case bool:
		if t {
			return 1
		}
		return 0
	case json.Number:
		if n, err := t.Int64(); err == nil {
			return n
		}
		return 0
	default:
		return 0
	}
}

func idgamesAnyFloat64(v any) float64 {
	switch t := v.(type) {
	case nil:
		return 0
	case float64:
		return t
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(t), 64)
		if err == nil {
			return f
		}
		return 0
	case bool:
		if t {
			return 1
		}
		return 0
	case json.Number:
		if f, err := t.Float64(); err == nil {
			return f
		}
		return 0
	default:
		return 0
	}
}

// DownloadIdgamesArchive downloads a cataloged archive through the resilient
// CDN downloader and ingests it into the mod library, forwarding progress to
// the frontend via the idgames:download:progress event.
func (a *App) DownloadIdgamesArchive(id int) (*domain.Mod, error) {
	if a.idgamesRepo == nil {
		a.idgamesRepo = idgames.NewCatalogRepository(a.db)
	}
	if a.idgamesDownloader == nil {
		a.idgamesDownloader = idgames.NewDownloader()
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	item, err := a.idgamesRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("resolving idgames archive %d: %w", id, err)
	}

	var destDir string
	if a.settingsService != nil {
		s, err := a.settingsService.Get(ctx)
		if err == nil && len(s.ModDirectories) > 0 {
			destDir = s.ModDirectories[0]
		}
	}
	if destDir == "" {
		configDir, err := os.UserConfigDir()
		if err == nil {
			destDir = filepath.Join(configDir, "rnt-launcher", "mods")
		} else {
			destDir = "mods"
		}
	}
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create mod directory: %w", err)
	}

	if a.scannerService == nil {
		return nil, errors.New("scanner service is not initialized")
	}

	mod, err := a.idgamesDownloader.DownloadAndIngest(ctx, *item, destDir, a.scannerService, func(p idgames.DownloadProgress) {
		a.emitSafe("idgames:download:progress", p)
	})
	if err != nil {
		return nil, fmt.Errorf("downloading idgames archive %d: %w", id, err)
	}

	return mod, nil
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
func (a *App) InspectIWADFile(path string) (*domain.IWAD, error) {
	return a.iwadService.InspectFile(a.ctx, path)
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

func (a *App) ImportProfileZDL(zdlContent string) (map[string]any, error) {
	prof, warnings, err := a.profileService.ImportZDL(a.ctx, []byte(zdlContent))
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"profile":  prof,
		"warnings": warnings,
	}, nil
}

func (a *App) OpenProfileSaveFolder(profileID string) error {
	if a.savesService == nil {
		return fmt.Errorf("saves service is not initialized")
	}
	dir, err := a.savesService.EnsureProfileSaveDir(profileID)
	if err != nil {
		return err
	}
	return a.OpenPathInExplorer(dir)
}

func (a *App) GetProfileSaveDir(profileID string) (string, error) {
	if a.savesService == nil {
		return "", fmt.Errorf("saves service is not initialized")
	}
	return a.savesService.EnsureProfileSaveDir(profileID)
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
