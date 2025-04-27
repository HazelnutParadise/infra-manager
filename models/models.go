package models

import (
	"time"

	"gorm.io/gorm"
)

// 人員模型
type User struct {
	gorm.Model
	ID         uint        `gorm:"primaryKey" json:"id"`
	Username   string      `gorm:"unique;not null" json:"username"`
	IsActive   bool        `gorm:"default:true" json:"is_active"`
	Tokens     []Token     `gorm:"foreignKey:UserID" json:"tokens,omitempty"`
	AccessLogs []AccessLog `gorm:"foreignKey:UserID" json:"access_logs,omitempty"`
}

// 服務模型
type Service struct {
	gorm.Model
	ID          uint        `gorm:"primaryKey" json:"id"`
	Name        string      `gorm:"unique;not null" json:"name"`
	Description string      `json:"description"`
	BaseURL     string      `gorm:"not null" json:"base_url"`
	IsActive    bool        `gorm:"default:true" json:"is_active"`
	Tokens      []Token     `gorm:"foreignKey:ServiceID" json:"tokens,omitempty"`
	AccessLogs  []AccessLog `gorm:"foreignKey:ServiceID" json:"access_logs,omitempty"`
}

// Token模型
type Token struct {
	gorm.Model
	ID          uint        `gorm:"primaryKey" json:"id"`
	TokenValue  string      `gorm:"unique;not null" json:"token_value"`
	UserID      uint        `gorm:"not null" json:"user_id"`
	User        User        `json:"user,omitempty"`
	ServiceID   uint        `gorm:"not null" json:"service_id"`
	Service     Service     `json:"service,omitempty"`
	Description string      `json:"description"` // 新增備註說明欄位
	ExpiresAt   time.Time   `json:"expires_at"`
	IsActive    bool        `gorm:"default:true" json:"is_active"`
	AccessLogs  []AccessLog `gorm:"foreignKey:TokenID" json:"access_logs,omitempty"`
}

// 使用紀錄模型
type AccessLog struct {
	gorm.Model
	UserID       uint   `json:"user_id"`
	TokenID      uint   `json:"token_id"`
	ServiceID    uint   `json:"service_id"`
	Endpoint     string `json:"endpoint"`
	Method       string `json:"method"`
	StatusCode   int    `json:"status_code"`
	RequestSize  int64  `json:"request_size"`
	ResponseSize int64  `json:"response_size"`
	Duration     int64  `json:"duration"` // 毫秒
}

// 管理員模型
type Admin struct {
	gorm.Model
	Username string `gorm:"unique;not null" json:"username"`
	Password string `gorm:"not null" json:"-"` // 不在JSON中暴露密碼
}
