package validator

import (
	"fmt"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"rnt-launcher/internal/domain"
	"rnt-launcher/internal/filesystem"
)

// MaxConflictLumpsPerMod caps per-mod lump comparison for conflict detection.
// Above the cap the mod is still compared on its first N lumps and an info
// item (conflict-scan-truncated) is emitted.
const MaxConflictLumpsPerMod = 2000

// maxLumpCollisionItems caps emitted per-lump warnings so a texture-heavy
// pair cannot flood the validation banner. Overflow is reported once via
// conflict-scan-truncated.
const maxLumpCollisionItems = 20

var (
	mapSlotDoom1 = regexp.MustCompile(`^E[1-9]M[1-9]$`)
	mapSlotDoom2 = regexp.MustCompile(`^MAP[0-9]{2,}$`)
)

// isMapSlot reports whether a normalized lump/entry name is a map slot marker.
func isMapSlot(name string) bool {
	return mapSlotDoom1.MatchString(name) || mapSlotDoom2.MatchString(name)
}

// ModLumpSet is the normalized lump inventory of one profile mod in load order.
type ModLumpSet struct {
	ModID     string
	ModName   string
	Lumps     []string
	Maps      []string
	Truncated bool
}

// normalizeLump upper-cases and trims a lump name for cross-mod comparison.
func normalizeLump(name string) string {
	return strings.ToUpper(strings.TrimSpace(name))
}

// normalizeArchiveEntry maps a PK3/ZIP entry path to a comparable token: the
// upper-cased full path. Identical asset paths across archives collide.
func normalizeArchiveEntry(entry string) string {
	p := strings.ReplaceAll(entry, "\\", "/")
	return strings.ToUpper(strings.Trim(p, "/"))
}

// CollectLumpSet inspects a mod file and returns its normalized lump set,
// capped at MaxConflictLumpsPerMod entries. Missing/unparseable files return
// an empty set; absence is reported by the file-existence rules, not here.
func CollectLumpSet(mod domain.Mod) ModLumpSet {
	set := ModLumpSet{ModID: mod.ID, ModName: mod.Name}
	info, err := filesystem.InspectFile(mod.Path)
	if err != nil || info == nil {
		return set
	}
	var lumps []string
	switch {
	case info.WADInfo != nil:
		for _, l := range info.WADInfo.Lumps {
			if n := normalizeLump(l); n != "" {
				lumps = append(lumps, n)
			}
		}
		set.Maps = append([]string(nil), info.Maps...)
	case info.ArchiveInfo != nil:
		for _, e := range info.ArchiveInfo.Entries {
			if n := normalizeArchiveEntry(e); n != "" {
				lumps = append(lumps, n)
			}
		}
		set.Maps = append([]string(nil), info.Maps...)
	}
	if len(lumps) > MaxConflictLumpsPerMod {
		lumps = lumps[:MaxConflictLumpsPerMod]
		set.Truncated = true
	}
	set.Lumps = lumps
	if set.ModName == "" {
		set.ModName = filepath.Base(mod.Path)
	}
	return set
}

// DetectConflicts inspects each mod file and compares normalized lump names
// across enabled profile mods in slice (load) order.
func DetectConflicts(mods []domain.Mod) []domain.ValidationItem {
	sets := make([]ModLumpSet, 0, len(mods))
	for _, m := range mods {
		if strings.TrimSpace(m.Path) == "" {
			continue
		}
		sets = append(sets, CollectLumpSet(m))
	}
	return DetectConflictsFromLumps(sets)
}

// DetectConflictsFromLumps is the pure comparison core: same lump in >=2 mods
// emits warning mod-lump-collision (last wins); same map slot in >=2 map mods
// emits error mod-map-slot-collision. Quick-fix buttons act on the item
// target, which is always the first (overridden) claimant: "Move last" makes
// it win, "Disable" removes it from the conflict.
func DetectConflictsFromLumps(sets []ModLumpSet) []domain.ValidationItem {
	items := make([]domain.ValidationItem, 0)
	for _, s := range sets {
		if s.Truncated {
			items = append(items, domain.ValidationItem{
				Severity: domain.ValidationSeverityInfo,
				Code:     "conflict-scan-truncated",
				Message:  fmt.Sprintf("Lump comparison for %s capped at %d entries", displayName(s), MaxConflictLumpsPerMod),
				Target:   s.ModID,
			})
		}
	}

	firstSeen := make(map[string]int)
	owners := make(map[string][]int)
	for i, s := range sets {
		for _, lump := range s.Lumps {
			if _, ok := firstSeen[lump]; !ok {
				firstSeen[lump] = i
			}
			owners[lump] = append(owners[lump], i)
		}
	}

	lumpWarnings := 0
	overflow := false
	lumpNames := make([]string, 0, len(owners))
	for lump := range owners {
		lumpNames = append(lumpNames, lump)
	}
	sort.Strings(lumpNames)
	for _, lump := range lumpNames {
		idxs := owners[lump]
		if len(idxs) < 2 {
			continue
		}
		if isMapSlot(lump) {
			continue
		}
		first, last := sets[idxs[0]], sets[idxs[len(idxs)-1]]
		if lumpWarnings >= maxLumpCollisionItems {
			overflow = true
			continue
		}
		lumpWarnings++
		items = append(items, domain.ValidationItem{
			Severity: domain.ValidationSeverityWarning,
			Code:     "mod-lump-collision",
			Message:  fmt.Sprintf("Lump %q in %s overridden by %s (last wins)", lump, displayName(first), displayName(last)),
			Target:   first.ModID,
		})
	}
	if overflow {
		items = append(items, domain.ValidationItem{
			Severity: domain.ValidationSeverityInfo,
			Code:     "conflict-scan-truncated",
			Message:  fmt.Sprintf("Additional lump collisions hidden beyond %d shown", maxLumpCollisionItems),
			Target:   "",
		})
	}

	slotOwners := make(map[string][]int)
	for i, s := range sets {
		seen := make(map[string]bool)
		for _, m := range s.Maps {
			slot := normalizeLump(m)
			if slot == "" || seen[slot] {
				continue
			}
			seen[slot] = true
			slotOwners[slot] = append(slotOwners[slot], i)
		}
	}
	slots := make([]string, 0, len(slotOwners))
	for slot := range slotOwners {
		slots = append(slots, slot)
	}
	sort.Strings(slots)
	for _, slot := range slots {
		idxs := slotOwners[slot]
		if len(idxs) < 2 {
			continue
		}
		names := make([]string, 0, len(idxs))
		for _, i := range idxs {
			names = append(names, displayName(sets[i]))
		}
		items = append(items, domain.ValidationItem{
			Severity: domain.ValidationSeverityError,
			Code:     "mod-map-slot-collision",
			Message:  fmt.Sprintf("Map slot %s claimed by %s (only last-loaded %s takes effect)", slot, strings.Join(names, ", "), displayName(sets[idxs[len(idxs)-1]])),
			Target:   sets[idxs[0]].ModID,
		})
	}
	return items
}

func displayName(s ModLumpSet) string {
	if s.ModName != "" {
		return s.ModName
	}
	if s.ModID != "" {
		return s.ModID
	}
	return "unknown mod"
}

// resolveConflictMods maps enabled profile mods in load order to domain.Mod
// records, preferring the mod repository row and falling back to a minimal
// record built from the profile entry. Missing files resolve to a record with
// an empty path and are skipped by DetectConflicts (absence is already
// reported by the file-existence rules).
func (s *ValidatorService) resolveConflictMods(p *domain.Profile) []domain.Mod {
	enabled := p.EnabledMods()
	resolved := make([]domain.Mod, 0, len(enabled))
	for _, pm := range enabled {
		if s.mods != nil && pm.ModID != "" {
			if dbMod, err := s.mods.Get(pm.ModID); err == nil && dbMod != nil {
				resolved = append(resolved, *dbMod)
				continue
			}
		}
		if strings.TrimSpace(pm.ModPath) == "" {
			continue
		}
		format := pm.ModFormat
		if !format.IsValid() || format == domain.ModFormatUnknown {
			format = domain.DetectModFormat(pm.ModPath)
		}
		name := pm.ModName
		if name == "" {
			name = filepath.Base(pm.ModPath)
		}
		id := pm.ModID
		if id == "" {
			id = pm.ModPath
		}
		fallback := domain.Mod{ID: id, Name: name, Path: pm.ModPath, Format: format}
		if info, err := filesystem.InspectFile(pm.ModPath); err == nil && info != nil {
			fallback.Structures = info.Structures
		}
		resolved = append(resolved, fallback)
	}
	return resolved
}

// CheckEngineCompat reports engine-format and IWAD-hint findings for resolved
// enabled mods. A nil engine or IWAD skips its respective rules (absence is
// already reported by the engine/IWAD rules).
func CheckEngineCompat(engine *domain.Engine, iwad *domain.IWAD, mods []domain.Mod) []domain.ValidationItem {
	items := make([]domain.ValidationItem, 0)
	for _, m := range mods {
		format := m.Format
		if !format.IsValid() || format == domain.ModFormatUnknown {
			format = domain.DetectModFormat(m.Path)
		}
		target := m.ID
		if target == "" {
			target = m.Path
		}
		if engine != nil {
			switch format {
			case domain.ModFormatDEH, domain.ModFormatBEX:
				if engine.Family == domain.EngineFamilyCrispyDoom || engine.Family == domain.EngineFamilyChocolateDoom {
					items = append(items, domain.ValidationItem{
						Severity: domain.ValidationSeverityWarning,
						Code:     "engine-format-risk",
						Message:  fmt.Sprintf("%s uses %s patching; %s has limited DeHackEd support", m.Name, strings.ToUpper(format.String()), engine.Family.DisplayName()),
						Target:   target,
					})
				}
			case domain.ModFormatPK3, domain.ModFormatPK7, domain.ModFormatIPK3:
				if !engine.SupportsPK3() {
					items = append(items, domain.ValidationItem{
						Severity: domain.ValidationSeverityError,
						Code:     "engine-format-unsupported",
						Message:  fmt.Sprintf("%s is %s but %s cannot load %s archives", m.Name, strings.ToUpper(format.String()), engine.Family.DisplayName(), strings.ToUpper(format.String())),
						Target:   target,
					})
				}
			}
		}
		if iwad != nil && (iwad.Type == domain.IWADTypeUnknown || iwad.Type == domain.IWADTypeOther) && m.HasStructure("MAPINFO") {
			items = append(items, domain.ValidationItem{
				Severity: domain.ValidationSeverityWarning,
				Code:     "iwad-mismatch-suspect",
				Message:  fmt.Sprintf("%s defines MAPINFO but IWAD %s (%s) may not match its intended game", m.Name, iwad.Name, iwad.Type.DisplayName()),
				Target:   target,
			})
		}
	}
	return items
}
