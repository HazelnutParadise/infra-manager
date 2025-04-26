// proxy.go

package main

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func runProxy(r *gin.Engine) {
	r.Any("/:svc/:token/*path", func(c *gin.Context) {
		svc := c.Param("svc")
		tokenStr := c.Param("token")
		path := c.Param("path")

		// 驗證 token
		var tk Token
		if err := db.Where("token = ? AND disabled = ?", tokenStr, false).First(&tk).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "invalid or disabled token"})
			return
		}
		// 驗證 service
		var svcRec Service
		if err := db.First(&svcRec, tk.ServiceID).Error; err != nil ||
			strings.ToLower(svcRec.Name) != strings.ToLower(svc) ||
			svcRec.Disabled {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "token not allowed for service"})
			return
		}

		// 建立使用紀錄
		db.Create(&UsageLog{
			TokenID:   tk.ID,
			ServiceID: tk.ServiceID,
			CreatedAt: time.Now(),
		})

		// 反向代理到 http://{svc}:80
		target := "http://" + svc + ":80"
		u, _ := url.Parse(target)
		proxy := httputil.NewSingleHostReverseProxy(u)

		c.Request.URL.Path = path
		proxy.ServeHTTP(c.Writer, c.Request)
	})
}
