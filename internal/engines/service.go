package engines

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
)

// CommandRunner defines the function signature for executing external binaries.
type CommandRunner func(ctx context.Context, name string, args ...string) ([]byte, error)

func defaultCommandRunner(ctx context.Context, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	return cmd.CombinedOutput()
}

// EngineService coordinates operations on Doom source port engine executables and persistence.
type EngineService struct {
	repo   database.EngineRepository
	runner CommandRunner
}

// New creates a new EngineService with default runner.
func New(repo database.EngineRepository) *EngineService {
	return NewEngineService(repo)
}

// NewEngineService creates a new EngineService with default runner.
func NewEngineService(repo database.EngineRepository) *EngineService {
	return &EngineService{
		repo:   repo,
		runner: defaultCommandRunner,
	}
}

// NewEngineServiceWithRunner creates a new EngineService with a custom runner (useful for testing/mocking).
func NewEngineServiceWithRunner(repo database.EngineRepository, runner CommandRunner) *EngineService {
	if runner == nil {
		runner = defaultCommandRunner
	}
	return &EngineService{
		repo:   repo,
		runner: runner,
	}
}

// SetCommandRunner sets the external command runner (useful for unit tests).
func (s *EngineService) SetCommandRunner(runner CommandRunner) {
	if runner == nil {
		runner = defaultCommandRunner
	}
	s.runner = runner
}

// List retrieves all registered engines.
func (s *EngineService) List(ctx context.Context) ([]domain.Engine, error) {
	return s.repo.List()
}

// Get retrieves a single engine by ID.
func (s *EngineService) Get(ctx context.Context, id string) (*domain.Engine, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("engine ID cannot be empty")
	}
	return s.repo.Get(id)
}

// Add registers a new engine, inferring metadata if absent.
func (s *EngineService) Add(ctx context.Context, engine domain.Engine) (*domain.Engine, error) {
	if strings.TrimSpace(engine.Executable) == "" {
		return nil, errors.New("executable path is required")
	}

	// Auto-detect version and family if needed
	if engine.Version == "" || engine.Family == "" || !engine.Family.IsValid() || engine.Family == domain.EngineFamilyOther {
		detectedVer, detectedFam := s.DetectVersion(ctx, engine.Executable)
		if engine.Version == "" {
			engine.Version = detectedVer
		}
		if engine.Family == "" || !engine.Family.IsValid() || engine.Family == domain.EngineFamilyOther {
			if detectedFam.IsValid() && detectedFam != domain.EngineFamilyOther {
				engine.Family = detectedFam
			} else if engine.Family == "" {
				engine.Family = detectedFam
			}
		}
	}

	if engine.Name == "" {
		if engine.Family.IsValid() && engine.Family != domain.EngineFamilyOther {
			engine.Name = engine.Family.DisplayName()
		} else {
			base := filepath.Base(engine.Executable)
			ext := filepath.Ext(base)
			engine.Name = strings.TrimSuffix(base, ext)
		}
	}

	if err := s.repo.Create(&engine); err != nil {
		return nil, err
	}
	return &engine, nil
}

// Update modifies an existing engine's properties.
func (s *EngineService) Update(ctx context.Context, engine domain.Engine) error {
	if strings.TrimSpace(engine.ID) == "" {
		return errors.New("engine ID is required")
	}
	if strings.TrimSpace(engine.Executable) == "" {
		return errors.New("executable path is required")
	}
	if engine.Name == "" {
		base := filepath.Base(engine.Executable)
		ext := filepath.Ext(base)
		engine.Name = strings.TrimSuffix(base, ext)
	}
	if engine.Family == "" || !engine.Family.IsValid() {
		engine.Family = DetectFamilyFromPath(engine.Executable)
	}
	return s.repo.Update(&engine)
}

// Delete removes an engine by ID.
func (s *EngineService) Delete(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("engine ID is required")
	}
	return s.repo.Delete(id)
}

// DetectVersion executes the binary with --version or -version and parses output to detect version and engine family.
// If detection fails, times out, or cannot be executed, it returns "Unknown" and family derived from path without returning error.
func (s *EngineService) DetectVersion(ctx context.Context, execPath string) (string, domain.EngineFamily) {
	runner := s.runner
	if runner == nil {
		runner = defaultCommandRunner
	}
	return detectVersionWithRunner(ctx, execPath, runner)
}

// DetectVersion is the package-level version detection function.
func DetectVersion(ctx context.Context, execPath string) (string, domain.EngineFamily) {
	return detectVersionWithRunner(ctx, execPath, defaultCommandRunner)
}

func detectVersionWithRunner(ctx context.Context, execPath string, runner CommandRunner) (string, domain.EngineFamily) {
	if strings.TrimSpace(execPath) == "" {
		return "Unknown", domain.EngineFamilyOther
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	// Try --version first
	out, err := runner(timeoutCtx, execPath, "--version")
	if err != nil || len(bytes.TrimSpace(out)) == 0 {
		// If --version failed or returned empty output, try -version
		timeoutCtx2, cancel2 := context.WithTimeout(ctx, 2*time.Second)
		defer cancel2()
		out2, err2 := runner(timeoutCtx2, execPath, "-version")
		if err2 == nil && len(bytes.TrimSpace(out2)) > 0 {
			out = out2
			err = nil
		}
	}

	if err != nil && len(bytes.TrimSpace(out)) == 0 {
		return "Unknown", DetectFamilyFromPath(execPath)
	}

	return ParseVersionOutput(string(out), execPath)
}

var engineRules = []struct {
	family  domain.EngineFamily
	matchRe *regexp.Regexp
	verRe   *regexp.Regexp
}{
	{
		family:  domain.EngineFamilyGZDoom,
		matchRe: regexp.MustCompile(`(?i)\b(?:gzdoom|lzdoom|zdoom)\b`),
		verRe:   regexp.MustCompile(`(?i)(?:gzdoom|lzdoom|zdoom)[^\d\n\r]*[vg]?\s*([0-9]+(?:\.[0-9]+)+(?:[a-zA-Z0-9_.-]+)?)`),
	},
	{
		family:  domain.EngineFamilyZandronum,
		matchRe: regexp.MustCompile(`(?i)\bzandronum\b`),
		verRe:   regexp.MustCompile(`(?i)zandronum[^\d\n\r]*[v]?\s*([0-9]+(?:\.[0-9]+)+(?:[a-zA-Z0-9_.-]+)?)`),
	},
	{
		family:  domain.EngineFamilyDSDADoom,
		matchRe: regexp.MustCompile(`(?i)\bdsda[- ]doom\b`),
		verRe:   regexp.MustCompile(`(?i)dsda[- ]doom[^\d\n\r]*[v]?\s*([0-9]+(?:\.[0-9]+)+(?:[a-zA-Z0-9_.-]+)?)`),
	},
	{
		family:  domain.EngineFamilyPrBoomPlus,
		matchRe: regexp.MustCompile(`(?i)\bprboom(?:-plus|\+)?\b`),
		verRe:   regexp.MustCompile(`(?i)prboom(?:-plus|\+)?[^\d\n\r]*[v]?\s*([0-9]+(?:\.[0-9]+)+(?:[a-zA-Z0-9_.-]+)?)`),
	},
	{
		family:  domain.EngineFamilyWoof,
		matchRe: regexp.MustCompile(`(?i)\bwoof!?\b`),
		verRe:   regexp.MustCompile(`(?i)woof!?[^\d\n\r]*[v]?\s*([0-9]+(?:\.[0-9]+)+(?:[a-zA-Z0-9_.-]+)?)`),
	},
	{
		family:  domain.EngineFamilyCrispyDoom,
		matchRe: regexp.MustCompile(`(?i)\bcrispy(?:\s+doom)?\b`),
		verRe:   regexp.MustCompile(`(?i)crispy(?:\s+doom)?[^\d\n\r]*[v]?\s*([0-9]+(?:\.[0-9]+)+(?:[a-zA-Z0-9_.-]+)?)`),
	},
	{
		family:  domain.EngineFamilyChocolateDoom,
		matchRe: regexp.MustCompile(`(?i)\bchocolate(?:\s+doom)?\b`),
		verRe:   regexp.MustCompile(`(?i)chocolate(?:\s+doom)?[^\d\n\r]*[v]?\s*([0-9]+(?:\.[0-9]+)+(?:[a-zA-Z0-9_.-]+)?)`),
	},
}

var genericVerRegex = regexp.MustCompile(`(?i)(?:version\s*|v|g)?\s*([0-9]+(?:\.[0-9]+)+(?:[a-zA-Z0-9_.-]+)?)`)

// ParseVersionOutput extracts the engine version and engine family from command line banner/version text.
func ParseVersionOutput(output, execPath string) (string, domain.EngineFamily) {
	cleaned := strings.TrimSpace(output)
	if cleaned == "" {
		return "Unknown", DetectFamilyFromPath(execPath)
	}

	detectedFamily := domain.EngineFamily("")
	detectedVersion := ""

	for _, rule := range engineRules {
		if rule.matchRe.MatchString(cleaned) {
			detectedFamily = rule.family
			if m := rule.verRe.FindStringSubmatch(cleaned); len(m) > 1 {
				detectedVersion = cleanVersionString(m[1])
			}
			break
		}
	}

	// If family was not found in output, derive from execPath
	if detectedFamily == "" {
		detectedFamily = DetectFamilyFromPath(execPath)
	}

	// If version was not extracted by specific family rule, try generic semver regex
	if detectedVersion == "" {
		if m := genericVerRegex.FindStringSubmatch(cleaned); len(m) > 1 {
			detectedVersion = cleanVersionString(m[1])
		}
	}

	if detectedVersion == "" {
		detectedVersion = "Unknown"
	}
	if !detectedFamily.IsValid() {
		detectedFamily = domain.EngineFamilyOther
	}

	return detectedVersion, detectedFamily
}

func cleanVersionString(ver string) string {
	ver = strings.TrimSpace(ver)
	ver = strings.TrimPrefix(ver, "v")
	ver = strings.TrimPrefix(ver, "V")
	ver = strings.TrimPrefix(ver, "g")
	ver = strings.TrimPrefix(ver, "G")
	ver = strings.Trim(ver, " ,;:-()[]{}")
	return ver
}

// DetectFamilyFromPath derives the engine family from an executable base name or file path.
func DetectFamilyFromPath(execPath string) domain.EngineFamily {
	base := strings.ToLower(filepath.Base(execPath))
	ext := filepath.Ext(base)
	baseWithoutExt := strings.TrimSuffix(base, ext)

	switch {
	case strings.Contains(baseWithoutExt, "gzdoom") || strings.Contains(baseWithoutExt, "lzdoom") || strings.Contains(baseWithoutExt, "zdoom"):
		return domain.EngineFamilyGZDoom
	case strings.Contains(baseWithoutExt, "zandronum"):
		return domain.EngineFamilyZandronum
	case strings.Contains(baseWithoutExt, "dsda-doom") || strings.Contains(baseWithoutExt, "dsdadoom") || strings.Contains(baseWithoutExt, "dsda"):
		return domain.EngineFamilyDSDADoom
	case strings.Contains(baseWithoutExt, "prboom-plus") || strings.Contains(baseWithoutExt, "prboom+") || strings.Contains(baseWithoutExt, "prboom_plus") || strings.Contains(baseWithoutExt, "prboom"):
		return domain.EngineFamilyPrBoomPlus
	case strings.Contains(baseWithoutExt, "woof"):
		return domain.EngineFamilyWoof
	case strings.Contains(baseWithoutExt, "crispy"):
		return domain.EngineFamilyCrispyDoom
	case strings.Contains(baseWithoutExt, "chocolate") || strings.Contains(baseWithoutExt, "chocodoom"):
		return domain.EngineFamilyChocolateDoom
	default:
		return domain.EngineFamilyOther
	}
}

// ValidateExecutable checks if the given file path exists, is a regular file, and is executable.
func ValidateExecutable(execPath string) error {
	if strings.TrimSpace(execPath) == "" {
		return errors.New("executable path cannot be empty")
	}

	info, err := os.Stat(execPath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("executable file does not exist: %s", execPath)
		}
		return fmt.Errorf("failed to access executable path: %w", err)
	}

	if info.IsDir() {
		return fmt.Errorf("executable path is a directory, not a file: %s", execPath)
	}

	if runtime.GOOS == "windows" {
		ext := strings.ToLower(filepath.Ext(execPath))
		switch ext {
		case ".exe", ".bat", ".cmd", ".com":
			return nil
		default:
			return fmt.Errorf("file %q does not have an executable extension on Windows (.exe, .bat, .cmd)", execPath)
		}
	}

	// On Unix-like platforms, verify executable bit
	if info.Mode().Perm()&0111 == 0 {
		return fmt.Errorf("file %q is not executable (missing execute permission)", execPath)
	}

	return nil
}

// ValidateExecutable checks executable validity as a method on EngineService.
func (s *EngineService) ValidateExecutable(execPath string) error {
	return ValidateExecutable(execPath)
}
