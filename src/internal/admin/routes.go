package admin

import (
	"net/http"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// RegisterRoutes 註冊管理介面相關的路由
func RegisterRoutes(router *gin.Engine, db *gorm.DB) {
	adminHandler := NewAdminHandler(db)

	// 設置session中間件
	store := cookie.NewStore([]byte("secret_session_key"))
	store.Options(sessions.Options{
		Path:     "/admin",
		MaxAge:   3600 * 24, // 1天
		HttpOnly: true,
	})
	adminGroup := router.Group("/admin")
	adminGroup.Use(sessions.Sessions("admin_session", store))

	// 公開路由
	adminGroup.GET("/login", adminHandler.Login)
	adminGroup.POST("/login", adminHandler.Login)

	// 需要身份認證的路由
	authorized := adminGroup.Group("/")
	authorized.Use(AuthMiddleware())
	{
		authorized.GET("/logout", adminHandler.Logout)
		authorized.GET("/dashboard", adminHandler.Dashboard)

		// 人員管理
		authorized.GET("/persons", adminHandler.ListPersons)
		authorized.GET("/persons/create", adminHandler.CreatePerson)
		authorized.POST("/persons/create", adminHandler.CreatePerson)
		authorized.GET("/persons/update/:id", adminHandler.UpdatePerson)
		authorized.POST("/persons/update/:id", adminHandler.UpdatePerson)
		authorized.POST("/persons/delete/:id", adminHandler.DeletePerson)

		// 服務管理
		authorized.GET("/services", adminHandler.ListServices)
		authorized.GET("/services/create", adminHandler.CreateService)
		authorized.POST("/services/create", adminHandler.CreateService)
		authorized.GET("/services/update/:id", adminHandler.UpdateService)
		authorized.POST("/services/update/:id", adminHandler.UpdateService)
		authorized.POST("/services/delete/:id", adminHandler.DeleteService)

		// 令牌管理
		authorized.GET("/tokens", adminHandler.ListTokens)
		authorized.GET("/tokens/create", adminHandler.CreateToken)
		authorized.POST("/tokens/create", adminHandler.CreateToken)
		authorized.GET("/tokens/update/:id", adminHandler.UpdateToken)
		authorized.POST("/tokens/update/:id", adminHandler.UpdateToken)
		authorized.POST("/tokens/delete/:id", adminHandler.DeleteToken)

		// 權限管理
		authorized.GET("/permissions", adminHandler.ListPermissions)
		authorized.GET("/permissions/create", adminHandler.CreatePermission)
		authorized.POST("/permissions/create", adminHandler.CreatePermission)
		authorized.POST("/permissions/delete/:id", adminHandler.DeletePermission)
	}
}

// AuthMiddleware 身份認證中間件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		userID := session.Get("user_id")

		if userID == nil {
			c.Redirect(http.StatusFound, "/admin/login")
			c.Abort()
			return
		}

		c.Next()
	}
}
