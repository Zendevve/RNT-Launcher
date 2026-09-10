package filesystem

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// LibraryFolders is the canonical managed-library layout: one neat folder
// per asset class. It mirrors the convention used by DoomLauncher
// (per-FileType directories) and matches Settings' separate
// Mod/IWAD/Engine directory roots.
var LibraryFolders = []string{"engines", "iwads", "wads", "mods"}

// knownIWADNames are base-game WAD basenames that always belong in iwads/,
// regardless of header magic.
var knownIWADNames = map[string]bool{
	"doom.wad":     true,
	"doom2.wad":    true,
	"tnt.wad":      true,
	"plutonia.wad": true,
	"heretic.wad":  true,
	"hexen.wad":    true,
	"strife.wad":   true,
	"chex.wad":     true,
}

// engineNameTokens identifies source-port distributions by filename so a
// downloaded port archive dropped into the library lands in engines/.
var engineNameTokens = []string{
	"gzdoom", "prboom", "dsda", "crispy", "chocolate",
	"zandronum", "eternity", "woof", "edge", "kex",
}

// ClassifyAsset maps a filename plus its leading header bytes to a library
// folder name ("engines", "iwads", "wads", or "mods"). Only the first few
// header bytes are consulted, so callers MUST NOT read the whole file to
// classify it.
func ClassifyAsset(filename string, header []byte) string {
	lower := strings.ToLower(filepath.Base(filename))
	ext := strings.ToLower(filepath.Ext(lower))

	if ext == ".exe" {
		return "engines"
	}
	if ext == ".zip" || ext == ".7z" || ext == ".pk7" {
		for _, tok := range engineNameTokens {
			if strings.Contains(lower, tok) {
				return "engines"
			}
		}
	}
	if knownIWADNames[lower] {
		return "iwads"
	}
	if ext == ".wad" {
		if len(header) >= 4 && string(header[:4]) == "IWAD" {
			return "iwads"
		}
		return "wads"
	}
	return "mods"
}
// OrganizeFile moves srcPath into the classified subfolder of libDir,
// creating it if needed. Same-volume moves use os.Rename (metadata only);
// cross-volume falls back to copy+remove. It returns the destination path.
func OrganizeFile(srcPath, libDir string) (string, error) {
	folder, err := sniffFolder(srcPath)
	if err != nil {
		return "", err
	}
	destDir := filepath.Join(libDir, folder)
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return "", err
	}
	dest := filepath.Join(destDir, filepath.Base(srcPath))
	if err := moveFile(srcPath, dest); err != nil {
		return "", err
	}
	return dest, nil
}

// OrganizeBatch moves every srcPath into its classified subfolder of libDir,
// creating the four library folders once up front instead of once per file.
// It returns destination paths in input order; on error it reports how many
// files were already moved.
func OrganizeBatch(srcPaths []string, libDir string) ([]string, error) {
	for _, folder := range LibraryFolders {
		if err := os.MkdirAll(filepath.Join(libDir, folder), 0o755); err != nil {
			return nil, err
		}
	}
	dests := make([]string, 0, len(srcPaths))
	for _, src := range srcPaths {
		folder, err := sniffFolder(src)
		if err != nil {
			return dests, err
		}
		dest := filepath.Join(libDir, folder, filepath.Base(src))
		if err := moveFile(src, dest); err != nil {
			return dests, err
		}
		dests = append(dests, dest)
	}
	return dests, nil
}

// needsHeader reports whether classification can differ with header bytes:
// only generic .wad files need the magic sniff (IWAD vs PWAD); every other
// name is decided by extension, known IWAD basenames, or engine tokens.
func needsHeader(filename string) bool {
	lower := strings.ToLower(filepath.Base(filename))
	if knownIWADNames[lower] {
		return false
	}
	return strings.ToLower(filepath.Ext(lower)) == ".wad"
}

// sniffFolder classifies srcPath, reading at most 16 header bytes and only
// when the filename alone cannot decide. Existence is reported by the open
// or by the later rename itself; no separate pre-check (which would race the
// move anyway).
func sniffFolder(srcPath string) (string, error) {
	if !needsHeader(srcPath) {
		return ClassifyAsset(srcPath, nil), nil
	}
	f, err := os.Open(srcPath)
	if err != nil {
		return "", err
	}
	var header [16]byte
	n, _ := f.Read(header[:])
	f.Close()
	return ClassifyAsset(srcPath, header[:n]), nil
}

func moveFile(src, dest string) error {
	if err := os.Rename(src, dest); err != nil {
		if err := copyFile(src, dest); err != nil {
			return err
		}
		if rmErr := os.Remove(src); rmErr != nil {
			return rmErr
		}
	}
	return nil
}

func copyFile(src, dest string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	_, cpyErr := io.Copy(out, in)
	syncErr := out.Sync()
	closeErr := out.Close()
	return errors.Join(cpyErr, syncErr, closeErr)
}
