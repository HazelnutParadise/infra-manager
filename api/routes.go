package api

import (
	"infra-manager/consts"
	"infra-manager/controllers"
	"infra-manager/middlewares"
	"infra-manager/services"
	"net/http"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
)

var SERVICE_NAME = consts.SERVICE_NAME

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
	// robots.txt，告訴搜尋引擎不要索引 /use/ 路徑
	r.StaticFile("/robots.txt", "./static/robots.txt")

	// 管理介面HTML頁面
	r.LoadHTMLGlob("templates/*")

	// 公開路由 - 不需要驗證
	r.GET("/login", controllers.ShowLogin)
	r.POST("/auth/login", controllers.Login)
	r.GET("/logout", controllers.Logout)

	// 主頁重定向到儀表板（如果已登入）或登入頁（如果未登入）
	r.GET("/", func(c *gin.Context) {
		session := sessions.Default(c)
		if session.Get("admin_id") != nil {
			c.Redirect(http.StatusFound, "/dashboard")
		} else {
			c.Redirect(http.StatusFound, "/login")
		}
	})

	// 需要驗證的頁面
	authorized := r.Group("/")
	authorized.Use(middlewares.AdminAuth())
	{
		authorized.GET("/dashboard", func(c *gin.Context) {
			c.HTML(200, "dashboard.html", gin.H{
				"title": "儀表板" + " | " + SERVICE_NAME,
			})
		})
		authorized.GET("/users", func(c *gin.Context) {
			c.HTML(200, "users.html", gin.H{
				"title": "用戶管理" + " | " + SERVICE_NAME,
			})
		})
		authorized.GET("/services", func(c *gin.Context) {
			c.HTML(200, "services.html", gin.H{
				"title": "服務管理" + " | " + SERVICE_NAME,
			})
		})
		authorized.GET("/tokens", func(c *gin.Context) {
			c.HTML(200, "tokens.html", gin.H{
				"title": "Token管理" + " | " + SERVICE_NAME,
			})
		})
		// 添加修改密碼頁面
		authorized.GET("/change-password", controllers.ShowChangePasswordPage)
	}

	// API路由 - 需要管理員認證
	admin := r.Group("/admin")
	admin.Use(middlewares.AdminAuth())
	{
		// 密碼管理
		admin.POST("/change-password", controllers.ChangePassword)

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

		// 統計數據相關路由
		statsRoutes := admin.Group("/stats")
		{
			// 基本統計數據
			statsRoutes.GET("/recent", controllers.GetRecentStats)
			statsRoutes.GET("/services", controllers.GetServicesUsageStats)

			// 服務相關統計
			statsRoutes.GET("/services/:service_id/time", controllers.GetServiceTimeStats)

			// 使用者相關統計
			statsRoutes.GET("/users/services", controllers.GetUserServiceStats)
			statsRoutes.GET("/users/tokens", controllers.GetUserTokenStats)

			// 使用者服務使用量時間序列
			statsRoutes.GET("/users/:user_id/services/time", controllers.GetUserServiceTimeStats)

			// 使用者Token使用量時間序列 - 新增端點
			statsRoutes.GET("/users/:user_id/tokens/time", controllers.GetUserTokenTimeStats)

			// Token使用量時間序列
			statsRoutes.GET("/tokens/:token_id/time", controllers.GetTokenTimeStats)
		}
	}

	// API代理路由 - 使用TokenAuth中間件處理
	// 主要路由移至 /use/*，但保留 /api/* 作為相容備援
	serviceGroupUse := r.Group("/use")
	serviceGroupUse.Any("/*path", middlewares.NoIndex(), middlewares.TokenAuth(), middlewares.Logger(), services.ProxyRequest)

	// 保留舊的 /api/* 路徑以便相容舊有的客戶端
	// 但統一回傳 301 Moved Permanently，導向新的 /use/* 路徑
	serviceGroupOld := r.Group("/api")
	serviceGroupOld.Any("/*path", middlewares.NoIndex(), func(c *gin.Context) {
		// 保留原本的 path 與 query string
		target := "/use" + c.Param("path")
		if c.Request.URL.RawQuery != "" {
			target += "?" + c.Request.URL.RawQuery
		}
		// 明確在重導前標示不要索引，避免舊有 /api/ 被搜尋引擎記錄
		c.Header("X-Robots-Tag", "noindex, nofollow")
		c.Redirect(http.StatusMovedPermanently, target)
	})

	return r
}
