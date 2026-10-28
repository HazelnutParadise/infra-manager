package controllers

import (
	"encoding/json"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"infra-manager/db"
	"infra-manager/models"
	"net/http/httptest"
	"testing"
)

func TestDashboardServiceDetailsIncludeType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	old := db.DB
	t.Cleanup(func() { db.DB = old })
	var err error
	db.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.DB.AutoMigrate(&models.Service{}, &models.AccessLog{}); err != nil {
		t.Fatal(err)
	}
	service := models.Service{Name: "api", Type: "Kubernetes", BaseURL: "http://example.test"}
	if err = db.DB.Create(&service).Error; err != nil {
		t.Fatal(err)
	}
	if err = db.DB.Create(&models.AccessLog{ServiceID: service.ID, StatusCode: 200}).Error; err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.GET("/detail", GetDashboardServiceDetail)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "/detail", nil))
	var rows []struct {
		Type string `json:"type"`
	}
	if err = json.Unmarshal(w.Body.Bytes(), &rows); err != nil || len(rows) != 1 || rows[0].Type != "Kubernetes" {
		t.Fatalf("rows %+v status %d: %v", rows, w.Code, err)
	}
}
