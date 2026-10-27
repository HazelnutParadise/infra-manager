package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"infra-manager/db"
)

type dashboardResponseDay struct {
	Date    string `json:"date"`
	Success int64  `json:"success"`
	Error   int64  `json:"error"`
}

// GetDashboardResponseChart groups authenticated HTTP responses by Taipei day.
func GetDashboardResponseChart(c *gin.Context) {
	start, end, err := dashboardDateRange(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var grouped []dashboardResponseDay
	result := db.DB.Raw(`SELECT DATE(created_at,'+08:00') AS date,
 SUM(CASE WHEN status_code >= 100 AND status_code < 400 THEN 1 ELSE 0 END) AS success,
 SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS error
 FROM access_logs WHERE deleted_at IS NULL AND julianday(created_at) >= julianday(?) AND julianday(created_at) < julianday(?)
 GROUP BY date ORDER BY date`, start, end).Scan(&grouped)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法讀取回應統計"})
		return
	}
	byDate := make(map[string]dashboardResponseDay, len(grouped))
	for _, row := range grouped {
		byDate[row.Date] = row
	}
	rows := make([]dashboardResponseDay, 0, int(end.Sub(start).Hours()/24))
	for day := start; day.Before(end); day = day.AddDate(0, 0, 1) {
		date := day.Format("2006-01-02")
		row := byDate[date]
		row.Date = date
		rows = append(rows, row)
	}
	c.JSON(http.StatusOK, rows)
}
