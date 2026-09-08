package scanner

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// DefaultWatchInterval is the fallback poll interval for Watch when the
// caller passes a non-positive interval.
const DefaultWatchInterval = 30 * time.Second

// fileMark is a lightweight fingerprint of a single watched file.
type fileMark struct {
	size    int64
	modTime int64
}

// fingerprint maps cleaned absolute file paths to their marks.
type fingerprint map[string]fileMark

// watchCandidate reports whether a file name is worth fingerprinting:
// recognized mod archives plus likely engine binaries (Windows .exe and
// extensionless Unix binaries). Everything else (docs, images, dotfiles)
// is ignored so unrelated churn never triggers a rescan.
func watchCandidate(name string) bool {
	if isModCandidate(name) {
		return true
	}
	switch strings.ToLower(filepath.Ext(name)) {
	case ".exe", "":
		return true
	default:
		return false
	}
}

// snapshotWatchDirs walks dirs and fingerprints candidate files. Missing or
// unreadable directories are skipped; per-file errors are ignored so one
// bad entry never aborts the snapshot.
func snapshotWatchDirs(dirs []string) fingerprint {
	fp := make(fingerprint)
	for _, dir := range dirs {
		_ = filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if d.IsDir() {
				if strings.HasPrefix(d.Name(), ".") {
					return filepath.SkipDir
				}
				return nil
			}
			if strings.HasPrefix(d.Name(), ".") || !watchCandidate(d.Name()) {
				return nil
			}
			info, err := d.Info()
			if err != nil {
				return nil
			}
			fp[filepath.Clean(path)] = fileMark{size: info.Size(), modTime: info.ModTime().UnixNano()}
			return nil
		})
	}
	return fp
}

// equalFingerprints reports whether two snapshots describe identical state.
func equalFingerprints(a, b fingerprint) bool {
	if len(a) != len(b) {
		return false
	}
	for path, markA := range a {
		markB, ok := b[path]
		if !ok || markA != markB {
			return false
		}
	}
	return true
}

// normalizeWatchDirs cleans, dedupes, and drops empty entries.
func normalizeWatchDirs(dirs []string) []string {
	seen := make(map[string]struct{}, len(dirs))
	out := make([]string, 0, len(dirs))
	for _, dir := range dirs {
		dir = strings.TrimSpace(dir)
		if dir == "" {
			continue
		}
		cleaned := filepath.Clean(dir)
		if _, ok := seen[cleaned]; ok {
			continue
		}
		seen[cleaned] = struct{}{}
		out = append(out, cleaned)
	}
	return out
}

// Watch polls dirs every interval and invokes onChange whenever the set of
// candidate files (path, size, modtime) changes. A non-positive interval
// selects DefaultWatchInterval. The initial snapshot is silent: onChange
// fires only on deltas observed after Watch returns.
//
// Watch uses polling only (no fsnotify, no new dependencies) so it works
// identically on every platform. The returned stop function terminates the
// background goroutine and blocks until it has exited; it is idempotent but
// MUST NOT be called from within onChange.
func Watch(dirs []string, interval time.Duration, onChange func()) (stop func()) {
	dirs = normalizeWatchDirs(dirs)
	if interval <= 0 {
		interval = DefaultWatchInterval
	}
	done := make(chan struct{})
	var once sync.Once
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		last := snapshotWatchDirs(dirs)
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				current := snapshotWatchDirs(dirs)
				if !equalFingerprints(last, current) {
					last = current
					if onChange != nil {
						onChange()
					}
				}
			}
		}
	}()
	return func() {
		once.Do(func() { close(done) })
		wg.Wait()
	}
}
