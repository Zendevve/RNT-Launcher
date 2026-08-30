package filesystem

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var (
	// ErrFileNotFound is returned when the target file does not exist.
	ErrFileNotFound = errors.New("file not found")

	// ErrIsDirectory is returned when a directory path is supplied instead of a file.
	ErrIsDirectory = errors.New("path is a directory, expected a file")
)

// FileInfo contains comprehensive metadata, structural properties, and categorization for a Doom mod or IWAD file.
type FileInfo struct {
	Path            string       `json:"path"`
	Filename        string       `json:"filename"`
	Size            int64        `json:"size"`
	ModTime         time.Time    `json:"modTime"`
	SHA256          string       `json:"sha256"`
	Format          string       `json:"format"`     // "IWAD", "PWAD", "PK3", "IPK3", "ZIP", "PK7", "7Z", "DEH", "BEX", "UNKNOWN"
	Category        string       `json:"category"`   // "Gameplay", "Megawads", "Maps", "Audio", "Textures", "Mods", "Other"
	IsIWAD          bool         `json:"isIwad"`
	LumpCount       int          `json:"lumpCount"`
	Maps            []string     `json:"maps"`
	Structures      []string     `json:"structures"`
	InspectionError string       `json:"inspectionError,omitempty"`
	WADInfo         *WADInfo     `json:"wadInfo,omitempty"`
	ArchiveInfo     *ArchiveInfo `json:"archiveInfo,omitempty"`
}

// DetermineCategory applies heuristic rules to classify a file into a user-friendly category.
func DetermineCategory(format string, maps []string, structures []string, filename string) string {
	structMap := make(map[string]bool, len(structures))
	for _, s := range structures {
		structMap[s] = true
	}

	hasAny := func(keys ...string) bool {
		for _, k := range keys {
			if structMap[k] {
				return true
			}
		}
		return false
	}

	// 1. DEH / BEX standalone files are gameplay patches
	if format == "DEH" || format == "BEX" {
		return "Gameplay"
	}

	// 2. Megawads: more than 10 maps
	if len(maps) > 10 {
		return "Megawads"
	}

	// 3. Gameplay: has custom scripting / gameplay actors
	if hasAny("ZSCRIPT", "DECORATE", "ACTORS") {
		return "Gameplay"
	}

	// 4. Maps: has 1-10 maps or MAPS structure
	if len(maps) >= 1 || hasAny("MAPS") {
		return "Maps"
	}

	// 5. Audio: audio structures without graphical/texture replacements
	if hasAny("SNDINFO", "SOUNDS", "MUSIC") && !hasAny("TEXTURES", "PATCHES", "FLATS", "SPRITES", "MODELS") {
		return "Audio"
	}

	// 6. Textures: texture / flat / patch structures
	if hasAny("TEXTURES", "PATCHES", "FLATS", "HIRES") {
		return "Textures"
	}

	// 7. General Mods
	if format != "UNKNOWN" && format != "" {
		return "Mods"
	}

	return "Other"
}

// InspectFile inspects a file at the given disk path and extracts full metadata.
func InspectFile(path string) (*FileInfo, error) {
	stat, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrFileNotFound
		}
		return nil, err
	}
	if stat.IsDir() {
		return nil, ErrIsDirectory
	}

	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return InspectReader(f, stat.Size(), stat.Name(), stat.ModTime(), path)
}

// InspectBytes inspects an in-memory byte slice as a file with the given filename.
func InspectBytes(data []byte, filename string) (*FileInfo, error) {
	reader := bytes.NewReader(data)
	return InspectReader(reader, int64(len(data)), filename, time.Now(), filename)
}

// InspectReader inspects an io.ReaderAt with a known size and metadata.
func InspectReader(r io.ReaderAt, size int64, filename string, modTime time.Time, fullPath string) (*FileInfo, error) {
	var header [16]byte
	headerLen, _ := r.ReadAt(header[:], 0)

	ext := strings.ToLower(filepath.Ext(filename))
	format := detectFormat(header[:headerLen], ext)

	// Compute SHA-256
	var hashStr string
	if rs, ok := r.(io.ReadSeeker); ok {
		if _, err := rs.Seek(0, io.SeekStart); err == nil {
			hashStr, _ = ComputeSHA256Reader(rs)
		}
	}
	if hashStr == "" {
		hashStr, _ = ComputeSHA256Reader(io.NewSectionReader(r, 0, size))
	}

	info := &FileInfo{
		Path:       fullPath,
		Filename:   filename,
		Size:       size,
		ModTime:    modTime,
		SHA256:     hashStr,
		Format:     format,
		Maps:       []string{},
		Structures: []string{},
	}

	switch format {
	case "IWAD", "PWAD":
		wadInfo, err := InspectWADReader(r, size)
		if err == nil {
			info.WADInfo = wadInfo
			info.IsIWAD = wadInfo.IsIWAD
			info.LumpCount = wadInfo.LumpCount
			info.Maps = wadInfo.Maps
			info.Structures = wadInfo.Structures
		} else {
			info.InspectionError = err.Error()
		}
	case "PK3", "IPK3", "ZIP", "PK7", "7Z":
		archiveInfo, err := InspectArchiveReader(r, size, filename)
		if err == nil {
			info.ArchiveInfo = archiveInfo
			info.LumpCount = archiveInfo.EntryCount
			info.Maps = archiveInfo.Maps
			info.Structures = archiveInfo.Structures
		} else {
			info.InspectionError = err.Error()
		}
	case "DEH", "BEX":
		info.LumpCount = 1
		info.Structures = []string{"DEHACKED"}
	}
	info.Category = DetermineCategory(info.Format, info.Maps, info.Structures, info.Filename)
	return info, nil
}

// detectFormat returns the detected format string by inspecting magic headers and file extensions.
func detectFormat(header []byte, ext string) string {
	if len(header) >= 4 {
		magic4 := strings.ToUpper(string(header[:4]))
		if magic4 == "IWAD" {
			return "IWAD"
		}
		if magic4 == "PWAD" {
			return "PWAD"
		}
		if IsZip(header) {
			switch ext {
			case ".pk3":
				return "PK3"
			case ".ipk3":
				return "IPK3"
			default:
				return "ZIP"
			}
		}
	}
	if len(header) >= 6 && Is7z(header) {
		if ext == ".pk7" {
			return "PK7"
		}
		return "7Z"
	}

	// Fallback to extension
	switch ext {
	case ".wad":
		return "PWAD"
	case ".pk3":
		return "PK3"
	case ".ipk3":
		return "IPK3"
	case ".zip":
		return "ZIP"
	case ".pk7":
		return "PK7"
	case ".7z":
		return "7Z"
	case ".deh":
		return "DEH"
	case ".bex":
		return "BEX"
	}

	if ext != "" {
		return strings.ToUpper(strings.TrimPrefix(ext, "."))
	}
	return "UNKNOWN"
}

// ExtractArtwork searches a WAD or PK3/ZIP mod file for graphical artwork lumps
// (TITLEPIC, CREDIT, BOSSBACK, HELP, INTERPIC) and returns the encoded PNG bytes, the lump name, and any error.
func ExtractArtwork(modPath string) ([]byte, string, error) {
	stat, err := os.Stat(modPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, "", ErrFileNotFound
		}
		return nil, "", err
	}
	if stat.IsDir() {
		return nil, "", ErrIsDirectory
	}

	ext := strings.ToLower(filepath.Ext(modPath))

	// 1. WAD files (PWAD / IWAD)
	if ext == ".wad" {
		f, err := os.Open(modPath)
		if err != nil {
			return nil, "", err
		}
		defer f.Close()

		lumps, err := ReadWADDirectory(f, stat.Size())
		if err != nil {
			return nil, "", err
		}

		// Extract custom palette if present
		palette := DefaultDoomPalette
		for _, l := range lumps {
			if l.Name == "PLAYPAL" && l.Size >= 768 {
				if customPal, err := ExtractPLAYPAL(f, l.Offset); err == nil {
					palette = customPal
				}
				break
			}
		}

		// Priority list of artwork lumps
		artLumpNames := []string{"TITLEPIC", "CREDIT", "BOSSBACK", "HELP", "INTERPIC", "DMENUPIC"}
		for _, target := range artLumpNames {
			for _, l := range lumps {
				if l.Name == target && l.Size > 0 {
					data := make([]byte, l.Size)
					if _, err := f.ReadAt(data, l.Offset); err != nil && err != io.EOF {
						continue
					}

					// If already PNG or JPEG, return directly
					if len(data) >= 8 && (bytes.Equal(data[:8], []byte("\x89PNG\r\n\x1a\n")) ||
						(data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF)) {
						return data, target, nil
					}

					// Decode Doom patch graphic format
					img, err := DecodeDoomPicture(data, palette)
					if err == nil && img != nil {
						pngBytes, err := EncodePNG(img)
						if err == nil {
							return pngBytes, target, nil
						}
					}
				}
			}
		}
		return nil, "", nil
	}

	// 2. PK3 / ZIP / IPK3 files
	if ext == ".pk3" || ext == ".ipk3" || ext == ".zip" {
		zr, err := zip.OpenReader(modPath)
		if err != nil {
			return nil, "", fmt.Errorf("failed to open archive: %w", err)
		}
		defer zr.Close()

		artFilenames := []string{
			"titlepic.png", "graphics/titlepic.png", "titlepic.jpg", "titlepic.jpeg",
			"credit.png", "graphics/credit.png", "credit.jpg", "credit.jpeg",
			"bossback.png", "graphics/bossback.png",
			"help.png", "graphics/help.png",
			"interpic.png", "graphics/interpic.png",
		}

		for _, target := range artFilenames {
			for _, file := range zr.File {
				if strings.EqualFold(file.Name, target) || strings.EqualFold(filepath.Base(file.Name), filepath.Base(target)) {
					rc, err := file.Open()
					if err != nil {
						continue
					}
					data, err := io.ReadAll(rc)
					_ = rc.Close()
					if err != nil {
						continue
					}

					// If PNG/JPEG, return directly
					if len(data) >= 8 && (bytes.Equal(data[:8], []byte("\x89PNG\r\n\x1a\n")) ||
						(data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF)) {
						base := filepath.Base(file.Name)
						lumpName := strings.ToUpper(strings.TrimSuffix(base, filepath.Ext(base)))
						return data, lumpName, nil
					}

					// If Doom graphic format
					img, err := DecodeDoomPicture(data, DefaultDoomPalette)
					if err == nil && img != nil {
						if pngBytes, err := EncodePNG(img); err == nil {
							base := filepath.Base(file.Name)
							lumpName := strings.ToUpper(strings.TrimSuffix(base, filepath.Ext(base)))
							return pngBytes, lumpName, nil
						}
					}
				}
			}
		}
		return nil, "", nil
	}

	return nil, "", nil
}
