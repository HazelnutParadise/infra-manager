package main

import (
	"fmt"
	"log"
	"os"

	"infra-manager/api"
	"infra-manager/db"
	"infra-manager/models"
)

func main() {
	// 初始化資料庫
	db.InitDB()

	// 自動遷移資料庫結構，確保與模型一致
	db.DB.AutoMigrate(&models.User{}, &models.Service{}, &models.Token{}, &models.AccessLog{}, &models.Admin{})
	fmt.Println("資料庫結構已更新")

	// 設定埠號
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // 預設端口
	}

	// 設置路由
	router := api.SetupRouter()

	fmt.Printf("基礎設施管理系統已啟動，監聽端口: %s\n", port)
	log.Fatal(router.Run(":" + port))
}
