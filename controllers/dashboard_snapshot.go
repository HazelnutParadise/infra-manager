package controllers

import (
	"github.com/gin-gonic/gin"
	"infra-manager/db"
	"infra-manager/services"
	"net/http"
	"time"
)

// GetDashboardSnapshotComparison returns the observed counts for the same day last month.
func GetDashboardSnapshotComparison(c *gin.Context) {
	previous, err := services.PreviousDashboardSnapshot(db.DB, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法讀取歷史摘要"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"previous": previous})
}
