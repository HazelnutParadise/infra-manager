package controllers

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"infra-manager/db"
	"infra-manager/models"
	"net/http"
	"unicode/utf8"
)

// UpdateServiceDetails edits service metadata while preserving its current status.
func UpdateServiceDetails(c *gin.Context) {
	var service models.Service
	if err := db.DB.First(&service, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到服務"})
		return
	}
	var input struct {
		Name        string  `json:"name"`
		Description string  `json:"description"`
		BaseURL     string  `json:"base_url"`
		Type        *string `json:"type"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的資料格式"})
		return
	}
	if input.Type != nil && utf8.RuneCountInString(*input.Type) > 64 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "服務類型最多 64 字"})
		return
	}
	err := db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&service).Updates(models.Service{Name: input.Name, Description: input.Description, BaseURL: input.BaseURL}).Error; err != nil {
			return err
		}
		if input.Type != nil {
			return tx.Model(&service).Update("type", *input.Type).Error
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法更新服務"})
		return
	}
	c.JSON(http.StatusOK, service)
}
