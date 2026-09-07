package saves_test

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"rnt-launcher/internal/saves"
)

func writeSaveFile(t *testing.T, dir, name, content string) {
	t.Helper()
	p := filepath.Join(dir, filepath.FromSlash(name))
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		t.Fatalf("MkdirAll(%q) failed: %v", filepath.Dir(p), err)
	}
	if err := os.WriteFile(p, []byte(content), 0644); err != nil {
		t.Fatalf("WriteFile(%q) failed: %v", p, err)
	}
}

func readSaveTree(t *testing.T, dir string) map[string][]byte {
	t.Helper()
	out := make(map[string][]byte)
	if _, err := os.Stat(dir); err != nil {
		t.Fatalf("Stat(%q) failed: %v", dir, err)
	}
	var walk func(current, prefix string)
	walk = func(current, prefix string) {
		ents, err := os.ReadDir(current)
		if err != nil {
			t.Fatalf("ReadDir(%q) failed: %v", current, err)
		}
		for _, e := range ents {
			rel := prefix + e.Name()
			if e.IsDir() {
				walk(filepath.Join(current, e.Name()), rel+"/")
				continue
			}
			data, err := os.ReadFile(filepath.Join(current, e.Name()))
			if err != nil {
				t.Fatalf("ReadFile(%q) failed: %v", e.Name(), err)
			}
			out[rel] = data
		}
	}
	walk(dir, "")
	return out
}

func TestSnapshotRoundTrip(t *testing.T) {
	svc := saves.New(t.TempDir())
	profileID := "roundtrip-profile"

	saveDir, err := svc.EnsureProfileSaveDir(profileID)
	if err != nil {
		t.Fatalf("EnsureProfileSaveDir failed: %v", err)
	}
	before := map[string]string{
		"save001.zds":        "save-data-one",
		"save002.zds":        "save-data-two",
		"config/player.ini":  "name=Doomguy",
		"shots/deep/cap.png": "fakepng",
	}
	for name, content := range before {
		writeSaveFile(t, saveDir, name, content)
	}
	want := readSaveTree(t, saveDir)

	zipPath, err := svc.Snapshot(profileID, "pre-boss")
	if err != nil {
		t.Fatalf("Snapshot failed: %v", err)
	}
	if !strings.HasSuffix(filepath.Base(zipPath), ".zip") {
		t.Fatalf("expected zip path, got %q", zipPath)
	}

	// Mutate: change a file, delete a file, add a file.
	writeSaveFile(t, saveDir, "save001.zds", "corrupted")
	if err := os.Remove(filepath.Join(saveDir, "save002.zds")); err != nil {
		t.Fatalf("Remove failed: %v", err)
	}
	writeSaveFile(t, saveDir, "save999.zds", "intruder")

	snapshotID := filepath.Base(zipPath)
	if err := svc.Restore(profileID, snapshotID); err != nil {
		t.Fatalf("Restore(%q) failed: %v", snapshotID, err)
	}
	// Also accepted without the .zip suffix.
	if err := svc.Restore(profileID, strings.TrimSuffix(snapshotID, ".zip")); err != nil {
		t.Fatalf("Restore without suffix failed: %v", err)
	}

	got := readSaveTree(t, saveDir)
	if len(got) != len(want) {
		t.Fatalf("restored tree has %d files, expected %d", len(got), len(want))
	}
	for name, wantData := range want {
		gotData, ok := got[name]
		if !ok {
			t.Errorf("missing restored file %q", name)
			continue
		}
		if string(gotData) != string(wantData) {
			t.Errorf("file %q = %q, expected %q", name, gotData, wantData)
		}
	}
}

func TestSnapshotLabelSanitized(t *testing.T) {
	svc := saves.New(t.TempDir())
	zipPath, err := svc.Snapshot("label-profile", "  boss fight! #2  ")
	if err != nil {
		t.Fatalf("Snapshot failed: %v", err)
	}
	base := filepath.Base(zipPath)
	if !strings.HasSuffix(base, "-bossfight2.zip") {
		t.Errorf("expected sanitized label suffix '-bossfight2.zip', got %q", base)
	}

	emptyLabelPath, err := svc.Snapshot("label-profile", "!!!")
	if err != nil {
		t.Fatalf("Snapshot with empty label failed: %v", err)
	}
	if !strings.HasSuffix(filepath.Base(emptyLabelPath), "-snapshot.zip") {
		t.Errorf("expected fallback label '-snapshot.zip', got %q", filepath.Base(emptyLabelPath))
	}
}

func TestRestoreRejects(t *testing.T) {
	svc := saves.New(t.TempDir())
	profileID := "reject-profile"

	cases := []struct {
		name       string
		snapshotID string
	}{
		{"empty id", ""},
		{"missing file", "no-such-snapshot.zip"},
		{"path traversal", "../other-profile/evil.zip"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := svc.Restore(profileID, tc.snapshotID); err == nil {
				t.Errorf("Restore(%q) expected error, got nil", tc.snapshotID)
			}
		})
	}
}

func TestRestoreZipSlipGuard(t *testing.T) {
	base := t.TempDir()
	svc := saves.New(base)
	profileID := "zipslip-profile"

	if _, err := svc.EnsureProfileSaveDir(profileID); err != nil {
		t.Fatalf("EnsureProfileSaveDir failed: %v", err)
	}
	if _, err := svc.Snapshot(profileID, "seed"); err != nil {
		t.Fatalf("Snapshot failed: %v", err)
	}
	// Write a malicious archive containing an escape entry into the snapshots dir.
	snapDir := filepath.Join(base, "snapshots", profileID)
	malicious := filepath.Join(snapDir, "evil.zip")
	f, err := os.Create(malicious)
	if err != nil {
		t.Fatalf("Create malicious zip failed: %v", err)
	}
	zw := zip.NewWriter(f)
	w, err := zw.Create("../../escape.txt")
	if err != nil {
		t.Fatalf("zip Create failed: %v", err)
	}
	if _, err := w.Write([]byte("escaped")); err != nil {
		t.Fatalf("zip Write failed: %v", err)
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("zip Close failed: %v", err)
	}
	if err := f.Close(); err != nil {
		t.Fatalf("file Close failed: %v", err)
	}

	if err := svc.Restore(profileID, "evil.zip"); err == nil {
		t.Fatalf("Restore of Zip-Slip archive expected error, got nil")
	}
	if _, err := os.Stat(filepath.Join(base, "escape.txt")); !os.IsNotExist(err) {
		t.Errorf("Zip-Slip entry escaped the save directory")
	}
	if _, err := os.Stat(filepath.Join(base, "snapshots", "escape.txt")); !os.IsNotExist(err) {
		t.Errorf("Zip-Slip entry escaped into snapshots directory")
	}
}
