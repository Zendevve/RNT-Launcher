package database

import (
	"sort"

	"rnt-launcher/internal/domain"
)

// FindDuplicateMods groups mods that share both SHA-256 and file size.
// Mods with an empty hash are skipped (hash unknown, cannot prove duplication).
// Singleton groups are dropped. Within a group mods sort newest-first by
// CreatedAt (zero-time sorts last, so undated imports never win "keep newest").
// Groups order deterministically by first mod name (hash/size tiebreak).
// Pure function, no DB access.
func FindDuplicateMods(mods []domain.Mod) [][]domain.Mod {
	type dupKey struct {
		hash string
		size int64
	}
	groups := make(map[dupKey][]domain.Mod)
	var order []dupKey
	for _, m := range mods {
		if m.SHA256 == "" {
			continue
		}
		k := dupKey{hash: m.SHA256, size: m.Size}
		if _, ok := groups[k]; !ok {
			order = append(order, k)
		}
		groups[k] = append(groups[k], m)
	}

	out := make([][]domain.Mod, 0, len(order))
	for _, k := range order {
		g := groups[k]
		if len(g) < 2 {
			continue
		}
		sort.SliceStable(g, func(i, j int) bool {
			zi, zj := g[i].CreatedAt.IsZero(), g[j].CreatedAt.IsZero()
			if zi != zj {
				return zj
			}
			if zi {
				return false
			}
			return g[i].CreatedAt.After(g[j].CreatedAt)
		})
		out = append(out, g)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i][0].Name != out[j][0].Name {
			return out[i][0].Name < out[j][0].Name
		}
		if out[i][0].SHA256 != out[j][0].SHA256 {
			return out[i][0].SHA256 < out[j][0].SHA256
		}
		return out[i][0].Size < out[j][0].Size
	})
	return out
}
