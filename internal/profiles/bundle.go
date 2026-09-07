package profiles

import (
	"archive/zip"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"gopkg.in/yaml.v3"

	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/filesystem"
)

// ShareCodePrefix is the URI prefix identifying a share-code encoded bundle manifest.
const ShareCodePrefix = "rnt://pack/"

// BundleVersion is the manifest schema version written by ExportBundle and
// accepted by ImportBundle and ParseShareCode.
const BundleVersion = 1

// BundleManifest describes the contents of a .rntpack shareable bundle.
// ModHashes holds the SHA-256 of each bundled mod file in profile load order.
type BundleManifest struct {
	Name         string   `json:"name"`
	EngineFamily string   `json:"engineFamily"`
	IWADType     string   `json:"iwadType"`
	ModHashes    []string `json:"modHashes"`
	Version      int      `json:"version"`
}

// ExportBundle packages a profile and its mod files into a .rntpack zip archive.
//
// The archive contains profile.yaml (the existing YAML serializer output),
// mods/* (copied mod files by basename), and manifest.json. It returns the zip
// path (created under the OS temp dir; the caller owns the file) and a
// share code ("rnt://pack/" + base64url-encoded manifest JSON).
func (s *ProfileService) ExportBundle(ctx context.Context, profileID string) (zipPath string, shareCode string, err error) {
	if err := s.checkInitialized(ctx); err != nil {
		return "", "", err
	}
	if strings.TrimSpace(profileID) == "" {
		return "", "", errors.New("profile id cannot be empty")
	}

	p, err := s.profiles.Get(profileID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", "", fmt.Errorf("profile %q not found", profileID)
		}
		return "", "", fmt.Errorf("failed to get profile %q: %w", profileID, err)
	}
	if p == nil {
		return "", "", fmt.Errorf("profile %q not found", profileID)
	}

	mods := make([]domain.ProfileMod, len(p.Mods))
	copy(mods, p.Mods)
	sort.SliceStable(mods, func(i, j int) bool { return mods[i].Order < mods[j].Order })

	// Resolve mod file paths and hashes in load order.
	type bundledMod struct {
		arcName string
		srcPath string
		hash    string
	}
	bundled := make([]bundledMod, 0, len(mods))
	usedNames := make(map[string]int)
	for _, m := range mods {
		srcPath := m.ModPath
		if m.ModID != "" && s.mods != nil {
			if modObj, err := s.mods.Get(m.ModID); err == nil && modObj != nil && modObj.Path != "" {
				srcPath = modObj.Path
			}
		}
		if strings.TrimSpace(srcPath) == "" {
			return "", "", fmt.Errorf("mod %q has no file path", m.ModName)
		}
		if _, err := os.Stat(srcPath); err != nil {
			return "", "", fmt.Errorf("mod file not found for %q: %w", m.ModName, err)
		}
		hash, err := filesystem.ComputeSHA256(srcPath)
		if err != nil {
			return "", "", fmt.Errorf("failed to hash mod file %q: %w", srcPath, err)
		}
		bundled = append(bundled, bundledMod{
			arcName: bundleFileName(filepath.Base(srcPath), usedNames),
			srcPath: srcPath,
			hash:    hash,
		})
	}

	yamlBytes, err := s.ExportYAML(ctx, profileID)
	if err != nil {
		return "", "", fmt.Errorf("failed to export profile YAML: %w", err)
	}

	manifest := BundleManifest{
		Name:         p.Name,
		EngineFamily: s.resolveEngineFamily(p.EngineID),
		IWADType:     s.resolveIWADType(p.IWADID),
		ModHashes:    make([]string, 0, len(bundled)),
		Version:      BundleVersion,
	}
	for _, b := range bundled {
		manifest.ModHashes = append(manifest.ModHashes, b.hash)
	}
	manifestJSON, err := json.Marshal(manifest)
	if err != nil {
		return "", "", fmt.Errorf("failed to marshal bundle manifest: %w", err)
	}
	shareCode = ShareCodePrefix + base64.RawURLEncoding.EncodeToString(manifestJSON)

	tmp, err := os.CreateTemp("", "rntpack-*.zip")
	if err != nil {
		return "", "", fmt.Errorf("failed to create bundle file: %w", err)
	}
	tmpPath := tmp.Name()
	zw := zip.NewWriter(tmp)
	writeEntry := func(name string, data []byte) error {
		w, err := zw.Create(name)
		if err != nil {
			return err
		}
		_, err = w.Write(data)
		return err
	}
	var writeErr error
	if writeErr = writeEntry("profile.yaml", yamlBytes); writeErr == nil {
		writeErr = writeEntry("manifest.json", manifestJSON)
	}
	for _, b := range bundled {
		if writeErr != nil {
			break
		}
		var data []byte
		if data, writeErr = os.ReadFile(b.srcPath); writeErr != nil {
			writeErr = fmt.Errorf("failed to read mod file %q: %w", b.srcPath, writeErr)
			break
		}
		writeErr = writeEntry("mods/"+b.arcName, data)
	}
	closeErr := zw.Close()
	syncErr := tmp.Close()
	if writeErr != nil {
		_ = os.Remove(tmpPath)
		return "", "", writeErr
	}
	if closeErr != nil {
		_ = os.Remove(tmpPath)
		return "", "", fmt.Errorf("failed to finalize bundle file: %w", closeErr)
	}
	if syncErr != nil {
		_ = os.Remove(tmpPath)
		return "", "", fmt.Errorf("failed to write bundle file: %w", syncErr)
	}
	return tmpPath, shareCode, nil
}

// ImportBundle verifies a .rntpack zip archive and imports it as a new profile.
//
// Manifest hashes are verified against the bundled files before anything is
// persisted; a tampered or truncated bundle is rejected with an error. Mods
// already present in the library (matched by SHA-256) are reused; missing mods
// are registered from the extracted bundle files using the same inspection
// path the scanner import uses (filesystem.InspectFile + upsert by path).
// On profile-name collision the imported profile is suffixed with " (imported)".
func (s *ProfileService) ImportBundle(ctx context.Context, zipPath string) (*domain.Profile, error) {
	if err := s.checkInitialized(ctx); err != nil {
		return nil, err
	}
	if strings.TrimSpace(zipPath) == "" {
		return nil, errors.New("bundle path cannot be empty")
	}

	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open bundle %q: %w", zipPath, err)
	}
	defer zr.Close()

	entries := make(map[string]*zip.File, len(zr.File))
	for _, f := range zr.File {
		entries[f.Name] = f
	}
	readEntry := func(name string) ([]byte, error) {
		f, ok := entries[name]
		if !ok {
			return nil, fmt.Errorf("bundle is missing %q", name)
		}
		rc, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("failed to read bundle entry %q: %w", name, err)
		}
		defer rc.Close()
		return io.ReadAll(rc)
	}

	manifestBytes, err := readEntry("manifest.json")
	if err != nil {
		return nil, err
	}
	var manifest BundleManifest
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		return nil, fmt.Errorf("invalid bundle manifest: %w", err)
	}
	if manifest.Version != BundleVersion {
		return nil, fmt.Errorf("unsupported bundle version: %d (expected %d)", manifest.Version, BundleVersion)
	}

	yamlBytes, err := readEntry("profile.yaml")
	if err != nil {
		return nil, err
	}
	var exportFile ProfileExportFile
	if err := yaml.Unmarshal(yamlBytes, &exportFile); err != nil {
		return nil, fmt.Errorf("invalid bundled profile YAML: %w", err)
	}
	if exportFile.Version != 1 {
		return nil, fmt.Errorf("unsupported bundled profile version: %d (expected 1)", exportFile.Version)
	}

	// Collect bundled mod payloads; the archive must hold exactly one file per
	// manifest hash so tampered bundles (modified or extra files) are rejected.
	modPayloads := make(map[string][]byte)
	for name := range entries {
		if strings.HasPrefix(name, "mods/") && !strings.HasSuffix(name, "/") {
			data, err := readEntry(name)
			if err != nil {
				return nil, err
			}
			modPayloads[strings.TrimPrefix(name, "mods/")] = data
		}
	}

	// Map YAML mods in order to bundled filenames using the same
	// collision-disambiguation ExportBundle applies, then verify each payload
	// hash against the manifest entry for that load-order position.
	usedNames := make(map[string]int)
	if len(exportFile.Profile.Mods) != len(manifest.ModHashes) {
		return nil, fmt.Errorf("bundle manifest lists %d mods but profile has %d", len(manifest.ModHashes), len(exportFile.Profile.Mods))
	}
	if len(modPayloads) != len(manifest.ModHashes) {
		return nil, fmt.Errorf("bundle holds %d mod files but manifest lists %d", len(modPayloads), len(manifest.ModHashes))
	}
	orderedPayloads := make([][]byte, 0, len(exportFile.Profile.Mods))
	for i := range exportFile.Profile.Mods {
		ym := &exportFile.Profile.Mods[i]
		base := filepath.Base(strings.TrimSpace(ym.Path))
		if base == "" || base == "." {
			base = filepath.Base(strings.TrimSpace(ym.Name))
		}
		if base == "" || base == "." {
			return nil, fmt.Errorf("bundled mod at position %d has no filename", i)
		}
		arcName := bundleFileName(base, usedNames)
		data, ok := modPayloads[arcName]
		if !ok {
			return nil, fmt.Errorf("bundle is missing mod file %q", "mods/"+arcName)
		}
		if got := filesystem.ComputeSHA256Bytes(data); got != manifest.ModHashes[i] {
			return nil, fmt.Errorf("bundle mod file %q failed hash verification", "mods/"+arcName)
		}
		orderedPayloads = append(orderedPayloads, data)
		delete(modPayloads, arcName)
	}

	// Index the library by hash so already-present mods are reused.
	existingByHash := make(map[string]*domain.Mod)
	if s.mods != nil {
		if all, err := s.mods.List(domain.ModFilter{}); err == nil {
			for i := range all {
				if all[i].SHA256 != "" {
					if _, dup := existingByHash[all[i].SHA256]; !dup {
						m := all[i]
						existingByHash[all[i].SHA256] = &m
					}
				}
			}
		}
	}

	// Extract missing mods to a persistent import dir (library files must
	// survive this call) and register them, mirroring the scanner import path.
	importDir, err := os.MkdirTemp("", "rntpack-import-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create bundle import dir: %w", err)
	}
	usedNames = make(map[string]int)
	for i := range exportFile.Profile.Mods {
		ym := &exportFile.Profile.Mods[i]
		hash := manifest.ModHashes[i]
		if existing, ok := existingByHash[hash]; ok && existing != nil {
			ym.ID = ""
			ym.Path = existing.Path
			if strings.TrimSpace(ym.Name) == "" {
				ym.Name = existing.Name
			}
			continue
		}
		base := filepath.Base(strings.TrimSpace(ym.Path))
		if base == "" || base == "." {
			base = filepath.Base(strings.TrimSpace(ym.Name))
		}
		dest := filepath.Join(importDir, bundleFileName(base, usedNames))
		if err := os.WriteFile(dest, orderedPayloads[i], 0644); err != nil {
			return nil, fmt.Errorf("failed to extract bundled mod %q: %w", base, err)
		}
		registered, err := s.upsertBundleMod(ctx, dest, strings.TrimSpace(ym.Name))
		if err != nil {
			return nil, err
		}
		existingByHash[hash] = registered
		ym.ID = ""
		ym.Path = registered.Path
		if strings.TrimSpace(ym.Name) == "" {
			ym.Name = registered.Name
		}
	}

	exportFile.Profile.Name = s.uniqueImportName(ctx, strings.TrimSpace(exportFile.Profile.Name))
	rewritten, err := yaml.Marshal(&exportFile)
	if err != nil {
		return nil, fmt.Errorf("failed to rewrite bundled profile YAML: %w", err)
	}
	imported, _, err := s.ImportYAML(ctx, rewritten)
	if err != nil {
		return nil, fmt.Errorf("failed to import bundled profile: %w", err)
	}
	return imported, nil
}

// ParseShareCode decodes an "rnt://pack/..." share-code string into its manifest.
// Share codes carry hashes only, so importing from a share code alone is out of
// scope; the manifest identifies the pack for out-of-band transfer.
func ParseShareCode(code string) (BundleManifest, error) {
	var manifest BundleManifest
	trimmed := strings.TrimSpace(code)
	if !strings.HasPrefix(trimmed, ShareCodePrefix) {
		return manifest, fmt.Errorf("invalid share code: missing %q prefix", ShareCodePrefix)
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(trimmed, ShareCodePrefix))
	if err != nil {
		return manifest, fmt.Errorf("invalid share code encoding: %w", err)
	}
	if err := json.Unmarshal(raw, &manifest); err != nil {
		return manifest, fmt.Errorf("invalid share code manifest: %w", err)
	}
	if manifest.Version != BundleVersion {
		return manifest, fmt.Errorf("unsupported share code version: %d (expected %d)", manifest.Version, BundleVersion)
	}
	if strings.TrimSpace(manifest.Name) == "" {
		return manifest, errors.New("invalid share code manifest: name is required")
	}
	if manifest.ModHashes == nil {
		manifest.ModHashes = []string{}
	}
	return manifest, nil
}

// bundleFileName returns the archive name for a basename, disambiguating
// collisions by inserting _2, _3, ... before the extension. usedNames tracks
// per-basename occurrence counts across one bundle; callers must start from an
// empty map and feed basenames in load order on both export and import.
func bundleFileName(base string, usedNames map[string]int) string {
	usedNames[base]++
	if usedNames[base] == 1 {
		return base
	}
	ext := filepath.Ext(base)
	stem := strings.TrimSuffix(base, ext)
	return fmt.Sprintf("%s_%d%s", stem, usedNames[base], ext)
}

// resolveEngineFamily returns the engine family string for an engine ID, or ""
// when the engine is unknown or the repository is unavailable.
func (s *ProfileService) resolveEngineFamily(engineID string) string {
	if engineID == "" || s.engines == nil {
		return ""
	}
	if eng, err := s.engines.Get(engineID); err == nil && eng != nil {
		return string(eng.Family)
	}
	return ""
}

// resolveIWADType returns the IWAD type string for an IWAD ID, or "" when the
// IWAD is unknown or the repository is unavailable.
func (s *ProfileService) resolveIWADType(iwadID string) string {
	if iwadID == "" || s.iwads == nil {
		return ""
	}
	if iwad, err := s.iwads.Get(iwadID); err == nil && iwad != nil {
		return string(iwad.Type)
	}
	return ""
}

// uniqueImportName suffixes name with " (imported)" (then " (imported N)") while
// a profile with that name already exists.
func (s *ProfileService) uniqueImportName(ctx context.Context, name string) string {
	if strings.TrimSpace(name) == "" {
		name = "Imported Profile"
	}
	existing, err := s.profiles.List()
	if err != nil {
		return name
	}
	taken := make(map[string]struct{}, len(existing))
	for _, p := range existing {
		taken[strings.ToLower(p.Name)] = struct{}{}
	}
	if _, ok := taken[strings.ToLower(name)]; !ok {
		return name
	}
	candidate := name + " (imported)"
	if _, ok := taken[strings.ToLower(candidate)]; !ok {
		return candidate
	}
	for n := 2; ; n++ {
		candidate := fmt.Sprintf("%s (imported %d)", name, n)
		if _, ok := taken[strings.ToLower(candidate)]; !ok {
			return candidate
		}
	}
}

// upsertBundleMod registers an extracted bundle file in the mod library,
// mirroring the scanner import path: inspect via filesystem.InspectFile and
// update the existing row on path match, otherwise create a new row.
func (s *ProfileService) upsertBundleMod(ctx context.Context, filePath string, preferredName string) (*domain.Mod, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if s.mods == nil {
		return nil, errors.New("mod repository is not initialized")
	}
	cleanPath := filepath.Clean(filePath)
	info, err := filesystem.InspectFile(cleanPath)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect bundled mod %q: %w", cleanPath, err)
	}
	format := domain.DetectModFormat(cleanPath)
	if !format.IsValid() {
		format = domain.ModFormatWAD
	}
	category := domain.ModCategory(info.Category)
	if !category.IsValid() {
		category = domain.ModCategoryOther
	}
	structures := info.Structures
	if structures == nil {
		structures = []string{}
	}
	if existing, err := s.mods.GetByPath(cleanPath); err == nil && existing != nil {
		existing.Format = format
		existing.Category = category
		existing.Size = info.Size
		existing.ModifiedAt = info.ModTime
		existing.SHA256 = info.SHA256
		existing.LumpCount = info.LumpCount
		existing.Structures = structures
		existing.UpdatedAt = info.ModTime
		if err := s.mods.Update(existing); err != nil {
			return nil, fmt.Errorf("failed to update bundled mod: %w", err)
		}
		return existing, nil
	} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("failed to look up bundled mod: %w", err)
	}
	name := strings.TrimSpace(preferredName)
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(cleanPath), filepath.Ext(cleanPath))
	}
	now := info.ModTime
	if now.IsZero() {
		now = time.Now().UTC()
	}
	newMod := domain.Mod{
		ID:         uuid.NewString(),
		Name:       name,
		Path:       cleanPath,
		Format:     format,
		Category:   category,
		Size:       info.Size,
		ModifiedAt: now,
		SHA256:     info.SHA256,
		LumpCount:  info.LumpCount,
		Structures: structures,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.mods.Create(&newMod); err != nil {
		return nil, fmt.Errorf("failed to save bundled mod: %w", err)
	}
	return &newMod, nil
}
