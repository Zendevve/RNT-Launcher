package launcher

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/saves"
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
	return r.StartWithOutput(ctx, executable, args, workingDir, nil)
}

// streamingRunner is implemented by process runners that can stream per-line
// stdout/stderr output to a callback while the process runs.
type streamingRunner interface {
	StartWithOutput(ctx context.Context, executable string, args []string, workingDir string, onOutput func(stream, line string)) (ProcessHandle, error)
}

// osStreamingHandle wraps osProcessHandle and additionally waits for the
// stdout/stderr scanner goroutines to drain before Wait returns.
type osStreamingHandle struct {
	osProcessHandle
	wg *sync.WaitGroup
}

// Wait waits for the process to exit and for streamed output to drain.
func (h *osStreamingHandle) Wait() (int, error) {
	code, err := h.osProcessHandle.Wait()
	if h.wg != nil {
		h.wg.Wait()
	}
	return code, err
}

// scanLines feeds each scanned line to fn until the reader is exhausted.
func scanLines(reader io.Reader, fn func(line string)) {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		fn(scanner.Text())
	}
}

// StartWithOutput starts the process and streams per-line stdout/stderr output
// to onOutput ("stdout"/"stderr" stream names). A nil callback disables
// streaming; the launch never fails because of output capture.
func (r *OSProcessRunner) StartWithOutput(ctx context.Context, executable string, args []string, workingDir string, onOutput func(stream, line string)) (ProcessHandle, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	cmd := exec.Command(executable, args...)
	if workingDir != "" {
		cmd.Dir = workingDir
	}
	var wg sync.WaitGroup
	if onOutput != nil {
		if stdout, err := cmd.StdoutPipe(); err == nil {
			wg.Add(1)
			go func() {
				defer wg.Done()
				scanLines(stdout, func(line string) { onOutput("stdout", line) })
			}()
		}
		if stderr, err := cmd.StderrPipe(); err == nil {
			wg.Add(1)
			go func() {
				defer wg.Done()
				scanLines(stderr, func(line string) { onOutput("stderr", line) })
			}()
		}
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return &osStreamingHandle{osProcessHandle: osProcessHandle{cmd: cmd}, wg: &wg}, nil
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

// maxLaunchLogLines bounds how many trailing output lines are retained per
// launch for crash diagnostics.
const maxLaunchLogLines = 200

// CrashReport describes a nonzero-exit launch for the launcher:crashed event.
type CrashReport struct {
	LaunchID    string `json:"launchId"`
	ProfileID   string `json:"profileId"`
	ProfileName string `json:"profileName"`
	ExitCode    int    `json:"exitCode"`
	LogPath     string `json:"logPath"`
}

// LauncherService orchestrates profile validation, command-line argument construction,
// process execution, lifecycle monitoring, event emission, and history recording.
type LauncherService struct {
	validator validator.Validator
	profiles  database.ProfileRepository
	history   database.HistoryRepository
	runner    ProcessRunner
	emitter   EventEmitter
	saves     *saves.SaveService

	active map[string]*ActiveLaunch
	mu     sync.RWMutex

	// launchLogs retains the trailing output lines per launch for crash
	// diagnostics; drained when the process exits.
	launchLogs map[string][]string
	logsMu     sync.Mutex
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
		validator:  validator,
		profiles:   profiles,
		history:    history,
		runner:     runner,
		emitter:    emitter,
		active:     make(map[string]*ActiveLaunch),
		launchLogs: make(map[string][]string),
	}
}

// SetSaveService configures the SaveService for per-profile save isolation.
func (s *LauncherService) SetSaveService(saves *saves.SaveService) {
	s.saves = saves
}

// AppendLaunchLog buffers one line of process output for a launch, retaining
// only the last maxLaunchLogLines lines for crash diagnostics.
func (s *LauncherService) AppendLaunchLog(launchID, line string) {
	if s == nil || strings.TrimSpace(launchID) == "" {
		return
	}
	s.logsMu.Lock()
	defer s.logsMu.Unlock()
	if s.launchLogs == nil {
		s.launchLogs = make(map[string][]string)
	}
	buf := append(s.launchLogs[launchID], line)
	if len(buf) > maxLaunchLogLines {
		buf = append([]string(nil), buf[len(buf)-maxLaunchLogLines:]...)
	}
	s.launchLogs[launchID] = buf
}

// takeLaunchLogs drains and returns the buffered output lines for a launch.
func (s *LauncherService) takeLaunchLogs(launchID string) []string {
	s.logsMu.Lock()
	defer s.logsMu.Unlock()
	buf := s.launchLogs[launchID]
	delete(s.launchLogs, launchID)
	return buf
}

// emitOutput buffers one line of launch output and emits it on the
// per-launch stream event (launcher:stdout:<launchID> or
// launcher:stderr:<launchID>). Unknown stream names fall back to stdout.
// It never fails the launch.
func (s *LauncherService) emitOutput(launchID, stream, line string) {
	if s == nil {
		return
	}
	s.AppendLaunchLog(launchID, line)
	if s.emitter == nil {
		return
	}
	if stream == "stderr" {
		s.emitter("launcher:stderr:"+launchID, line)
		return
	}
	s.emitter("launcher:stdout:"+launchID, line)
}

// GetLaunchLogs returns a copy of the retained output tail for a launch,
// oldest first. A limit <= 0 returns the last maxLaunchLogLines lines.
// Buffers are drained on process exit, so post-exit calls may return nil.
func (s *LauncherService) GetLaunchLogs(launchID string, limit int) []string {
	if s == nil {
		return nil
	}
	if limit <= 0 {
		limit = maxLaunchLogLines
	}
	s.logsMu.Lock()
	defer s.logsMu.Unlock()
	buf := s.launchLogs[launchID]
	if len(buf) > limit {
		buf = buf[len(buf)-limit:]
	}
	out := make([]string, len(buf))
	copy(out, buf)
	return out
}

// crashLogDir resolves where crash_<launchID>.log files are written:
// <saves-base>/crashes when a SaveService is configured, otherwise the OS
// temp directory. The directory is created on demand by writeCrashLog.
func (s *LauncherService) crashLogDir() string {
	if s != nil && s.saves != nil && strings.TrimSpace(s.saves.BaseDir()) != "" {
		return filepath.Join(s.saves.BaseDir(), "crashes")
	}
	return filepath.Join(os.TempDir(), "rnt-launcher-crashes")
}

// sanitizeCrashComponent keeps only [A-Za-z0-9_-] for crash log file names.
func sanitizeCrashComponent(v string) string {
	var b strings.Builder
	b.Grow(len(v))
	for _, r := range v {
		if r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	if b.Len() == 0 {
		return "unknown"
	}
	return b.String()
}

// writeCrashLog persists the last buffered output lines for a failed launch
// to crash_<launchID>.log. It never returns an error: failures yield an empty
// path so the exit path stays infallible.
func (s *LauncherService) writeCrashLog(launchID string, record domain.LaunchRecord, lines []string) string {
	if len(lines) > maxLaunchLogLines {
		lines = lines[len(lines)-maxLaunchLogLines:]
	}
	var b strings.Builder
	fmt.Fprintf(&b, "RNT Launcher crash log\nlaunch: %s\nprofile: %s (%s)\nengine: %s\ncommand: %s\nexit code: %d\n--- last %d output line(s) ---\n",
		launchID, record.ProfileName, record.ProfileID, record.EngineName, record.CommandLine, record.ExitCode, len(lines))
	for _, line := range lines {
		b.WriteString(line)
		if !strings.HasSuffix(line, "\n") {
			b.WriteByte('\n')
		}
	}
	dir := s.crashLogDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return ""
	}
	logPath := filepath.Join(dir, "crash_"+sanitizeCrashComponent(launchID)+".log")
	if err := os.WriteFile(logPath, []byte(b.String()), 0644); err != nil {
		return ""
	}
	return logPath
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

	// 2. Build structured command-line arguments (including inherited parent mixins)
	effectiveMods := p.Mods
	if p.ParentProfileID != "" && s.profiles != nil {
		if parent, err := s.profiles.Get(p.ParentProfileID); err == nil && parent != nil {
			effectiveMods = p.GetEffectiveMods(parent)
		}
	}

	args, err := BuildArguments(engine, iwad, effectiveMods, p.Arguments)
	if err != nil {
		return nil, fmt.Errorf("failed to build launch arguments: %w", err)
	}

	// Inject isolated save directory if enabled
	if p.IsolateSaves && s.saves != nil {
		saveDir, err := s.saves.EnsureProfileSaveDir(p.ID)
		if err == nil && saveDir != "" {
			dialect := GetDialect(engine.Family)
			if saveArgs := dialect.FormatSaveDir(saveDir); len(saveArgs) > 0 {
				args = append(args, saveArgs...)
			}
		}
	}

	// Append multiplayer and demo arguments from the profile via the engine
	// family dialect. Unknown families receive generic flags; this never
	// fails the launch.
	launchDialect := GetDialect(engine.Family)
	if netArgs := launchDialect.FormatNetArgs(p.NetMode, p.NetHost, p.NetPort); len(netArgs) > 0 {
		args = append(args, netArgs...)
	}
	if demoArgs := launchDialect.FormatDemoArgs(p.RecordDemoPath, p.PlayDemoPath); len(demoArgs) > 0 {
		args = append(args, demoArgs...)
	}

	// 3. Record start time & initialize LaunchRecord
	startTime := time.Now().UTC()
	launchID := uuid.NewString()
	cmdLine := FormatCommandLine(engine.Executable, args)

	demoPath := strings.TrimSpace(p.RecordDemoPath)
	if demoPath == "" {
		demoPath = strings.TrimSpace(p.PlayDemoPath)
	}

	record := &domain.LaunchRecord{
		ID:          launchID,
		ProfileID:   p.ID,
		ProfileName: p.Name,
		EngineName:  engine.Name,
		IWADName:    iwad.Name,
		StartedAt:   startTime,
		CommandLine: cmdLine,
		DemoPath:    demoPath,
	}

	// 4. Start external process, streaming stdout/stderr per line when the
	// runner supports it. Runners without streaming keep the previous
	// behavior; the launch never fails because of output capture.
	var handle ProcessHandle
	if sr, ok := s.runner.(streamingRunner); ok {
		handle, err = sr.StartWithOutput(ctx, engine.Executable, args, p.WorkingDir, func(stream, line string) {
			s.emitOutput(launchID, stream, line)
		})
	} else {
		handle, err = s.runner.Start(ctx, engine.Executable, args, p.WorkingDir)
	}
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

	// Emit exit events: the historical launch:exit name is preserved, and a
	// launcher:exit alias carries the same final record for live session UI.
	if s.emitter != nil {
		s.emitter("launch:exit", &record)
		s.emitter("launcher:exit", &record)
	}

	// On nonzero exit, persist the last buffered output lines and emit a
	// crash event. Buffered logs are drained for every exit to bound memory.
	lines := s.takeLaunchLogs(launchID)
	if record.Status == domain.LaunchStatusFailed {
		logPath := s.writeCrashLog(launchID, record, lines)
		if s.emitter != nil {
			s.emitter("launcher:crashed", &CrashReport{
				LaunchID:    launchID,
				ProfileID:   record.ProfileID,
				ProfileName: record.ProfileName,
				ExitCode:    exitCode,
				LogPath:     logPath,
			})
		}
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
