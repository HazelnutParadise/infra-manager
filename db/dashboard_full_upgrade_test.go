package db

import (
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"infra-manager/models"
	"testing"
)

func TestDashboardUpgradeThenAutoMigratePreservesLegacyService(t *testing.T) {
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sql := `CREATE TABLE services (id INTEGER PRIMARY KEY,created_at DATETIME,updated_at DATETIME,deleted_at DATETIME,name TEXT NOT NULL UNIQUE,description TEXT,base_url TEXT NOT NULL,is_active NUMERIC DEFAULT true);
 INSERT INTO services(id,name,description,base_url,is_active) VALUES(7,'legacy','saved','http://example.test',0);`
	if err = database.Exec(sql).Error; err != nil {
		t.Fatal(err)
	}
	if err = ApplyDashboardMigration(database); err != nil {
		t.Fatal(err)
	}
	if err = database.AutoMigrate(&models.Service{}); err != nil {
		t.Fatal(err)
	}
	var service models.Service
	if err = database.First(&service, 7).Error; err != nil {
		t.Fatal(err)
	}
	if service.Name != "legacy" || service.Description != "saved" || service.BaseURL != "http://example.test" || service.IsActive || service.Type != "" {
		t.Fatalf("legacy data changed: %+v", service)
	}
}
