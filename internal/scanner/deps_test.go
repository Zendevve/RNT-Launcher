package scanner

import (
	"archive/zip"
	"encoding/binary"
	"os"
	"path/filepath"
	"testing"

	"rnt-launcher/internal/domain"
)

func TestResolveDependenciesHeuristics(t *testing.T) {
	tests := []struct {
		name string
		path string
		want []string
	}{
		{name: "plain file no deps", path: "brutalv21.pk3", want: nil},
		{name: "with marker", path: "doom_with_brutal.pk3", want: []string{"brutal"}},
		{name: "plus marker", path: "base+extra_maps.wad", want: []string{"extra_maps"}},
		{name: "missing file still parses name", path: filepath.Join("nonexistent", "a_requires_b.wad"), want: []string{"b"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ResolveDependencies(domain.Mod{Name: tt.name, Path: tt.path})
			if len(got) != len(tt.want) {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Fatalf("got %v, want %v", got, tt.want)
				}
			}
		})
	}
}

func TestResolveDependenciesArchiveMapinfo(t *testing.T) {
	dir := t.TempDir()
	zipPath := filepath.Join(dir, "combo.pk3")
	f, err := os.Create(zipPath)
	if err != nil {
		t.Fatal(err)
	}
	w := zip.NewWriter(f)
	entry, err := w.Create("mapinfo.txt")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = entry.Write([]byte("gameinfo {}\n$requires \"doom2-base\"\nrequires: extra_textures, bonus_music\n"))
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}

	got := ResolveDependencies(domain.Mod{Name: "combo", Path: zipPath})
	want := map[string]bool{"doom2-base": true, "extra_textures": true, "bonus_music": true}
	if len(got) != len(want) {
		t.Fatalf("got %v, want keys %v", got, want)
	}
	for _, d := range got {
		if !want[d] {
			t.Fatalf("unexpected dep %q in %v", d, got)
		}
	}
}

func TestResolveDependenciesWADRequirements(t *testing.T) {
	dir := t.TempDir()
	wadPath := filepath.Join(dir, "needsbase.wad")
	body := []byte("$requires base-maps\n")
	headerSize := 12
	dirOff := headerSize + len(body)
	buf := make([]byte, 0, dirOff+16)
	buf = append(buf, []byte("PWAD")...)
	num := make([]byte, 4)
	binary.LittleEndian.PutUint32(num, 1)
	buf = append(buf, num...)
	off := make([]byte, 4)
	binary.LittleEndian.PutUint32(off, uint32(dirOff))
	buf = append(buf, off...)
	buf = append(buf, body...)
	pos := make([]byte, 4)
	binary.LittleEndian.PutUint32(pos, uint32(headerSize))
	buf = append(buf, pos...)
	size := make([]byte, 4)
	binary.LittleEndian.PutUint32(size, uint32(len(body)))
	buf = append(buf, size...)
	buf = append(buf, []byte{'G', 'A', 'M', 'E', 'I', 'N', 'F', 'O'}...)
	if err := os.WriteFile(wadPath, buf, 0644); err != nil {
		t.Fatal(err)
	}

	got := ResolveDependencies(domain.Mod{Name: "needsbase", Path: wadPath})
	if len(got) != 1 || got[0] != "base-maps" {
		t.Fatalf("got %v, want [base-maps]", got)
	}
}
