package filesystem_test

import (
	"archive/zip"
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"os"
	"path/filepath"
	"testing"

	"rnt-launcher/internal/filesystem"
)

// helper to build a synthetic Doom picture lump (patch format)
func buildSyntheticDoomPicture(width, height int, colorIdx byte) []byte {
	buf := new(bytes.Buffer)

	// 1. Header (8 bytes)
	_ = binary.Write(buf, binary.LittleEndian, uint16(width))
	_ = binary.Write(buf, binary.LittleEndian, uint16(height))
	_ = binary.Write(buf, binary.LittleEndian, int16(0)) // leftOffset
	_ = binary.Write(buf, binary.LittleEndian, int16(0)) // topOffset

	// 2. Column pointers (width * 4 bytes)
	colOffsetsPos := buf.Len()
	for i := 0; i < width; i++ {
		_ = binary.Write(buf, binary.LittleEndian, uint32(0)) // placeholder
	}

	colOffsets := make([]uint32, width)
	// 3. Post data for each column
	for x := 0; x < width; x++ {
		colOffsets[x] = uint32(buf.Len())

		// Single post: topDelta = 0, length = height, dummy = 0, pixels..., dummy = 0, stop = 0xFF
		buf.WriteByte(0)              // topDelta
		buf.WriteByte(byte(height))   // length
		buf.WriteByte(0)              // dummy
		for y := 0; y < height; y++ { // pixels
			buf.WriteByte(colorIdx)
		}
		buf.WriteByte(0)    // dummy
		buf.WriteByte(0xFF) // column terminator
	}

	data := buf.Bytes()
	// Patch column offsets in header
	for x := 0; x < width; x++ {
		binary.LittleEndian.PutUint32(data[colOffsetsPos+x*4:colOffsetsPos+x*4+4], colOffsets[x])
	}

	return data
}

func TestDoomPaletteAndPictureDecoding(t *testing.T) {
	t.Run("DefaultDoomPalette", func(t *testing.T) {
		if len(filesystem.DefaultDoomPalette) != 256 {
			t.Fatalf("expected 256 palette entries, got %d", len(filesystem.DefaultDoomPalette))
		}
	})

	t.Run("DecodeDoomPicture and EncodePNG", func(t *testing.T) {
		picData := buildSyntheticDoomPicture(8, 8, 16) // gray color
		img, err := filesystem.DecodeDoomPicture(picData, filesystem.DefaultDoomPalette)
		if err != nil {
			t.Fatalf("DecodeDoomPicture failed: %v", err)
		}
		if img.Bounds().Dx() != 8 || img.Bounds().Dy() != 8 {
			t.Fatalf("expected 8x8 image, got %dx%d", img.Bounds().Dx(), img.Bounds().Dy())
		}

		pngBytes, err := filesystem.EncodePNG(img)
		if err != nil {
			t.Fatalf("EncodePNG failed: %v", err)
		}
		if len(pngBytes) < 8 || !bytes.Equal(pngBytes[:8], []byte("\x89PNG\r\n\x1a\n")) {
			t.Fatal("expected valid PNG signature")
		}
	})

	t.Run("ExtractPLAYPAL custom lump", func(t *testing.T) {
		var rawPal [768]byte
		for i := 0; i < 768; i++ {
			rawPal[i] = byte(i % 256)
		}
		reader := bytes.NewReader(rawPal[:])
		pal, err := filesystem.ExtractPLAYPAL(reader, 0)
		if err != nil {
			t.Fatalf("ExtractPLAYPAL failed: %v", err)
		}
		if pal[0][0] != 0 || pal[0][1] != 1 || pal[0][2] != 2 {
			t.Errorf("unexpected palette RGB: %+v", pal[0])
		}
	})
}

func TestExtractArtwork(t *testing.T) {
	tempDir := t.TempDir()

	t.Run("Extract TITLEPIC from WAD", func(t *testing.T) {
		// Build synthetic WAD containing TITLEPIC lump
		picData := buildSyntheticDoomPicture(16, 16, 32)

		wadBuf := new(bytes.Buffer)
		wadBuf.WriteString("PWAD")
		_ = binary.Write(wadBuf, binary.LittleEndian, uint32(1))  // 1 lump
		_ = binary.Write(wadBuf, binary.LittleEndian, uint32(12)) // dir offset at 12

		// Directory entry: filepos, size, lumpname
		lumpOffset := uint32(12 + 16)
		lumpSize := uint32(len(picData))
		_ = binary.Write(wadBuf, binary.LittleEndian, lumpOffset)
		_ = binary.Write(wadBuf, binary.LittleEndian, lumpSize)
		var name [8]byte
		copy(name[:], []byte("TITLEPIC"))
		wadBuf.Write(name[:])

		// Append lump data
		wadBuf.Write(picData)

		wadPath := filepath.Join(tempDir, "titlepic_test.wad")
		if err := os.WriteFile(wadPath, wadBuf.Bytes(), 0644); err != nil {
			t.Fatalf("failed to write wad: %v", err)
		}

		pngBytes, lumpName, err := filesystem.ExtractArtwork(wadPath)
		if err != nil {
			t.Fatalf("ExtractArtwork failed: %v", err)
		}
		if lumpName != "TITLEPIC" {
			t.Errorf("expected lumpName TITLEPIC, got %s", lumpName)
		}
		if len(pngBytes) == 0 || !bytes.Equal(pngBytes[:8], []byte("\x89PNG\r\n\x1a\n")) {
			t.Fatal("expected valid PNG output")
		}
	})

	t.Run("Extract titlepic.png from PK3", func(t *testing.T) {
		// Create a small PNG in memory
		img := image.NewRGBA(image.Rect(0, 0, 4, 4))
		img.Set(0, 0, color.RGBA{R: 255, G: 0, B: 0, A: 255})
		pngBytes, _ := filesystem.EncodePNG(img)

		pk3Buf := new(bytes.Buffer)
		zw := zip.NewWriter(pk3Buf)
		w, _ := zw.Create("graphics/titlepic.png")
		_, _ = w.Write(pngBytes)
		_ = zw.Close()

		pk3Path := filepath.Join(tempDir, "mod_with_art.pk3")
		if err := os.WriteFile(pk3Path, pk3Buf.Bytes(), 0644); err != nil {
			t.Fatalf("failed to write pk3: %v", err)
		}

		extracted, lumpName, err := filesystem.ExtractArtwork(pk3Path)
		if err != nil {
			t.Fatalf("ExtractArtwork on PK3 failed: %v", err)
		}
		if lumpName != "TITLEPIC" {
			t.Errorf("expected TITLEPIC, got %s", lumpName)
		}
		if !bytes.Equal(extracted, pngBytes) {
			t.Error("extracted PNG does not match original bytes")
		}
	})
}
