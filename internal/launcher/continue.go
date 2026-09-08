package launcher

import (
	"rnt-launcher/internal/domain"
)

// FormatLoadGame returns the continue arguments for resuming a profile from
// its isolated save directory ("-loadgame", "latest").
//
// Support is gated exactly like save-dir isolation: only families whose
// dialect produces a save-dir flag get continue args. The gate is probed
// through GetDialect(family).FormatSaveDir so a dialect that ever drops
// save-dir support automatically drops continue support too. Unknown or
// invalid families yield nil rather than guessing a flag the engine may
// not accept.
func FormatLoadGame(family domain.EngineFamily) []string {
	if !family.IsValid() {
		return nil
	}
	if len(GetDialect(family).FormatSaveDir("probe")) == 0 {
		return nil
	}
	return []string{"-loadgame", "latest"}
}
