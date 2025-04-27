package controllers

import (
	"net/http"
	"strconv"

	"infra-manager/db"
	"infra-manager/models"

	"github.com/gin-gonic/gin"
)

// 獲取所有服務
func GetAllServices(c *gin.Context) {
	var services []models.Service
	result := db.DB.Find(&services)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法獲取服務列表"})
		return
	}

	c.JSON(http.StatusOK, services)
}

// 獲取單一服務
func GetService(c *gin.Context) {
	id := c.Param("id")

	var service models.Service
	result := db.DB.First(&service, id)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到服務"})
		return
	}

	c.JSON(http.StatusOK, service)
}

// 創建服務
func CreateService(c *gin.Context) {
	var service models.Service
	if err := c.ShouldBindJSON(&service); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的資料格式"})
		return
	}

	result := db.DB.Create(&service)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法創建服務"})
		return
	}

	c.JSON(http.StatusCreated, service)
}

// 更新服務
func UpdateService(c *gin.Context) {
	id := c.Param("id")

	var service models.Service
	if err := db.DB.First(&service, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到服務"})
		return
	}

	var updatedService struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		BaseURL     string `json:"base_url"`
		IsActive    bool   `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&updatedService); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的資料格式"})
		return
	}

	// 更新服務資訊
	db.DB.Model(&service).Updates(models.Service{
		Name:        updatedService.Name,
		Description: updatedService.Description,
		BaseURL:     updatedService.BaseURL,
		IsActive:    updatedService.IsActive,
	})

	c.JSON(http.StatusOK, service)
}

// 刪除服務
func DeleteService(c *gin.Context) {
	id := c.Param("id")

	var service models.Service
	if err := db.DB.First(&service, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到服務"})
		return
	}

	// 檢查是否有相關的Token
	var tokenCount int64
	db.DB.Model(&models.Token{}).Where("service_id = ?", service.ID).Count(&tokenCount)
	if tokenCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無法刪除服務，請先刪除相關的Token"})
		return
	}

	if err := db.DB.Delete(&service).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "刪除服務失敗"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "服務已刪除"})
}

// 禁用或啟用服務
func ToggleServiceStatus(c *gin.Context) {
	id := c.Param("id")
	status := c.Query("status")

	isActive, err := strconv.ParseBool(status)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的狀態值"})
		return
	}

	var service models.Service
	if err := db.DB.First(&service, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到服務"})
		return
	}

	// 更新服務狀態
	db.DB.Model(&service).Update("is_active", isActive)

	c.JSON(http.StatusOK, gin.H{
		"message":   "服務狀態已更新",
		"is_active": isActive,
	})
}
