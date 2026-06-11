package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"rnt-launcher/internal/domain"
)

// EngineRepository defines persistence operations for Doom source port engines.
type EngineRepository interface {
	List() ([]domain.Engine, error)
	Get(id string) (*domain.Engine, error)
	Create(engine *domain.Engine) error
	Update(engine *domain.Engine) error
	Delete(id string) error
}

// IWADRepository defines persistence operations for Base Game IWADs.
type IWADRepository interface {
	List() ([]domain.IWAD, error)
	Get(id string) (*domain.IWAD, error)
	GetByPath(path string) (*domain.IWAD, error)
	Create(iwad *domain.IWAD) error
	Update(iwad *domain.IWAD) error
	Delete(id string) error
}

// ModRepository defines persistence and search operations for mods.
type ModRepository interface {
	List(filter domain.ModFilter) ([]domain.Mod, error)
	Get(id string) (*domain.Mod, error)
	GetByPath(path string) (*domain.Mod, error)
	Create(mod *domain.Mod) error
	Update(mod *domain.Mod) error
	Delete(id string) error
	ToggleFavorite(id string) (bool, error)
}

// ProfileRepository defines persistence operations for launch profiles and their assigned mods.
type ProfileRepository interface {
	List() ([]domain.Profile, error)
	Get(id string) (*domain.Profile, error)
	Create(profile *domain.Profile) error
	Update(profile *domain.Profile) error
	Delete(id string) error
	Duplicate(id string, newName string) (*domain.Profile, error)
	ToggleFavorite(id string) (bool, error)
	SetProfileMods(profileID string, mods []domain.ProfileMod) error
	GetProfileMods(profileID string) ([]domain.ProfileMod, error)
}

// HistoryRepository defines persistence operations for launch records and gameplay statistics.
type HistoryRepository interface {
	List(limit int) ([]domain.LaunchRecord, error)
	Add(record domain.LaunchRecord) error
	Clear() error
	GetStats() (domain.HistoryStats, error)
}

// SettingsRepository defines persistence operations for application preferences.
type SettingsRepository interface {
	GetSettings() (domain.Settings, error)
	SaveSettings(settings domain.Settings) error
}

// Repositories aggregates all database repositories into a single container.
type Repositories struct {
	Engines  EngineRepository
	IWADs    IWADRepository
	Mods     ModRepository
	Profiles ProfileRepository
	History  HistoryRepository
	Settings SettingsRepository
}

// NewRepositories creates and initializes all repository implementations.
func NewRepositories(db *sql.DB) *Repositories {
	return &Repositories{
		Engines:  NewEngineRepository(db),
		IWADs:    NewIWADRepository(db),
		Mods:     NewModRepository(db),
		Profiles: NewProfileRepository(db),
		History:  NewHistoryRepository(db),
		Settings: NewSettingsRepository(db),
	}
}

// ==========================================
// Engine Repository Implementation
// ==========================================

type engineRepo struct {
	db *sql.DB
}

// NewEngineRepository creates a new EngineRepository instance.
func NewEngineRepository(db *sql.DB) EngineRepository {
	return &engineRepo{db: db}
}

func (r *engineRepo) List() ([]domain.Engine, error) {
	query := `SELECT id, name, executable, version, family, created_at, updated_at FROM engines ORDER BY name COLLATE NOCASE ASC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list engines: %w", err)
	}
	defer rows.Close()

	engines := make([]domain.Engine, 0)
	for rows.Next() {
		var e domain.Engine
		var fam string
		if err := rows.Scan(&e.ID, &e.Name, &e.Executable, &e.Version, &fam, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan engine row: %w", err)
		}
		e.Family = domain.EngineFamily(fam)
		engines = append(engines, e)
	}
	return engines, rows.Err()
}

func (r *engineRepo) Get(id string) (*domain.Engine, error) {
	query := `SELECT id, name, executable, version, family, created_at, updated_at FROM engines WHERE id = ?`
	var e domain.Engine
	var fam string
	err := r.db.QueryRow(query, id).Scan(&e.ID, &e.Name, &e.Executable, &e.Version, &fam, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, err
		}
		return nil, fmt.Errorf("failed to get engine %s: %w", id, err)
	}
	e.Family = domain.EngineFamily(fam)
	return &e, nil
}

func (r *engineRepo) Create(engine *domain.Engine) error {
	if engine.ID == "" {
		engine.ID = uuid.NewString()
	}
	if engine.CreatedAt.IsZero() {
		engine.CreatedAt = time.Now().UTC()
	}
	engine.UpdatedAt = engine.CreatedAt

	query := `INSERT INTO engines (id, name, executable, version, family, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := r.db.Exec(query, engine.ID, engine.Name, engine.Executable, engine.Version, string(engine.Family), engine.CreatedAt, engine.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert engine: %w", err)
	}
	return nil
}

func (r *engineRepo) Update(engine *domain.Engine) error {
	engine.UpdatedAt = time.Now().UTC()
	query := `UPDATE engines SET name = ?, executable = ?, version = ?, family = ?, updated_at = ? WHERE id = ?`
	res, err := r.db.Exec(query, engine.Name, engine.Executable, engine.Version, string(engine.Family), engine.UpdatedAt, engine.ID)
	if err != nil {
		return fmt.Errorf("failed to update engine %s: %w", engine.ID, err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *engineRepo) Delete(id string) error {
	query := `DELETE FROM engines WHERE id = ?`
	res, err := r.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete engine %s: %w", id, err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ==========================================
// IWAD Repository Implementation
// ==========================================

type iwadRepo struct {
	db *sql.DB
}

// NewIWADRepository creates a new IWADRepository instance.
func NewIWADRepository(db *sql.DB) IWADRepository {
	return &iwadRepo{db: db}
}

func (r *iwadRepo) List() ([]domain.IWAD, error) {
	query := `SELECT id, name, path, type, lump_count, size, sha256, created_at, updated_at FROM iwads ORDER BY name COLLATE NOCASE ASC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list iwads: %w", err)
	}
	defer rows.Close()

	iwads := make([]domain.IWAD, 0)
	for rows.Next() {
		var i domain.IWAD
		var typeStr string
		if err := rows.Scan(&i.ID, &i.Name, &i.Path, &typeStr, &i.LumpCount, &i.Size, &i.SHA256, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan iwad row: %w", err)
		}
		i.Type = domain.IWADType(typeStr)
		iwads = append(iwads, i)
	}
	return iwads, rows.Err()
}

func (r *iwadRepo) Get(id string) (*domain.IWAD, error) {
	query := `SELECT id, name, path, type, lump_count, size, sha256, created_at, updated_at FROM iwads WHERE id = ?`
	var i domain.IWAD
	var typeStr string
	err := r.db.QueryRow(query, id).Scan(&i.ID, &i.Name, &i.Path, &typeStr, &i.LumpCount, &i.Size, &i.SHA256, &i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, err
		}
		return nil, fmt.Errorf("failed to get iwad %s: %w", id, err)
	}
	i.Type = domain.IWADType(typeStr)
	return &i, nil
}

func (r *iwadRepo) GetByPath(path string) (*domain.IWAD, error) {
	query := `SELECT id, name, path, type, lump_count, size, sha256, created_at, updated_at FROM iwads WHERE path = ?`
	var i domain.IWAD
	var typeStr string
	err := r.db.QueryRow(query, path).Scan(&i.ID, &i.Name, &i.Path, &typeStr, &i.LumpCount, &i.Size, &i.SHA256, &i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get iwad by path %s: %w", path, err)
	}
	i.Type = domain.IWADType(typeStr)
	return &i, nil
}

func (r *iwadRepo) Create(iwad *domain.IWAD) error {
	if iwad.ID == "" {
		iwad.ID = uuid.NewString()
	}
	if iwad.CreatedAt.IsZero() {
		iwad.CreatedAt = time.Now().UTC()
	}
	iwad.UpdatedAt = iwad.CreatedAt

	query := `INSERT INTO iwads (id, name, path, type, lump_count, size, sha256, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := r.db.Exec(query, iwad.ID, iwad.Name, iwad.Path, string(iwad.Type), iwad.LumpCount, iwad.Size, iwad.SHA256, iwad.CreatedAt, iwad.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert iwad: %w", err)
	}
	return nil
}

func (r *iwadRepo) Update(iwad *domain.IWAD) error {
	iwad.UpdatedAt = time.Now().UTC()
	query := `UPDATE iwads SET name = ?, path = ?, type = ?, lump_count = ?, size = ?, sha256 = ?, updated_at = ? WHERE id = ?`
	res, err := r.db.Exec(query, iwad.Name, iwad.Path, string(iwad.Type), iwad.LumpCount, iwad.Size, iwad.SHA256, iwad.UpdatedAt, iwad.ID)
	if err != nil {
		return fmt.Errorf("failed to update iwad %s: %w", iwad.ID, err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *iwadRepo) Delete(id string) error {
	query := `DELETE FROM iwads WHERE id = ?`
	res, err := r.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete iwad %s: %w", id, err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ==========================================
// Mod Repository Implementation
// ==========================================

type modRepo struct {
	db *sql.DB
}

// NewModRepository creates a new ModRepository instance.
func NewModRepository(db *sql.DB) ModRepository {
	return &modRepo{db: db}
}

func (r *modRepo) List(filter domain.ModFilter) ([]domain.Mod, error) {
	query := `SELECT id, name, path, format, category, size, modified_at, sha256, lump_count, structures, is_favorite, created_at, updated_at FROM mods WHERE 1=1`
	args := make([]any, 0)
	if filter.Search != "" {
		query += ` AND (name LIKE ? OR path LIKE ?)`
		likeArg := "%" + filter.Search + "%"
		args = append(args, likeArg, likeArg)
	}
	if filter.Category != "" && filter.Category != "All" {
		query += ` AND category = ?`
		args = append(args, string(filter.Category))
	}
	if filter.Format != "" && filter.Format != "all" {
		query += ` AND format = ?`
		args = append(args, string(filter.Format))
	}
	if filter.IsFavorite != nil && *filter.IsFavorite {
		query += ` AND is_favorite = 1`
	}
	query += ` ORDER BY name COLLATE NOCASE ASC`
	if filter.Limit > 0 {
		query += ` LIMIT ?`
		args = append(args, filter.Limit)
		if filter.Offset > 0 {
			query += ` OFFSET ?`
			args = append(args, filter.Offset)
		}
	} else if filter.Offset > 0 {
		query += ` LIMIT -1 OFFSET ?`
		args = append(args, filter.Offset)
	}
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query mods: %w", err)
	}
	defer rows.Close()

	mods := make([]domain.Mod, 0)
	for rows.Next() {
		var m domain.Mod
		var formatStr, catStr, structuresJSON string
		var isFavInt int

		if err := rows.Scan(
			&m.ID, &m.Name, &m.Path, &formatStr, &catStr,
			&m.Size, &m.ModifiedAt, &m.SHA256, &m.LumpCount,
			&structuresJSON, &isFavInt, &m.CreatedAt, &m.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan mod row: %w", err)
		}

		m.Format = domain.ModFormat(formatStr)
		m.Category = domain.ModCategory(catStr)
		m.IsFavorite = (isFavInt == 1)
		if structuresJSON != "" {
			_ = json.Unmarshal([]byte(structuresJSON), &m.Structures)
		}
		if m.Structures == nil {
			m.Structures = []string{}
		}

		mods = append(mods, m)
	}
	return mods, rows.Err()
}

func (r *modRepo) Get(id string) (*domain.Mod, error) {
	query := `SELECT id, name, path, format, category, size, modified_at, sha256, lump_count, structures, is_favorite, created_at, updated_at FROM mods WHERE id = ?`
	var m domain.Mod
	var formatStr, catStr, structuresJSON string
	var isFavInt int

	err := r.db.QueryRow(query, id).Scan(
		&m.ID, &m.Name, &m.Path, &formatStr, &catStr,
		&m.Size, &m.ModifiedAt, &m.SHA256, &m.LumpCount,
		&structuresJSON, &isFavInt, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, err
		}
		return nil, fmt.Errorf("failed to get mod %s: %w", id, err)
	}

	m.Format = domain.ModFormat(formatStr)
	m.Category = domain.ModCategory(catStr)
	m.IsFavorite = (isFavInt == 1)
	if structuresJSON != "" {
		_ = json.Unmarshal([]byte(structuresJSON), &m.Structures)
	}
	if m.Structures == nil {
		m.Structures = []string{}
	}

	return &m, nil
}

func (r *modRepo) GetByPath(path string) (*domain.Mod, error) {
	query := `SELECT id, name, path, format, category, size, modified_at, sha256, lump_count, structures, is_favorite, created_at, updated_at FROM mods WHERE path = ?`
	var m domain.Mod
	var formatStr, catStr, structuresJSON string
	var isFavInt int

	err := r.db.QueryRow(query, path).Scan(
		&m.ID, &m.Name, &m.Path, &formatStr, &catStr,
		&m.Size, &m.ModifiedAt, &m.SHA256, &m.LumpCount,
		&structuresJSON, &isFavInt, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, err
		}
		return nil, fmt.Errorf("failed to get mod by path %s: %w", path, err)
	}

	m.Format = domain.ModFormat(formatStr)
	m.Category = domain.ModCategory(catStr)
	m.IsFavorite = (isFavInt == 1)
	if structuresJSON != "" {
		_ = json.Unmarshal([]byte(structuresJSON), &m.Structures)
	}
	if m.Structures == nil {
		m.Structures = []string{}
	}

	return &m, nil
}

func (r *modRepo) Create(mod *domain.Mod) error {
	if mod.ID == "" {
		mod.ID = uuid.NewString()
	}
	if mod.CreatedAt.IsZero() {
		mod.CreatedAt = time.Now().UTC()
	}
	mod.UpdatedAt = mod.CreatedAt

	if mod.Structures == nil {
		mod.Structures = []string{}
	}
	structsJSON, err := json.Marshal(mod.Structures)
	if err != nil {
		structsJSON = []byte("[]")
	}

	favInt := 0
	if mod.IsFavorite {
		favInt = 1
	}

	query := `INSERT INTO mods (id, name, path, format, category, size, modified_at, sha256, lump_count, structures, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err = r.db.Exec(query, mod.ID, mod.Name, mod.Path, string(mod.Format), string(mod.Category), mod.Size, mod.ModifiedAt, mod.SHA256, mod.LumpCount, string(structsJSON), favInt, mod.CreatedAt, mod.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert mod: %w", err)
	}
	return nil
}

func (r *modRepo) Update(mod *domain.Mod) error {
	mod.UpdatedAt = time.Now().UTC()
	if mod.Structures == nil {
		mod.Structures = []string{}
	}
	structsJSON, err := json.Marshal(mod.Structures)
	if err != nil {
		structsJSON = []byte("[]")
	}

	favInt := 0
	if mod.IsFavorite {
		favInt = 1
	}

	query := `UPDATE mods SET name = ?, path = ?, format = ?, category = ?, size = ?, modified_at = ?, sha256 = ?, lump_count = ?, structures = ?, is_favorite = ?, updated_at = ? WHERE id = ?`
	res, err := r.db.Exec(query, mod.Name, mod.Path, string(mod.Format), string(mod.Category), mod.Size, mod.ModifiedAt, mod.SHA256, mod.LumpCount, string(structsJSON), favInt, mod.UpdatedAt, mod.ID)
	if err != nil {
		return fmt.Errorf("failed to update mod %s: %w", mod.ID, err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *modRepo) Delete(id string) error {
	query := `DELETE FROM mods WHERE id = ?`
	res, err := r.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete mod %s: %w", id, err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *modRepo) ToggleFavorite(id string) (bool, error) {
	now := time.Now().UTC()
	tx, err := r.db.Begin()
	if err != nil {
		return false, fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback()

	res, err := tx.Exec(`UPDATE mods SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?`, now, id)
	if err != nil {
		return false, fmt.Errorf("failed to toggle favorite for mod %s: %w", id, err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	if rowsAffected == 0 {
		return false, sql.ErrNoRows
	}

	var isFavInt int
	if err := tx.QueryRow(`SELECT is_favorite FROM mods WHERE id = ?`, id).Scan(&isFavInt); err != nil {
		return false, fmt.Errorf("failed to read updated favorite state: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("failed to commit tx: %w", err)
	}
	return isFavInt == 1, nil
}

// ==========================================
// Profile Repository Implementation
// ==========================================

type profileRepo struct {
	db *sql.DB
}

// NewProfileRepository creates a new ProfileRepository instance.
func NewProfileRepository(db *sql.DB) ProfileRepository {
	return &profileRepo{db: db}
}

func (r *profileRepo) List() ([]domain.Profile, error) {
	query := `
		SELECT 
			p.id, p.name, p.description, 
			COALESCE(p.engine_id, ''), COALESCE(e.name, ''),
			COALESCE(p.iwad_id, ''), COALESCE(i.name, ''),
			p.arguments, p.working_dir, p.is_favorite,
			p.created_at, p.updated_at
		FROM profiles p
		LEFT JOIN engines e ON p.engine_id = e.id
		LEFT JOIN iwads i ON p.iwad_id = i.id
		ORDER BY p.name COLLATE NOCASE ASC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list profiles: %w", err)
	}
	defer rows.Close()

	profiles := make([]domain.Profile, 0)
	for rows.Next() {
		var p domain.Profile
		var argsJSON string
		var isFavInt int

		if err := rows.Scan(
			&p.ID, &p.Name, &p.Description,
			&p.EngineID, &p.EngineName,
			&p.IWADID, &p.IWADName,
			&argsJSON, &p.WorkingDir, &isFavInt,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan profile row: %w", err)
		}

		p.IsFavorite = (isFavInt == 1)
		if argsJSON != "" {
			_ = json.Unmarshal([]byte(argsJSON), &p.Arguments)
		}
		if p.Arguments == nil {
			p.Arguments = []string{}
		}

		profiles = append(profiles, p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed during profiles row iteration: %w", err)
	}
	rows.Close()

	for i := range profiles {
		mods, err := r.GetProfileMods(profiles[i].ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get profile mods for %s: %w", profiles[i].ID, err)
		}
		profiles[i].Mods = mods
	}

	return profiles, nil
}

func (r *profileRepo) Get(id string) (*domain.Profile, error) {
	query := `
		SELECT 
			p.id, p.name, p.description, 
			COALESCE(p.engine_id, ''), COALESCE(e.name, ''),
			COALESCE(p.iwad_id, ''), COALESCE(i.name, ''),
			p.arguments, p.working_dir, p.is_favorite,
			p.created_at, p.updated_at
		FROM profiles p
		LEFT JOIN engines e ON p.engine_id = e.id
		LEFT JOIN iwads i ON p.iwad_id = i.id
		WHERE p.id = ?
	`
	var p domain.Profile
	var argsJSON string
	var isFavInt int

	err := r.db.QueryRow(query, id).Scan(
		&p.ID, &p.Name, &p.Description,
		&p.EngineID, &p.EngineName,
		&p.IWADID, &p.IWADName,
		&argsJSON, &p.WorkingDir, &isFavInt,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, err
		}
		return nil, fmt.Errorf("failed to get profile %s: %w", id, err)
	}

	p.IsFavorite = (isFavInt == 1)
	if argsJSON != "" {
		_ = json.Unmarshal([]byte(argsJSON), &p.Arguments)
	}
	if p.Arguments == nil {
		p.Arguments = []string{}
	}

	mods, err := r.GetProfileMods(p.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get profile mods for %s: %w", p.ID, err)
	}
	p.Mods = mods

	return &p, nil
}

func (r *profileRepo) GetProfileMods(profileID string) ([]domain.ProfileMod, error) {
	query := `
		SELECT 
			pm.id, pm.profile_id, pm.mod_id,
			COALESCE(m.name, ''), COALESCE(m.path, ''), COALESCE(m.format, ''),
			pm.enabled, pm.sort_order
		FROM profile_mods pm
		LEFT JOIN mods m ON pm.mod_id = m.id
		WHERE pm.profile_id = ?
		ORDER BY pm.sort_order ASC
	`
	rows, err := r.db.Query(query, profileID)
	if err != nil {
		return nil, fmt.Errorf("failed to query profile mods: %w", err)
	}
	defer rows.Close()

	mods := make([]domain.ProfileMod, 0)
	for rows.Next() {
		var pm domain.ProfileMod
		var formatStr string
		var enabledInt int

		if err := rows.Scan(
			&pm.ID, &pm.ProfileID, &pm.ModID,
			&pm.ModName, &pm.ModPath, &formatStr,
			&enabledInt, &pm.Order,
		); err != nil {
			return nil, fmt.Errorf("failed to scan profile mod row: %w", err)
		}
		pm.ModFormat = domain.ModFormat(formatStr)
		pm.Enabled = (enabledInt == 1)
		mods = append(mods, pm)
	}
	return mods, rows.Err()
}

func (r *profileRepo) SetProfileMods(profileID string, mods []domain.ProfileMod) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM profile_mods WHERE profile_id = ?`, profileID); err != nil {
		return fmt.Errorf("failed to clear profile mods: %w", err)
	}

	insertQuery := `INSERT INTO profile_mods (id, profile_id, mod_id, enabled, sort_order) VALUES (?, ?, ?, ?, ?)`
	for i, mod := range mods {
		id := mod.ID
		if id == "" {
			id = uuid.NewString()
		}
		order := mod.Order
		if order == 0 && i > 0 {
			order = i
		}
		enabledInt := 0
		if mod.Enabled {
			enabledInt = 1
		}
		if _, err := tx.Exec(insertQuery, id, profileID, mod.ModID, enabledInt, order); err != nil {
			return fmt.Errorf("failed to insert profile mod: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit tx: %w", err)
	}
	return nil
}

func (r *profileRepo) Create(profile *domain.Profile) error {
	if profile.ID == "" {
		profile.ID = uuid.NewString()
	}
	if profile.CreatedAt.IsZero() {
		profile.CreatedAt = time.Now().UTC()
	}
	profile.UpdatedAt = profile.CreatedAt

	if profile.Arguments == nil {
		profile.Arguments = []string{}
	}
	argsJSON, err := json.Marshal(profile.Arguments)
	if err != nil {
		argsJSON = []byte("[]")
	}

	favInt := 0
	if profile.IsFavorite {
		favInt = 1
	}

	var engineID *string
	if profile.EngineID != "" {
		engineID = &profile.EngineID
	}
	var iwadID *string
	if profile.IWADID != "" {
		iwadID = &profile.IWADID
	}

	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback()

	// Clean out any stale profile_mods if re-creating with explicit ID
	if _, err := tx.Exec(`DELETE FROM profile_mods WHERE profile_id = ?`, profile.ID); err != nil {
		return fmt.Errorf("failed to clear old profile mods: %w", err)
	}

	query := `INSERT INTO profiles (id, name, description, engine_id, iwad_id, arguments, working_dir, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err = tx.Exec(query, profile.ID, profile.Name, profile.Description, engineID, iwadID, string(argsJSON), profile.WorkingDir, favInt, profile.CreatedAt, profile.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert profile: %w", err)
	}

	if len(profile.Mods) > 0 {
		insertModQuery := `INSERT INTO profile_mods (id, profile_id, mod_id, enabled, sort_order) VALUES (?, ?, ?, ?, ?)`
		for i, mod := range profile.Mods {
			id := mod.ID
			if id == "" {
				id = uuid.NewString()
			}
			order := mod.Order
			if order == 0 && i > 0 {
				order = i
			}
			enabledInt := 0
			if mod.Enabled {
				enabledInt = 1
			}
			if _, err := tx.Exec(insertModQuery, id, profile.ID, mod.ModID, enabledInt, order); err != nil {
				return fmt.Errorf("failed to insert profile mod: %w", err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit tx: %w", err)
	}
	return nil
}

func (r *profileRepo) Update(profile *domain.Profile) error {
	profile.UpdatedAt = time.Now().UTC()
	if profile.Arguments == nil {
		profile.Arguments = []string{}
	}
	argsJSON, err := json.Marshal(profile.Arguments)
	if err != nil {
		argsJSON = []byte("[]")
	}

	favInt := 0
	if profile.IsFavorite {
		favInt = 1
	}

	var engineID *string
	if profile.EngineID != "" {
		engineID = &profile.EngineID
	}
	var iwadID *string
	if profile.IWADID != "" {
		iwadID = &profile.IWADID
	}

	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback()

	query := `UPDATE profiles SET name = ?, description = ?, engine_id = ?, iwad_id = ?, arguments = ?, working_dir = ?, is_favorite = ?, updated_at = ? WHERE id = ?`
	res, err := tx.Exec(query, profile.Name, profile.Description, engineID, iwadID, string(argsJSON), profile.WorkingDir, favInt, profile.UpdatedAt, profile.ID)
	if err != nil {
		return fmt.Errorf("failed to update profile %s: %w", profile.ID, err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	if profile.Mods != nil {
		if _, err := tx.Exec(`DELETE FROM profile_mods WHERE profile_id = ?`, profile.ID); err != nil {
			return fmt.Errorf("failed to clear profile mods for update: %w", err)
		}
		insertModQuery := `INSERT INTO profile_mods (id, profile_id, mod_id, enabled, sort_order) VALUES (?, ?, ?, ?, ?)`
		for i, mod := range profile.Mods {
			id := mod.ID
			if id == "" {
				id = uuid.NewString()
			}
			order := mod.Order
			if order == 0 && i > 0 {
				order = i
			}
			enabledInt := 0
			if mod.Enabled {
				enabledInt = 1
			}
			if _, err := tx.Exec(insertModQuery, id, profile.ID, mod.ModID, enabledInt, order); err != nil {
				return fmt.Errorf("failed to insert profile mod during update: %w", err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit tx: %w", err)
	}
	return nil
}

func (r *profileRepo) Delete(id string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM profile_mods WHERE profile_id = ?`, id); err != nil {
		return fmt.Errorf("failed to delete profile mods for profile %s: %w", id, err)
	}

	res, err := tx.Exec(`DELETE FROM profiles WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to delete profile %s: %w", id, err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return tx.Commit()
}

func (r *profileRepo) Duplicate(id string, newName string) (*domain.Profile, error) {
	orig, err := r.Get(id)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch profile for duplication: %w", err)
	}

	cloned := &domain.Profile{
		ID:          uuid.NewString(),
		Name:        newName,
		Description: orig.Description,
		EngineID:    orig.EngineID,
		EngineName:  orig.EngineName,
		IWADID:      orig.IWADID,
		IWADName:    orig.IWADName,
		WorkingDir:  orig.WorkingDir,
		IsFavorite:  false,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	if orig.Arguments != nil {
		cloned.Arguments = make([]string, len(orig.Arguments))
		copy(cloned.Arguments, orig.Arguments)
	} else {
		cloned.Arguments = []string{}
	}

	clonedMods := make([]domain.ProfileMod, 0, len(orig.Mods))
	for _, m := range orig.Mods {
		clonedMods = append(clonedMods, domain.ProfileMod{
			ID:        uuid.NewString(),
			ProfileID: cloned.ID,
			ModID:     m.ModID,
			ModName:   m.ModName,
			ModPath:   m.ModPath,
			ModFormat: m.ModFormat,
			Enabled:   m.Enabled,
			Order:     m.Order,
		})
	}
	cloned.Mods = clonedMods

	if err := r.Create(cloned); err != nil {
		return nil, fmt.Errorf("failed to save duplicated profile: %w", err)
	}

	return cloned, nil
}

func (r *profileRepo) ToggleFavorite(id string) (bool, error) {
	now := time.Now().UTC()
	tx, err := r.db.Begin()
	if err != nil {
		return false, fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback()

	res, err := tx.Exec(`UPDATE profiles SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?`, now, id)
	if err != nil {
		return false, fmt.Errorf("failed to toggle favorite for profile %s: %w", id, err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	if rowsAffected == 0 {
		return false, sql.ErrNoRows
	}

	var isFavInt int
	if err := tx.QueryRow(`SELECT is_favorite FROM profiles WHERE id = ?`, id).Scan(&isFavInt); err != nil {
		return false, fmt.Errorf("failed to read updated favorite state: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("failed to commit tx: %w", err)
	}
	return isFavInt == 1, nil
}

// ==========================================
// History Repository Implementation
// ==========================================

type historyRepo struct {
	db *sql.DB
}

// NewHistoryRepository creates a new HistoryRepository instance.
func NewHistoryRepository(db *sql.DB) HistoryRepository {
	return &historyRepo{db: db}
}

func (r *historyRepo) List(limit int) ([]domain.LaunchRecord, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT id, profile_id, profile_name, engine_name, iwad_name, started_at, finished_at, duration_ms, exit_code, status, command_line 
		FROM launch_history 
		ORDER BY started_at DESC 
		LIMIT ?
	`
	rows, err := r.db.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list history: %w", err)
	}
	defer rows.Close()

	records := make([]domain.LaunchRecord, 0)
	for rows.Next() {
		var rec domain.LaunchRecord
		if err := rows.Scan(
			&rec.ID, &rec.ProfileID, &rec.ProfileName,
			&rec.EngineName, &rec.IWADName,
			&rec.StartedAt, &rec.FinishedAt,
			&rec.DurationMs, &rec.ExitCode,
			&rec.Status, &rec.CommandLine,
		); err != nil {
			return nil, fmt.Errorf("failed to scan history record: %w", err)
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

func (r *historyRepo) Add(record domain.LaunchRecord) error {
	if record.ID == "" {
		record.ID = uuid.NewString()
	}
	if record.DurationMs <= 0 && !record.StartedAt.IsZero() && !record.FinishedAt.IsZero() {
		diff := record.FinishedAt.Sub(record.StartedAt).Milliseconds()
		if diff > 0 {
			record.DurationMs = diff
		}
	}
	query := `
		INSERT INTO launch_history (id, profile_id, profile_name, engine_name, iwad_name, started_at, finished_at, duration_ms, exit_code, status, command_line)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(
		query,
		record.ID, record.ProfileID, record.ProfileName,
		record.EngineName, record.IWADName,
		record.StartedAt, record.FinishedAt,
		record.DurationMs, record.ExitCode,
		record.Status, record.CommandLine,
	)
	if err != nil {
		return fmt.Errorf("failed to insert launch record: %w", err)
	}
	return nil
}

func (r *historyRepo) Clear() error {
	_, err := r.db.Exec(`DELETE FROM launch_history`)
	if err != nil {
		return fmt.Errorf("failed to clear launch history: %w", err)
	}
	return nil
}

func (r *historyRepo) GetStats() (domain.HistoryStats, error) {
	query := `
		SELECT 
			COUNT(*), 
			COALESCE(SUM(duration_ms), 0)
		FROM launch_history
	`
	var stats domain.HistoryStats
	err := r.db.QueryRow(query).Scan(&stats.TotalLaunches, &stats.TotalPlayTimeMs)
	if err != nil {
		return stats, fmt.Errorf("failed to calculate history stats: %w", err)
	}

	if stats.TotalLaunches > 0 {
		var startedAtRaw any
		if err := r.db.QueryRow(`SELECT started_at FROM launch_history ORDER BY started_at DESC LIMIT 1`).Scan(&startedAtRaw); err == nil && startedAtRaw != nil {
			var strVal string
			switch v := startedAtRaw.(type) {
			case time.Time:
				if !v.IsZero() {
					utc := v.UTC()
					stats.LastLaunchedAt = &utc
				}
			case string:
				strVal = v
			case []byte:
				strVal = string(v)
			}

			if strVal != "" && stats.LastLaunchedAt == nil {
				formats := []string{
					time.RFC3339Nano,
					time.RFC3339,
					"2006-01-02 15:04:05.999999999-07:00",
					"2006-01-02 15:04:05.999999999",
					"2006-01-02 15:04:05-07:00",
					"2006-01-02 15:04:05",
					"2006-01-02T15:04:05",
					"2006-01-02 15:04:05.999999999+00:00",
					"2006-01-02 15:04:05+00:00",
				}
				for _, f := range formats {
					if t, err := time.Parse(f, strVal); err == nil {
						utc := t.UTC()
						stats.LastLaunchedAt = &utc
						break
					}
				}
			}
		}
	}

	// Compute most played profile
	mostPlayedQuery := `
		SELECT profile_id, profile_name
		FROM launch_history
		WHERE profile_id IS NOT NULL AND profile_id != ''
		GROUP BY profile_id
		ORDER BY COUNT(*) DESC, SUM(duration_ms) DESC
		LIMIT 1
	`
	var profID, profName sql.NullString
	if err := r.db.QueryRow(mostPlayedQuery).Scan(&profID, &profName); err == nil {
		stats.MostPlayedProfileID = profID.String
		stats.MostPlayedProfileName = profName.String
	}

	return stats, nil
}

// ==========================================
// Settings Repository Implementation
// ==========================================

type settingsRepo struct {
	db *sql.DB
}

// NewSettingsRepository creates a new SettingsRepository instance.
func NewSettingsRepository(db *sql.DB) SettingsRepository {
	return &settingsRepo{db: db}
}

func (r *settingsRepo) GetSettings() (domain.Settings, error) {
	defaults := domain.DefaultSettings()

	query := `SELECT key, value FROM settings`
	rows, err := r.db.Query(query)
	if err != nil {
		return defaults, fmt.Errorf("failed to query settings: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var key, val string
		if err := rows.Scan(&key, &val); err != nil {
			continue
		}
		switch key {
		case "mod_directories":
			_ = json.Unmarshal([]byte(val), &defaults.ModDirectories)
		case "iwad_directories":
			_ = json.Unmarshal([]byte(val), &defaults.IWADDirectories)
		case "engine_directories":
			_ = json.Unmarshal([]byte(val), &defaults.EngineDirectories)
		case "default_working_dir":
			defaults.DefaultWorkingDir = val
		case "theme":
			defaults.Theme = val
		case "confirm_launch":
			defaults.ConfirmLaunch = (val == "1" || val == "true")
		case "auto_scan_on_startup":
			defaults.AutoScanOnStartup = (val == "1" || val == "true")
		case "close_on_launch":
			defaults.CloseOnLaunch = (val == "1" || val == "true")
		}
	}

	if defaults.ModDirectories == nil {
		defaults.ModDirectories = []string{}
	}
	if defaults.IWADDirectories == nil {
		defaults.IWADDirectories = []string{}
	}
	if defaults.EngineDirectories == nil {
		defaults.EngineDirectories = []string{}
	}

	return defaults, rows.Err()
}

func (r *settingsRepo) SaveSettings(settings domain.Settings) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin tx for settings: %w", err)
	}
	defer tx.Rollback()

	upsertQuery := `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`

	modDirsJSON, _ := json.Marshal(settings.ModDirectories)
	iwadDirsJSON, _ := json.Marshal(settings.IWADDirectories)
	engDirsJSON, _ := json.Marshal(settings.EngineDirectories)

	items := []struct {
		key string
		val string
	}{
		{"mod_directories", string(modDirsJSON)},
		{"iwad_directories", string(iwadDirsJSON)},
		{"engine_directories", string(engDirsJSON)},
		{"default_working_dir", settings.DefaultWorkingDir},
		{"theme", settings.Theme},
		{"confirm_launch", fmt.Sprintf("%t", settings.ConfirmLaunch)},
		{"auto_scan_on_startup", fmt.Sprintf("%t", settings.AutoScanOnStartup)},
		{"close_on_launch", fmt.Sprintf("%t", settings.CloseOnLaunch)},
	}

	for _, item := range items {
		if _, err := tx.Exec(upsertQuery, item.key, item.val); err != nil {
			return fmt.Errorf("failed to save setting %s: %w", item.key, err)
		}
	}

	return tx.Commit()
}
