package main

import (
	"log"
	"net/http"
	"time"

	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/handlers"
	"backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.LoadConfig()

	db, err := database.InitDB(cfg.GetDSN())
	if err != nil {
		log.Fatalf("failed to initialize database: %v", err)
	}
	defer db.Close()

	if err := database.RunAutoMigration(db); err != nil {
		log.Fatalf("auto-migration failed: %v", err)
	}

	if err := database.SeedAdminUser(db, cfg.AdminEmail, cfg.AdminUsername, cfg.AdminPassword); err != nil {
		log.Fatalf("admin seeder failed: %v", err)
	}

	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Logger(), middleware.CustomRecovery(), middleware.CORSMiddleware(cfg.FrontendURL))

	authRateLimiter := middleware.RateLimitMiddleware(60, time.Minute)

	authHandler := handlers.NewAuthHandler(db, cfg.SessionExpiryHours)
	userHandler := handlers.NewUserHandler(db)
	adminHandler := handlers.NewAdminHandler(db)

	welcomeHandler := func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message":      "PT KKI Authentication API Service is running",
			"status":       "healthy",
			"frontend_url": "http://localhost:3000",
			"endpoints": gin.H{
				"health":   "/api/health",
				"login":    "/api/auth/login",
				"register": "/api/auth/register",
				"me":       "/api/users/me",
				"admin":    "/api/admin/users",
			},
		})
	}

	router.GET("/", welcomeHandler)

	api := router.Group("/api")
	{
		api.GET("", welcomeHandler)
		api.GET("/", welcomeHandler)

		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status":  "healthy",
				"service": "auth-backend",
			})
		})

		auth := api.Group("/auth")
		{
			auth.POST("/register", authRateLimiter, authHandler.Register)
			auth.POST("/login", authRateLimiter, authHandler.Login)
		}

		protectedAuth := api.Group("/auth").Use(middleware.AuthMiddleware(db))
		{
			protectedAuth.POST("/logout", authHandler.Logout)
			protectedAuth.POST("/logout-all", authHandler.LogoutAll)
		}

		users := api.Group("/users").Use(middleware.AuthMiddleware(db))
		{
			users.GET("/me", userHandler.GetMe)
		}

		admin := api.Group("/admin").Use(middleware.AuthMiddleware(db), middleware.AdminOnly())
		{
			admin.GET("/users", adminHandler.GetAllUsers)
			admin.POST("/users/:id/force-logout", adminHandler.ForceLogout)
			admin.DELETE("/users/:id/sessions", adminHandler.ForceLogout)
		}
	}

	serverAddr := ":" + cfg.Port
	log.Printf("server starting on port %s", cfg.Port)
	if err := router.Run(serverAddr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
