package launcher

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"unicode"

	"rnt-launcher/internal/domain"
)

// BuildArguments constructs a structured command-line argument slice for running a Doom engine.
// Arguments are structured as:
//   -iwad <iwad_path> [-file <mod1_path> <mod2_path> ...] [...customArgs]
//
// Mods are filtered to only enabled entries and sorted in ascending load order (Order field).
// Custom arguments are appended directly without shell interpolation.
func BuildArguments(engine *domain.Engine, iwad *domain.IWAD, mods []domain.ProfileMod, customArgs []string) ([]string, error) {
	if engine == nil {
		return nil, errors.New("engine is required")
	}
	if iwad == nil {
		return nil, errors.New("iwad is required")
	}
	iwadPath := strings.TrimSpace(iwad.Path)
	if iwadPath == "" {
		return nil, errors.New("iwad path cannot be empty")
	}
	dialect := GetDialect(engine.Family)
	args := make([]string, 0, 4+len(mods)+len(customArgs))

	// 1. Base IWAD argument
	args = append(args, "-iwad", iwadPath)

	// 2. Mod files (only enabled, sorted by Order ascending)
	var enabledMods []domain.ProfileMod
	for _, m := range mods {
		if m.Enabled && strings.TrimSpace(m.ModPath) != "" {
			enabledMods = append(enabledMods, m)
		}
	}

	if len(enabledMods) > 0 {
		sort.SliceStable(enabledMods, func(i, j int) bool {
			return enabledMods[i].Order < enabledMods[j].Order
		})

		var modFiles []string
		var dehFiles []string
		for _, m := range enabledMods {
			p := strings.TrimSpace(m.ModPath)
			ext := strings.ToLower(p)
			if strings.HasSuffix(ext, ".deh") || strings.HasSuffix(ext, ".bex") {
				dehFiles = append(dehFiles, p)
			} else {
				modFiles = append(modFiles, p)
			}
		}

		if len(modFiles) > 0 {
			args = append(args, dialect.FormatFile(modFiles)...)
		}
		if len(dehFiles) > 0 {
			args = append(args, dialect.FormatDeh(dehFiles)...)
		}
	}
	// 3. Custom arguments appended directly
	for _, arg := range customArgs {
		trimmed := strings.TrimSpace(arg)
		if trimmed != "" {
			args = append(args, trimmed)
		}
	}

	return args, nil
}

// BuildArgumentsForProfile builds command-line arguments using a Profile entity.
func BuildArgumentsForProfile(profile *domain.Profile, engine *domain.Engine, iwad *domain.IWAD) ([]string, error) {
	if profile == nil {
		return nil, errors.New("profile is required")
	}
	return BuildArguments(engine, iwad, profile.Mods, profile.Arguments)
}

// FormatCommandLine produces a human-readable display string representing the executable and arguments.
// Arguments containing whitespace are quoted for clarity.
func FormatCommandLine(executable string, args []string) string {
	parts := make([]string, 0, len(args)+1)
	if strings.Contains(executable, " ") {
		parts = append(parts, fmt.Sprintf("%q", executable))
	} else {
		parts = append(parts, executable)
	}

	for _, arg := range args {
		if strings.Contains(arg, " ") {
			parts = append(parts, fmt.Sprintf("%q", arg))
		} else {
			parts = append(parts, arg)
		}
	}

	return strings.Join(parts, " ")
}

// SplitCustomArgs splits a raw custom argument string into discrete tokens,
// properly preserving single and double-quoted substrings.
func SplitCustomArgs(raw string) []string {
	var args []string
	var current strings.Builder
	inQuote := false
	var quoteChar rune

	for _, r := range raw {
		switch {
		case !inQuote && (r == '"' || r == '\''):
			inQuote = true
			quoteChar = r
		case inQuote && r == quoteChar:
			inQuote = false
			quoteChar = 0
		case !inQuote && unicode.IsSpace(r):
			if current.Len() > 0 {
				args = append(args, current.String())
				current.Reset()
			}
		default:
			current.WriteRune(r)
		}
	}

	if current.Len() > 0 {
		args = append(args, current.String())
	}

	return args
}
