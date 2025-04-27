package controllers

import (
	"net/http"
	"strconv"
	"time"

	"infra-manager/db"
	"infra-manager/models"

	"github.com/gin-gonic/gin"
)

// DailyStats 日常統計數據結構
type DailyStats struct {
	Date         string `json:"date"`
	Count        int    `json:"count"`
	UserCount    int    `json:"user_count"`
	TokenCount   int    `json:"token_count"`
	ServiceCount int    `json:"service_count"`
}

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
	result := db.DB.Raw(`
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

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取使用者服務統計數據", "details": result.Error.Error()})
		return
	}

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
	result := db.DB.Raw(`
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

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取使用者Token統計數據", "details": result.Error.Error()})
		return
	}

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
	result := db.DB.Raw(`
		SELECT 
			DATE(al.created_at) AS date,
			COUNT(*) AS count,
			SUM(request_size + response_size) AS total_size
		FROM 
			access_logs al
		WHERE 
			token_id = ?
		GROUP BY 
			date
		ORDER BY 
			date ASC
	`, tokenID).Scan(&stats)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取Token時間統計數據", "details": result.Error.Error()})
		return
	}

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
	result := db.DB.Raw(`
		SELECT 
			DATE(al.created_at) AS date,
			COUNT(*) AS count,
			SUM(request_size + response_size) AS total_size
		FROM 
			access_logs al
		WHERE 
			service_id = ?
		GROUP BY 
			date
		ORDER BY 
			date ASC
	`, serviceID).Scan(&stats)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取服務時間統計數據", "details": result.Error.Error()})
		return
	}

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
	result := db.DB.Raw(`
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

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取服務使用統計數據", "details": result.Error.Error()})
		return
	}

	if len(stats) == 0 {
		// 如果沒有數據，可能是因為還沒有任何訪問記錄
		// 創建一個空的資料集供前端顯示
		c.JSON(http.StatusOK, []ServiceUsageStat{})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// 獲取最近一段時間的使用統計
func GetRecentStats(c *gin.Context) {
	daysStr := c.DefaultQuery("days", "7")
	days, err := strconv.Atoi(daysStr)
	if err != nil {
		days = 7 // 默認7天
	}

	// 計算過去X天的開始日期（包括當天）
	startDate := time.Now().AddDate(0, 0, -days+1).Truncate(24 * time.Hour)
	endDate := time.Now().AddDate(0, 0, 1).Truncate(24 * time.Hour)

	var stats []DailyStats

	// 查詢每日統計數據（直接用字串型態的 created_at）
	result := db.DB.Raw(`
		SELECT 
			DATE(al.created_at) AS date,
			COUNT(*) AS count,
			COUNT(DISTINCT user_id) AS user_count,
			COUNT(DISTINCT token_id) AS token_count,
			COUNT(DISTINCT service_id) AS service_count
		FROM 
			access_logs al
		WHERE 
			al.created_at >= ? AND al.created_at < ?
		GROUP BY 
			date
		ORDER BY 
			date ASC
	`, startDate.Format("2006-01-02 00:00:00"), endDate.Format("2006-01-02 00:00:00")).Scan(&stats)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取最近統計數據", "details": result.Error.Error()})
		return
	}

	// 確保數據包含所有日期（包括無數據的日期）
	stats = fillMissingDates(stats, startDate, endDate)

	// 如果沒有數據，提供一個基礎的響應
	if len(stats) == 0 {
		// 創建一個包含從開始到結束日期的空數據序列
		dateRange := []time.Time{}

		// 生成日期範圍
		currentDate := startDate
		for currentDate.Before(endDate) || currentDate.Equal(endDate) {
			dateRange = append(dateRange, currentDate)
			currentDate = currentDate.AddDate(0, 0, 1)
		}

		// 為每個日期創建一個空記錄
		for _, date := range dateRange {
			stats = append(stats, DailyStats{
				Date:         date.Format("2006-01-02"),
				Count:        0,
				UserCount:    0,
				TokenCount:   0,
				ServiceCount: 0,
			})
		}
	}

	// 獲取最新的已註冊用戶、服務和Token總數（從資料庫）
	var userCount, serviceCount, tokenCount int64
	db.DB.Model(&models.User{}).Where("is_active = ?", true).Count(&userCount)
	db.DB.Model(&models.Service{}).Where("is_active = ?", true).Count(&serviceCount)
	db.DB.Model(&models.Token{}).Where("is_active = ?", true).Count(&tokenCount)

	// 確保每個記錄中的用戶、服務和Token數至少反映資料庫中的總數
	for i := range stats {
		if int64(stats[i].UserCount) < userCount {
			stats[i].UserCount = int(userCount)
		}
		if int64(stats[i].ServiceCount) < serviceCount {
			stats[i].ServiceCount = int(serviceCount)
		}
		if int64(stats[i].TokenCount) < tokenCount {
			stats[i].TokenCount = int(tokenCount)
		}
	}

	c.JSON(http.StatusOK, stats)
}

// 填充缺失的日期數據
func fillMissingDates(stats []DailyStats, startDate, endDate time.Time) []DailyStats {
	// 建立日期映射表
	dateMap := make(map[string]DailyStats)
	for _, stat := range stats {
		dateMap[stat.Date] = stat
	}

	result := make([]DailyStats, 0)
	currentDate := startDate

	// 遍歷每一天，確保每天都有數據
	for currentDate.Before(endDate) {
		dateStr := currentDate.Format("2006-01-02")

		// 如果該日期有數據，使用現有數據；否則使用空數據
		if stat, exists := dateMap[dateStr]; exists {
			result = append(result, stat)
		} else {
			result = append(result, DailyStats{
				Date:         dateStr,
				Count:        0,
				UserCount:    0,
				TokenCount:   0,
				ServiceCount: 0,
			})
		}

		currentDate = currentDate.AddDate(0, 0, 1)
	}

	return result
}

// 獲取使用者服務隨時間使用量統計
func GetUserServiceTimeStats(c *gin.Context) {
	userID := c.Param("user_id")

	type UserServiceTimeStat struct {
		UserID      uint   `json:"user_id"`
		Username    string `json:"username"`
		ServiceID   uint   `json:"service_id"`
		ServiceName string `json:"service_name"`
		Date        string `json:"date"`
		Count       int    `json:"count"`
		TotalSize   int64  `json:"total_size"`
	}

	var stats []UserServiceTimeStat

	// 查詢特定使用者的服務隨時間使用情況
	result := db.DB.Raw(`
		SELECT 
			al.user_id, 
			u.username,
			al.service_id, 
			s.name AS service_name,
			DATE(al.created_at) AS date,
			COUNT(*) AS count,
			SUM(al.request_size + al.response_size) AS total_size
		FROM 
			access_logs al
		JOIN 
			users u ON al.user_id = u.id
		JOIN 
			services s ON al.service_id = s.id
		WHERE 
			al.user_id = ?
		GROUP BY 
			al.service_id, date
		ORDER BY 
			date ASC, count DESC
	`, userID).Scan(&stats)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取使用者服務時間統計數據", "details": result.Error.Error()})
		return
	}

	// 如果要查詢所有用戶
	if userID == "all" {
		result = db.DB.Raw(`
			SELECT 
				al.user_id, 
				u.username,
				al.service_id, 
				s.name AS service_name,
				DATE(al.created_at) AS date,
				COUNT(*) AS count,
				SUM(al.request_size + al.response_size) AS total_size
			FROM 
				access_logs al
			JOIN 
				users u ON al.user_id = u.id
			JOIN 
				services s ON al.service_id = s.id
			GROUP BY 
				al.user_id, al.service_id, date
			ORDER BY 
				date ASC, count DESC
		`).Scan(&stats)

		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取所有使用者服務時間統計數據", "details": result.Error.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, stats)
}

// 獲取使用者Token隨時間使用量統計
func GetUserTokenTimeStats(c *gin.Context) {
	userID := c.Param("user_id")

	type UserTokenTimeStat struct {
		UserID      uint   `json:"user_id"`
		Username    string `json:"username"`
		TokenID     uint   `json:"token_id"`
		TokenValue  string `json:"token_value"`
		ServiceID   uint   `json:"service_id"`
		ServiceName string `json:"service_name"`
		Date        string `json:"date"`
		Count       int    `json:"count"`
		TotalSize   int64  `json:"total_size"`
	}

	var stats []UserTokenTimeStat

	// 查詢特定使用者的Token隨時間使用情況
	result := db.DB.Raw(`
		SELECT 
			al.user_id, 
			u.username,
			al.token_id,
			t.token_value,
			al.service_id, 
			s.name AS service_name,
			DATE(al.created_at) AS date,
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
		WHERE 
			al.user_id = ?
		GROUP BY 
			al.token_id, date
		ORDER BY 
			date ASC, count DESC
	`, userID).Scan(&stats)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取使用者Token時間統計數據", "details": result.Error.Error()})
		return
	}

	// 如果要查詢所有用戶
	if userID == "all" {
		result = db.DB.Raw(`
			SELECT 
				al.user_id, 
				u.username,
				al.token_id,
				t.token_value,
				al.service_id, 
				s.name AS service_name,
				DATE(al.created_at) AS date,
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
				al.user_id, al.token_id, date
			ORDER BY 
				date ASC, count DESC
		`).Scan(&stats)

		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取所有使用者Token時間統計數據", "details": result.Error.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, stats)
}
