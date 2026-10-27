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

func TestDashboardDateRange(t *testing.T) {
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
	for _, row := range []models.AccessLog{{Model: gorm.Model{CreatedAt: time.Date(2026, 6, 1, 2, 0, 0, 0, time.UTC)}, ServiceID: 1, StatusCode: 200}, {Model: gorm.Model{CreatedAt: time.Date(2026, 6, 3, 2, 0, 0, 0, time.UTC)}, ServiceID: 1, StatusCode: 503}} {
		if err = db.DB.Create(&row).Error; err != nil {
			t.Fatal(err)
		}
	}
	r := gin.New()
	r.GET("/chart", GetDashboardResponseChart)
	r.GET("/services", GetDashboardServiceDetail)
	for _, route := range []string{"/chart", "/services"} {
		for _, query := range []string{"?start=2026-06-01", "?start=2026-06-03&end=2026-06-01", "?start=2026-01-01&end=2026-06-01", "?start=bad&end=2026-06-01"} {
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest("GET", route+query, nil))
			if w.Code != 400 {
				t.Fatalf("%s%s status %d", route, query, w.Code)
			}
		}
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/chart?start=2026-06-01&end=2026-06-02", nil))
	var chart []dashboardResponseDay
	if err = json.Unmarshal(w.Body.Bytes(), &chart); err != nil || w.Code != 200 || len(chart) != 2 || chart[0].Success != 1 || chart[1].Success != 0 {
		t.Fatalf("chart %d %+v %v", w.Code, chart, err)
	}
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/services?start=2026-06-01&end=2026-06-02", nil))
	var services []struct {
		Count int `json:"count"`
	}
	if err = json.Unmarshal(w.Body.Bytes(), &services); err != nil || w.Code != 200 || len(services) != 1 || services[0].Count != 1 {
		t.Fatalf("services %d %+v %v", w.Code, services, err)
	}
}
