package database

import (
	"database/sql"
	"fmt"
	"log"

	"golang.org/x/crypto/bcrypt"
)

func SeedAdminUser(db *sql.DB, email, username, password string) error {
	if email == "" {
		email = "admin@kki.co.id"
	}
	if username == "" {
		username = "admin"
	}
	if password == "" {
		password = "Admin123!"
	}

	var existingID string
	err := db.QueryRow("SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1", email, username).Scan(&existingID)
	if err == nil {
		return nil
	} else if err != sql.ErrNoRows {
		return fmt.Errorf("check existing admin user failed: %w", err)
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash admin password failed: %w", err)
	}

	query := `
		INSERT INTO users (id, email, username, password_hash, role, created_at, updated_at)
		VALUES (uuid_generate_v4(), $1, $2, $3, 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (email) DO NOTHING
	`
	_, err = db.Exec(query, email, username, string(hashedPassword))
	if err != nil {
		return fmt.Errorf("insert initial admin user failed: %w", err)
	}

	log.Printf("seeded initial admin user: %s (%s)", username, email)
	return nil
}
