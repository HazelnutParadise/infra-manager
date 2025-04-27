package controllers

import (
	"net/http"
	"time"

	"infra-manager/db"

	"github.com/gin-gonic/gin"
)

// 獲取使用者服務使用量統計
func GetUserServiceStats(c *gin.Context) {
	type UserServiceStat struct {
		UserID      uint   `json:"user_id"`
		Username    string `json:"username"`
		ServiceID   uint   `json:"service_id"`
		ServiceName string `json:"service_name"`
		Count       int    `json:"count"`
		TotalSize   int64  `json:"total_size"`
	}

	var stats []UserServiceStat

	// 聯合查詢獲取使用者的服務使用情況
	db.DB.Raw(`
		SELECT 
			al.user_id, 
			u.username,
			al.service_id, 
			s.name AS service_name,
			COUNT(*) AS count,
			SUM(al.request_size + al.response_size) AS total_size
		FROM 
			access_logs al
		JOIN 
			users u ON al.user_id = u.id
		JOIN 
			services s ON al.service_id = s.id
		GROUP BY 
			al.user_id, al.service_id
		ORDER BY 
			count DESC
	`).Scan(&stats)

	c.JSON(http.StatusOK, stats)
}

// 獲取使用者Token使用量統計
func GetUserTokenStats(c *gin.Context) {
	type UserTokenStat struct {
		UserID      uint   `json:"user_id"`
		Username    string `json:"username"`
		TokenID     uint   `json:"token_id"`
		TokenValue  string `json:"token_value"`
		ServiceID   uint   `json:"service_id"`
		ServiceName string `json:"service_name"`
		Count       int    `json:"count"`
		TotalSize   int64  `json:"total_size"`
	}

	var stats []UserTokenStat

	// 聯合查詢獲取使用者的Token使用情況
	db.DB.Raw(`
		SELECT 
			al.user_id, 
			u.username,
			al.token_id,
			t.token_value,
			al.service_id, 
			s.name AS service_name,
			COUNT(*) AS count,
			SUM(al.request_size + al.response_size) AS total_size
		FROM 
			access_logs al
		JOIN 
			users u ON al.user_id = u.id
		JOIN 
			tokens t ON al.token_id = t.id
		JOIN 
			services s ON al.service_id = s.id
		GROUP BY 
			al.user_id, al.token_id
		ORDER BY 
			count DESC
	`).Scan(&stats)

	c.JSON(http.StatusOK, stats)
}

// 獲取Token隨時間使用量統計
func GetTokenTimeStats(c *gin.Context) {
	tokenID := c.Param("token_id")

	type TokenTimeStat struct {
		Date      string `json:"date"`
		Count     int    `json:"count"`
		TotalSize int64  `json:"total_size"`
	}

	var stats []TokenTimeStat

	// 查詢特定Token隨時間的使用情況
	db.DB.Raw(`
		SELECT 
			strftime('%Y-%m-%d', datetime(created_at/1000, 'unixepoch')) AS date,
			COUNT(*) AS count,
			SUM(request_size + response_size) AS total_size
		FROM 
			access_logs
		WHERE 
			token_id = ?
		GROUP BY 
			date
		ORDER BY 
			date ASC
	`, tokenID).Scan(&stats)

	c.JSON(http.StatusOK, stats)
}

// 獲取服務隨時間總使用量統計
func GetServiceTimeStats(c *gin.Context) {
	serviceID := c.Param("service_id")

	type ServiceTimeStat struct {
		Date      string `json:"date"`
		Count     int    `json:"count"`
		TotalSize int64  `json:"total_size"`
	}

	var stats []ServiceTimeStat

	// 查詢特定服務隨時間的使用情況
	db.DB.Raw(`
		SELECT 
			strftime('%Y-%m-%d', datetime(created_at/1000, 'unixepoch')) AS date,
			COUNT(*) AS count,
			SUM(request_size + response_size) AS total_size
		FROM 
			access_logs
		WHERE 
			service_id = ?
		GROUP BY 
			date
		ORDER BY 
			date ASC
	`, serviceID).Scan(&stats)

	c.JSON(http.StatusOK, stats)
}

// 獲取所有服務總使用量統計
func GetServicesUsageStats(c *gin.Context) {
	type ServiceUsageStat struct {
		ServiceID   uint   `json:"service_id"`
		ServiceName string `json:"service_name"`
		Count       int    `json:"count"`
		TotalSize   int64  `json:"total_size"`
	}

	var stats []ServiceUsageStat

	// 查詢所有服務的總使用情況
	db.DB.Raw(`
		SELECT 
			al.service_id, 
			s.name AS service_name,
			COUNT(*) AS count,
			SUM(al.request_size + al.response_size) AS total_size
		FROM 
			access_logs al
		JOIN 
			services s ON al.service_id = s.id
		GROUP BY 
			al.service_id
		ORDER BY 
			count DESC
	`).Scan(&stats)

	c.JSON(http.StatusOK, stats)
}

// 獲取最近一段時間的使用統計
func GetRecentStats(c *gin.Context) {
	days := c.DefaultQuery("days", "7")

	// 計算過去X天的開始日期
	startDate := time.Now().AddDate(0, 0, -1*int(Atoi(days)))

	type DailyStats struct {
		Date         string `json:"date"`
		Count        int    `json:"count"`
		UserCount    int    `json:"user_count"`
		TokenCount   int    `json:"token_count"`
		ServiceCount int    `json:"service_count"`
	}

	var stats []DailyStats

	// 查詢每日統計數據
	db.DB.Raw(`
		SELECT 
			strftime('%Y-%m-%d', datetime(created_at/1000, 'unixepoch')) AS date,
			COUNT(*) AS count,
			COUNT(DISTINCT user_id) AS user_count,
			COUNT(DISTINCT token_id) AS token_count,
			COUNT(DISTINCT service_id) AS service_count
		FROM 
			access_logs
		WHERE 
			created_at >= ?
		GROUP BY 
			date
		ORDER BY 
			date ASC
	`, startDate.Unix()*1000).Scan(&stats)

	c.JSON(http.StatusOK, stats)
}

// 輔助函數：字符轉整數
func Atoi(s string) int64 {
	var result int64 = 0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			result = result*10 + int64(c-'0')
		}
	}
	return result
}
