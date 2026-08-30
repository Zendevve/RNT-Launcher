package profiles

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/launcher"
)

// ZDLFileEntry represents an individual file entry in a ZDL configuration.
type ZDLFileEntry struct {
	Path    string `json:"path"`
	Enabled bool   `json:"enabled"`
}

// ZDLData represents parsed configuration data from a .zdl file.
type ZDLData struct {
	Name       string         `json:"name"`
	Port       string         `json:"port"`
	IWAD       string         `json:"iwad"`
	Files      []ZDLFileEntry `json:"files"`
	CustomArgs string         `json:"customArgs"`
	WarpMap    string         `json:"warpMap"`
	Skill      int            `json:"skill"`
}

var (
	zdlFileIndexedRegex  = regexp.MustCompile(`^(?i)file_?([0-9]+)$`)
	zdlFileEnabledRegex  = regexp.MustCompile(`^(?i)file_?([0-9]+)_(?:enabled|active)$`)
	zdlFilesSlashPath    = regexp.MustCompile(`^(?i)files\\([0-9]+)\\path$`)
	zdlFilesSlashEnabled = regexp.MustCompile(`^(?i)files\\([0-9]+)\\enabled$`)
)

// ParseZDL parses a .zdl INI configuration byte slice into structured ZDLData.
func ParseZDL(data []byte) (*ZDLData, error) {
	if len(data) == 0 {
		return nil, errors.New("empty .zdl file data")
	}

	zdl := &ZDLData{
		Files: make([]ZDLFileEntry, 0),
	}

	type fileBuilder struct {
		path    string
		enabled bool
		index   int
	}
	fileMap := make(map[int]*fileBuilder)

	scanner := bufio.NewScanner(bytes.NewReader(data))
	currentSection := ""

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
			continue
		}

		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			currentSection = strings.ToLower(strings.Trim(line, "[] \t"))
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		lowerKey := strings.ToLower(key)
		val := strings.TrimSpace(parts[1])

		// Strip surrounding quotes if present
		if (strings.HasPrefix(val, `"`) && strings.HasSuffix(val, `"`)) ||
			(strings.HasPrefix(val, `'`) && strings.HasSuffix(val, `'`)) {
			if len(val) >= 2 {
				val = val[1 : len(val)-1]
			}
		}

		// Check indexed files (file_0, file0, files\1\path)
		if m := zdlFileIndexedRegex.FindStringSubmatch(lowerKey); len(m) == 2 {
			idx, _ := strconv.Atoi(m[1])
			if _, exists := fileMap[idx]; !exists {
				fileMap[idx] = &fileBuilder{index: idx, enabled: true}
			}
			fileMap[idx].path = val
			continue
		}

		if m := zdlFileEnabledRegex.FindStringSubmatch(lowerKey); len(m) == 2 {
			idx, _ := strconv.Atoi(m[1])
			if _, exists := fileMap[idx]; !exists {
				fileMap[idx] = &fileBuilder{index: idx, enabled: true}
			}
			fileMap[idx].enabled = isTruthVal(val)
			continue
		}

		if m := zdlFilesSlashPath.FindStringSubmatch(lowerKey); len(m) == 2 {
			idx, _ := strconv.Atoi(m[1])
			if _, exists := fileMap[idx]; !exists {
				fileMap[idx] = &fileBuilder{index: idx, enabled: true}
			}
			fileMap[idx].path = val
			continue
		}

		if m := zdlFilesSlashEnabled.FindStringSubmatch(lowerKey); len(m) == 2 {
			idx, _ := strconv.Atoi(m[1])
			if _, exists := fileMap[idx]; !exists {
				fileMap[idx] = &fileBuilder{index: idx, enabled: true}
			}
			fileMap[idx].enabled = isTruthVal(val)
			continue
		}

		switch lowerKey {
		case "port", "engine", "sourceport", "port_name", "engine_name":
			if zdl.Port == "" {
				zdl.Port = val
			}
		case "iwad", "base", "iwadpath", "iwad_path", "iwad_name":
			if zdl.IWAD == "" {
				zdl.IWAD = val
			}
		case "name", "title", "profile", "description":
			if zdl.Name == "" {
				zdl.Name = val
			}
		case "custom_params", "customparams", "customargs", "custom_args", "params", "args", "extra", "commandline":
			if zdl.CustomArgs == "" {
				zdl.CustomArgs = val
			} else {
				zdl.CustomArgs += " " + val
			}
		case "warp", "map", "warp_map", "warpmap", "level":
			if zdl.WarpMap == "" {
				zdl.WarpMap = val
			}
		case "skill", "difficulty":
			if s, err := strconv.Atoi(val); err == nil && zdl.Skill == 0 {
				zdl.Skill = s
			}
		case "file", "files":
			if currentSection == "files" || currentSection == "zdl.save" || currentSection == "zdl.general" || currentSection == "" {
				fileItems := strings.Split(val, ";")
				for _, item := range fileItems {
					item = strings.TrimSpace(item)
					if item != "" {
						idx := len(fileMap)
						fileMap[idx] = &fileBuilder{path: item, enabled: true, index: idx}
					}
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to scan .zdl data: %w", err)
	}

	// Sort file entries by index
	var builders []*fileBuilder
	for _, fb := range fileMap {
		if fb.path != "" {
			builders = append(builders, fb)
		}
	}
	sort.SliceStable(builders, func(i, j int) bool {
		return builders[i].index < builders[j].index
	})

	for _, fb := range builders {
		zdl.Files = append(zdl.Files, ZDLFileEntry{
			Path:    fb.path,
			Enabled: fb.enabled,
		})
	}

	return zdl, nil
}

func isTruthVal(v string) bool {
	v = strings.ToLower(strings.TrimSpace(v))
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

// ImportZDL parses a .zdl configuration payload, resolves engines, IWADs, and mods against the local library,
// creates the profile in the database, and returns the persisted profile along with any unresolved warning findings.
func (s *ProfileService) ImportZDL(ctx context.Context, data []byte) (*domain.Profile, []domain.ValidationItem, error) {
	if err := s.checkInitialized(ctx); err != nil {
		return nil, nil, err
	}

	zdlData, err := ParseZDL(data)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse .zdl data: %w", err)
	}

	var warnings []domain.ValidationItem

	// 1. Resolve Engine
	var resolvedEngineID, resolvedEngineName string
	portReq := strings.TrimSpace(zdlData.Port)

	if portReq != "" {
		var allEngines []domain.Engine
		if s.engines != nil {
			if list, err := s.engines.List(); err == nil {
				allEngines = list
			}
		}

		var matchedEngine *domain.Engine
		// Check by exact ID
		for i := range allEngines {
			if allEngines[i].ID == portReq {
				matchedEngine = &allEngines[i]
				break
			}
		}
		// Check by Name
		if matchedEngine == nil {
			for i := range allEngines {
				if strings.EqualFold(allEngines[i].Name, portReq) {
					matchedEngine = &allEngines[i]
					break
				}
			}
		}
		// Check by Executable base name
		if matchedEngine == nil {
			for i := range allEngines {
				exeBase := filepath.Base(allEngines[i].Executable)
				exeBaseNoExt := strings.TrimSuffix(exeBase, filepath.Ext(exeBase))
				reqBaseNoExt := strings.TrimSuffix(filepath.Base(portReq), filepath.Ext(filepath.Base(portReq)))

				if strings.EqualFold(exeBase, filepath.Base(portReq)) ||
					strings.EqualFold(exeBaseNoExt, reqBaseNoExt) ||
					strings.EqualFold(string(allEngines[i].Family), reqBaseNoExt) {
					matchedEngine = &allEngines[i]
					break
				}
			}
		}

		if matchedEngine != nil {
			resolvedEngineID = matchedEngine.ID
			resolvedEngineName = matchedEngine.Name
		} else {
			resolvedEngineName = portReq
			warnings = append(warnings, domain.ValidationItem{
				Severity: domain.ValidationSeverityWarning,
				Code:     "MISSING_ENGINE",
				Message:  fmt.Sprintf("Engine %q not found in local library", portReq),
				Target:   "engine",
			})
		}
	}

	// 2. Resolve IWAD
	var resolvedIWADID, resolvedIWADName string
	iwadReq := strings.TrimSpace(zdlData.IWAD)

	if iwadReq != "" {
		var allIWADs []domain.IWAD
		if s.iwads != nil {
			if list, err := s.iwads.List(); err == nil {
				allIWADs = list
			}
		}

		var matchedIWAD *domain.IWAD
		// Check by ID
		for i := range allIWADs {
			if allIWADs[i].ID == iwadReq {
				matchedIWAD = &allIWADs[i]
				break
			}
		}
		// Check by Name
		if matchedIWAD == nil {
			for i := range allIWADs {
				if strings.EqualFold(allIWADs[i].Name, iwadReq) {
					matchedIWAD = &allIWADs[i]
					break
				}
			}
		}
		// Check by File name or Type
		if matchedIWAD == nil {
			iwadBase := filepath.Base(iwadReq)
			iwadBaseNoExt := strings.TrimSuffix(iwadBase, filepath.Ext(iwadBase))
			for i := range allIWADs {
				fn := allIWADs[i].FileName()
				fnNoExt := strings.TrimSuffix(fn, filepath.Ext(fn))
				iwType := string(allIWADs[i].Type)

				if strings.EqualFold(fn, iwadBase) ||
					strings.EqualFold(fnNoExt, iwadBaseNoExt) ||
					strings.EqualFold(iwType, strings.ToLower(iwadBaseNoExt)) {
					matchedIWAD = &allIWADs[i]
					break
				}
			}
		}

		if matchedIWAD != nil {
			resolvedIWADID = matchedIWAD.ID
			resolvedIWADName = matchedIWAD.Name
		} else {
			resolvedIWADName = iwadReq
			warnings = append(warnings, domain.ValidationItem{
				Severity: domain.ValidationSeverityWarning,
				Code:     "MISSING_IWAD",
				Message:  fmt.Sprintf("IWAD %q not found in local library", iwadReq),
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
	var resolvedMods []domain.ProfileMod

	for i, fe := range zdlData.Files {
		order := i + 1
		reqPath := strings.TrimSpace(fe.Path)
		reqBase := filepath.Base(reqPath)

		var matchedMod *domain.Mod
		// Match by full path
		for j := range allMods {
			if strings.EqualFold(filepath.Clean(allMods[j].Path), filepath.Clean(reqPath)) {
				matchedMod = &allMods[j]
				break
			}
		}
		// Match by filename
		if matchedMod == nil {
			for j := range allMods {
				if strings.EqualFold(allMods[j].FileName(), reqBase) {
					matchedMod = &allMods[j]
					break
				}
			}
		}
		// Match by mod name
		if matchedMod == nil {
			reqBaseNoExt := strings.TrimSuffix(reqBase, filepath.Ext(reqBase))
			for j := range allMods {
				if strings.EqualFold(allMods[j].Name, reqBase) || strings.EqualFold(allMods[j].Name, reqBaseNoExt) {
					matchedMod = &allMods[j]
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
				Enabled:   fe.Enabled,
				Order:     order,
			})
		} else {
			// Unresolved mod: create placeholder mod in database to satisfy foreign keys
			placeholderID := uuid.NewString()
			placeholderName := reqBase
			if placeholderName == "" || placeholderName == "." {
				placeholderName = "Missing Mod"
			}
			placeholderPath := reqPath
			if placeholderPath == "" {
				placeholderPath = "missing://" + placeholderID
			}

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
				Enabled:   fe.Enabled,
				Order:     order,
			})
			warnings = append(warnings, domain.ValidationItem{
				Severity: domain.ValidationSeverityWarning,
				Code:     "MISSING_MOD",
				Message:  fmt.Sprintf("Mod %q not found in local library", reqBase),
				Target:   reqPath,
			})
		}
	}

	// 4. Process Arguments
	var args []string
	if strings.TrimSpace(zdlData.CustomArgs) != "" {
		args = append(args, launcher.SplitCustomArgs(zdlData.CustomArgs)...)
	}
	if strings.TrimSpace(zdlData.WarpMap) != "" {
		args = append(args, "-warp", strings.TrimSpace(zdlData.WarpMap))
	}
	if zdlData.Skill > 0 {
		args = append(args, "-skill", strconv.Itoa(zdlData.Skill))
	}

	// Profile Name
	name := strings.TrimSpace(zdlData.Name)
	if name == "" {
		if resolvedIWADName != "" {
			name = fmt.Sprintf("ZDL Import - %s", resolvedIWADName)
		} else if zdlData.IWAD != "" {
			name = fmt.Sprintf("ZDL Import - %s", filepath.Base(zdlData.IWAD))
		} else {
			name = fmt.Sprintf("ZDL Import %s", time.Now().Format("2006-01-02 15:04"))
		}
	}

	newProfile := domain.Profile{
		ID:          profileID,
		Name:        name,
		Description: fmt.Sprintf("Imported from .zdl configuration (%s)", time.Now().Format("2006-01-02 15:04:05")),
		EngineID:    resolvedEngineID,
		EngineName:  resolvedEngineName,
		IWADID:      resolvedIWADID,
		IWADName:    resolvedIWADName,
		Mods:        resolvedMods,
		Arguments:   args,
		WorkingDir:  "",
		IsFavorite:  false,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	if err := s.profiles.Create(&newProfile); err != nil {
		return nil, nil, fmt.Errorf("failed to save imported profile: %w", err)
	}

	if len(resolvedMods) > 0 {
		if err := s.profiles.SetProfileMods(newProfile.ID, resolvedMods); err != nil {
			return nil, nil, fmt.Errorf("failed to save profile mods: %w", err)
		}
	}

	return &newProfile, warnings, nil
}
