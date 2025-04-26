package main

import (
	"log"
	"os"
	"path"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

var db *gorm.DB

func initDB(path string) {
	var err error
	db, err = gorm.Open(sqlite.Open(path), &gorm.Config{})
	if err != nil {
		log.Fatal("failed to connect db:", err)
	}
	// 自動建表，多加 UsageLog
	db.AutoMigrate(&Person{}, &Service{}, &Token{}, &UsageLog{})
}

func main() {
	// 讀 env
	dbFile := os.Getenv("DATABASE_FILE")

	if dbFile == "" {
		dbFile = path.Join("data", "infra.db")
	}
	if _, err := os.Stat(dbFile); err != nil {
		if os.IsNotExist(err) {
			os.MkdirAll(path.Dir(dbFile), os.ModePerm)
		} else {
			log.Fatal("failed to create db dir:", err)
		}
	}
	initDB(dbFile)

	// Gin
	gin.SetMode(gin.ReleaseMode)
	proxyRouter := gin.New()
	adminRouter := gin.New()

	// 啟動 API proxy
	runProxy(proxyRouter)
	go proxyRouter.Run(":1452")

	// 啟動管理介面
	runAdmin(adminRouter)

	// 阻塞主程式
	select {}
}
