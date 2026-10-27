package controllers

import (
	"github.com/gin-gonic/gin"
	"infra-manager/db"
	"net/http"
	"strconv"
	"time"
)

// GetDashboardRecentStats groups requests by Taipei calendar day.
func GetDashboardRecentStats(c *gin.Context) {
	days := 30
	if raw := c.Query("days"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 90 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "日期範圍須為 1 到 90 天"})
			return
		}
		days = value
	}
	location := time.FixedZone("Asia/Taipei", 8*60*60)
	now := time.Now().In(location)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	start := today.AddDate(0, 0, 1-days)
	end := today.AddDate(0, 0, 1)
	var stats []DailyStats
	result := db.DB.Raw(`SELECT DATE(created_at,'+08:00') AS date, COUNT(*) AS count,
 COUNT(DISTINCT user_id) AS user_count, COUNT(DISTINCT token_id) AS token_count,
 COUNT(DISTINCT service_id) AS service_count FROM access_logs
 WHERE deleted_at IS NULL AND julianday(created_at) >= julianday(?) AND julianday(created_at) < julianday(?)
 GROUP BY date ORDER BY date`, start, end).Scan(&stats)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法讀取使用統計"})
		return
	}
	c.JSON(http.StatusOK, fillMissingDates(stats, start, end))
}

// GetDashboardServiceUsage summarizes recorded authenticated traffic for the last 30 Taipei days.
func GetDashboardServiceUsage(c *gin.Context) {
	type serviceUsage struct {
		ServiceID uint   `json:"service_id"`
		Name      string `json:"name"`
		Count     int64  `json:"count"`
		Errors    int64  `json:"errors"`
		LastUsed  string `json:"last_used"`
	}
	location := time.FixedZone("Asia/Taipei", 8*3600)
	now := time.Now().In(location)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	start := today.AddDate(0, 0, -29)
	end := today.AddDate(0, 0, 1)
	items := []serviceUsage{}
	result := db.DB.Raw(`SELECT al.service_id, COALESCE(s.name, '已刪除服務 #' || al.service_id) AS name, COUNT(*) AS count,
 SUM(CASE WHEN al.status_code >= 400 AND al.status_code < 600 THEN 1 ELSE 0 END) AS errors,
 strftime('%Y-%m-%dT%H:%M:%fZ',MAX(julianday(al.created_at))) AS last_used
 FROM access_logs al LEFT JOIN services s ON s.id=al.service_id
 WHERE al.deleted_at IS NULL AND julianday(al.created_at)>=julianday(?) AND julianday(al.created_at)<julianday(?)
 GROUP BY al.service_id,s.name ORDER BY count DESC,al.service_id ASC`, start, end).Scan(&items)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法讀取服務使用情況"})
		return
	}
	c.JSON(http.StatusOK, items)
}
