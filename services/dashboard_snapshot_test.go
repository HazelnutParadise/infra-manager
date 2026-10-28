package services

import (
	"fmt"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"infra-manager/models"
)

func TestDashboardSnapshotRetentionAndMissingDays(t *testing.T) {
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = database.AutoMigrate(&models.User{}, &models.Service{}, &models.Token{}, &models.DashboardSnapshot{}); err != nil {
		t.Fatal(err)
	}
	loc := time.FixedZone("Taipei", 8*3600)
	base := time.Date(2026, 10, 28, 9, 0, 0, 0, loc)
	if err = CaptureDashboardSnapshot(database, base); err != nil {
		t.Fatal(err)
	}
	var first models.DashboardSnapshot
	if err = database.First(&first).Error; err != nil {
		t.Fatal(err)
	}
	if first.ActiveUsers != 0 || first.ActiveServices != 0 || first.ActiveTokens != 0 || first.ExpiringTokens != 0 {
		t.Fatalf("zero snapshot %+v", first)
	}
	if err = database.Create(&models.User{Username: "u"}).Error; err != nil {
		t.Fatal(err)
	}
	if err = CaptureDashboardSnapshot(database, base.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	var unchanged models.DashboardSnapshot
	database.First(&unchanged)
	if unchanged.ActiveUsers != 0 {
		t.Fatal("same day sample overwritten")
	}
	prev, err := PreviousDashboardSnapshot(database, base)
	if err != nil || prev != nil {
		t.Fatalf("missing month should be nil: %+v %v", prev, err)
	}
	for i := 1; i <= 100; i++ {
		if err = CaptureDashboardSnapshot(database, base.AddDate(0, 0, i)); err != nil {
			t.Fatal(err)
		}
	}
	var count int64
	database.Model(&models.DashboardSnapshot{}).Count(&count)
	if count > 90 {
		t.Fatalf("unbounded snapshots %d", count)
	}
}

func TestDashboardSnapshotCountsAndPreviousMonth(t *testing.T) {
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = database.AutoMigrate(&models.User{}, &models.Service{}, &models.Token{}, &models.DashboardSnapshot{}); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 2, 28, 3, 0, 0, 0, time.UTC)
	user := models.User{Username: "u"}
	service := models.Service{Name: "api", BaseURL: "http://example.test"}
	if err = database.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	if err = database.Create(&service).Error; err != nil {
		t.Fatal(err)
	}
	for i, offset := range []time.Duration{time.Hour, 10 * 24 * time.Hour, -time.Hour} {
		token := models.Token{TokenValue: fmt.Sprintf("token-%d", i), UserID: user.ID, ServiceID: service.ID, ExpiresAt: now.Add(offset)}
		if err = database.Create(&token).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err = database.Exec("UPDATE tokens SET disabled = NULL WHERE token_value = ?", "token-0").Error; err != nil {
		t.Fatal(err)
	}
	if err = CaptureDashboardSnapshot(database, now); err != nil {
		t.Fatal(err)
	}
	var row models.DashboardSnapshot
	if err = database.First(&row).Error; err != nil {
		t.Fatal(err)
	}
	if row.ActiveUsers != 1 || row.ActiveServices != 1 || row.ActiveTokens != 2 || row.ExpiringTokens != 1 {
		t.Fatalf("counts: %+v", row)
	}
	previous, err := PreviousDashboardSnapshot(database, time.Date(2026, 3, 31, 2, 0, 0, 0, time.UTC))
	if err != nil || previous == nil || previous.Date != "2026-02-28" {
		t.Fatalf("month end: %+v %v", previous, err)
	}
}
