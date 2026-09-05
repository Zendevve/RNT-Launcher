package idgames

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// IdgamesFile represents a file record returned by the Doomworld /idgames archive API.
type IdgamesFile struct {
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
	URL         string  `json:"url"`
}

// DefaultMirrors contains the standard fallback mirrors for downloading idgames files.
var DefaultMirrors = []string{
	"https://www.gamers.org/pub/idgames/",
	"https://youfailit.net/pub/idgames/",
	"https://api.slade.mancubus.net/idgames/",
	"http://ftp.sunet.se/pub/games/PC/idgames/",
	"https://ftp.mancubus.net/pub/idgames/",
}

// DefaultBaseURL is the official Doomworld idgames API endpoint.
const DefaultBaseURL = "https://www.doomworld.com/idgames/api/api.php"

// IdgamesClient manages queries and downloads from the Doomworld /idgames archive.
type IdgamesClient struct {
	BaseURL    string
	Mirrors    []string
	HTTPClient *http.Client
}

// ClientOption configures an IdgamesClient.
type ClientOption func(*IdgamesClient)

// WithBaseURL overrides the default API base URL.
func WithBaseURL(baseURL string) ClientOption {
	return func(c *IdgamesClient) {
		c.BaseURL = baseURL
	}
}

// WithMirrors overrides the download mirror list.
func WithMirrors(mirrors []string) ClientOption {
	return func(c *IdgamesClient) {
		c.Mirrors = mirrors
	}
}

// WithHTTPClient configures a custom HTTP client.
func WithHTTPClient(httpClient *http.Client) ClientOption {
	return func(c *IdgamesClient) {
		c.HTTPClient = httpClient
	}
}

// NewClient creates a new configured IdgamesClient instance.
func NewClient(opts ...ClientOption) *IdgamesClient {
	c := &IdgamesClient{
		BaseURL: DefaultBaseURL,
		Mirrors: make([]string, len(DefaultMirrors)),
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
	copy(c.Mirrors, DefaultMirrors)

	for _, opt := range opts {
		opt(c)
	}

	return c
}

// Raw JSON response structures from the idgames API
type rawSearchResponse struct {
	Content *rawContent  `json:"content"`
	Error   *rawAPIError `json:"error"`
	Warning *rawAPIError `json:"warning"`
}

type rawContent struct {
	File  json.RawMessage `json:"file"`
	Error *rawAPIError    `json:"error"`
}

type rawAPIError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

type rawIdgamesFile struct {
	ID          any `json:"id"`
	Title       any `json:"title"`
	Dir         any `json:"dir"`
	Filename    any `json:"filename"`
	Size        any `json:"size"`
	Age         any `json:"age"`
	Date        any `json:"date"`
	Author      any `json:"author"`
	Description any `json:"description"`
	Rating      any `json:"rating"`
	Votes       any `json:"votes"`
	URL         any `json:"url"`
}

// Search queries the /idgames API for mod archives matching the query string.
func (c *IdgamesClient) Search(ctx context.Context, query string) ([]IdgamesFile, error) {
	trimmedQuery := strings.TrimSpace(query)
	if trimmedQuery == "" {
		return []IdgamesFile{}, nil
	}

	reqURL, err := url.Parse(c.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid base URL %q: %w", c.BaseURL, err)
	}

	q := reqURL.Query()
	q.Set("action", "search")
	q.Set("query", trimmedQuery)
	q.Set("out", "json")
	reqURL.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create search request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 RNT-Launcher/1.0")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Referer", "https://www.doomworld.com/idgames/")
	req.Header.Set("Origin", "https://www.doomworld.com")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Pragma", "no-cache")

	client := c.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("idgames search request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		bodyStr := strings.TrimSpace(string(bodyBytes))
		lowerBody := strings.ToLower(bodyStr)
		if resp.StatusCode == http.StatusForbidden || strings.Contains(lowerBody, "cloudflare") || strings.Contains(lowerBody, "just a moment") || strings.Contains(lowerBody, "attention required") {
			return nil, fmt.Errorf("idgames archive is temporarily shielded by Cloudflare protection (HTTP %d). The archive blocks automated requests at the moment. Please try again in a few minutes", resp.StatusCode)
		}
		if strings.Contains(bodyStr, "<!DOCTYPE") || strings.Contains(bodyStr, "<html") {
			return nil, fmt.Errorf("idgames archive is temporarily unavailable (HTTP %d). Please try again shortly", resp.StatusCode)
		}
		if len(bodyStr) > 400 {
			bodyStr = bodyStr[:400] + "..."
		}
		return nil, fmt.Errorf("idgames search returned HTTP %d: %s", resp.StatusCode, bodyStr)
	}
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read idgames search response: %w", err)
	}

	return parseSearchResponse(bodyBytes)
}

func parseSearchResponse(data []byte) ([]IdgamesFile, error) {
	var resp rawSearchResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse idgames search response: %w", err)
	}

	// Check top-level error
	if resp.Error != nil && resp.Error.Message != "" {
		if isNoFilesError(resp.Error.Message) || isNoFilesError(resp.Error.Type) {
			return []IdgamesFile{}, nil
		}
		return nil, fmt.Errorf("idgames API error: %s (%s)", resp.Error.Message, resp.Error.Type)
	}

	if resp.Content == nil {
		return []IdgamesFile{}, nil
	}

	// Check content-level error (common in Doomworld idgames API when no files match)
	if resp.Content.Error != nil && resp.Content.Error.Message != "" {
		if isNoFilesError(resp.Content.Error.Message) || isNoFilesError(resp.Content.Error.Type) {
			return []IdgamesFile{}, nil
		}
		return nil, fmt.Errorf("idgames API error: %s (%s)", resp.Content.Error.Message, resp.Content.Error.Type)
	}

	trimmedFile := bytes.TrimSpace(resp.Content.File)
	if len(trimmedFile) == 0 || bytes.Equal(trimmedFile, []byte("null")) {
		return []IdgamesFile{}, nil
	}

	var rawFiles []rawIdgamesFile
	if trimmedFile[0] == '[' {
		if err := json.Unmarshal(trimmedFile, &rawFiles); err != nil {
			return nil, fmt.Errorf("failed to decode idgames files array: %w", err)
		}
	} else if trimmedFile[0] == '{' {
		var single rawIdgamesFile
		if err := json.Unmarshal(trimmedFile, &single); err != nil {
			return nil, fmt.Errorf("failed to decode single idgames file: %w", err)
		}
		rawFiles = append(rawFiles, single)
	} else {
		return []IdgamesFile{}, nil
	}

	results := make([]IdgamesFile, 0, len(rawFiles))
	for _, rf := range rawFiles {
		results = append(results, convertRawFile(rf))
	}

	return results, nil
}

func isNoFilesError(msg string) bool {
	lower := strings.ToLower(msg)
	return strings.Contains(lower, "no file") ||
		strings.Contains(lower, "not found") ||
		strings.Contains(lower, "no result") ||
		strings.Contains(lower, "zero result")
}

func convertRawFile(rf rawIdgamesFile) IdgamesFile {
	f := IdgamesFile{
		ID:          asInt(rf.ID),
		Title:       asString(rf.Title),
		Dir:         asString(rf.Dir),
		Filename:    asString(rf.Filename),
		Size:        asInt64(rf.Size),
		Age:         asInt64(rf.Age),
		Date:        asString(rf.Date),
		Author:      asString(rf.Author),
		Description: asString(rf.Description),
		Rating:      asFloat64(rf.Rating),
		Votes:       asInt(rf.Votes),
		URL:         asString(rf.URL),
	}
	if f.URL == "" && f.Dir != "" && f.Filename != "" {
		cleanDir := strings.Trim(filepath.ToSlash(f.Dir), "/")
		f.URL = fmt.Sprintf("https://www.doomworld.com/idgames/%s/%s", cleanDir, strings.TrimSuffix(f.Filename, filepath.Ext(f.Filename)))
	}
	return f
}

// Download retrieves a zip archive from configured mirrors, saves and safely extracts it into destDir.
// Returns the absolute/clean path to the primary extracted mod file (e.g. .wad, .pk3, .ipk3, .zip).
func (c *IdgamesClient) Download(ctx context.Context, file IdgamesFile, destDir string) (string, error) {
	if strings.TrimSpace(file.Filename) == "" {
		return "", errors.New("cannot download file with empty filename")
	}

	cleanDestDir := filepath.Clean(destDir)
	if err := os.MkdirAll(cleanDestDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create destination directory %s: %w", cleanDestDir, err)
	}

	cleanDir := strings.Trim(filepath.ToSlash(file.Dir), "/")
	if cleanDir != "" {
		cleanDir += "/"
	}

	mirrors := c.Mirrors
	if len(mirrors) == 0 {
		mirrors = DefaultMirrors
	}

	var downloadURLs []string
	for _, mirror := range mirrors {
		trimmedMirror := strings.TrimSuffix(mirror, "/")
		downloadURLs = append(downloadURLs, fmt.Sprintf("%s/%s%s", trimmedMirror, cleanDir, file.Filename))
	}

	client := c.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}

	var (
		resp    *http.Response
		lastErr error
	)

	for _, dURL := range downloadURLs {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		default:
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, dURL, nil)
		if err != nil {
			lastErr = err
			continue
		}
		req.Header.Set("User-Agent", "RNT-Launcher/1.0 (Doom Mod Manager)")

		r, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		if r.StatusCode != http.StatusOK {
			r.Body.Close()
			lastErr = fmt.Errorf("mirror %s returned HTTP %d", dURL, r.StatusCode)
			continue
		}

		resp = r
		break
	}

	if resp == nil {
		return "", fmt.Errorf("failed to download %s from all mirrors (last error: %v)", file.Filename, lastErr)
	}
	defer resp.Body.Close()

	zipPath := filepath.Join(cleanDestDir, file.Filename)
	outZip, err := os.OpenFile(zipPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return "", fmt.Errorf("failed to create output file %s: %w", zipPath, err)
	}

	const maxDownloadSize = 500 * 1024 * 1024 // 500 MB limit
	_, copyErr := io.CopyN(outZip, resp.Body, maxDownloadSize)
	_ = outZip.Close()

	if copyErr != nil && !errors.Is(copyErr, io.EOF) {
		_ = os.Remove(zipPath)
		return "", fmt.Errorf("failed writing downloaded file: %w", copyErr)
	}

	// Safely extract zip archive entries
	extractedFiles, extractErr := extractZipSafely(zipPath, cleanDestDir)
	if extractErr != nil {
		// If extraction failed because it wasn't a zip (e.g. standalone .wad), check if candidate
		ext := strings.ToLower(filepath.Ext(file.Filename))
		if ext == ".wad" || ext == ".pk3" || ext == ".ipk3" || ext == ".pk7" || ext == ".deh" || ext == ".bex" {
			return zipPath, nil
		}
		return "", fmt.Errorf("failed extracting archive %s: %w", file.Filename, extractErr)
	}

	primaryPath := selectPrimaryModFile(extractedFiles, file.Filename, zipPath)
	return primaryPath, nil
}

// extractZipSafely unpacks all entries from zipPath to targetDir with Zip Slip traversal protection.
func extractZipSafely(zipPath, targetDir string) ([]string, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("unable to open zip archive: %w", err)
	}
	defer r.Close()

	var extractedPaths []string
	cleanTargetDir := filepath.Clean(targetDir)

	for _, f := range r.File {
		cleanName := filepath.Clean(f.Name)

		destPath := filepath.Join(cleanTargetDir, cleanName)
		if !strings.HasPrefix(destPath, cleanTargetDir+string(os.PathSeparator)) && destPath != cleanTargetDir {
			return nil, fmt.Errorf("illegal entry path in zip archive: %s", f.Name)
		}

		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(destPath, 0755); err != nil {
				return nil, fmt.Errorf("failed to create directory %s: %w", destPath, err)
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return nil, fmt.Errorf("failed to create parent directory for %s: %w", destPath, err)
		}

		rc, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("failed to open entry %s in zip: %w", f.Name, err)
		}

		outFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			_ = rc.Close()
			return nil, fmt.Errorf("failed to create extracted file %s: %w", destPath, err)
		}

		const maxEntrySize = 1024 * 1024 * 1024 // 1GB entry limit
		_, copyErr := io.CopyN(outFile, rc, maxEntrySize)
		_ = outFile.Close()
		_ = rc.Close()

		if copyErr != nil && !errors.Is(copyErr, io.EOF) {
			return nil, fmt.Errorf("failed decompressing entry %s: %w", f.Name, copyErr)
		}

		extractedPaths = append(extractedPaths, destPath)
	}

	return extractedPaths, nil
}

// selectPrimaryModFile picks the best playable/inspectable mod file from extracted archive entries.
func selectPrimaryModFile(extractedPaths []string, origFilename, zipPath string) string {
	if len(extractedPaths) == 0 {
		return zipPath
	}

	origStem := strings.ToLower(strings.TrimSuffix(filepath.Base(origFilename), filepath.Ext(origFilename)))

	var tier1 []string // .wad, .pk3, .ipk3, .pk7
	var tier2 []string // .deh, .bex
	var tier3 []string // .zip

	for _, p := range extractedPaths {
		ext := strings.ToLower(filepath.Ext(p))
		switch ext {
		case ".wad", ".pk3", ".ipk3", ".pk7":
			tier1 = append(tier1, p)
		case ".deh", ".bex":
			tier2 = append(tier2, p)
		case ".zip":
			tier3 = append(tier3, p)
		}
	}

	// Check if any tier 1 file matches original filename stem
	for _, p := range tier1 {
		pStem := strings.ToLower(strings.TrimSuffix(filepath.Base(p), filepath.Ext(p)))
		if pStem == origStem {
			return p
		}
	}

	if len(tier1) > 0 {
		// Prefer the largest tier1 file if multiple exist
		var best string
		var maxSize int64 = -1
		for _, p := range tier1 {
			if stat, err := os.Stat(p); err == nil && stat.Size() > maxSize {
				maxSize = stat.Size()
				best = p
			}
		}
		if best != "" {
			return best
		}
		return tier1[0]
	}

	if len(tier2) > 0 {
		return tier2[0]
	}
	if len(tier3) > 0 {
		return tier3[0]
	}

	return zipPath
}

// Flexible conversion helpers
func asString(v any) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return strings.TrimSpace(val)
	case fmt.Stringer:
		return strings.TrimSpace(val.String())
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", val))
	}
}

func asInt(v any) int {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case int:
		return val
	case int64:
		return int(val)
	case float64:
		return int(val)
	case string:
		cleaned := strings.TrimSpace(val)
		if n, err := strconv.Atoi(cleaned); err == nil {
			return n
		}
		if f, err := strconv.ParseFloat(cleaned, 64); err == nil {
			return int(f)
		}
		return 0
	case json.Number:
		if n, err := val.Int64(); err == nil {
			return int(n)
		}
		if f, err := val.Float64(); err == nil {
			return int(f)
		}
		return 0
	default:
		return 0
	}
}

func asInt64(v any) int64 {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case int64:
		return val
	case int:
		return int64(val)
	case float64:
		return int64(val)
	case string:
		cleaned := strings.TrimSpace(val)
		if n, err := strconv.ParseInt(cleaned, 10, 64); err == nil {
			return n
		}
		if f, err := strconv.ParseFloat(cleaned, 64); err == nil {
			return int64(f)
		}
		return 0
	case json.Number:
		if n, err := val.Int64(); err == nil {
			return n
		}
		return 0
	default:
		return 0
	}
}

func asFloat64(v any) float64 {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case string:
		cleaned := strings.TrimSpace(val)
		if f, err := strconv.ParseFloat(cleaned, 64); err == nil {
			return f
		}
		return 0
	case json.Number:
		if f, err := val.Float64(); err == nil {
			return f
		}
		return 0
	default:
		return 0
	}
}
