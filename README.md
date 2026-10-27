# 基礎設施管理系統 infra-manager

## 基本架構

- 一個api
- 一個管理介面
- api經過token驗證後反向代理到目標服務，攜帶所有請求header、body、查詢參數
  - 用戶或token若被停權、token過期或無效或與請求的服務不符則回傳403
  - 找不到服務則回傳404
- 代理路徑：
  - 網址 token：`/use/<服務名稱>/<存取token>/<目標路徑>`，原有 `/api/` 路徑仍可使用。
  - Bearer token：`/use/<服務名稱>/<目標路徑>`，標頭帶 `Authorization: Bearer <存取token>`。
  - 辨識為網址 token 時優先驗證網址 token，即使無效、停用或過期也不會改用 Bearer。辨識方式是 32 碼小寫十六進位字串，或資料庫中曾存在的 token；目標路徑第一段若符合這些條件，也會被視為網址 token。
  - 若目標路徑第一段被誤認為網址 token，另帶 `X-Infra-Token-Source: bearer`，明確指定使用 Bearer。
  - Authorization 標頭會照原樣轉送到後端服務。
- 管理介面只有一個admin，人員都是由admin管理，admin密碼由環境變數設定

## 技術棧

- 前端：HTML + CSS + JS，使用Ajax
- 後端：Gin + Gorm
- 路由：Gin，但不使用模板引擎
- 資料庫：SQLite3
- 部署：Docker + Docker Compose

## 使用 Docker Compose 啟動

1. 複製範例設定：`cp .env.example .env`。
2. 修改 `.env` 的 `DATA_DIR`，指定 Docker 主機上的資料目錄。既有部署請使用原本的 `/mnt/hdd0/infra-manager/data`，並確認其中有原本的 `infra_manager.db`。
3. 確認外部 Docker 網路 `infra-net` 已存在。
4. 執行 `docker compose config --quiet` 檢查設定，再執行 `docker compose up -d --build` 啟動。

`DATA_DIR` 未設定或為空時，Compose 不會正常啟動。指定的目錄不存在時 Docker 會自動建立；路徑錯誤可能導致程式建立新的空資料庫，請在啟動前確認路徑。`.env` 不納入版本控制。

## 對應關係

- 一個人員可以有多個token
- 一個token只能對應一個人員
- 一個token只能對應一個服務
- 一個服務可以對應多個token

## 管理介面功能

### 管理

- 新增/修改/刪除/停權人員
- 新增/修改/刪除/停權token
- 新增/修改/刪除/停權服務

### 視覺化儀表板

- 每個人員每種服務使用量圓餅圖、長條圖、折線圖
- 每個人員每個token使用量圓餅圖、長條圖、折線圖
- 每個token隨時間使用量折線圖
- 每個服務隨時間使用總量折線圖
- 每個服務使用總量圓餅圖、長條圖
