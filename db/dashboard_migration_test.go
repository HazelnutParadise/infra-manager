package db

import (
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"testing"
)

func TestDashboardMigrationPreservesExistingServicesAndIsRepeatable(t *testing.T) {
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = database.Exec(`CREATE TABLE services (id INTEGER PRIMARY KEY, name TEXT NOT NULL); INSERT INTO services(id,name) VALUES(1,'legacy')`).Error; err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err = ApplyDashboardMigration(database); err != nil {
			t.Fatal(err)
		}
	}
	var row struct {
		Name string
		Type string
	}
	if err = database.Raw("SELECT name,type FROM services WHERE id=1").Scan(&row).Error; err != nil || row.Name != "legacy" || row.Type != "" {
		t.Fatalf("legacy row %+v %v", row, err)
	}
	if !database.Migrator().HasTable("dashboard_snapshots") {
		t.Fatal("snapshot table missing")
	}
}
