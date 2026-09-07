package engines

import (
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
