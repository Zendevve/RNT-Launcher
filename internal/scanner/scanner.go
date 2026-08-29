package scanner

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/google/uuid"
	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/filesystem"
	"rnt-launcher/internal/logger"
)

var versionRegex = regexp.MustCompile(`(?i)(?:version\s*|v|\bg|woof!\s*|doom\s*)?(\d+\.\d+(?:\.\d+)*(?:-[a-zA-Z0-9_.-]+)?)`)

// ScannerService orchestrates filesystem discovery of Mods, IWADs, and Engines.
type ScannerService struct {
	modRepo      database.ModRepository
	iwadRepo     database.IWADRepository
	engineRepo   database.EngineRepository
	settingsRepo database.SettingsRepository
}

// NewScannerService creates a new initialized ScannerService instance.
func NewScannerService(
	modRepo database.ModRepository,
	iwadRepo database.IWADRepository,
	engineRepo database.EngineRepository,
	settingsRepo database.SettingsRepository,
) *ScannerService {
	return &ScannerService{
		modRepo:      modRepo,
		iwadRepo:     iwadRepo,
		engineRepo:   engineRepo,
		settingsRepo: settingsRepo,
	}
}

// ScanAll reads configured directories from SettingsRepository and executes ScanDirectories.
func (s *ScannerService) ScanAll(ctx context.Context, progressFn func(current int, total int, currentFile string)) (*domain.ScanResult, error) {
	if s.settingsRepo == nil {
		return nil, errors.New("settings repository is not configured")
	}

	settings, err := s.settingsRepo.GetSettings()
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve scan settings: %w", err)
	}

	return s.ScanDirectories(ctx, settings.ModDirectories, settings.IWADDirectories, settings.EngineDirectories, progressFn)
}

// ScanDirectories performs a full scan across provided Mod, IWAD, and Engine directories.
func (s *ScannerService) ScanDirectories(ctx context.Context, modDirs, iwadDirs, engineDirs []string, progressFn func(current int, total int, currentFile string)) (res *domain.ScanResult, retErr error) {
	if ctx != nil && ctx.Err() != nil {
		return nil, ctx.Err()
	}

	result := &domain.ScanResult{
		DiscoveredIWADs:   0,
		DiscoveredEngines: 0,
		Errors:            make([]string, 0),
	}

	defer func() {
		if r := recover(); r != nil {
			logger.Errorf("scanner panic recovered: %v", r)
			result.Errors = append(result.Errors, fmt.Sprintf("scanner panic recovered: %v", r))
			res = result
			retErr = fmt.Errorf("scanner panic: %v", r)
		}
	}()
	// 1. Scan IWAD Directories
	for _, dir := range iwadDirs {
		select {
		case <-ctx.Done():
			return result, ctx.Err()
		default:
		}

		cleanDir := filepath.Clean(dir)
		if cleanDir == "" || cleanDir == "." {
			continue
		}

		if stat, err := os.Stat(cleanDir); err != nil || !stat.IsDir() {
			result.Errors = append(result.Errors, fmt.Sprintf("IWAD directory invalid or not found: %s", cleanDir))
			continue
		}

		count, err := s.ScanIWADDirectory(ctx, cleanDir)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("error scanning IWAD dir %s: %v", cleanDir, err))
		}
		result.DiscoveredIWADs += count
	}

	// 2. Scan Engine Directories
	for _, dir := range engineDirs {
		select {
		case <-ctx.Done():
			return result, ctx.Err()
		default:
		}

		cleanDir := filepath.Clean(dir)
		if cleanDir == "" || cleanDir == "." {
			continue
		}

		if stat, err := os.Stat(cleanDir); err != nil || !stat.IsDir() {
			result.Errors = append(result.Errors, fmt.Sprintf("Engine directory invalid or not found: %s", cleanDir))
			continue
		}

		count, err := s.ScanEngineDirectory(ctx, cleanDir)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("error scanning Engine dir %s: %v", cleanDir, err))
		}
		result.DiscoveredEngines += count
	}

	// 3. Scan Mod Directories with unified progress reporting
	// First collect all candidate mod files to calculate accurate total progress
	var allModFiles []string
	validModDirs := make([]string, 0, len(modDirs))

	for _, dir := range modDirs {
		cleanDir := filepath.Clean(dir)
		if cleanDir == "" || cleanDir == "." {
			continue
		}

		if stat, err := os.Stat(cleanDir); err != nil || !stat.IsDir() {
			result.Errors = append(result.Errors, fmt.Sprintf("Mod directory invalid or not found: %s", cleanDir))
			continue
		}

		validModDirs = append(validModDirs, cleanDir)
		candidates := s.collectModFiles(ctx, cleanDir)
		allModFiles = append(allModFiles, candidates...)
	}

	totalModFiles := len(allModFiles)
	currentModIdx := 0

	for _, filePath := range allModFiles {
		select {
		case <-ctx.Done():
			return result, ctx.Err()
		default:
		}

		currentModIdx++
		if progressFn != nil {
			progressFn(currentModIdx, totalModFiles, filePath)
		}

		isIwad, err := s.processModFile(ctx, filePath)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("failed to process mod %s: %v", filePath, err))
			continue
		}

		if isIwad {
			result.DiscoveredIWADs++
		} else {
			result.DiscoveredMods++
		}
	}

	return result, nil
}

func (s *ScannerService) ScanModDirectory(ctx context.Context, dir string, progressFn func(current int, total int, currentFile string)) (int, error) {
	if ctx != nil && ctx.Err() != nil {
		return 0, ctx.Err()
	}

	cleanDir := filepath.Clean(dir)
	stat, err := os.Stat(cleanDir)
	if err != nil {
		return 0, fmt.Errorf("directory not found: %w", err)
	}
	if !stat.IsDir() {
		return 0, errors.New("path is not a directory")
	}

	candidates := s.collectModFiles(ctx, cleanDir)
	total := len(candidates)
	discovered := 0

	for i, file := range candidates {
		select {
		case <-ctx.Done():
			return discovered, ctx.Err()
		default:
		}

		if progressFn != nil {
			progressFn(i+1, total, file)
		}

		_, err := s.processModFile(ctx, file)
		if err != nil {
			continue
		}
		discovered++
	}

	return discovered, nil
}

func (s *ScannerService) ScanIWADDirectory(ctx context.Context, dir string) (int, error) {
	if ctx != nil && ctx.Err() != nil {
		return 0, ctx.Err()
	}

	cleanDir := filepath.Clean(dir)
	stat, err := os.Stat(cleanDir)
	if err != nil {
		return 0, fmt.Errorf("directory not found: %w", err)
	}
	if !stat.IsDir() {
		return 0, errors.New("path is not a directory")
	}

	var candidates []string
	err = filepath.WalkDir(cleanDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if ctx != nil && ctx.Err() != nil {
			return ctx.Err()
		}
		if d.IsDir() {
			if strings.HasPrefix(d.Name(), ".") && path != cleanDir {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasPrefix(d.Name(), ".") {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(d.Name()))
		if ext == ".wad" || ext == ".iwad" {
			candidates = append(candidates, filepath.Clean(path))
		}
		return nil
	})
	if err != nil {
		return 0, err
	}

	discovered := 0
	for _, file := range candidates {
		select {
		case <-ctx.Done():
			return discovered, ctx.Err()
		default:
		}

		info, err := filesystem.InspectFile(file)
		if err != nil {
			continue
		}

		// Check if it's an IWAD or PWAD
		if info.IsIWAD || IsKnownIWADName(file) {
			if err := s.upsertIWAD(file, info); err == nil {
				discovered++
			}
		} else if s.modRepo != nil {
			// If a PWAD is located in IWAD directory, register as mod
			if _, err := s.upsertMod(file, info); err == nil {
				discovered++
			}
		}
	}

	return discovered, nil
}

func (s *ScannerService) ScanEngineDirectory(ctx context.Context, dir string) (int, error) {
	if ctx != nil && ctx.Err() != nil {
		return 0, ctx.Err()
	}

	cleanDir := filepath.Clean(dir)
	stat, err := os.Stat(cleanDir)
	if err != nil {
		return 0, fmt.Errorf("directory not found: %w", err)
	}
	if !stat.IsDir() {
		return 0, errors.New("path is not a directory")
	}

	if s.engineRepo == nil {
		return 0, errors.New("engine repository is not configured")
	}

	var candidates []string
	err = filepath.WalkDir(cleanDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if ctx != nil && ctx.Err() != nil {
			return ctx.Err()
		}
		if d.IsDir() {
			if strings.HasPrefix(d.Name(), ".") && path != cleanDir {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasPrefix(d.Name(), ".") {
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return nil
		}

		if isEngineCandidate(info, path) {
			candidates = append(candidates, filepath.Clean(path))
		}
		return nil
	})
	if err != nil {
		return 0, err
	}

	// Fetch existing engines to match by Executable path
	existingList, err := s.engineRepo.List()
	if err != nil {
		existingList = []domain.Engine{}
	}
	engineMap := make(map[string]domain.Engine, len(existingList))
	for _, eng := range existingList {
		engineMap[filepath.Clean(eng.Executable)] = eng
	}

	discovered := 0
	for _, exePath := range candidates {
		select {
		case <-ctx.Done():
			return discovered, ctx.Err()
		default:
		}

		cleanExe := filepath.Clean(exePath)
		family, name := DetectEngineFamily(cleanExe)
		version := ProbeEngineVersion(ctx, cleanExe)

		if existing, found := engineMap[cleanExe]; found {
			existing.Name = name
			existing.Family = family
			if version != "Unknown" || existing.Version == "" || existing.Version == "Unknown" {
				existing.Version = version
			}
			if err := s.engineRepo.Update(&existing); err == nil {
				discovered++
			}
		} else {
			newEngine := domain.Engine{
				ID:         uuid.NewString(),
				Name:       name,
				Executable: cleanExe,
				Version:    version,
				Family:     family,
				CreatedAt:  time.Now().UTC(),
				UpdatedAt:  time.Now().UTC(),
			}
			if err := s.engineRepo.Create(&newEngine); err == nil {
				discovered++
				engineMap[cleanExe] = newEngine
			}
		}
	}

	return discovered, nil
}

// ImportFile inspects a single dropped file and registers it in the repository.
func (s *ScannerService) ImportFile(ctx context.Context, filePath string) (*domain.Mod, error) {
	cleanPath := filepath.Clean(filePath)
	stat, err := os.Stat(cleanPath)
	if err != nil {
		return nil, fmt.Errorf("file not found: %w", err)
	}
	if stat.IsDir() {
		return nil, errors.New("cannot import directory, expected a file")
	}

	if !isModCandidate(cleanPath) && !strings.EqualFold(filepath.Ext(cleanPath), ".iwad") {
		return nil, fmt.Errorf("unsupported file format: %s", filepath.Ext(cleanPath))
	}

	info, err := filesystem.InspectFile(cleanPath)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect file: %w", err)
	}

	// If it's an IWAD, register it in IWAD repository
	if info.IsIWAD || IsKnownIWADName(cleanPath) {
		_ = s.upsertIWAD(cleanPath, info)
	}

	// Register/upsert in Mod repository
	if s.modRepo == nil {
		return nil, errors.New("mod repository is not configured")
	}

	mod, err := s.upsertMod(cleanPath, info)
	if err != nil {
		return nil, fmt.Errorf("failed to save mod: %w", err)
	}

	return mod, nil
}

// collectModFiles gathers all mod files in a directory recursively.
func (s *ScannerService) collectModFiles(ctx context.Context, dir string) []string {
	var candidates []string
	_ = filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if ctx != nil && ctx.Err() != nil {
			return ctx.Err()
		}
		if d.IsDir() {
			if strings.HasPrefix(d.Name(), ".") && path != dir {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasPrefix(d.Name(), ".") {
			return nil
		}

		if isModCandidate(d.Name()) {
			candidates = append(candidates, filepath.Clean(path))
		}
		return nil
	})
	return candidates
}

// processModFile inspects a file and upserts it as IWAD or Mod. Returns (isIWAD, error).
func (s *ScannerService) processModFile(ctx context.Context, filePath string) (bool, error) {
	info, err := filesystem.InspectFile(filePath)
	if err != nil {
		return false, err
	}

	if info.IsIWAD || IsKnownIWADName(filePath) {
		err := s.upsertIWAD(filePath, info)
		return true, err
	}

	_, err = s.upsertMod(filePath, info)
	return false, err
}

func (s *ScannerService) upsertIWAD(filePath string, info *filesystem.FileInfo) error {
	if s.iwadRepo == nil {
		return errors.New("iwad repository not configured")
	}

	cleanPath := filepath.Clean(filePath)
	iwadType, defaultName := DetectIWADType(cleanPath)

	existing, err := s.iwadRepo.GetByPath(cleanPath)
	if err == nil && existing != nil {
		existing.Type = iwadType
		if existing.Name == "" {
			existing.Name = defaultName
		}
		existing.LumpCount = info.LumpCount
		existing.Size = info.Size
		existing.SHA256 = info.SHA256
		existing.UpdatedAt = time.Now().UTC()
		return s.iwadRepo.Update(existing)
	}

	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	newIWAD := domain.IWAD{
		ID:        uuid.NewString(),
		Name:      defaultName,
		Path:      cleanPath,
		Type:      iwadType,
		LumpCount: info.LumpCount,
		Size:      info.Size,
		SHA256:    info.SHA256,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	return s.iwadRepo.Create(&newIWAD)
}

func (s *ScannerService) upsertMod(filePath string, info *filesystem.FileInfo) (*domain.Mod, error) {
	if s.modRepo == nil {
		return nil, errors.New("mod repository not configured")
	}

	cleanPath := filepath.Clean(filePath)
	base := filepath.Base(cleanPath)
	nameStem := strings.TrimSuffix(base, filepath.Ext(base))

	format := domain.DetectModFormat(cleanPath)
	category := domain.ModCategory(info.Category)
	if !category.IsValid() {
		category = domain.ModCategoryOther
	}

	structures := info.Structures
	if structures == nil {
		structures = []string{}
	}

	existing, err := s.modRepo.GetByPath(cleanPath)
	if err == nil && existing != nil {
		existing.Format = format
		existing.Category = category
		existing.Size = info.Size
		existing.ModifiedAt = info.ModTime
		existing.SHA256 = info.SHA256
		existing.LumpCount = info.LumpCount
		existing.Structures = structures
		existing.UpdatedAt = time.Now().UTC()
		if err := s.modRepo.Update(existing); err != nil {
			return nil, err
		}
		return existing, nil
	}

	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	newMod := domain.Mod{
		ID:         uuid.NewString(),
		Name:       nameStem,
		Path:       cleanPath,
		Format:     format,
		Category:   category,
		Size:       info.Size,
		ModifiedAt: info.ModTime,
		SHA256:     info.SHA256,
		LumpCount:  info.LumpCount,
		Structures: structures,
		IsFavorite: false,
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	}
	if err := s.modRepo.Create(&newMod); err != nil {
		return nil, err
	}
	return &newMod, nil
}

// isModCandidate checks if a filename extension matches recognized mod formats.
func isModCandidate(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".wad", ".pk3", ".pk7", ".ipk3", ".zip", ".deh", ".bex":
		return true
	default:
		return false
	}
}

// isEngineCandidate checks whether a filesystem entry is a viable source port binary.
func isEngineCandidate(info os.FileInfo, fullPath string) bool {
	if info.IsDir() {
		return false
	}

	base := strings.ToLower(filepath.Base(fullPath))
	ext := strings.ToLower(filepath.Ext(fullPath))

	// Exclude known non-executable / companion extensions
	switch ext {
	case ".dll", ".txt", ".wad", ".pk3", ".ipk3", ".pk7", ".zip", ".7z", ".tar", ".gz",
		".pdb", ".ini", ".cfg", ".json", ".yaml", ".yml", ".png", ".jpg", ".ico",
		".md", ".rtf", ".doc", ".so", ".dylib", ".a", ".lib", ".obj", ".o", ".log",
		".def", ".bex", ".deh":
		return false
	}

	// Exclude installers, uninstallers, updaters, crash reporters
	if strings.HasPrefix(base, "unins") ||
		strings.Contains(base, "uninstall") ||
		strings.Contains(base, "crashrpt") ||
		strings.Contains(base, "crash-report") ||
		strings.Contains(base, "updater") ||
		strings.Contains(base, "setup") ||
		strings.Contains(base, "vcredist") ||
		strings.Contains(base, "dxsetup") {
		return false
	}

	if ext == ".exe" {
		return true
	}

	// On Unix/macOS or if file has executable permissions
	if runtime.GOOS != "windows" && (info.Mode()&0111 != 0) {
		return true
	}

	// Check if filename stem matches known Doom engine families
	stem := strings.TrimSuffix(base, ext)
	family, _ := DetectEngineFamily(stem)
	return family != domain.EngineFamilyOther
}

// DetectEngineFamily identifies the engine family and human-friendly name from an executable path.
func DetectEngineFamily(pathOrName string) (domain.EngineFamily, string) {
	base := strings.ToLower(filepath.Base(pathOrName))
	stem := strings.TrimSuffix(base, filepath.Ext(base))

	switch {
	case strings.Contains(stem, "gzdoom"):
		return domain.EngineFamilyGZDoom, "GZDoom"
	case strings.Contains(stem, "zandronum"):
		return domain.EngineFamilyZandronum, "Zandronum"
	case strings.Contains(stem, "dsda-doom") || strings.Contains(stem, "dsdadom"):
		return domain.EngineFamilyDSDADoom, "dsda-doom"
	case strings.Contains(stem, "prboom-plus") || strings.Contains(stem, "prboom_plus") || strings.Contains(stem, "prboom+"):
		return domain.EngineFamilyPrBoomPlus, "PrBoom+"
	case strings.Contains(stem, "prboom"):
		return domain.EngineFamilyPrBoomPlus, "PrBoom"
	case strings.Contains(stem, "woof"):
		return domain.EngineFamilyWoof, "Woof!"
	case strings.Contains(stem, "crispy-doom") || strings.Contains(stem, "crispydoom"):
		return domain.EngineFamilyCrispyDoom, "Crispy Doom"
	case strings.Contains(stem, "chocolate-doom") || strings.Contains(stem, "chocolatedoom"):
		return domain.EngineFamilyChocolateDoom, "Chocolate Doom"
	case strings.Contains(stem, "lzdoom"):
		return domain.EngineFamilyOther, "LZDoom"
	case strings.Contains(stem, "vkdoom"):
		return domain.EngineFamilyOther, "VKDoom"
	case strings.Contains(stem, "eternity"):
		return domain.EngineFamilyOther, "Eternity Engine"
	case strings.Contains(stem, "doomsday"):
		return domain.EngineFamilyOther, "Doomsday Engine"
	case strings.Contains(stem, "edge-classic") || strings.Contains(stem, "edge"):
		return domain.EngineFamilyOther, "EDGE-Classic"
	default:
		// Clean display name from stem
		cleaned := strings.ReplaceAll(strings.ReplaceAll(stem, "-", " "), "_", " ")
		words := strings.Fields(cleaned)
		for i, w := range words {
			if len(w) > 0 {
				words[i] = strings.ToUpper(w[:1]) + w[1:]
			}
		}
		displayName := strings.Join(words, " ")
		if displayName == "" {
			displayName = "Custom Engine"
		}
		return domain.EngineFamilyOther, displayName
	}
}

// DetectIWADType maps known IWAD filenames to IWADType and human-friendly display name.
func DetectIWADType(filenameOrPath string) (domain.IWADType, string) {
	base := strings.ToLower(filepath.Base(filenameOrPath))
	switch base {
	case "doom.wad", "doomu.wad", "doom1.wad":
		return domain.IWADTypeDoom, "The Ultimate Doom"
	case "doom2.wad", "doom2f.wad":
		return domain.IWADTypeDoom2, "Doom II"
	case "tnt.wad":
		return domain.IWADTypeTNT, "Final Doom: TNT - Evilution"
	case "plutonia.wad":
		return domain.IWADTypePlutonia, "Final Doom: The Plutonia Experiment"
	case "heretic.wad", "heretic1.wad":
		return domain.IWADTypeHeretic, "Heretic"
	case "hexen.wad", "hexdd.wad":
		return domain.IWADTypeHexen, "Hexen"
	case "strife1.wad", "strife.wad":
		return domain.IWADTypeStrife, "Strife"
	case "freedoom1.wad", "freedoom.wad":
		return domain.IWADTypeFreedoom, "Freedoom: Phase 1"
	case "freedoom2.wad":
		return domain.IWADTypeFreedoom2, "Freedoom: Phase 2"
	case "freedm.wad":
		return domain.IWADTypeFreedoom, "FreeDM"
	case "chex.wad", "chex3.wad":
		return domain.IWADTypeOther, "Chex Quest"
	case "hacx.wad":
		return domain.IWADTypeOther, "HACX"
	default:
		stem := strings.TrimSuffix(filepath.Base(filenameOrPath), filepath.Ext(filenameOrPath))
		cleaned := strings.ReplaceAll(strings.ReplaceAll(stem, "-", " "), "_", " ")
		words := strings.Fields(cleaned)
		for i, w := range words {
			if len(w) > 0 {
				words[i] = strings.ToUpper(w[:1]) + w[1:]
			}
		}
		displayName := strings.Join(words, " ")
		if displayName == "" {
			displayName = "Custom IWAD"
		}
		return domain.IWADTypeOther, displayName
	}
}

// IsKnownIWADName tests if the file base name matches standard known IWAD distributions.
func IsKnownIWADName(filenameOrPath string) bool {
	base := strings.ToLower(filepath.Base(filenameOrPath))
	switch base {
	case "doom.wad", "doomu.wad", "doom1.wad",
		"doom2.wad", "doom2f.wad",
		"tnt.wad", "plutonia.wad",
		"heretic.wad", "heretic1.wad",
		"hexen.wad", "hexdd.wad",
		"strife1.wad", "strife.wad",
		"freedoom1.wad", "freedoom2.wad", "freedoom.wad", "freedm.wad",
		"chex.wad", "chex3.wad", "hacx.wad":
		return true
	default:
		return false
	}
}

// ProbeEngineVersion attempts to execute the binary with version flags to parse its version.
func ProbeEngineVersion(ctx context.Context, exePath string) string {
	probeCtx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()

	cmd := exec.CommandContext(probeCtx, exePath, "--version")
	var outBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &outBuf

	if err := cmd.Run(); err == nil {
		out := outBuf.String()
		if match := versionRegex.FindStringSubmatch(out); len(match) > 1 && match[1] != "" {
			return strings.TrimSpace(match[1])
		}
	}

	// Fallback to -version flag
	cmd2 := exec.CommandContext(probeCtx, exePath, "-version")
	var outBuf2 bytes.Buffer
	cmd2.Stdout = &outBuf2
	cmd2.Stderr = &outBuf2

	if err := cmd2.Run(); err == nil {
		out := outBuf2.String()
		if match := versionRegex.FindStringSubmatch(out); len(match) > 1 && match[1] != "" {
			return strings.TrimSpace(match[1])
		}
	}

	return "Unknown"
}
