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
	f, err := os.Open(srcPath)
	if err != nil {
		return "", err
	}
	var header [16]byte
	n, _ := f.Read(header[:])
	f.Close()

	folder := ClassifyAsset(srcPath, header[:n])
	destDir := filepath.Join(libDir, folder)
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return "", err
	}
	dest := filepath.Join(destDir, filepath.Base(srcPath))
	if err := os.Rename(srcPath, dest); err != nil {
		if err := copyFile(srcPath, dest); err != nil {
			return "", err
		}
		if rmErr := os.Remove(srcPath); rmErr != nil {
			return "", rmErr
		}
	}
	return dest, nil
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
