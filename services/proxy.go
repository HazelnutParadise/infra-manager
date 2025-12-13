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

// ProxyRequest 代理請求並轉發至後端 service。主要行為：
//   - 轉發原始請求（包含 method、headers 與 body），盡量直接串流請求 body 到後端。
//   - 根據回應內容自動判斷是否以串流方式（Transfer-Encoding: chunked、Content-Length == -1、SSE/Multipart）
//     來轉發。如果判定為串流，直接使用 io.Copy 串流回應；否則會在代理端完整讀取回應後再回傳（以便正確計算 Content-Length）。
//   - 不會對回應 body 做 URL 或內容改寫（避免意外破壞後端回應）。
//   - 會複製並轉發大部分標頭，但對 Set-Cookie 會移除 Domain 屬性（以利 cookie 在代理網域設定）。
//   - 會保留 Location header 的值（不做自動改寫）。
//   - 會為代理回應添加禁止搜尋引擎索引的 header (X-Robots-Tag) 與 Cache-Control 相關 header。
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

	// 根據回應特性（如 chunked、Content-Length 未指定、SSE 等），決定是否以串流轉發。
	// 若為串流（或沒有明確 Content-Length），會使用 io.Copy 逐塊轉發以支援長連線/串流；
	// 否則會先完整讀取後端回應（以計算並設置 Content-Length），再回傳給客戶端。

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

	// 根據多種條件決定是否要串流 (Transfer-Encoding, Content-Length, Content-Type)
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
// - Transfer-Encoding 包含 chunked（HTTP/1.1 chunked 傳輸）
// - Content-Length 不可得（== -1，常見於 HTTP/2 或沒有指定長度的回應）
// - Content-Type 為 text/event-stream 或 multipart/x-mixed-replace（SSE 或 multipart streaming）
// 注意：我們不再基於回應大小（閾值）來判斷是否串流；判斷以實際的傳輸意圖為主。
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
