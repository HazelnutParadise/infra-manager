package controllers

import (
	"github.com/gin-gonic/gin"
	"infra-manager/db"
	"infra-manager/models"
	"math"
	"net/http"
	"strconv"
	"time"
)

// GetRequestFailures returns a bounded page of failure events, newest first.
func GetRequestFailures(c *gin.Context) {
	query := db.DB.Model(&models.RequestFailure{})
	limit := 50
	for _, spec := range []struct {
		name     string
		min, max int64
		column   string
	}{{"limit", 1, 200, ""}, {"before_id", 1, math.MaxInt64, "id < ?"}, {"service_id", 1, math.MaxInt64, "service_id = ?"}, {"status_code", 100, 999, "status_code = ?"}, {"upstream_status_code", 100, 999, "upstream_status_code = ?"}} {
		if raw := c.Query(spec.name); raw != "" {
			value, err := strconv.ParseInt(raw, 10, 64)
			if err != nil || value < spec.min || value > spec.max {
				c.JSON(http.StatusBadRequest, gin.H{"error": "無效的查詢參數: " + spec.name})
				return
			}
			if spec.name == "limit" {
				limit = int(value)
			} else {
				query = query.Where(spec.column, value)
			}
		}
	}
	if stage := c.Query("stage"); stage != "" {
		switch stage {
		case "authentication", "local", "upstream_connection", "upstream_response", "transfer":
			query = query.Where("stage = ?", stage)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "無效的失敗類型"})
			return
		}
	}
	for _, item := range []struct{ name, condition string }{{"from", "julianday(created_at) >= julianday(?)"}, {"until", "julianday(created_at) < julianday(?)"}} {
		if raw := c.Query(item.name); raw != "" {
			v, err := time.Parse(time.RFC3339, raw)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "無效的時間參數: " + item.name})
				return
			}
			query = query.Where(item.condition, v)
		}
	}
	failures := []models.RequestFailure{}
	if err := query.Order("id desc").Limit(limit).Find(&failures).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法讀取失敗紀錄"})
		return
	}
	c.JSON(http.StatusOK, failures)
}
