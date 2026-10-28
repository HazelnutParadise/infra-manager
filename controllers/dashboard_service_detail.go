package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"infra-manager/db"
)

// GetDashboardServiceDetail summarizes the retained, authenticated requests by service.
func GetDashboardServiceDetail(c *gin.Context) {
	type detail struct {
		ServiceID uint   `json:"service_id"`
		Name      string `json:"name"`
		Type      string `json:"type"`
		Count     int64  `json:"count"`
		Success   int64  `json:"success"`
		Errors    int64  `json:"errors"`
		Users     int64  `json:"users"`
		Tokens    int64  `json:"tokens"`
		LastUsed  string `json:"last_used"`
	}
	start, end, err := dashboardDateRange(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	items := []detail{}
	result := db.DB.Raw(`SELECT al.service_id, COALESCE(s.name, '已刪除服務 #' || al.service_id) AS name, COALESCE(s.type, '') AS type, COUNT(*) AS count,
 SUM(CASE WHEN al.status_code >= 100 AND al.status_code < 400 THEN 1 ELSE 0 END) AS success,
 SUM(CASE WHEN al.status_code >= 400 THEN 1 ELSE 0 END) AS errors,
 COUNT(DISTINCT NULLIF(al.user_id,0)) AS users, COUNT(DISTINCT NULLIF(al.token_id,0)) AS tokens,
 strftime('%Y-%m-%dT%H:%M:%fZ',MAX(julianday(al.created_at))) AS last_used
 FROM access_logs al LEFT JOIN services s ON s.id=al.service_id
 WHERE al.deleted_at IS NULL AND julianday(al.created_at)>=julianday(?) AND julianday(al.created_at)<julianday(?)
 GROUP BY al.service_id,s.name,s.type ORDER BY count DESC,al.service_id ASC`, start, end).Scan(&items)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法讀取服務使用情況"})
		return
	}
	c.JSON(http.StatusOK, items)
}
