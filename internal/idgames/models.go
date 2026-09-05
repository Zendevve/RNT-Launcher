package idgames

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

//go:embed curated.json
var curatedJSON []byte

// CuratedEntry contains editorial and historical recognition metadata for an idgames item.
type CuratedEntry struct {
	ID           int    `json:"id"`
	IsCacoward   bool   `json:"is_cacoward"`
	CacowardYear int    `json:"cacoward_year"`
	IsTop100     bool   `json:"is_top100"`
	Category     string `json:"category"`
	CuratorNote  string `json:"curator_note"`
}

// CatalogItem represents an indexed idgames archive entry enriched with metadata.
type CatalogItem struct {
	ID             int     `json:"id"`
	Title          string  `json:"title"`
	Dir            string  `json:"dir"`
	Filename       string  `json:"filename"`
	Size           int64   `json:"size"`
	Age            int64   `json:"age"`
	Date           string  `json:"date"`
	Author         string  `json:"author"`
	Description    string  `json:"description"`
	Rating         float64 `json:"rating"`
	Votes          int     `json:"votes"`
	URL            string  `json:"url"`
	IsCacoward     bool    `json:"is_cacoward"`
	CacowardYear   int     `json:"cacoward_year"`
	IsTop100       bool    `json:"is_top100"`
	Category       string  `json:"category"`
	CuratorNote    string  `json:"curator_note"`
	IsInstalled    bool    `json:"is_installed"`
	InstalledModID string  `json:"installed_mod_id"`
	Score          float64 `json:"score,omitempty"`
}

// SearchOptions specifies filters and ordering for catalog queries.
type SearchOptions struct {
	Query        string `json:"query"`
	CacowardOnly bool   `json:"cacoward_only"`
	Top100Only   bool   `json:"top100_only"`
	Category     string `json:"category"`
	Sort         string `json:"sort"`
	Limit        int    `json:"limit"`
	Offset       int    `json:"offset"`
}

// ShowcaseResult groups categorized mod listings for zero-state exploration.
type ShowcaseResult struct {
	CacowardClassics []CatalogItem `json:"cacoward_classics"`
	Top100           []CatalogItem `json:"top_100"`
	TopRated         []CatalogItem `json:"top_rated"`
	RecentUploads    []CatalogItem `json:"recent_uploads"`
}

// LoadCuratedRegistry parses embedded curated metadata into an ID-indexed lookup map.
func LoadCuratedRegistry() (map[int]CuratedEntry, error) {
	if len(curatedJSON) == 0 {
		return make(map[int]CuratedEntry), nil
	}
	var entries []CuratedEntry
	if err := json.Unmarshal(curatedJSON, &entries); err != nil {
		return nil, fmt.Errorf("unmarshaling curated idgames metadata: %w", err)
	}
	registry := make(map[int]CuratedEntry, len(entries))
	for _, entry := range entries {
		registry[entry.ID] = entry
	}
	return registry, nil
}
