package launcher

import (
	"regexp"
	"strings"

	"rnt-launcher/internal/domain"
)

// EngineDialect defines the interface for engine-specific command-line argument formatting.
type EngineDialect interface {
	FormatWarp(mapName string) []string
	FormatFile(files []string) []string
	FormatDeh(dehFiles []string) []string
	FormatSaveDir(dir string) []string
	FormatConfig(configPath string) []string
	FormatCompatibilityLevel(level string) []string
}

var (
	e1m1Regex = regexp.MustCompile(`^(?i)E([1-9])M([1-9])$`)
	mapRegex  = regexp.MustCompile(`^(?i)MAP([0-9]+)$`)
)

// ZDoomDialect formats arguments for GZDoom, Zandronum, and QZDoom.
type ZDoomDialect struct{}

func NewZDoomDialect() *ZDoomDialect {
	return &ZDoomDialect{}
}

func (d *ZDoomDialect) FormatWarp(mapName string) []string {
	mapName = strings.TrimSpace(mapName)
	if mapName == "" {
		return nil
	}
	return []string{"+map", mapName}
}

func (d *ZDoomDialect) FormatFile(files []string) []string {
	var valid []string
	for _, f := range files {
		if s := strings.TrimSpace(f); s != "" {
			valid = append(valid, s)
		}
	}
	if len(valid) == 0 {
		return nil
	}
	return append([]string{"-file"}, valid...)
}

func (d *ZDoomDialect) FormatDeh(dehFiles []string) []string {
	var valid []string
	for _, f := range dehFiles {
		if s := strings.TrimSpace(f); s != "" {
			valid = append(valid, s)
		}
	}
	if len(valid) == 0 {
		return nil
	}
	return append([]string{"-deh"}, valid...)
}

func (d *ZDoomDialect) FormatSaveDir(dir string) []string {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return nil
	}
	return []string{"-savedir", dir}
}

func (d *ZDoomDialect) FormatConfig(configPath string) []string {
	configPath = strings.TrimSpace(configPath)
	if configPath == "" {
		return nil
	}
	return []string{"-config", configPath}
}

func (d *ZDoomDialect) FormatCompatibilityLevel(level string) []string {
	level = strings.TrimSpace(level)
	if level == "" {
		return nil
	}
	return []string{"+compatmode", level}
}

// ChocolateDialect formats arguments for Chocolate Doom and Crispy Doom.
type ChocolateDialect struct{}

func NewChocolateDialect() *ChocolateDialect {
	return &ChocolateDialect{}
}

func (d *ChocolateDialect) FormatWarp(mapName string) []string {
	mapName = strings.TrimSpace(mapName)
	if mapName == "" {
		return nil
	}
	if m := e1m1Regex.FindStringSubmatch(mapName); len(m) == 3 {
		return []string{"-warp", m[1], m[2]}
	}
	if m := mapRegex.FindStringSubmatch(mapName); len(m) == 2 {
		num := strings.TrimLeft(m[1], "0")
		if num == "" {
			num = "0"
		}
		return []string{"-warp", num}
	}
	return []string{"-warp", mapName}
}

func (d *ChocolateDialect) FormatFile(files []string) []string {
	var valid []string
	for _, f := range files {
		if s := strings.TrimSpace(f); s != "" {
			valid = append(valid, s)
		}
	}
	if len(valid) == 0 {
		return nil
	}
	return append([]string{"-merge"}, valid...)
}

func (d *ChocolateDialect) FormatDeh(dehFiles []string) []string {
	var valid []string
	for _, f := range dehFiles {
		if s := strings.TrimSpace(f); s != "" {
			valid = append(valid, s)
		}
	}
	if len(valid) == 0 {
		return nil
	}
	return append([]string{"-deh"}, valid...)
}

func (d *ChocolateDialect) FormatSaveDir(dir string) []string {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return nil
	}
	return []string{"-savedir", dir}
}

func (d *ChocolateDialect) FormatConfig(configPath string) []string {
	configPath = strings.TrimSpace(configPath)
	if configPath == "" {
		return nil
	}
	return []string{"-config", configPath}
}

func (d *ChocolateDialect) FormatCompatibilityLevel(level string) []string {
	return nil
}

// PrBoomDialect formats arguments for PrBoom+ and DSDA-Doom.
type PrBoomDialect struct{}

func NewPrBoomDialect() *PrBoomDialect {
	return &PrBoomDialect{}
}

func (d *PrBoomDialect) FormatWarp(mapName string) []string {
	mapName = strings.TrimSpace(mapName)
	if mapName == "" {
		return nil
	}
	if m := e1m1Regex.FindStringSubmatch(mapName); len(m) == 3 {
		return []string{"-warp", m[1], m[2]}
	}
	if m := mapRegex.FindStringSubmatch(mapName); len(m) == 2 {
		num := strings.TrimLeft(m[1], "0")
		if num == "" {
			num = "0"
		}
		return []string{"-warp", num}
	}
	return []string{"-warp", mapName}
}

func (d *PrBoomDialect) FormatFile(files []string) []string {
	var valid []string
	for _, f := range files {
		if s := strings.TrimSpace(f); s != "" {
			valid = append(valid, s)
		}
	}
	if len(valid) == 0 {
		return nil
	}
	return append([]string{"-file"}, valid...)
}

func (d *PrBoomDialect) FormatDeh(dehFiles []string) []string {
	var valid []string
	for _, f := range dehFiles {
		if s := strings.TrimSpace(f); s != "" {
			valid = append(valid, s)
		}
	}
	if len(valid) == 0 {
		return nil
	}
	return append([]string{"-deh"}, valid...)
}

func (d *PrBoomDialect) FormatSaveDir(dir string) []string {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return nil
	}
	return []string{"-save", dir}
}

func (d *PrBoomDialect) FormatConfig(configPath string) []string {
	configPath = strings.TrimSpace(configPath)
	if configPath == "" {
		return nil
	}
	return []string{"-config", configPath}
}

func (d *PrBoomDialect) FormatCompatibilityLevel(level string) []string {
	level = strings.TrimSpace(level)
	if level == "" {
		return nil
	}
	return []string{"-complevel", level}
}

// WoofDialect formats arguments for Woof! and Nugget Doom.
type WoofDialect struct{}

func NewWoofDialect() *WoofDialect {
	return &WoofDialect{}
}

func (d *WoofDialect) FormatWarp(mapName string) []string {
	mapName = strings.TrimSpace(mapName)
	if mapName == "" {
		return nil
	}
	if m := e1m1Regex.FindStringSubmatch(mapName); len(m) == 3 {
		return []string{"-warp", m[1], m[2]}
	}
	if m := mapRegex.FindStringSubmatch(mapName); len(m) == 2 {
		num := strings.TrimLeft(m[1], "0")
		if num == "" {
			num = "0"
		}
		return []string{"-warp", num}
	}
	return []string{"-warp", mapName}
}

func (d *WoofDialect) FormatFile(files []string) []string {
	var valid []string
	for _, f := range files {
		if s := strings.TrimSpace(f); s != "" {
			valid = append(valid, s)
		}
	}
	if len(valid) == 0 {
		return nil
	}
	return append([]string{"-file"}, valid...)
}

func (d *WoofDialect) FormatDeh(dehFiles []string) []string {
	var valid []string
	for _, f := range dehFiles {
		if s := strings.TrimSpace(f); s != "" {
			valid = append(valid, s)
		}
	}
	if len(valid) == 0 {
		return nil
	}
	return append([]string{"-deh"}, valid...)
}

func (d *WoofDialect) FormatSaveDir(dir string) []string {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return nil
	}
	return []string{"-savedir", dir}
}

func (d *WoofDialect) FormatConfig(configPath string) []string {
	configPath = strings.TrimSpace(configPath)
	if configPath == "" {
		return nil
	}
	return []string{"-config", configPath}
}

func (d *WoofDialect) FormatCompatibilityLevel(level string) []string {
	level = strings.TrimSpace(level)
	if level == "" {
		return nil
	}
	return []string{"-complevel", level}
}

// GenericDialect formats arguments using standard Doom parameters.
type GenericDialect struct{}

func NewGenericDialect() *GenericDialect {
	return &GenericDialect{}
}

func (d *GenericDialect) FormatWarp(mapName string) []string {
	mapName = strings.TrimSpace(mapName)
	if mapName == "" {
		return nil
	}
	return []string{"-warp", mapName}
}

func (d *GenericDialect) FormatFile(files []string) []string {
	var valid []string
	for _, f := range files {
		if s := strings.TrimSpace(f); s != "" {
			valid = append(valid, s)
		}
	}
	if len(valid) == 0 {
		return nil
	}
	return append([]string{"-file"}, valid...)
}

func (d *GenericDialect) FormatDeh(dehFiles []string) []string {
	var valid []string
	for _, f := range dehFiles {
		if s := strings.TrimSpace(f); s != "" {
			valid = append(valid, s)
		}
	}
	if len(valid) == 0 {
		return nil
	}
	return append([]string{"-deh"}, valid...)
}

func (d *GenericDialect) FormatSaveDir(dir string) []string {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return nil
	}
	return []string{"-savedir", dir}
}

func (d *GenericDialect) FormatConfig(configPath string) []string {
	configPath = strings.TrimSpace(configPath)
	if configPath == "" {
		return nil
	}
	return []string{"-config", configPath}
}

func (d *GenericDialect) FormatCompatibilityLevel(level string) []string {
	return nil
}

// GetDialect returns the appropriate EngineDialect based on engine family.
func GetDialect(family domain.EngineFamily) EngineDialect {
	switch family {
	case domain.EngineFamilyGZDoom, domain.EngineFamilyZandronum:
		return NewZDoomDialect()
	case domain.EngineFamilyChocolateDoom, domain.EngineFamilyCrispyDoom:
		return NewChocolateDialect()
	case domain.EngineFamilyPrBoomPlus, domain.EngineFamilyDSDADoom:
		return NewPrBoomDialect()
	case domain.EngineFamilyWoof:
		return NewWoofDialect()
	default:
		return NewGenericDialect()
	}
}
