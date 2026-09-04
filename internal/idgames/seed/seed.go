package seed

import (
	"bytes"
	"compress/gzip"
	_ "embed"
	"fmt"
	"io"
)

//go:embed catalog.json.gz
var CatalogGz []byte

// Entry represents a raw catalog record within the compressed seed.
type Entry struct {
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

// OpenCatalogReader returns a stream reader for the decompressed catalog JSON.
func OpenCatalogReader() (io.ReadCloser, error) {
	if len(CatalogGz) == 0 {
		return io.NopCloser(bytes.NewReader([]byte("[]"))), nil
	}
	gzr, err := gzip.NewReader(bytes.NewReader(CatalogGz))
	if err != nil {
		return nil, fmt.Errorf("opening embedded catalog gzip: %w", err)
	}
	return gzr, nil
}
