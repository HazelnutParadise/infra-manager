package controllers

import (
	"net/http"
	"strconv"

	"infra-manager/db"
	"infra-manager/models"

	"github.com/gin-gonic/gin"
)

// 獲取所有使用者
func GetAllUsers(c *gin.Context) {
	var users []models.User
	result := db.DB.Find(&users)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取使用者列表"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// 獲取單一使用者
func GetUser(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	result := db.DB.First(&user, id)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到使用者"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// 創建使用者
func CreateUser(c *gin.Context) {
	var user models.User
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的資料格式"})
		return
	}

	result := db.DB.Create(&user)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法創建使用者"})
		return
	}

	c.JSON(http.StatusCreated, user)
}

// 更新使用者
func UpdateUser(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := db.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到使用者"})
		return
	}

	var updatedUser struct {
		Username string `json:"username"`
		IsActive bool   `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&updatedUser); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的資料格式"})
		return
	}

	// 更新使用者資訊
	db.DB.Model(&user).Updates(models.User{
		Username: updatedUser.Username,
		IsActive: updatedUser.IsActive,
	})

	c.JSON(http.StatusOK, user)
}

// 刪除使用者
func DeleteUser(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := db.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到使用者"})
		return
	}

	// 檢查是否有相關的Token
	var tokenCount int64
	db.DB.Model(&models.Token{}).Where("user_id = ?", user.ID).Count(&tokenCount)
	if tokenCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無法刪除使用者，請先刪除相關的Token"})
		return
	}

	if err := db.DB.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "刪除使用者失敗"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "使用者已刪除"})
}

// 禁用或啟用使用者
func ToggleUserStatus(c *gin.Context) {
	id := c.Param("id")
	status := c.Query("status")

	isActive, err := strconv.ParseBool(status)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的狀態值"})
		return
	}

	var user models.User
	if err := db.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到使用者"})
		return
	}

	// 更新使用者狀態
	db.DB.Model(&user).Update("is_active", isActive)

	c.JSON(http.StatusOK, gin.H{
		"message":   "使用者狀態已更新",
		"is_active": isActive,
	})
}
