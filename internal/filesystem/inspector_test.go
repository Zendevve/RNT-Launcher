package filesystem

import (
	"archive/zip"
	"bytes"
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"
)

// helper to build a synthetic WAD in memory
func buildSyntheticWAD(magic string, lumps []string) []byte {
	buf := new(bytes.Buffer)

	// Header: 4 bytes magic, 4 bytes numlumps, 4 bytes infotableofs
	numLumps := uint32(len(lumps))
	infotableOfs := uint32(12) // directory immediately follows header for synthetic WAD

	buf.WriteString(magic)
	_ = binary.Write(buf, binary.LittleEndian, numLumps)
	_ = binary.Write(buf, binary.LittleEndian, infotableOfs)

	// Directory entries: 16 bytes each (4 filepos, 4 size, 8 lump name)
	for _, name := range lumps {
		_ = binary.Write(buf, binary.LittleEndian, uint32(0)) // dummy filepos
		_ = binary.Write(buf, binary.LittleEndian, uint32(0)) // dummy size

		var nameBytes [8]byte
		copy(nameBytes[:], []byte(name))
		buf.Write(nameBytes[:])
	}

	return buf.Bytes()
}

// helper to build a synthetic ZIP/PK3 in memory
func buildSyntheticZip(entries map[string]string) []byte {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	for name, content := range entries {
		w, err := zw.Create(name)
		if err != nil {
			panic(err)
		}
		_, _ = w.Write([]byte(content))
	}

	_ = zw.Close()
	return buf.Bytes()
}

func TestWADInspection(t *testing.T) {
	t.Run("Valid IWAD with Doom 1 maps", func(t *testing.T) {
		lumps := []string{"E1M1", "E1M2", "MAPINFO", "TEXTURES", "S_START", "S_END"}
		data := buildSyntheticWAD("IWAD", lumps)

		wadInfo, err := InspectWADBytes(data)
		if err != nil {
			t.Fatalf("InspectWADBytes failed: %v", err)
		}

		if wadInfo.Magic != "IWAD" {
			t.Errorf("expected magic IWAD, got %s", wadInfo.Magic)
		}
		if !wadInfo.IsIWAD {
			t.Errorf("expected IsIWAD to be true")
		}
		if wadInfo.LumpCount != len(lumps) {
			t.Errorf("expected lump count %d, got %d", len(lumps), wadInfo.LumpCount)
		}

		expectedMaps := []string{"E1M1", "E1M2"}
		if len(wadInfo.Maps) != len(expectedMaps) {
			t.Fatalf("expected maps %v, got %v", expectedMaps, wadInfo.Maps)
		}
		for i, m := range expectedMaps {
			if wadInfo.Maps[i] != m {
				t.Errorf("map[%d] expected %s, got %s", i, m, wadInfo.Maps[i])
			}
		}

		expectedStructures := []string{"MAPINFO", "TEXTURES", "SPRITES"}
		if len(wadInfo.Structures) != len(expectedStructures) {
			t.Fatalf("expected structures %v, got %v", expectedStructures, wadInfo.Structures)
		}
		for i, s := range expectedStructures {
			if wadInfo.Structures[i] != s {
				t.Errorf("structure[%d] expected %s, got %s", i, s, wadInfo.Structures[i])
			}
		}
	})

	t.Run("Valid PWAD with 8-character lump names", func(t *testing.T) {
		// Exact 8-char names without null byte
		lumps := []string{"MAP01", "DECORATE", "ANIMDEFS", "CVARINFO", "MENUDEFS"}
		data := buildSyntheticWAD("PWAD", lumps)

		wadInfo, err := InspectWADBytes(data)
		if err != nil {
			t.Fatalf("InspectWADBytes failed: %v", err)
		}

		if wadInfo.Magic != "PWAD" {
			t.Errorf("expected magic PWAD, got %s", wadInfo.Magic)
		}
		if wadInfo.IsIWAD {
			t.Errorf("expected IsIWAD to be false")
		}
		if len(wadInfo.Maps) != 1 || wadInfo.Maps[0] != "MAP01" {
			t.Errorf("expected map MAP01, got %v", wadInfo.Maps)
		}

		expectedStructures := []string{"DECORATE", "ANIMDEFS", "CVARINFO", "MENUDEFS"}
		if len(wadInfo.Structures) != len(expectedStructures) {
			t.Fatalf("expected structures %v, got %v", expectedStructures, wadInfo.Structures)
		}
	})

	t.Run("PWAD Megawad with 15 maps", func(t *testing.T) {
		lumps := []string{
			"MAP01", "MAP02", "MAP03", "MAP04", "MAP05",
			"MAP06", "MAP07", "MAP08", "MAP09", "MAP10",
			"MAP11", "MAP12", "MAP13", "MAP14", "MAP15",
			"MAPINFO", "DEHACKED",
		}
		data := buildSyntheticWAD("PWAD", lumps)

		fileInfo, err := InspectBytes(data, "megawad.wad")
		if err != nil {
			t.Fatalf("InspectBytes failed: %v", err)
		}

		if fileInfo.Format != "PWAD" {
			t.Errorf("expected format PWAD, got %s", fileInfo.Format)
		}
		if fileInfo.Category != "Megawads" {
			t.Errorf("expected category Megawads, got %s", fileInfo.Category)
		}
		if len(fileInfo.Maps) != 15 {
			t.Errorf("expected 15 maps, got %d", len(fileInfo.Maps))
		}
	})

	t.Run("Malformed WADs", func(t *testing.T) {
		// 1. Truncated header
		_, err := InspectWADBytes([]byte("IWA"))
		if err == nil {
			t.Errorf("expected error for truncated WAD, got nil")
		}

		// 2. Invalid magic
		_, err = InspectWADBytes([]byte("NOPE\x00\x00\x00\x00\x0c\x00\x00\x00"))
		if err == nil {
			t.Errorf("expected error for invalid magic, got nil")
		}

		// 3. Offset beyond file size
		badOffset := []byte("IWAD\x01\x00\x00\x00\xff\xff\x00\x00")
		_, err = InspectWADBytes(badOffset)
		if err == nil {
			t.Errorf("expected error for out of bounds offset, got nil")
		}
	})
}

func TestArchiveInspection(t *testing.T) {
	t.Run("Gameplay PK3 with ZScript and Decorate", func(t *testing.T) {
		entries := map[string]string{
			"zscript.zs":           "version \"4.10\"",
			"decorate.txt":         "actor TestActor : DoomImp {}",
			"sounds/jump.wav":      "RIFF...",
			"sprites/trooa1.png":   "PNG...",
			"textures/wall.png":    "PNG...",
			"maps/map01.wad":       "PWAD...",
		}
		data := buildSyntheticZip(entries)

		fileInfo, err := InspectBytes(data, "brutal_mod.pk3")
		if err != nil {
			t.Fatalf("InspectBytes failed: %v", err)
		}

		if fileInfo.Format != "PK3" {
			t.Errorf("expected format PK3, got %s", fileInfo.Format)
		}
		if fileInfo.Category != "Gameplay" {
			t.Errorf("expected category Gameplay, got %s", fileInfo.Category)
		}
		if len(fileInfo.Maps) != 1 || fileInfo.Maps[0] != "MAP01" {
			t.Errorf("expected map MAP01, got %v", fileInfo.Maps)
		}

		hasZScript := false
		hasDecorate := false
		hasSprites := false
		for _, s := range fileInfo.Structures {
			if s == "ZSCRIPT" {
				hasZScript = true
			}
			if s == "DECORATE" {
				hasDecorate = true
			}
			if s == "SPRITES" {
				hasSprites = true
			}
		}
		if !hasZScript || !hasDecorate || !hasSprites {
			t.Errorf("missing expected structures, got %v", fileInfo.Structures)
		}
	})

	t.Run("Audio only PK3", func(t *testing.T) {
		entries := map[string]string{
			"sndinfo.txt":         "weapons/shotgf dsshotgn",
			"music/track01.ogg":   "OGG...",
			"sounds/shotgun.wav":  "RIFF...",
		}
		data := buildSyntheticZip(entries)

		fileInfo, err := InspectBytes(data, "metal_soundtrack.pk3")
		if err != nil {
			t.Fatalf("InspectBytes failed: %v", err)
		}

		if fileInfo.Category != "Audio" {
			t.Errorf("expected category Audio, got %s", fileInfo.Category)
		}
	})

	t.Run("Textures only PK3", func(t *testing.T) {
		entries := map[string]string{
			"textures.txt":       "texture WALL01, 64, 128 {}",
			"flats/flat1.png":    "PNG...",
			"patches/patch1.png": "PNG...",
		}
		data := buildSyntheticZip(entries)

		fileInfo, err := InspectBytes(data, "hires_textures.pk3")
		if err != nil {
			t.Fatalf("InspectBytes failed: %v", err)
		}

		if fileInfo.Category != "Textures" {
			t.Errorf("expected category Textures, got %s", fileInfo.Category)
		}
	})

	t.Run("Megawad PK3 with multiple maps in maps/", func(t *testing.T) {
		entries := map[string]string{
			"maps/map01.wad": "PWAD...",
			"maps/map02.wad": "PWAD...",
			"maps/map03.wad": "PWAD...",
			"maps/map04.wad": "PWAD...",
			"maps/map05.wad": "PWAD...",
			"maps/map06.wad": "PWAD...",
			"maps/map07.wad": "PWAD...",
			"maps/map08.wad": "PWAD...",
			"maps/map09.wad": "PWAD...",
			"maps/map10.wad": "PWAD...",
			"maps/map11.wad": "PWAD...",
			"maps/map12.wad": "PWAD...",
			"mapinfo.txt":    "map MAP01 \"Level 1\" {}",
		}
		data := buildSyntheticZip(entries)

		fileInfo, err := InspectBytes(data, "community_megawad.pk3")
		if err != nil {
			t.Fatalf("InspectBytes failed: %v", err)
		}

		if fileInfo.Category != "Megawads" {
			t.Errorf("expected category Megawads, got %s", fileInfo.Category)
		}
		if len(fileInfo.Maps) != 12 {
			t.Errorf("expected 12 maps, got %d", len(fileInfo.Maps))
		}
	})

	t.Run("Single map PK3", func(t *testing.T) {
		entries := map[string]string{
			"maps/e1m1.wad": "PWAD...",
		}
		data := buildSyntheticZip(entries)

		fileInfo, err := InspectBytes(data, "mymap.pk3")
		if err != nil {
			t.Fatalf("InspectBytes failed: %v", err)
		}

		if fileInfo.Category != "Maps" {
			t.Errorf("expected category Maps, got %s", fileInfo.Category)
		}
		if len(fileInfo.Maps) != 1 || fileInfo.Maps[0] != "E1M1" {
			t.Errorf("expected map E1M1, got %v", fileInfo.Maps)
		}
	})

	t.Run("7z / PK7 header detection", func(t *testing.T) {
		// Valid 7z signature
		sevenZipHeader := []byte{0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C, 0x00, 0x04}
		fileInfo, err := InspectBytes(sevenZipHeader, "mod.pk7")
		if err != nil {
			t.Fatalf("InspectBytes failed for pk7: %v", err)
		}

		if fileInfo.Format != "PK7" {
			t.Errorf("expected format PK7, got %s", fileInfo.Format)
		}
	})

	t.Run("DEH and BEX detection", func(t *testing.T) {
		dehData := []byte("Patch File for DeHackEd v3.0\nDoom version = 19\n")
		fileInfo, err := InspectBytes(dehData, "patch.deh")
		if err != nil {
			t.Fatalf("InspectBytes failed for DEH: %v", err)
		}

		if fileInfo.Format != "DEH" {
			t.Errorf("expected format DEH, got %s", fileInfo.Format)
		}
		if fileInfo.Category != "Gameplay" {
			t.Errorf("expected category Gameplay, got %s", fileInfo.Category)
		}
	})
}

func TestSHA256Hasher(t *testing.T) {
	// Empty data
	emptyHash := ComputeSHA256Bytes([]byte{})
	expectedEmpty := "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
	if emptyHash != expectedEmpty {
		t.Errorf("empty sha256 mismatch: got %s, expected %s", emptyHash, expectedEmpty)
	}

	// Known test string "DOOM"
	doomHash := ComputeSHA256Bytes([]byte("DOOM"))
	expectedDoom := "a0eb3ddfa5807780a562b9c313b2537f1e8dc621e9a524f8c1ffcf07a79e35c7"
	if doomHash != expectedDoom {
		t.Errorf("doom sha256 mismatch: got %s, expected %s", doomHash, expectedDoom)
	}

	// Stream reader test
	readerHash, err := ComputeSHA256Reader(bytes.NewReader([]byte("DOOM")))
	if err != nil {
		t.Fatalf("ComputeSHA256Reader failed: %v", err)
	}
	if readerHash != expectedDoom {
		t.Errorf("reader sha256 mismatch: got %s, expected %s", readerHash, expectedDoom)
	}
}

func TestInspectFileOnDisk(t *testing.T) {
	tempDir := t.TempDir()

	// 1. Create a real PWAD file on disk
	pwadData := buildSyntheticWAD("PWAD", []string{"MAP01", "MAP02", "MAPINFO", "SNDINFO"})
	pwadPath := filepath.Join(tempDir, "testmod.wad")
	if err := os.WriteFile(pwadPath, pwadData, 0644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	fileInfo, err := InspectFile(pwadPath)
	if err != nil {
		t.Fatalf("InspectFile failed: %v", err)
	}

	if fileInfo.Filename != "testmod.wad" {
		t.Errorf("expected filename testmod.wad, got %s", fileInfo.Filename)
	}
	if fileInfo.Size != int64(len(pwadData)) {
		t.Errorf("expected size %d, got %d", len(pwadData), fileInfo.Size)
	}
	if fileInfo.Format != "PWAD" {
		t.Errorf("expected format PWAD, got %s", fileInfo.Format)
	}
	if fileInfo.Category != "Maps" {
		t.Errorf("expected category Maps, got %s", fileInfo.Category)
	}
	if len(fileInfo.Maps) != 2 {
		t.Errorf("expected 2 maps, got %d", len(fileInfo.Maps))
	}
	if fileInfo.SHA256 == "" {
		t.Errorf("expected non-empty SHA256")
	}

	// 2. Missing file error check
	_, err = InspectFile(filepath.Join(tempDir, "does_not_exist.wad"))
	if err != ErrFileNotFound {
		t.Errorf("expected ErrFileNotFound, got %v", err)
	}

	// 3. Directory path error check
	_, err = InspectFile(tempDir)
	if err != ErrIsDirectory {
		t.Errorf("expected ErrIsDirectory, got %v", err)
	}
}
func TestCategoryHeuristics(t *testing.T) {
	tests := []struct {
		name       string
		format     string
		maps       []string
		structures []string
		expected   string
	}{
		{
			name:       "Megawad with 11 maps",
			format:     "PWAD",
			maps:       []string{"MAP01", "MAP02", "MAP03", "MAP04", "MAP05", "MAP06", "MAP07", "MAP08", "MAP09", "MAP10", "MAP11"},
			structures: []string{"MAPINFO", "DECORATE"},
			expected:   "Megawads",
		},
		{
			name:       "Gameplay mod with ZScript",
			format:     "PK3",
			maps:       []string{},
			structures: []string{"ZSCRIPT", "SOUNDS"},
			expected:   "Gameplay",
		},
		{
			name:       "Gameplay mod with Decorate and 1 map",
			format:     "PWAD",
			maps:       []string{"MAP01"},
			structures: []string{"DECORATE"},
			expected:   "Gameplay",
		},
		{
			name:       "Map pack with 5 maps",
			format:     "PWAD",
			maps:       []string{"MAP01", "MAP02", "MAP03", "MAP04", "MAP05"},
			structures: []string{"MAPINFO"},
			expected:   "Maps",
		},
		{
			name:       "Audio mod with sound effects and music",
			format:     "PK3",
			maps:       []string{},
			structures: []string{"SNDINFO", "SOUNDS", "MUSIC"},
			expected:   "Audio",
		},
		{
			name:       "Texture pack with flats and patches",
			format:     "PK3",
			maps:       []string{},
			structures: []string{"TEXTURES", "FLATS", "PATCHES"},
			expected:   "Textures",
		},
		{
			name:       "DeHackEd file",
			format:     "DEH",
			maps:       []string{},
			structures: []string{"DEHACKED"},
			expected:   "Gameplay",
		},
		{
			name:       "General mod with custom graphics/fonts only",
			format:     "PK3",
			maps:       []string{},
			structures: []string{"GRAPHICS", "FONTS"},
			expected:   "Mods",
		},
		{
			name:       "Unknown format with no structures",
			format:     "UNKNOWN",
			maps:       []string{},
			structures: []string{},
			expected:   "Other",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cat := DetermineCategory(tc.format, tc.maps, tc.structures, "test.file")
			if cat != tc.expected {
				t.Errorf("expected %s, got %s", tc.expected, cat)
			}
		})
	}
}

func TestHelperFunctions(t *testing.T) {
	// IsWADMagic
	if !IsWADMagic("IWAD") || !IsWADMagic("PWAD") || !IsWADMagic("iwad") || !IsWADMagic("pwad") {
		t.Errorf("IsWADMagic failed for valid magics")
	}
	if IsWADMagic("FAIL") || IsWADMagic("") {
		t.Errorf("IsWADMagic returned true for invalid magic")
	}

	// IsZip
	validZipHeader := []byte{'P', 'K', 3, 4}
	if !IsZip(validZipHeader) {
		t.Errorf("IsZip returned false for valid zip header")
	}
	if IsZip([]byte{1, 2, 3, 4}) {
		t.Errorf("IsZip returned true for invalid header")
	}

	// Is7z
	valid7zHeader := []byte{0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C}
	if !Is7z(valid7zHeader) {
		t.Errorf("Is7z returned false for valid 7z header")
	}
	if Is7z([]byte{0x37, 0x7A, 0x00, 0x00, 0x00, 0x00}) {
		t.Errorf("Is7z returned true for invalid 7z header")
	}
}

func TestWADSubLumpFiltering(t *testing.T) {
	// Standard Doom map with sub-lumps: THINGS, LINEDEFS, etc.
	lumps := []string{
		"MAP01",
		"THINGS",
		"LINEDEFS",
		"SIDEDEFS",
		"VERTEXES",
		"SEGS",
		"SSECTORS",
		"NODES",
		"SECTORS",
		"REJECT",
		"BLOCKMAP",
		"BEHAVIOR",
		"MAP02",
		"THINGS",
		"LINEDEFS",
		"MAP01", // duplicate map entry should be deduplicated
	}
	data := buildSyntheticWAD("PWAD", lumps)
	wadInfo, err := InspectWADBytes(data)
	if err != nil {
		t.Fatalf("InspectWADBytes failed: %v", err)
	}

	if len(wadInfo.Maps) != 2 {
		t.Fatalf("expected exactly 2 maps (MAP01, MAP02), got %d: %v", len(wadInfo.Maps), wadInfo.Maps)
	}
	if wadInfo.Maps[0] != "MAP01" || wadInfo.Maps[1] != "MAP02" {
		t.Errorf("unexpected map list: %v", wadInfo.Maps)
	}
}
func TestComprehensiveInspectionAndCoverage(t *testing.T) {
	tempDir := t.TempDir()

	// 1. Test InspectWAD directly from disk
	wadLumps := []string{
		"MAP01", "ZMAPINFO", "GLDEFS", "VOXELDEF", "LOCKDEFS", "SBARINFO",
		"F_START", "F_END", "P_START", "P_END", "C_START", "C_END", "V_START", "V_END",
		"HI_START", "HI_END", "A_START", "A_END",
	}
	wadData := buildSyntheticWAD("IWAD", wadLumps)
	wadPath := filepath.Join(tempDir, "doom2_extra.wad")
	if err := os.WriteFile(wadPath, wadData, 0644); err != nil {
		t.Fatalf("failed to write wad: %v", err)
	}

	wadInfo, err := InspectWAD(wadPath)
	if err != nil {
		t.Fatalf("InspectWAD failed: %v", err)
	}
	if !wadInfo.IsIWAD || wadInfo.LumpCount != len(wadLumps) {
		t.Errorf("unexpected wadInfo: %+v", wadInfo)
	}

	// 2. Test ComputeSHA256 from disk
	hash, err := ComputeSHA256(wadPath)
	if err != nil {
		t.Fatalf("ComputeSHA256 failed: %v", err)
	}
	if hash != ComputeSHA256Bytes(wadData) {
		t.Errorf("hash mismatch: got %s vs %s", hash, ComputeSHA256Bytes(wadData))
	}

	// 3. Test InspectArchive from disk & InspectArchiveBytes with IPK3
	archiveEntries := map[string]string{
		"gameinfo.txt":         "IWAD = \"DOOM2.WAD\"",
		"animdefs.txt":         "TEXTURE WALL1",
		"cvarinfo.txt":         "server int my_cvar = 1;",
		"keyconf.txt":          "alias test \"say hi\"",
		"menudefs.txt":         "OptionMenu MyMenu {}",
		"sbarinfo.txt":         "statusbar fullscreen {}",
		"lockdefs.txt":         "LOCK 1 {}",
		"voxeldef.txt":         "SPIDA0 = \"spida0.vox\"",
		"models/tree.md3":      "MD3...",
		"actors/monster.txt":   "actor Imp2 {}",
		"voxels/chair.vox":     "VOX...",
		"hires/titlepic.png":   "PNG...",
		"colormaps/water.lmp":  "LMP...",
		"graphics/logo.png":    "PNG...",
		"fonts/font.fon":       "FON...",
		"zscript/main.zs":      "version 4.10;",
		"decorate/weapons.dec": "actor Gun {}",
		"custom.bex":           "BEX...",
	}
	zipData := buildSyntheticZip(archiveEntries)
	ipk3Path := filepath.Join(tempDir, "game.ipk3")
	if err := os.WriteFile(ipk3Path, zipData, 0644); err != nil {
		t.Fatalf("failed to write ipk3: %v", err)
	}

	archInfo, err := InspectArchive(ipk3Path)
	if err != nil {
		t.Fatalf("InspectArchive failed: %v", err)
	}
	if archInfo.Format != "IPK3" {
		t.Errorf("expected format IPK3, got %s", archInfo.Format)
	}

	// InspectArchiveBytes
	archInfoBytes, err := InspectArchiveBytes(zipData, "test.zip")
	if err != nil {
		t.Fatalf("InspectArchiveBytes failed: %v", err)
	}
	if archInfoBytes.Format != "ZIP" {
		t.Errorf("expected format ZIP, got %s", archInfoBytes.Format)
	}

	// 4. Test InspectFile on IPK3 on disk
	fileInfo, err := InspectFile(ipk3Path)
	if err != nil {
		t.Fatalf("InspectFile on IPK3 failed: %v", err)
	}
	if fileInfo.Format != "IPK3" || fileInfo.Category != "Gameplay" {
		t.Errorf("unexpected fileInfo for IPK3: %+v", fileInfo)
	}

	// 5. Test InspectFile on .bex file
	bexPath := filepath.Join(tempDir, "patch.bex")
	if err := os.WriteFile(bexPath, []byte("BEX PATCH"), 0644); err != nil {
		t.Fatalf("failed to write bex: %v", err)
	}
	bexInfo, err := InspectFile(bexPath)
	if err != nil {
		t.Fatalf("InspectFile on BEX failed: %v", err)
	}
	if bexInfo.Format != "BEX" || bexInfo.Category != "Gameplay" {
		t.Errorf("unexpected bexInfo: %+v", bexInfo)
	}

	// 6. Test InspectFile on 7z file
	sevenZipHeader := []byte{0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00}
	sevenZipPath := filepath.Join(tempDir, "archive.7z")
	if err := os.WriteFile(sevenZipPath, sevenZipHeader, 0644); err != nil {
		t.Fatalf("failed to write 7z: %v", err)
	}
	sevenZipInfo, err := InspectFile(sevenZipPath)
	if err != nil {
		t.Fatalf("InspectFile on 7Z failed: %v", err)
	}
	if sevenZipInfo.Format != "7Z" {
		t.Errorf("expected 7Z, got %s", sevenZipInfo.Format)
	}
}
