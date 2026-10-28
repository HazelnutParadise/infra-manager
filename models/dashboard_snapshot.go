package models

import "time"

// DashboardSnapshot holds one observed set of aggregate counts per Taipei day.
type DashboardSnapshot struct {
	Date           string    `gorm:"primaryKey" json:"date"`
	ObservedAt     time.Time `gorm:"not null" json:"observed_at"`
	ActiveUsers    int64     `json:"active_users"`
	ActiveServices int64     `json:"active_services"`
	ActiveTokens   int64     `json:"active_tokens"`
	ExpiringTokens int64     `json:"expiring_tokens"`
}
