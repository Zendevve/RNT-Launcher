package launcher

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"rnt-launcher/internal/domain"
)

// ====================================================================
// Argument Builder Unit Tests
// ====================================================================

func TestBuildArguments_IWADOnly(t *testing.T) {
	engine := &domain.Engine{
		ID:         "eng-1",
		Name:       "GZDoom 4.14.0",
		Executable: "C:/Games/Doom/gzdoom.exe",
		Family:     domain.EngineFamilyGZDoom,
	}
	iwad := &domain.IWAD{
		ID:   "iwad-1",
		Name: "DOOM2.WAD",
		Path: "C:/Games/Doom/DOOM2.WAD",
		Type: domain.IWADTypeDoom2,
	}

	args, err := BuildArguments(engine, iwad, nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := []string{"-iwad", "C:/Games/Doom/DOOM2.WAD"}
	if len(args) != len(expected) {
		t.Fatalf("expected %d args, got %d: %+v", len(expected), len(args), args)
	}
	for i, arg := range args {
		if arg != expected[i] {
			t.Errorf("arg[%d] expected %q, got %q", i, expected[i], arg)
		}
	}
}

func TestBuildArguments_SingleMod(t *testing.T) {
	engine := &domain.Engine{Executable: "/usr/bin/gzdoom"}
	iwad := &domain.IWAD{Path: "/doom/doom.wad"}
	mods := []domain.ProfileMod{
		{
			ModPath: "/doom/mods/smoothdoom.pk3",
			Enabled: true,
			Order:   0,
		},
	}

	args, err := BuildArguments(engine, iwad, mods, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := []string{
		"-iwad", "/doom/doom.wad",
		"-file", "/doom/mods/smoothdoom.pk3",
	}
	if len(args) != len(expected) {
		t.Fatalf("expected %d args, got %d: %+v", len(expected), len(args), args)
	}
	for i, arg := range args {
		if arg != expected[i] {
			t.Errorf("arg[%d] expected %q, got %q", i, expected[i], arg)
		}
	}
}

func TestBuildArguments_MultipleModsOrder(t *testing.T) {
	engine := &domain.Engine{Executable: "gzdoom.exe"}
	iwad := &domain.IWAD{Path: "doom2.wad"}

	// Provided in shuffled order
	mods := []domain.ProfileMod{
		{ModPath: "mod_order2.pk3", Enabled: true, Order: 2},
		{ModPath: "mod_order0.wad", Enabled: true, Order: 0},
		{ModPath: "mod_order1.pk3", Enabled: true, Order: 1},
	}

	args, err := BuildArguments(engine, iwad, mods, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := []string{
		"-iwad", "doom2.wad",
		"-file", "mod_order0.wad", "mod_order1.pk3", "mod_order2.pk3",
	}
	if len(args) != len(expected) {
		t.Fatalf("expected %d args, got %d: %+v", len(expected), len(args), args)
	}
	for i, arg := range args {
		if arg != expected[i] {
			t.Errorf("arg[%d] expected %q, got %q", i, expected[i], arg)
		}
	}
}

func TestBuildArguments_DisabledModsIgnored(t *testing.T) {
	engine := &domain.Engine{Executable: "gzdoom"}
	iwad := &domain.IWAD{Path: "doom2.wad"}

	mods := []domain.ProfileMod{
		{ModPath: "modA.wad", Enabled: true, Order: 0},
		{ModPath: "modB_disabled.wad", Enabled: false, Order: 1},
		{ModPath: "modC.pk3", Enabled: true, Order: 2},
	}

	args, err := BuildArguments(engine, iwad, mods, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := []string{
		"-iwad", "doom2.wad",
		"-file", "modA.wad", "modC.pk3",
	}
	if len(args) != len(expected) {
		t.Fatalf("expected %d args, got %d: %+v", len(expected), len(args), args)
	}
	for i, arg := range args {
		if arg != expected[i] {
			t.Errorf("arg[%d] expected %q, got %q", i, expected[i], arg)
		}
	}
}

func TestBuildArguments_AllModsDisabled(t *testing.T) {
	engine := &domain.Engine{Executable: "gzdoom"}
	iwad := &domain.IWAD{Path: "doom2.wad"}

	mods := []domain.ProfileMod{
		{ModPath: "modA.wad", Enabled: false, Order: 0},
		{ModPath: "modB.wad", Enabled: false, Order: 1},
	}

	args, err := BuildArguments(engine, iwad, mods, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := []string{"-iwad", "doom2.wad"}
	if len(args) != len(expected) {
		t.Fatalf("expected %d args, got %d: %+v", len(expected), len(args), args)
	}
	for i, arg := range args {
		if arg != expected[i] {
			t.Errorf("arg[%d] expected %q, got %q", i, expected[i], arg)
		}
	}
}

func TestBuildArguments_WithCustomArgs(t *testing.T) {
	engine := &domain.Engine{Executable: "gzdoom"}
	iwad := &domain.IWAD{Path: "doom2.wad"}
	mods := []domain.ProfileMod{
		{ModPath: "brutal.pk3", Enabled: true, Order: 0},
	}
	customArgs := []string{"+set", "cl_run", "1", "-skill", "4", "+map", "map01"}

	args, err := BuildArguments(engine, iwad, mods, customArgs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := []string{
		"-iwad", "doom2.wad",
		"-file", "brutal.pk3",
		"+set", "cl_run", "1", "-skill", "4", "+map", "map01",
	}
	if len(args) != len(expected) {
		t.Fatalf("expected %d args, got %d: %+v", len(expected), len(args), args)
	}
	for i, arg := range args {
		if arg != expected[i] {
			t.Errorf("arg[%d] expected %q, got %q", i, expected[i], arg)
		}
	}
}

func TestBuildArguments_NilEngine(t *testing.T) {
	iwad := &domain.IWAD{Path: "doom2.wad"}
	_, err := BuildArguments(nil, iwad, nil, nil)
	if err == nil {
		t.Fatal("expected error with nil engine, got nil")
	}
}

func TestBuildArguments_NilIWAD(t *testing.T) {
	engine := &domain.Engine{Executable: "gzdoom"}
	_, err := BuildArguments(engine, nil, nil, nil)
	if err == nil {
		t.Fatal("expected error with nil iwad, got nil")
	}
}

func TestBuildArguments_EmptyIWADPath(t *testing.T) {
	engine := &domain.Engine{Executable: "gzdoom"}
	iwad := &domain.IWAD{Path: "   "}
	_, err := BuildArguments(engine, iwad, nil, nil)
	if err == nil {
		t.Fatal("expected error with empty iwad path, got nil")
	}
}

func TestBuildArgumentsForProfile(t *testing.T) {
	engine := &domain.Engine{Executable: "dsda-doom.exe"}
	iwad := &domain.IWAD{Path: "DOOM2.WAD"}
	profile := &domain.Profile{
		ID:        "p-1",
		Name:      "Speedrun",
		Arguments: []string{"-complevel", "2", "-warp", "01"},
		Mods: []domain.ProfileMod{
			{ModPath: "comptext.wad", Enabled: true, Order: 0},
		},
	}

	args, err := BuildArgumentsForProfile(profile, engine, iwad)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := []string{
		"-iwad", "DOOM2.WAD",
		"-file", "comptext.wad",
		"-complevel", "2", "-warp", "01",
	}
	if len(args) != len(expected) {
		t.Fatalf("expected %d args, got %d: %+v", len(expected), len(args), args)
	}
	for i, arg := range args {
		if arg != expected[i] {
			t.Errorf("arg[%d] expected %q, got %q", i, expected[i], arg)
		}
	}

	// Test nil profile
	_, err = BuildArgumentsForProfile(nil, engine, iwad)
	if err == nil {
		t.Fatal("expected error for nil profile")
	}
}

func TestFormatCommandLine(t *testing.T) {
	cases := []struct {
		executable string
		args       []string
		expected   string
	}{
		{
			executable: "gzdoom",
			args:       []string{"-iwad", "doom2.wad"},
			expected:   "gzdoom -iwad doom2.wad",
		},
		{
			executable: "C:/Program Files/GZDoom/gzdoom.exe",
			args:       []string{"-iwad", "C:/Doom/DOOM 2.WAD", "-file", "my mod.pk3"},
			expected:   `"C:/Program Files/GZDoom/gzdoom.exe" -iwad "C:/Doom/DOOM 2.WAD" -file "my mod.pk3"`,
		},
	}

	for _, c := range cases {
		got := FormatCommandLine(c.executable, c.args)
		if got != c.expected {
			t.Errorf("FormatCommandLine(%q, %v) = %q, expected %q", c.executable, c.args, got, c.expected)
		}
	}
}

func TestSplitCustomArgs(t *testing.T) {
	cases := []struct {
		input    string
		expected []string
	}{
		{
			input:    "-skill 4 -warp 01",
			expected: []string{"-skill", "4", "-warp", "01"},
		},
		{
			input:    `-file "C:\My Mods\cool mod.pk3" -nomonsters`,
			expected: []string{"-file", `C:\My Mods\cool mod.pk3`, "-nomonsters"},
		},
		{
			input:    `+set cl_run 1 +name 'Doom Guy'`,
			expected: []string{"+set", "cl_run", "1", "+name", "Doom Guy"},
		},
		{
			input:    `   `,
			expected: nil,
		},
	}

	for _, c := range cases {
		got := SplitCustomArgs(c.input)
		if len(got) != len(c.expected) {
			t.Fatalf("SplitCustomArgs(%q) len = %d, expected %d (%+v vs %+v)", c.input, len(got), len(c.expected), got, c.expected)
		}
		for i := range got {
			if got[i] != c.expected[i] {
				t.Errorf("SplitCustomArgs(%q)[%d] = %q, expected %q", c.input, i, got[i], c.expected[i])
			}
		}
	}
}

// ====================================================================
// Mock Definitions for Launcher Lifecycle Testing
// ====================================================================

type mockProcessHandle struct {
	exitCode int
	waitErr  error
	pid      int
	killed   bool
	waitDone chan struct{}
	mu       sync.Mutex
}

func newMockProcessHandle(pid int, exitCode int, waitErr error, delay time.Duration) *mockProcessHandle {
	h := &mockProcessHandle{
		pid:      pid,
		exitCode: exitCode,
		waitErr:  waitErr,
		waitDone: make(chan struct{}),
	}

	if delay <= 0 {
		close(h.waitDone)
	} else {
		go func() {
			time.Sleep(delay)
			h.mu.Lock()
			defer h.mu.Unlock()
			select {
			case <-h.waitDone:
			default:
				close(h.waitDone)
			}
		}()
	}

	return h
}

func (h *mockProcessHandle) Wait() (int, error) {
	<-h.waitDone
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.exitCode, h.waitErr
}

func (h *mockProcessHandle) Pid() int {
	return h.pid
}

func (h *mockProcessHandle) Kill() error {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.killed = true
	select {
	case <-h.waitDone:
	default:
		close(h.waitDone)
	}
	return nil
}

type startCall struct {
	executable string
	args       []string
	workingDir string
}

type mockProcessRunner struct {
	mu         sync.Mutex
	calls      []startCall
	handleFn   func(executable string, args []string, workingDir string) (ProcessHandle, error)
	startError error
}

func (r *mockProcessRunner) Start(ctx context.Context, executable string, args []string, workingDir string) (ProcessHandle, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.calls = append(r.calls, startCall{
		executable: executable,
		args:       args,
		workingDir: workingDir,
	})

	if r.startError != nil {
		return nil, r.startError
	}
	if r.handleFn != nil {
		return r.handleFn(executable, args, workingDir)
	}
	return newMockProcessHandle(1234, 0, nil, 10*time.Millisecond), nil
}

func (r *mockProcessRunner) GetCalls() []startCall {
	r.mu.Lock()
	defer r.mu.Unlock()
	copied := make([]startCall, len(r.calls))
	copy(copied, r.calls)
	return copied
}

type mockProfileRepo struct {
	mu       sync.Mutex
	profiles map[string]*domain.Profile
}

func newMockProfileRepo() *mockProfileRepo {
	return &mockProfileRepo{profiles: make(map[string]*domain.Profile)}
}

func (r *mockProfileRepo) List() ([]domain.Profile, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var list []domain.Profile
	for _, p := range r.profiles {
		list = append(list, *p)
	}
	return list, nil
}

func (r *mockProfileRepo) Get(id string) (*domain.Profile, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.profiles[id]
	if !ok {
		return nil, nil
	}
	return p, nil
}

func (r *mockProfileRepo) Create(profile *domain.Profile) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.profiles[profile.ID] = profile
	return nil
}

func (r *mockProfileRepo) Update(profile *domain.Profile) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.profiles[profile.ID] = profile
	return nil
}

func (r *mockProfileRepo) Delete(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.profiles, id)
	return nil
}

func (r *mockProfileRepo) Duplicate(id string, newName string) (*domain.Profile, error) {
	return nil, nil
}

func (r *mockProfileRepo) ToggleFavorite(id string) (bool, error) {
	return false, nil
}

func (r *mockProfileRepo) SetProfileMods(profileID string, mods []domain.ProfileMod) error {
	return nil
}

func (r *mockProfileRepo) GetProfileMods(profileID string) ([]domain.ProfileMod, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.profiles[profileID]
	if !ok {
		return nil, nil
	}
	return p.Mods, nil
}

type mockHistoryRepo struct {
	mu      sync.Mutex
	records []domain.LaunchRecord
}

func newMockHistoryRepo() *mockHistoryRepo {
	return &mockHistoryRepo{}
}

func (r *mockHistoryRepo) List(limit int) ([]domain.LaunchRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if limit <= 0 || limit > len(r.records) {
		limit = len(r.records)
	}
	return r.records[:limit], nil
}

func (r *mockHistoryRepo) Add(record domain.LaunchRecord) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.records = append(r.records, record)
	return nil
}

func (r *mockHistoryRepo) Clear() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.records = nil
	return nil
}

func (r *mockHistoryRepo) GetStats() (domain.HistoryStats, error) {
	return domain.HistoryStats{}, nil
}

func (r *mockHistoryRepo) GetRecords() []domain.LaunchRecord {
	r.mu.Lock()
	defer r.mu.Unlock()
	copied := make([]domain.LaunchRecord, len(r.records))
	copy(copied, r.records)
	return copied
}

type mockValidator struct {
	resultFn func(ctx context.Context, p *domain.Profile) (*domain.ValidationResult, error)
}

func (v *mockValidator) ValidateProfile(ctx context.Context, profileID string) (*domain.ValidationResult, error) {
	return nil, nil
}

func (v *mockValidator) ValidateProfileEntity(ctx context.Context, p *domain.Profile) (*domain.ValidationResult, error) {
	if v.resultFn != nil {
		return v.resultFn(ctx, p)
	}
	return &domain.ValidationResult{
		Status: domain.ValidationStatusReady,
		Engine: &domain.Engine{
			ID:         p.EngineID,
			Name:       "GZDoom",
			Executable: "gzdoom.exe",
		},
		IWAD: &domain.IWAD{
			ID:   p.IWADID,
			Name: "DOOM2.WAD",
			Path: "DOOM2.WAD",
		},
		EnabledMods: p.EnabledMods(),
	}, nil
}

type recordedEvent struct {
	event string
	data  any
}

type eventCollector struct {
	mu     sync.Mutex
	events []recordedEvent
}

func newEventCollector() *eventCollector {
	return &eventCollector{}
}

func (c *eventCollector) emit(event string, data any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.events = append(c.events, recordedEvent{event: event, data: data})
}

func (c *eventCollector) getEvents() []recordedEvent {
	c.mu.Lock()
	defer c.mu.Unlock()
	copied := make([]recordedEvent, len(c.events))
	copy(copied, c.events)
	return copied
}

func (c *eventCollector) waitForEvent(event string, timeout time.Duration) (*recordedEvent, error) {
	start := time.Now()
	for time.Since(start) < timeout {
		events := c.getEvents()
		for _, e := range events {
			if e.event == event {
				return &e, nil
			}
		}
		time.Sleep(5 * time.Millisecond)
	}
	return nil, fmt.Errorf("timeout waiting for event %s", event)
}

// ====================================================================
// LauncherService Lifecycle Tests
// ====================================================================

func TestLauncherService_SuccessfulLifecycle(t *testing.T) {
	profileRepo := newMockProfileRepo()
	historyRepo := newMockHistoryRepo()
	runner := &mockProcessRunner{}
	collector := newEventCollector()
	val := &mockValidator{}

	service := NewLauncherService(val, profileRepo, historyRepo, runner, collector.emit)

	profile := &domain.Profile{
		ID:         "prof-success",
		Name:       "Brutal Doom Ultra",
		EngineID:   "eng-gzdoom",
		IWADID:     "iwad-doom2",
		WorkingDir: "C:/Games/Doom",
		Arguments:  []string{"+set", "cl_run", "1"},
		Mods: []domain.ProfileMod{
			{ModPath: "brutalv21.pk3", Enabled: true, Order: 0},
			{ModPath: "metal_hud.wad", Enabled: true, Order: 1},
		},
	}
	_ = profileRepo.Create(profile)

	ctx := context.Background()
	record, err := service.LaunchProfile(ctx, profile.ID)
	if err != nil {
		t.Fatalf("LaunchProfile failed: %v", err)
	}

	// 1. Initial record checks
	if record == nil {
		t.Fatal("expected non-nil launch record")
	}
	if record.ID == "" {
		t.Error("expected non-empty launch record ID")
	}
	if record.ProfileID != profile.ID {
		t.Errorf("expected ProfileID %q, got %q", profile.ID, record.ProfileID)
	}
	if record.ProfileName != profile.Name {
		t.Errorf("expected ProfileName %q, got %q", profile.Name, record.ProfileName)
	}
	if record.StartedAt.IsZero() {
		t.Error("expected non-zero StartedAt")
	}

	// 2. Start call checks
	calls := runner.GetCalls()
	if len(calls) != 1 {
		t.Fatalf("expected 1 runner start call, got %d", len(calls))
	}
	if calls[0].executable != "gzdoom.exe" {
		t.Errorf("expected executable gzdoom.exe, got %s", calls[0].executable)
	}
	if calls[0].workingDir != profile.WorkingDir {
		t.Errorf("expected workingDir %s, got %s", profile.WorkingDir, calls[0].workingDir)
	}

	// 3. Start event check
	startEvt, err := collector.waitForEvent("launch:start", 100*time.Millisecond)
	if err != nil {
		t.Fatalf("failed to receive launch:start event: %v", err)
	}
	startRecord, ok := startEvt.data.(*domain.LaunchRecord)
	if !ok || startRecord.ID != record.ID {
		t.Errorf("launch:start data payload mismatch: %+v", startEvt.data)
	}

	// 4. Wait for background monitoring to complete (mock has 10ms delay)
	exitEvt, err := collector.waitForEvent("launch:exit", 1*time.Second)
	if err != nil {
		t.Fatalf("failed to receive launch:exit event: %v", err)
	}
	exitRecord, ok := exitEvt.data.(*domain.LaunchRecord)
	if !ok {
		t.Fatalf("launch:exit data payload is not *domain.LaunchRecord: %+v", exitEvt.data)
	}

	if exitRecord.ExitCode != 0 {
		t.Errorf("expected exit code 0, got %d", exitRecord.ExitCode)
	}
	if exitRecord.Status != domain.LaunchStatusSuccess {
		t.Errorf("expected status %q, got %q", domain.LaunchStatusSuccess, exitRecord.Status)
	}
	if exitRecord.FinishedAt.IsZero() {
		t.Error("expected non-zero FinishedAt")
	}

	// 5. History repository persistence check
	records := historyRepo.GetRecords()
	if len(records) != 1 {
		t.Fatalf("expected 1 history record, got %d", len(records))
	}
	if records[0].ID != record.ID {
		t.Errorf("expected history record ID %s, got %s", record.ID, records[0].ID)
	}
	if records[0].Status != domain.LaunchStatusSuccess {
		t.Errorf("expected history status %s, got %s", domain.LaunchStatusSuccess, records[0].Status)
	}

	// 6. Active launches list should be empty now
	activeList := service.GetActiveLaunches()
	if len(activeList) != 0 {
		t.Errorf("expected 0 active launches, got %d", len(activeList))
	}
}

func TestLauncherService_ValidationCannotLaunch(t *testing.T) {
	profileRepo := newMockProfileRepo()
	historyRepo := newMockHistoryRepo()
	runner := &mockProcessRunner{}
	collector := newEventCollector()

	val := &mockValidator{
		resultFn: func(ctx context.Context, p *domain.Profile) (*domain.ValidationResult, error) {
			res := &domain.ValidationResult{
				Status: domain.ValidationStatusCannotLaunch,
			}
			res.AddItem(domain.ValidationSeverityError, "ENGINE_NOT_FOUND", "Engine binary missing", "engine")
			return res, nil
		},
	}

	service := NewLauncherService(val, profileRepo, historyRepo, runner, collector.emit)

	profile := &domain.Profile{
		ID:       "prof-invalid",
		Name:     "Broken Profile",
		EngineID: "missing-engine",
		IWADID:   "iwad-doom",
	}
	_ = profileRepo.Create(profile)

	ctx := context.Background()
	_, err := service.LaunchProfile(ctx, profile.ID)
	if err == nil {
		t.Fatal("expected LaunchProfile to fail on CANNOT_LAUNCH, got nil error")
	}

	// Ensure runner was never invoked
	if len(runner.GetCalls()) != 0 {
		t.Errorf("expected 0 runner calls, got %d", len(runner.GetCalls()))
	}

	// Ensure no events emitted
	if len(collector.getEvents()) != 0 {
		t.Errorf("expected 0 events, got %d", len(collector.getEvents()))
	}

	// Ensure no history created
	if len(historyRepo.GetRecords()) != 0 {
		t.Errorf("expected 0 history records, got %d", len(historyRepo.GetRecords()))
	}
}

func TestLauncherService_ValidationWithWarningsProceeds(t *testing.T) {
	profileRepo := newMockProfileRepo()
	historyRepo := newMockHistoryRepo()
	runner := &mockProcessRunner{}
	collector := newEventCollector()

	val := &mockValidator{
		resultFn: func(ctx context.Context, p *domain.Profile) (*domain.ValidationResult, error) {
			res := &domain.ValidationResult{
				Status: domain.ValidationStatusReadyWithWarnings,
				Engine: &domain.Engine{Executable: "gzdoom.exe", Name: "GZDoom"},
				IWAD:   &domain.IWAD{Path: "DOOM2.WAD", Name: "DOOM2.WAD"},
			}
			res.AddItem(domain.ValidationSeverityWarning, "DUPLICATE_MOD", "Duplicate mod in load order", "mods")
			return res, nil
		},
	}

	service := NewLauncherService(val, profileRepo, historyRepo, runner, collector.emit)

	profile := &domain.Profile{
		ID:       "prof-warnings",
		Name:     "Warning Profile",
		EngineID: "eng-1",
		IWADID:   "iwad-1",
	}
	_ = profileRepo.Create(profile)

	ctx := context.Background()
	record, err := service.LaunchProfile(ctx, profile.ID)
	if err != nil {
		t.Fatalf("expected launch to succeed with warnings, got error: %v", err)
	}

	if record == nil || record.ID == "" {
		t.Fatal("expected valid launch record")
	}

	_, err = collector.waitForEvent("launch:exit", 1*time.Second)
	if err != nil {
		t.Fatalf("expected launch:exit event: %v", err)
	}
}

func TestLauncherService_RunnerStartError(t *testing.T) {
	profileRepo := newMockProfileRepo()
	historyRepo := newMockHistoryRepo()
	runner := &mockProcessRunner{
		startError: errors.New("exec: file not executable / permission denied"),
	}
	collector := newEventCollector()
	val := &mockValidator{}

	service := NewLauncherService(val, profileRepo, historyRepo, runner, collector.emit)

	profile := &domain.Profile{
		ID:       "prof-runner-err",
		Name:     "Fail Profile",
		EngineID: "eng-1",
		IWADID:   "iwad-1",
	}
	_ = profileRepo.Create(profile)

	ctx := context.Background()
	_, err := service.LaunchProfile(ctx, profile.ID)
	if err == nil {
		t.Fatal("expected LaunchProfile to fail when runner.Start fails")
	}

	// Active list should be empty
	if len(service.GetActiveLaunches()) != 0 {
		t.Errorf("expected 0 active launches")
	}
}

func TestLauncherService_NonZeroExitCode(t *testing.T) {
	profileRepo := newMockProfileRepo()
	historyRepo := newMockHistoryRepo()
	runner := &mockProcessRunner{
		handleFn: func(executable string, args []string, workingDir string) (ProcessHandle, error) {
			// Simulates a crash (exit code 255)
			return newMockProcessHandle(4321, 255, errors.New("exit status 255"), 10*time.Millisecond), nil
		},
	}
	collector := newEventCollector()
	val := &mockValidator{}

	service := NewLauncherService(val, profileRepo, historyRepo, runner, collector.emit)

	profile := &domain.Profile{
		ID:       "prof-crash",
		Name:     "Crash Profile",
		EngineID: "eng-1",
		IWADID:   "iwad-1",
	}
	_ = profileRepo.Create(profile)

	ctx := context.Background()
	record, err := service.LaunchProfile(ctx, profile.ID)
	if err != nil {
		t.Fatalf("unexpected launch error: %v", err)
	}

	exitEvt, err := collector.waitForEvent("launch:exit", 1*time.Second)
	if err != nil {
		t.Fatalf("failed to receive launch:exit event: %v", err)
	}
	exitRecord := exitEvt.data.(*domain.LaunchRecord)

	if exitRecord.ExitCode != 255 {
		t.Errorf("expected exit code 255, got %d", exitRecord.ExitCode)
	}
	if exitRecord.Status != domain.LaunchStatusFailed {
		t.Errorf("expected status %q, got %q", domain.LaunchStatusFailed, exitRecord.Status)
	}

	records := historyRepo.GetRecords()
	if len(records) != 1 || records[0].Status != domain.LaunchStatusFailed {
		t.Errorf("history record was not marked failed: %+v", records)
	}
	_ = record
}

func TestLauncherService_KillLaunch(t *testing.T) {
	profileRepo := newMockProfileRepo()
	historyRepo := newMockHistoryRepo()

	var createdHandle *mockProcessHandle
	runner := &mockProcessRunner{
		handleFn: func(executable string, args []string, workingDir string) (ProcessHandle, error) {
			// Stays open until killed
			createdHandle = newMockProcessHandle(9999, -1, errors.New("killed"), 10*time.Second)
			return createdHandle, nil
		},
	}
	collector := newEventCollector()
	val := &mockValidator{}

	service := NewLauncherService(val, profileRepo, historyRepo, runner, collector.emit)

	profile := &domain.Profile{
		ID:       "prof-kill",
		Name:     "Long Running Profile",
		EngineID: "eng-1",
		IWADID:   "iwad-1",
	}
	_ = profileRepo.Create(profile)

	ctx := context.Background()
	record, err := service.LaunchProfile(ctx, profile.ID)
	if err != nil {
		t.Fatalf("unexpected launch error: %v", err)
	}

	// Verify it's active
	activeList := service.GetActiveLaunches()
	if len(activeList) != 1 {
		t.Fatalf("expected 1 active launch, got %d", len(activeList))
	}
	if activeList[0].ID != record.ID {
		t.Errorf("active ID mismatch: %s vs %s", activeList[0].ID, record.ID)
	}
	if activeList[0].GetPid() != 9999 {
		t.Errorf("expected PID 9999, got %d", activeList[0].GetPid())
	}

	// Check GetActiveLaunch
	foundActive, ok := service.GetActiveLaunch(record.ID)
	if !ok || foundActive.ID != record.ID {
		t.Errorf("GetActiveLaunch failed")
	}

	// Kill launch
	if err := service.KillLaunch(record.ID); err != nil {
		t.Fatalf("KillLaunch failed: %v", err)
	}

	if createdHandle == nil || !createdHandle.killed {
		t.Errorf("expected process handle to be marked killed")
	}

	// Wait for process monitor to finish cleanup
	exitEvt, err := collector.waitForEvent("launch:exit", 1*time.Second)
	if err != nil {
		t.Fatalf("timed out waiting for exit after kill: %v", err)
	}
	_ = exitEvt

	if len(service.GetActiveLaunches()) != 0 {
		t.Errorf("expected 0 active launches after kill, got %d", len(service.GetActiveLaunches()))
	}

	// Killing non-existent launch returns error
	if err := service.KillLaunch("non-existent"); err == nil {
		t.Fatal("expected error killing non-existent launch")
	}
}

func TestLauncherService_KillAll(t *testing.T) {
	profileRepo := newMockProfileRepo()
	historyRepo := newMockHistoryRepo()

	runner := &mockProcessRunner{
		handleFn: func(executable string, args []string, workingDir string) (ProcessHandle, error) {
			return newMockProcessHandle(1111, 0, nil, 10*time.Second), nil
		},
	}
	val := &mockValidator{}

	service := NewLauncherService(val, profileRepo, historyRepo, runner, nil)

	p1 := &domain.Profile{ID: "p1", Name: "Profile 1", EngineID: "e1", IWADID: "i1"}
	p2 := &domain.Profile{ID: "p2", Name: "Profile 2", EngineID: "e2", IWADID: "i2"}
	_ = profileRepo.Create(p1)
	_ = profileRepo.Create(p2)

	ctx := context.Background()
	_, err := service.LaunchProfile(ctx, p1.ID)
	if err != nil {
		t.Fatalf("failed to launch p1: %v", err)
	}
	_, err = service.LaunchProfile(ctx, p2.ID)
	if err != nil {
		t.Fatalf("failed to launch p2: %v", err)
	}

	if len(service.GetActiveLaunches()) != 2 {
		t.Fatalf("expected 2 active launches, got %d", len(service.GetActiveLaunches()))
	}

	if err := service.KillAll(); err != nil {
		t.Fatalf("KillAll failed: %v", err)
	}

	// Wait for background goroutines to finish
	time.Sleep(50 * time.Millisecond)
	if len(service.GetActiveLaunches()) != 0 {
		t.Errorf("expected 0 active launches after KillAll, got %d", len(service.GetActiveLaunches()))
	}
}

func TestLauncherService_ProfileNotFound(t *testing.T) {
	profileRepo := newMockProfileRepo()
	service := NewLauncherService(&mockValidator{}, profileRepo, newMockHistoryRepo(), &mockProcessRunner{}, nil)

	_, err := service.LaunchProfile(context.Background(), "does-not-exist")
	if err == nil {
		t.Fatal("expected error for non-existent profile ID")
	}
}

func TestLauncherService_NilProfileRepository(t *testing.T) {
	service := NewLauncherService(&mockValidator{}, nil, newMockHistoryRepo(), &mockProcessRunner{}, nil)

	_, err := service.LaunchProfile(context.Background(), "p1")
	if err == nil {
		t.Fatal("expected error when profile repo is nil")
	}
}

func TestLauncherService_NilProfileEntity(t *testing.T) {
	service := NewLauncherService(&mockValidator{}, newMockProfileRepo(), newMockHistoryRepo(), &mockProcessRunner{}, nil)

	_, err := service.LaunchProfileEntity(context.Background(), nil)
	if err == nil {
		t.Fatal("expected error when profile entity is nil")
	}
}

func TestOSProcessRunner_ContextCanceled(t *testing.T) {
	runner := NewOSProcessRunner()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := runner.Start(ctx, "gzdoom", []string{"-iwad", "doom2.wad"}, "")
	if err == nil {
		t.Fatal("expected error when context is canceled")
	}
}

func TestLauncherService_AbnormalProcessExit(t *testing.T) {
	profileRepo := newMockProfileRepo()
	historyRepo := newMockHistoryRepo()

	var exitEventReceived *domain.LaunchRecord
	var mu sync.Mutex
	emitter := func(event string, data any) {
		if event == "launch:exit" {
			if rec, ok := data.(*domain.LaunchRecord); ok {
				mu.Lock()
				exitEventReceived = rec
				mu.Unlock()
			}
		}
	}

	// Runner that exits immediately with error code 255
	runner := &mockProcessRunner{
		handleFn: func(executable string, args []string, workingDir string) (ProcessHandle, error) {
			return newMockProcessHandle(9999, 255, errors.New("exit status 255"), 10*time.Millisecond), nil
		},
	}

	val := &mockValidator{}

	service := NewLauncherService(val, profileRepo, historyRepo, runner, emitter)

	p := &domain.Profile{ID: "p-abnormal", Name: "Abnormal Profile", EngineID: "e1", IWADID: "i1"}
	_ = profileRepo.Create(p)

	record, err := service.LaunchProfile(context.Background(), p.ID)
	if err != nil {
		t.Fatalf("failed to launch: %v", err)
	}

	if record.ID == "" {
		t.Errorf("expected non-empty launch ID")
	}

	// Wait for process to complete
	time.Sleep(50 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()
	if exitEventReceived == nil {
		t.Fatalf("expected launch:exit event to be emitted")
	}

	if exitEventReceived.Status != domain.LaunchStatusFailed {
		t.Errorf("expected LaunchStatusFailed, got %s", exitEventReceived.Status)
	}
	if exitEventReceived.ExitCode != 255 {
		t.Errorf("expected ExitCode 255, got %d", exitEventReceived.ExitCode)
	}

	// Check history record was persisted
	historyList, err := historyRepo.List(10)
	if err != nil || len(historyList) != 1 {
		t.Fatalf("expected 1 history record, got %d (err: %v)", len(historyList), err)
	}
	if historyList[0].Status != domain.LaunchStatusFailed {
		t.Errorf("expected history record status failed, got %s", historyList[0].Status)
	}
}
