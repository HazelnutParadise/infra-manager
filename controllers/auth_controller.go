package controllers

import (
	"infra-manager/middlewares"
	"net/http"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// LoginForm 登入表單結構
type LoginForm struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// ShowLogin 顯示登入頁面
func ShowLogin(c *gin.Context) {
	// 檢查是否已登入
	session := sessions.Default(c)
	if session.Get("admin_id") != nil {
		// 已登入用戶重定向到儀表板
		c.Redirect(http.StatusFound, "/dashboard")
		return
	}

	c.HTML(http.StatusOK, "login.html", gin.H{
		"title": "登入",
	})
}

// Login 處理登入請求
func Login(c *gin.Context) {
	var form LoginForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "請提供有效的用戶名和密碼"})
		return
	}

	// 驗證憑證
	if success := middlewares.AdminLogin(form.Username, form.Password, c); success {
		c.JSON(http.StatusOK, gin.H{"message": "登入成功"})
	} else {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "無效的憑證"})
	}
}

// Logout 處理登出請求
func Logout(c *gin.Context) {
	session := sessions.Default(c)
	session.Clear()
	session.Save()

	c.Redirect(http.StatusFound, "/login")
}
