package launcher

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/validator"
)

// ProcessHandle represents a running external OS process.
type ProcessHandle interface {
	// Wait waits for the process to exit and returns its integer exit code.
	Wait() (int, error)
	// Pid returns the operating system process ID.
	Pid() int
	// Kill terminates the process immediately.
	Kill() error
}

// ProcessRunner provides an abstraction for launching external OS processes.
type ProcessRunner interface {
	// Start starts an external process with the given executable, arguments, and working directory.
	Start(ctx context.Context, executable string, args []string, workingDir string) (ProcessHandle, error)
}

// OSProcessRunner is the standard OS process runner implementation using os/exec.
type OSProcessRunner struct{}

// NewOSProcessRunner creates a new OSProcessRunner.
func NewOSProcessRunner() *OSProcessRunner {
	return &OSProcessRunner{}
}

type osProcessHandle struct {
	cmd *exec.Cmd
}

func (h *osProcessHandle) Pid() int {
	if h.cmd != nil && h.cmd.Process != nil {
		return h.cmd.Process.Pid
	}
	return 0
}

func (h *osProcessHandle) Kill() error {
	if h.cmd != nil && h.cmd.Process != nil {
		return h.cmd.Process.Kill()
	}
	return nil
}

func (h *osProcessHandle) Wait() (int, error) {
	if h.cmd == nil {
		return -1, errors.New("no process to wait for")
	}
	err := h.cmd.Wait()
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			return exitErr.ExitCode(), nil
		}
		return -1, err
	}
	return 0, nil
}

func (r *OSProcessRunner) Start(ctx context.Context, executable string, args []string, workingDir string) (ProcessHandle, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	cmd := exec.Command(executable, args...)
	if workingDir != "" {
		cmd.Dir = workingDir
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return &osProcessHandle{cmd: cmd}, nil
}

// EventEmitter defines a callback for emitting asynchronous lifecycle events to the UI.
type EventEmitter func(event string, data any)

// ActiveLaunch holds metadata for an ongoing engine execution.
type ActiveLaunch struct {
	ID          string    `json:"id"`
	ProfileID   string    `json:"profileId"`
	ProfileName string    `json:"profileName"`
	EngineName  string    `json:"engineName"`
	IWADName    string    `json:"iwadName"`
	Pid         int       `json:"pid"`
	StartedAt   time.Time `json:"startedAt"`
	CommandLine string    `json:"commandLine"`

	handle ProcessHandle
}
// GetPid returns the process ID of the active launch.
func (a *ActiveLaunch) GetPid() int {
	return a.Pid
}

// LauncherService orchestrates profile validation, command-line argument construction,
// process execution, lifecycle monitoring, event emission, and history recording.
type LauncherService struct {
	validator validator.Validator
	profiles  database.ProfileRepository
	history   database.HistoryRepository
	runner    ProcessRunner
	emitter   EventEmitter

	active map[string]*ActiveLaunch
	mu     sync.RWMutex
}

// New creates a new LauncherService instance.
func New(
	validator validator.Validator,
	profiles database.ProfileRepository,
	history database.HistoryRepository,
	runner ProcessRunner,
	emitter EventEmitter,
) *LauncherService {
	return NewLauncherService(validator, profiles, history, runner, emitter)
}

// NewLauncherService creates and initializes a new LauncherService instance.
func NewLauncherService(
	validator validator.Validator,
	profiles database.ProfileRepository,
	history database.HistoryRepository,
	runner ProcessRunner,
	emitter EventEmitter,
) *LauncherService {
	if runner == nil {
		runner = NewOSProcessRunner()
	}
	return &LauncherService{
		validator: validator,
		profiles:  profiles,
		history:   history,
		runner:    runner,
		emitter:   emitter,
		active:    make(map[string]*ActiveLaunch),
	}
}

// LaunchProfile validates a profile by ID, builds its launch arguments, starts the source port process,
// begins asynchronous monitoring, and returns the initial LaunchRecord immediately.
func (s *LauncherService) LaunchProfile(ctx context.Context, profileID string) (*domain.LaunchRecord, error) {
	if s.profiles == nil {
		return nil, errors.New("profile repository is required")
	}

	p, err := s.profiles.Get(profileID)
	if err != nil {
		return nil, fmt.Errorf("failed to load profile %s: %w", profileID, err)
	}
	if p == nil {
		return nil, fmt.Errorf("profile with ID %s not found", profileID)
	}

	return s.LaunchProfileEntity(ctx, p)
}

// LaunchProfileEntity validates a Profile entity, builds arguments, launches the process asynchronously,
// and returns the initial LaunchRecord.
func (s *LauncherService) LaunchProfileEntity(ctx context.Context, p *domain.Profile) (*domain.LaunchRecord, error) {
	if p == nil {
		return nil, errors.New("profile cannot be nil")
	}

	var engine *domain.Engine
	var iwad *domain.IWAD

	// 1. Pre-launch Validation
	if s.validator != nil {
		valResult, err := s.validator.ValidateProfileEntity(ctx, p)
		if err != nil {
			return nil, fmt.Errorf("profile validation error: %w", err)
		}
		if valResult == nil || !valResult.CanLaunch() {
			var errMsgs []string
			if valResult != nil {
				for _, item := range valResult.Errors() {
					errMsgs = append(errMsgs, fmt.Sprintf("[%s] %s", item.Code, item.Message))
				}
			}
			if len(errMsgs) == 0 {
				errMsgs = append(errMsgs, "profile is not ready to launch")
			}
			return nil, fmt.Errorf("profile cannot be launched: %s", strings.Join(errMsgs, "; "))
		}

		engine = valResult.Engine
		iwad = valResult.IWAD
	}

	if engine == nil {
		return nil, errors.New("valid engine is required for launch")
	}
	if iwad == nil {
		return nil, errors.New("valid iwad is required for launch")
	}

	// 2. Build structured command-line arguments
	args, err := BuildArguments(engine, iwad, p.Mods, p.Arguments)
	if err != nil {
		return nil, fmt.Errorf("failed to build launch arguments: %w", err)
	}

	// 3. Record start time & initialize LaunchRecord
	startTime := time.Now().UTC()
	launchID := uuid.NewString()
	cmdLine := FormatCommandLine(engine.Executable, args)

	record := &domain.LaunchRecord{
		ID:          launchID,
		ProfileID:   p.ID,
		ProfileName: p.Name,
		EngineName:  engine.Name,
		IWADName:    iwad.Name,
		StartedAt:   startTime,
		CommandLine: cmdLine,
	}

	// 4. Start external process
	handle, err := s.runner.Start(ctx, engine.Executable, args, p.WorkingDir)
	if err != nil {
		return nil, fmt.Errorf("failed to start process %s: %w", engine.Executable, err)
	}

	// 5. Track active launch
	active := &ActiveLaunch{
		ID:          launchID,
		ProfileID:   p.ID,
		ProfileName: p.Name,
		EngineName:  engine.Name,
		IWADName:    iwad.Name,
		Pid:         handle.Pid(),
		StartedAt:   startTime,
		CommandLine: cmdLine,
		handle:      handle,
	}

	s.mu.Lock()
	s.active[launchID] = active
	s.mu.Unlock()

	// 6. Emit start event
	recCopy := *record
	if s.emitter != nil {
		s.emitter("launch:start", &recCopy)
	}

	// 7. Monitor process lifecycle in background goroutine
	go s.monitorProcess(launchID, handle, recCopy, startTime)

	// 8. Return initial launch record immediately
	return &recCopy, nil
}

// monitorProcess runs in a background goroutine, waiting for process completion,
// computing elapsed duration, persisting the final LaunchRecord to history, and emitting the exit event.
func (s *LauncherService) monitorProcess(launchID string, handle ProcessHandle, record domain.LaunchRecord, startTime time.Time) {
	exitCode, waitErr := handle.Wait()
	finishedAt := time.Now().UTC()
	durationMs := finishedAt.Sub(startTime).Milliseconds()
	if durationMs < 0 {
		durationMs = 0
	}

	// Unregister from active launches
	s.mu.Lock()
	delete(s.active, launchID)
	s.mu.Unlock()

	// Update record with completion details
	record.FinishedAt = finishedAt
	record.DurationMs = durationMs
	record.ExitCode = exitCode
	if exitCode == 0 && waitErr == nil {
		record.Status = domain.LaunchStatusSuccess
	} else {
		record.Status = domain.LaunchStatusFailed
	}

	// Persist to history repository
	if s.history != nil {
		_ = s.history.Add(record)
	}

	// Emit exit event
	if s.emitter != nil {
		s.emitter("launch:exit", &record)
	}
}

// GetActiveLaunches returns a slice of all currently running engine launches,
// ordered by start time descending.
func (s *LauncherService) GetActiveLaunches() []*ActiveLaunch {
	s.mu.RLock()
	defer s.mu.RUnlock()

	launches := make([]*ActiveLaunch, 0, len(s.active))
	for _, a := range s.active {
		launches = append(launches, a)
	}

	sort.Slice(launches, func(i, j int) bool {
		return launches[i].StartedAt.After(launches[j].StartedAt)
	})

	return launches
}

// GetActiveLaunch returns the active launch associated with the specified ID, if found.
func (s *LauncherService) GetActiveLaunch(id string) (*ActiveLaunch, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	launch, ok := s.active[id]
	return launch, ok
}

// KillLaunch forcefully terminates an active launch by its launch ID.
func (s *LauncherService) KillLaunch(id string) error {
	s.mu.RLock()
	active, exists := s.active[id]
	var handle ProcessHandle
	if exists && active != nil {
		handle = active.handle
	}
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("active launch %q not found", id)
	}

	if handle != nil {
		return handle.Kill()
	}
	return nil
}

// KillAll terminates all currently active engine processes.
func (s *LauncherService) KillAll() error {
	s.mu.RLock()
	launches := make([]*ActiveLaunch, 0, len(s.active))
	for _, a := range s.active {
		launches = append(launches, a)
	}
	s.mu.RUnlock()

	var errs []string
	for _, a := range launches {
		if a != nil && a.handle != nil {
			if err := a.handle.Kill(); err != nil {
				errs = append(errs, fmt.Sprintf("%s (PID %d): %v", a.ID, a.Pid, err))
			}
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("failed to kill some processes: %s", strings.Join(errs, "; "))
	}
	return nil
}
