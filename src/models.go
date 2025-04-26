package main

import (
	"time"

	"gorm.io/gorm"
)

// Person 使用者
type Person struct {
	gorm.Model
	Name     string `gorm:"unique;not null"`
	Disabled bool
	Tokens   []Token `gorm:"foreignKey:OwnerID"`
}

// Service 目標服務
type Service struct {
	gorm.Model
	Name     string `gorm:"unique;not null"`
	Disabled bool
	Tokens   []Token `gorm:"foreignKey:ServiceID"`
}

// Token 存取令牌
type Token struct {
	gorm.Model
	Token     string `gorm:"unique;not null"`
	OwnerID   uint
	ServiceID uint
	Disabled  bool
	Owner     Person
	Service   Service
}

type UsageLog struct {
	gorm.Model
	TokenID   uint      `gorm:"index"`
	ServiceID uint      `gorm:"index"`
	CreatedAt time.Time // 記錄請求時間
}
