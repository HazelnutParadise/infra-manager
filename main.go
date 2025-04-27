package main

import (
	"fmt"
	"log"
	"os"

	"infra-manager/api"
	"infra-manager/db"
)

func main() {
	// 初始化資料庫
	db.InitDB()

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
