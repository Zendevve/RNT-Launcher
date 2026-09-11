package filesystem

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"sync"
)

// shaBufPool recycles the 64KiB copy buffer: every hashed file otherwise
// allocates one just to stream a few kilobytes through the digest.
var shaBufPool = sync.Pool{New: func() any { return make([]byte, 64*1024) }}

// ComputeSHA256 computes the SHA-256 hash of the file at the given path streamingly.
func ComputeSHA256(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	return ComputeSHA256Reader(f)
}

// ComputeSHA256Reader computes the SHA-256 hash of data read from r streamingly.
func ComputeSHA256Reader(r io.Reader) (string, error) {
	hasher := sha256.New()
	buf := shaBufPool.Get().([]byte)
	defer shaBufPool.Put(buf)
	if _, err := io.CopyBuffer(hasher, r, buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// ComputeSHA256Bytes computes the SHA-256 hash of the given byte slice.
func ComputeSHA256Bytes(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
