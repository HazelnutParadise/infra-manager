package controllers

import (
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"infra-manager/db"
	"infra-manager/models"
	"net/http/httptest"
	"testing"
	"time"
)

func TestDashboardStatsTaipeiDaysAndDistinctCounts(t *testing.T) {
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
	for _, stamp := range []string{day.Add(-time.Minute).Format(time.RFC3339), day.Add(30 * time.Minute).Format(time.RFC3339), day.Add(30 * time.Minute).UTC().Format(time.RFC3339)} {
		if err = db.DB.Exec("INSERT INTO access_logs(created_at,user_id,service_id,token_id) VALUES(?,1,2,3)", stamp).Error; err != nil {
			t.Fatal(err)
		}
	}
	r := gin.New()
	r.GET("/recent", GetDashboardRecentStats)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/recent?days=1", nil))
	if w.Code != 200 {
		t.Fatalf("status %d %s", w.Code, w.Body.String())
	}
	var stats []DailyStats
	if err = json.Unmarshal(w.Body.Bytes(), &stats); err != nil {
		t.Fatal(err)
	}
	if len(stats) != 1 || stats[0].Date != day.Format("2006-01-02") || stats[0].Count != 2 || stats[0].UserCount != 1 {
		t.Fatal(fmt.Sprintf("bad stats: %+v", stats))
	}
	for _, bad := range []string{"0", "-1", "91", "x"} {
		w = httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest("GET", "/recent?days="+bad, nil))
		if w.Code != 400 {
			t.Fatalf("days %q status %d", bad, w.Code)
		}
	}
}
