package db

import (
	"fmt"
	"log"
	"os"

	"infra-manager/models"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var DB *gorm.DB

// 初始化資料庫連接
func InitDB() {
	var err error
	dbPath := "./infra_manager.db"
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("無法連接到資料庫: %v", err)
	}

	// 遷移資料庫結構
	DB.AutoMigrate(&models.User{}, &models.Service{}, &models.Token{}, &models.AccessLog{}, &models.Admin{})

	// 檢查並創建默認管理員
	createDefaultAdmin()
}

// 創建預設管理員帳號
func createDefaultAdmin() {
	var admin models.Admin
	result := DB.First(&admin)

	// 如果沒有管理員帳號，則創建一個
	if result.Error == gorm.ErrRecordNotFound {
		adminUser := os.Getenv("ADMIN_USER")
		adminPass := os.Getenv("ADMIN_PASS")

		// 若環境變數未設定，則使用預設值，但僅限於開發環境
		if adminUser == "" {
			adminUser = "admin"
			fmt.Println("警告: 使用預設管理員帳號 'admin'，請在生產環境中設定 ADMIN_USER 環境變數")
		}

		if adminPass == "" {
			adminPass = "admin123"
			fmt.Println("警告: 使用預設管理員密碼，請在生產環境中設定 ADMIN_PASS 環境變數")
		}

		// 密碼加密
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPass), bcrypt.DefaultCost)
		if err != nil {
			log.Fatal("密碼加密失敗:", err)
		}

		// 創建管理員
		admin = models.Admin{
			Username: adminUser,
			Password: string(hashedPassword),
		}

		if err := DB.Create(&admin).Error; err != nil {
			log.Fatal("創建預設管理員失敗:", err)
		}

		fmt.Println("已創建預設管理員帳號")
	}
}
