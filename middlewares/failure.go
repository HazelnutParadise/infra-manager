package middlewares

import (
	"github.com/gin-gonic/gin"
	"infra-manager/db"
	"infra-manager/models"
	"log"
	"time"

	"gorm.io/gorm"
)

// FailureRecorder records only whitelisted diagnostic metadata.
func FailureRecorder() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		value, ok := c.Get("requestFailure")
		if !ok {
			return
		}
		failure, ok := value.(models.RequestFailure)
		if !ok {
			return
		}
		failure.StatusCode = c.Writer.Status()
		if err := saveFailure(&failure, 100000); err != nil {
			log.Print("failed to save request failure")
		}
	}
}

// The rolling ID window bounds stored rows without a full-table count on every request.
func saveFailure(failure *models.RequestFailure, maxRows uint) error {
	return db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(failure).Error; err != nil {
			return err
		}
		if failure.ID > maxRows {
			return tx.Unscoped().Where("id <= ?", failure.ID-maxRows).Delete(&models.RequestFailure{}).Error
		}
		return nil
	})
}

func markFailure(c *gin.Context, stage, reason string) {
	failure := models.RequestFailure{Stage: stage, Reason: reason}
	if id, ok := c.Get("failureServiceID"); ok {
		value := id.(uint)
		failure.ServiceID = &value
	}
	c.Set("requestFailure", failure)
}

func RemoveExpiredFailures(now time.Time) error {
	return purgeOldRows("request_failures", "julianday(created_at) < julianday(?)", now.AddDate(0, 0, -90))
}

func saveAccessLog(row *models.AccessLog, maxRows uint) error {
	if runes := []rune(row.Endpoint); len(runes) > 512 {
		row.Endpoint = string(runes[:512])
	}
	if runes := []rune(row.Method); len(runes) > 32 {
		row.Method = string(runes[:32])
	}
	return db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(row).Error; err != nil {
			return err
		}
		if row.ID > maxRows {
			return tx.Unscoped().Where("id <= ?", row.ID-maxRows).Delete(&models.AccessLog{}).Error
		}
		return nil
	})
}

func RemoveExpiredAccessLogs(now time.Time) error {
	return purgeOldRows("access_logs", "julianday(created_at) < julianday(?)", now.AddDate(0, 0, -90))
}

// Each batch commits separately to avoid holding SQLite's writer lock for an entire large purge.
func purgeOldRows(table, condition string, value interface{}) error {
	const batchSize = 1000
	for {
		result := db.DB.Exec("DELETE FROM "+table+" WHERE id IN (SELECT id FROM "+table+" WHERE "+condition+" LIMIT ?)", value, batchSize)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected < batchSize {
			return nil
		}
		time.Sleep(time.Millisecond)
	}
}

func StartLogCleanup() {
	clean := func() {
		now := time.Now()
		if err := purgeOldRows("access_logs", "id <= (SELECT COALESCE(MAX(id), 0) - ? FROM access_logs)", 1000000); err != nil {
			log.Print("failed to limit access logs")
		}
		if err := purgeOldRows("request_failures", "id <= (SELECT COALESCE(MAX(id), 0) - ? FROM request_failures)", 100000); err != nil {
			log.Print("failed to limit request failures")
		}
		if err := RemoveExpiredAccessLogs(now); err != nil {
			log.Print("failed to clean access logs")
		}
		if err := RemoveExpiredFailures(now); err != nil {
			log.Print("failed to clean request failures")
		}
	}
	clean()
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			clean()
		}
	}()
}
