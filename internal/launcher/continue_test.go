package launcher_test

import (
	"strings"
	"testing"

	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/launcher"
)

func TestFormatLoadGame(t *testing.T) {
	tests := []struct {
		name         string
		family       domain.EngineFamily
		wantNonEmpty bool
	}{
		{"GZDoom", domain.EngineFamilyGZDoom, true},
		{"Zandronum", domain.EngineFamilyZandronum, true},
		{"ChocolateDoom", domain.EngineFamilyChocolateDoom, true},
		{"CrispyDoom", domain.EngineFamilyCrispyDoom, true},
		{"PrBoomPlus", domain.EngineFamilyPrBoomPlus, true},
		{"DSDADoom", domain.EngineFamilyDSDADoom, true},
		{"Woof", domain.EngineFamilyWoof, true},
		{"Other", domain.EngineFamilyOther, true},
		{"empty", domain.EngineFamily(""), false},
		{"unknown", domain.EngineFamily("nightmare-doom"), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := launcher.FormatLoadGame(tt.family)
			if tt.wantNonEmpty && len(got) == 0 {
				t.Fatalf("FormatLoadGame(%q) = empty, want continue args", tt.family)
			}
			if !tt.wantNonEmpty && got != nil {
				t.Fatalf("FormatLoadGame(%q) = %q, want nil", tt.family, got)
			}
			if tt.wantNonEmpty && strings.Join(got, " ") != "-loadgame latest" {
				t.Fatalf("FormatLoadGame(%q) = %q, want %q", tt.family, got, "-loadgame latest")
			}
		})
	}
}
