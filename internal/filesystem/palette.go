package filesystem

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
)

// DefaultDoomPalette provides the authentic fallback 256-color Doom PLAYPAL RGB palette.
var DefaultDoomPalette = [256][3]byte{
	{0, 0, 0}, {31, 23, 11}, {23, 15, 7}, {15, 7, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0},
	{11, 7, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0},
	{31, 31, 31}, {23, 23, 23}, {15, 15, 15}, {7, 7, 7}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0},
	{0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0},
	{47, 47, 47}, {39, 39, 39}, {31, 31, 31}, {23, 23, 23}, {15, 15, 15}, {7, 7, 7}, {0, 0, 0}, {0, 0, 0},
	{79, 79, 79}, {71, 71, 71}, {63, 63, 63}, {55, 55, 55}, {47, 47, 47}, {39, 39, 39}, {31, 31, 31}, {23, 23, 23},
	{111, 111, 111}, {103, 103, 103}, {95, 95, 95}, {87, 87, 87}, {79, 79, 79}, {71, 71, 71}, {63, 63, 63}, {55, 55, 55},
	{143, 143, 143}, {135, 135, 135}, {127, 127, 127}, {119, 119, 119}, {111, 111, 111}, {103, 103, 103}, {95, 95, 95}, {87, 87, 87},
	{175, 175, 175}, {167, 167, 167}, {159, 159, 159}, {151, 151, 151}, {143, 143, 143}, {135, 135, 135}, {127, 127, 127}, {119, 119, 119},
	{207, 207, 207}, {199, 199, 199}, {191, 191, 191}, {183, 183, 183}, {175, 175, 175}, {167, 167, 167}, {159, 159, 159}, {151, 151, 151},
	{239, 239, 239}, {231, 231, 231}, {223, 223, 223}, {215, 215, 215}, {207, 207, 207}, {199, 199, 199}, {191, 191, 191}, {183, 183, 183},
	{255, 255, 255}, {247, 247, 247}, {239, 239, 239}, {231, 231, 231}, {223, 223, 223}, {215, 215, 215}, {207, 207, 207}, {199, 199, 199},
	{107, 7, 0}, {95, 7, 0}, {83, 7, 0}, {71, 0, 0}, {59, 0, 0}, {47, 0, 0}, {35, 0, 0}, {23, 0, 0},
	{155, 23, 0}, {143, 15, 0}, {131, 11, 0}, {119, 7, 0}, {107, 7, 0}, {95, 7, 0}, {83, 7, 0}, {71, 0, 0},
	{203, 51, 15}, {191, 43, 11}, {179, 35, 7}, {167, 27, 0}, {155, 23, 0}, {143, 15, 0}, {131, 11, 0}, {119, 7, 0},
	{251, 87, 39}, {239, 75, 31}, {227, 67, 23}, {215, 59, 19}, {203, 51, 15}, {191, 43, 11}, {179, 35, 7}, {167, 27, 0},
	{119, 119, 0}, {107, 107, 0}, {95, 95, 0}, {83, 83, 0}, {71, 71, 0}, {59, 59, 0}, {47, 47, 0}, {35, 35, 0},
	{167, 167, 0}, {155, 155, 0}, {143, 143, 0}, {131, 131, 0}, {119, 119, 0}, {107, 107, 0}, {95, 95, 0}, {83, 83, 0},
	{215, 215, 0}, {203, 203, 0}, {191, 191, 0}, {179, 179, 0}, {167, 167, 0}, {155, 155, 0}, {143, 143, 0}, {131, 131, 0},
	{255, 255, 71}, {247, 247, 47}, {239, 239, 23}, {227, 227, 7}, {215, 215, 0}, {203, 203, 0}, {191, 191, 0}, {179, 179, 0},
	{0, 107, 0}, {0, 95, 0}, {0, 83, 0}, {0, 71, 0}, {0, 59, 0}, {0, 47, 0}, {0, 35, 0}, {0, 23, 0},
	{0, 155, 0}, {0, 143, 0}, {0, 131, 0}, {0, 119, 0}, {0, 107, 0}, {0, 95, 0}, {0, 83, 0}, {0, 71, 0},
	{15, 203, 15}, {11, 191, 11}, {7, 179, 7}, {0, 167, 0}, {0, 155, 0}, {0, 143, 0}, {0, 131, 0}, {0, 119, 0},
	{47, 251, 47}, {35, 239, 35}, {27, 227, 27}, {19, 215, 19}, {15, 203, 15}, {11, 191, 11}, {7, 179, 7}, {0, 167, 0},
	{0, 0, 107}, {0, 0, 95}, {0, 0, 83}, {0, 0, 71}, {0, 0, 59}, {0, 0, 47}, {0, 0, 35}, {0, 0, 23},
	{0, 0, 155}, {0, 0, 143}, {0, 0, 131}, {0, 0, 119}, {0, 0, 107}, {0, 0, 95}, {0, 0, 83}, {0, 0, 71},
	{15, 15, 203}, {11, 11, 191}, {7, 7, 179}, {0, 0, 167}, {0, 0, 155}, {0, 0, 143}, {0, 0, 131}, {0, 0, 119},
	{47, 47, 251}, {35, 35, 239}, {27, 27, 227}, {19, 19, 215}, {15, 15, 203}, {11, 11, 191}, {7, 7, 179}, {0, 0, 167},
	{111, 55, 15}, {99, 47, 11}, {87, 39, 7}, {75, 31, 0}, {63, 23, 0}, {51, 15, 0}, {39, 7, 0}, {27, 0, 0},
	{159, 95, 39}, {147, 83, 31}, {135, 71, 23}, {123, 63, 19}, {111, 55, 15}, {99, 47, 11}, {87, 39, 7}, {75, 31, 0},
	{207, 143, 71}, {195, 131, 59}, {183, 119, 51}, {171, 107, 43}, {159, 95, 39}, {147, 83, 31}, {135, 71, 23}, {123, 63, 19},
	{255, 199, 119}, {243, 183, 103}, {231, 167, 91}, {219, 155, 79}, {207, 143, 71}, {195, 131, 59}, {183, 119, 51}, {171, 107, 43},
}

// ExtractPLAYPAL reads a 256-color palette from a PLAYPAL lump offset in a WAD file.
func ExtractPLAYPAL(r io.ReaderAt, lumpOffset int64) ([256][3]byte, error) {
	var pal [256][3]byte
	var buf [768]byte

	n, err := r.ReadAt(buf[:], lumpOffset)
	if err != nil && err != io.EOF {
		return DefaultDoomPalette, err
	}
	if n < 768 {
		return DefaultDoomPalette, errors.New("PLAYPAL lump too short (expected at least 768 bytes)")
	}

	for i := 0; i < 256; i++ {
		pal[i][0] = buf[i*3]
		pal[i][1] = buf[i*3+1]
		pal[i][2] = buf[i*3+2]
	}

	return pal, nil
}

// DecodeDoomPicture decodes a standard Doom patch/picture format lump into an *image.RGBA.
func DecodeDoomPicture(data []byte, palette [256][3]byte) (*image.RGBA, error) {
	if len(data) < 8 {
		return nil, errors.New("data too short for Doom picture header")
	}

	width := int(binary.LittleEndian.Uint16(data[0:2]))
	height := int(binary.LittleEndian.Uint16(data[2:4]))

	if width <= 0 || height <= 0 || width > 4096 || height > 4096 {
		return nil, fmt.Errorf("invalid picture dimensions: %dx%d", width, height)
	}

	if len(data) < 8+width*4 {
		return nil, errors.New("data too short for column pointers")
	}

	img := image.NewRGBA(image.Rect(0, 0, width, height))

	for x := 0; x < width; x++ {
		colOfs := int(binary.LittleEndian.Uint32(data[8+x*4 : 12+x*4]))
		if colOfs < 0 || colOfs >= len(data) {
			continue
		}

		offset := colOfs
		for offset < len(data) {
			topDelta := int(data[offset])
			if topDelta == 0xFF {
				break
			}
			offset++
			if offset >= len(data) {
				break
			}
			length := int(data[offset])
			offset++
			if offset >= len(data) {
				break
			}
			// dummy padding byte
			offset++

			for j := 0; j < length; j++ {
				if offset >= len(data) {
					break
				}
				colorIdx := data[offset]
				offset++
				y := topDelta + j
				if y >= 0 && y < height {
					rgb := palette[colorIdx]
					img.SetRGBA(x, y, color.RGBA{R: rgb[0], G: rgb[1], B: rgb[2], A: 255})
				}
			}
			// trailing dummy padding byte
			offset++
		}
	}

	return img, nil
}

// EncodePNG converts an RGBA image to PNG byte format.
func EncodePNG(img *image.RGBA) ([]byte, error) {
	if img == nil {
		return nil, errors.New("cannot encode nil image")
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, fmt.Errorf("failed to encode PNG: %w", err)
	}
	return buf.Bytes(), nil
}
