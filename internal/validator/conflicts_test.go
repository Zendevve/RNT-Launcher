package validator

import (
	"testing"

	"rnt-launcher/internal/domain"
)

func TestDetectConflictsFromLumps(t *testing.T) {
	tests := []struct {
		name      string
		sets      []ModLumpSet
		wantCode  string
		wantCount int
		wantSev   domain.ValidationSeverity
	}{
		{
			name: "disjoint lumps no findings",
			sets: []ModLumpSet{
				{ModID: "a", ModName: "A", Lumps: []string{"FOO", "BAR"}, Maps: []string{"MAP01"}},
				{ModID: "b", ModName: "B", Lumps: []string{"BAZ", "QUX"}, Maps: []string{"MAP02"}},
			},
			wantCount: 0,
		},
		{
			name: "overlapping lump warns last-wins",
			sets: []ModLumpSet{
				{ModID: "a", ModName: "Alpha", Lumps: []string{"TITLEPIC", "FOO"}},
				{ModID: "b", ModName: "Beta", Lumps: []string{"TITLEPIC", "BAR"}},
			},
			wantCode:  "mod-lump-collision",
			wantCount: 1,
			wantSev:   domain.ValidationSeverityWarning,
		},
		{
			name: "shared map slot errors",
			sets: []ModLumpSet{
				{ModID: "a", ModName: "Alpha", Lumps: []string{"MAP01"}, Maps: []string{"MAP01"}},
				{ModID: "b", ModName: "Beta", Lumps: []string{"MAP01"}, Maps: []string{"MAP01"}},
			},
			wantCode:  "mod-map-slot-collision",
			wantCount: 1, // map-slot lumps skip the generic lump warning; only the slot error fires
			wantSev:   domain.ValidationSeverityError,
		},
		{
			name: "disjoint maps no slot error",
			sets: []ModLumpSet{
				{ModID: "a", ModName: "Alpha", Maps: []string{"MAP01"}},
				{ModID: "b", ModName: "Beta", Maps: []string{"E1M1"}},
			},
			wantCount: 0,
		},
		{
			name: "truncated mod emits info",
			sets: []ModLumpSet{
				{ModID: "a", ModName: "Alpha", Lumps: []string{"FOO"}, Truncated: true},
				{ModID: "b", ModName: "Beta", Lumps: []string{"BAR"}},
			},
			wantCode:  "conflict-scan-truncated",
			wantCount: 1,
			wantSev:   domain.ValidationSeverityInfo,
		},
		{
			name:      "single mod no findings",
			sets:      []ModLumpSet{{ModID: "a", ModName: "Alpha", Lumps: []string{"FOO"}, Maps: []string{"MAP01"}}},
			wantCount: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			items := DetectConflictsFromLumps(tt.sets)
			if len(items) != tt.wantCount {
				t.Fatalf("got %d items %v, want %d", len(items), items, tt.wantCount)
			}
			if tt.wantCode != "" {
				found := false
				for _, it := range items {
					if it.Code == tt.wantCode {
						found = true
						if tt.wantSev != "" && it.Severity != tt.wantSev {
							t.Fatalf("code %s severity = %s, want %s", it.Code, it.Severity, tt.wantSev)
						}
					}
				}
				if !found {
					t.Fatalf("want code %s in %v", tt.wantCode, items)
				}
			}
		})
	}
}

func TestDetectConflictsTargetIsFirstClaimant(t *testing.T) {
	sets := []ModLumpSet{
		{ModID: "first", ModName: "First", Lumps: []string{"TITLEPIC"}, Maps: []string{"MAP01"}},
		{ModID: "second", ModName: "Second", Lumps: []string{"TITLEPIC"}, Maps: []string{"MAP01"}},
	}
	items := DetectConflictsFromLumps(sets)
	for _, it := range items {
		if it.Code == "mod-lump-collision" || it.Code == "mod-map-slot-collision" {
			if it.Target != "first" {
				t.Fatalf("code %s target = %s, want first (quick-fix acts on target)", it.Code, it.Target)
			}
		}
	}
}

func TestCheckEngineCompat(t *testing.T) {
	gz := &domain.Engine{ID: "e1", Name: "GZDoom", Family: domain.EngineFamilyGZDoom}
	choco := &domain.Engine{ID: "e2", Name: "Chocolate", Family: domain.EngineFamilyChocolateDoom}
	unknownIWAD := &domain.IWAD{ID: "w1", Name: "odd.wad", Type: domain.IWADTypeUnknown}
	doom2 := &domain.IWAD{ID: "w2", Name: "doom2.wad", Type: domain.IWADTypeDoom2}

	t.Run("pk3 on chocolate errors", func(t *testing.T) {
		items := CheckEngineCompat(choco, doom2, []domain.Mod{{ID: "m", Name: "M", Format: domain.ModFormatPK3}})
		if len(items) != 1 || items[0].Code != "engine-format-unsupported" || items[0].Severity != domain.ValidationSeverityError {
			t.Fatalf("got %v", items)
		}
	})
	t.Run("pk3 on gzdoom clean", func(t *testing.T) {
		if items := CheckEngineCompat(gz, doom2, []domain.Mod{{ID: "m", Name: "M", Format: domain.ModFormatPK3}}); len(items) != 0 {
			t.Fatalf("got %v", items)
		}
	})
	t.Run("deh on chocolate warns", func(t *testing.T) {
		items := CheckEngineCompat(choco, doom2, []domain.Mod{{ID: "m", Name: "M", Format: domain.ModFormatDEH}})
		if len(items) != 1 || items[0].Code != "engine-format-risk" {
			t.Fatalf("got %v", items)
		}
	})
	t.Run("mapinfo with unknown iwad warns", func(t *testing.T) {
		items := CheckEngineCompat(gz, unknownIWAD, []domain.Mod{{ID: "m", Name: "M", Format: domain.ModFormatWAD, Structures: []string{"MAPINFO"}}})
		if len(items) != 1 || items[0].Code != "iwad-mismatch-suspect" {
			t.Fatalf("got %v", items)
		}
	})
	t.Run("mapinfo with known iwad clean", func(t *testing.T) {
		if items := CheckEngineCompat(gz, doom2, []domain.Mod{{ID: "m", Name: "M", Structures: []string{"MAPINFO"}}}); len(items) != 0 {
			t.Fatalf("got %v", items)
		}
	})
	t.Run("nil engine and iwad skip", func(t *testing.T) {
		if items := CheckEngineCompat(nil, nil, []domain.Mod{{ID: "m", Name: "M", Format: domain.ModFormatPK3}}); len(items) != 0 {
			t.Fatalf("got %v", items)
		}
	})
}
