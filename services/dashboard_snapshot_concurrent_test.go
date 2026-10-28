package services

import (
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"infra-manager/models"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestConcurrentDashboardSnapshotsKeepOneObservation(t *testing.T) {
	dsn := filepath.Join(t.TempDir(), "snapshots.db") + "?_pragma=busy_timeout(5000)"
	database, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = database.AutoMigrate(&models.User{}, &models.Service{}, &models.Token{}, &models.DashboardSnapshot{}); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 28, 2, 0, 0, 0, time.UTC)
	const workers = 8
	results := make(chan error, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); results <- CaptureDashboardSnapshot(database, now) }()
	}
	wg.Wait()
	close(results)
	successes := 0
	for err := range results {
		if err == nil {
			successes++
		}
	}
	if successes == 0 {
		t.Fatal("all concurrent captures failed")
	}
	if err = CaptureDashboardSnapshot(database, now.Add(time.Hour)); err != nil {
		t.Fatalf("retry: %v", err)
	}
	var count int64
	if err = database.Model(&models.DashboardSnapshot{}).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("count %d: %v", count, err)
	}
}
