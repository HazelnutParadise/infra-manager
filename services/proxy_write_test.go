package services

import (
	"errors"
	"github.com/gin-gonic/gin"
	"infra-manager/models"
	"net/http"
	"net/http/httptest"
	"testing"
)

type failingResponseWriter struct {
	header http.Header
	status int
}

func (w *failingResponseWriter) Header() http.Header    { return w.header }
func (w *failingResponseWriter) WriteHeader(status int) { w.status = status }
func (w *failingResponseWriter) Write(p []byte) (int, error) {
	return 0, errors.New("client disconnected")
}
func TestNonStreamingClientWriteFailureIsRecorded(t *testing.T) {
	gin.SetMode(gin.TestMode)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "5")
		w.Write([]byte("hello"))
	}))
	defer upstream.Close()
	var failure models.RequestFailure
	var recorded bool
	router := gin.New()
	router.GET("/", func(c *gin.Context) {
		c.Set("service", models.Service{ID: 4, BaseURL: upstream.URL})
		c.Set("targetEndpoint", "")
		ProxyRequest(c)
		value, ok := c.Get("requestFailure")
		if ok {
			failure = value.(models.RequestFailure)
			recorded = true
		}
	})
	writer := &failingResponseWriter{header: make(http.Header)}
	router.ServeHTTP(writer, httptest.NewRequest("GET", "/", nil))
	if !recorded || failure.Stage != "transfer" || failure.Reason != "client_write_failed" || failure.UpstreamStatusCode == nil || *failure.UpstreamStatusCode != 200 {
		t.Fatalf("recorded=%v failure=%+v", recorded, failure)
	}
}
