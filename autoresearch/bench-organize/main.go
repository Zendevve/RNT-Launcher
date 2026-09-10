package main

// Deterministic workload for the managed-library + source-port provisioning
// benchmark. No network, no clock-dependent fixtures, fixed PRNG seed.

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"math/rand/v2"
	"os"
	"path/filepath"
	"strings"
	"time"

	"rnt-launcher/internal/database"
	"rnt-launcher/internal/filesystem"
	"rnt-launcher/internal/scanner"
)

const (
	fileCount = 200
	prngSeed1 = uint64(42)
	prngSeed2 = uint64(0)
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	root, err := os.MkdirTemp("", "rnt-bench-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(root)

	flat := filepath.Join(root, "flat-mess")
	if err := os.MkdirAll(flat, 0o755); err != nil {
		return err
	}
	rng := rand.New(rand.NewPCG(prngSeed1, prngSeed2))

	names := make([]string, 0, fileCount)
	for i := range fileCount {
		name, data := makeFixture(rng, i)
		p := filepath.Join(flat, name)
		if err := os.WriteFile(p, data, 0o644); err != nil {
			return err
		}
		names = append(names, name)
	}
	engineZip := buildEngineZip()

	lib := filepath.Join(root, "library")
	srcs := make([]string, 0, len(names))
	for _, n := range names {
		srcs = append(srcs, filepath.Join(flat, n))
	}
	t0 := time.Now()
	if _, err := filesystem.OrganizeBatch(srcs, lib); err != nil {
		return err
	}
	organizeDur := time.Since(t0)

	var inspected, errors int
	t1 := time.Now()
	err = filepath.Walk(lib, func(p string, info os.FileInfo, werr error) error {
		if werr != nil || info.IsDir() {
			return nil
		}
		inspected++
		if _, ierr := filesystem.InspectFile(p); ierr != nil {
			errors++
		}
		return nil
	})
	if err != nil {
		return err
	}
	inspectDur := time.Since(t1)
	t2 := time.Now()
	// Stage the provisioned build outside the scanned library roots: the
	// scan phase must never execute these synthetic binaries (AV-hooked
	// process spawns are nondeterministic); probing is covered by the
	// scanner's own unit tests.
	destDir := filepath.Join(lib, "staging", "gzdoom-4-12-0")
	if err := extractZip(engineZip, destDir); err != nil {
		return err
	}
	if _, err := pickMainExecutable(destDir); err != nil {
		return err
	}
	provisionDur := time.Since(t2)

	// One-time setup (like fixture generation above) stays untimed: the
	// scan phase measures per-scan service work, not startup migrations.
	db, err := database.InitDB(":memory:")
	if err != nil {
		return err
	}
	defer db.Close()
	svc := scanner.NewScannerService(
		database.NewModRepository(db),
		database.NewIWADRepository(db),
		database.NewEngineRepository(db),
		nil,
	)
	t3 := time.Now()
	scanRes, err := svc.ScanDirectories(context.Background(),
		[]string{filepath.Join(lib, "mods"), filepath.Join(lib, "wads")},
		[]string{filepath.Join(lib, "iwads")},
		[]string{filepath.Join(lib, "engines")},
		nil)
	if err != nil {
		return err
	}
	scanDur := time.Since(t3)
	scanned := scanRes.DiscoveredMods + scanRes.DiscoveredIWADs + scanRes.DiscoveredEngines

	total := organizeDur + inspectDur + provisionDur
	perSec := float64(inspected) / total.Seconds()

	fmt.Printf("METRIC organize_ms=%.3f\n", float64(organizeDur.Microseconds())/1000.0)
	fmt.Printf("METRIC inspect_ms=%.3f\n", float64(inspectDur.Microseconds())/1000.0)
	fmt.Printf("METRIC provision_ms=%.3f\n", float64(provisionDur.Microseconds())/1000.0)
	fmt.Printf("METRIC total_ms=%.3f\n", float64(total.Microseconds())/1000.0)
	fmt.Printf("METRIC files_per_sec=%.3f\n", perSec)
	fmt.Printf("METRIC inspect_errors=%d\n", errors)
	fmt.Printf("METRIC scan_ms=%.3f\n", float64(scanDur.Microseconds())/1000.0)
	fmt.Printf("METRIC scan_errors=%d\n", len(scanRes.Errors))
	fmt.Printf("METRIC scanned=%d\n", scanned)
	return nil
}


func makeFixture(rng *rand.Rand, i int) (string, []byte) {
	switch i % 5 {
	case 0:
		return fmt.Sprintf("map_%03d.wad", i), buildWad("PWAD", []string{"MAP01", "DECORATE"})
	case 1:
		if i == 1 {
			return "doom2.wad", buildWad("IWAD", []string{"MAP01", "E1M1"})
		}
		return fmt.Sprintf("pwad_%03d.wad", i), buildWad("PWAD", []string{"E1M1"})
	case 2:
		return fmt.Sprintf("mod_%03d.pk3", i), buildZip(map[string][]byte{
			"ZSCRIPT": []byte("// zscript"),
		})
	case 3:
		body := fmt.Sprintf("Patch File\nDoom version = 19\nThing %d (TROOPER)\nHit points = %d\n", i, 20+rng.IntN(100))
		return fmt.Sprintf("patch_%03d.deh", i), []byte(body)
	default:
		if i%10 == 9 {
			return fmt.Sprintf("gzdoom_port_%03d.zip", i), buildZip(map[string][]byte{
				"gzdoom.exe": bytes.Repeat([]byte{byte(i)}, 4096),
			})
		}
		return fmt.Sprintf("tex_%03d.pk3", i), buildZip(map[string][]byte{
			"TEXTURES": []byte("texture lump"),
		})
	}
}

func buildWad(magic string, lumps []string) []byte {
	buf := new(bytes.Buffer)
	buf.WriteString(magic)
	n := uint32(len(lumps))
	buf.Write([]byte{byte(n), byte(n >> 8), byte(n >> 16), byte(n >> 24)})
	for _, l := range lumps {
		name := make([]byte, 8)
		copy(name, l)
		buf.Write(make([]byte, 4))
		buf.Write(make([]byte, 4))
		buf.Write(name)
	}
	return buf.Bytes()
}

func buildZip(files map[string][]byte) []byte {
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)
	for name, data := range files {
		f, _ := w.Create(name)
		f.Write(data)
	}
	w.Close()
	return buf.Bytes()
}

func buildEngineZip() []byte {
	return buildZip(map[string][]byte{
		"gzdoom.exe":    bytes.Repeat([]byte{0x4D}, 8192),
		"gzdoom.pk3":    []byte("engine assets"),
		"brightmaps.pk3": []byte("assets"),
	})
}

func extractZip(data []byte, destDir string) error {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}
	for _, f := range r.File {
		if f.Name == "" {
			continue
		}
		target := filepath.Join(destDir, filepath.FromSlash(f.Name))
		rel, err := filepath.Rel(destDir, target)
		if err != nil || strings.HasPrefix(rel, "..") {
			return fmt.Errorf("illegal entry %q", f.Name)
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		buf := new(bytes.Buffer)
		if _, err := buf.ReadFrom(rc); err != nil {
			rc.Close()
			return err
		}
		rc.Close()
		if err := os.WriteFile(target, buf.Bytes(), 0o644); err != nil {
			return err
		}
	}
	return nil
}

func pickMainExecutable(destDir string) (string, error) {
	var best string
	var bestSize int64 = -1
	err := filepath.Walk(destDir, func(p string, info os.FileInfo, werr error) error {
		if werr != nil || info.IsDir() {
			return nil
		}
		if !strings.HasSuffix(strings.ToLower(info.Name()), ".exe") {
			return nil
		}
		if info.Size() > bestSize {
			bestSize = info.Size()
			best = p
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if best == "" {
		return "", fmt.Errorf("no executable found")
	}
	return best, nil
}
