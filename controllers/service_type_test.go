package controllers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"infra-manager/db"
	"infra-manager/models"
)

func TestServiceTypeCreateEditAndLegacyUpdate(t *testing.T) {
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
	router := gin.New()
	router.POST("/services", CreateService)
	router.PUT("/services/:id", UpdateService)
	request := func(method, path, body string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)
		return w
	}
	w := request("POST", "/services", `{"name":"api","base_url":"http://example.test","type":"Kubernetes"}`)
	if w.Code != 201 {
		t.Fatalf("create %d %s", w.Code, w.Body.String())
	}
	var service models.Service
	if err = json.Unmarshal(w.Body.Bytes(), &service); err != nil {
		t.Fatal(err)
	}
	if service.Type != "Kubernetes" {
		t.Fatalf("type %q", service.Type)
	}
	w = request("PUT", "/services/1", `{"name":"api","base_url":"http://example.test"}`)
	if w.Code != 200 {
		t.Fatalf("legacy %d", w.Code)
	}
	if err = db.DB.First(&service, 1).Error; err != nil || service.Type != "Kubernetes" {
		t.Fatalf("legacy erased type: %+v %v", service, err)
	}
	w = request("PUT", "/services/1", `{"name":"api","base_url":"http://example.test","type":""}`)
	if w.Code != 200 {
		t.Fatalf("clear %d", w.Code)
	}
	if err = db.DB.First(&service, 1).Error; err != nil || service.Type != "" {
		t.Fatalf("clear: %+v %v", service, err)
	}
}
