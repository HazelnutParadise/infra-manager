package services

import (
	"bytes"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
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

	// 將響應標頭複製至回應，但會針對 Location 與 Set-Cookie 做必要的調整
	for key, values := range proxyResp.Header {
		// 處理 Location 重導
		if strings.EqualFold(key, "Location") {
			for _, value := range values {
				// 若 Location 指向原始後端主機，改寫為對應的代理路徑
				// 例如: http://ai:8080/foo -> /use/<service.Name>/foo
				loc := value
				// 解析後端主機
				backendHost := targetURL.Host
				if strings.Contains(loc, backendHost) {
					// 移除協議與 host，留下一個以 / 開頭的路徑
					// 如果 loc 包含查詢字串則保留
					// 找到 loc 開始於 backendHost 的地方
					// 考慮到 loc 可以是 http://backend/..., https://backend/...
					// 先移除前綴
					loc = strings.ReplaceAll(loc, "http://"+backendHost, "")
					loc = strings.ReplaceAll(loc, "https://"+backendHost, "")
					loc = strings.ReplaceAll(loc, "//"+backendHost, "")
					// 組成代理路徑
					proxyPrefix := path.Join("/use", service.Name)
					if !strings.HasPrefix(loc, "/") {
						loc = "/" + loc
					}
					rewritten := proxyPrefix + loc
					c.Header(key, rewritten)
				} else {
					c.Header(key, value)
				}
			}
			continue
		}

		// 處理 Set-Cookie，若包含 Domain 指定，則移除 Domain，改為代理用戶端網域
		if strings.EqualFold(key, "Set-Cookie") {
			for _, value := range values {
				// 移除 Domain=...; 以避免無法在代理網域寫入 cookie
				cookieValue := regexp.MustCompile(`(?i)Domain=[^;]+;?\s?`).ReplaceAllString(value, "")
				c.Header(key, cookieValue)
			}
			continue
		}

		for _, value := range values {
			c.Header(key, value)
		}
	}

	// 添加禁止快取與 SEO 優先的標頭
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	// 防止搜尋引擎索引經由代理的內容
	c.Header("X-Robots-Tag", "noindex, nofollow")

	// 如果是 HTML 或 CSS/JavaScript，嘗試替換內部主機 (例如 ai:8080) 為代理路徑 (/use/<service.Name>)
	contentType := proxyResp.Header.Get("Content-Type")
	bodyToSend := respBody
	if contentType != "" && (strings.Contains(contentType, "text/html") || strings.Contains(contentType, "text/css") || strings.Contains(contentType, "javascript")) {
		bodyStr := string(respBody)

		// 構建代理前綴，例如 /use/localai
		proxyPrefix := path.Join("/use", service.Name)

		// 準備要替換的目標主機 (host:port)
		backendHost := targetURL.Host

		// 將各種 URL 形式重寫:
		// https://backendHost/xxx -> /use/<service.Name>/xxx
		// http://backendHost/xxx -> /use/<service.Name>/xxx
		// //backendHost/xxx -> /use/<service.Name>/xxx
		bodyStr = strings.ReplaceAll(bodyStr, "https://"+backendHost, proxyPrefix)
		bodyStr = strings.ReplaceAll(bodyStr, "http://"+backendHost, proxyPrefix)
		bodyStr = strings.ReplaceAll(bodyStr, "//"+backendHost, proxyPrefix)

		// 針對 href/src/action 等屬性（包含引號）的替換，避免誤改一般文字
		// 使用正則式來尋找 (href|src|action)="(optional scheme)backendHost/path"
		attrRe := regexp.MustCompile(`(href|src|action)=(['"])(https?:\/\/|\\\/\\\/)?` + regexp.QuoteMeta(backendHost) + `(\/[^'\"]*)?\2`)
		bodyStr = attrRe.ReplaceAllString(bodyStr, `$1=$2`+proxyPrefix+`$4$2`)

		// base href 的處理: <base href="http://backendHost/"> -> <base href="/use/<serviceName>/">
		baseRe := regexp.MustCompile(`(?i)<base[^>]*href=(['"])(https?:\/\/)?` + regexp.QuoteMeta(backendHost) + `(\/[^'\"]*)?\1[^>]*>`)
		bodyStr = baseRe.ReplaceAllString(bodyStr, `<base href="`+proxyPrefix+`$3">`)

		// 若為 CSS 或 JS，簡單替換出現的 backendHost
		if !strings.Contains(contentType, "text/html") {
			bodyStr = strings.ReplaceAll(bodyStr, backendHost, proxyPrefix)
		}

		// 在 html 中加入 meta robots 標籤，讓搜尋引擎不要索引
		if strings.Contains(contentType, "text/html") {
			robotsRe := regexp.MustCompile(`(?i)<meta\s+name=["']robots["'][^>]*>`)
			if !robotsRe.MatchString(bodyStr) {
				// 尋找 head 標籤並在前面插入
				headRe := regexp.MustCompile(`(?i)<head[^>]*>`)
				if headRe.MatchString(bodyStr) {
					bodyStr = headRe.ReplaceAllString(bodyStr, headRe.FindString(bodyStr)+"\n    <meta name=\"robots\" content=\"noindex, nofollow\">")
				} else {
					// fallback: 插入到文件開頭
					bodyStr = "<meta name=\"robots\" content=\"noindex, nofollow\">\n" + bodyStr
				}
			}
		}
		bodyToSend = []byte(bodyStr)
		// 移除 Content-Length 以讓 gin 自動計算
		c.Writer.Header().Del("Content-Length")
	}

	// 設置狀態碼並發送響應
	c.Status(proxyResp.StatusCode)
	c.Writer.Write(bodyToSend)
}
