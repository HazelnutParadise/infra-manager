package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"infrastructure/internal/admin"
	"infrastructure/internal/models"
	"infrastructure/internal/proxy"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func main() {
	// 解析命令行參數
	port := flag.Int("port", 8080, "服務監聽端口")
	dbPath := flag.String("db", "./infrastructure.db", "SQLite數據庫路徑")
	debug := flag.Bool("debug", false, "是否啟用調試模式")
	flag.Parse()

	// 根據調試模式設置Gin運行模式
	if *debug {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	// 確保數據庫目錄存在
	dbDir := filepath.Dir(*dbPath)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		log.Fatalf("無法創建數據庫目錄: %v", err)
	}

	// 初始化數據庫連接
	db, err := gorm.Open(sqlite.Open(*dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("無法連接到數據庫: %v", err)
	}
	log.Printf("已連接到數據庫: %s", *dbPath)

	// 初始化數據庫結構
	if err := models.InitDB(db); err != nil {
		log.Fatalf("初始化數據庫結構失敗: %v", err)
	}
	log.Println("已初始化數據庫結構")

	// 創建初始服務
	if err := models.CreateInitialServices(db); err != nil {
		log.Fatalf("創建初始服務失敗: %v", err)
	}

	// 初始化管理員帳號
	if err := admin.InitAdmin(db); err != nil {
		log.Fatalf("初始化管理員帳號失敗: %v", err)
	}

	// 創建Gin路由
	router := gin.Default()

	// 加載HTML模板
	router.LoadHTMLGlob("templates/*")

	// 靜態文件服務
	router.Static("/static", "./static")

	// 註冊管理介面路由
	admin.RegisterRoutes(router, db)

	// 註冊代理路由
	proxy.RegisterRoutes(router, db)

	// 默認首頁重定向到管理介面
	router.GET("/", func(c *gin.Context) {
		c.Redirect(302, "/admin/login")
	})

	// 啟動服務器
	addr := fmt.Sprintf(":%d", *port)
	log.Printf("服務器啟動在 http://localhost%s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("啟動服務器失敗: %v", err)
	}
}
