package middlewares

import "github.com/gin-gonic/gin"

// NoIndex 將 X-Robots-Tag header 設為 noindex, nofollow，防止搜尋引擎索引
func NoIndex() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Robots-Tag", "noindex, nofollow")
		c.Next()
	}
}
