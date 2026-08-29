package filesystem

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
)

var (
	// ErrInvalidWADHeader indicates the file is smaller than the minimum 12-byte WAD header.
	ErrInvalidWADHeader = errors.New("invalid WAD header: file is too small")

	// ErrInvalidWADMagic indicates the identification signature is neither IWAD nor PWAD.
	ErrInvalidWADMagic = errors.New("invalid WAD magic: expected IWAD or PWAD")

	// ErrCorruptWADDirectory indicates the directory offset or lump count is out of valid bounds.
	ErrCorruptWADDirectory = errors.New("corrupt WAD directory: offset or count out of bounds")
)

var (
	mapDoom1Regex = regexp.MustCompile(`^E[1-9]M[1-9]$`)
	mapDoom2Regex = regexp.MustCompile(`^MAP[0-9]{2,}$`)
)

// WADInfo contains the parsed header, lump statistics, detected maps, and structural markers of a WAD file.
type WADInfo struct {
	Magic      string   `json:"magic"`           // "IWAD" or "PWAD"
	IsIWAD     bool     `json:"isIwad"`          // true if IWAD, false if PWAD
	LumpCount  int      `json:"lumpCount"`       // total number of lumps in directory
	Lumps      []string `json:"lumps,omitempty"` // lump names in directory order
	Maps       []string `json:"maps"`            // detected map headers (e.g. ["MAP01", "MAP02"] or ["E1M1"])
	Structures []string `json:"structures"`      // detected structural markers (e.g. ["MAPINFO", "DECORATE", "SPRITES"])
}

// InspectWAD opens and inspects a WAD file from disk.
func InspectWAD(path string) (*WADInfo, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		return nil, err
	}

	return InspectWADReader(f, stat.Size())
}

// InspectWADBytes parses a WAD file provided as a byte slice.
func InspectWADBytes(data []byte) (*WADInfo, error) {
	return InspectWADReader(bytes.NewReader(data), int64(len(data)))
}

// InspectWADReader reads and parses a WAD header and directory table from an io.ReaderAt.
func InspectWADReader(r io.ReaderAt, size int64) (*WADInfo, error) {
	if size < 12 {
		return nil, ErrInvalidWADHeader
	}

	var header [12]byte
	if _, err := r.ReadAt(header[:], 0); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidWADHeader, err)
	}

	magic := strings.ToUpper(string(header[0:4]))
	if magic != "IWAD" && magic != "PWAD" {
		return nil, fmt.Errorf("%w: got %q", ErrInvalidWADMagic, magic)
	}

	numLumps := int(binary.LittleEndian.Uint32(header[4:8]))
	infoTableOfs := int64(binary.LittleEndian.Uint32(header[8:12]))

	if numLumps < 0 || infoTableOfs < 12 {
		return nil, ErrCorruptWADDirectory
	}

	const maxSanityLumps = 100_000
	if numLumps > maxSanityLumps {
		return nil, fmt.Errorf("%w: lump count %d exceeds safety limit (%d)", ErrCorruptWADDirectory, numLumps, maxSanityLumps)
	}

	dirSize := int64(numLumps) * 16
	if size > 0 && infoTableOfs+dirSize > size {
		return nil, fmt.Errorf("%w: directory ends at offset %d, beyond file size %d", ErrCorruptWADDirectory, infoTableOfs+dirSize, size)
	}

	info := &WADInfo{
		Magic:      magic,
		IsIWAD:     magic == "IWAD",
		LumpCount:  numLumps,
		Lumps:      make([]string, 0, min(numLumps, 1024)),
		Maps:       make([]string, 0),
		Structures: make([]string, 0),
	}

	if numLumps == 0 {
		return info, nil
	}

	dirBuf := make([]byte, dirSize)
	if _, err := r.ReadAt(dirBuf, infoTableOfs); err != nil {
		return nil, fmt.Errorf("%w: failed to read directory table: %v", ErrCorruptWADDirectory, err)
	}

	for i := 0; i < numLumps; i++ {
		entry := dirBuf[i*16 : (i+1)*16]
		lumpName := parseLumpName(entry[8:16])
		if lumpName == "" {
			continue
		}

		info.Lumps = append(info.Lumps, lumpName)

		if isMapLump(lumpName) {
			info.Maps = appendUnique(info.Maps, lumpName)
		}

		if structType := identifyStructure(lumpName); structType != "" {
			info.Structures = appendUnique(info.Structures, structType)
		}
	}

	return info, nil
}

// IsWADMagic checks if the provided string is a valid WAD identification magic ("IWAD" or "PWAD").
func IsWADMagic(magic string) bool {
	m := strings.ToUpper(strings.TrimSpace(magic))
	return m == "IWAD" || m == "PWAD"
}

// parseLumpName reads up to 8 bytes, terminates at the first null byte, and returns trimmed uppercase ASCII.
func parseLumpName(raw []byte) string {
	n := bytes.IndexByte(raw, 0)
	if n != -1 {
		raw = raw[:n]
	}
	s := strings.TrimSpace(string(raw))
	return strings.ToUpper(s)
}

// isMapLump tests whether the lump name matches Doom 1 (E1M1..E9M9) or Doom 2 (MAP01..MAP99+) format.
func isMapLump(name string) bool {
	return mapDoom1Regex.MatchString(name) || mapDoom2Regex.MatchString(name)
}

// identifyStructure identifies standard Doom / ZDoom structure markers from lump names.
func identifyStructure(name string) string {
	switch name {
	case "MAPINFO", "ZMAPINFO", "EMAPINFO", "UMAPINFO":
		return "MAPINFO"
	case "DECORATE":
		return "DECORATE"
	case "ZSCRIPT":
		return "ZSCRIPT"
	case "SNDINFO", "SNDSEQ":
		return "SNDINFO"
	case "TEXTURES", "TEXTURE1", "TEXTURE2", "PNAMES":
		return "TEXTURES"
	case "GLDEFS":
		return "GLDEFS"
	case "ANIMDEFS":
		return "ANIMDEFS"
	case "GAMEINFO":
		return "GAMEINFO"
	case "VOXELDEF":
		return "VOXELDEF"
	case "CVARINFO":
		return "CVARINFO"
	case "KEYCONF":
		return "KEYCONF"
	case "MENUDEFS":
		return "MENUDEFS"
	case "SBARINFO":
		return "SBARINFO"
	case "LOCKDEFS":
		return "LOCKDEFS"
	case "DEHACKED":
		return "DEHACKED"
	case "S_START", "S_END", "SS_START", "SS_END":
		return "SPRITES"
	case "F_START", "F_END", "FF_START", "FF_END":
		return "FLATS"
	case "P_START", "P_END", "PP_START", "PP_END":
		return "PATCHES"
	case "TX_START", "TX_END":
		return "TEXTURES"
	case "C_START", "C_END":
		return "COLORMAPS"
	case "V_START", "V_END":
		return "VOXELS"
	case "HI_START", "HI_END":
		return "HIRES"
	case "A_START", "A_END":
		return "ACTORS"
	}
	return ""
}

// appendUnique appends val to slice if not already present, preserving order.
func appendUnique(slice []string, val string) []string {
	for _, item := range slice {
		if item == val {
			return slice
		}
	}
	return append(slice, val)
}
