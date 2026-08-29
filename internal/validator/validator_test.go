package validator

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"rnt-launcher/internal/domain"
)

// Mock implementations for database repositories

type mockEngineRepo struct {
	engines map[string]*domain.Engine
}

func (m *mockEngineRepo) List() ([]domain.Engine, error) {
	var list []domain.Engine
	for _, e := range m.engines {
		list = append(list, *e)
	}
	return list, nil
}

func (m *mockEngineRepo) Get(id string) (*domain.Engine, error) {
	if e, ok := m.engines[id]; ok {
		return e, nil
	}
	return nil, os.ErrNotExist
}

func (m *mockEngineRepo) Create(engine *domain.Engine) error {
	m.engines[engine.ID] = engine
	return nil
}

func (m *mockEngineRepo) Update(engine *domain.Engine) error {
	m.engines[engine.ID] = engine
	return nil
}

func (m *mockEngineRepo) Delete(id string) error {
	delete(m.engines, id)
	return nil
}

type mockIWADRepo struct {
	iwads map[string]*domain.IWAD
}

func (m *mockIWADRepo) List() ([]domain.IWAD, error) {
	var list []domain.IWAD
	for _, w := range m.iwads {
		list = append(list, *w)
	}
	return list, nil
}

func (m *mockIWADRepo) Get(id string) (*domain.IWAD, error) {
	if w, ok := m.iwads[id]; ok {
		return w, nil
	}
	return nil, os.ErrNotExist
}

func (m *mockIWADRepo) GetByPath(path string) (*domain.IWAD, error) {
	for _, w := range m.iwads {
		if w.Path == path {
			return w, nil
		}
	}
	return nil, os.ErrNotExist
}

func (m *mockIWADRepo) Create(iwad *domain.IWAD) error {
	m.iwads[iwad.ID] = iwad
	return nil
}

func (m *mockIWADRepo) Update(iwad *domain.IWAD) error {
	m.iwads[iwad.ID] = iwad
	return nil
}

func (m *mockIWADRepo) Delete(id string) error {
	delete(m.iwads, id)
	return nil
}

type mockModRepo struct {
	mods map[string]*domain.Mod
}

func (m *mockModRepo) List(filter domain.ModFilter) ([]domain.Mod, error) {
	var list []domain.Mod
	for _, mod := range m.mods {
		list = append(list, *mod)
	}
	return list, nil
}

func (m *mockModRepo) Get(id string) (*domain.Mod, error) {
	if mod, ok := m.mods[id]; ok {
		return mod, nil
	}
	return nil, os.ErrNotExist
}

func (m *mockModRepo) GetByPath(path string) (*domain.Mod, error) {
	for _, mod := range m.mods {
		if mod.Path == path {
			return mod, nil
		}
	}
	return nil, os.ErrNotExist
}

func (m *mockModRepo) Create(mod *domain.Mod) error {
	m.mods[mod.ID] = mod
	return nil
}

func (m *mockModRepo) Update(mod *domain.Mod) error {
	m.mods[mod.ID] = mod
	return nil
}

func (m *mockModRepo) Delete(id string) error {
	delete(m.mods, id)
	return nil
}

func (m *mockModRepo) ToggleFavorite(id string) (bool, error) {
	return false, nil
}

type mockProfileRepo struct {
	profiles map[string]*domain.Profile
}

func (m *mockProfileRepo) List() ([]domain.Profile, error) {
	var list []domain.Profile
	for _, p := range m.profiles {
		list = append(list, *p)
	}
	return list, nil
}

func (m *mockProfileRepo) Get(id string) (*domain.Profile, error) {
	if p, ok := m.profiles[id]; ok {
		return p, nil
	}
	return nil, os.ErrNotExist
}

func (m *mockProfileRepo) Create(profile *domain.Profile) error {
	m.profiles[profile.ID] = profile
	return nil
}

func (m *mockProfileRepo) Update(profile *domain.Profile) error {
	m.profiles[profile.ID] = profile
	return nil
}

func (m *mockProfileRepo) Delete(id string) error {
	delete(m.profiles, id)
	return nil
}

func (m *mockProfileRepo) Duplicate(id string, newName string) (*domain.Profile, error) {
	p, ok := m.profiles[id]
	if !ok {
		return nil, os.ErrNotExist
	}
	clone := *p
	clone.ID = id + "-copy"
	clone.Name = newName
	m.profiles[clone.ID] = &clone
	return &clone, nil
}

func (m *mockProfileRepo) ToggleFavorite(id string) (bool, error) {
	return false, nil
}

func (m *mockProfileRepo) SetProfileMods(profileID string, mods []domain.ProfileMod) error {
	if p, ok := m.profiles[profileID]; ok {
		p.Mods = mods
		return nil
	}
	return os.ErrNotExist
}

func (m *mockProfileRepo) GetProfileMods(profileID string) ([]domain.ProfileMod, error) {
	if p, ok := m.profiles[profileID]; ok {
		return p.Mods, nil
	}
	return nil, os.ErrNotExist
}

// Helper to create test files
func createTempFile(t *testing.T, dir, filename, content string) string {
	t.Helper()
	p := filepath.Join(dir, filename)
	if err := os.WriteFile(p, []byte(content), 0644); err != nil {
		t.Fatalf("failed to create temp file %s: %v", p, err)
	}
	return p
}

func setupTestEnvironment(t *testing.T) (string, *ValidatorService, *mockEngineRepo, *mockIWADRepo, *mockModRepo, *mockProfileRepo) {
	t.Helper()
	tempDir := t.TempDir()

	engineRepo := &mockEngineRepo{engines: make(map[string]*domain.Engine)}
	iwadRepo := &mockIWADRepo{iwads: make(map[string]*domain.IWAD)}
	modRepo := &mockModRepo{mods: make(map[string]*domain.Mod)}
	profileRepo := &mockProfileRepo{profiles: make(map[string]*domain.Profile)}

	svc := NewValidatorService(profileRepo, engineRepo, iwadRepo, modRepo)
	return tempDir, svc, engineRepo, iwadRepo, modRepo, profileRepo
}

func TestValidatorService_ValidProfile_Ready(t *testing.T) {
	tempDir, svc, engineRepo, iwadRepo, modRepo, _ := setupTestEnvironment(t)

	enginePath := createTempFile(t, tempDir, "gzdoom.exe", "dummy engine")
	iwadPath := createTempFile(t, tempDir, "doom2.wad", "IWAD dummy")
	mod1Path := createTempFile(t, tempDir, "mod1.pk3", "mod content 1")
	mod2Path := createTempFile(t, tempDir, "mod2.pk3", "mod content 2")

	engine := &domain.Engine{
		ID:         "eng-1",
		Name:       "GZDoom 4.12",
		Executable: enginePath,
		Family:     domain.EngineFamilyGZDoom,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	engineRepo.engines["eng-1"] = engine

	iwad := &domain.IWAD{
		ID:        "iwad-1",
		Name:      "DOOM 2",
		Path:      iwadPath,
		Type:      domain.IWADTypeDoom2,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	iwadRepo.iwads["iwad-1"] = iwad

	modRepo.mods["mod-1"] = &domain.Mod{
		ID:   "mod-1",
		Name: "Mod 1",
		Path: mod1Path,
	}
	modRepo.mods["mod-2"] = &domain.Mod{
		ID:   "mod-2",
		Name: "Mod 2",
		Path: mod2Path,
	}

	workDir := filepath.Join(tempDir, "work")
	if err := os.Mkdir(workDir, 0755); err != nil {
		t.Fatalf("failed to create workDir: %v", err)
	}

	profile := &domain.Profile{
		ID:         "prof-1",
		Name:       "My Perfect Profile",
		EngineID:   "eng-1",
		IWADID:     "iwad-1",
		WorkingDir: workDir,
		Mods: []domain.ProfileMod{
			{
				ID:        "pm-1",
				ProfileID: "prof-1",
				ModID:     "mod-1",
				ModName:   "Mod 1",
				ModPath:   mod1Path,
				Enabled:   true,
				Order:     0,
			},
			{
				ID:        "pm-2",
				ProfileID: "prof-1",
				ModID:     "mod-2",
				ModName:   "Mod 2",
				ModPath:   mod2Path,
				Enabled:   true,
				Order:     1,
			},
		},
	}

	res, err := svc.ValidateProfileEntity(context.Background(), profile)
	if err != nil {
		t.Fatalf("ValidateProfileEntity returned unexpected error: %v", err)
	}

	if res.Status != domain.ValidationStatusReady {
		t.Errorf("expected Status == READY, got %s (items: %+v)", res.Status, res.Items)
	}
	if !res.CanLaunch() {
		t.Errorf("expected CanLaunch() == true")
	}
	if len(res.Items) != 0 {
		t.Errorf("expected 0 items, got %d", len(res.Items))
	}
	if res.Engine == nil || res.Engine.ID != "eng-1" {
		t.Errorf("expected res.Engine to be populated")
	}
	if res.IWAD == nil || res.IWAD.ID != "iwad-1" {
		t.Errorf("expected res.IWAD to be populated")
	}
	if len(res.EnabledMods) != 2 {
		t.Errorf("expected 2 enabled mods, got %d", len(res.EnabledMods))
	}
}

func TestValidatorService_Rule1_MissingEngine(t *testing.T) {
	tempDir, svc, _, iwadRepo, _, _ := setupTestEnvironment(t)
	iwadPath := createTempFile(t, tempDir, "doom2.wad", "IWAD")
	iwadRepo.iwads["iwad-1"] = &domain.IWAD{ID: "iwad-1", Path: iwadPath}

	// Case 1: Empty EngineID
	profileEmptyEngine := &domain.Profile{
		ID:       "prof-1",
		EngineID: "",
		IWADID:   "iwad-1",
	}
	res, err := svc.ValidateProfileEntity(context.Background(), profileEmptyEngine)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Status != domain.ValidationStatusCannotLaunch {
		t.Errorf("expected CANNOT_LAUNCH, got %s", res.Status)
	}
	if len(res.Errors()) != 1 {
		t.Fatalf("expected 1 error, got %d", len(res.Errors()))
	}
	if res.Errors()[0].Code != "MISSING_ENGINE" {
		t.Errorf("expected code MISSING_ENGINE, got %s", res.Errors()[0].Code)
	}
	if res.Errors()[0].Message != "No source port engine selected" {
		t.Errorf("expected message 'No source port engine selected', got %q", res.Errors()[0].Message)
	}

	// Case 2: EngineID not in DB
	profileEngineNotInDB := &domain.Profile{
		ID:       "prof-2",
		EngineID: "eng-missing",
		IWADID:   "iwad-1",
	}
	res2, err := svc.ValidateProfileEntity(context.Background(), profileEngineNotInDB)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res2.Status != domain.ValidationStatusCannotLaunch {
		t.Errorf("expected CANNOT_LAUNCH, got %s", res2.Status)
	}
	if len(res2.Errors()) != 1 || res2.Errors()[0].Code != "ENGINE_NOT_FOUND" {
		t.Errorf("expected ENGINE_NOT_FOUND error, got %+v", res2.Errors())
	}

	// Case 3: Engine in DB but executable missing on disk
	tempDir2, svc2, engineRepo2, iwadRepo2, _, _ := setupTestEnvironment(t)
	iwadPath2 := createTempFile(t, tempDir2, "doom2.wad", "IWAD")
	iwadRepo2.iwads["iwad-1"] = &domain.IWAD{ID: "iwad-1", Path: iwadPath2}

	nonExistentExec := filepath.Join(tempDir2, "missing-gzdoom.exe")
	engineRepo2.engines["eng-1"] = &domain.Engine{
		ID:         "eng-1",
		Executable: nonExistentExec,
	}

	profileEngineMissingExec := &domain.Profile{
		ID:       "prof-3",
		EngineID: "eng-1",
		IWADID:   "iwad-1",
	}
	res3, err := svc2.ValidateProfileEntity(context.Background(), profileEngineMissingExec)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res3.Status != domain.ValidationStatusCannotLaunch {
		t.Errorf("expected CANNOT_LAUNCH, got %s", res3.Status)
	}
	if len(res3.Errors()) != 1 || res3.Errors()[0].Code != "ENGINE_NOT_FOUND" {
		t.Errorf("expected ENGINE_NOT_FOUND error, got %+v", res3.Errors())
	}
	expectedMsg := "Engine executable not found: " + nonExistentExec
	if res3.Errors()[0].Message != expectedMsg {
		t.Errorf("expected message %q, got %q", expectedMsg, res3.Errors()[0].Message)
	}
}

func TestValidatorService_Rule2_MissingIWAD(t *testing.T) {
	tempDir, svc, engineRepo, _, _, _ := setupTestEnvironment(t)
	enginePath := createTempFile(t, tempDir, "gzdoom.exe", "engine")
	engineRepo.engines["eng-1"] = &domain.Engine{ID: "eng-1", Executable: enginePath}

	// Case 1: Empty IWADID
	profileEmptyIWAD := &domain.Profile{
		ID:       "prof-1",
		EngineID: "eng-1",
		IWADID:   "",
	}
	res, err := svc.ValidateProfileEntity(context.Background(), profileEmptyIWAD)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Status != domain.ValidationStatusCannotLaunch {
		t.Errorf("expected CANNOT_LAUNCH, got %s", res.Status)
	}
	if len(res.Errors()) != 1 || res.Errors()[0].Code != "MISSING_IWAD" {
		t.Fatalf("expected MISSING_IWAD error, got %+v", res.Errors())
	}
	if res.Errors()[0].Message != "No IWAD selected" {
		t.Errorf("expected 'No IWAD selected', got %q", res.Errors()[0].Message)
	}

	// Case 2: IWAD not in DB
	profileIWADNotInDB := &domain.Profile{
		ID:       "prof-2",
		EngineID: "eng-1",
		IWADID:   "iwad-missing",
	}
	res2, err := svc.ValidateProfileEntity(context.Background(), profileIWADNotInDB)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res2.Status != domain.ValidationStatusCannotLaunch {
		t.Errorf("expected CANNOT_LAUNCH, got %s", res2.Status)
	}
	if len(res2.Errors()) != 1 || res2.Errors()[0].Code != "IWAD_NOT_FOUND" {
		t.Fatalf("expected IWAD_NOT_FOUND error, got %+v", res2.Errors())
	}

	// Case 3: IWAD in DB but file missing on disk
	tempDir2, svc2, engineRepo2, iwadRepo2, _, _ := setupTestEnvironment(t)
	enginePath2 := createTempFile(t, tempDir2, "gzdoom.exe", "engine")
	engineRepo2.engines["eng-1"] = &domain.Engine{ID: "eng-1", Executable: enginePath2}

	nonExistentIWAD := filepath.Join(tempDir2, "missing-doom2.wad")
	iwadRepo2.iwads["iwad-1"] = &domain.IWAD{
		ID:   "iwad-1",
		Path: nonExistentIWAD,
	}

	profileIWADMissingFile := &domain.Profile{
		ID:       "prof-3",
		EngineID: "eng-1",
		IWADID:   "iwad-1",
	}
	res3, err := svc2.ValidateProfileEntity(context.Background(), profileIWADMissingFile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res3.Status != domain.ValidationStatusCannotLaunch {
		t.Errorf("expected CANNOT_LAUNCH, got %s", res3.Status)
	}
	if len(res3.Errors()) != 1 || res3.Errors()[0].Code != "IWAD_NOT_FOUND" {
		t.Fatalf("expected IWAD_NOT_FOUND error, got %+v", res3.Errors())
	}
	expectedMsg := "IWAD file not found: " + nonExistentIWAD
	if res3.Errors()[0].Message != expectedMsg {
		t.Errorf("expected message %q, got %q", expectedMsg, res3.Errors()[0].Message)
	}
}

func TestValidatorService_Rule3_ModValidation(t *testing.T) {
	tempDir, svc, engineRepo, iwadRepo, _, _ := setupTestEnvironment(t)
	enginePath := createTempFile(t, tempDir, "gzdoom.exe", "engine")
	iwadPath := createTempFile(t, tempDir, "doom2.wad", "IWAD")
	engineRepo.engines["eng-1"] = &domain.Engine{ID: "eng-1", Executable: enginePath}
	iwadRepo.iwads["iwad-1"] = &domain.IWAD{ID: "iwad-1", Path: iwadPath}

	missingModPath := filepath.Join(tempDir, "missing-mod.pk3")
	existingModPath := createTempFile(t, tempDir, "existing-mod.pk3", "content")

	// Case 1: Enabled mod missing on disk -> ERROR "MOD_NOT_FOUND", Status = CANNOT_LAUNCH
	profileEnabledMissing := &domain.Profile{
		ID:       "prof-1",
		EngineID: "eng-1",
		IWADID:   "iwad-1",
		Mods: []domain.ProfileMod{
			{
				ID:      "pm-1",
				ModID:   "mod-missing",
				ModName: "Missing Mod",
				ModPath: missingModPath,
				Enabled: true,
				Order:   0,
			},
		},
	}
	res1, err := svc.ValidateProfileEntity(context.Background(), profileEnabledMissing)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res1.Status != domain.ValidationStatusCannotLaunch {
		t.Errorf("expected CANNOT_LAUNCH, got %s", res1.Status)
	}
	if len(res1.Errors()) != 1 || res1.Errors()[0].Code != "MOD_NOT_FOUND" {
		t.Fatalf("expected MOD_NOT_FOUND error, got %+v", res1.Errors())
	}
	expectedMsg := "Mod file not found: " + missingModPath
	if res1.Errors()[0].Message != expectedMsg {
		t.Errorf("expected message %q, got %q", expectedMsg, res1.Errors()[0].Message)
	}

	// Case 2: Disabled mod missing on disk -> WARNING "DISABLED_MOD_MISSING" & INFO "MOD_DISABLED", Status = READY_WITH_WARNINGS
	profileDisabledMissing := &domain.Profile{
		ID:       "prof-2",
		EngineID: "eng-1",
		IWADID:   "iwad-1",
		Mods: []domain.ProfileMod{
			{
				ID:      "pm-2",
				ModID:   "mod-dis-missing",
				ModName: "Disabled Missing Mod",
				ModPath: missingModPath,
				Enabled: false,
				Order:   0,
			},
		},
	}
	res2, err := svc.ValidateProfileEntity(context.Background(), profileDisabledMissing)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res2.Status != domain.ValidationStatusReadyWithWarnings {
		t.Errorf("expected READY_WITH_WARNINGS, got %s", res2.Status)
	}
	if !res2.CanLaunch() {
		t.Errorf("expected CanLaunch() == true for READY_WITH_WARNINGS")
	}
	if len(res2.Warnings()) != 1 || res2.Warnings()[0].Code != "DISABLED_MOD_MISSING" {
		t.Fatalf("expected DISABLED_MOD_MISSING warning, got %+v", res2.Warnings())
	}
	if !res2.HasInfos() {
		t.Fatalf("expected info item for disabled mod")
	}

	// Case 3: Disabled mod existing on disk -> INFO "MOD_DISABLED", Status = READY
	profileDisabledExisting := &domain.Profile{
		ID:       "prof-3",
		EngineID: "eng-1",
		IWADID:   "iwad-1",
		Mods: []domain.ProfileMod{
			{
				ID:      "pm-3",
				ModID:   "mod-dis-existing",
				ModName: "Disabled Existing Mod",
				ModPath: existingModPath,
				Enabled: false,
				Order:   0,
			},
		},
	}
	res3, err := svc.ValidateProfileEntity(context.Background(), profileDisabledExisting)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res3.Status != domain.ValidationStatusReady {
		t.Errorf("expected READY, got %s", res3.Status)
	}
	if len(res3.Warnings()) != 0 || len(res3.Errors()) != 0 {
		t.Errorf("expected no warnings or errors, got items: %+v", res3.Items)
	}
	if !res3.HasInfos() {
		t.Errorf("expected MOD_DISABLED info")
	}
}

func TestValidatorService_Rule4_DuplicateMods(t *testing.T) {
	tempDir, svc, engineRepo, iwadRepo, _, _ := setupTestEnvironment(t)
	enginePath := createTempFile(t, tempDir, "gzdoom.exe", "engine")
	iwadPath := createTempFile(t, tempDir, "doom2.wad", "IWAD")
	modPath := createTempFile(t, tempDir, "brutal.pk3", "brutal doom")

	engineRepo.engines["eng-1"] = &domain.Engine{ID: "eng-1", Executable: enginePath}
	iwadRepo.iwads["iwad-1"] = &domain.IWAD{ID: "iwad-1", Path: iwadPath}

	// Duplicate mod in load order
	profile := &domain.Profile{
		ID:       "prof-dup",
		EngineID: "eng-1",
		IWADID:   "iwad-1",
		Mods: []domain.ProfileMod{
			{
				ID:      "pm-1",
				ModID:   "mod-1",
				ModName: "Brutal Doom",
				ModPath: modPath,
				Enabled: true,
				Order:   0,
			},
			{
				ID:      "pm-2",
				ModID:   "mod-1",
				ModName: "Brutal Doom",
				ModPath: modPath,
				Enabled: true,
				Order:   1,
			},
		},
	}

	res, err := svc.ValidateProfileEntity(context.Background(), profile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res.Status != domain.ValidationStatusReadyWithWarnings {
		t.Errorf("expected READY_WITH_WARNINGS, got %s", res.Status)
	}
	if len(res.Warnings()) != 1 || res.Warnings()[0].Code != "DUPLICATE_MOD" {
		t.Fatalf("expected DUPLICATE_MOD warning, got %+v", res.Warnings())
	}
	if res.Warnings()[0].Message != "Duplicate mod in load order: Brutal Doom" {
		t.Errorf("expected message 'Duplicate mod in load order: Brutal Doom', got %q", res.Warnings()[0].Message)
	}
}

func TestValidatorService_Rule5_WorkingDirectory(t *testing.T) {
	tempDir, svc, engineRepo, iwadRepo, _, _ := setupTestEnvironment(t)
	enginePath := createTempFile(t, tempDir, "gzdoom.exe", "engine")
	iwadPath := createTempFile(t, tempDir, "doom2.wad", "IWAD")

	engineRepo.engines["eng-1"] = &domain.Engine{ID: "eng-1", Executable: enginePath}
	iwadRepo.iwads["iwad-1"] = &domain.IWAD{ID: "iwad-1", Path: iwadPath}

	nonExistentDir := filepath.Join(tempDir, "does-not-exist-dir")

	profile := &domain.Profile{
		ID:         "prof-workdir",
		EngineID:   "eng-1",
		IWADID:     "iwad-1",
		WorkingDir: nonExistentDir,
	}

	res, err := svc.ValidateProfileEntity(context.Background(), profile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res.Status != domain.ValidationStatusReadyWithWarnings {
		t.Errorf("expected READY_WITH_WARNINGS, got %s", res.Status)
	}
	if len(res.Warnings()) != 1 || res.Warnings()[0].Code != "INVALID_WORKING_DIR" {
		t.Fatalf("expected INVALID_WORKING_DIR warning, got %+v", res.Warnings())
	}
	expectedMsg := "Working directory does not exist: " + nonExistentDir
	if res.Warnings()[0].Message != expectedMsg {
		t.Errorf("expected message %q, got %q", expectedMsg, res.Warnings()[0].Message)
	}
}

func TestValidatorService_ValidateProfile_FromRepo(t *testing.T) {
	tempDir, svc, engineRepo, iwadRepo, _, profileRepo := setupTestEnvironment(t)
	enginePath := createTempFile(t, tempDir, "gzdoom.exe", "engine")
	iwadPath := createTempFile(t, tempDir, "doom2.wad", "IWAD")

	engineRepo.engines["eng-1"] = &domain.Engine{ID: "eng-1", Executable: enginePath}
	iwadRepo.iwads["iwad-1"] = &domain.IWAD{ID: "iwad-1", Path: iwadPath}

	profileRepo.profiles["prof-repo-1"] = &domain.Profile{
		ID:       "prof-repo-1",
		Name:     "Profile in DB",
		EngineID: "eng-1",
		IWADID:   "iwad-1",
	}

	res, err := svc.ValidateProfile(context.Background(), "prof-repo-1")
	if err != nil {
		t.Fatalf("ValidateProfile failed: %v", err)
	}
	if res.Status != domain.ValidationStatusReady {
		t.Errorf("expected READY, got %s", res.Status)
	}

	// Missing profile in DB
	_, errMissing := svc.ValidateProfile(context.Background(), "non-existent-profile")
	if errMissing == nil {
		t.Errorf("expected error for non-existent profile, got nil")
	}
}

func TestValidatorService_NilProfile(t *testing.T) {
	_, svc, _, _, _, _ := setupTestEnvironment(t)
	_, err := svc.ValidateProfileEntity(context.Background(), nil)
	if err == nil {
		t.Errorf("expected error for nil profile, got nil")
	}
}

func TestValidatorService_UnconfiguredProfileRepo(t *testing.T) {
	svc := NewValidatorService(nil, nil, nil, nil)
	_, err := svc.ValidateProfile(context.Background(), "some-id")
	if err == nil {
		t.Errorf("expected error when profile repo is nil")
	}
}

func TestValidatorService_DBModHydration(t *testing.T) {
	tempDir, svc, engineRepo, iwadRepo, modRepo, _ := setupTestEnvironment(t)
	enginePath := createTempFile(t, tempDir, "gzdoom.exe", "engine")
	iwadPath := createTempFile(t, tempDir, "doom2.wad", "IWAD")
	modPath := createTempFile(t, tempDir, "hydrated.pk3", "mod content")

	engineRepo.engines["eng-1"] = &domain.Engine{ID: "eng-1", Executable: enginePath}
	iwadRepo.iwads["iwad-1"] = &domain.IWAD{ID: "iwad-1", Path: iwadPath}

	modRepo.mods["mod-hydrated"] = &domain.Mod{
		ID:     "mod-hydrated",
		Name:   "Hydrated Mod Name",
		Path:   modPath,
		Format: domain.ModFormatPK3,
	}

	// ProfileMod has only ModID, ModPath and ModName are empty
	profile := &domain.Profile{
		ID:       "prof-hydration",
		EngineID: "eng-1",
		IWADID:   "iwad-1",
		Mods: []domain.ProfileMod{
			{
				ID:      "pm-1",
				ModID:   "mod-hydrated",
				Enabled: true,
				Order:   0,
			},
		},
	}

	res, err := svc.ValidateProfileEntity(context.Background(), profile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res.Status != domain.ValidationStatusReady {
		t.Errorf("expected READY, got %s (items: %+v)", res.Status, res.Items)
	}
}

func TestValidatorService_MultipleErrorsAndWarningsPriority(t *testing.T) {
	tempDir, svc, _, _, _, _ := setupTestEnvironment(t)

	nonExistentDir := filepath.Join(tempDir, "missing-dir")
	nonExistentMod := filepath.Join(tempDir, "missing-mod.pk3")

	// Profile with:
	// - Missing engine (ERROR)
	// - Missing IWAD (ERROR)
	// - Missing enabled mod (ERROR)
	// - Duplicate mod (WARNING)
	// - Invalid working dir (WARNING)
	profile := &domain.Profile{
		ID:         "prof-multiple-issues",
		EngineID:   "",
		IWADID:     "",
		WorkingDir: nonExistentDir,
		Mods: []domain.ProfileMod{
			{
				ID:      "pm-1",
				ModID:   "mod-1",
				ModName: "Missing 1",
				ModPath: nonExistentMod,
				Enabled: true,
				Order:   0,
			},
			{
				ID:      "pm-2",
				ModID:   "mod-1",
				ModName: "Missing 1",
				ModPath: nonExistentMod,
				Enabled: true,
				Order:   1,
			},
		},
	}

	res, err := svc.ValidateProfileEntity(context.Background(), profile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res.Status != domain.ValidationStatusCannotLaunch {
		t.Errorf("expected CANNOT_LAUNCH, got %s", res.Status)
	}
	if res.CanLaunch() {
		t.Errorf("expected CanLaunch() == false")
	}
	if !res.HasErrors() {
		t.Errorf("expected HasErrors() == true")
	}
	if !res.HasWarnings() {
		t.Errorf("expected HasWarnings() == true")
	}
	if len(res.Errors()) < 3 {
		t.Errorf("expected at least 3 errors, got %d", len(res.Errors()))
	}
	if len(res.Warnings()) < 2 {
		t.Errorf("expected at least 2 warnings, got %d", len(res.Warnings()))
	}
}

func TestValidatorService_CorruptAndZeroByteFiles(t *testing.T) {
	tempDir, svc, engineRepo, iwadRepo, _, _ := setupTestEnvironment(t)

	// 1. Create a 0-byte IWAD
	zeroIwadPath := filepath.Join(tempDir, "zero.wad")
	_ = os.WriteFile(zeroIwadPath, []byte{}, 0644)

	zeroIWAD := &domain.IWAD{
		ID:   "iwad-zero",
		Name: "Zero IWAD",
		Path: zeroIwadPath,
	}
	_ = iwadRepo.Create(zeroIWAD)

	// Valid Engine
	engPath := filepath.Join(tempDir, "gzdoom.exe")
	_ = os.WriteFile(engPath, []byte("dummy exe"), 0755)
	eng := &domain.Engine{
		ID:         "eng-valid",
		Name:       "GZDoom",
		Executable: engPath,
		Family:     domain.EngineFamilyGZDoom,
	}
	_ = engineRepo.Create(eng)

	// 0-byte Mod file
	zeroModPath := filepath.Join(tempDir, "empty.pk3")
	_ = os.WriteFile(zeroModPath, []byte{}, 0644)

	profile := &domain.Profile{
		ID:       "prof-zero-files",
		EngineID: eng.ID,
		IWADID:   zeroIWAD.ID,
		Mods: []domain.ProfileMod{
			{
				ID:      "pm-zero",
				ModID:   "mod-zero",
				ModName: "Empty Mod",
				ModPath: zeroModPath,
				Enabled: true,
				Order:   0,
			},
		},
	}

	res, err := svc.ValidateProfileEntity(context.Background(), profile)
	if err != nil {
		t.Fatalf("unexpected validation error: %v", err)
	}

	if res.Status != domain.ValidationStatusCannotLaunch {
		t.Errorf("expected CANNOT_LAUNCH on zero-byte IWAD, got %s", res.Status)
	}
}

func TestValidatorService_MovedAndDeletedFiles(t *testing.T) {
	tempDir, svc, engineRepo, iwadRepo, _, _ := setupTestEnvironment(t)

	engPath := filepath.Join(tempDir, "engine.exe")
	_ = os.WriteFile(engPath, []byte("dummy exe"), 0755)
	eng := &domain.Engine{ID: "eng-1", Name: "Engine", Executable: engPath}
	_ = engineRepo.Create(eng)

	iwadPath := filepath.Join(tempDir, "doom2.wad")
	_ = os.WriteFile(iwadPath, []byte("IWAD\x01\x00\x00\x00\x0C\x00\x00\x00"), 0644)
	iwad := &domain.IWAD{ID: "iwad-1", Name: "DOOM2", Path: iwadPath}
	_ = iwadRepo.Create(iwad)

	modPath := filepath.Join(tempDir, "tempmod.pk3")
	_ = os.WriteFile(modPath, []byte("PK\x05\x06\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"), 0644)

	profile := &domain.Profile{
		ID:       "prof-del",
		EngineID: eng.ID,
		IWADID:   iwad.ID,
		Mods: []domain.ProfileMod{
			{
				ID:      "pm-1",
				ModID:   "mod-1",
				ModPath: modPath,
				Enabled: true,
			},
		},
	}

	// Initial validation should be READY
	res, err := svc.ValidateProfileEntity(context.Background(), profile)
	if err != nil || res.Status != domain.ValidationStatusReady {
		t.Fatalf("expected initial READY status, got %v (err: %v)", res.Status, err)
	}

	// Now delete mod file from disk to simulate moved/deleted file
	_ = os.Remove(modPath)

	resAfter, err := svc.ValidateProfileEntity(context.Background(), profile)
	if err != nil {
		t.Fatalf("unexpected validation error: %v", err)
	}
	if resAfter.Status != domain.ValidationStatusCannotLaunch {
		t.Errorf("expected CANNOT_LAUNCH after file deleted from disk, got %s", resAfter.Status)
	}
	if !resAfter.HasErrors() {
		t.Errorf("expected validation errors for missing mod file")
	}
}
