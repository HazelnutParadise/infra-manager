package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strconv"
	"time"

	"infra-manager/db"
	"infra-manager/models"

	"github.com/gin-gonic/gin"
)

// 生成一個隨機的Token字符串
func generateToken() string {
	b := make([]byte, 16) // 128位
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}

// 獲取所有Token
func GetAllTokens(c *gin.Context) {
	var tokens []models.Token

	// 預載入相關的使用者和服務資訊
	result := db.DB.Preload("User").Preload("Service").Find(&tokens)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取Token列表"})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

// 獲取特定使用者的所有Token
func GetUserTokens(c *gin.Context) {
	userID := c.Param("user_id")

	var tokens []models.Token
	result := db.DB.Where("user_id = ?", userID).Preload("User").Preload("Service").Find(&tokens)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取使用者Token"})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

// 獲取特定服務的所有Token
func GetServiceTokens(c *gin.Context) {
	serviceID := c.Param("service_id")

	var tokens []models.Token
	result := db.DB.Where("service_id = ?", serviceID).Preload("User").Preload("Service").Find(&tokens)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取服務Token"})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

// 獲取單一Token
func GetToken(c *gin.Context) {
	id := c.Param("id")

	var token models.Token
	result := db.DB.Preload("User").Preload("Service").First(&token, id)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到Token"})
		return
	}

	c.JSON(http.StatusOK, token)
}

// 創建Token
func CreateToken(c *gin.Context) {
	var tokenRequest struct {
		UserID      uint       `json:"user_id" binding:"required"`
		ServiceID   uint       `json:"service_id" binding:"required"`
		ExpiresAt   *time.Time `json:"expires_at"`
		IsPermanent bool       `json:"is_permanent"`
	}

	if err := c.ShouldBindJSON(&tokenRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的資料格式"})
		return
	}

	// 檢查使用者是否存在且處於啟用狀態
	var user models.User
	if err := db.DB.Where("id = ? AND is_active = ?", tokenRequest.UserID, true).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "找不到有效的使用者"})
		return
	}

	// 檢查服務是否存在且處於啟用狀態
	var service models.Service
	if err := db.DB.Where("id = ? AND is_active = ?", tokenRequest.ServiceID, true).First(&service).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "找不到有效的服務"})
		return
	}

	// 生成Token
	tokenValue := generateToken()
	if tokenValue == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Token生成失敗"})
		return
	}

	// 創建Token記錄
	token := models.Token{
		TokenValue: tokenValue,
		UserID:     tokenRequest.UserID,
		ServiceID:  tokenRequest.ServiceID,
		IsActive:   true,
	}

	// 設置過期時間或永久有效
	if tokenRequest.IsPermanent {
		// 設置一個很久的未來日期 (1000年後)
		farFuture := time.Now().AddDate(1000, 0, 0)
		token.ExpiresAt = farFuture
	} else if tokenRequest.ExpiresAt != nil {
		token.ExpiresAt = *tokenRequest.ExpiresAt
	} else {
		// 默認30天有效期
		token.ExpiresAt = time.Now().AddDate(0, 0, 30)
	}

	if err := db.DB.Create(&token).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法創建Token"})
		return
	}

	// 預載入關聯資訊
	db.DB.Preload("User").Preload("Service").First(&token, token.ID)

	c.JSON(http.StatusCreated, token)
}

// 更新Token
func UpdateToken(c *gin.Context) {
	id := c.Param("id")

	var token models.Token
	if err := db.DB.First(&token, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到Token"})
		return
	}

	var updatedToken struct {
		ExpiresAt   *time.Time `json:"expires_at"`
		IsActive    bool       `json:"is_active"`
		IsPermanent bool       `json:"is_permanent"`
	}

	if err := c.ShouldBindJSON(&updatedToken); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的資料格式"})
		return
	}

	// 更新 IsActive 狀態
	token.IsActive = updatedToken.IsActive

	// 根據是否永久有效設置過期時間
	if updatedToken.IsPermanent {
		// 設置一個很久的未來日期 (1000年後)
		farFuture := time.Now().AddDate(1000, 0, 0)
		token.ExpiresAt = farFuture
	} else if updatedToken.ExpiresAt != nil {
		token.ExpiresAt = *updatedToken.ExpiresAt
	}

	// 更新Token資訊
	if err := db.DB.Save(&token).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新Token失敗"})
		return
	}

	// 重新載入關聯資訊
	db.DB.Preload("User").Preload("Service").First(&token, token.ID)

	c.JSON(http.StatusOK, token)
}

// 刪除Token
func DeleteToken(c *gin.Context) {
	id := c.Param("id")

	var token models.Token
	if err := db.DB.First(&token, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到Token"})
		return
	}

	if err := db.DB.Delete(&token).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "刪除Token失敗"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Token已刪除"})
}

// 禁用或啟用Token
func ToggleTokenStatus(c *gin.Context) {
	id := c.Param("id")
	status := c.Query("status")

	isActive, err := strconv.ParseBool(status)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的狀態值"})
		return
	}

	var token models.Token
	if err := db.DB.First(&token, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到Token"})
		return
	}

	// 更新Token狀態
	db.DB.Model(&token).Update("is_active", isActive)

	c.JSON(http.StatusOK, gin.H{
		"message":   "Token狀態已更新",
		"is_active": isActive,
	})
}
