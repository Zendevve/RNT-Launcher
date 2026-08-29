package logger

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"sync"
	"time"
)

// LogEntry represents an individual structured log message for UI diagnostics.
type LogEntry struct {
	Timestamp time.Time      `json:"timestamp"`
	Level     string         `json:"level"`
	Message   string         `json:"message"`
	Fields    map[string]any `json:"fields,omitempty"`
}

// MemoryLogHandler retains recent log entries in memory with a fixed capacity.
type MemoryLogHandler struct {
	mu      sync.RWMutex
	entries []LogEntry
	maxSize int
	next    slog.Handler
}

// NewMemoryLogHandler creates a new MemoryLogHandler wrapping an optional underlying handler.
func NewMemoryLogHandler(maxSize int, next slog.Handler) *MemoryLogHandler {
	if maxSize <= 0 {
		maxSize = 250
	}
	return &MemoryLogHandler{
		entries: make([]LogEntry, 0, maxSize),
		maxSize: maxSize,
		next:    next,
	}
}

func (h *MemoryLogHandler) Enabled(ctx context.Context, level slog.Level) bool {
	if h.next != nil {
		return h.next.Enabled(ctx, level)
	}
	return true
}

func (h *MemoryLogHandler) Handle(ctx context.Context, r slog.Record) error {
	fields := make(map[string]any)
	r.Attrs(func(a slog.Attr) bool {
		fields[a.Key] = a.Value.Any()
		return true
	})

	entry := LogEntry{
		Timestamp: r.Time.UTC(),
		Level:     r.Level.String(),
		Message:   r.Message,
		Fields:    fields,
	}

	h.mu.Lock()
	if len(h.entries) >= h.maxSize {
		h.entries = h.entries[1:]
	}
	h.entries = append(h.entries, entry)
	h.mu.Unlock()

	if h.next != nil {
		return h.next.Handle(ctx, r)
	}
	return nil
}

func (h *MemoryLogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return h
}

func (h *MemoryLogHandler) WithGroup(name string) slog.Handler {
	return h
}

// GetEntries returns a clone of all buffered log entries.
func (h *MemoryLogHandler) GetEntries() []LogEntry {
	h.mu.RLock()
	defer h.mu.RUnlock()

	result := make([]LogEntry, len(h.entries))
	copy(result, h.entries)
	return result
}

// Clear removes all buffered log entries.
func (h *MemoryLogHandler) Clear() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.entries = h.entries[:0]
}

var (
	defaultMemoryHandler *MemoryLogHandler
	defaultLogger        *slog.Logger
	initOnce             sync.Once
)

// InitLogger initializes the global structured logger.
func InitLogger(w io.Writer) *slog.Logger {
	initOnce.Do(func() {
		if w == nil {
			w = os.Stdout
		}
		textHandler := slog.NewTextHandler(w, &slog.HandlerOptions{
			Level: slog.LevelInfo,
		})
		defaultMemoryHandler = NewMemoryLogHandler(500, textHandler)
		defaultLogger = slog.New(defaultMemoryHandler)
		slog.SetDefault(defaultLogger)
	})
	return defaultLogger
}

// GetRecentLogs retrieves buffered logs for diagnostics.
func GetRecentLogs() []LogEntry {
	if defaultMemoryHandler == nil {
		InitLogger(nil)
	}
	return defaultMemoryHandler.GetEntries()
}

// ClearLogs clears the in-memory log buffer.
func ClearLogs() {
	if defaultMemoryHandler != nil {
		defaultMemoryHandler.Clear()
	}
}

// Info logs an informational message.
func Info(msg string, args ...any) {
	if defaultLogger == nil {
		InitLogger(nil)
	}
	defaultLogger.Info(msg, args...)
}

// Warn logs a warning message.
func Warn(msg string, args ...any) {
	if defaultLogger == nil {
		InitLogger(nil)
	}
	defaultLogger.Warn(msg, args...)
}

// Error logs an error message.
func Error(msg string, args ...any) {
	if defaultLogger == nil {
		InitLogger(nil)
	}
	defaultLogger.Error(msg, args...)
}

// Debug logs a debug message.
func Debug(msg string, args ...any) {
	if defaultLogger == nil {
		InitLogger(nil)
	}
	defaultLogger.Debug(msg, args...)
}

// Errorf formats and logs an error message.
func Errorf(format string, a ...any) {
	Error(fmt.Sprintf(format, a...))
}

// Infof formats and logs an informational message.
func Infof(format string, a ...any) {
	Info(fmt.Sprintf(format, a...))
}
