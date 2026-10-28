package controllers

import (
	"bytes"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"infra-manager/db"
	"infra-manager/models"
	"net/http/httptest"
	"testing"
)

func TestServiceDetailsPreserveDisabledStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	old := db.DB
	t.Cleanup(func() { db.DB = old })
	var err error
	db.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.DB.AutoMigrate(&models.Service{}); err != nil {
		t.Fatal(err)
	}
	service := models.Service{Name: "api", BaseURL: "http://example.test"}
	if err = db.DB.Create(&service).Error; err != nil {
		t.Fatal(err)
	}
	if err = db.DB.Model(&service).Update("is_active", false).Error; err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	r.PUT("/services/:id/details", UpdateServiceDetails)
	w := httptest.NewRecorder()
	req := httptest.NewRequest("PUT", "/services/1/details", bytes.NewBufferString(`{"name":"api","base_url":"http://example.test","type":"Database"}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("status %d %s", w.Code, w.Body.String())
	}
	if err = db.DB.First(&service, 1).Error; err != nil || service.IsActive || service.Type != "Database" {
		t.Fatalf("service %+v %v", service, err)
	}
}
