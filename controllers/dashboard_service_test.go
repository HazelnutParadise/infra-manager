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
	"time"
)

func TestDashboardServiceUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	old := db.DB
	t.Cleanup(func() { db.DB = old })
	var err error
	db.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.DB.AutoMigrate(&models.AccessLog{}, &models.Service{}); err != nil {
		t.Fatal(err)
	}
	service := models.Service{Name: "example", BaseURL: "http://example.test"}
	db.DB.Create(&service)
	for _, row := range []models.AccessLog{{ServiceID: service.ID, StatusCode: 200}, {ServiceID: service.ID, StatusCode: 503}, {Model: gorm.Model{CreatedAt: time.Now().AddDate(0, 0, -35)}, ServiceID: service.ID, StatusCode: 500}} {
		item := row
		if err = db.DB.Create(&item).Error; err != nil {
			t.Fatal(err)
		}
	}
	r := gin.New()
	r.GET("/services", GetDashboardServiceUsage)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/services", nil))
	if w.Code != 200 {
		t.Fatalf("status %d", w.Code)
	}
	var items []struct {
		ServiceID uint `json:"service_id"`
		Count     int  `json:"count"`
		Errors    int  `json:"errors"`
	}
	if err = json.Unmarshal(w.Body.Bytes(), &items); err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ServiceID != service.ID || items[0].Count != 2 || items[0].Errors != 1 {
		t.Fatalf("items %+v", items)
	}
}
