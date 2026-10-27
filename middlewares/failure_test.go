package middlewares

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"infra-manager/db"
	"infra-manager/models"
	"infra-manager/services"
)

func TestFailureEvents(t *testing.T) {
	gin.SetMode(gin.TestMode)
	old := db.DB
	t.Cleanup(func() { db.DB = old })
	var err error
	db.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.DB.AutoMigrate(&models.User{}, &models.Service{}, &models.Token{}, &models.RequestFailure{}); err != nil {
		t.Fatal(err)
	}
	u := models.User{Username: "test", IsActive: true}
	db.DB.Create(&u)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(503) }))
	defer upstream.Close()
	s := models.Service{Name: "svc", BaseURL: upstream.URL, IsActive: true}
	db.DB.Create(&s)
	tok := models.Token{TokenValue: "valid", UserID: u.ID, ServiceID: s.ID, ExpiresAt: time.Now().Add(time.Hour), IsActive: true}
	db.DB.Create(&tok)
	r := gin.New()
	r.Any("/use/*path", FailureRecorder(), TokenAuth(), services.ProxyRequest)
	r.Any("/api/*path", FailureRecorder(), TokenAuth(), services.ProxyRequest)
	for _, tc := range []struct {
		path     string
		code     int
		stage    string
		upstream int
	}{
		{"/use/svc/wrong", 403, "authentication", 0},
		{"/api/svc/wrong", 403, "authentication", 0},
		{"/use/svc/valid", 503, "upstream_response", 503},
	} {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest("GET", tc.path, nil))
		if w.Code != tc.code {
			t.Fatalf("status got %d want %d", w.Code, tc.code)
		}
		var f models.RequestFailure
		if err := db.DB.Order("id desc").First(&f).Error; err != nil {
			t.Fatal(err)
		}
		if f.Stage != tc.stage || f.StatusCode != tc.code || (tc.upstream != 0 && (f.UpstreamStatusCode == nil || *f.UpstreamStatusCode != tc.upstream)) {
			t.Fatalf("unexpected failure: %+v", f)
		}
	}
	if err := db.DB.Model(&s).Update("base_url", "http://127.0.0.1:1").Error; err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/use/svc/valid", nil))
	var connectionFailure models.RequestFailure
	if err := db.DB.Order("id desc").First(&connectionFailure).Error; err != nil {
		t.Fatal(err)
	}
	if w.Code != 502 || connectionFailure.Stage != "upstream_connection" || connectionFailure.StatusCode != 502 || connectionFailure.UpstreamStatusCode != nil {
		t.Fatalf("connection failure: %d %+v", w.Code, connectionFailure)
	}
	var count int64
	db.DB.Model(&models.RequestFailure{}).Count(&count)
	if count != 4 {
		t.Fatalf("unexpected event count %d", count)
	}
}

func TestFailureCleanupRemovesOnlyExpired(t *testing.T) {
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
	now := time.Date(2026, 10, 27, 0, 0, 0, 0, time.UTC)
	for _, when := range []time.Time{now.AddDate(0, 0, -91), now.AddDate(0, 0, -89)} {
		f := models.RequestFailure{CreatedAt: when, Stage: "local", Reason: "test", StatusCode: 500}
		if err = db.DB.Create(&f).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err = RemoveExpiredFailures(now); err != nil {
		t.Fatal(err)
	}
	var count int64
	db.DB.Model(&models.RequestFailure{}).Count(&count)
	if count != 1 {
		t.Fatalf("remaining %d, want 1", count)
	}
}

func TestFailureLimitKeepsNewest(t *testing.T) {
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
	for i := 0; i < 5; i++ {
		f := models.RequestFailure{Stage: "authentication", Reason: "invalid_token", StatusCode: 403}
		if err = saveFailure(&f, 3); err != nil {
			t.Fatal(err)
		}
	}
	var rows []models.RequestFailure
	if err = db.DB.Order("id").Find(&rows).Error; err != nil {
		t.Fatal(err)
	}
	if len(rows) != 3 || rows[0].ID != 3 || rows[2].ID != 5 {
		t.Fatalf("rows %+v", rows)
	}
}

func TestAccessLogCleanupKeepsNinetyDays(t *testing.T) {
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
	now := time.Date(2026, 10, 27, 0, 0, 0, 0, time.UTC)
	for _, d := range []int{-91, -90, -89} {
		row := models.AccessLog{Model: gorm.Model{CreatedAt: now.AddDate(0, 0, d)}}
		if err = db.DB.Create(&row).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err = RemoveExpiredAccessLogs(now); err != nil {
		t.Fatal(err)
	}
	var rows []models.AccessLog
	if err = db.DB.Find(&rows).Error; err != nil {
		t.Fatal(err)
	}
	if len(rows) != 2 {
		t.Fatalf("remaining %d, want 2", len(rows))
	}
}

func TestAccessLogLimitKeepsNewest(t *testing.T) {
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
	for i := 0; i < 5; i++ {
		row := models.AccessLog{Endpoint: "/test"}
		if err = saveAccessLog(&row, 3); err != nil {
			t.Fatal(err)
		}
	}
	var rows []models.AccessLog
	if err = db.DB.Order("id").Find(&rows).Error; err != nil {
		t.Fatal(err)
	}
	if len(rows) != 3 || rows[0].ID != 3 || rows[2].ID != 5 {
		t.Fatalf("rows %+v", rows)
	}
}

func TestAccessLogLengthIsBounded(t *testing.T) {
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
	row := models.AccessLog{Endpoint: strings.Repeat("測", 600), Method: strings.Repeat("A", 40)}
	if err = saveAccessLog(&row, 10); err != nil {
		t.Fatal(err)
	}
	var stored models.AccessLog
	if err = db.DB.First(&stored, row.ID).Error; err != nil {
		t.Fatal(err)
	}
	if len([]rune(stored.Endpoint)) != 512 || len([]rune(stored.Method)) != 32 {
		t.Fatalf("unexpected lengths %d %d", len([]rune(stored.Endpoint)), len([]rune(stored.Method)))
	}
}

func TestCleanupUsesAbsoluteTimesAcrossOffsets(t *testing.T) {
	old := db.DB
	t.Cleanup(func() { db.DB = old })
	var err error
	db.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.DB.AutoMigrate(&models.AccessLog{}, &models.RequestFailure{}); err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"access_logs", "request_failures"} {
		if err = db.DB.Exec("INSERT INTO "+table+" (created_at) VALUES (?), (?)", "2026-07-30T07:00:00+08:00", "2026-07-30T01:00:00+00:00").Error; err != nil {
			t.Fatal(err)
		}
	}
	now := time.Date(2026, 10, 28, 0, 0, 0, 0, time.UTC)
	if err = RemoveExpiredAccessLogs(now); err != nil {
		t.Fatal(err)
	}
	if err = RemoveExpiredFailures(now); err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"access_logs", "request_failures"} {
		var count int64
		db.DB.Table(table).Count(&count)
		if count != 1 {
			t.Errorf("%s remaining %d, want 1", table, count)
		}
	}
}

func TestCleanupAcrossBatches(t *testing.T) {
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
	now := time.Now()
	events := make([]models.RequestFailure, 1002)
	for i := range events {
		events[i] = models.RequestFailure{CreatedAt: now.AddDate(0, 0, -100), Stage: "local", Reason: "test", StatusCode: 500}
	}
	events[len(events)-1].CreatedAt = now
	if err = db.DB.CreateInBatches(&events, 200).Error; err != nil {
		t.Fatal(err)
	}
	if err = RemoveExpiredFailures(now); err != nil {
		t.Fatal(err)
	}
	var count int64
	db.DB.Model(&models.RequestFailure{}).Count(&count)
	if count != 1 {
		t.Fatalf("remaining %d, want 1", count)
	}
}
