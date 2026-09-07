package scanner

import (
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/filesystem"
)

// depTextFiles are lump/entry basenames scanned for dependency declarations.
var depTextFiles = []string{
	"REQUIREMENTS", "README", "MAPINFO", "UMAPINFO", "ZMAPINFO", "EMAPINFO",
	"GAMEINFO", "LOADORDER",
}

// depLineRegex matches `$requires "name"`, `requires: a, b`, `depends-on = x`
// style declarations inside text lumps.
var depLineRegex = regexp.MustCompile(`(?i)^\s*(?:\$requires|requires?|depends?(?:-on)?|load-?order)\s*[:=]?\s*["']?([^"'\r\n]+?)\s*["']?\s*$`)

// versionSuffix strips trailing version/build markers so `brutalv21` and
// `brutal_doom_v2` collapse to a comparable provides token.
var versionSuffix = regexp.MustCompile(`(?i)[_.\-]?v?\d+(\.\d+)*([_.\-](final|fix|update|patch|rev|r\d+))*$`)

const maxDepTextBytes = 64 * 1024

// ResolveDependencies returns declared dependency names for a mod by parsing
// REQUIREMENTS/README/MAPINFO `$requires` lines plus filename-prefix
// heuristics. It never errors: unparseable files yield no dependencies.
func ResolveDependencies(mod domain.Mod) []string {
	deps := make([]string, 0)
	seen := make(map[string]bool)
	add := func(name string) {
		for _, part := range strings.FieldsFunc(name, func(r rune) bool {
			return r == ',' || r == ';' || r == '|'
		}) {
			n := normalizeDepName(part)
			if n == "" || seen[strings.ToLower(n)] {
				continue
			}
			seen[strings.ToLower(n)] = true
			deps = append(deps, n)
		}
	}

	if strings.TrimSpace(mod.Path) != "" {
		for _, text := range readDepTexts(mod.Path) {
			for _, line := range strings.Split(text, "\n") {
				if m := depLineRegex.FindStringSubmatch(strings.TrimRight(line, "\r")); m != nil {
					add(m[1])
				}
			}
		}
		for _, h := range heuristicDeps(mod.Path) {
			add(h)
		}
	}
	return deps
}

// normalizeDepName trims quotes/whitespace and drops file extensions and
// version suffixes for library comparison.
func normalizeDepName(raw string) string {
	n := strings.Trim(strings.TrimSpace(raw), `"'`)
	n = strings.TrimSpace(strings.TrimSuffix(n, filepath.Ext(n)))
	n = versionSuffix.ReplaceAllString(n, "")
	return strings.Trim(n, "_. -")
}

// heuristicDeps splits combined-mod filename markers (`+`, `_with_`,
// `_requires_`, `_plus_`) into probable required base names.
func heuristicDeps(modPath string) []string {
	stem := strings.TrimSuffix(filepath.Base(modPath), filepath.Ext(modPath))
	lower := strings.ToLower(stem)
	var parts []string
	switch {
	case strings.Contains(lower, "_with_"):
		parts = strings.Split(lower, "_with_")
	case strings.Contains(lower, "_requires_"):
		parts = strings.Split(lower, "_requires_")
	case strings.Contains(lower, "_plus_"):
		parts = strings.Split(lower, "_plus_")
	case strings.Contains(stem, "+"):
		parts = strings.Split(stem, "+")
	default:
		return nil
	}
	out := make([]string, 0, len(parts)-1)
	for _, p := range parts[1:] {
		if n := normalizeDepName(p); n != "" {
			out = append(out, n)
		}
	}
	return out
}

// readDepTexts extracts small dependency-declaration texts from WAD lumps or
// archive entries, capped at maxDepTextBytes per file.
func readDepTexts(modPath string) []string {
	f, err := os.Open(modPath)
	if err != nil {
		return nil
	}
	defer f.Close()
	stat, err := f.Stat()
	if err != nil || stat.Size() <= 0 {
		return nil
	}

	info, err := filesystem.InspectFile(modPath)
	if err != nil || info == nil {
		return nil
	}
	var texts []string
	push := func(data []byte) {
		if len(data) == 0 {
			return
		}
		if len(data) > maxDepTextBytes {
			data = data[:maxDepTextBytes]
		}
		if isText(data) {
			texts = append(texts, string(data))
		}
	}

	switch {
	case info.WADInfo != nil:
		for _, lump := range info.WADInfo.Lumps {
			upper := strings.ToUpper(lump)
			hit := false
			for _, want := range depTextFiles {
				if upper == want {
					hit = true
					break
				}
			}
			if !hit {
				continue
			}
			data, err := filesystem.ReadLumpData(f, stat.Size(), lump)
			if err == nil {
				push(data)
			}
		}
	case info.ArchiveInfo != nil:
		zr, err := zip.NewReader(f, stat.Size())
		if err != nil {
			return texts
		}
		for _, zf := range zr.File {
			if zf.FileInfo().IsDir() {
				continue
			}
			base := strings.ToUpper(strings.TrimSuffix(filepath.Base(zf.Name), filepath.Ext(zf.Name)))
			hit := false
			for _, want := range depTextFiles {
				if base == want {
					hit = true
					break
				}
			}
			if !hit {
				continue
			}
			rc, err := zf.Open()
			if err != nil {
				continue
			}
			var buf bytes.Buffer
			_, _ = buf.ReadFrom(rc)
			_ = rc.Close()
			push(buf.Bytes())
		}
	}
	return texts
}

// isText reports whether data is plausibly human-readable text.
func isText(data []byte) bool {
	if len(data) == 0 || bytes.IndexByte(data, 0) != -1 {
		return false
	}
	printable := 0
	for _, b := range data {
		if b == '\n' || b == '\r' || b == '\t' || (b >= 32 && b < 127) {
			printable++
		}
	}
	return float64(printable)/float64(len(data)) > 0.8
}
