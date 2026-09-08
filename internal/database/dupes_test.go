package database

import (
	"testing"
	"time"

	"rnt-launcher/internal/domain"
)

func TestFindDuplicateMods(t *testing.T) {
	oldT := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	newT := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name      string
		mods      []domain.Mod
		wantLens  []int    // group sizes in returned order
		wantFirst []string // expected first (newest) mod name per group
	}{
		{
			name:      "empty input",
			mods:      nil,
			wantLens:  nil,
			wantFirst: nil,
		},
		{
			name: "no duplicates all unique",
			mods: []domain.Mod{
				{ID: "a", Name: "Alpha", SHA256: "h1", Size: 10, CreatedAt: oldT},
				{ID: "b", Name: "Beta", SHA256: "h2", Size: 10, CreatedAt: oldT},
			},
			wantLens:  nil,
			wantFirst: nil,
		},
		{
			name: "same hash different size splits into singletons",
			mods: []domain.Mod{
				{ID: "a", Name: "Alpha", SHA256: "same", Size: 10, CreatedAt: oldT},
				{ID: "b", Name: "Beta", SHA256: "same", Size: 20, CreatedAt: newT},
			},
			wantLens:  nil,
			wantFirst: nil,
		},
		{
			name: "empty hash ignored even when sizes match",
			mods: []domain.Mod{
				{ID: "a", Name: "Alpha", Size: 10, CreatedAt: oldT},
				{ID: "b", Name: "Beta", Size: 10, CreatedAt: newT},
			},
			wantLens:  nil,
			wantFirst: nil,
		},
		{
			name: "pair groups newest first",
			mods: []domain.Mod{
				{ID: "a", Name: "Old Copy", SHA256: "h1", Size: 100, CreatedAt: oldT},
				{ID: "b", Name: "New Copy", SHA256: "h1", Size: 100, CreatedAt: newT},
			},
			wantLens:  []int{2},
			wantFirst: []string{"New Copy"},
		},
		{
			name: "zero time sorts last",
			mods: []domain.Mod{
				{ID: "a", Name: "Undated", SHA256: "h1", Size: 100},
				{ID: "b", Name: "Dated", SHA256: "h1", Size: 100, CreatedAt: oldT},
			},
			wantLens:  []int{2},
			wantFirst: []string{"Dated"},
		},
		{
			name: "groups ordered by first mod name",
			mods: []domain.Mod{
				{ID: "a", Name: "Zebra Old", SHA256: "hz", Size: 5, CreatedAt: oldT},
				{ID: "b", Name: "Zebra New", SHA256: "hz", Size: 5, CreatedAt: newT},
				{ID: "c", Name: "Apple Old", SHA256: "ha", Size: 7, CreatedAt: oldT},
				{ID: "d", Name: "Apple New", SHA256: "ha", Size: 7, CreatedAt: newT},
				{ID: "e", Name: "Lone", SHA256: "hl", Size: 9, CreatedAt: newT},
			},
			wantLens:  []int{2, 2},
			wantFirst: []string{"Apple New", "Zebra New"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := FindDuplicateMods(tc.mods)
			if len(got) != len(tc.wantLens) {
				t.Fatalf("FindDuplicateMods returned %d groups, want %d", len(got), len(tc.wantLens))
			}
			for i, wantLen := range tc.wantLens {
				if len(got[i]) != wantLen {
					t.Errorf("group %d has %d mods, want %d", i, len(got[i]), wantLen)
				}
				if got[i][0].Name != tc.wantFirst[i] {
					t.Errorf("group %d first mod = %q, want %q (newest-first)", i, got[i][0].Name, tc.wantFirst[i])
				}
			}
		})
	}
}

func TestModRepository_AuthorSearchRatingHasMapsFilters(t *testing.T) {
	repos := setupTestDB(t)
	now := time.Now().UTC()
	hasMaps := true
	noMaps := false

	seed := []domain.Mod{
		{ID: "m1", Name: "Brutal Doom", Path: "C:/mods/brutal.wad", Format: domain.ModFormatWAD, Author: "SgtMark", Description: "gore galore", Rating: 4.8, Structures: []string{"MAP01", "MAP02"}, ModifiedAt: now, SHA256: "s1", CreatedAt: now},
		{ID: "m2", Name: "Quiet Menu", Path: "C:/mods/quiet.pk3", Format: domain.ModFormatPK3, Author: "Jane", Description: "menu music", Rating: 2.1, Structures: []string{"MENUDEF"}, ModifiedAt: now, SHA256: "s2", CreatedAt: now},
		{ID: "m3", Name: "Old Maps", Path: "C:/mods/oldmaps.wad", Format: domain.ModFormatWAD, Author: "SgtMark Clone", Description: "classic maps", Rating: 3.5, Structures: []string{"E1M1"}, ModifiedAt: now, SHA256: "s3", CreatedAt: now},
	}
	for i := range seed {
		if err := repos.Mods.Create(&seed[i]); err != nil {
			t.Fatalf("Create(%s) failed: %v", seed[i].Name, err)
		}
	}

	t.Run("author filter matches substring", func(t *testing.T) {
		got, err := repos.Mods.List(domain.ModFilter{Author: "sgtmark"})
		if err != nil {
			t.Fatalf("List(author) failed: %v", err)
		}
		if len(got) != 2 {
			t.Fatalf("List(author) returned %d mods, want 2", len(got))
		}
	})

	t.Run("search spans author and description", func(t *testing.T) {
		got, err := repos.Mods.List(domain.ModFilter{Search: "gore"})
		if err != nil {
			t.Fatalf("List(search) failed: %v", err)
		}
		if len(got) != 1 || got[0].Name != "Brutal Doom" {
			t.Fatalf("List(search=gore) = %v, want [Brutal Doom]", got)
		}
		got, err = repos.Mods.List(domain.ModFilter{Search: "jane"})
		if err != nil {
			t.Fatalf("List(search) failed: %v", err)
		}
		if len(got) != 1 || got[0].Name != "Quiet Menu" {
			t.Fatalf("List(search=jane) = %v, want [Quiet Menu]", got)
		}
	})

	t.Run("min rating threshold", func(t *testing.T) {
		got, err := repos.Mods.List(domain.ModFilter{MinRating: 4.0})
		if err != nil {
			t.Fatalf("List(minRating) failed: %v", err)
		}
		if len(got) != 1 || got[0].Name != "Brutal Doom" {
			t.Fatalf("List(minRating=4) = %v, want [Brutal Doom]", got)
		}
	})

	t.Run("has maps true and false", func(t *testing.T) {
		got, err := repos.Mods.List(domain.ModFilter{HasMaps: &hasMaps})
		if err != nil {
			t.Fatalf("List(hasMaps=true) failed: %v", err)
		}
		if len(got) != 1 || got[0].Name != "Brutal Doom" {
			t.Fatalf("List(hasMaps=true) = %v, want [Brutal Doom]", got)
		}
		got, err = repos.Mods.List(domain.ModFilter{HasMaps: &noMaps})
		if err != nil {
			t.Fatalf("List(hasMaps=false) failed: %v", err)
		}
		if len(got) != 2 {
			t.Fatalf("List(hasMaps=false) returned %d mods, want 2", len(got))
		}
	})

	t.Run("provenance round trips through get and update", func(t *testing.T) {
		got, err := repos.Mods.Get("m1")
		if err != nil {
			t.Fatalf("Get(m1) failed: %v", err)
		}
		if got.Author != "SgtMark" || got.Description != "gore galore" || got.Rating != 4.8 {
			t.Fatalf("Get(m1) provenance = %+v, want author/rating preserved", got)
		}
		got.Rating = 5.0
		got.Author = "SgtMark IV"
		if err := repos.Mods.Update(got); err != nil {
			t.Fatalf("Update(m1) failed: %v", err)
		}
		again, err := repos.Mods.GetByPath("C:/mods/brutal.wad")
		if err != nil {
			t.Fatalf("GetByPath failed: %v", err)
		}
		if again.Rating != 5.0 || again.Author != "SgtMark IV" {
			t.Fatalf("GetByPath provenance = %+v, want updated values", again)
		}
	})
}
