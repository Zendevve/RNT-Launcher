package idgames

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"strings"
	"sync"
	"unicode"
)

// CatalogRepository manages SQLite persistence, FTS5 full-text indexing,
// and local mod library cross-referencing for /idgames archives.
type CatalogRepository struct {
	db *sql.DB
	mu sync.RWMutex
}

// NewCatalogRepository creates a new repository backed by db.
func NewCatalogRepository(db *sql.DB) *CatalogRepository {
	return &CatalogRepository{db: db}
}

// SeedIfEmpty loads catalog items from seedReader into the idgames_catalog table
// only if the table is currently empty.
func (r *CatalogRepository) SeedIfEmpty(ctx context.Context, seedReader io.Reader) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	var count int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM idgames_catalog`).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("checking idgames_catalog count: %w", err)
	}
	if count > 0 {
		return 0, nil
	}

	curatedRegistry, err := LoadCuratedRegistry()
	if err != nil {
		curatedRegistry = make(map[int]CuratedEntry)
	}

	decoder := json.NewDecoder(seedReader)
	// Read open bracket if stream is an array
	t, err := decoder.Token()
	if err != nil {
		return 0, fmt.Errorf("reading seed token: %w", err)
	}
	delim, ok := t.(json.Delim)
	if !ok || delim != '[' {
		return 0, fmt.Errorf("expected '[' delimiter in seed JSON, got %v", t)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("starting seed transaction: %w", err)
	}
	defer func() {
		if tx != nil {
			_ = tx.Rollback()
		}
	}()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO idgames_catalog (
			id, title, dir, filename, size, age, date, author, description,
			rating, votes, is_cacoward, cacoward_year, is_top100, category, curator_note, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
	`)
	if err != nil {
		return 0, fmt.Errorf("preparing insert statement: %w", err)
	}
	defer stmt.Close()

	inserted := 0
	batchSize := 500

	for decoder.More() {
		select {
		case <-ctx.Done():
			return inserted, ctx.Err()
		default:
		}

		var raw struct {
			ID          int     `json:"id"`
			Title       string  `json:"title"`
			Dir         string  `json:"dir"`
			Filename    string  `json:"filename"`
			Size        int64   `json:"size"`
			Age         int64   `json:"age"`
			Date        string  `json:"date"`
			Author      string  `json:"author"`
			Description string  `json:"description"`
			Rating      float64 `json:"rating"`
			Votes       int     `json:"votes"`
		}

		if err := decoder.Decode(&raw); err != nil {
			return inserted, fmt.Errorf("decoding seed item at index %d: %w", inserted, err)
		}

		isCacoward := 0
		cacowardYear := 0
		isTop100 := 0
		category := ""
		curatorNote := ""

		if curated, found := curatedRegistry[raw.ID]; found {
			if curated.IsCacoward {
				isCacoward = 1
			}
			cacowardYear = curated.CacowardYear
			if curated.IsTop100 {
				isTop100 = 1
			}
			category = curated.Category
			curatorNote = curated.CuratorNote
		}

		_, err := stmt.ExecContext(ctx,
			raw.ID, raw.Title, raw.Dir, raw.Filename, raw.Size, raw.Age,
			raw.Date, raw.Author, raw.Description, raw.Rating, raw.Votes,
			isCacoward, cacowardYear, isTop100, category, curatorNote,
		)
		if err != nil {
			return inserted, fmt.Errorf("inserting seed id %d: %w", raw.ID, err)
		}
		inserted++

		if inserted%batchSize == 0 {
			if err := stmt.Close(); err != nil {
				return inserted, err
			}
			if err := tx.Commit(); err != nil {
				return inserted, fmt.Errorf("committing seed batch: %w", err)
			}
			tx, err = r.db.BeginTx(ctx, nil)
			if err != nil {
				return inserted, fmt.Errorf("starting next seed transaction: %w", err)
			}
			stmt, err = tx.PrepareContext(ctx, `
				INSERT INTO idgames_catalog (
					id, title, dir, filename, size, age, date, author, description,
					rating, votes, is_cacoward, cacoward_year, is_top100, category, curator_note, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
			`)
			if err != nil {
				return inserted, fmt.Errorf("re-preparing insert statement: %w", err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return inserted, fmt.Errorf("finalizing seed commit: %w", err)
	}
	tx = nil

	return inserted, nil
}

// GetByID retrieves a single catalog item by ID with installation status populated.
func (r *CatalogRepository) GetByID(ctx context.Context, id int) (*CatalogItem, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	query := `
		SELECT
			c.id, c.title, c.dir, c.filename, c.size, c.age, c.date,
			c.author, c.description, c.rating, c.votes,
			c.is_cacoward, c.cacoward_year, c.is_top100, c.category, c.curator_note,
			CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END AS is_installed,
			COALESCE(m.id, '') AS installed_mod_id
		FROM idgames_catalog c
		LEFT JOIN mods m ON LOWER(m.name) = LOWER(c.filename) OR LOWER(m.path) LIKE '%' || LOWER(c.filename)
		WHERE c.id = ?
		LIMIT 1
	`

	row := r.db.QueryRowContext(ctx, query, id)
	item, err := scanCatalogItem(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("catalog item %d not found", id)
		}
		return nil, fmt.Errorf("querying catalog item %d: %w", id, err)
	}
	return item, nil
}

// Search queries the idgames catalog using FTS5 when a query string is provided,
// or filtered database indices when browsing.
func (r *CatalogRepository) Search(ctx context.Context, opts SearchOptions) ([]CatalogItem, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	limit := opts.Limit
	if limit <= 0 {
		limit = 50
	} else if limit > 200 {
		limit = 200
	}
	offset := opts.Offset
	if offset < 0 {
		offset = 0
	}

	trimmedQuery := strings.TrimSpace(opts.Query)
	if trimmedQuery == "" {
		return r.searchBrowsing(ctx, opts, limit, offset)
	}

	return r.searchFTS5(ctx, trimmedQuery, opts, limit, offset)
}

func (r *CatalogRepository) searchBrowsing(ctx context.Context, opts SearchOptions, limit, offset int) ([]CatalogItem, error) {
	var whereClauses []string
	var args []any

	if opts.CacowardOnly {
		whereClauses = append(whereClauses, "c.is_cacoward = 1")
	}
	if opts.Top100Only {
		whereClauses = append(whereClauses, "c.is_top100 = 1")
	}
	if strings.TrimSpace(opts.Category) != "" {
		cat := strings.TrimSpace(opts.Category)
		singular := strings.TrimSuffix(strings.ToLower(cat), "s")
		whereClauses = append(whereClauses, "(LOWER(c.category) = LOWER(?) OR LOWER(c.category) = ? OR LOWER(c.category) LIKE ?)")
		args = append(args, cat, singular, "%"+singular+"%")
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	var orderSQL string
	switch opts.Sort {
	case "date-desc":
		orderSQL = "ORDER BY c.date DESC, c.id DESC"
	case "votes-desc":
		orderSQL = "ORDER BY c.votes DESC, c.rating DESC"
	case "size-desc":
		orderSQL = "ORDER BY c.size DESC"
	case "title-asc":
		orderSQL = "ORDER BY c.title COLLATE NOCASE ASC"
	default:
		orderSQL = "ORDER BY c.rating DESC, c.votes DESC"
	}

	query := fmt.Sprintf(`
		SELECT
			c.id, c.title, c.dir, c.filename, c.size, c.age, c.date,
			c.author, c.description, c.rating, c.votes,
			c.is_cacoward, c.cacoward_year, c.is_top100, c.category, c.curator_note,
			CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END AS is_installed,
			COALESCE(m.id, '') AS installed_mod_id,
			0.0 AS score
		FROM idgames_catalog c
		LEFT JOIN mods m ON LOWER(m.name) = LOWER(c.filename) OR LOWER(m.path) LIKE '%%' || LOWER(c.filename)
		%s
		GROUP BY c.id
		%s
		LIMIT ? OFFSET ?
	`, whereSQL, orderSQL)

	args = append(args, limit, offset)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("executing browsing search: %w", err)
	}
	defer rows.Close()

	return scanCatalogItems(rows)
}

func (r *CatalogRepository) searchFTS5(ctx context.Context, rawQuery string, opts SearchOptions, limit, offset int) ([]CatalogItem, error) {
	ftsQuery := buildFTSQuery(rawQuery)
	if ftsQuery == "" {
		return r.searchBrowsing(ctx, opts, limit, offset)
	}

	var whereClauses []string
	var args []any

	whereClauses = append(whereClauses, "idgames_fts MATCH ?")
	args = append(args, ftsQuery)

	if opts.CacowardOnly {
		whereClauses = append(whereClauses, "c.is_cacoward = 1")
	}
	if opts.Top100Only {
		whereClauses = append(whereClauses, "c.is_top100 = 1")
	}
	if strings.TrimSpace(opts.Category) != "" {
		cat := strings.TrimSpace(opts.Category)
		singular := strings.TrimSuffix(strings.ToLower(cat), "s")
		whereClauses = append(whereClauses, "(LOWER(c.category) = LOWER(?) OR LOWER(c.category) = ? OR LOWER(c.category) LIKE ?)")
		args = append(args, cat, singular, "%"+singular+"%")
	}

	whereSQL := "WHERE " + strings.Join(whereClauses, " AND ")

	var orderSQL string
	switch opts.Sort {
	case "date-desc":
		orderSQL = "ORDER BY c.date DESC, score DESC"
	case "votes-desc":
		orderSQL = "ORDER BY c.votes DESC, score DESC"
	case "size-desc":
		orderSQL = "ORDER BY c.size DESC"
	case "title-asc":
		orderSQL = "ORDER BY c.title COLLATE NOCASE ASC"
	default:
		// BM25 relevance score combined with community multiplier and award boosts
		orderSQL = "ORDER BY score DESC, c.rating DESC, c.votes DESC"
	}

	query := fmt.Sprintf(`
		SELECT
			c.id, c.title, c.dir, c.filename, c.size, c.age, c.date,
			c.author, c.description, c.rating, c.votes,
			c.is_cacoward, c.cacoward_year, c.is_top100, c.category, c.curator_note,
			CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END AS is_installed,
			COALESCE(m.id, '') AS installed_mod_id,
			(
				(bm25(idgames_fts, 10.0, 2.0, 5.0, 1.0) * -1.0) *
				(1.0 + (log10(max(c.votes, 1)) * (c.rating / 5.0))) *
				CASE
					WHEN c.is_cacoward = 1 THEN 2.5
					WHEN c.is_top100 = 1 THEN 1.8
					ELSE 1.0
				END
			) AS score
		FROM idgames_fts
		JOIN idgames_catalog c ON c.id = idgames_fts.rowid
		LEFT JOIN mods m ON LOWER(m.name) = LOWER(c.filename) OR LOWER(m.path) LIKE '%%' || LOWER(c.filename)
		%s
		%s
		LIMIT ? OFFSET ?
	`, whereSQL, orderSQL)

	args = append(args, limit, offset)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return r.searchFallbackLike(ctx, rawQuery, opts, limit, offset)
	}
	defer rows.Close()
	items, err := scanCatalogItems(rows)
	if err != nil {
		return nil, err
	}

	if len(items) == 0 {
		// Also try substring LIKE match for high recall if FTS prefix token missed
		return r.searchFallbackLike(ctx, rawQuery, opts, limit, offset)
	}

	return items, nil
}

func (r *CatalogRepository) searchFallbackLike(ctx context.Context, rawQuery string, opts SearchOptions, limit, offset int) ([]CatalogItem, error) {
	likePattern := "%" + strings.ToLower(rawQuery) + "%"
	var whereClauses []string
	var args []any

	whereClauses = append(whereClauses, `(
		LOWER(c.title) LIKE ? OR
		LOWER(c.filename) LIKE ? OR
		LOWER(c.author) LIKE ? OR
		LOWER(c.description) LIKE ?
	)`)
	args = append(args, likePattern, likePattern, likePattern, likePattern)

	if opts.CacowardOnly {
		whereClauses = append(whereClauses, "c.is_cacoward = 1")
	}
	if opts.Top100Only {
		whereClauses = append(whereClauses, "c.is_top100 = 1")
	}
	if strings.TrimSpace(opts.Category) != "" {
		cat := strings.TrimSpace(opts.Category)
		singular := strings.TrimSuffix(strings.ToLower(cat), "s")
		whereClauses = append(whereClauses, "(LOWER(c.category) = LOWER(?) OR LOWER(c.category) = ? OR LOWER(c.category) LIKE ?)")
		args = append(args, cat, singular, "%"+singular+"%")
	}

	whereSQL := "WHERE " + strings.Join(whereClauses, " AND ")

	query := fmt.Sprintf(`
		SELECT
			c.id, c.title, c.dir, c.filename, c.size, c.age, c.date,
			c.author, c.description, c.rating, c.votes,
			c.is_cacoward, c.cacoward_year, c.is_top100, c.category, c.curator_note,
			CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END AS is_installed,
			COALESCE(m.id, '') AS installed_mod_id,
			(c.rating * 1.5) AS score
		FROM idgames_catalog c
		LEFT JOIN mods m ON LOWER(m.name) = LOWER(c.filename) OR LOWER(m.path) LIKE '%%' || LOWER(c.filename)
		%s
		GROUP BY c.id
		ORDER BY c.rating DESC, c.votes DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	args = append(args, limit, offset)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("executing fallback LIKE search: %w", err)
	}
	defer rows.Close()

	return scanCatalogItems(rows)
}

// GetShowcase returns sets of curated, top rated, and recent mods for the zero-state view.
func (r *CatalogRepository) GetShowcase(ctx context.Context) (*ShowcaseResult, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	cacowards, err := r.Search(ctx, SearchOptions{
		CacowardOnly: true,
		Sort:         "rating-desc",
		Limit:        12,
	})
	if err != nil {
		return nil, fmt.Errorf("fetching showcase cacowards: %w", err)
	}

	top100, err := r.Search(ctx, SearchOptions{
		Top100Only: true,
		Sort:       "rating-desc",
		Limit:      12,
	})
	if err != nil {
		return nil, fmt.Errorf("fetching showcase top100: %w", err)
	}

	topRated, err := r.Search(ctx, SearchOptions{
		Sort:  "rating-desc",
		Limit: 12,
	})
	if err != nil {
		return nil, fmt.Errorf("fetching showcase top rated: %w", err)
	}

	recent, err := r.Search(ctx, SearchOptions{
		Sort:  "date-desc",
		Limit: 12,
	})
	if err != nil {
		return nil, fmt.Errorf("fetching showcase recent uploads: %w", err)
	}

	return &ShowcaseResult{
		CacowardClassics: cacowards,
		Top100:           top100,
		TopRated:         topRated,
		RecentUploads:    recent,
	}, nil
}

// GetMaxID returns the highest idgames ID present in the local database.
func (r *CatalogRepository) GetMaxID(ctx context.Context) (int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var maxID sql.NullInt64
	err := r.db.QueryRowContext(ctx, `SELECT MAX(id) FROM idgames_catalog`).Scan(&maxID)
	if err != nil {
		return 0, fmt.Errorf("querying max id: %w", err)
	}
	if !maxID.Valid {
		return 0, nil
	}
	return int(maxID.Int64), nil
}

// Count returns the total number of items stored in the catalog.
func (r *CatalogRepository) Count(ctx context.Context) (int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var count int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM idgames_catalog`).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("querying catalog count: %w", err)
	}
	return count, nil
}
// InsertItems inserts new catalog items in batched transactions, skipping IDs
// already present. It returns the number of newly inserted rows.
func (r *CatalogRepository) InsertItems(ctx context.Context, items []CatalogItem) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(items) == 0 {
		return 0, nil
	}

	curatedRegistry, err := LoadCuratedRegistry()
	if err != nil {
		curatedRegistry = make(map[int]CuratedEntry)
	}

	const batchSize = 500
	const insertSQL = `
		INSERT OR IGNORE INTO idgames_catalog (
			id, title, dir, filename, size, age, date, author, description,
			rating, votes, is_cacoward, cacoward_year, is_top100, category, curator_note, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
	`

	inserted := 0
	for start := 0; start < len(items); start += batchSize {
		end := min(start+batchSize, len(items))

		tx, err := r.db.BeginTx(ctx, nil)
		if err != nil {
			return inserted, fmt.Errorf("starting insert transaction: %w", err)
		}
		committed := false
		defer func() {
			if !committed {
				_ = tx.Rollback()
			}
		}()

		stmt, err := tx.PrepareContext(ctx, insertSQL)
		if err != nil {
			return inserted, fmt.Errorf("preparing insert statement: %w", err)
		}

		batchInserted := 0
		for _, item := range items[start:end] {
			isCacoward := 0
			isTop100 := 0
			cacowardYear := item.CacowardYear
			category := item.Category
			curatorNote := item.CuratorNote
			if item.IsCacoward {
				isCacoward = 1
			}
			if item.IsTop100 {
				isTop100 = 1
			}
			if curated, found := curatedRegistry[item.ID]; found {
				if curated.IsCacoward {
					isCacoward = 1
				}
				cacowardYear = curated.CacowardYear
				if curated.IsTop100 {
					isTop100 = 1
				}
				category = curated.Category
				curatorNote = curated.CuratorNote
			}

			res, err := stmt.ExecContext(ctx,
				item.ID, item.Title, item.Dir, item.Filename, item.Size, item.Age,
				item.Date, item.Author, item.Description, item.Rating, item.Votes,
				isCacoward, cacowardYear, isTop100, category, curatorNote,
			)
			if err != nil {
				_ = stmt.Close()
				return inserted, fmt.Errorf("inserting catalog id %d: %w", item.ID, err)
			}
			if n, err := res.RowsAffected(); err == nil {
				batchInserted += int(n)
			}
		}
		_ = stmt.Close()

		if err := tx.Commit(); err != nil {
			return inserted, fmt.Errorf("committing insert batch: %w", err)
		}
		committed = true
		inserted += batchInserted
	}

	return inserted, nil
}


// buildFTSQuery cleans user input into a safe FTS5 MATCH expression.
func buildFTSQuery(raw string) string {
	var words []string
	var current strings.Builder

	for _, r := range raw {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			current.WriteRune(r)
		} else {
			if current.Len() > 0 {
				words = append(words, current.String())
				current.Reset()
			}
		}
	}
	if current.Len() > 0 {
		words = append(words, current.String())
	}

	if len(words) == 0 {
		return ""
	}

	var tokens []string
	for _, w := range words {
		lower := strings.ToLower(w)
		// Ignore short stopwords if multiple words are present
		if len(words) > 1 && (lower == "the" || lower == "a" || lower == "an" || lower == "in" || lower == "of" || lower == "to") {
			continue
		}
		// Suffix wildcard for prefix matching
		tokens = append(tokens, fmt.Sprintf(`"%s"*`, strings.ReplaceAll(w, `"`, `""`)))
	}

	if len(tokens) == 0 {
		tokens = append(tokens, fmt.Sprintf(`"%s"*`, strings.ReplaceAll(words[0], `"`, `""`)))
	}

	return strings.Join(tokens, " AND ")
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanCatalogItem(scanner rowScanner) (*CatalogItem, error) {
	var (
		item         CatalogItem
		isCacoward   int
		isTop100     int
		isInstalled  int
		installedMod string
		score        sql.NullFloat64
	)

	err := scanner.Scan(
		&item.ID, &item.Title, &item.Dir, &item.Filename, &item.Size, &item.Age,
		&item.Date, &item.Author, &item.Description, &item.Rating, &item.Votes,
		&isCacoward, &item.CacowardYear, &isTop100, &item.Category, &item.CuratorNote,
		&isInstalled, &installedMod,
	)
	if err != nil {
		return nil, err
	}

	item.IsCacoward = isCacoward == 1
	item.IsTop100 = isTop100 == 1
	item.IsInstalled = isInstalled == 1
	item.InstalledModID = installedMod
	if score.Valid && !math.IsNaN(score.Float64) && !math.IsInf(score.Float64, 0) {
		item.Score = score.Float64
	}

	return &item, nil
}

func scanCatalogItems(rows *sql.Rows) ([]CatalogItem, error) {
	var items []CatalogItem
	for rows.Next() {
		var (
			item         CatalogItem
			isCacoward   int
			isTop100     int
			isInstalled  int
			installedMod string
			score        sql.NullFloat64
		)

		err := rows.Scan(
			&item.ID, &item.Title, &item.Dir, &item.Filename, &item.Size, &item.Age,
			&item.Date, &item.Author, &item.Description, &item.Rating, &item.Votes,
			&isCacoward, &item.CacowardYear, &isTop100, &item.Category, &item.CuratorNote,
			&isInstalled, &installedMod, &score,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning catalog row: %w", err)
		}

		item.IsCacoward = isCacoward == 1
		item.IsTop100 = isTop100 == 1
		item.IsInstalled = isInstalled == 1
		item.InstalledModID = installedMod
		if score.Valid && !math.IsNaN(score.Float64) && !math.IsInf(score.Float64, 0) {
			item.Score = score.Float64
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating catalog rows: %w", err)
	}

	return items, nil
}
