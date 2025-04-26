package proxy

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"infrastructure/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ProxyHandler 處理API代理
type ProxyHandler struct {
	DB *gorm.DB
}

// NewProxyHandler 創建新的代理處理器
func NewProxyHandler(db *gorm.DB) *ProxyHandler {
	return &ProxyHandler{DB: db}
}

// HandleRequest 處理代理請求
// URL格式: /<serviceName>/<tokenValue>/<targetPath>
func (p *ProxyHandler) HandleRequest(c *gin.Context) {
	startTime := time.Now()

	// 解析URL，獲取服務名稱和令牌
	urlPath := c.Request.URL.Path[1:] // 去掉開頭的斜線
	parts := strings.SplitN(urlPath, "/", 3)

	if len(parts) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的URL格式"})
		return
	}

	serviceName := parts[0]
	tokenValue := parts[1]

	// 檢索服務信息
	var service models.Service
	if err := p.DB.Where("name = ? AND is_active = ?", serviceName, true).First(&service).Error; err != nil {
		log.Printf("找不到服務 '%s' 或服務不活躍: %v", serviceName, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "無效的服務"})
		return
	}

	// 檢索令牌信息
	var token models.Token
	if err := p.DB.Preload("Person").Where("token_value = ? AND is_active = ?", tokenValue, true).First(&token).Error; err != nil {
		log.Printf("無效令牌 '%s': %v", tokenValue, err)
		c.JSON(http.StatusForbidden, gin.H{"error": "無效的令牌"})
		return
	}

	// 檢查令牌是否過期
	if token.ExpireAt.Before(time.Now()) {
		log.Printf("令牌 '%s' 已過期", tokenValue)
		c.JSON(http.StatusForbidden, gin.H{"error": "令牌已過期"})
		return
	}

	// 檢查令牌是否對應正確的服務
	if token.ServiceID != service.ID {
		log.Printf("令牌 '%s' 與服務 '%s' 不匹配", tokenValue, serviceName)
		c.JSON(http.StatusForbidden, gin.H{"error": "令牌與服務不匹配"})
		return
	}

	// 檢查用戶是否有權限訪問此服務
	if token.Person.IsActive == false {
		log.Printf("用戶 '%d' 已被停用", token.PersonID)
		c.JSON(http.StatusForbidden, gin.H{"error": "用戶已被停用"})
		return
	}

	// 檢查用戶是否有權限訪問此服務
	var permission models.Permission
	if err := p.DB.Where("person_id = ? AND service_id = ?", token.PersonID, service.ID).First(&permission).Error; err != nil {
		log.Printf("用戶 '%d' 沒有權限訪問服務 '%s'", token.PersonID, serviceName)
		c.JSON(http.StatusForbidden, gin.H{"error": "無權訪問此服務"})
		return
	}

	// 構建目標URL
	targetURLStr := service.URL
	if !strings.HasSuffix(targetURLStr, "/") {
		targetURLStr += "/"
	}

	if len(parts) > 2 && parts[2] != "" {
		targetURLStr = path.Join(targetURLStr, parts[2])
	}

	targetURL, err := url.Parse(targetURLStr)
	if err != nil {
		log.Printf("無法解析目標URL '%s': %v", targetURLStr, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服務配置錯誤"})
		return
	}

	// 讀取請求體
	var bodyBytes []byte
	if c.Request.Body != nil {
		bodyBytes, _ = io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	}

	// 創建代理請求
	proxyReq, err := http.NewRequest(c.Request.Method, targetURL.String(), io.NopCloser(bytes.NewBuffer(bodyBytes)))
	if err != nil {
		log.Printf("創建代理請求失敗: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法創建代理請求"})
		return
	}

	// 複製原始請求頭
	for k, values := range c.Request.Header {
		for _, v := range values {
			proxyReq.Header.Add(k, v)
		}
	}

	// 添加X-Forwarded-* 請求頭
	proxyReq.Header.Set("X-Forwarded-Host", c.Request.Host)
	proxyReq.Header.Set("X-Forwarded-For", c.ClientIP())
	proxyReq.Header.Set("X-Real-IP", c.ClientIP())

	// 添加自定義請求頭
	proxyReq.Header.Set("X-Proxy-User-ID", fmt.Sprintf("%d", token.PersonID))
	proxyReq.Header.Set("X-Proxy-User-Email", token.Person.Email)

	// 發送代理請求
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(proxyReq)
	if err != nil {
		log.Printf("代理請求失敗: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "無法連接到目標服務"})
		return
	}
	defer resp.Body.Close()

	// 計算請求處理時間
	elapsedTime := time.Since(startTime).Milliseconds()

	// 記錄使用統計
	usageStat := models.UsageStat{
		PersonID:      token.PersonID,
		ServiceID:     service.ID,
		TokenID:       token.ID,
		RequestPath:   c.Request.URL.Path,
		RequestMethod: c.Request.Method,
		ResponseCode:  resp.StatusCode,
		RequestTime:   startTime,
		Duration:      elapsedTime,
	}
	p.DB.Create(&usageStat)

	// 複製目標服務響應頭
	for k, values := range resp.Header {
		for _, v := range values {
			c.Header(k, v)
		}
	}

	// 讀取並發送目標服務響應體
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("讀取目標服務響應體失敗: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "讀取目標服務響應失敗"})
		return
	}

	c.Status(resp.StatusCode)
	c.Writer.Write(responseBody)
}
