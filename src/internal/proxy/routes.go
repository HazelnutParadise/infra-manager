package proxy

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// RegisterRoutes 註冊代理相關的路由
func RegisterRoutes(router *gin.Engine, db *gorm.DB) {
	proxyHandler := NewProxyHandler(db)

	// 所有API請求都通過此處理函數
	// URL格式: /<serviceName>/<tokenValue>/<targetPath>
	router.Any("/:serviceName/:tokenValue/*targetPath", proxyHandler.HandleRequest)
	router.Any("/:serviceName/:tokenValue", proxyHandler.HandleRequest)
}
