package idgames

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"rnt-launcher/internal/filesystem"
	"rnt-launcher/internal/domain"
)

// Standard CDN mirrors prioritized by availability and speed.
var DefaultCDNMirrors = []string{
	"https://youfailit.net/pub/idgames/",
	"https://www.gamers.org/pub/idgames/",
	"https://api.slade.mancubus.net/idgames/",
	"https://ftp.mancubus.net/pub/idgames/",
}

// DownloadProgress represents an event emitted during an archive download lifecycle.
type DownloadProgress struct {
	ArchiveID  int     `json:"archive_id"`
	Filename   string  `json:"filename"`
	BytesRead  int64   `json:"bytes_read"`
	TotalBytes int64   `json:"total_bytes"`
	Percent    float64 `json:"percent"`
	MirrorURL  string  `json:"mirror_url"`
	Status     string  `json:"status"` // "connecting", "downloading", "extracting", "inspecting", "completed", "failed"
	Error      string  `json:"error,omitempty"`
}

// ProgressCallback is invoked as progress changes during download and extraction.
type ProgressCallback func(p DownloadProgress)

// Downloader manages resilient sequential CDN downloads and archive extraction.
type Downloader struct {
	mirrors        []string
	httpClient     *http.Client
	mirrorTimeout  time.Duration
	maxDownloadCap int64
}

// DownloaderOption configures a Downloader.
type DownloaderOption func(*Downloader)

// WithDownloaderMirrors sets custom mirror URLs.
func WithDownloaderMirrors(mirrors []string) DownloaderOption {
	return func(d *Downloader) {
		if len(mirrors) > 0 {
			d.mirrors = mirrors
		}
	}
}

// WithDownloaderHTTPClient configures a custom HTTP client.
func WithDownloaderHTTPClient(client *http.Client) DownloaderOption {
	return func(d *Downloader) {
		d.httpClient = client
	}
}

// WithMirrorTimeout configures the timeout per mirror attempt.
func WithMirrorTimeout(timeout time.Duration) DownloaderOption {
	return func(d *Downloader) {
		d.mirrorTimeout = timeout
	}
}

// NewDownloader creates a configured Downloader instance.
func NewDownloader(opts ...DownloaderOption) *Downloader {
	d := &Downloader{
		mirrors:        DefaultCDNMirrors,
		mirrorTimeout:  5 * time.Second,
		maxDownloadCap: 500 * 1024 * 1024, // 500 MB
	}
	for _, opt := range opts {
		opt(d)
	}
	if d.httpClient == nil {
		d.httpClient = &http.Client{
			// Individual requests manage their own context timeouts
			Timeout: 0,
		}
	}
	return d
}

// Download fetches an idgames file using sequential mirror failover and extracts it safely.
// Destination path created: <baseDestDir>/idgames/<filename_without_ext>/
// Returns the absolute clean path to the primary extracted mod file.
func (d *Downloader) Download(
	ctx context.Context,
	item CatalogItem,
	baseDestDir string,
	progress ProgressCallback,
) (string, error) {
	if strings.TrimSpace(item.Filename) == "" {
		return "", errors.New("cannot download catalog item with empty filename")
	}

	emit := func(p DownloadProgress) {
		if progress != nil {
			progress(p)
		}
	}

	cleanBase := filepath.Clean(baseDestDir)
	nameWithoutExt := strings.TrimSuffix(item.Filename, filepath.Ext(item.Filename))
	targetDir := filepath.Join(cleanBase, "idgames", nameWithoutExt)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		errWrap := fmt.Errorf("creating destination directory %s: %w", targetDir, err)
		emit(DownloadProgress{
			ArchiveID: item.ID,
			Filename:  item.Filename,
			Status:    "failed",
			Error:     errWrap.Error(),
		})
		return "", errWrap
	}

	cleanDir := strings.Trim(filepath.ToSlash(item.Dir), "/")
	if cleanDir != "" {
		cleanDir += "/"
	}

	var downloadURLs []string
	for _, m := range d.mirrors {
		trimmed := strings.TrimSuffix(m, "/")
		downloadURLs = append(downloadURLs, fmt.Sprintf("%s/%s%s", trimmed, cleanDir, item.Filename))
	}

	var (
		resp      *http.Response
		chosenURL string
		lastErr   error
	)

	// Sequential mirror failover
	for _, u := range downloadURLs {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		default:
		}

		emit(DownloadProgress{
			ArchiveID: item.ID,
			Filename:  item.Filename,
			MirrorURL: u,
			Status:    "connecting",
		})

		// Per-mirror connection timeout
		mirrorCtx, cancel := context.WithTimeout(ctx, d.mirrorTimeout)
		req, err := http.NewRequestWithContext(mirrorCtx, http.MethodGet, u, nil)
		if err != nil {
			cancel()
			lastErr = err
			continue
		}
		req.Header.Set("User-Agent", "RNT-Launcher/1.0 (Doom Mod Manager; Resilient Downloader)")

		r, err := d.httpClient.Do(req)
		cancel()
		if err != nil {
			lastErr = err
			continue
		}
		if r.StatusCode != http.StatusOK {
			r.Body.Close()
			lastErr = fmt.Errorf("mirror %s returned HTTP %d", u, r.StatusCode)
			continue
		}

		resp = r
		chosenURL = u
		break
	}

	if resp == nil {
		finalErr := fmt.Errorf("failed downloading %s across all %d mirrors (last error: %v)",
			item.Filename, len(d.mirrors), lastErr)
		emit(DownloadProgress{
			ArchiveID: item.ID,
			Filename:  item.Filename,
			Status:    "failed",
			Error:     finalErr.Error(),
		})
		return "", finalErr
	}
	defer resp.Body.Close()

	totalBytes := resp.ContentLength
	if totalBytes <= 0 {
		totalBytes = item.Size
	}

	archivePath := filepath.Join(targetDir, item.Filename)
	outFile, err := os.OpenFile(archivePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		errWrap := fmt.Errorf("creating archive file %s: %w", archivePath, err)
		emit(DownloadProgress{
			ArchiveID: item.ID,
			Filename:  item.Filename,
			Status:    "failed",
			Error:     errWrap.Error(),
		})
		return "", errWrap
	}

	// Stream with progress reporting
	progressReader := &countingReader{
		reader:     io.LimitReader(resp.Body, d.maxDownloadCap),
		totalBytes: totalBytes,
		archiveID:  item.ID,
		filename:   item.Filename,
		mirrorURL:  chosenURL,
		onProgress: emit,
	}

	_, copyErr := io.Copy(outFile, progressReader)
	_ = outFile.Close()

	if copyErr != nil && !errors.Is(copyErr, io.EOF) {
		_ = os.Remove(archivePath)
		errWrap := fmt.Errorf("streaming download payload: %w", copyErr)
		emit(DownloadProgress{
			ArchiveID: item.ID,
			Filename:  item.Filename,
			Status:    "failed",
			Error:     errWrap.Error(),
		})
		return "", errWrap
	}

	// Extraction phase
	emit(DownloadProgress{
		ArchiveID:  item.ID,
		Filename:   item.Filename,
		BytesRead:  totalBytes,
		TotalBytes: totalBytes,
		Percent:    100.0,
		MirrorURL:  chosenURL,
		Status:     "extracting",
	})

	extractedFiles, extractErr := extractZipSafely(archivePath, targetDir)
	var primaryPath string
	if extractErr != nil {
		// Non-zip file (e.g. standalone .wad, .pk3)
		ext := strings.ToLower(filepath.Ext(item.Filename))
		if isPlayableModExtension(ext) {
			primaryPath = archivePath
		} else {
			errWrap := fmt.Errorf("extracting archive %s: %w", item.Filename, extractErr)
			emit(DownloadProgress{
				ArchiveID: item.ID,
				Filename:  item.Filename,
				Status:    "failed",
				Error:     errWrap.Error(),
			})
			return "", errWrap
		}
	} else {
		primaryPath = selectPrimaryModFile(extractedFiles, item.Filename, archivePath)
	}

	// Inspection phase
	emit(DownloadProgress{
		ArchiveID:  item.ID,
		Filename:   item.Filename,
		BytesRead:  totalBytes,
		TotalBytes: totalBytes,
		Percent:    100.0,
		MirrorURL:  chosenURL,
		Status:     "inspecting",
	})

	// Final completion event
	emit(DownloadProgress{
		ArchiveID:  item.ID,
		Filename:   item.Filename,
		BytesRead:  totalBytes,
		TotalBytes: totalBytes,
		Percent:    100.0,
		MirrorURL:  chosenURL,
		Status:     "completed",
	})

	return primaryPath, nil
}

// ModRegistrar represents a service that imports a filesystem path into the mod repository.
type ModRegistrar interface {
	ImportFile(ctx context.Context, filePath string) (*domain.Mod, error)
}

// DownloadAndIngest runs the full download, extraction, lump inspection, and mod database registration cycle.
func (d *Downloader) DownloadAndIngest(
	ctx context.Context,
	item CatalogItem,
	baseDestDir string,
	registrar ModRegistrar,
	progress ProgressCallback,
) (*domain.Mod, error) {
	primaryPath, err := d.Download(ctx, item, baseDestDir, progress)
	if err != nil {
		return nil, err
	}
	if registrar == nil {
		return nil, errors.New("cannot ingest mod: registrar is nil")
	}
	return registrar.ImportFile(ctx, primaryPath)
}
// InspectModFile runs binary lump inspection using filesystem.Inspector
// to identify map lumps, scripting markers, and suggested IWADs.
func InspectModFile(filePath string) (*filesystem.FileInfo, error) {
	return filesystem.InspectFile(filePath)
}

func isPlayableModExtension(ext string) bool {
	switch ext {
	case ".wad", ".pk3", ".ipk3", ".pk7", ".7z", ".deh", ".bex":
		return true
	default:
		return false
	}
}

type countingReader struct {
	reader     io.Reader
	totalBytes int64
	bytesRead  int64
	archiveID  int
	filename   string
	mirrorURL  string
	onProgress ProgressCallback
	lastEmit   time.Time
}

func (cr *countingReader) Read(p []byte) (int, error) {
	n, err := cr.reader.Read(p)
	if n > 0 {
		cr.bytesRead += int64(n)
		now := time.Now()
		// Throttle progress events to at most once every 50ms, or when complete
		if now.Sub(cr.lastEmit) >= 50*time.Millisecond || (cr.totalBytes > 0 && cr.bytesRead >= cr.totalBytes) {
			cr.lastEmit = now
			var percent float64
			if cr.totalBytes > 0 {
				percent = float64(cr.bytesRead) / float64(cr.totalBytes) * 100.0
				if percent > 100.0 {
					percent = 100.0
				}
			}
			if cr.onProgress != nil {
				cr.onProgress(DownloadProgress{
					ArchiveID:  cr.archiveID,
					Filename:   cr.filename,
					BytesRead:  cr.bytesRead,
					TotalBytes: cr.totalBytes,
					Percent:    percent,
					MirrorURL:  cr.mirrorURL,
					Status:     "downloading",
				})
			}
		}
	}
	return n, err
}
