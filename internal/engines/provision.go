package engines

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"rnt-launcher/internal/domain"
)

// provisionHTTPTimeout bounds all network calls made by Ensure.
const provisionHTTPTimeout = 60 * time.Second

// githubReleaseRepos maps engine families with GitHub-hosted releases to
// their "owner/repo" coordinates.
var githubReleaseRepos = map[domain.EngineFamily]string{
	domain.EngineFamilyGZDoom:        "ZDoom/gzdoom",
	domain.EngineFamilyDSDADoom:      "kraflab/dsda-doom",
	domain.EngineFamilyPrBoomPlus:    "coelckers/prboom-plus",
	domain.EngineFamilyWoof:          "fabiangreffrath/woof",
	domain.EngineFamilyCrispyDoom:    "fabiangreffrath/crispy-doom",
	domain.EngineFamilyChocolateDoom: "chocolate-doom/chocolate-doom",
}

// DownloadPageURL returns the official download page for an engine family so
// callers can open it when automatic provisioning is unavailable.
// It returns an empty string for unknown families and EngineFamilyOther.
func DownloadPageURL(family domain.EngineFamily) string {
	switch family {
	case domain.EngineFamilyGZDoom:
		return "https://zdoom.org/downloads"
	case domain.EngineFamilyZandronum:
		return "https://zandronum.com/downloads"
	case domain.EngineFamilyDSDADoom:
		return "https://github.com/kraflab/dsda-doom/releases"
	case domain.EngineFamilyPrBoomPlus:
		return "https://github.com/coelckers/prboom-plus/releases"
	case domain.EngineFamilyWoof:
		return "https://github.com/fabiangreffrath/woof/releases"
	case domain.EngineFamilyCrispyDoom:
		return "https://github.com/fabiangreffrath/crispy-doom/releases"
	case domain.EngineFamilyChocolateDoom:
		return "https://www.chocolate-doom.org/wiki/index.php/Downloads"
	default:
		return ""
	}
}

// Ensure downloads, extracts, and registers an engine build for family,
// resolving version "" or "latest" to the newest GitHub release.
// The build is extracted to enginesDir/<family>-<tag>/ and registered via
// s.Add with Family set and Version set to the release tag.
// Families without a GitHub release source, missing Windows assets, and any
// network/API failure return an error naming DownloadPageURL(family) so the
// caller can open the page instead of failing silently.
func (s *EngineService) Ensure(ctx context.Context, family domain.EngineFamily, version, enginesDir string) (*domain.Engine, error) {
	if !family.IsValid() || family == domain.EngineFamilyOther {
		if page := DownloadPageURL(family); page != "" {
			return nil, fmt.Errorf("engine family %q cannot be auto-provisioned; download manually from %s", family, page)
		}
		return nil, fmt.Errorf("engine family %q cannot be auto-provisioned", family)
	}
	repo, ok := githubReleaseRepos[family]
	if !ok {
		return nil, fmt.Errorf("engine family %q has no GitHub release source; download manually from %s", family, DownloadPageURL(family))
	}
	if strings.TrimSpace(enginesDir) == "" {
		return nil, errors.New("engines directory is required")
	}

	page := DownloadPageURL(family)
	client := &http.Client{Timeout: provisionHTTPTimeout}

	release, err := resolveRelease(ctx, client, repo, version)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve %s release: %w (manual download: %s)", family, err, page)
	}
	if strings.TrimSpace(release.TagName) == "" {
		return nil, fmt.Errorf("release for %s has no tag name; download manually from %s", family, page)
	}

	names := make([]string, 0, len(release.Assets))
	byName := make(map[string]githubReleaseAsset, len(release.Assets))
	for _, a := range release.Assets {
		if strings.TrimSpace(a.Name) == "" {
			continue
		}
		names = append(names, a.Name)
		byName[a.Name] = a
	}
	assetName := pickWindowsAsset(names)
	if assetName == "" {
		return nil, fmt.Errorf("no Windows .zip asset found in %s release %s; download manually from %s", family, release.TagName, page)
	}
	asset := byName[assetName]

	data, err := downloadFile(ctx, client, asset.DownloadURL)
	if err != nil {
		return nil, fmt.Errorf("failed to download %s release %s: %w (manual download: %s)", family, release.TagName, err, page)
	}

	destDir := filepath.Join(enginesDir, string(family)+"-"+sanitizeTagDir(release.TagName))
	if err := extractZip(data, destDir); err != nil {
		return nil, fmt.Errorf("failed to extract %s release %s: %w", family, release.TagName, err)
	}

	exe, err := pickMainExecutable(destDir, family)
	if err != nil {
		return nil, fmt.Errorf("failed to provision %s release %s: %w", family, release.TagName, err)
	}

	registered, err := s.Add(ctx, domain.Engine{
		Executable: exe,
		Version:    release.TagName,
		Family:     family,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to register provisioned %s engine: %w", family, err)
	}
	return registered, nil
}

// pickWindowsAsset selects the best Windows release asset name: a .zip whose
// name contains win64/windows-x64 wins; otherwise a .zip containing
// win32/windows-x86; otherwise "".
func pickWindowsAsset(names []string) string {
	fallback := ""
	for _, n := range names {
		lower := strings.ToLower(n)
		if !strings.HasSuffix(lower, ".zip") {
			continue
		}
		if strings.Contains(lower, "win64") || strings.Contains(lower, "windows-x64") {
			return n
		}
		if fallback == "" && (strings.Contains(lower, "win32") || strings.Contains(lower, "windows-x86")) {
			fallback = n
		}
	}
	return fallback
}

type githubReleaseAsset struct {
	Name        string `json:"name"`
	DownloadURL string `json:"browser_download_url"`
}

type githubRelease struct {
	TagName string               `json:"tag_name"`
	Assets  []githubReleaseAsset `json:"assets"`
}

// resolveRelease fetches release metadata: version "" or "latest" resolves to
// the newest release, otherwise the named tag (trying exact, v-, and g-
// prefixed tag forms).
func resolveRelease(ctx context.Context, client *http.Client, repo, version string) (*githubRelease, error) {
	v := strings.TrimSpace(version)
	if v == "" || strings.EqualFold(v, "latest") {
		return fetchRelease(ctx, client, "https://api.github.com/repos/"+repo+"/releases/latest")
	}
	candidates := dedupeStrings([]string{
		v,
		"v" + strings.TrimLeft(v, "vVgG"),
		"g" + strings.TrimLeft(v, "vVgG"),
	})
	var lastErr error
	for _, tag := range candidates {
		rel, err := fetchRelease(ctx, client, "https://api.github.com/repos/"+repo+"/releases/tags/"+url.PathEscape(tag))
		if err == nil {
			return rel, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func fetchRelease(ctx context.Context, client *http.Client, apiURL string) (*githubRelease, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build release request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "rnt-launcher")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query release API: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4<<10))
		return nil, fmt.Errorf("release API returned status %s", resp.Status)
	}
	var rel githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return nil, fmt.Errorf("failed to decode release metadata: %w", err)
	}
	return &rel, nil
}

func downloadFile(ctx context.Context, client *http.Client, fileURL string) ([]byte, error) {
	if strings.TrimSpace(fileURL) == "" {
		return nil, errors.New("asset has no download URL")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fileURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build download request: %w", err)
	}
	req.Header.Set("User-Agent", "rnt-launcher")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to download asset: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4<<10))
		return nil, fmt.Errorf("download returned status %s", resp.Status)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read downloaded asset: %w", err)
	}
	if len(bytes.TrimSpace(data)) == 0 {
		return nil, errors.New("downloaded asset is empty")
	}
	return data, nil
}

// extractZip extracts data into destDir, rejecting absolute paths and any
// entry escaping destDir (Zip-Slip).
func extractZip(data []byte, destDir string) error {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return fmt.Errorf("failed to open zip archive: %w", err)
	}
	cleanDest := filepath.Clean(destDir)
	for _, f := range r.File {
		name := filepath.FromSlash(f.Name)
		if name == "" || name == "." {
			continue
		}
		if filepath.IsAbs(name) {
			return fmt.Errorf("zip entry has absolute path: %q", f.Name)
		}
		target := filepath.Join(cleanDest, name)
		if target != cleanDest && !strings.HasPrefix(target, cleanDest+string(os.PathSeparator)) {
			return fmt.Errorf("zip entry escapes destination: %q", f.Name)
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return fmt.Errorf("failed to create directory %q: %w", target, err)
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return fmt.Errorf("failed to create directory for %q: %w", target, err)
		}
		if err := writeZipEntry(f, target); err != nil {
			return err
		}
	}
	return nil
}

func writeZipEntry(f *zip.File, target string) error {
	rc, err := f.Open()
	if err != nil {
		return fmt.Errorf("failed to open zip entry %q: %w", f.Name, err)
	}
	defer func() { _ = rc.Close() }()

	out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return fmt.Errorf("failed to create file %q: %w", target, err)
	}
	defer func() { _ = out.Close() }()

	if _, err := io.Copy(out, rc); err != nil {
		return fmt.Errorf("failed to write file %q: %w", target, err)
	}
	return nil
}

// familyExeTokens are lowercase substrings identifying each family's main
// executable.
func familyExeTokens(family domain.EngineFamily) []string {
	switch family {
	case domain.EngineFamilyGZDoom:
		return []string{"gzdoom", "lzdoom", "zdoom"}
	case domain.EngineFamilyZandronum:
		return []string{"zandronum"}
	case domain.EngineFamilyDSDADoom:
		return []string{"dsda"}
	case domain.EngineFamilyPrBoomPlus:
		return []string{"prboom"}
	case domain.EngineFamilyWoof:
		return []string{"woof"}
	case domain.EngineFamilyCrispyDoom:
		return []string{"crispy"}
	case domain.EngineFamilyChocolateDoom:
		return []string{"chocolate", "choco"}
	default:
		return nil
	}
}

// pickMainExecutable finds the main engine binary under destDir: the largest
// .exe whose base name matches the family, else the largest .exe overall.
func pickMainExecutable(destDir string, family domain.EngineFamily) (string, error) {
	type candidate struct {
		path string
		size int64
	}
	var familyMatch, all []candidate
	tokens := familyExeTokens(family)
	err := filepath.WalkDir(destDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !strings.EqualFold(filepath.Ext(path), ".exe") {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		c := candidate{path: path, size: info.Size()}
		all = append(all, c)
		base := strings.ToLower(strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)))
		for _, tok := range tokens {
			if strings.Contains(base, tok) {
				familyMatch = append(familyMatch, c)
				break
			}
		}
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("failed to scan extracted files: %w", err)
	}
	pool := familyMatch
	if len(pool) == 0 {
		pool = all
	}
	if len(pool) == 0 {
		return "", errors.New("extracted archive contains no .exe file")
	}
	best := pool[0]
	for _, c := range pool[1:] {
		if c.size > best.size {
			best = c
		}
	}
	return best.path, nil
}

// sanitizeTagDir makes a release tag safe for use as a single path element.
func sanitizeTagDir(tag string) string {
	tag = strings.TrimSpace(tag)
	tag = strings.ReplaceAll(tag, "/", "_")
	tag = strings.ReplaceAll(tag, "\\", "_")
	tag = strings.Trim(tag, ".")
	if tag == "" {
		return "unknown"
	}
	return tag
}

func dedupeStrings(in []string) []string {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, s := range in {
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}
