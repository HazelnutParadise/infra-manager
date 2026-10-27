package controllers

import (
	"bytes"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"infra-manager/db"
	"infra-manager/models"
	"net/http/httptest"
	"testing"
	"time"
)

func TestEditTokenWithoutStatusPreservesState(t *testing.T) {
	gin.SetMode(gin.TestMode)
	old := db.DB
	t.Cleanup(func() { db.DB = old })
	var err error
	db.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.DB.AutoMigrate(&models.User{}, &models.Service{}, &models.Token{}); err != nil {
		t.Fatal(err)
	}
	token := models.Token{TokenValue: "test", UserID: 1, ServiceID: 1, ExpiresAt: time.Now().Add(time.Hour)}
	if err = db.DB.Create(&token).Error; err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	r.PUT("/tokens/:id/details", UpdateTokenDetails)
	w := httptest.NewRecorder()
	req := httptest.NewRequest("PUT", "/tokens/1/details", bytes.NewBufferString(`{"description":"updated","is_permanent":true}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("status %d %s", w.Code, w.Body.String())
	}
	var updated models.Token
	db.DB.First(&updated, token.ID)
	if !updated.IsActive {
		t.Fatal("editing unexpectedly disabled an active token")
	}
}

func TestLegacyTokenUpdateStillHonorsStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	old := db.DB
	t.Cleanup(func() { db.DB = old })
	var err error
	db.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.DB.AutoMigrate(&models.User{}, &models.Service{}, &models.Token{}); err != nil {
		t.Fatal(err)
	}
	token := models.Token{TokenValue: "legacy", UserID: 1, ServiceID: 1, ExpiresAt: time.Now().Add(time.Hour)}
	if err = db.DB.Create(&token).Error; err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	r.PUT("/tokens/:id", UpdateToken)
	w := httptest.NewRecorder()
	req := httptest.NewRequest("PUT", "/tokens/1", bytes.NewBufferString(`{"description":"legacy"}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("status %d", w.Code)
	}
	var updated models.Token
	db.DB.First(&updated, token.ID)
	if updated.IsActive {
		t.Fatal("legacy omitted status should preserve existing API behavior")
	}
}
