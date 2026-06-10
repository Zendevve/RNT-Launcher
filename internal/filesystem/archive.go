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
)

var (
	// ErrInvalidArchive indicates the file could not be parsed as a supported archive format.
	ErrInvalidArchive = errors.New("invalid or unsupported archive format")

	// ErrCorruptArchive indicates an archive with corrupted headers or truncated data.
	ErrCorruptArchive = errors.New("corrupt archive file")
)

// sevenZipMagic defines the 6-byte header signature of 7-Zip archives.
var sevenZipMagic = []byte{0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C}

// ArchiveInfo contains the parsed entry statistics, detected maps, and structural markers of an archive.
type ArchiveInfo struct {
	Format     string   `json:"format"`           // "PK3", "ZIP", "IPK3", "PK7", "7Z"
	EntryCount int      `json:"entryCount"`       // total number of entries in the archive
	Entries    []string `json:"entries,omitempty"` // list of cleaned archive entry paths
	Maps       []string `json:"maps"`             // detected map names (e.g. ["MAP01", "E1M1"])
	Structures []string `json:"structures"`       // detected structural markers (e.g. ["MAPINFO", "ZSCRIPT", "SPRITES"])
}

// Is7z tests whether the beginning bytes of a file match the 7-Zip file signature.
func Is7z(data []byte) bool {
	return len(data) >= len(sevenZipMagic) && bytes.Equal(data[:len(sevenZipMagic)], sevenZipMagic)
}

// IsZip tests whether the beginning bytes match common ZIP header signatures.
func IsZip(data []byte) bool {
	if len(data) < 4 {
		return false
	}
	return data[0] == 'P' && data[1] == 'K' &&
		((data[2] == 3 && data[3] == 4) ||
			(data[2] == 5 && data[3] == 6) ||
			(data[2] == 7 && data[3] == 8))
}

// InspectArchive opens and inspects an archive file from disk.
func InspectArchive(path string) (*ArchiveInfo, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		return nil, err
	}

	return InspectArchiveReader(f, stat.Size(), filepath.Base(path))
}

// InspectArchiveBytes parses an archive provided as a byte slice.
func InspectArchiveBytes(data []byte, filenameOrExt string) (*ArchiveInfo, error) {
	return InspectArchiveReader(bytes.NewReader(data), int64(len(data)), filenameOrExt)
}

// InspectArchiveReader reads and parses archive entries from an io.ReaderAt.
func InspectArchiveReader(r io.ReaderAt, size int64, filenameOrExt string) (*ArchiveInfo, error) {
	if size < 4 {
		return nil, ErrInvalidArchive
	}

	// 1. Check for 7z / PK7 signature
	var header [32]byte
	n, _ := r.ReadAt(header[:], 0)
	if n >= 6 && Is7z(header[:6]) {
		format := "7Z"
		ext := strings.ToLower(filepath.Ext(filenameOrExt))
		if ext == ".pk7" {
			format = "PK7"
		}
		return &ArchiveInfo{
			Format:     format,
			EntryCount: 0,
			Entries:    []string{},
			Maps:       []string{},
			Structures: []string{"7Z_ARCHIVE"},
		}, nil
	}

	// 2. Parse standard ZIP / PK3 / IPK3 archive
	zipReader, err := zip.NewReader(r, size)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidArchive, err)
	}

	format := "ZIP"
	ext := strings.ToLower(filepath.Ext(filenameOrExt))
	switch ext {
	case ".pk3":
		format = "PK3"
	case ".ipk3":
		format = "IPK3"
	case ".pk7":
		format = "PK7"
	case ".7z":
		format = "7Z"
	default:
		if ext == ".zip" {
			format = "ZIP"
		}
	}

	info := &ArchiveInfo{
		Format:     format,
		EntryCount: len(zipReader.File),
		Entries:    make([]string, 0, min(len(zipReader.File), 2048)),
		Maps:       make([]string, 0),
		Structures: make([]string, 0),
	}

	for _, f := range zipReader.File {
		cleanPath := strings.ReplaceAll(f.Name, "\\", "/")
		cleanPath = strings.Trim(cleanPath, "/")
		if cleanPath == "" {
			continue
		}

		info.Entries = append(info.Entries, cleanPath)
		lowerPath := strings.ToLower(cleanPath)
		parts := strings.Split(lowerPath, "/")
		fileName := parts[len(parts)-1]
		baseName := strings.TrimSuffix(fileName, filepath.Ext(fileName))
		upperBase := strings.ToUpper(baseName)

		// 1. Directory Structure check
		if len(parts) > 1 {
			topDir := parts[0]
			switch topDir {
			case "maps":
				info.Structures = appendUnique(info.Structures, "MAPS")
				if !f.FileInfo().IsDir() && baseName != "" {
					info.Maps = appendUnique(info.Maps, upperBase)
				}
			case "sprites":
				info.Structures = appendUnique(info.Structures, "SPRITES")
			case "sounds", "sound":
				info.Structures = appendUnique(info.Structures, "SOUNDS")
			case "music":
				info.Structures = appendUnique(info.Structures, "MUSIC")
			case "textures":
				info.Structures = appendUnique(info.Structures, "TEXTURES")
			case "patches":
				info.Structures = appendUnique(info.Structures, "PATCHES")
			case "flats":
				info.Structures = appendUnique(info.Structures, "FLATS")
			case "models":
				info.Structures = appendUnique(info.Structures, "MODELS")
			case "actors", "actor":
				info.Structures = appendUnique(info.Structures, "ACTORS")
			case "voxels":
				info.Structures = appendUnique(info.Structures, "VOXELS")
			case "hires":
				info.Structures = appendUnique(info.Structures, "HIRES")
			case "colormaps":
				info.Structures = appendUnique(info.Structures, "COLORMAPS")
			case "graphics":
				info.Structures = appendUnique(info.Structures, "GRAPHICS")
			case "fonts":
				info.Structures = appendUnique(info.Structures, "FONTS")
			case "zscript":
				info.Structures = appendUnique(info.Structures, "ZSCRIPT")
			case "decorate":
				info.Structures = appendUnique(info.Structures, "DECORATE")
			}
		}

		// 2. Map lumps/files at root or matching map format
		if isMapLump(upperBase) {
			info.Maps = appendUnique(info.Maps, upperBase)
		}

		// 3. Config/Script Markers
		switch fileName {
		case "zscript.txt", "zscript.zs", "zscript":
			info.Structures = appendUnique(info.Structures, "ZSCRIPT")
		case "mapinfo.txt", "mapinfo.zscript", "mapinfo", "umapinfo.txt", "zmapinfo.txt", "emapinfo.txt":
			info.Structures = appendUnique(info.Structures, "MAPINFO")
		case "decorate.txt", "decorate.dec", "decorate":
			info.Structures = appendUnique(info.Structures, "DECORATE")
		case "sndinfo.txt", "sndinfo", "sndseq.txt", "sndseq":
			info.Structures = appendUnique(info.Structures, "SNDINFO")
		case "gldefs.txt", "gldefs":
			info.Structures = appendUnique(info.Structures, "GLDEFS")
		case "textures.txt", "textures":
			info.Structures = appendUnique(info.Structures, "TEXTURES")
		case "gameinfo.txt", "gameinfo":
			info.Structures = appendUnique(info.Structures, "GAMEINFO")
		case "animdefs.txt", "animdefs":
			info.Structures = appendUnique(info.Structures, "ANIMDEFS")
		case "cvarinfo.txt", "cvarinfo":
			info.Structures = appendUnique(info.Structures, "CVARINFO")
		case "keyconf.txt", "keyconf":
			info.Structures = appendUnique(info.Structures, "KEYCONF")
		case "menudefs.txt", "menudefs":
			info.Structures = appendUnique(info.Structures, "MENUDEFS")
		case "sbarinfo.txt", "sbarinfo":
			info.Structures = appendUnique(info.Structures, "SBARINFO")
		case "lockdefs.txt", "lockdefs":
			info.Structures = appendUnique(info.Structures, "LOCKDEFS")
		case "voxeldef.txt", "voxeldef":
			info.Structures = appendUnique(info.Structures, "VOXELDEF")
		default:
			if strings.HasSuffix(fileName, ".deh") || strings.HasSuffix(fileName, ".bex") {
				info.Structures = appendUnique(info.Structures, "DEHACKED")
			}
		}
	}

	return info, nil
}
