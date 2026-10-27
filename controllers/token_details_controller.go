package controllers

import (
	"github.com/gin-gonic/gin"
	"infra-manager/db"
	"infra-manager/models"
	"net/http"
	"time"
)

func UpdateTokenDetails(c *gin.Context) {
	id := c.Param("id")

	var token models.Token
	if err := db.DB.First(&token, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到Token"})
		return
	}

	var updatedToken struct {
		ExpiresAt   *time.Time `json:"expires_at"`
		IsPermanent bool       `json:"is_permanent"`
		Description string     `json:"description"` // 新增備註說明欄位
	}

	if err := c.ShouldBindJSON(&updatedToken); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的資料格式"})
		return
	}

	// Update only details so concurrent status changes are preserved.
	updates := map[string]interface{}{"description": updatedToken.Description}
	if updatedToken.IsPermanent {
		updates["expires_at"] = time.Now().AddDate(1000, 0, 0)
	} else if updatedToken.ExpiresAt != nil {
		updates["expires_at"] = *updatedToken.ExpiresAt
	}
	result := db.DB.Model(&models.Token{}).Where("id = ?", token.ID).Updates(updates)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新Token失敗"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到Token"})
		return
	}

	// 重新載入關聯資訊
	db.DB.Preload("User").Preload("Service").First(&token, token.ID)

	c.JSON(http.StatusOK, token)
}
