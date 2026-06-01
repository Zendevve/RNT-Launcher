package domain_test

import (
	"encoding/json"
	"testing"
	"time"

	"rnt-launcher/internal/domain"
)

func TestModFormat(t *testing.T) {
	tests := []struct {
		format domain.ModFormat
		valid  bool
	}{
		{domain.ModFormatWAD, true},
		{domain.ModFormatPK3, true},
		{domain.ModFormatPK7, true},
		{domain.ModFormatIPK3, true},
		{domain.ModFormatZIP, true},
		{domain.ModFormatDEH, true},
		{domain.ModFormatBEX, true},
		{domain.ModFormatUnknown, false},
		{domain.ModFormat("invalid"), false},
	}

	for _, tc := range tests {
		if tc.format.IsValid() != tc.valid {
			t.Errorf("ModFormat(%q).IsValid() = %v, expected %v", tc.format, tc.format.IsValid(), tc.valid)
		}
		if tc.format.String() != string(tc.format) {
			t.Errorf("ModFormat(%q).String() = %q, expected %q", tc.format, tc.format.String(), string(tc.format))
		}
	}

	if len(domain.ValidModFormats) != 7 {
		t.Errorf("ValidModFormats length = %d, expected 7", len(domain.ValidModFormats))
	}
}

func TestDetectModFormat(t *testing.T) {
	tests := []struct {
		input    string
		expected domain.ModFormat
	}{
		{"doom2.wad", domain.ModFormatWAD},
		{"DOOM2.WAD", domain.ModFormatWAD},
		{".wad", domain.ModFormatWAD},
		{"wad", domain.ModFormatWAD},
		{"brutalv21.pk3", domain.ModFormatPK3},
		{"BRUTAL.PK3", domain.ModFormatPK3},
		{"highres.pk7", domain.ModFormatPK7},
		{"textures.7z", domain.ModFormatPK7},
		{"game.ipk3", domain.ModFormatIPK3},
		{"extra.zip", domain.ModFormatZIP},
		{"patch.deh", domain.ModFormatDEH},
		{"patch.bex", domain.ModFormatBEX},
		{"readme.txt", domain.ModFormatUnknown},
		{"noextension", domain.ModFormatUnknown},
		{"/path/to/folder/mod.pk3", domain.ModFormatPK3},
	}

	for _, tc := range tests {
		result := domain.DetectModFormat(tc.input)
		if result != tc.expected {
			t.Errorf("DetectModFormat(%q) = %q, expected %q", tc.input, result, tc.expected)
		}
	}
}

func TestModCategory(t *testing.T) {
	categories := []domain.ModCategory{
		domain.ModCategoryGameplay,
		domain.ModCategoryMaps,
		domain.ModCategoryMegawads,
		domain.ModCategoryWeapons,
		domain.ModCategoryMonsters,
		domain.ModCategoryTextures,
		domain.ModCategoryAudio,
		domain.ModCategoryUI,
		domain.ModCategoryUtility,
		domain.ModCategoryOther,
		domain.ModCategoryUnknown,
	}

	for _, c := range categories {
		if !c.IsValid() {
			t.Errorf("ModCategory(%q).IsValid() returned false, expected true", c)
		}
		if c.String() != string(c) {
			t.Errorf("ModCategory(%q).String() = %q, expected %q", c, c.String(), string(c))
		}
	}

	invalidCat := domain.ModCategory("NonExistent")
	if invalidCat.IsValid() {
		t.Errorf("ModCategory(%q).IsValid() returned true, expected false", invalidCat)
	}

	if len(domain.ValidModCategories) != 11 {
		t.Errorf("ValidModCategories length = %d, expected 11", len(domain.ValidModCategories))
	}
}

func TestModStruct(t *testing.T) {
	now := time.Now().Truncate(time.Second)
	mod := domain.Mod{
		ID:         "mod-1",
		Name:       "Brutal Doom",
		Path:       "/mods/brutalv21.pk3",
		Format:     domain.ModFormatPK3,
		Category:   domain.ModCategoryGameplay,
		Size:       52428800,
		ModifiedAt: now,
		SHA256:     "abc123hash",
		LumpCount:  120,
		Structures: []string{"ZSCRIPT", "DECORATE", "SNDINFO"},
		IsFavorite: true,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if mod.Extension() != ".pk3" {
		t.Errorf("Extension() = %q, expected .pk3", mod.Extension())
	}
	if mod.FileName() != "brutalv21.pk3" {
		t.Errorf("FileName() = %q, expected brutalv21.pk3", mod.FileName())
	}
	if !mod.HasStructure("zscript") {
		t.Errorf("HasStructure('zscript') returned false, expected true")
	}
	if !mod.HasStructure("DECORATE") {
		t.Errorf("HasStructure('DECORATE') returned false, expected true")
	}
	if mod.HasStructure("MAPINFO") {
		t.Errorf("HasStructure('MAPINFO') returned true, expected false")
	}
	if !mod.IsPK3() {
		t.Errorf("IsPK3() returned false, expected true")
	}
	if mod.IsWAD() {
		t.Errorf("IsWAD() returned true, expected false")
	}

	wadMod := domain.Mod{
		Path:   "c:/doom/scythe.wad",
		Format: domain.ModFormatWAD,
	}
	if !wadMod.IsWAD() {
		t.Errorf("wadMod.IsWAD() returned false, expected true")
	}
	if wadMod.IsPK3() {
		t.Errorf("wadMod.IsPK3() returned true, expected false")
	}

	// JSON round-trip
	data, err := json.Marshal(mod)
	if err != nil {
		t.Fatalf("json.Marshal(mod) failed: %v", err)
	}
	var unmarshaled domain.Mod
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("json.Unmarshal(mod) failed: %v", err)
	}
	if unmarshaled.ID != mod.ID || unmarshaled.Name != mod.Name || unmarshaled.SHA256 != mod.SHA256 {
		t.Errorf("Unmarshaled mod mismatch: got %+v, expected %+v", unmarshaled, mod)
	}
}

func TestEngineFamilyAndEngine(t *testing.T) {
	families := []domain.EngineFamily{
		domain.EngineFamilyGZDoom,
		domain.EngineFamilyZandronum,
		domain.EngineFamilyDSDADoom,
		domain.EngineFamilyPrBoomPlus,
		domain.EngineFamilyWoof,
		domain.EngineFamilyCrispyDoom,
		domain.EngineFamilyChocolateDoom,
		domain.EngineFamilyOther,
	}

	for _, f := range families {
		if !f.IsValid() {
			t.Errorf("EngineFamily(%q).IsValid() returned false", f)
		}
		if f.String() != string(f) {
			t.Errorf("EngineFamily(%q).String() = %q, expected %q", f, f.String(), string(f))
		}
		if f.DisplayName() == "" {
			t.Errorf("EngineFamily(%q).DisplayName() is empty", f)
		}
	}

	invalidFamily := domain.EngineFamily("unsupported")
	if invalidFamily.IsValid() {
		t.Errorf("EngineFamily(%q).IsValid() returned true, expected false", invalidFamily)
	}

	now := time.Now().Truncate(time.Second)
	gzdoom := domain.Engine{
		ID:         "eng-1",
		Name:       "GZDoom 4.14.0",
		Executable: "C:/Games/GZDoom/gzdoom.exe",
		Version:    "4.14.0",
		Family:     domain.EngineFamilyGZDoom,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if gzdoom.ExecutableName() != "gzdoom.exe" {
		t.Errorf("ExecutableName() = %q, expected gzdoom.exe", gzdoom.ExecutableName())
	}
	if !gzdoom.SupportsPK3() {
		t.Errorf("gzdoom.SupportsPK3() returned false, expected true")
	}

	dsda := domain.Engine{
		ID:         "eng-2",
		Name:       "DSDA-Doom 0.28.2",
		Executable: "/usr/bin/dsda-doom",
		Family:     domain.EngineFamilyDSDADoom,
	}
	if dsda.SupportsPK3() {
		t.Errorf("dsda.SupportsPK3() returned true, expected false")
	}

	// JSON round-trip
	data, err := json.Marshal(gzdoom)
	if err != nil {
		t.Fatalf("json.Marshal(engine) failed: %v", err)
	}
	var unmarshaled domain.Engine
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("json.Unmarshal(engine) failed: %v", err)
	}
	if unmarshaled.ID != gzdoom.ID || unmarshaled.Family != domain.EngineFamilyGZDoom {
		t.Errorf("Unmarshaled engine mismatch: got %+v, expected %+v", unmarshaled, gzdoom)
	}
}

func TestIWADTypeAndIWAD(t *testing.T) {
	iwadTypes := []domain.IWADType{
		domain.IWADTypeDoom,
		domain.IWADTypeDoom2,
		domain.IWADTypeTNT,
		domain.IWADTypePlutonia,
		domain.IWADTypeHeretic,
		domain.IWADTypeHexen,
		domain.IWADTypeStrife,
		domain.IWADTypeFreedoom,
		domain.IWADTypeFreedoom2,
		domain.IWADTypeOther,
		domain.IWADTypeUnknown,
	}

	for _, it := range iwadTypes {
		if !it.IsValid() {
			t.Errorf("IWADType(%q).IsValid() returned false", it)
		}
		if it.String() != string(it) {
			t.Errorf("IWADType(%q).String() = %q, expected %q", it, it.String(), string(it))
		}
		if it.DisplayName() == "" {
			t.Errorf("IWADType(%q).DisplayName() is empty", it)
		}
	}

	invalidType := domain.IWADType("custom-wad")
	if invalidType.IsValid() {
		t.Errorf("IWADType(%q).IsValid() returned true, expected false", invalidType)
	}

	now := time.Now().Truncate(time.Second)
	iwad := domain.IWAD{
		ID:        "iwad-1",
		Name:      "Doom II",
		Path:      "D:/Games/DOOM2/DOOM2.WAD",
		Type:      domain.IWADTypeDoom2,
		LumpCount: 2919,
		Size:      14604584,
		SHA256:    "25e1459ca71d03ab584e686237084e40",
		CreatedAt: now,
		UpdatedAt: now,
	}

	if iwad.FileName() != "DOOM2.WAD" {
		t.Errorf("FileName() = %q, expected DOOM2.WAD", iwad.FileName())
	}

	// JSON round-trip
	data, err := json.Marshal(iwad)
	if err != nil {
		t.Fatalf("json.Marshal(iwad) failed: %v", err)
	}
	var unmarshaled domain.IWAD
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("json.Unmarshal(iwad) failed: %v", err)
	}
	if unmarshaled.ID != iwad.ID || unmarshaled.Type != domain.IWADTypeDoom2 {
		t.Errorf("Unmarshaled iwad mismatch: got %+v, expected %+v", unmarshaled, iwad)
	}
}

func TestProfileAndProfileMod(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	profile := domain.Profile{
		ID:          "prof-1",
		Name:        "Brutal Doom + Maps",
		Description: "Favorite gore setup",
		EngineID:    "eng-1",
		EngineName:  "GZDoom 4.14.0",
		IWADID:      "iwad-1",
		IWADName:    "DOOM2.WAD",
		Mods: []domain.ProfileMod{
			{
				ID:        "pm-3",
				ProfileID: "prof-1",
				ModID:     "mod-3",
				ModName:   "Nashgore",
				ModPath:   "/mods/nashgore.pk3",
				ModFormat: domain.ModFormatPK3,
				Enabled:   true,
				Order:     2,
			},
			{
				ID:        "pm-1",
				ProfileID: "prof-1",
				ModID:     "mod-1",
				ModName:   "Brutal Doom",
				ModPath:   "/mods/brutalv21.pk3",
				ModFormat: domain.ModFormatPK3,
				Enabled:   true,
				Order:     0,
			},
			{
				ID:        "pm-2",
				ProfileID: "prof-1",
				ModID:     "mod-2",
				ModName:   "HD Textures",
				ModPath:   "/mods/textures.pk7",
				ModFormat: domain.ModFormatPK7,
				Enabled:   false,
				Order:     1,
			},
		},
		Arguments:  []string{"+set", "cl_run", "1", "-skill", "4"},
		WorkingDir: "C:/Doom",
		IsFavorite: true,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if profile.ModCount() != 3 {
		t.Errorf("ModCount() = %d, expected 3", profile.ModCount())
	}
	if profile.EnabledModCount() != 2 {
		t.Errorf("EnabledModCount() = %d, expected 2", profile.EnabledModCount())
	}

	enabled := profile.EnabledMods()
	if len(enabled) != 2 {
		t.Fatalf("len(EnabledMods()) = %d, expected 2", len(enabled))
	}
	if enabled[0].ModID != "mod-1" || enabled[1].ModID != "mod-3" {
		t.Errorf("EnabledMods order incorrect: got [%s, %s], expected [mod-1, mod-3]", enabled[0].ModID, enabled[1].ModID)
	}

	disabled := profile.DisabledMods()
	if len(disabled) != 1 || disabled[0].ModID != "mod-2" {
		t.Errorf("DisabledMods incorrect: got %+v", disabled)
	}

	mod, found := profile.FindMod("mod-1")
	if !found || mod.ModName != "Brutal Doom" {
		t.Errorf("FindMod('mod-1') failed: found=%v, mod=%+v", found, mod)
	}

	_, notFound := profile.FindMod("mod-nonexistent")
	if notFound {
		t.Errorf("FindMod('mod-nonexistent') returned true, expected false")
	}

	if !profile.HasMod("mod-2") {
		t.Errorf("HasMod('mod-2') returned false, expected true")
	}
	if profile.HasMod("mod-unknown") {
		t.Errorf("HasMod('mod-unknown') returned true, expected false")
	}

	// JSON round-trip
	data, err := json.Marshal(profile)
	if err != nil {
		t.Fatalf("json.Marshal(profile) failed: %v", err)
	}
	var unmarshaled domain.Profile
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("json.Unmarshal(profile) failed: %v", err)
	}
	if unmarshaled.ID != profile.ID || len(unmarshaled.Mods) != 3 {
		t.Errorf("Unmarshaled profile mismatch: got %+v", unmarshaled)
	}
}

func TestValidationResult(t *testing.T) {
	// Ready state
	var vr domain.ValidationResult
	vr.Status = vr.ComputeStatus()
	if vr.Status != domain.ValidationStatusReady {
		t.Errorf("ComputeStatus() on empty result = %q, expected %q", vr.Status, domain.ValidationStatusReady)
	}
	if !vr.CanLaunch() {
		t.Errorf("CanLaunch() returned false on ready result")
	}

	// Add Info
	vr.AddItem(domain.ValidationSeverityInfo, "INFO_01", "Info message", "mod")
	if vr.Status != domain.ValidationStatusReady {
		t.Errorf("Status after info = %q, expected %q", vr.Status, domain.ValidationStatusReady)
	}
	if !vr.HasInfos() {
		t.Errorf("HasInfos() returned false, expected true")
	}
	if vr.HasWarnings() || vr.HasErrors() {
		t.Errorf("HasWarnings/HasErrors returned true unexpectedly")
	}

	// Add Warning
	vr.AddItem(domain.ValidationSeverityWarning, "WARN_01", "Disabled mod warning", "mod-2")
	if vr.Status != domain.ValidationStatusReadyWithWarnings {
		t.Errorf("Status after warning = %q, expected %q", vr.Status, domain.ValidationStatusReadyWithWarnings)
	}
	if !vr.HasWarnings() {
		t.Errorf("HasWarnings() returned false, expected true")
	}
	if !vr.CanLaunch() {
		t.Errorf("CanLaunch() returned false on READY_WITH_WARNINGS")
	}
	if len(vr.Warnings()) != 1 {
		t.Errorf("len(Warnings()) = %d, expected 1", len(vr.Warnings()))
	}

	// Add Error
	vr.AddItem(domain.ValidationSeverityError, "ERR_01", "Missing executable", "engine")
	if vr.Status != domain.ValidationStatusCannotLaunch {
		t.Errorf("Status after error = %q, expected %q", vr.Status, domain.ValidationStatusCannotLaunch)
	}
	if !vr.HasErrors() {
		t.Errorf("HasErrors() returned false, expected true")
	}
	if vr.CanLaunch() {
		t.Errorf("CanLaunch() returned true on CANNOT_LAUNCH")
	}
	if len(vr.Errors()) != 1 {
		t.Errorf("len(Errors()) = %d, expected 1", len(vr.Errors()))
	}

	// JSON round-trip
	data, err := json.Marshal(vr)
	if err != nil {
		t.Fatalf("json.Marshal(vr) failed: %v", err)
	}
	var unmarshaled domain.ValidationResult
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("json.Unmarshal(vr) failed: %v", err)
	}
	if unmarshaled.Status != domain.ValidationStatusCannotLaunch || len(unmarshaled.Items) != 3 {
		t.Errorf("Unmarshaled validation result mismatch: got %+v", unmarshaled)
	}
}

func TestLaunchRecord(t *testing.T) {
	now := time.Now()
	later := now.Add(5 * time.Minute)

	record := domain.LaunchRecord{
		ID:          "rec-1",
		ProfileID:   "prof-1",
		ProfileName: "Brutal Doom",
		EngineName:  "GZDoom",
		IWADName:    "DOOM2.WAD",
		StartedAt:   now,
		FinishedAt:  later,
		DurationMs:  300000,
		ExitCode:    0,
		Status:      domain.LaunchStatusSuccess,
		CommandLine: `gzdoom.exe -iwad DOOM2.WAD -file brutalv21.pk3`,
	}

	if !record.IsSuccess() {
		t.Errorf("IsSuccess() returned false for success status")
	}
	if record.Duration() != 300*time.Second {
		t.Errorf("Duration() = %v, expected 300s", record.Duration())
	}

	failedRecord := domain.LaunchRecord{
		ExitCode: 1,
		Status:   domain.LaunchStatusFailed,
	}
	if failedRecord.IsSuccess() {
		t.Errorf("failedRecord.IsSuccess() returned true, expected false")
	}

	// Duration calculation from timestamps fallback
	fallbackRecord := domain.LaunchRecord{
		StartedAt:  now,
		FinishedAt: now.Add(10 * time.Second),
		DurationMs: 0,
	}
	if fallbackRecord.Duration() != 10*time.Second {
		t.Errorf("fallbackRecord.Duration() = %v, expected 10s", fallbackRecord.Duration())
	}

	// JSON round-trip
	data, err := json.Marshal(record)
	if err != nil {
		t.Fatalf("json.Marshal(record) failed: %v", err)
	}
	var unmarshaled domain.LaunchRecord
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("json.Unmarshal(record) failed: %v", err)
	}
	if unmarshaled.ID != record.ID || unmarshaled.DurationMs != 300000 {
		t.Errorf("Unmarshaled launch record mismatch: got %+v", unmarshaled)
	}
}

func TestScanResult(t *testing.T) {
	sr := domain.ScanResult{
		DiscoveredMods:    10,
		DiscoveredIWADs:   3,
		DiscoveredEngines: 2,
		Errors:            []string{"failed to read /corrupt.wad"},
	}

	if sr.TotalDiscovered() != 15 {
		t.Errorf("TotalDiscovered() = %d, expected 15", sr.TotalDiscovered())
	}
	if !sr.HasErrors() {
		t.Errorf("HasErrors() returned false, expected true")
	}

	srClean := domain.ScanResult{
		DiscoveredMods: 5,
	}
	if srClean.HasErrors() {
		t.Errorf("srClean.HasErrors() returned true, expected false")
	}
}

func TestSettings(t *testing.T) {
	settings := domain.DefaultSettings()

	if settings.Theme != "dark" {
		t.Errorf("DefaultSettings().Theme = %q, expected 'dark'", settings.Theme)
	}
	if !settings.AutoScanOnStartup {
		t.Errorf("DefaultSettings().AutoScanOnStartup = false, expected true")
	}
	if settings.ConfirmLaunch {
		t.Errorf("DefaultSettings().ConfirmLaunch = true, expected false")
	}
	if settings.CloseOnLaunch {
		t.Errorf("DefaultSettings().CloseOnLaunch = true, expected false")
	}

	// JSON round-trip
	data, err := json.Marshal(settings)
	if err != nil {
		t.Fatalf("json.Marshal(settings) failed: %v", err)
	}
	var unmarshaled domain.Settings
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("json.Unmarshal(settings) failed: %v", err)
	}
	if unmarshaled.Theme != "dark" || unmarshaled.AutoScanOnStartup != true {
		t.Errorf("Unmarshaled settings mismatch: got %+v", unmarshaled)
	}
}

func TestModFilterAndStats(t *testing.T) {
	isFav := true
	filter := domain.ModFilter{
		Search:     "brutal",
		Category:   domain.ModCategoryGameplay,
		Format:     domain.ModFormatPK3,
		IsFavorite: &isFav,
		Limit:      50,
		Offset:     0,
	}

	data, err := json.Marshal(filter)
	if err != nil {
		t.Fatalf("json.Marshal(filter) failed: %v", err)
	}
	var unmarshaled domain.ModFilter
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("json.Unmarshal(filter) failed: %v", err)
	}
	if unmarshaled.Search != "brutal" || *unmarshaled.IsFavorite != true {
		t.Errorf("Unmarshaled filter mismatch: got %+v", unmarshaled)
	}

	now := time.Now().Truncate(time.Second)
	stats := domain.HistoryStats{
		TotalLaunches:         15,
		TotalPlayTimeMs:       3600000,
		LastLaunchedAt:        &now,
		MostPlayedProfileID:   "prof-1",
		MostPlayedProfileName: "Brutal Doom",
	}

	sData, err := json.Marshal(stats)
	if err != nil {
		t.Fatalf("json.Marshal(stats) failed: %v", err)
	}
	var unmarshaledStats domain.HistoryStats
	if err := json.Unmarshal(sData, &unmarshaledStats); err != nil {
		t.Fatalf("json.Unmarshal(stats) failed: %v", err)
	}
	if unmarshaledStats.TotalLaunches != 15 || unmarshaledStats.MostPlayedProfileName != "Brutal Doom" {
		t.Errorf("Unmarshaled stats mismatch: got %+v", unmarshaledStats)
	}

	dashStats := domain.DashboardStats{
		TotalMods:       100,
		TotalIWADs:      5,
		TotalEngines:    3,
		TotalProfiles:   10,
		TotalLaunches:   50,
		TotalPlayTimeMs: 12345678,
		RecentProfiles:  []domain.Profile{},
		RecentLaunches:  []domain.LaunchRecord{},
	}
	dashData, err := json.Marshal(dashStats)
	if err != nil {
		t.Fatalf("json.Marshal(dashStats) failed: %v", err)
	}
	var unmarshaledDash domain.DashboardStats
	if err := json.Unmarshal(dashData, &unmarshaledDash); err != nil {
		t.Fatalf("json.Unmarshal(dashStats) failed: %v", err)
	}
	if unmarshaledDash.TotalMods != 100 || unmarshaledDash.TotalPlayTimeMs != 12345678 {
		t.Errorf("Unmarshaled dash stats mismatch: got %+v", unmarshaledDash)
	}
}
