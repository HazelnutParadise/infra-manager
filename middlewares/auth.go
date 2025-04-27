package middlewares

import (
	"net/http"
	"strings"
	"time"

	"infra-manager/db"
	"infra-manager/models"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// AdminAuth 是管理介面的認證中間件 (基於 session)
func AdminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		adminID := session.Get("admin_id")

		if adminID == nil {
			// 未登入，轉到登入頁面
			c.Redirect(http.StatusFound, "/login")
			c.Abort()
			return
		}

		// 檢查管理員是否存在
		var admin models.Admin
		if err := db.DB.First(&admin, adminID).Error; err != nil {
			// 管理員不存在，清除 session
			session.Clear()
			session.Save()
			c.Redirect(http.StatusFound, "/login")
			c.Abort()
			return
		}

		// 將管理員資訊存入上下文
		c.Set("admin", admin)
		c.Next()
	}
}

// 新增登入處理函數
func AdminLogin(username, password string, c *gin.Context) bool {
	var admin models.Admin
	if err := db.DB.Where("username = ?", username).First(&admin).Error; err != nil {
		return false
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(password)); err != nil {
		return false
	}

	// 登入成功，設置 session
	session := sessions.Default(c)
	session.Set("admin_id", admin.ID)
	session.Options(sessions.Options{
		Path:     "/",
		MaxAge:   3600 * 24, // 24 小時
		HttpOnly: true,
		Secure:   false, // 本地開發環境設為 false
		SameSite: http.SameSiteLaxMode,
	})
	session.Save()
	return true
}

// TokenAuth 是API的認證中間件
func TokenAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 從api路徑獲取實際路徑
		path := c.Param("path")
		path = strings.TrimPrefix(path, "/")

		parts := strings.SplitN(path, "/", 3)

		if len(parts) < 2 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "無效的API路徑"})
			return
		}

		serviceName := parts[0]
		tokenValue := parts[1]

		// 查詢服務
		var service models.Service
		if err := db.DB.Where("name = ? AND is_active = ?", serviceName, true).First(&service).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "找不到服務"})
			return
		}

		// 查詢Token
		var token models.Token
		if err := db.DB.Where("token_value = ? AND service_id = ? AND is_active = ?", tokenValue, service.ID, true).First(&token).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "無效的Token"})
			return
		}

		// 檢查Token是否過期 - 忽略 1000 年以上的過期時間 (視為永久有效)
		farFuture := time.Now().AddDate(900, 0, 0) // 900年後
		if token.ExpiresAt.Before(time.Now()) && token.ExpiresAt.Before(farFuture) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Token已過期"})
			return
		}

		// 檢查用戶狀態
		var user models.User
		if err := db.DB.Where("id = ? AND is_active = ?", token.UserID, true).First(&user).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "用戶已被停權"})
			return
		}

		// 儲存資訊到上下文
		c.Set("token", token)
		c.Set("service", service)
		c.Set("user", user)
		c.Set("targetEndpoint", "")
		if len(parts) > 2 {
			c.Set("targetEndpoint", parts[2])
		}

		c.Next()
	}
}

// Logger 中間件記錄API存取日誌
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()

		// 處理請求
		c.Next()

		// 不再過濾路徑前綴，所有通過 TokenAuth 的請求都會被記錄
		// 獲取上下文中的資訊
		tokenInterface, exists := c.Get("token")
		if !exists {
			return
		}

		token := tokenInterface.(models.Token)
		service := c.MustGet("service").(models.Service)

		// 計算處理時間
		duration := time.Since(startTime).Milliseconds()

		// 記錄存取日誌
		accessLog := models.AccessLog{
			UserID:       token.UserID,
			TokenID:      token.ID,
			ServiceID:    service.ID,
			Endpoint:     c.Request.URL.Path,
			Method:       c.Request.Method,
			StatusCode:   c.Writer.Status(),
			RequestSize:  c.Request.ContentLength,
			ResponseSize: int64(c.Writer.Size()),
			Duration:     duration,
		}

		if err := db.DB.Create(&accessLog).Error; err != nil {
			// 僅記錄錯誤，不影響請求處理
			c.Error(err)
		}
	}
}
