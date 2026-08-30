package domain_test

import (
	"reflect"
	"testing"

	"rnt-launcher/internal/domain"
)

func TestComputeBitmask(t *testing.T) {
	t.Run("empty slice returns 0", func(t *testing.T) {
		if got := domain.ComputeBitmask(nil); got != 0 {
			t.Errorf("expected 0 for nil, got %d", got)
		}
		if got := domain.ComputeBitmask([]uint64{}); got != 0 {
			t.Errorf("expected 0 for empty slice, got %d", got)
		}
	})

	t.Run("single flag returns itself", func(t *testing.T) {
		if got := domain.ComputeBitmask([]uint64{1048576}); got != 1048576 {
			t.Errorf("expected 1048576, got %d", got)
		}
	})

	t.Run("multiple flags ORed correctly", func(t *testing.T) {
		selected := []uint64{1, 2, 4, 32768} // DF_NO_HEALTH, DF_NO_ITEMS, DF_WEAPONS_STAY, DF_NO_JUMP
		expected := uint64(1 | 2 | 4 | 32768)
		if got := domain.ComputeBitmask(selected); got != expected {
			t.Errorf("expected %d, got %d", expected, got)
		}
	})

	t.Run("duplicates are idempotent", func(t *testing.T) {
		selected := []uint64{4, 4, 16, 16}
		if got := domain.ComputeBitmask(selected); got != 20 {
			t.Errorf("expected 20, got %d", got)
		}
	})
}

func TestParseBitmask(t *testing.T) {
	t.Run("zero mask returns nil or empty slice", func(t *testing.T) {
		parsed := domain.ParseBitmask(0, domain.DMFlags)
		if len(parsed) != 0 {
			t.Errorf("expected empty slice, got %d items", len(parsed))
		}
	})

	t.Run("parses exact flags", func(t *testing.T) {
		mask := uint64(1 | 4 | 65536) // DF_NO_HEALTH (1), DF_WEAPONS_STAY (4), DF_NO_CROUCH (65536)
		parsed := domain.ParseBitmask(mask, domain.DMFlags)

		if len(parsed) != 3 {
			t.Fatalf("expected 3 flags, got %d", len(parsed))
		}
		names := make(map[string]bool)
		for _, f := range parsed {
			names[f.Name] = true
		}
		for _, want := range []string{"DF_NO_HEALTH", "DF_WEAPONS_STAY", "DF_NO_CROUCH"} {
			if !names[want] {
				t.Errorf("expected flag %s in parsed result", want)
			}
		}
	})

	t.Run("ignores unknown bits", func(t *testing.T) {
		// Bit 1 is DF_NO_HEALTH, bit (1 << 60) is unmapped
		mask := uint64(1 | (uint64(1) << 60))
		parsed := domain.ParseBitmask(mask, domain.DMFlags)

		if len(parsed) != 1 {
			t.Fatalf("expected 1 flag, got %d", len(parsed))
		}
		if parsed[0].Name != "DF_NO_HEALTH" {
			t.Errorf("expected DF_NO_HEALTH, got %s", parsed[0].Name)
		}
	})

	t.Run("round trip computation and parsing", func(t *testing.T) {
		flagsToSelect := []domain.Bitflag{
			domain.DMFlags2[0],
			domain.DMFlags2[2],
			domain.DMFlags2[4],
		}
		var values []uint64
		for _, f := range flagsToSelect {
			values = append(values, f.Value)
		}

		mask := domain.ComputeBitmask(values)
		parsed := domain.ParseBitmask(mask, domain.DMFlags2)

		if !reflect.DeepEqual(flagsToSelect, parsed) {
			t.Errorf("round trip failed: expected %+v, got %+v", flagsToSelect, parsed)
		}
	})
}

func TestNoDuplicates(t *testing.T) {
	lists := []struct {
		name  string
		flags []domain.Bitflag
	}{
		{"DMFlags", domain.DMFlags},
		{"DMFlags2", domain.DMFlags2},
		{"CompatFlags", domain.CompatFlags},
		{"CompatFlags2", domain.CompatFlags2},
	}

	for _, tc := range lists {
		t.Run(tc.name, func(t *testing.T) {
			if len(tc.flags) == 0 {
				t.Fatalf("%s flag list should not be empty", tc.name)
			}

			seenValues := make(map[uint64]string)
			seenNames := make(map[string]uint64)

			for _, flag := range tc.flags {
				// Non-zero value
				if flag.Value == 0 {
					t.Errorf("Flag %s in %s has zero value", flag.Name, tc.name)
				}

				// Power of 2 (only one bit set)
				if (flag.Value & (flag.Value - 1)) != 0 {
					t.Errorf("Flag %s value %d in %s is not a power of 2", flag.Name, flag.Value, tc.name)
				}

				// Strings must not be empty
				if flag.Name == "" {
					t.Errorf("Found flag with empty Name in %s", tc.name)
				}
				if flag.Description == "" {
					t.Errorf("Found flag %s with empty Description in %s", flag.Name, tc.name)
				}
				if flag.Category == "" {
					t.Errorf("Found flag %s with empty Category in %s", flag.Name, tc.name)
				}

				// No duplicate values
				if prev, exists := seenValues[flag.Value]; exists {
					t.Errorf("Duplicate value %d for flags '%s' and '%s' in %s", flag.Value, prev, flag.Name, tc.name)
				}
				seenValues[flag.Value] = flag.Name

				// No duplicate names
				if prev, exists := seenNames[flag.Name]; exists {
					t.Errorf("Duplicate name '%s' with values %d and %d in %s", flag.Name, prev, flag.Value, tc.name)
				}
				seenNames[flag.Name] = flag.Value
			}
		})
	}
}
