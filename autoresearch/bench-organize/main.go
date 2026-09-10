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

	// Rescan with the same service: warm decision cache, so this measures
	// incremental verification (walks plus fingerprint compares) with
	// identical required results.
	t4 := time.Now()
	rescanRes, err := svc.ScanDirectories(context.Background(),
		[]string{filepath.Join(lib, "mods"), filepath.Join(lib, "wads")},
		[]string{filepath.Join(lib, "iwads")},
		[]string{filepath.Join(lib, "engines")},
		nil)
	if err != nil {
		return err
	}
	rescanDur := time.Since(t4)
	rescanned := rescanRes.DiscoveredMods + rescanRes.DiscoveredIWADs + rescanRes.DiscoveredEngines
	if rescanned != scanned {
		return fmt.Errorf("rescan discovered %d, want %d", rescanned, scanned)
	}

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
	fmt.Printf("METRIC rescan_ms=%.3f\n", float64(rescanDur.Microseconds())/1000.0)
	fmt.Printf("METRIC rescan_errors=%d\n", len(rescanRes.Errors))
	fmt.Printf("METRIC rescanned=%d\n", rescanned)
	return nil
}


func makeFixture(rng *rand.Rand, i int) (string, []byte) {
	switch i % 5 {
	case 0:
		if i%10 == 0 {
			// Megawad: 32 maps plus markers (map detection at scale).
			lumps := make([]string, 0, 38)
			for m := 1; m <= 32; m++ {
				lumps = append(lumps, fmt.Sprintf("MAP%02d", m))
			}
			lumps = append(lumps, "DECORATE", "TEXTURE1", "PNAMES", "SNDINFO", "PLAYPAL", "COLORMAP")
			return fmt.Sprintf("map_%03d.wad", i), buildWad(rng, "PWAD", lumps, 256)
		}
		return fmt.Sprintf("map_%03d.wad", i), buildWad(rng, "PWAD", []string{"MAP01", "MAP02", "DECORATE", "TEXTURE1", "PNAMES", "PLAYPAL"}, 512)
	case 1:
		if i == 1 {
			return "doom2.wad", buildWad(rng, "IWAD", []string{"MAP01", "MAP02", "E1M1", "PLAYPAL", "COLORMAP", "TEXTURE1", "TEXTURE2", "PNAMES", "DECORATE", "DEMO1"}, 512)
		}
		return fmt.Sprintf("pwad_%03d.wad", i), buildWad(rng, "PWAD", []string{"E1M1", "THINGS", "LINEDEFS", "SIDEDEFS", "VERTEXES", "SECTORS", "REJECT", "BLOCKMAP"}, 256)
	case 2:
		return fmt.Sprintf("mod_%03d.pk3", i), buildModPK3(rng, i, 100+i%101)
	case 3:
		head := fmt.Sprintf("Patch File\nDoom version = 19\nThing %d (TROOPER)\nHit points = %d\n", i, 20+rng.IntN(100))
		body := append([]byte(head), fillRandom(rng, 1024+rng.IntN(4096))...)
		return fmt.Sprintf("patch_%03d.deh", i), body
	default:
		if i%10 == 9 {
			return fmt.Sprintf("gzdoom_port_%03d.zip", i), buildZip(map[string][]byte{
				"gzdoom.exe": fillRandom(rng, 20480+rng.IntN(20480)),
			})
		}
		return fmt.Sprintf("tex_%03d.pk3", i), buildModPK3(rng, i+1000, 120+i%81)
	}
}

// fillRandom returns n deterministic incompressible bytes.
func fillRandom(rng *rand.Rand, n int) []byte {
	b := make([]byte, n)
	for i := 0; i+8 <= n; i += 8 {
		v := rng.Uint64()
		b[i] = byte(v)
		b[i+1] = byte(v >> 8)
		b[i+2] = byte(v >> 16)
		b[i+3] = byte(v >> 24)
		b[i+4] = byte(v >> 32)
		b[i+5] = byte(v >> 40)
		b[i+6] = byte(v >> 48)
		b[i+7] = byte(v >> 56)
	}
	for i := n - n%8; i < n; i++ {
		b[i] = byte(rng.Uint64())
	}
	return b
}

// buildWad assembles a VALID wad: header, lump bodies, then a directory with
// real offsets, so inspection parses lumps instead of erroring.
func buildWad(rng *rand.Rand, magic string, lumps []string, bodySize int) []byte {
	n := uint32(len(lumps))
	dataSize := uint32(len(lumps)) * uint32(bodySize)
	infoTableOfs := uint32(12) + dataSize
	buf := new(bytes.Buffer)
	buf.WriteString(magic)
	buf.Write([]byte{byte(n), byte(n >> 8), byte(n >> 16), byte(n >> 24)})
	buf.Write([]byte{byte(infoTableOfs), byte(infoTableOfs >> 8), byte(infoTableOfs >> 16), byte(infoTableOfs >> 24)})
	for range lumps {
		buf.Write(fillRandom(rng, bodySize))
	}
	for k, l := range lumps {
		pos := uint32(12) + uint32(k)*uint32(bodySize)
		sz := uint32(bodySize)
		buf.Write([]byte{byte(pos), byte(pos >> 8), byte(pos >> 16), byte(pos >> 24)})
		buf.Write([]byte{byte(sz), byte(sz >> 8), byte(sz >> 16), byte(sz >> 24)})
		name := make([]byte, 8)
		copy(name, l)
		buf.Write(name)
	}
	return buf.Bytes()
}

// buildModPK3 assembles a realistic gameplay archive: script/mapinfo markers,
// map entries, and sprite/sound/texture directory trees.
func buildModPK3(rng *rand.Rand, seed, count int) []byte {
	files := make(map[string][]byte, count+8)
	files["ZSCRIPT"] = append([]byte("// zscript version \"4.10\"\n"), fillRandom(rng, 512+rng.IntN(1536))...)
	files["MAPINFO"] = append([]byte("map MAP01 \"Entry\"\n"), fillRandom(rng, 256+rng.IntN(768))...)
	files["DECORATE"] = append([]byte("actor Custom {}"), fillRandom(rng, 256+rng.IntN(768))...)
	files["SNDINFO"] = append([]byte("misc/chat chat\n"), fillRandom(rng, 128+rng.IntN(384))...)
	files["TEXTURES"] = append([]byte("texture BRICK\n"), fillRandom(rng, 256+rng.IntN(1024))...)
	maps := 2 + seed%4
	for m := 0; m < maps; m++ {
		files[fmt.Sprintf("maps/MAP%02d.wad", (seed+m)%32+1)] = fillRandom(rng, 1024+rng.IntN(3072))
	}
	rest := count - len(files)
	for k := 0; k < rest; k++ {
		var name string
		size := 256 + rng.IntN(768)
		switch k % 4 {
		case 0:
			name = fmt.Sprintf("sprites/SPR%04d.png", seed*1000+k)
		case 1:
			name = fmt.Sprintf("sounds/SND%04d.wav", seed*1000+k)
		case 2:
			name = fmt.Sprintf("textures/TEX%04d.png", seed*1000+k)
		default:
			name = fmt.Sprintf("music/MUS%04d.ogg", seed*1000+k)
		}
		files[name] = fillRandom(rng, size)
	}
	return buildZip(files)
}

func buildZip(files map[string][]byte) []byte {
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)
	for name, data := range files {
		// Store uncompressed: deterministic, fast to generate, and the full
		// byte volume exercises hashing realistically.
		h := &zip.FileHeader{Name: name, Method: zip.Store}
		f, _ := w.CreateHeader(h)
		f.Write(data)
	}
	w.Close()
	return buf.Bytes()
}

func buildEngineZip() []byte {
	return buildZip(map[string][]byte{
		"gzdoom.exe":     bytes.Repeat([]byte{0x4D}, 8192),
		"gzdoom.pk3":     []byte("engine assets"),
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
