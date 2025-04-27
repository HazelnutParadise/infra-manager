package services

import (
	"bytes"
	"io"
	"net/http"
	"net/url"
	"path"

	"infra-manager/models"

	"github.com/gin-gonic/gin"
)

// ProxyRequest 負責處理API請求並轉發到目標服務
func ProxyRequest(c *gin.Context) {
	// 從上下文中獲取數據
	service := c.MustGet("service").(models.Service)
	targetEndpoint, _ := c.Get("targetEndpoint")
	targetEndpointStr, _ := targetEndpoint.(string)

	// 構建目標URL
	targetURL, err := url.Parse(service.BaseURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服務URL配置錯誤"})
		return
	}

	// 拼接完整的目標路徑
	targetURL.Path = path.Join(targetURL.Path, targetEndpointStr)

	// 複製URL查詢參數
	targetURL.RawQuery = c.Request.URL.RawQuery

	// 創建新的請求
	proxyReq, err := http.NewRequest(c.Request.Method, targetURL.String(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法創建代理請求"})
		return
	}

	// 如果有請求體則讀取
	var bodyBytes []byte
	if c.Request.Body != nil {
		bodyBytes, _ = io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		proxyReq.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		proxyReq.ContentLength = int64(len(bodyBytes))
	}

	// 複製標頭
	for key, values := range c.Request.Header {
		// 略過Host標頭，因為它會被http.Client設定
		if key != "Host" {
			for _, value := range values {
				proxyReq.Header.Add(key, value)
			}
		}
	}

	// 發送請求
	client := &http.Client{}
	proxyResp, err := client.Do(proxyReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "代理請求失敗", "details": err.Error()})
		return
	}
	defer proxyResp.Body.Close()

	// 讀取響應
	respBody, err := io.ReadAll(proxyResp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "讀取代理響應失敗"})
		return
	}

	// 設置響應標頭
	for key, values := range proxyResp.Header {
		for _, value := range values {
			c.Header(key, value)
		}
	}

	// 設置狀態碼並發送響應
	c.Status(proxyResp.StatusCode)
	c.Writer.Write(respBody)
}
