package engines

import (
	"archive/zip"
	"archive/tar"
	"compress/gzip"
	"bytes"
	"context"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"rnt-launcher/internal/domain"
)

func TestPickWindowsAsset(t *testing.T) {
	tests := []struct {
		name  string
		names []string
		want  string
	}{
		{
			name:  "win64 zip beats win32 zip",
			names: []string{"gzdoom-4-12-2-Windows-win32.zip", "gzdoom-4-12-2-Windows-win64.zip"},
			want:  "gzdoom-4-12-2-Windows-win64.zip",
		},
		{
			name:  "win64 preferred regardless of order",
			names: []string{"gzdoom-win64.zip", "gzdoom-win32.zip"},
			want:  "gzdoom-win64.zip",
		},
		{
			name:  "windows-x64 alias matches",
			names: []string{"woof-15.3.1-windows-x86.zip", "woof-15.3.1-windows-x64.zip"},
			want:  "woof-15.3.1-windows-x64.zip",
		},
		{
			name:  "win32 fallback when no win64",
			names: []string{"chocolate-doom-win32.zip", "chocolate-doom-macos.zip"},
			want:  "chocolate-doom-win32.zip",
		},
		{
			name:  "first win32 zip wins among several",
			names: []string{"port-win32-a.zip", "port-win32-b.zip"},
			want:  "port-win32-a.zip",
		},
		{
			name:  "windows-x86 fallback",
			names: []string{"port-windows-x86.zip", "port-linux.tar.gz"},
			want:  "port-windows-x86.zip",
		},
		{
			name:  "non-zip windows assets ignored",
			names: []string{"gzdoom-win64.7z", "gzdoom-win32.exe"},
			want:  "",
		},
		{
			name:  "no windows asset",
			names: []string{"gzdoom-4-12-2-macOS.tar.gz", "gzdoom-4-12-2-Linux.tar.gz"},
			want:  "",
		},
		{
			name:  "empty input",
			names: nil,
			want:  "",
		},
		{
			name:  "match is case-insensitive",
			names: []string{"GzDoom-WIN64.ZIP"},
			want:  "GzDoom-WIN64.ZIP",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := pickWindowsAsset(tt.names); got != tt.want {
				t.Errorf("pickWindowsAsset(%v) = %q, want %q", tt.names, got, tt.want)
			}
		})
	}
}

func TestPickReleaseAsset(t *testing.T) {
	tests := []struct {
		name  string
		goos  string
		names []string
		want  string
	}{
		{
			name:  "windows prefers win64 over win32",
			goos:  "windows",
			names: []string{"gzdoom-win32.zip", "gzdoom-win64.zip"},
			want:  "gzdoom-win64.zip",
		},
		{
			name:  "unknown goos falls back to windows picking",
			goos:  "plan9",
			names: []string{"gzdoom-win32.zip", "gzdoom-win64.zip"},
			want:  "gzdoom-win64.zip",
		},
		{
			name:  "linux prefers tar.gz over zip",
			goos:  "linux",
			names: []string{"woof-linux.zip", "woof-linux.tar.gz"},
			want:  "woof-linux.tar.gz",
		},
		{
			name:  "linux tgz counts as preferred archive",
			goos:  "linux",
			names: []string{"woof-linux.zip", "woof-linux.tgz"},
			want:  "woof-linux.tgz",
		},
		{
			name:  "linux zip fallback when no tarball",
			goos:  "linux",
			names: []string{"woof-linux.zip", "woof-win64.zip"},
			want:  "woof-linux.zip",
		},
		{
			name:  "linux ignores non-linux archives",
			goos:  "linux",
			names: []string{"gzdoom-win64.zip", "gzdoom-macOS.zip"},
			want:  "",
		},
		{
			name:  "darwin prefers zip over dmg",
			goos:  "darwin",
			names: []string{"gzdoom-macOS.dmg", "gzdoom-macOS.zip"},
			want:  "gzdoom-macOS.zip",
		},
		{
			name:  "darwin dmg fallback when no zip",
			goos:  "darwin",
			names: []string{"gzdoom-macOS.dmg", "gzdoom-linux.tar.gz"},
			want:  "gzdoom-macOS.dmg",
		},
		{
			name:  "darwin osx token matches",
			goos:  "darwin",
			names: []string{"crispy-osx.zip"},
			want:  "crispy-osx.zip",
		},
		{
			name:  "darwin darwin token matches",
			goos:  "darwin",
			names: []string{"prboom-darwin.dmg"},
			want:  "prboom-darwin.dmg",
		},
		{
			name:  "darwin ignores unrelated archives",
			goos:  "darwin",
			names: []string{"gzdoom-win64.zip", "gzdoom-linux.tar.gz"},
			want:  "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := pickReleaseAsset(tt.names, tt.goos); got != tt.want {
				t.Errorf("pickReleaseAsset(%v, %q) = %q, want %q", tt.names, tt.goos, got, tt.want)
			}
		})
	}
}

func TestMissingPlatformAssetError(t *testing.T) {
	tests := []struct {
		name   string
		family domain.EngineFamily
		goos   string
		wantGo string
	}{
		{name: "windows", family: domain.EngineFamilyGZDoom, goos: "windows", wantGo: "windows"},
		{name: "linux", family: domain.EngineFamilyWoof, goos: "linux", wantGo: "linux"},
		{name: "darwin", family: domain.EngineFamilyCrispyDoom, goos: "darwin", wantGo: "darwin"},
		{name: "empty goos uses runtime", family: domain.EngineFamilyGZDoom, goos: "", wantGo: runtime.GOOS},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := missingPlatformAssetError(tt.family, "g4.12.2", tt.goos)
			if err == nil {
				t.Fatal("missingPlatformAssetError returned nil, want manual-download error")
			}
			for _, want := range []string{string(tt.family), tt.wantGo, DownloadPageURL(tt.family)} {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("error = %q, want substring %q", err.Error(), want)
				}
			}
		})
	}
}

func TestDownloadPageURL(t *testing.T) {
	for _, family := range domain.ValidEngineFamilies {
		t.Run(string(family), func(t *testing.T) {
			got := DownloadPageURL(family)
			if family == domain.EngineFamilyOther {
				if got != "" {
					t.Errorf("DownloadPageURL(other) = %q, want empty", got)
				}
				return
			}
			if got == "" {
				t.Errorf("DownloadPageURL(%q) is empty, want official download page", family)
			}
		})
	}
}

func TestSanitizeTagDir(t *testing.T) {
	tests := []struct {
		name string
		tag  string
		want string
	}{
		{name: "plain tag unchanged", tag: "g4.12.2", want: "g4.12.2"},
		{name: "slashes become underscores", tag: "release/4.12", want: "release_4.12"},
		{name: "backslashes become underscores", tag: `release\4.12`, want: "release_4.12"},
		{name: "surrounding whitespace trimmed", tag: "  g4.12.2  ", want: "g4.12.2"},
		{name: "leading and trailing dots trimmed", tag: "..g4.12.2..", want: "g4.12.2"},
		{name: "empty tag becomes unknown", tag: "", want: "unknown"},
		{name: "blank tag becomes unknown", tag: "   ", want: "unknown"},
		{name: "dots only become unknown", tag: "...", want: "unknown"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := sanitizeTagDir(tt.tag); got != tt.want {
				t.Errorf("sanitizeTagDir(%q) = %q, want %q", tt.tag, got, tt.want)
			}
		})
	}
}

func TestExtractZip(t *testing.T) {
	buildZip := func(t *testing.T, names []string) []byte {
		t.Helper()
		var buf bytes.Buffer
		w := zip.NewWriter(&buf)
		for _, n := range names {
			f, err := w.Create(n)
			if err != nil {
				t.Fatalf("create zip entry %q: %v", n, err)
			}
			if !strings.HasSuffix(n, "/") {
				if _, err := f.Write([]byte("data")); err != nil {
					t.Fatalf("write zip entry %q: %v", n, err)
				}
			}
		}
		if err := w.Close(); err != nil {
			t.Fatalf("close zip: %v", err)
		}
		return buf.Bytes()
	}
	// absEntry must satisfy filepath.IsAbs on the test platform: a rooted
	// path without a drive letter is drive-relative, not absolute, on Windows.
	absEntry := "/abs.txt"
	if runtime.GOOS == "windows" {
		absEntry = "C:/abs.txt"
	}
	tests := []struct {
		name     string
		names    []string
		wantErr  string
		wantFile string
	}{
		{
			name:     "valid layout with directory entry extracts",
			names:    []string{"gzdoom/", "gzdoom/gzdoom.exe"},
			wantFile: filepath.Join("gzdoom", "gzdoom.exe"),
		},
		{
			name:    "parent escape rejected",
			names:   []string{"../evil.txt"},
			wantErr: "escapes destination",
		},
		{
			name:    "nested parent escape rejected",
			names:   []string{"gzdoom/../../evil.txt"},
			wantErr: "escapes destination",
		},
		{
			name:    "absolute path rejected",
			names:   []string{absEntry},
			wantErr: "absolute path",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dest := t.TempDir()
			err := extractZip(buildZip(t, tt.names), dest)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("extractZip returned error: %v", err)
				}
				if _, statErr := os.Stat(filepath.Join(dest, tt.wantFile)); statErr != nil {
					t.Errorf("expected extracted file %q: %v", tt.wantFile, statErr)
				}
				return
			}
			if err == nil {
				t.Fatalf("extractZip succeeded, want error containing %q", tt.wantErr)
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("extractZip error = %q, want substring %q", err.Error(), tt.wantErr)
			}
		})
	}
}

func TestEnsureFamiliesWithoutReleaseSource(t *testing.T) {
	svc := NewEngineService(nil)
	tests := []struct {
		name         string
		family       domain.EngineFamily
		wantContains []string
	}{
		{
			name:   "zandronum names family reason and page",
			family: domain.EngineFamilyZandronum,
			wantContains: []string{
				`"zandronum"`,
				"no GitHub release source",
				"https://zandronum.com/downloads",
			},
		},
		{
			name:         "other cannot be provisioned",
			family:       domain.EngineFamilyOther,
			wantContains: []string{`"other"`, "cannot be auto-provisioned"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := svc.Ensure(context.Background(), tt.family, "latest", t.TempDir())
			if err == nil {
				t.Fatalf("Ensure(%q) succeeded, want manual-download error", tt.family)
			}
			for _, want := range tt.wantContains {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("Ensure(%q) error = %q, want substring %q", tt.family, err.Error(), want)
				}
			}
		})
	}
}
func TestExtractTarGz(t *testing.T) {
	buildTarGz := func(t *testing.T, names []string, mode int64) []byte {
		t.Helper()
		var buf bytes.Buffer
		gz := gzip.NewWriter(&buf)
		w := tar.NewWriter(gz)
		for _, n := range names {
			isDir := strings.HasSuffix(n, "/")
			hdr := &tar.Header{Name: n, Mode: mode}
			if isDir {
				hdr.Typeflag = tar.TypeDir
			} else {
				hdr.Typeflag = tar.TypeReg
				hdr.Size = int64(len("data"))
			}
			if err := w.WriteHeader(hdr); err != nil {
				t.Fatalf("write tar header %q: %v", n, err)
			}
			if !isDir {
				if _, err := w.Write([]byte("data")); err != nil {
					t.Fatalf("write tar entry %q: %v", n, err)
				}
			}
		}
		if err := w.Close(); err != nil {
			t.Fatalf("close tar: %v", err)
		}
		if err := gz.Close(); err != nil {
			t.Fatalf("close gzip: %v", err)
		}
		return buf.Bytes()
	}
	absEntry := "/abs.txt"
	if runtime.GOOS == "windows" {
		absEntry = "C:/abs.txt"
	}
	tests := []struct {
		name     string
		names    []string
		mode     int64
		wantErr  string
		wantFile string
		wantMode os.FileMode
	}{
		{
			name:     "valid layout extracts and preserves executable bit",
			names:    []string{"gzdoom/", "gzdoom/gzdoom"},
			mode:     0o755,
			wantFile: filepath.Join("gzdoom", "gzdoom"),
			wantMode: 0o755,
		},
		{
			name:    "parent escape rejected",
			names:   []string{"../evil.txt"},
			mode:    0o644,
			wantErr: "escapes destination",
		},
		{
			name:    "absolute path rejected",
			names:   []string{absEntry},
			mode:    0o644,
			wantErr: "absolute path",
		},
		{
			name:    "corrupt gzip rejected",
			names:   nil,
			mode:    0o644,
			wantErr: "gzip",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dest := t.TempDir()
			var data []byte
			if tt.names == nil {
				data = []byte("not a gzip archive")
			} else {
				data = buildTarGz(t, tt.names, tt.mode)
			}
			err := extractTarGz(data, dest)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("extractTarGz returned error: %v", err)
				}
				fi, statErr := os.Stat(filepath.Join(dest, tt.wantFile))
				if statErr != nil {
					t.Fatalf("expected extracted file %q: %v", tt.wantFile, statErr)
				}
				if runtime.GOOS != "windows" && fi.Mode().Perm() != tt.wantMode {
					t.Errorf("mode = %o, want %o", fi.Mode().Perm(), tt.wantMode)
				}
				return
			}
			if err == nil {
				t.Fatalf("extractTarGz succeeded, want error containing %q", tt.wantErr)
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("extractTarGz error = %q, want substring %q", err.Error(), tt.wantErr)
			}
		})
	}
}
