package services

import (
	"errors"
	"log"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"infra-manager/models"
)

var snapshotLocation = time.FixedZone("Asia/Taipei", 8*60*60)

// CaptureDashboardSnapshot stores the first successful observation per Taipei day.
func CaptureDashboardSnapshot(database *gorm.DB, now time.Time) error {
	now = now.UTC()
	day := now.In(snapshotLocation).Format("2006-01-02")
	return database.Transaction(func(tx *gorm.DB) error {
		var existing int64
		if err := tx.Model(&models.DashboardSnapshot{}).Where("date = ?", day).Count(&existing).Error; err != nil {
			return err
		}
		if existing == 0 {
			var values struct{ ActiveUsers, ActiveServices, ActiveTokens, ExpiringTokens int64 }
			err := tx.Raw(`SELECT
    (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND is_active = 1) AS active_users,
    (SELECT COUNT(*) FROM services WHERE deleted_at IS NULL AND is_active = 1) AS active_services,
    (SELECT COUNT(*) FROM tokens t JOIN users u ON u.id=t.user_id JOIN services s ON s.id=t.service_id
      WHERE t.deleted_at IS NULL AND u.deleted_at IS NULL AND s.deleted_at IS NULL AND t.is_active = 1 AND COALESCE(t.disabled,0) = 0 AND u.is_active = 1 AND s.is_active = 1 AND julianday(t.expires_at)>julianday(?)) AS active_tokens,
    (SELECT COUNT(*) FROM tokens t JOIN users u ON u.id=t.user_id JOIN services s ON s.id=t.service_id
      WHERE t.deleted_at IS NULL AND u.deleted_at IS NULL AND s.deleted_at IS NULL AND t.is_active = 1 AND COALESCE(t.disabled,0) = 0 AND u.is_active = 1 AND s.is_active = 1 AND julianday(t.expires_at)>julianday(?) AND julianday(t.expires_at)<=julianday(?)) AS expiring_tokens`, now, now, now.Add(7*24*time.Hour)).Scan(&values).Error
			if err != nil {
				return err
			}
			sample := models.DashboardSnapshot{Date: day, ObservedAt: now, ActiveUsers: values.ActiveUsers, ActiveServices: values.ActiveServices, ActiveTokens: values.ActiveTokens, ExpiringTokens: values.ExpiringTokens}
			if err = tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&sample).Error; err != nil {
				return err
			}
		}
		cutoff := now.In(snapshotLocation).AddDate(0, 0, -89).Format("2006-01-02")
		if err := tx.Where("date < ?", cutoff).Delete(&models.DashboardSnapshot{}).Error; err != nil {
			return err
		}
		return tx.Exec("DELETE FROM dashboard_snapshots WHERE date NOT IN (SELECT date FROM dashboard_snapshots ORDER BY date DESC LIMIT 90)").Error
	})
}

// PreviousDashboardSnapshot returns the observation for the same day last month, if recorded.
func PreviousDashboardSnapshot(database *gorm.DB, now time.Time) (*models.DashboardSnapshot, error) {
	local := now.In(snapshotLocation)
	lastMonth := time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, snapshotLocation).AddDate(0, -1, 0)
	lastDay := lastMonth.AddDate(0, 1, -1).Day()
	day := local.Day()
	if day > lastDay {
		day = lastDay
	}
	target := time.Date(lastMonth.Year(), lastMonth.Month(), day, 0, 0, 0, 0, snapshotLocation).Format("2006-01-02")
	var sample models.DashboardSnapshot
	err := database.Where("date = ?", target).First(&sample).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &sample, nil
}

// StartDashboardSnapshots observes at startup and retries hourly; missed days are not invented.
func StartDashboardSnapshots(database *gorm.DB) {
	capture := func() {
		if err := CaptureDashboardSnapshot(database, time.Now()); err != nil {
			log.Print("failed to record dashboard snapshot")
		}
	}
	capture()
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			capture()
		}
	}()
}
