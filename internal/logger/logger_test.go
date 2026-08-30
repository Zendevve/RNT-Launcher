package logger_test

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"testing"
	"time"

	"rnt-launcher/internal/logger"
)

func TestMemoryLogHandler_CapacityAndEviction(t *testing.T) {
	maxSize := 5
	handler := logger.NewMemoryLogHandler(maxSize, nil)
	ctx := context.Background()

	for i := 0; i < 10; i++ {
		record := slog.NewRecord(time.Now(), slog.LevelInfo, fmt.Sprintf("message %d", i), 0)
		record.Add("idx", i)
		if err := handler.Handle(ctx, record); err != nil {
			t.Fatalf("Handle failed: %v", err)
		}
	}

	entries := handler.GetEntries()
	if len(entries) != maxSize {
		t.Fatalf("expected %d entries, got %d", maxSize, len(entries))
	}

	// Should contain messages 5 to 9
	for i, entry := range entries {
		expectedMsg := fmt.Sprintf("message %d", i+5)
		if entry.Message != expectedMsg {
			t.Errorf("entry %d: expected %s, got %s", i, expectedMsg, entry.Message)
		}
	}

	// Clear entries
	handler.Clear()
	if len(handler.GetEntries()) != 0 {
		t.Fatalf("expected 0 entries after clear, got %d", len(handler.GetEntries()))
	}
}

func TestMemoryLogHandler_Concurrent100Goroutines(t *testing.T) {
	maxSize := 100
	handler := logger.NewMemoryLogHandler(maxSize, nil)
	ctx := context.Background()

	var wg sync.WaitGroup
	goroutines := 100
	iters := 20

	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func(gid int) {
			defer wg.Done()
			for i := 0; i < iters; i++ {
				record := slog.NewRecord(time.Now(), slog.LevelInfo, fmt.Sprintf("goroutine %d log %d", gid, i), 0)
				record.Add("gid", gid)
				record.Add("i", i)
				_ = handler.Handle(ctx, record)

				if i%5 == 0 {
					_ = handler.GetEntries()
				}
			}
		}(g)
	}

	wg.Wait()

	entries := handler.GetEntries()
	if len(entries) > maxSize {
		t.Fatalf("expected at most %d entries, got %d", maxSize, len(entries))
	}
	if len(entries) != maxSize {
		t.Fatalf("expected full capacity %d, got %d", maxSize, len(entries))
	}
}

func TestMemoryLogHandler_PassThroughAndMethods(t *testing.T) {
	handler := logger.NewMemoryLogHandler(10, nil)
	if !handler.Enabled(context.Background(), slog.LevelInfo) {
		t.Error("expected handler to be enabled")
	}

	if handler.WithAttrs(nil) != handler {
		t.Error("expected WithAttrs to return self")
	}

	if handler.WithGroup("test") != handler {
		t.Error("expected WithGroup to return self")
	}
}
