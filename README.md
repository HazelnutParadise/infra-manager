# 基礎設施管理系統

一個完整的基礎設施管理系統，用於管理 API 服務的訪問權限和代理請求。此系統提供人員、服務、令牌和權限的完整管理功能，並記錄使用統計資料。

## 主要功能

- **代理請求**：將請求轉發到目標服務，同時進行身份驗證和授權
- **人員管理**：管理可以訪問服務的人員
- **服務管理**：管理提供 API 的服務
- **權限管理**：設置人員對服務的訪問權限
- **令牌管理**：創建和管理用於訪問服務的令牌
- **使用統計**：記錄和查看服務使用情況的統計數據

## 技術架構

- 使用 Go 語言和 Gin 框架開發後端
- 使用 GORM 作為 ORM 框架
- 使用 SQLite 作為數據庫
- 使用 Bootstrap 5 實現前端界面
- 使用 Docker 容器化部署

## 安裝和運行

### 使用 Docker Compose（推薦）

1. 確保已安裝 Docker 和 Docker Compose
2. 克隆此存儲庫：`git clone https://github.com/yourusername/infrastructure.git`
3. 進入項目目錄：`cd infrastructure`
4. 啟動服務：`docker-compose up -d`
5. 在瀏覽器中訪問：`http://localhost:8080`

### 手動運行

1. 確保已安裝 Go 1.21 或更高版本
2. 克隆此存儲庫：`git clone https://github.com/yourusername/infrastructure.git`
3. 進入項目目錄：`cd infrastructure`
4. 進入源碼目錄：`cd src`
5. 下載依賴：`go mod download`
6. 編譯應用程序：`go build -o infrastructure main.go`
7. 運行應用程序：`./infrastructure`
8. 在瀏覽器中訪問：`http://localhost:8080`

## 使用方法

### 初次登入

- 網址：`http://localhost:8080/admin/login`
- 預設帳號：`admin`
- 預設密碼：`admin`（或環境變量 `ADMIN_PASSWORD` 指定的值）
- **注意**：請在首次登入後修改預設密碼

### API 使用

API 請求的 URL 格式為：`http://{domain}/{service_name}/{token}/{path}`

例如，如果要訪問名為 "example-api" 的服務的 "/users" 路徑，使用令牌 "abc123"，則請求 URL 為：
```
http://localhost:8080/example-api/abc123/users
```

### 管理介面

系統提供了直觀的管理介面，包括以下功能：

- **儀表板**：顯示系統概況和使用統計
- **人員管理**：管理可訪問系統的人員
- **服務管理**：管理可被代理的服務
- **令牌管理**：創建和管理訪問令牌
- **權限管理**：管理人員對服務的訪問權限

## 環境變數

系統支持以下環境變數：

- `PORT`：服務監聽端口（默認：8080）
- `DB_PATH`：SQLite 數據庫文件路徑（默認：./infrastructure.db）
- `ADMIN_PASSWORD`：管理員密碼（默認：admin）
- `GIN_MODE`：Gin 框架運行模式（默認：release）

## 系統架構

```
src/
├── main.go                  # 主入口點
├── internal/                # 內部模組
│   ├── models/              # 數據模型定義
│   │   └── models.go
│   ├── proxy/               # 代理功能
│   │   ├── proxy.go
│   │   └── routes.go
│   └── admin/               # 管理功能
│       ├── handlers.go
│       └── routes.go
├── templates/               # HTML 模板
└── static/                  # 靜態資源
```

## 許可證

MIT
