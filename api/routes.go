package api

import (
	"infra-manager/controllers"
	"infra-manager/middlewares"
	"infra-manager/services"
	"net/http"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
)

// SetupRouter 設置所有路由
func SetupRouter() *gin.Engine {
	r := gin.Default()

	// 設置 Session 存儲
	store := cookie.NewStore([]byte("infra_manager_secret"))
	store.Options(sessions.Options{
		Path:     "/",
		MaxAge:   86400, // 24小時
		HttpOnly: true,
		Secure:   false, // 本地開發環境設為 false
		SameSite: http.SameSiteLaxMode,
	})
	r.Use(sessions.Sessions("infra_manager_session", store))

	// 靜態文件服務
	r.Static("/static", "./static")

	// 管理介面HTML頁面
	r.LoadHTMLGlob("templates/*")
	r.GET("/", func(c *gin.Context) {
		c.HTML(200, "index.html", gin.H{
			"title": "基礎設施管理系統",
		})
	})

	// 登入頁面
	r.GET("/login", controllers.ShowLogin)
	r.POST("/auth/login", controllers.Login)
	r.GET("/logout", controllers.Logout)

	// 需要驗證的頁面
	authorized := r.Group("/")
	authorized.Use(middlewares.AdminAuth())
	{
		authorized.GET("/dashboard", func(c *gin.Context) {
			c.HTML(200, "dashboard.html", gin.H{
				"title": "儀表板",
			})
		})
		authorized.GET("/users", func(c *gin.Context) {
			c.HTML(200, "users.html", gin.H{
				"title": "用戶管理",
			})
		})
		authorized.GET("/services", func(c *gin.Context) {
			c.HTML(200, "services.html", gin.H{
				"title": "服務管理",
			})
		})
		authorized.GET("/tokens", func(c *gin.Context) {
			c.HTML(200, "tokens.html", gin.H{
				"title": "Token管理",
			})
		})
	}

	// API路由 - 需要管理員認證
	admin := r.Group("/admin")
	admin.Use(middlewares.AdminAuth())
	{
		// 用戶管理
		admin.GET("/users", controllers.GetAllUsers)
		admin.GET("/users/:id", controllers.GetUser)
		admin.POST("/users", controllers.CreateUser)
		admin.PUT("/users/:id", controllers.UpdateUser)
		admin.DELETE("/users/:id", controllers.DeleteUser)
		admin.PATCH("/users/:id/status", controllers.ToggleUserStatus)

		// 服務管理
		admin.GET("/services", controllers.GetAllServices)
		admin.GET("/services/:id", controllers.GetService)
		admin.POST("/services", controllers.CreateService)
		admin.PUT("/services/:id", controllers.UpdateService)
		admin.DELETE("/services/:id", controllers.DeleteService)
		admin.PATCH("/services/:id/status", controllers.ToggleServiceStatus)

		// Token管理
		admin.GET("/tokens", controllers.GetAllTokens)
		admin.GET("/tokens/:id", controllers.GetToken)
		admin.GET("/user-tokens/:user_id", controllers.GetUserTokens)
		admin.GET("/service-tokens/:service_id", controllers.GetServiceTokens)
		admin.POST("/tokens", controllers.CreateToken)
		admin.PUT("/tokens/:id", controllers.UpdateToken)
		admin.DELETE("/tokens/:id", controllers.DeleteToken)
		admin.PATCH("/tokens/:id/status", controllers.ToggleTokenStatus)

		// 統計數據
		admin.GET("/stats/users/services", controllers.GetUserServiceStats)
		admin.GET("/stats/users/tokens", controllers.GetUserTokenStats)
		admin.GET("/stats/tokens/:token_id/time", controllers.GetTokenTimeStats)
		admin.GET("/stats/services/:service_id/time", controllers.GetServiceTimeStats)
		admin.GET("/stats/services", controllers.GetServicesUsageStats)
		admin.GET("/stats/recent", controllers.GetRecentStats)
	}

	// API代理路由 - 使用TokenAuth中間件處理
	r.NoRoute(middlewares.TokenAuth(), middlewares.Logger(), services.ProxyRequest)

	return r
}
