package filesystem

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
)

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
	buf := make([]byte, 64*1024)
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
