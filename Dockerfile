FROM golang:1.21-alpine AS builder

# 設置工作目錄
WORKDIR /app

# 複製 Go 模組文件並下載依賴
COPY src/go.mod ./
RUN go mod download

# 複製源碼
COPY src/ ./

# 編譯應用程序
RUN CGO_ENABLED=0 GOOS=linux go build -o infrastructure ./main.go

# 創建最終運行映像
FROM alpine:latest

# 安裝必要的運行時依賴
RUN apk --no-cache add ca-certificates tzdata

# 設置時區為亞洲/台北
ENV TZ=Asia/Taipei

# 複製編譯好的應用程序
WORKDIR /app
COPY --from=builder /app/infrastructure .

# 複製模板和靜態文件
COPY src/templates ./templates
COPY src/static ./static

# 創建數據目錄
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 8080

# 設置默認環境變數
ENV GIN_MODE=release
ENV PORT=8080
ENV DB_PATH=/app/data/infrastructure.db

# 啟動應用程序
CMD ["sh", "-c", "./infrastructure -port=${PORT} -db=${DB_PATH}"]