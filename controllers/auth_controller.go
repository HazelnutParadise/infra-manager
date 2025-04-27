package controllers

import (
	"infra-manager/consts"
	"infra-manager/db"
	"infra-manager/middlewares"
	"infra-manager/models"
	"net/http"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

var SERVICE_NAME = consts.SERVICE_NAME

// LoginForm 登入表單結構
type LoginForm struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// ChangePasswordForm 修改密碼表單結構
type ChangePasswordForm struct {
	OldPassword     string `json:"old_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required"`
	ConfirmPassword string `json:"confirm_password" binding:"required"`
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
		"title": "登入" + " | " + SERVICE_NAME,
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

// ShowChangePasswordPage 顯示更改密碼頁面
func ShowChangePasswordPage(c *gin.Context) {
	c.HTML(http.StatusOK, "change_password.html", gin.H{
		"title": "更改管理員密碼" + " | " + SERVICE_NAME,
	})
}

// ChangePassword 處理更改密碼請求
func ChangePassword(c *gin.Context) {
	var form ChangePasswordForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "請提供所有必要的密碼資訊"})
		return
	}

	// 確認新密碼一致
	if form.NewPassword != form.ConfirmPassword {
		c.JSON(http.StatusBadRequest, gin.H{"error": "兩次輸入的新密碼不一致"})
		return
	}

	// 獲取當前登入的管理員
	session := sessions.Default(c)
	adminID := session.Get("admin_id")
	if adminID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "請先登入"})
		return
	}

	// 從資料庫獲取管理員資訊
	var admin models.Admin
	if err := db.DB.First(&admin, adminID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法找到管理員資訊"})
		return
	}

	// 驗證舊密碼
	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(form.OldPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "舊密碼不正確"})
		return
	}

	// 加密新密碼
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(form.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密碼加密失敗"})
		return
	}

	// 更新密碼
	admin.Password = string(hashedPassword)
	if err := db.DB.Save(&admin).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新密碼失敗"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "密碼已成功更新"})
}
