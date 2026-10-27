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

func TestDashboardResponseChart(t *testing.T) {
	gin.SetMode(gin.TestMode)
	old := db.DB
	t.Cleanup(func() { db.DB = old })
	var err error
	db.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.DB.AutoMigrate(&models.AccessLog{}); err != nil {
		t.Fatal(err)
	}
	loc := time.FixedZone("Taipei", 8*3600)
	now := time.Now().In(loc)
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	for _, status := range []int{0, 200, 302, 400, 503} {
		if err = db.DB.Exec("INSERT INTO access_logs(created_at,status_code) VALUES(?,?)", day.Add(time.Hour).UTC(), status).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err = db.DB.Exec("INSERT INTO access_logs(created_at,status_code) VALUES(?,?)", day.Add(-time.Minute), 500).Error; err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	r.GET("/chart", GetDashboardResponseChart)
	for _, bad := range []string{"0", "91", "bad"} {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest("GET", "/chart?days="+bad, nil))
		if w.Code != 400 {
			t.Fatalf("bad days %q: %d", bad, w.Code)
		}
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/chart?days=2", nil))
	if w.Code != 200 {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var rows []struct {
		Date    string `json:"date"`
		Success int    `json:"success"`
		Error   int    `json:"error"`
	}
	if err = json.Unmarshal(w.Body.Bytes(), &rows); err != nil {
		t.Fatal(err)
	}
	if len(rows) != 2 || rows[0].Date != day.AddDate(0, 0, -1).Format("2006-01-02") || rows[0].Error != 1 || rows[1].Date != day.Format("2006-01-02") || rows[1].Success != 2 || rows[1].Error != 2 {
		t.Fatalf("unexpected rows: %+v", rows)
	}
}
