package profiles

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/domain"
)

// ProfileService manages launch profiles, mod associations, load order, and configuration.
type ProfileService struct {
	profiles database.ProfileRepository
	mods     database.ModRepository
	iwads    database.IWADRepository
	engines  database.EngineRepository
}

// New creates a new ProfileService with all repository dependencies.
func New(
	profiles database.ProfileRepository,
	mods database.ModRepository,
	iwads database.IWADRepository,
	engines database.EngineRepository,
) *ProfileService {
	return &ProfileService{
		profiles: profiles,
		mods:     mods,
		iwads:    iwads,
		engines:  engines,
	}
}

// NewProfileService creates a new ProfileService with all repository dependencies.
func NewProfileService(
	profiles database.ProfileRepository,
	mods database.ModRepository,
	iwads database.IWADRepository,
	engines database.EngineRepository,
) *ProfileService {
	return New(profiles, mods, iwads, engines)
}

// checkInitialized verifies that the service context is active and the profile repository is present.
func (s *ProfileService) checkInitialized(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if s == nil || s.profiles == nil {
		return errors.New("profile repository is not initialized")
	}
	return nil
}

// List returns all launch profiles with their assigned mods and resolved engine/IWAD names.
func (s *ProfileService) List(ctx context.Context) ([]domain.Profile, error) {
	if err := s.checkInitialized(ctx); err != nil {
		return nil, err
	}
	profiles, err := s.profiles.List()
	if err != nil {
		return nil, fmt.Errorf("failed to list profiles: %w", err)
	}
	if profiles == nil {
		profiles = []domain.Profile{}
	}
	return profiles, nil
}

// Get retrieves a single profile by ID, including its assigned mods.
// Returns (nil, nil) if the profile does not exist.
func (s *ProfileService) Get(ctx context.Context, id string) (*domain.Profile, error) {
	if err := s.checkInitialized(ctx); err != nil {
		return nil, err
	}
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("profile id cannot be empty")
	}
	profile, err := s.profiles.Get(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get profile %q: %w", id, err)
	}
	return profile, nil
}

// Create inserts a new profile and its associated mods into the database.
func (s *ProfileService) Create(ctx context.Context, p domain.Profile) (*domain.Profile, error) {
	if err := s.checkInitialized(ctx); err != nil {
		return nil, err
	}
	if strings.TrimSpace(p.Name) == "" {
		return nil, errors.New("profile name cannot be empty")
	}
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	if p.CreatedAt.IsZero() {
		p.CreatedAt = now
	}
	p.UpdatedAt = now
	if p.Arguments == nil {
		p.Arguments = []string{}
	}
	if p.Mods == nil {
		p.Mods = []domain.ProfileMod{}
	}

	// Ensure ProfileMod IDs, ProfileID, and sequential order
	for i := range p.Mods {
		if p.Mods[i].ID == "" {
			p.Mods[i].ID = uuid.NewString()
		}
		p.Mods[i].ProfileID = p.ID
		if p.Mods[i].Order <= 0 {
			p.Mods[i].Order = i + 1
		}
	}

	// Resolve Engine Name if ID is present but Name is missing
	if p.EngineID != "" && p.EngineName == "" && s.engines != nil {
		if eng, err := s.engines.Get(p.EngineID); err == nil && eng != nil {
			p.EngineName = eng.Name
		}
	}
	// Resolve IWAD Name if ID is present but Name is missing
	if p.IWADID != "" && p.IWADName == "" && s.iwads != nil {
		if iwad, err := s.iwads.Get(p.IWADID); err == nil && iwad != nil {
			p.IWADName = iwad.Name
		}
	}

	if err := s.profiles.Create(&p); err != nil {
		return nil, fmt.Errorf("failed to create profile: %w", err)
	}

	created, err := s.profiles.Get(p.ID)
	if err == nil && created != nil {
		return created, nil
	}
	return &p, nil
}

// Update updates an existing profile's configuration and its assigned mods.
func (s *ProfileService) Update(ctx context.Context, p domain.Profile) error {
	if err := s.checkInitialized(ctx); err != nil {
		return err
	}
	if strings.TrimSpace(p.ID) == "" {
		return errors.New("profile id cannot be empty")
	}
	if strings.TrimSpace(p.Name) == "" {
		return errors.New("profile name cannot be empty")
	}
	if p.Arguments == nil {
		p.Arguments = []string{}
	}
	if p.Mods == nil {
		p.Mods = []domain.ProfileMod{}
	}
	for i := range p.Mods {
		if p.Mods[i].ID == "" {
			p.Mods[i].ID = uuid.NewString()
		}
		p.Mods[i].ProfileID = p.ID
		if p.Mods[i].Order <= 0 {
			p.Mods[i].Order = i + 1
		}
	}

	if err := s.profiles.Update(&p); err != nil {
		return fmt.Errorf("failed to update profile %q: %w", p.ID, err)
	}
	return nil
}

// Delete removes a profile and its assigned mods by ID.
func (s *ProfileService) Delete(ctx context.Context, id string) error {
	if err := s.checkInitialized(ctx); err != nil {
		return err
	}
	if strings.TrimSpace(id) == "" {
		return errors.New("profile id cannot be empty")
	}
	if err := s.profiles.Delete(id); err != nil {
		return fmt.Errorf("failed to delete profile %q: %w", id, err)
	}
	return nil
}

// Duplicate creates a duplicate of an existing profile with a new name and copied mod order.
func (s *ProfileService) Duplicate(ctx context.Context, id string, newName string) (*domain.Profile, error) {
	if err := s.checkInitialized(ctx); err != nil {
		return nil, err
	}
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("profile id cannot be empty")
	}

	orig, err := s.profiles.Get(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("profile %q not found", id)
		}
		return nil, fmt.Errorf("failed to get profile %q for duplication: %w", id, err)
	}
	if orig == nil {
		return nil, fmt.Errorf("profile %q not found", id)
	}

	if strings.TrimSpace(newName) == "" {
		newName = orig.Name + " (Copy)"
	}

	duplicated, err := s.profiles.Duplicate(id, newName)
	if err != nil {
		return nil, fmt.Errorf("failed to duplicate profile %q: %w", id, err)
	}
	return duplicated, nil
}

// ToggleFavorite flips the favorite bookmark status of a profile.
func (s *ProfileService) ToggleFavorite(ctx context.Context, id string) error {
	if err := s.checkInitialized(ctx); err != nil {
		return err
	}
	if strings.TrimSpace(id) == "" {
		return errors.New("profile id cannot be empty")
	}
	if _, err := s.profiles.ToggleFavorite(id); err != nil {
		return fmt.Errorf("failed to toggle favorite for profile %q: %w", id, err)
	}
	return nil
}

// AddMod appends a mod from the library to the end of the profile's load order.
func (s *ProfileService) AddMod(ctx context.Context, profileID string, modID string) error {
	if err := s.checkInitialized(ctx); err != nil {
		return err
	}
	if strings.TrimSpace(profileID) == "" {
		return errors.New("profile id cannot be empty")
	}
	if strings.TrimSpace(modID) == "" {
		return errors.New("mod id cannot be empty")
	}

	p, err := s.profiles.Get(profileID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("profile %q not found", profileID)
		}
		return fmt.Errorf("failed to get profile %q: %w", profileID, err)
	}
	if p == nil {
		return fmt.Errorf("profile %q not found", profileID)
	}

	// If already in profile, no-op
	for _, m := range p.Mods {
		if m.ModID == modID {
			return nil
		}
	}

	if s.mods == nil {
		return errors.New("mod repository is not initialized")
	}
	mod, err := s.mods.Get(modID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("mod %q not found", modID)
		}
		return fmt.Errorf("failed to get mod %q: %w", modID, err)
	}
	if mod == nil {
		return fmt.Errorf("mod %q not found", modID)
	}

	nextOrder := len(p.Mods) + 1
	for _, m := range p.Mods {
		if m.Order >= nextOrder {
			nextOrder = m.Order + 1
		}
	}

	newMod := domain.ProfileMod{
		ID:        uuid.NewString(),
		ProfileID: profileID,
		ModID:     mod.ID,
		ModName:   mod.Name,
		ModPath:   mod.Path,
		ModFormat: mod.Format,
		Enabled:   true,
		Order:     nextOrder,
	}

	p.Mods = append(p.Mods, newMod)
	if err := s.profiles.SetProfileMods(profileID, p.Mods); err != nil {
		return fmt.Errorf("failed to add mod to profile %q: %w", profileID, err)
	}
	return nil
}

// RemoveMod removes a mod from the profile and re-indexes the remaining load order.
func (s *ProfileService) RemoveMod(ctx context.Context, profileID string, modID string) error {
	if err := s.checkInitialized(ctx); err != nil {
		return err
	}
	if strings.TrimSpace(profileID) == "" {
		return errors.New("profile id cannot be empty")
	}
	if strings.TrimSpace(modID) == "" {
		return errors.New("mod id cannot be empty")
	}

	p, err := s.profiles.Get(profileID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("profile %q not found", profileID)
		}
		return fmt.Errorf("failed to get profile %q: %w", profileID, err)
	}
	if p == nil {
		return fmt.Errorf("profile %q not found", profileID)
	}

	var remaining []domain.ProfileMod
	for _, m := range p.Mods {
		if m.ModID != modID && m.ID != modID {
			remaining = append(remaining, m)
		}
	}

	// Re-index remaining load order 1, 2, 3...
	for i := range remaining {
		remaining[i].Order = i + 1
	}

	if err := s.profiles.SetProfileMods(profileID, remaining); err != nil {
		return fmt.Errorf("failed to remove mod from profile %q: %w", profileID, err)
	}
	return nil
}

// ReorderMods updates the load order of mods in the profile according to the provided slice of mod IDs.
func (s *ProfileService) ReorderMods(ctx context.Context, profileID string, modIDsInOrder []string) error {
	if err := s.checkInitialized(ctx); err != nil {
		return err
	}
	if strings.TrimSpace(profileID) == "" {
		return errors.New("profile id cannot be empty")
	}

	p, err := s.profiles.Get(profileID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("profile %q not found", profileID)
		}
		return fmt.Errorf("failed to get profile %q: %w", profileID, err)
	}
	if p == nil {
		return fmt.Errorf("profile %q not found", profileID)
	}

	// Build map of existing mods by ModID and ProfileMod ID
	modMap := make(map[string]domain.ProfileMod, len(p.Mods)*2)
	for _, m := range p.Mods {
		modMap[m.ModID] = m
		modMap[m.ID] = m
	}

	var reordered []domain.ProfileMod
	used := make(map[string]bool, len(p.Mods))

	for _, id := range modIDsInOrder {
		if m, found := modMap[id]; found {
			if !used[m.ModID] {
				used[m.ModID] = true
				reordered = append(reordered, m)
			}
		}
	}

	// Append any existing mods that were omitted from modIDsInOrder
	for _, m := range p.Mods {
		if !used[m.ModID] {
			used[m.ModID] = true
			reordered = append(reordered, m)
		}
	}

	// Re-assign 1-based sequential order
	for i := range reordered {
		reordered[i].Order = i + 1
	}

	if err := s.profiles.SetProfileMods(profileID, reordered); err != nil {
		return fmt.Errorf("failed to reorder mods for profile %q: %w", profileID, err)
	}
	return nil
}

// ToggleMod enables or disables an assigned mod within a profile.
func (s *ProfileService) ToggleMod(ctx context.Context, profileID string, modID string, enabled bool) error {
	if err := s.checkInitialized(ctx); err != nil {
		return err
	}
	if strings.TrimSpace(profileID) == "" {
		return errors.New("profile id cannot be empty")
	}
	if strings.TrimSpace(modID) == "" {
		return errors.New("mod id cannot be empty")
	}

	p, err := s.profiles.Get(profileID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("profile %q not found", profileID)
		}
		return fmt.Errorf("failed to get profile %q: %w", profileID, err)
	}
	if p == nil {
		return fmt.Errorf("profile %q not found", profileID)
	}

	found := false
	for i := range p.Mods {
		if p.Mods[i].ModID == modID || p.Mods[i].ID == modID {
			p.Mods[i].Enabled = enabled
			found = true
		}
	}

	if !found {
		return fmt.Errorf("mod %q not found in profile %q", modID, profileID)
	}

	if err := s.profiles.SetProfileMods(profileID, p.Mods); err != nil {
		return fmt.Errorf("failed to update mod enabled state in profile %q: %w", profileID, err)
	}
	return nil
}
