package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func InitDB(dsn string) (*sql.DB, error) {
	var db *sql.DB
	var err error

	maxRetries := 15
	retryInterval := 2 * time.Second

	for i := 1; i <= maxRetries; i++ {
		db, err = sql.Open("pgx", dsn)
		if err == nil {
			err = db.Ping()
			if err == nil {
				log.Println("connected to postgresql database")
				break
			}
		}

		log.Printf("database connection failed (attempt %d/%d): %v", i, maxRetries, err)
		time.Sleep(retryInterval)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to connect to database after %d attempts: %w", maxRetries, err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(15 * time.Minute)

	return db, nil
}
