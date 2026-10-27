package controllers

import (
	"errors"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// dashboardDateRange returns a Taipei start and exclusive end, limited to 90 calendar days.
func dashboardDateRange(c *gin.Context) (time.Time, time.Time, error) {
	location := time.FixedZone("Asia/Taipei", 8*60*60)
	startText, endText := c.Query("start"), c.Query("end")
	if startText != "" || endText != "" {
		if startText == "" || endText == "" || c.Query("days") != "" {
			return time.Time{}, time.Time{}, errors.New("請提供有效的起訖日期")
		}
		start, err1 := time.ParseInLocation("2006-01-02", startText, location)
		end, err2 := time.ParseInLocation("2006-01-02", endText, location)
		if err1 != nil || err2 != nil || end.Before(start) || end.Sub(start) >= 90*24*time.Hour {
			return time.Time{}, time.Time{}, errors.New("日期範圍須為 1 到 90 天")
		}
		return start, end.AddDate(0, 0, 1), nil
	}
	days := 30
	if raw := c.Query("days"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 90 {
			return time.Time{}, time.Time{}, errors.New("日期範圍須為 1 到 90 天")
		}
		days = value
	}
	now := time.Now().In(location)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	return today.AddDate(0, 0, 1-days), today.AddDate(0, 0, 1), nil
}
