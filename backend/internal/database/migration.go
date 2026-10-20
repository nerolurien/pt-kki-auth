package database

import (
	"database/sql"
	_ "embed"
	"fmt"
	"log"
)

//go:embed schema.sql
var schemaSQL string

func RunAutoMigration(db *sql.DB) error {
	log.Println("running database schema migration")
	if _, err := db.Exec(schemaSQL); err != nil {
		return fmt.Errorf("database migration failed: %w", err)
	}
	return nil
}
