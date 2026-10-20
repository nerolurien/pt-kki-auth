package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port               string
	DBHost             string
	DBPort             string
	DBUser             string
	DBPassword         string
	DBName             string
	DBSSLMode          string
	FrontendURL        string
	SessionExpiryHours int
	AdminEmail         string
	AdminUsername      string
	AdminPassword      string
}

func LoadConfig() *Config {
	expiryHours, err := strconv.Atoi(getEnv("SESSION_EXPIRY_HOURS", "24"))
	if err != nil || expiryHours <= 0 {
		expiryHours = 24
	}

	return &Config{
		Port:               getEnv("PORT", "8080"),
		DBHost:             getEnv("DB_HOST", "postgres"),
		DBPort:             getEnv("DB_PORT", "5432"),
		DBUser:             getEnv("DB_USER", "postgres"),
		DBPassword:         getEnv("DB_PASSWORD", "postgres"),
		DBName:             getEnv("DB_NAME", "auth_db"),
		DBSSLMode:          getEnv("DB_SSLMODE", "disable"),
		FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:3000"),
		SessionExpiryHours: expiryHours,
		AdminEmail:         getEnv("ADMIN_EMAIL", "admin@kki.co.id"),
		AdminUsername:      getEnv("ADMIN_USERNAME", "admin"),
		AdminPassword:      getEnv("ADMIN_PASSWORD", "Admin123!"),
	}
}

func (c *Config) GetDSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName, c.DBSSLMode)
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
