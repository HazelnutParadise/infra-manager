package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestManagementResponsesDoNotUseCachedVersions(t *testing.T) {
	if err := os.Chdir(".."); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := os.Chdir("api"); err != nil {
			t.Error(err)
		}
	})
	router := SetupRouter()
	for _, path := range []string{"/login", "/dashboard", "/admin/stats/recent", "/static/css/main.css", "/static/js/main.js", "/static/missing.js"} {
		t.Run(path, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, path, nil)
			request.Header.Set("If-Modified-Since", "Wed, 31 Dec 2099 23:59:59 GMT")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if !strings.Contains(response.Header().Get("Cache-Control"), "no-store") {
				t.Fatalf("%s: Cache-Control = %q", path, response.Header().Get("Cache-Control"))
			}
			if strings.HasPrefix(path, "/static/") && !strings.Contains(path, "missing") && response.Code != http.StatusOK {
				t.Fatalf("%s: got status %d", path, response.Code)
			}
		})
	}
	request := httptest.NewRequest(http.MethodGet, "/robots.txt", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Header().Get("Cache-Control") != "" {
		t.Fatalf("unrelated route got cache policy %q", response.Header().Get("Cache-Control"))
	}
}
