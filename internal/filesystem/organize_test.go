package filesystem

import (
	"bytes"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)
func TestClassifyAsset(t *testing.T) {
	iwadMagic := []byte("IWADxxxx")
	pwadMagic := []byte("PWADxxxx")
	zipMagic := []byte("PK\x03\x04xxxx")

	tests := []struct {
		name     string
		filename string
		header   []byte
		want     string
	}{
		{"exe engine binary", "gzdoom.exe", nil, "engines"},
		{"engine zip by token", "gzdoom-4-12-0.zip", zipMagic, "engines"},
		{"engine token case-insensitive", "GZDoom_port.zip", zipMagic, "engines"},
		{"plain zip is mod", "coolmaps.zip", zipMagic, "mods"},
		{"known iwad name", "doom2.wad", pwadMagic, "iwads"},
		{"known iwad uppercase", "DOOM.WAD", pwadMagic, "iwads"},
		{"iwad magic", "custom.wad", iwadMagic, "iwads"},
		{"pwad map", "map01.wad", pwadMagic, "wads"},
		{"wad short header", "tiny.wad", []byte("PW"), "wads"},
		{"pk3 mod", "brutal.pk3", zipMagic, "mods"},
		{"deh patch", "patch.deh", []byte("Patch File"), "mods"},
		{"txt doc", "readme.txt", []byte("text"), "mods"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ClassifyAsset(tt.filename, tt.header); got != tt.want {
				t.Errorf("ClassifyAsset(%q) = %q, want %q", tt.filename, got, tt.want)
			}
		})
	}
}

func TestOrganizeBatchLayout(t *testing.T) {
	src := t.TempDir()
	lib := t.TempDir()
	files := map[string][]byte{
		"gzdoom.exe":      {0x4D, 0x5A},
		"doom2.wad":       []byte("IWAD...."),
		"mystery.wad":     []byte("IWAD...."),
		"e1m1fix.wad":     []byte("PWAD...."),
		"brutalv21.pk3":   []byte("PK\x03\x04.."),
		"nerve Pandemie":  []byte("x"),
		"fastweaps.deh":   []byte("Patch"),
	}
	var srcs []string
	for name, data := range files {
		p := filepath.Join(src, name)
		if err := os.WriteFile(p, data, 0o644); err != nil {
			t.Fatal(err)
		}
		srcs = append(srcs, p)
	}

	dests, err := OrganizeBatch(srcs, lib)
	if err != nil {
		t.Fatalf("OrganizeBatch failed: %v", err)
	}
	if len(dests) != len(srcs) {
		t.Fatalf("got %d dests, want %d", len(dests), len(srcs))
	}

	wantFolder := map[string]string{
		"gzdoom.exe":     "engines",
		"doom2.wad":      "iwads",
		"mystery.wad":    "iwads",
		"e1m1fix.wad":    "wads",
		"brutalv21.pk3":  "mods",
		"nerve Pandemie": "mods",
		"fastweaps.deh":  "mods",
	}
	for _, d := range dests {
		base := filepath.Base(d)
		want := filepath.Join(lib, wantFolder[base], base)
		if d != want {
			t.Errorf("dest = %q, want %q", d, want)
		}
		if _, err := os.Stat(d); err != nil {
			t.Errorf("organized file missing %q: %v", d, err)
		}
	}
	entries, _ := os.ReadDir(src)
	if len(entries) != 0 {
		t.Errorf("source dir not drained, %d files remain", len(entries))
	}
}

func TestOrganizeBatchMissingFile(t *testing.T) {
	lib := t.TempDir()
	src := filepath.Join(t.TempDir(), "ghost.wad")
	if _, err := OrganizeBatch([]string{src}, lib); err == nil {
		t.Error("expected error for missing source, got nil")
	}
}

// TestInspectFileMatchesInspectReader pins the single-read fast path to the
// streaming path: identical FileInfo for every supported format.
func TestInspectFileMatchesInspectReader(t *testing.T) {
	dir := t.TempDir()
	cases := map[string][]byte{
		"doom2.wad":  buildSyntheticWAD("IWAD", []string{"MAP01", "E1M1", "DECORATE"}),
		"mod.wad":    buildSyntheticWAD("PWAD", []string{"MAP02", "ZSCRIPT"}),
		"mod.pk3":    buildSyntheticZip(map[string]string{"ZSCRIPT": "//", "maps/MAP01.wad": "x"}),
		"patch.deh":  []byte("Patch File\nDoom version = 19\n"),
		"notes.txt":  []byte("hello"),
		"empty.wad":  {},
		"broken.wad": []byte("PWAD"),
	}
	for name, data := range cases {
		p := filepath.Join(dir, name)
		if err := os.WriteFile(p, data, 0o644); err != nil {
			t.Fatal(err)
		}
		fromFile, errFile := InspectFile(p)
		if errFile != nil {
			t.Fatalf("%s: InspectFile error: %v", name, errFile)
		}
		fromReader, errReader := InspectReader(bytes.NewReader(data), int64(len(data)), name, fromFile.ModTime, p)
		if errReader != nil {
			t.Fatalf("%s: InspectReader error: %v", name, errReader)
		}
		// ModTime is set by caller; normalize before comparing.
		fromReader.ModTime = fromFile.ModTime
		if !reflect.DeepEqual(fromFile, fromReader) {
			t.Errorf("%s: InspectFile != InspectReader:\nfile:   %+v\nreader: %+v", name, fromFile, fromReader)
		}
		// Archive entry order and time.Time internals aside, hash must match.
		if fromFile.SHA256 != fromReader.SHA256 || fromFile.Format != fromReader.Format ||
			fromFile.Category != fromReader.Category {
			t.Errorf("%s: key fields diverge: %+v vs %+v", name, fromFile, fromReader)
		}
	}
}

func TestIsMapLumpTable(t *testing.T) {
	cases := map[string]bool{
		"MAP01": true, "MAP32": true, "MAP100": true,
		"E1M1": true, "E4M9": true,
		"MAP1": false, "MAP": false, "E1M10": false, "E0M1": false, "E1M0": false,
		"MAP0A": false, "DECORATE": false, "": false, "MAP01X": false,
	}
	for name, want := range cases {
		if got := isMapLump(name); got != want {
			t.Errorf("isMapLump(%q) = %v, want %v", name, got, want)
		}
	}
}

func TestParseLumpNameEdges(t *testing.T) {
	cases := map[string]string{
		"MAP01":        "MAP01",
		"map01":        "MAP01",
		"MAP01\x00XX":  "MAP01",
		"  E1M1  ":      "E1M1",
		"decorate":     "DECORATE",
		"\x01\x02AB\x7f": "AB",
		"":             "",
	}
	for in, want := range cases {
		if got := parseLumpName([]byte(in)); got != want {
			t.Errorf("parseLumpName(%q) = %q, want %q", in, got, want)
		}
	}
}
