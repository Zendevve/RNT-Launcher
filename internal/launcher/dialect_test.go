package launcher_test

import (
	"strings"
	"testing"

	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/launcher"
)

func TestEngineDialects(t *testing.T) {
	t.Run("ZDoomDialect", func(t *testing.T) {
		d := launcher.NewZDoomDialect()

		warp := d.FormatWarp("MAP01")
		if strings.Join(warp, " ") != "+map MAP01" {
			t.Errorf("expected '+map MAP01', got %q", strings.Join(warp, " "))
		}

		files := d.FormatFile([]string{"mod1.pk3", "mod2.pk3"})
		if strings.Join(files, " ") != "-file mod1.pk3 mod2.pk3" {
			t.Errorf("expected '-file mod1.pk3 mod2.pk3', got %q", strings.Join(files, " "))
		}

		deh := d.FormatDeh([]string{"patch.deh"})
		if strings.Join(deh, " ") != "-deh patch.deh" {
			t.Errorf("expected '-deh patch.deh', got %q", strings.Join(deh, " "))
		}

		savedir := d.FormatSaveDir("C:/saves")
		if strings.Join(savedir, " ") != "-savedir C:/saves" {
			t.Errorf("expected '-savedir C:/saves', got %q", strings.Join(savedir, " "))
		}

		cfg := d.FormatConfig("gzdoom.ini")
		if strings.Join(cfg, " ") != "-config gzdoom.ini" {
			t.Errorf("expected '-config gzdoom.ini', got %q", strings.Join(cfg, " "))
		}

		compat := d.FormatCompatibilityLevel("2")
		if strings.Join(compat, " ") != "+compatmode 2" {
			t.Errorf("expected '+compatmode 2', got %q", strings.Join(compat, " "))
		}
	})

	t.Run("ChocolateDialect", func(t *testing.T) {
		d := launcher.NewChocolateDialect()

		// E1M1 -> -warp 1 1
		warp1 := d.FormatWarp("E1M1")
		if strings.Join(warp1, " ") != "-warp 1 1" {
			t.Errorf("expected '-warp 1 1', got %q", strings.Join(warp1, " "))
		}

		// MAP01 -> -warp 1
		warp2 := d.FormatWarp("MAP01")
		if strings.Join(warp2, " ") != "-warp 1" {
			t.Errorf("expected '-warp 1', got %q", strings.Join(warp2, " "))
		}

		// -merge for WADs
		files := d.FormatFile([]string{"mod.wad"})
		if strings.Join(files, " ") != "-merge mod.wad" {
			t.Errorf("expected '-merge mod.wad', got %q", strings.Join(files, " "))
		}

		deh := d.FormatDeh([]string{"patch.deh"})
		if strings.Join(deh, " ") != "-deh patch.deh" {
			t.Errorf("expected '-deh patch.deh', got %q", strings.Join(deh, " "))
		}
	})

	t.Run("PrBoomDialect", func(t *testing.T) {
		d := launcher.NewPrBoomDialect()

		warp := d.FormatWarp("MAP05")
		if strings.Join(warp, " ") != "-warp 5" {
			t.Errorf("expected '-warp 5', got %q", strings.Join(warp, " "))
		}

		files := d.FormatFile([]string{"mod.wad"})
		if strings.Join(files, " ") != "-file mod.wad" {
			t.Errorf("expected '-file mod.wad', got %q", strings.Join(files, " "))
		}

		compat := d.FormatCompatibilityLevel("9")
		if strings.Join(compat, " ") != "-complevel 9" {
			t.Errorf("expected '-complevel 9', got %q", strings.Join(compat, " "))
		}

		savedir := d.FormatSaveDir("C:/saves")
		if strings.Join(savedir, " ") != "-save C:/saves" {
			t.Errorf("expected '-save C:/saves', got %q", strings.Join(savedir, " "))
		}
	})

	t.Run("WoofDialect", func(t *testing.T) {
		d := launcher.NewWoofDialect()

		warp := d.FormatWarp("MAP02")
		if strings.Join(warp, " ") != "-warp 2" {
			t.Errorf("expected '-warp 2', got %q", strings.Join(warp, " "))
		}

		compat := d.FormatCompatibilityLevel("2")
		if strings.Join(compat, " ") != "-complevel 2" {
			t.Errorf("expected '-complevel 2', got %q", strings.Join(compat, " "))
		}

		savedir := d.FormatSaveDir("C:/saves")
		if strings.Join(savedir, " ") != "-savedir C:/saves" {
			t.Errorf("expected '-savedir C:/saves', got %q", strings.Join(savedir, " "))
		}
	})

	t.Run("GenericDialect", func(t *testing.T) {
		d := launcher.NewGenericDialect()

		warp := d.FormatWarp("MAP01")
		if strings.Join(warp, " ") != "-warp MAP01" {
			t.Errorf("expected '-warp MAP01', got %q", strings.Join(warp, " "))
		}

		files := d.FormatFile([]string{"mod.wad"})
		if strings.Join(files, " ") != "-file mod.wad" {
			t.Errorf("expected '-file mod.wad', got %q", strings.Join(files, " "))
		}
	})

	t.Run("GetDialect Resolution", func(t *testing.T) {
		if _, ok := launcher.GetDialect(domain.EngineFamilyGZDoom).(*launcher.ZDoomDialect); !ok {
			t.Error("expected ZDoomDialect for GZDoom")
		}
		if _, ok := launcher.GetDialect(domain.EngineFamilyChocolateDoom).(*launcher.ChocolateDialect); !ok {
			t.Error("expected ChocolateDialect for ChocolateDoom")
		}
		if _, ok := launcher.GetDialect(domain.EngineFamilyCrispyDoom).(*launcher.ChocolateDialect); !ok {
			t.Error("expected ChocolateDialect for CrispyDoom")
		}
		if _, ok := launcher.GetDialect(domain.EngineFamilyPrBoomPlus).(*launcher.PrBoomDialect); !ok {
			t.Error("expected PrBoomDialect for PrBoomPlus")
		}
		if _, ok := launcher.GetDialect(domain.EngineFamilyWoof).(*launcher.WoofDialect); !ok {
			t.Error("expected WoofDialect for Woof")
		}
		if _, ok := launcher.GetDialect(domain.EngineFamilyOther).(*launcher.GenericDialect); !ok {
			t.Error("expected GenericDialect for Other")
		}
	})

	t.Run("BuildArguments With Dialects", func(t *testing.T) {
		// Test ZDoomDialect building arguments with DEH
		zdoomEngine := &domain.Engine{
			Family:     domain.EngineFamilyGZDoom,
			Executable: "gzdoom.exe",
		}
		iwad := &domain.IWAD{Path: "doom2.wad"}
		mods := []domain.ProfileMod{
			{ModPath: "mod.pk3", Enabled: true, Order: 0},
			{ModPath: "patch.deh", Enabled: true, Order: 1},
		}

		args, err := launcher.BuildArguments(zdoomEngine, iwad, mods, nil)
		if err != nil {
			t.Fatalf("BuildArguments failed: %v", err)
		}
		expectedZDoom := "-iwad doom2.wad -file mod.pk3 -deh patch.deh"
		if strings.Join(args, " ") != expectedZDoom {
			t.Errorf("expected %q, got %q", expectedZDoom, strings.Join(args, " "))
		}

		// Test ChocolateDialect building arguments (-merge and -deh)
		chocEngine := &domain.Engine{
			Family:     domain.EngineFamilyChocolateDoom,
			Executable: "chocolate-doom.exe",
		}
		argsChoc, err := launcher.BuildArguments(chocEngine, iwad, mods, nil)
		if err != nil {
			t.Fatalf("BuildArguments failed: %v", err)
		}
		expectedChoc := "-iwad doom2.wad -merge mod.pk3 -deh patch.deh"
		if strings.Join(argsChoc, " ") != expectedChoc {
			t.Errorf("expected %q, got %q", expectedChoc, strings.Join(argsChoc, " "))
		}
	})
}
