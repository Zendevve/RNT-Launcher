package domain

import (
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// ModFormat represents the format/file type of a mod archive or patch.
type ModFormat string

const (
	ModFormatWAD     ModFormat = "wad"
	ModFormatPK3     ModFormat = "pk3"
	ModFormatPK7     ModFormat = "pk7"
	ModFormatIPK3    ModFormat = "ipk3"
	ModFormatZIP     ModFormat = "zip"
	ModFormatDEH     ModFormat = "deh"
	ModFormatBEX     ModFormat = "bex"
	ModFormatUnknown ModFormat = "unknown"
)

// ValidModFormats list of all recognized mod formats.
var ValidModFormats = []ModFormat{
	ModFormatWAD,
	ModFormatPK3,
	ModFormatPK7,
	ModFormatIPK3,
	ModFormatZIP,
	ModFormatDEH,
	ModFormatBEX,
}

// IsValid checks if the ModFormat is a recognized valid format.
func (f ModFormat) IsValid() bool {
	switch f {
	case ModFormatWAD, ModFormatPK3, ModFormatPK7, ModFormatIPK3, ModFormatZIP, ModFormatDEH, ModFormatBEX:
		return true
	default:
		return false
	}
}

// String returns the string representation.
func (f ModFormat) String() string {
	return string(f)
}

// DetectModFormat returns the ModFormat corresponding to a file extension or path.
func DetectModFormat(pathOrExt string) ModFormat {
	ext := strings.ToLower(filepath.Ext(pathOrExt))
	if ext == "" && !strings.ContainsAny(pathOrExt, `/\`) {
		ext = strings.ToLower(pathOrExt)
	}
	ext = strings.TrimPrefix(ext, ".")
	switch ext {
	case "wad":
		return ModFormatWAD
	case "pk3":
		return ModFormatPK3
	case "pk7", "7z":
		return ModFormatPK7
	case "ipk3":
		return ModFormatIPK3
	case "zip":
		return ModFormatZIP
	case "deh":
		return ModFormatDEH
	case "bex":
		return ModFormatBEX
	default:
		return ModFormatUnknown
	}
}

// ModCategory classifies mods for filtering and library organization.
type ModCategory string

const (
	ModCategoryGameplay ModCategory = "Gameplay"
	ModCategoryMaps     ModCategory = "Maps"
	ModCategoryMegawads ModCategory = "Megawads"
	ModCategoryWeapons  ModCategory = "Weapons"
	ModCategoryMonsters ModCategory = "Monsters"
	ModCategoryTextures ModCategory = "Textures"
	ModCategoryAudio    ModCategory = "Audio"
	ModCategoryUI       ModCategory = "UI"
	ModCategoryUtility  ModCategory = "Utility"
	ModCategoryOther    ModCategory = "Other"
	ModCategoryUnknown  ModCategory = "Unknown"
)

// ValidModCategories list of all valid mod categories.
var ValidModCategories = []ModCategory{
	ModCategoryGameplay,
	ModCategoryMaps,
	ModCategoryMegawads,
	ModCategoryWeapons,
	ModCategoryMonsters,
	ModCategoryTextures,
	ModCategoryAudio,
	ModCategoryUI,
	ModCategoryUtility,
	ModCategoryOther,
	ModCategoryUnknown,
}

// IsValid checks if the ModCategory is a recognized category.
func (c ModCategory) IsValid() bool {
	switch c {
	case ModCategoryGameplay, ModCategoryMaps, ModCategoryMegawads, ModCategoryWeapons,
		ModCategoryMonsters, ModCategoryTextures, ModCategoryAudio, ModCategoryUI,
		ModCategoryUtility, ModCategoryOther, ModCategoryUnknown:
		return true
	default:
		return false
	}
}

// String returns the string representation.
func (c ModCategory) String() string {
	return string(c)
}

// Mod represents a Doom modification file (WAD, PK3, PK7, DEH, etc.) in the library.
type Mod struct {
	ID         string      `json:"id"`
	Name       string      `json:"name"`
	Path       string      `json:"path"`
	Format     ModFormat   `json:"format"`
	Category   ModCategory `json:"category"`
	Size       int64       `json:"size"`
	ModifiedAt time.Time   `json:"modifiedAt"`
	SHA256     string      `json:"sha256"`
	LumpCount  int         `json:"lumpCount"`
	Structures []string    `json:"structures"`
	IsFavorite bool        `json:"isFavorite"`
	CreatedAt  time.Time   `json:"createdAt"`
	UpdatedAt  time.Time   `json:"updatedAt"`
}

// Extension returns the file extension including the leading dot.
func (m Mod) Extension() string {
	return filepath.Ext(m.Path)
}

// FileName returns the base filename of the mod file.
func (m Mod) FileName() string {
	return filepath.Base(m.Path)
}

// HasStructure checks whether the mod contains a specific internal structure (e.g. "MAPINFO", "DECORATE", "ZSCRIPT").
func (m Mod) HasStructure(name string) bool {
	upper := strings.ToUpper(strings.TrimSpace(name))
	for _, s := range m.Structures {
		if strings.ToUpper(strings.TrimSpace(s)) == upper {
			return true
		}
	}
	return false
}

// IsPK3 returns true if the mod is PK3 or IPK3 format.
func (m Mod) IsPK3() bool {
	return m.Format == ModFormatPK3 || m.Format == ModFormatIPK3
}

// IsWAD returns true if the mod is WAD format.
func (m Mod) IsWAD() bool {
	return m.Format == ModFormatWAD
}

// EngineFamily classifies Doom source port engines.
type EngineFamily string

const (
	EngineFamilyGZDoom        EngineFamily = "gzdoom"
	EngineFamilyZandronum     EngineFamily = "zandronum"
	EngineFamilyDSDADoom      EngineFamily = "dsda-doom"
	EngineFamilyPrBoomPlus    EngineFamily = "prboom-plus"
	EngineFamilyWoof          EngineFamily = "woof"
	EngineFamilyCrispyDoom    EngineFamily = "crispy-doom"
	EngineFamilyChocolateDoom EngineFamily = "chocolate-doom"
	EngineFamilyOther         EngineFamily = "other"
)

// ValidEngineFamilies list of known engine families.
var ValidEngineFamilies = []EngineFamily{
	EngineFamilyGZDoom,
	EngineFamilyZandronum,
	EngineFamilyDSDADoom,
	EngineFamilyPrBoomPlus,
	EngineFamilyWoof,
	EngineFamilyCrispyDoom,
	EngineFamilyChocolateDoom,
	EngineFamilyOther,
}

// IsValid checks if the EngineFamily is a recognized family.
func (f EngineFamily) IsValid() bool {
	switch f {
	case EngineFamilyGZDoom, EngineFamilyZandronum, EngineFamilyDSDADoom, EngineFamilyPrBoomPlus,
		EngineFamilyWoof, EngineFamilyCrispyDoom, EngineFamilyChocolateDoom, EngineFamilyOther:
		return true
	default:
		return false
	}
}

// String returns the string representation.
func (f EngineFamily) String() string {
	return string(f)
}

// DisplayName returns a human-readable name for the engine family.
func (f EngineFamily) DisplayName() string {
	switch f {
	case EngineFamilyGZDoom:
		return "GZDoom"
	case EngineFamilyZandronum:
		return "Zandronum"
	case EngineFamilyDSDADoom:
		return "dsda-doom"
	case EngineFamilyPrBoomPlus:
		return "PrBoom+"
	case EngineFamilyWoof:
		return "Woof!"
	case EngineFamilyCrispyDoom:
		return "Crispy Doom"
	case EngineFamilyChocolateDoom:
		return "Chocolate Doom"
	default:
		return "Other"
	}
}

// Engine represents a registered Doom source port / executable.
type Engine struct {
	ID         string       `json:"id"`
	Name       string       `json:"name"`
	Executable string       `json:"executable"`
	Version    string       `json:"version"`
	Family     EngineFamily `json:"family"`
	CreatedAt  time.Time    `json:"createdAt"`
	UpdatedAt  time.Time    `json:"updatedAt"`
}

// ExecutableName returns the base name of the executable.
func (e Engine) ExecutableName() string {
	return filepath.Base(e.Executable)
}

// SupportsPK3 returns whether the engine family natively supports PK3/PK7 archive files.
func (e Engine) SupportsPK3() bool {
	switch e.Family {
	case EngineFamilyGZDoom, EngineFamilyZandronum:
		return true
	default:
		return false
	}
}

// IWADType identifies standard commercial and free Doom game IWADs.
type IWADType string

const (
	IWADTypeDoom      IWADType = "doom"
	IWADTypeDoom2     IWADType = "doom2"
	IWADTypeTNT       IWADType = "tnt"
	IWADTypePlutonia  IWADType = "plutonia"
	IWADTypeHeretic   IWADType = "heretic"
	IWADTypeHexen     IWADType = "hexen"
	IWADTypeStrife    IWADType = "strife"
	IWADTypeFreedoom  IWADType = "freedoom"
	IWADTypeFreedoom2 IWADType = "freedoom2"
	IWADTypeOther     IWADType = "other"
	IWADTypeUnknown   IWADType = "unknown"
)

// ValidIWADTypes list of all recognized IWAD types.
var ValidIWADTypes = []IWADType{
	IWADTypeDoom,
	IWADTypeDoom2,
	IWADTypeTNT,
	IWADTypePlutonia,
	IWADTypeHeretic,
	IWADTypeHexen,
	IWADTypeStrife,
	IWADTypeFreedoom,
	IWADTypeFreedoom2,
	IWADTypeOther,
	IWADTypeUnknown,
}

// IsValid checks if the IWADType is recognized.
func (t IWADType) IsValid() bool {
	switch t {
	case IWADTypeDoom, IWADTypeDoom2, IWADTypeTNT, IWADTypePlutonia,
		IWADTypeHeretic, IWADTypeHexen, IWADTypeStrife,
		IWADTypeFreedoom, IWADTypeFreedoom2, IWADTypeOther, IWADTypeUnknown:
		return true
	default:
		return false
	}
}

// String returns the string representation.
func (t IWADType) String() string {
	return string(t)
}

// DisplayName returns a human-friendly name for the game IWAD.
func (t IWADType) DisplayName() string {
	switch t {
	case IWADTypeDoom:
		return "The Ultimate Doom / Doom"
	case IWADTypeDoom2:
		return "Doom II: Hell on Earth"
	case IWADTypeTNT:
		return "Final Doom: TNT Evilution"
	case IWADTypePlutonia:
		return "Final Doom: The Plutonia Experiment"
	case IWADTypeHeretic:
		return "Heretic"
	case IWADTypeHexen:
		return "Hexen: Beyond Heretic"
	case IWADTypeStrife:
		return "Strife: Quest for the Sigil"
	case IWADTypeFreedoom:
		return "Freedoom: Phase 1"
	case IWADTypeFreedoom2:
		return "Freedoom: Phase 2"
	case IWADTypeOther:
		return "Other IWAD"
	default:
		return "Unknown IWAD"
	}
}

// IWAD represents a registered Base Game IWAD (e.g. DOOM2.WAD, DOOM.WAD).
type IWAD struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	Type      IWADType  `json:"type"`
	LumpCount int       `json:"lumpCount"`
	Size      int64     `json:"size"`
	SHA256    string    `json:"sha256"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// FileName returns the base filename of the IWAD.
func (w IWAD) FileName() string {
	return filepath.Base(w.Path)
}

// ProfileMod represents a single mod included in a Profile with order and enabled state.
type ProfileMod struct {
	ID        string    `json:"id"`
	ProfileID string    `json:"profileId"`
	ModID     string    `json:"modId"`
	ModName   string    `json:"modName"`
	ModPath   string    `json:"modPath"`
	ModFormat ModFormat `json:"modFormat"`
	Enabled   bool      `json:"enabled"`
	Order     int       `json:"order"`
}

// Profile represents a complete playable configuration (Engine + IWAD + Mods + Args).
type Profile struct {
	ID              string       `json:"id"`
	Name            string       `json:"name"`
	Description     string       `json:"description"`
	EngineID        string       `json:"engineId"`
	EngineName      string       `json:"engineName"`
	IWADID          string       `json:"iwadId"`
	IWADName        string       `json:"iwadName"`
	ParentProfileID string       `json:"parentProfileId,omitempty"`
	IsolateSaves    bool         `json:"isolateSaves"`
	Mods            []ProfileMod `json:"mods"`
	Arguments       []string     `json:"arguments"`
	WorkingDir      string       `json:"workingDir"`
	IsFavorite      bool         `json:"isFavorite"`
	CreatedAt       time.Time    `json:"createdAt"`
	UpdatedAt       time.Time    `json:"updatedAt"`
}
// EnabledMods returns all enabled mods in the profile, sorted by Order ascending.
func (p Profile) EnabledMods() []ProfileMod {
	var enabled []ProfileMod
	for _, m := range p.Mods {
		if m.Enabled {
			enabled = append(enabled, m)
		}
	}
	sort.SliceStable(enabled, func(i, j int) bool {
		return enabled[i].Order < enabled[j].Order
	})
	return enabled
}

// GetEffectiveMods combines enabled mods from a parent profile with local profile mod overrides.
func (p Profile) GetEffectiveMods(parentProfile *Profile) []ProfileMod {
	if parentProfile == nil {
		return p.EnabledMods()
	}

	// Index local mods by ModID and ModPath
	localOverrideMap := make(map[string]ProfileMod)
	for _, m := range p.Mods {
		if m.ModID != "" {
			localOverrideMap[m.ModID] = m
		}
		if m.ModPath != "" {
			localOverrideMap[strings.ToLower(filepath.Clean(m.ModPath))] = m
		}
	}

	var effective []ProfileMod
	usedLocalMods := make(map[string]bool)

	// 1. Inherit from parent
	for _, pm := range parentProfile.EnabledMods() {
		cleanPath := strings.ToLower(filepath.Clean(pm.ModPath))
		if override, hasOverride := localOverrideMap[pm.ModID]; hasOverride {
			usedLocalMods[pm.ModID] = true
			if override.ModPath != "" {
				usedLocalMods[cleanPath] = true
			}
			if override.Enabled {
				effective = append(effective, override)
			}
			continue
		}
		if override, hasOverride := localOverrideMap[cleanPath]; hasOverride {
			usedLocalMods[cleanPath] = true
			if override.ModID != "" {
				usedLocalMods[override.ModID] = true
			}
			if override.Enabled {
				effective = append(effective, override)
			}
			continue
		}
		effective = append(effective, pm)
	}

	// 2. Add local mods not already processed
	for _, m := range p.Mods {
		cleanPath := strings.ToLower(filepath.Clean(m.ModPath))
		if (m.ModID != "" && usedLocalMods[m.ModID]) || (cleanPath != "" && usedLocalMods[cleanPath]) {
			continue
		}
		if m.Enabled {
			effective = append(effective, m)
		}
	}

	sort.SliceStable(effective, func(i, j int) bool {
		return effective[i].Order < effective[j].Order
	})

	return effective
}

// DisabledMods returns all disabled mods in the profile.
func (p Profile) DisabledMods() []ProfileMod {
	var disabled []ProfileMod
	for _, m := range p.Mods {
		if !m.Enabled {
			disabled = append(disabled, m)
		}
	}
	sort.SliceStable(disabled, func(i, j int) bool {
		return disabled[i].Order < disabled[j].Order
	})
	return disabled
}

// ModCount returns the total number of mods assigned to this profile.
func (p Profile) ModCount() int {
	return len(p.Mods)
}

// EnabledModCount returns the number of enabled mods.
func (p Profile) EnabledModCount() int {
	count := 0
	for _, m := range p.Mods {
		if m.Enabled {
			count++
		}
	}
	return count
}

// FindMod looks for a mod by its ModID in the profile.
func (p Profile) FindMod(modID string) (ProfileMod, bool) {
	for _, m := range p.Mods {
		if m.ModID == modID {
			return m, true
		}
	}
	return ProfileMod{}, false
}

// HasMod checks if a mod with the given ModID is in the profile.
func (p Profile) HasMod(modID string) bool {
	_, found := p.FindMod(modID)
	return found
}

// ValidationSeverity indicates the severity level of a validation finding.
type ValidationSeverity string

const (
	ValidationSeverityInfo    ValidationSeverity = "info"
	ValidationSeverityWarning ValidationSeverity = "warning"
	ValidationSeverityError   ValidationSeverity = "error"
)

// ValidationItem describes a single finding from profile validation.
type ValidationItem struct {
	Severity ValidationSeverity `json:"severity"`
	Code     string             `json:"code"`
	Message  string             `json:"message"`
	Target   string             `json:"target"`
}

// ValidationStatus represents the aggregated launch-readiness state of a Profile.
type ValidationStatus string

const (
	ValidationStatusReady            ValidationStatus = "READY"
	ValidationStatusReadyWithWarnings ValidationStatus = "READY_WITH_WARNINGS"
	ValidationStatusCannotLaunch     ValidationStatus = "CANNOT_LAUNCH"
)

// ValidationResult contains the full outcome of validating a profile prior to launch.
type ValidationResult struct {
	Status      ValidationStatus `json:"status"`
	Items       []ValidationItem `json:"items"`
	Engine      *Engine          `json:"engine,omitempty"`
	IWAD        *IWAD            `json:"iwad,omitempty"`
	EnabledMods []ProfileMod     `json:"enabledMods,omitempty"`
}

// HasErrors returns true if any item in the validation result has error severity.
func (v ValidationResult) HasErrors() bool {
	for _, item := range v.Items {
		if item.Severity == ValidationSeverityError {
			return true
		}
	}
	return false
}

// HasWarnings returns true if any item in the validation result has warning severity.
func (v ValidationResult) HasWarnings() bool {
	for _, item := range v.Items {
		if item.Severity == ValidationSeverityWarning {
			return true
		}
	}
	return false
}

// HasInfos returns true if any item in the validation result has info severity.
func (v ValidationResult) HasInfos() bool {
	for _, item := range v.Items {
		if item.Severity == ValidationSeverityInfo {
			return true
		}
	}
	return false
}

// CanLaunch returns true if the status allows launching (READY or READY_WITH_WARNINGS).
func (v ValidationResult) CanLaunch() bool {
	return v.Status == ValidationStatusReady || v.Status == ValidationStatusReadyWithWarnings
}

// Errors returns all items with error severity.
func (v ValidationResult) Errors() []ValidationItem {
	var errs []ValidationItem
	for _, item := range v.Items {
		if item.Severity == ValidationSeverityError {
			errs = append(errs, item)
		}
	}
	return errs
}

// Warnings returns all items with warning severity.
func (v ValidationResult) Warnings() []ValidationItem {
	var warns []ValidationItem
	for _, item := range v.Items {
		if item.Severity == ValidationSeverityWarning {
			warns = append(warns, item)
		}
	}
	return warns
}

// AddItem appends a validation finding and recalculates the status.
func (v *ValidationResult) AddItem(severity ValidationSeverity, code, message, target string) {
	v.Items = append(v.Items, ValidationItem{
		Severity: severity,
		Code:     code,
		Message:  message,
		Target:   target,
	})
	v.Status = v.ComputeStatus()
}

// ComputeStatus calculates the overall ValidationStatus based on contained items.
func (v ValidationResult) ComputeStatus() ValidationStatus {
	if v.HasErrors() {
		return ValidationStatusCannotLaunch
	}
	if v.HasWarnings() {
		return ValidationStatusReadyWithWarnings
	}
	return ValidationStatusReady
}

// LaunchRecord represents a logged execution of a Profile.
type LaunchRecord struct {
	ID          string    `json:"id"`
	ProfileID   string    `json:"profileId"`
	ProfileName string    `json:"profileName"`
	EngineName  string    `json:"engineName"`
	IWADName    string    `json:"iwadName"`
	StartedAt   time.Time `json:"startedAt"`
	FinishedAt  time.Time `json:"finishedAt"`
	DurationMs  int64     `json:"durationMs"`
	ExitCode    int       `json:"exitCode"`
	Status      string    `json:"status"` // "success" / "failed"
	CommandLine string    `json:"commandLine"`
}

const (
	LaunchStatusSuccess = "success"
	LaunchStatusFailed  = "failed"
)

// IsSuccess returns true if the launch record status is success.
func (r LaunchRecord) IsSuccess() bool {
	return r.Status == LaunchStatusSuccess || (r.Status == "" && r.ExitCode == 0)
}

// Duration returns the elapsed runtime as time.Duration.
func (r LaunchRecord) Duration() time.Duration {
	if r.DurationMs > 0 {
		return time.Duration(r.DurationMs) * time.Millisecond
	}
	if !r.FinishedAt.IsZero() && !r.StartedAt.IsZero() {
		return r.FinishedAt.Sub(r.StartedAt)
	}
	return 0
}

// ScanResult summarizes findings from a directory scan operation.
type ScanResult struct {
	DiscoveredMods    int      `json:"discoveredMods"`
	DiscoveredIWADs   int      `json:"discoveredIWADs"`
	DiscoveredEngines int      `json:"discoveredEngines"`
	Errors            []string `json:"errors"`
}

// TotalDiscovered returns the sum of all discovered items across mods, iwads, and engines.
func (s ScanResult) TotalDiscovered() int {
	return s.DiscoveredMods + s.DiscoveredIWADs + s.DiscoveredEngines
}

// HasErrors returns true if the scan encountered any errors.
func (s ScanResult) HasErrors() bool {
	return len(s.Errors) > 0
}

// Settings represents global application preferences.
type Settings struct {
	ModDirectories    []string `json:"modDirectories"`
	IWADDirectories   []string `json:"iwadDirectories"`
	EngineDirectories []string `json:"engineDirectories"`
	DefaultWorkingDir string   `json:"defaultWorkingDir"`
	Theme             string   `json:"theme"`
	ConfirmLaunch     bool     `json:"confirmLaunch"`
	AutoScanOnStartup bool     `json:"autoScanOnStartup"`
	CloseOnLaunch     bool     `json:"closeOnLaunch"`
}

// DefaultSettings returns a new Settings struct with default values.
func DefaultSettings() Settings {
	return Settings{
		ModDirectories:    []string{},
		IWADDirectories:   []string{},
		EngineDirectories: []string{},
		DefaultWorkingDir: "",
		Theme:             "dark",
		ConfirmLaunch:     false,
		AutoScanOnStartup: true,
		CloseOnLaunch:     false,
	}
}

// ModFilter provides query criteria for library filtering and search.
type ModFilter struct {
	Search     string       `json:"search,omitempty"`
	Category   ModCategory  `json:"category,omitempty"`
	Format     ModFormat    `json:"format,omitempty"`
	IsFavorite *bool        `json:"isFavorite,omitempty"`
	Limit      int          `json:"limit,omitempty"`
	Offset     int          `json:"offset,omitempty"`
}

// HistoryStats aggregates overall gameplay statistics across launch records.
type HistoryStats struct {
	TotalLaunches        int        `json:"totalLaunches"`
	TotalPlayTimeMs      int64      `json:"totalPlayTimeMs"`
	LastLaunchedAt       *time.Time `json:"lastLaunchedAt,omitempty"`
	MostPlayedProfileID  string     `json:"mostPlayedProfileId,omitempty"`
	MostPlayedProfileName string    `json:"mostPlayedProfileName,omitempty"`
}

// DashboardStats summarizes key metrics for the launcher dashboard.
type DashboardStats struct {
	TotalMods       int            `json:"totalMods"`
	TotalIWADs      int            `json:"totalIWADs"`
	TotalEngines    int            `json:"totalEngines"`
	TotalProfiles   int            `json:"totalProfiles"`
	TotalLaunches   int            `json:"totalLaunches"`
	TotalPlayTimeMs int64          `json:"totalPlayTimeMs"`
	RecentProfiles  []Profile      `json:"recentProfiles"`
	RecentLaunches  []LaunchRecord `json:"recentLaunches"`
}
