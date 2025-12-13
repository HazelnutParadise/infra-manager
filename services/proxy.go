package services

import (
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"

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

	// 若有請求體，直接傳遞 Request body 給後端，避免將整個請求讀入記憶體
	if c.Request.Body != nil {
		proxyReq.Body = c.Request.Body
		proxyReq.ContentLength = c.Request.ContentLength
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

	// 不要把整個回應讀入記憶體，改以串流轉發以支援 chunked 或長連線

	// 將響應標頭複製至回應，但會針對 Location 與 Set-Cookie 做必要的調整
	for key, values := range proxyResp.Header {
		// 不修改 Location
		if strings.EqualFold(key, "Location") {
			for _, value := range values {
				c.Writer.Header().Add(key, value)
			}
			continue
		}

		// 處理 Set-Cookie，若包含 Domain 指定，則移除 Domain，改為代理用戶端網域
		if strings.EqualFold(key, "Set-Cookie") {
			for _, value := range values {
				cookieValue := regexp.MustCompile(`(?i)Domain=[^;]+;?\s?`).ReplaceAllString(value, "")
				c.Writer.Header().Add(key, cookieValue)
			}
			continue
		}

		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}

	// 添加禁止快取與 SEO 優先的標頭
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	// 防止搜尋引擎索引經由代理的內容
	c.Header("X-Robots-Tag", "noindex, nofollow")

	// 根據多種條件決定是否要串流 (Transfer-Encoding, Content-Length, Content-Type, 文件大小)
	if shouldStream(proxyResp) {
		c.Status(proxyResp.StatusCode)
		// HEAD 請求不應該寫 body
		if c.Request.Method != http.MethodHead {
			if _, copyErr := io.Copy(c.Writer, proxyResp.Body); copyErr != nil {
				c.Error(copyErr)
			}
		}
		return
	}

	// 非串流 - 先讀入（以便可能需要修改或計算長度），但不修改內容以避免覆寫
	respBody, err := io.ReadAll(proxyResp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "讀取代理響應失敗"})
		return
	}

	// 更新 Content-Length 為實際長度，並移除 Transfer-Encoding 以避免與 chunked 衝突
	c.Writer.Header().Set("Content-Length", strconv.Itoa(len(respBody)))
	c.Writer.Header().Del("Transfer-Encoding")
	c.Status(proxyResp.StatusCode)
	if c.Request.Method != http.MethodHead {
		if _, err := c.Writer.Write(respBody); err != nil {
			c.Error(err)
		}
	}
}

// shouldStream 判斷回應是否需要串流轉發。條件包括：
// - Transfer-Encoding 包含 chunked
// - Content-Length 不可得 (== -1)
// - Content-Type 為 text/event-stream 或 multipart/x-mixed-replace
// - Content-Length 超過預設閾值
// - HTTP/2 不會有 chunked header，但是會以 Content-Length == -1 的情況出現
func shouldStream(resp *http.Response) bool {
	if resp == nil {
		return false
	}

	te := strings.ToLower(resp.Header.Get("Transfer-Encoding"))
	if strings.Contains(te, "chunked") {
		return true
	}

	ct := strings.ToLower(resp.Header.Get("Content-Type"))
	if strings.HasPrefix(ct, "text/event-stream") || strings.HasPrefix(ct, "multipart/x-mixed-replace") {
		return true
	}

	// ContentLength == -1：沒有指定長度，多半是串流/長連線或使用 HTTP/2
	if resp.ContentLength == -1 {
		return true
	}

	// 其他情況不串流
	return false
}
