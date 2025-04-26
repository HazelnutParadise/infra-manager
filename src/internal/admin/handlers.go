package admin

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"time"

	"infrastructure/internal/models"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AdminHandler 處理管理介面相關的請求
type AdminHandler struct {
	DB *gorm.DB
}

// NewAdminHandler 創建新的管理介面處理器
func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{DB: db}
}

// HashPassword 密碼雜湊函數
func HashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}

// GenerateToken 生成隨機令牌
func GenerateToken(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	seededRand := rand.New(rand.NewSource(time.Now().UnixNano()))
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[seededRand.Intn(len(charset))]
	}
	return string(b)
}

// Login 處理登入請求
func (h *AdminHandler) Login(c *gin.Context) {
	if c.Request.Method == http.MethodGet {
		c.HTML(http.StatusOK, "login.html", nil)
		return
	}

	var form struct {
		Username string `form:"username" binding:"required"`
		Password string `form:"password" binding:"required"`
	}

	if err := c.ShouldBind(&form); err != nil {
		c.HTML(http.StatusBadRequest, "login.html", gin.H{
			"error": "請提供用戶名和密碼",
		})
		return
	}

	var admin models.Admin
	if err := h.DB.Where("username = ?", form.Username).First(&admin).Error; err != nil {
		c.HTML(http.StatusUnauthorized, "login.html", gin.H{
			"error": "用戶名或密碼錯誤",
		})
		return
	}

	// 檢查密碼是否匹配
	if admin.PasswordHash != HashPassword(form.Password) {
		c.HTML(http.StatusUnauthorized, "login.html", gin.H{
			"error": "用戶名或密碼錯誤",
		})
		return
	}

	// 設置session
	session := sessions.Default(c)
	session.Set("user_id", admin.ID)
	session.Set("username", admin.Username)
	session.Save()

	c.Redirect(http.StatusFound, "/admin/dashboard")
}

// Logout 處理登出請求
func (h *AdminHandler) Logout(c *gin.Context) {
	session := sessions.Default(c)
	session.Clear()
	session.Save()
	c.Redirect(http.StatusFound, "/admin/login")
}

// Dashboard 顯示儀表板頁面
func (h *AdminHandler) Dashboard(c *gin.Context) {
	// 查詢統計資料
	var personCount, serviceCount, tokenCount int64
	h.DB.Model(&models.Person{}).Count(&personCount)
	h.DB.Model(&models.Service{}).Count(&serviceCount)
	h.DB.Model(&models.Token{}).Count(&tokenCount)

	// 獲取最近的使用統計數據（最近一週）
	oneWeekAgo := time.Now().AddDate(0, 0, -7)
	var recentStats []models.UsageStat
	h.DB.Where("request_time > ?", oneWeekAgo).
		Preload("Person").
		Preload("Service").
		Order("request_time desc").
		Limit(10).
		Find(&recentStats)

	// 獲取服務使用總量
	type ServiceUsage struct {
		ServiceName string
		Count       int64
	}
	var serviceUsage []ServiceUsage
	h.DB.Model(&models.UsageStat{}).
		Select("services.name as service_name, count(*) as count").
		Joins("JOIN services ON services.id = usage_stats.service_id").
		Group("services.name").
		Scan(&serviceUsage)

	c.HTML(http.StatusOK, "dashboard.html", gin.H{
		"personCount":  personCount,
		"serviceCount": serviceCount,
		"tokenCount":   tokenCount,
		"recentStats":  recentStats,
		"serviceUsage": serviceUsage,
	})
}

// ListPersons 顯示人員列表
func (h *AdminHandler) ListPersons(c *gin.Context) {
	var persons []models.Person
	h.DB.Find(&persons)

	c.HTML(http.StatusOK, "persons.html", gin.H{
		"persons": persons,
	})
}

// CreatePerson 處理創建人員的請求
func (h *AdminHandler) CreatePerson(c *gin.Context) {
	if c.Request.Method == http.MethodGet {
		c.HTML(http.StatusOK, "person_form.html", gin.H{
			"action": "create",
		})
		return
	}

	var form struct {
		Name   string `form:"name" binding:"required"`
		Email  string `form:"email" binding:"required,email"`
		Active bool   `form:"active"`
	}

	if err := c.ShouldBind(&form); err != nil {
		c.HTML(http.StatusBadRequest, "person_form.html", gin.H{
			"error":  "表單數據無效",
			"action": "create",
		})
		return
	}

	person := models.Person{
		Name:     form.Name,
		Email:    form.Email,
		IsActive: form.Active,
	}

	if err := h.DB.Create(&person).Error; err != nil {
		c.HTML(http.StatusInternalServerError, "person_form.html", gin.H{
			"error":  "創建人員失敗: " + err.Error(),
			"action": "create",
			"person": person,
		})
		return
	}

	c.Redirect(http.StatusFound, "/admin/persons")
}

// UpdatePerson 處理更新人員的請求
func (h *AdminHandler) UpdatePerson(c *gin.Context) {
	id := c.Param("id")
	personID, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		c.HTML(http.StatusBadRequest, "error.html", gin.H{
			"error": "無效的人員ID",
		})
		return
	}

	var person models.Person
	if err := h.DB.First(&person, personID).Error; err != nil {
		c.HTML(http.StatusNotFound, "error.html", gin.H{
			"error": "找不到指定的人員",
		})
		return
	}

	if c.Request.Method == http.MethodGet {
		c.HTML(http.StatusOK, "person_form.html", gin.H{
			"action": "update",
			"person": person,
		})
		return
	}

	var form struct {
		Name   string `form:"name" binding:"required"`
		Email  string `form:"email" binding:"required,email"`
		Active bool   `form:"active"`
	}

	if err := c.ShouldBind(&form); err != nil {
		c.HTML(http.StatusBadRequest, "person_form.html", gin.H{
			"error":  "表單數據無效",
			"action": "update",
			"person": person,
		})
		return
	}

	person.Name = form.Name
	person.Email = form.Email
	person.IsActive = form.Active

	if err := h.DB.Save(&person).Error; err != nil {
		c.HTML(http.StatusInternalServerError, "person_form.html", gin.H{
			"error":  "更新人員失敗: " + err.Error(),
			"action": "update",
			"person": person,
		})
		return
	}

	c.Redirect(http.StatusFound, "/admin/persons")
}

// DeletePerson 處理刪除人員的請求
func (h *AdminHandler) DeletePerson(c *gin.Context) {
	id := c.Param("id")
	personID, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的人員ID"})
		return
	}

	if err := h.DB.Delete(&models.Person{}, personID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ListServices 顯示服務列表
func (h *AdminHandler) ListServices(c *gin.Context) {
	var services []models.Service
	h.DB.Find(&services)

	c.HTML(http.StatusOK, "services.html", gin.H{
		"services": services,
	})
}

// CreateService 處理創建服務的請求
func (h *AdminHandler) CreateService(c *gin.Context) {
	if c.Request.Method == http.MethodGet {
		c.HTML(http.StatusOK, "service_form.html", gin.H{
			"action": "create",
		})
		return
	}

	var form struct {
		Name        string `form:"name" binding:"required"`
		URL         string `form:"url" binding:"required,url"`
		Description string `form:"description"`
		Active      bool   `form:"active"`
	}

	if err := c.ShouldBind(&form); err != nil {
		c.HTML(http.StatusBadRequest, "service_form.html", gin.H{
			"error":  "表單數據無效",
			"action": "create",
		})
		return
	}

	service := models.Service{
		Name:        form.Name,
		URL:         form.URL,
		Description: form.Description,
		IsActive:    form.Active,
	}

	if err := h.DB.Create(&service).Error; err != nil {
		c.HTML(http.StatusInternalServerError, "service_form.html", gin.H{
			"error":   "創建服務失敗: " + err.Error(),
			"action":  "create",
			"service": service,
		})
		return
	}

	c.Redirect(http.StatusFound, "/admin/services")
}

// UpdateService 處理更新服務的請求
func (h *AdminHandler) UpdateService(c *gin.Context) {
	id := c.Param("id")
	serviceID, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		c.HTML(http.StatusBadRequest, "error.html", gin.H{
			"error": "無效的服務ID",
		})
		return
	}

	var service models.Service
	if err := h.DB.First(&service, serviceID).Error; err != nil {
		c.HTML(http.StatusNotFound, "error.html", gin.H{
			"error": "找不到指定的服務",
		})
		return
	}

	if c.Request.Method == http.MethodGet {
		c.HTML(http.StatusOK, "service_form.html", gin.H{
			"action":  "update",
			"service": service,
		})
		return
	}

	var form struct {
		Name        string `form:"name" binding:"required"`
		URL         string `form:"url" binding:"required,url"`
		Description string `form:"description"`
		Active      bool   `form:"active"`
	}

	if err := c.ShouldBind(&form); err != nil {
		c.HTML(http.StatusBadRequest, "service_form.html", gin.H{
			"error":   "表單數據無效",
			"action":  "update",
			"service": service,
		})
		return
	}

	service.Name = form.Name
	service.URL = form.URL
	service.Description = form.Description
	service.IsActive = form.Active

	if err := h.DB.Save(&service).Error; err != nil {
		c.HTML(http.StatusInternalServerError, "service_form.html", gin.H{
			"error":   "更新服務失敗: " + err.Error(),
			"action":  "update",
			"service": service,
		})
		return
	}

	c.Redirect(http.StatusFound, "/admin/services")
}

// DeleteService 處理刪除服務的請求
func (h *AdminHandler) DeleteService(c *gin.Context) {
	id := c.Param("id")
	serviceID, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的服務ID"})
		return
	}

	if err := h.DB.Delete(&models.Service{}, serviceID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ListTokens 顯示令牌列表
func (h *AdminHandler) ListTokens(c *gin.Context) {
	var tokens []models.Token
	h.DB.Preload("Person").Preload("Service").Find(&tokens)

	c.HTML(http.StatusOK, "tokens.html", gin.H{
		"tokens": tokens,
	})
}

// CreateToken 處理創建令牌的請求
func (h *AdminHandler) CreateToken(c *gin.Context) {
	if c.Request.Method == http.MethodGet {
		var persons []models.Person
		var services []models.Service
		h.DB.Find(&persons)
		h.DB.Find(&services)

		c.HTML(http.StatusOK, "token_form.html", gin.H{
			"action":   "create",
			"persons":  persons,
			"services": services,
		})
		return
	}

	var form struct {
		PersonID  uint      `form:"person_id" binding:"required"`
		ServiceID uint      `form:"service_id" binding:"required"`
		ExpireAt  time.Time `form:"expire_at" binding:"required" time_format:"2006-01-02"`
		Active    bool      `form:"active"`
	}

	if err := c.ShouldBind(&form); err != nil {
		var persons []models.Person
		var services []models.Service
		h.DB.Find(&persons)
		h.DB.Find(&services)

		c.HTML(http.StatusBadRequest, "token_form.html", gin.H{
			"error":    "表單數據無效: " + err.Error(),
			"action":   "create",
			"persons":  persons,
			"services": services,
		})
		return
	}

	// 檢查人員和服務是否存在
	var person models.Person
	var service models.Service
	if err := h.DB.First(&person, form.PersonID).Error; err != nil {
		c.HTML(http.StatusBadRequest, "token_form.html", gin.H{"error": "指定的人員不存在"})
		return
	}
	if err := h.DB.First(&service, form.ServiceID).Error; err != nil {
		c.HTML(http.StatusBadRequest, "token_form.html", gin.H{"error": "指定的服務不存在"})
		return
	}

	// 檢查人員是否有權限訪問此服務
	var permission models.Permission
	if err := h.DB.Where("person_id = ? AND service_id = ?", form.PersonID, form.ServiceID).First(&permission).Error; err != nil {
		// 如果權限不存在，則創建權限
		permission = models.Permission{
			PersonID:  form.PersonID,
			ServiceID: form.ServiceID,
		}
		if err := h.DB.Create(&permission).Error; err != nil {
			c.HTML(http.StatusInternalServerError, "token_form.html", gin.H{
				"error": "授予權限失敗: " + err.Error(),
			})
			return
		}
	}

	// 生成令牌
	tokenValue := GenerateToken(32)
	token := models.Token{
		TokenValue: tokenValue,
		ExpireAt:   form.ExpireAt,
		IsActive:   form.Active,
		PersonID:   form.PersonID,
		ServiceID:  form.ServiceID,
	}

	if err := h.DB.Create(&token).Error; err != nil {
		c.HTML(http.StatusInternalServerError, "token_form.html", gin.H{
			"error":  "創建令牌失敗: " + err.Error(),
			"action": "create",
		})
		return
	}

	c.Redirect(http.StatusFound, "/admin/tokens")
}

// UpdateToken 處理更新令牌的請求
func (h *AdminHandler) UpdateToken(c *gin.Context) {
	id := c.Param("id")
	tokenID, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		c.HTML(http.StatusBadRequest, "error.html", gin.H{
			"error": "無效的令牌ID",
		})
		return
	}

	var token models.Token
	if err := h.DB.Preload("Person").Preload("Service").First(&token, tokenID).Error; err != nil {
		c.HTML(http.StatusNotFound, "error.html", gin.H{
			"error": "找不到指定的令牌",
		})
		return
	}

	if c.Request.Method == http.MethodGet {
		var persons []models.Person
		var services []models.Service
		h.DB.Find(&persons)
		h.DB.Find(&services)

		c.HTML(http.StatusOK, "token_form.html", gin.H{
			"action":   "update",
			"token":    token,
			"persons":  persons,
			"services": services,
		})
		return
	}

	var form struct {
		PersonID  uint      `form:"person_id" binding:"required"`
		ServiceID uint      `form:"service_id" binding:"required"`
		ExpireAt  time.Time `form:"expire_at" binding:"required" time_format:"2006-01-02"`
		Active    bool      `form:"active"`
	}

	if err := c.ShouldBind(&form); err != nil {
		var persons []models.Person
		var services []models.Service
		h.DB.Find(&persons)
		h.DB.Find(&services)

		c.HTML(http.StatusBadRequest, "token_form.html", gin.H{
			"error":    "表單數據無效",
			"action":   "update",
			"token":    token,
			"persons":  persons,
			"services": services,
		})
		return
	}

	// 檢查人員和服務是否存在
	var person models.Person
	var service models.Service
	if err := h.DB.First(&person, form.PersonID).Error; err != nil {
		c.HTML(http.StatusBadRequest, "token_form.html", gin.H{"error": "指定的人員不存在"})
		return
	}
	if err := h.DB.First(&service, form.ServiceID).Error; err != nil {
		c.HTML(http.StatusBadRequest, "token_form.html", gin.H{"error": "指定的服務不存在"})
		return
	}

	// 檢查人員是否有權限訪問此服務
	var permission models.Permission
	if err := h.DB.Where("person_id = ? AND service_id = ?", form.PersonID, form.ServiceID).First(&permission).Error; err != nil {
		// 如果權限不存在，則創建權限
		permission = models.Permission{
			PersonID:  form.PersonID,
			ServiceID: form.ServiceID,
		}
		if err := h.DB.Create(&permission).Error; err != nil {
			c.HTML(http.StatusInternalServerError, "token_form.html", gin.H{
				"error": "授予權限失敗: " + err.Error(),
			})
			return
		}
	}

	token.PersonID = form.PersonID
	token.ServiceID = form.ServiceID
	token.ExpireAt = form.ExpireAt
	token.IsActive = form.Active

	if err := h.DB.Save(&token).Error; err != nil {
		c.HTML(http.StatusInternalServerError, "token_form.html", gin.H{
			"error":  "更新令牌失敗: " + err.Error(),
			"action": "update",
			"token":  token,
		})
		return
	}

	c.Redirect(http.StatusFound, "/admin/tokens")
}

// DeleteToken 處理刪除令牌的請求
func (h *AdminHandler) DeleteToken(c *gin.Context) {
	id := c.Param("id")
	tokenID, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的令牌ID"})
		return
	}

	if err := h.DB.Delete(&models.Token{}, tokenID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ListPermissions 顯示權限列表
func (h *AdminHandler) ListPermissions(c *gin.Context) {
	var permissions []models.Permission
	h.DB.Preload("Person").Preload("Service").Find(&permissions)

	c.HTML(http.StatusOK, "permissions.html", gin.H{
		"permissions": permissions,
	})
}

// CreatePermission 處理創建權限的請求
func (h *AdminHandler) CreatePermission(c *gin.Context) {
	if c.Request.Method == http.MethodGet {
		var persons []models.Person
		var services []models.Service
		h.DB.Find(&persons)
		h.DB.Find(&services)

		c.HTML(http.StatusOK, "permission_form.html", gin.H{
			"action":   "create",
			"persons":  persons,
			"services": services,
		})
		return
	}

	var form struct {
		PersonID  uint `form:"person_id" binding:"required"`
		ServiceID uint `form:"service_id" binding:"required"`
	}

	if err := c.ShouldBind(&form); err != nil {
		var persons []models.Person
		var services []models.Service
		h.DB.Find(&persons)
		h.DB.Find(&services)

		c.HTML(http.StatusBadRequest, "permission_form.html", gin.H{
			"error":    "表單數據無效",
			"action":   "create",
			"persons":  persons,
			"services": services,
		})
		return
	}

	// 檢查人員和服務是否存在
	var person models.Person
	var service models.Service
	if err := h.DB.First(&person, form.PersonID).Error; err != nil {
		c.HTML(http.StatusBadRequest, "permission_form.html", gin.H{"error": "指定的人員不存在"})
		return
	}
	if err := h.DB.First(&service, form.ServiceID).Error; err != nil {
		c.HTML(http.StatusBadRequest, "permission_form.html", gin.H{"error": "指定的服務不存在"})
		return
	}

	// 檢查權限是否已存在
	var existingPermission models.Permission
	if err := h.DB.Where("person_id = ? AND service_id = ?", form.PersonID, form.ServiceID).First(&existingPermission).Error; err == nil {
		c.HTML(http.StatusBadRequest, "permission_form.html", gin.H{
			"error":  "該權限已存在",
			"action": "create",
		})
		return
	}

	permission := models.Permission{
		PersonID:  form.PersonID,
		ServiceID: form.ServiceID,
	}

	if err := h.DB.Create(&permission).Error; err != nil {
		c.HTML(http.StatusInternalServerError, "permission_form.html", gin.H{
			"error":  "創建權限失敗: " + err.Error(),
			"action": "create",
		})
		return
	}

	c.Redirect(http.StatusFound, "/admin/permissions")
}

// DeletePermission 處理刪除權限的請求
func (h *AdminHandler) DeletePermission(c *gin.Context) {
	id := c.Param("id")
	permissionID, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的權限ID"})
		return
	}

	if err := h.DB.Delete(&models.Permission{}, permissionID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// InitAdmin 初始化管理員帳號
func InitAdmin(db *gorm.DB) error {
	var adminCount int64
	db.Model(&models.Admin{}).Count(&adminCount)

	if adminCount == 0 {
		adminPassword := os.Getenv("ADMIN_PASSWORD")
		if adminPassword == "" {
			adminPassword = "admin" // 默認密碼
			fmt.Println("警告: 使用預設管理員密碼。建議設置 ADMIN_PASSWORD 環境變數。")
		}

		admin := models.Admin{
			Username:     "admin",
			PasswordHash: HashPassword(adminPassword),
		}

		if err := db.Create(&admin).Error; err != nil {
			return fmt.Errorf("創建管理員帳號失敗: %v", err)
		}

		fmt.Println("已創建管理員帳號。用戶名: admin")
	}

	return nil
}
