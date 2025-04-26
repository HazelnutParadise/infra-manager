# 建置階段
FROM golang:1.24 AS builder
WORKDIR /app
COPY src/go.mod src/go.sum ./
RUN go mod download
COPY src/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o infra-manager .

# 執行階段
FROM alpine:latest
RUN apk add --no-cache ca-certificates
WORKDIR /root/
COPY --from=builder /app/infra-manager .
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/static ./static
ENV GIN_MODE=release
ENTRYPOINT ["./infra-manager"]
