package models

import (
	"time"

	"gorm.io/gorm"
)

// Person 代表系統中的人員
type Person struct {
	gorm.Model
	Name       string `gorm:"size:100;not null"`
	Email      string `gorm:"size:100;uniqueIndex"`
	IsActive   bool   `gorm:"default:true"`
	Tokens     []Token
	UsageStats []UsageStat
}

// Service 代表系統中的服務
type Service struct {
	gorm.Model
	Name        string `gorm:"size:100;uniqueIndex;not null"`
	URL         string `gorm:"size:255;not null"`
	Description string `gorm:"size:500"`
	IsActive    bool   `gorm:"default:true"`
	Tokens      []Token
	UsageStats  []UsageStat
}

// Token 代表訪問服務的令牌
type Token struct {
	gorm.Model
	TokenValue string `gorm:"size:64;uniqueIndex;not null"`
	ExpireAt   time.Time
	IsActive   bool `gorm:"default:true"`
	PersonID   uint
	ServiceID  uint
	Person     Person  `gorm:"constraint:OnDelete:CASCADE;"`
	Service    Service `gorm:"constraint:OnDelete:CASCADE;"`
	UsageStats []UsageStat
}

// Permission 代表人員對服務的訪問權限
type Permission struct {
	gorm.Model
	PersonID  uint
	ServiceID uint
	Person    Person  `gorm:"constraint:OnDelete:CASCADE;"`
	Service   Service `gorm:"constraint:OnDelete:CASCADE;"`
}

// UsageStat 記錄服務的使用統計
type UsageStat struct {
	gorm.Model
	PersonID      uint
	ServiceID     uint
	TokenID       uint
	RequestPath   string `gorm:"size:255"`
	RequestMethod string `gorm:"size:10"`
	ResponseCode  int
	RequestTime   time.Time `gorm:"index"`
	Duration      int64     // 請求處理時間（毫秒）
	Person        Person    `gorm:"constraint:OnDelete:CASCADE;"`
	Service       Service   `gorm:"constraint:OnDelete:CASCADE;"`
	Token         Token     `gorm:"constraint:OnDelete:CASCADE;"`
}

// Admin 管理員帳號
type Admin struct {
	gorm.Model
	Username     string `gorm:"uniqueIndex;size:50;not null"`
	PasswordHash string `gorm:"size:255;not null"`
}

// InitDB 初始化資料庫
func InitDB(db *gorm.DB) error {
	// 自動遷移表結構
	err := db.AutoMigrate(&Person{}, &Service{}, &Token{}, &Permission{}, &UsageStat{}, &Admin{})
	if err != nil {
		return err
	}

	// 管理員初始化移至 admin.InitAdmin 函數中，避免重複創建

	return nil
}

// CreateInitialServices 創建初始服務（如果需要）
func CreateInitialServices(db *gorm.DB) error {
	var serviceCount int64
	db.Model(&Service{}).Count(&serviceCount)

	if serviceCount == 0 {
		// 創建一些示例服務
		services := []Service{
			{Name: "example-api", URL: "https://api.example.com", Description: "示例API服務", IsActive: true},
			{Name: "test-service", URL: "https://test.example.com", Description: "測試服務", IsActive: true},
		}

		for _, service := range services {
			if err := db.Create(&service).Error; err != nil {
				return err
			}
		}
	}

	return nil
}
