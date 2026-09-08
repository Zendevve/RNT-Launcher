package scanner

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// waitForChange waits up to timeout for a signal on ch.
func waitForChange(t *testing.T, ch <-chan struct{}, timeout time.Duration) bool {
	t.Helper()
	select {
	case <-ch:
		return true
	case <-time.After(timeout):
		return false
	}
}

func TestWatch(t *testing.T) {
	const interval = 20 * time.Millisecond
	const settle = 150 * time.Millisecond
	const timeout = 5 * time.Second

	tests := []struct {
		name string
		// act performs filesystem changes after Watch starts and reports
		// whether a change callback is expected before the test ends.
		act             func(t *testing.T, dir string, stop func())
		expectCallback  bool
		stopBeforeCheck bool
	}{
		{
			name: "create detects new mod file",
			act: func(t *testing.T, dir string, _ func()) {
				if err := os.WriteFile(filepath.Join(dir, "brutal.wad"), []byte("fake-wad"), 0644); err != nil {
					t.Fatalf("failed to create mod file: %v", err)
				}
			},
			expectCallback: true,
		},
		{
			name: "modify detects size change",
			act: func(t *testing.T, dir string, _ func()) {
				path := filepath.Join(dir, "map.pk3")
				if err := os.WriteFile(path, []byte("v1"), 0644); err != nil {
					t.Fatalf("failed to create mod file: %v", err)
				}
				// Allow the watcher to settle on the initial state first.
				time.Sleep(settle)
				if err := os.WriteFile(path, []byte("v1-extended-content"), 0644); err != nil {
					t.Fatalf("failed to modify mod file: %v", err)
				}
			},
			expectCallback: true,
		},
		{
			name: "delete detects removal",
			act: func(t *testing.T, dir string, _ func()) {
				path := filepath.Join(dir, "doomed.wad")
				if err := os.WriteFile(path, []byte("bye"), 0644); err != nil {
					t.Fatalf("failed to create mod file: %v", err)
				}
				time.Sleep(settle)
				if err := os.Remove(path); err != nil {
					t.Fatalf("failed to remove mod file: %v", err)
				}
			},
			expectCallback: true,
		},
		{
			name: "non-candidate churn stays quiet",
			act: func(t *testing.T, dir string, _ func()) {
				if err := os.WriteFile(filepath.Join(dir, "readme.txt"), []byte("docs"), 0644); err != nil {
					t.Fatalf("failed to create text file: %v", err)
				}
			},
			expectCallback: false,
		},
		{
			name: "stop quiets further changes",
			act: func(t *testing.T, dir string, stop func()) {
				stop()
				if err := os.WriteFile(filepath.Join(dir, "late.wad"), []byte("too-late"), 0644); err != nil {
					t.Fatalf("failed to create mod file: %v", err)
				}
			},
			expectCallback:  false,
			stopBeforeCheck: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			changed := make(chan struct{}, 16)
			stop := Watch([]string{dir}, interval, func() { changed <- struct{}{} })
			stopped := false
			defer func() {
				if !stopped {
					stop()
				}
			}()

			tt.act(t, dir, func() {
				stop()
				stopped = true
			})

			if tt.expectCallback {
				if !waitForChange(t, changed, timeout) {
					t.Fatal("expected onChange callback, got none")
				}
				return
			}
			if tt.stopBeforeCheck {
				// Watcher already stopped inside act; give it a grace window
				// longer than the poll interval, then require silence.
				time.Sleep(settle)
			} else {
				// For quiet cases the watcher is still running: wait out a
				// full poll window plus margin to prove nothing fires.
				if waitForChange(t, changed, settle) {
					t.Fatal("expected silence, got onChange callback")
				}
			}
			select {
			case <-changed:
				t.Fatal("expected silence, got onChange callback")
			default:
			}
		})
	}
}

func TestWatch_NilCallbackDoesNotPanic(t *testing.T) {
	dir := t.TempDir()
	stop := Watch([]string{dir}, 10*time.Millisecond, nil)
	defer stop()
	if err := os.WriteFile(filepath.Join(dir, "x.wad"), []byte("x"), 0644); err != nil {
		t.Fatalf("failed to create mod file: %v", err)
	}
	time.Sleep(100 * time.Millisecond)
}

func TestWatch_DedupesDirs(t *testing.T) {
	dir := t.TempDir()
	changed := make(chan struct{}, 16)
	stop := Watch([]string{dir, dir + string(os.PathSeparator) + ".", "  ", ""}, 10*time.Millisecond, func() {
		changed <- struct{}{}
	})
	defer stop()
	if err := os.WriteFile(filepath.Join(dir, "dup.wad"), []byte("dup"), 0644); err != nil {
		t.Fatalf("failed to create mod file: %v", err)
	}
	if !waitForChange(t, changed, 5*time.Second) {
		t.Fatal("expected onChange callback, got none")
	}
}
