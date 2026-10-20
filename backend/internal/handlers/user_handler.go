package handlers

import (
	"database/sql"
	"log"
	"net/http"

	"backend/internal/middleware"
	"backend/internal/models"

	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	db *sql.DB
}

func NewUserHandler(db *sql.DB) *UserHandler {
	return &UserHandler{db: db}
}

func (h *UserHandler) GetMe(c *gin.Context) {
	user, ok := middleware.GetCurrentUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Pengguna tidak terotentikasi"})
		return
	}

	tokenVal, _ := c.Get(middleware.ContextTokenKey)
	currentToken, _ := tokenVal.(string)

	query := `
		SELECT id, COALESCE(user_agent, 'Unknown'), COALESCE(ip_address, 'Unknown'), created_at, expires_at, (token = $2) AS is_current
		FROM sessions
		WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
		ORDER BY created_at DESC
	`
	rows, err := h.db.QueryContext(c.Request.Context(), query, user.ID, currentToken)
	if err != nil {
		log.Printf("query sessions error for user %s: %v", user.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar sesi aktif"})
		return
	}
	defer rows.Close()

	sessions := make([]models.SessionResponse, 0)
	for rows.Next() {
		var s models.SessionResponse
		if err := rows.Scan(&s.ID, &s.UserAgent, &s.IPAddress, &s.CreatedAt, &s.ExpiresAt, &s.IsCurrent); err != nil {
			log.Printf("scan session error: %v", err)
			continue
		}
		sessions = append(sessions, s)
	}

	response := models.UserProfileResponse{
		User: models.UserResponse{
			ID:        user.ID,
			Email:     user.Email,
			Username:  user.Username,
			Role:      user.Role,
			CreatedAt: user.CreatedAt,
		},
		Sessions: sessions,
	}

	c.JSON(http.StatusOK, response)
}
