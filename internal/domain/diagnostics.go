package domain

import "time"

// DiagnosticSeverity represents the impact level of a diagnosed issue.
type DiagnosticSeverity string

const (
	SeverityError   DiagnosticSeverity = "error"
	SeverityWarning DiagnosticSeverity = "warning"
	SeverityInfo    DiagnosticSeverity = "info"
)

// DiagnosticCategory represents the system subsystem being analyzed.
type DiagnosticCategory string

const (
	CategoryDatabase DiagnosticCategory = "database"
	CategoryEngine   DiagnosticCategory = "engine"
	CategoryIWAD     DiagnosticCategory = "iwad"
	CategoryLibrary  DiagnosticCategory = "library"
	CategoryProfile  DiagnosticCategory = "profile"
)

// DiagnosticIssue represents an identified configuration, file, or database anomaly.
type DiagnosticIssue struct {
	ID                string             `json:"id"`
	Category          DiagnosticCategory `json:"category"`
	Severity          DiagnosticSeverity `json:"severity"`
	Title             string             `json:"title"`
	Description       string             `json:"description"`
	TargetID          string             `json:"targetId,omitempty"`
	TargetPath        string             `json:"targetPath,omitempty"`
	CanRepair         bool               `json:"canRepair"`
	RepairAction      string             `json:"repairAction,omitempty"`
	RepairDescription string             `json:"repairDescription,omitempty"`
}

// DatabaseHealth summarizes SQLite database statistics and integrity.
type DatabaseHealth struct {
	Status         string `json:"status"` // "healthy", "warning", "error"
	Path           string `json:"path"`
	IntegrityCheck string `json:"integrityCheck"` // "ok" or error string
	ModCount       int    `json:"modCount"`
	IWADCount      int    `json:"iwadCount"`
	EngineCount    int    `json:"engineCount"`
	ProfileCount   int    `json:"profileCount"`
	HistoryCount   int    `json:"historyCount"`
}

// DiagnosticsSummary aggregates issue counts by severity.
type DiagnosticsSummary struct {
	TotalIssues  int `json:"totalIssues"`
	ErrorCount   int `json:"errorCount"`
	WarningCount int `json:"warningCount"`
	InfoCount    int `json:"infoCount"`
}

// DiagnosticsReport encapsulates the full system health check.
type DiagnosticsReport struct {
	OverallStatus string             `json:"overallStatus"` // "healthy", "warning", "error"
	Database      DatabaseHealth     `json:"database"`
	Issues        []DiagnosticIssue  `json:"issues"`
	Summary       DiagnosticsSummary `json:"summary"`
	GeneratedAt   time.Time          `json:"generatedAt"`
}
