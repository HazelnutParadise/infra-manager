package db

import (
	_ "embed"
	"gorm.io/gorm"
)

//go:embed migrations/20261028_service_type.sql
var serviceTypeMigration string

//go:embed migrations/20261028_dashboard_snapshots.sql
var dashboardSnapshotMigration string

// ApplyDashboardMigration upgrades existing SQLite databases without changing existing service data.
func ApplyDashboardMigration(database *gorm.DB) error {
	return database.Transaction(func(tx *gorm.DB) error {
		if tx.Migrator().HasTable("services") && !tx.Migrator().HasColumn("services", "type") {
			if err := tx.Exec(serviceTypeMigration).Error; err != nil {
				return err
			}
		}
		return tx.Exec(dashboardSnapshotMigration).Error
	})
}
