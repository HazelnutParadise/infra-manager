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
	"net/url"
	"testing"
	"time"
)

func TestFailureQueryFiltersAndPages(t *testing.T) {
	gin.SetMode(gin.TestMode)
	old := db.DB
	t.Cleanup(func() { db.DB = old })
	var err error
	db.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.DB.AutoMigrate(&models.RequestFailure{}); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 7; i++ {
		stage := "authentication"
		code := 403
		if i%2 == 0 {
			stage = "upstream_response"
			code = 503
		}
		f := models.RequestFailure{CreatedAt: time.Now(), Stage: stage, Reason: "test", StatusCode: code}
		if err = db.DB.Create(&f).Error; err != nil {
			t.Fatal(err)
		}
	}
	r := gin.New()
	r.GET("/failures", GetRequestFailures)
	query := func(q string) []models.RequestFailure {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest("GET", "/failures?"+q, nil))
		if w.Code != 200 {
			t.Fatalf("status %d: %s", w.Code, w.Body.String())
		}
		var items []models.RequestFailure
		if err := json.Unmarshal(w.Body.Bytes(), &items); err != nil {
			t.Fatal(err)
		}
		return items
	}
	first := query("limit=2&stage=upstream_response&status_code=503")
	if len(first) != 2 || first[0].ID <= first[1].ID {
		t.Fatalf("first page: %+v", first)
	}
	second := query("limit=2&stage=upstream_response&status_code=503&before_id=" + fmt.Sprint(first[1].ID))
	if len(second) != 2 || second[0].ID >= first[1].ID {
		t.Fatalf("second page: %+v", second)
	}
	upstream := 502
	item := models.RequestFailure{Stage: "transfer", Reason: "response_transfer_failed", StatusCode: 200, UpstreamStatusCode: &upstream}
	if err = db.DB.Create(&item).Error; err != nil {
		t.Fatal(err)
	}
	got := query("upstream_status_code=502")
	if len(got) != 1 || got[0].ID != item.ID {
		t.Fatalf("upstream filter: %+v", got)
	}
	query("before_id=3000000000")
	query("status_code=999&upstream_status_code=999")
	if err = db.DB.Exec("INSERT INTO request_failures(created_at,stage,reason,status_code) VALUES(?,?,?,?)", "2026-07-30T07:00:00+08:00", "local", "test", 500).Error; err != nil {
		t.Fatal(err)
	}
	before := query("until=" + url.QueryEscape("2026-07-30T00:00:00Z"))
	if len(before) != 1 || before[0].Stage != "local" {
		t.Fatalf("timestamp filter: %+v", before)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/failures?limit=bad", nil))
	if w.Code != 400 {
		t.Fatalf("invalid limit status %d", w.Code)
	}
}
