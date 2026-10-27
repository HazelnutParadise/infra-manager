package middlewares

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"infra-manager/db"
	"infra-manager/models"
	"infra-manager/services"
)

func TestUseTokenAuthentication(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldDB := db.DB
	t.Cleanup(func() { db.DB = oldDB })
	var err error
	db.DB, err = gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sqlDB.Close() })
	if err = db.DB.AutoMigrate(&models.User{}, &models.Service{}, &models.Token{}); err != nil {
		t.Fatal(err)
	}
	user := models.User{Username: "u", IsActive: true}
	service := models.Service{Name: "svc", BaseURL: "http://example.test", IsActive: true}
	for _, v := range []any{&user, &service} {
		if err := db.DB.Create(v).Error; err != nil {
			t.Fatal(err)
		}
	}
	makeToken := func(value string, active bool, expiry time.Time) {
		token := models.Token{TokenValue: value, UserID: user.ID, ServiceID: service.ID, ExpiresAt: expiry}
		if err := db.DB.Create(&token).Error; err != nil {
			t.Fatal(err)
		}
		if !active {
			if err := db.DB.Model(&token).Update("is_active", false).Error; err != nil {
				t.Fatal(err)
			}
		}
	}
	makeToken("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", true, time.Now().Add(time.Hour))
	makeToken("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", true, time.Now().Add(time.Hour))
	makeToken("cccccccccccccccccccccccccccccccc", false, time.Now().Add(time.Hour))
	makeToken("dddddddddddddddddddddddddddddddd", true, time.Now().Add(-time.Hour))
	makeToken("custom-token", true, time.Now().Add(time.Hour))
	r := gin.New()
	r.Any("/use/*path", TokenAuth(), func(c *gin.Context) {
		c.String(200, "%s|%s", c.MustGet("token").(models.Token).TokenValue, c.GetString("targetEndpoint"))
	})
	cases := []struct {
		name, path, header string
		status             int
		body               string
	}{
		{"legacy", "/use/svc/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/items", "", 200, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|items"},
		{"bearer", "/use/svc/items/42", "Bearer bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", 200, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|items/42"},
		{"bearer root", "/use/svc", "bearer bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", 200, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|"},
		{"custom url priority", "/use/svc/custom-token/items", "Bearer bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", 200, "custom-token|items"},
		{"url priority", "/use/svc/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/items", "Bearer bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", 200, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|items"},
		{"inactive url", "/use/svc/cccccccccccccccccccccccccccccccc/items", "Bearer bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", 403, ""},
		{"expired url", "/use/svc/dddddddddddddddddddddddddddddddd/items", "Bearer bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", 403, ""},
		{"invalid url", "/use/svc/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/items", "Bearer bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", 403, ""},
		{"invalid bearer", "/use/svc/items", "Bearer wrong", 403, ""},
		{"missing", "/use/svc", "", 400, ""},
	}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "%s|%s|%s", r.URL.Path, r.URL.RawQuery, r.Header.Get("Authorization"))
	}))
	defer upstream.Close()
	if err := db.DB.Model(&service).Update("base_url", upstream.URL).Error; err != nil {
		t.Fatal(err)
	}
	proxy := gin.New()
	proxy.Any("/use/*path", TokenAuth(), services.ProxyRequest)
	request := httptest.NewRequest("GET", "/use/svc/items/42?q=ok", nil)
	request.Header.Set("Authorization", "Bearer bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
	response := httptest.NewRecorder()
	proxy.ServeHTTP(response, request)
	if response.Code != 200 || response.Body.String() != "/items/42|q=ok|Bearer bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" {
		t.Fatalf("proxy: status %d body %q", response.Code, response.Body.String())
	}

	forced := httptest.NewRequest("GET", "/use/svc/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/items", nil)
	forced.Header.Set("Authorization", "Bearer bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
	forced.Header.Set("X-Infra-Token-Source", "bearer")
	forcedResponse := httptest.NewRecorder()
	r.ServeHTTP(forcedResponse, forced)
	if forcedResponse.Code != 200 || forcedResponse.Body.String() != "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/items" {
		t.Fatalf("forced bearer: status %d body %q", forcedResponse.Code, forcedResponse.Body.String())
	}

	legacy := gin.New()
	legacy.Any("/api/*path", TokenAuth(), func(c *gin.Context) { c.Status(204) })
	legacyRequest := httptest.NewRequest("GET", "/api/svc/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/items", nil)
	legacyRequest.Header.Set("Authorization", "Bearer wrong")
	legacyResponse := httptest.NewRecorder()
	legacy.ServeHTTP(legacyResponse, legacyRequest)
	if legacyResponse.Code != 204 {
		t.Fatalf("legacy /api: status %d", legacyResponse.Code)
	}

	var logOutput bytes.Buffer
	previousLogger := db.DB.Logger
	db.DB.Logger = logger.New(log.New(&logOutput, "", 0), logger.Config{LogLevel: logger.Info})
	invalid := httptest.NewRequest("GET", "/use/svc/items", nil)
	invalid.Header.Set("Authorization", "Bearer secret-invalid-token")
	invalidResponse := httptest.NewRecorder()
	r.ServeHTTP(invalidResponse, invalid)
	db.DB.Logger = previousLogger
	if invalidResponse.Code != 403 || strings.Contains(logOutput.String(), "secret-invalid-token") {
		t.Fatalf("invalid bearer must be rejected without logging the credential")
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tc.path, nil)
			if tc.header != "" {
				req.Header.Set("Authorization", tc.header)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.status {
				t.Fatalf("status %d, want %d, body %s", w.Code, tc.status, w.Body.String())
			}
			if tc.body != "" && w.Body.String() != tc.body {
				t.Fatalf("body %q, want %q", w.Body.String(), tc.body)
			}
		})
	}
}
