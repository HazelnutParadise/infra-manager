package controllers

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"infra-manager/db"
	"infra-manager/models"
)

func TestDashboardServiceDetail(t *testing.T) {
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
	service := models.Service{Name: "測試服務", BaseURL: "http://example.test"}
	if err = db.DB.Create(&service).Error; err != nil {
		t.Fatal(err)
	}
	for _, row := range []models.AccessLog{
		{ServiceID: service.ID, UserID: 1, TokenID: 1, StatusCode: 200},
		{ServiceID: service.ID, UserID: 1, TokenID: 2, StatusCode: 503},
		{ServiceID: service.ID, UserID: 2, TokenID: 2, StatusCode: 200},
		{Model: gorm.Model{CreatedAt: time.Now().AddDate(0, 0, -35)}, ServiceID: service.ID, UserID: 3, TokenID: 3, StatusCode: 500},
	} {
		if err = db.DB.Create(&row).Error; err != nil {
			t.Fatal(err)
		}
	}
	r := gin.New()
	r.GET("/details", GetDashboardServiceDetail)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/details", nil))
	if w.Code != 200 {
		t.Fatalf("status %d %s", w.Code, w.Body.String())
	}
	var rows []struct {
		Count  int `json:"count"`
		Errors int `json:"errors"`
		Users  int `json:"users"`
		Tokens int `json:"tokens"`
	}
	if err = json.Unmarshal(w.Body.Bytes(), &rows); err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].Count != 3 || rows[0].Errors != 1 || rows[0].Users != 2 || rows[0].Tokens != 2 {
		t.Fatalf("unexpected: %+v", rows)
	}
}
