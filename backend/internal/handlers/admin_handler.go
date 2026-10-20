package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"regexp"
	"strings"

	"backend/internal/models"

	"github.com/gin-gonic/gin"
)

var uuidRegex = regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`)

type AdminHandler struct {
	db *sql.DB
}

func NewAdminHandler(db *sql.DB) *AdminHandler {
	return &AdminHandler{db: db}
}

func (h *AdminHandler) GetAllUsers(c *gin.Context) {
	query := `
		SELECT 
			u.id, 
			u.email, 
			u.username, 
			u.role, 
			u.created_at,
			COUNT(s.id) FILTER (WHERE s.expires_at > CURRENT_TIMESTAMP) AS active_sessions_count
		FROM users u
		LEFT JOIN sessions s ON u.id = s.user_id
		GROUP BY u.id, u.email, u.username, u.role, u.created_at
		ORDER BY u.created_at DESC
	`

	rows, err := h.db.QueryContext(c.Request.Context(), query)
	if err != nil {
		log.Printf("get all users query error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar pengguna"})
		return
	}
	defer rows.Close()

	users := make([]models.AdminUserItem, 0)
	for rows.Next() {
		var u models.AdminUserItem
		if err := rows.Scan(&u.ID, &u.Email, &u.Username, &u.Role, &u.CreatedAt, &u.ActiveSessionsCount); err != nil {
			log.Printf("scan user error: %v", err)
			continue
		}
		users = append(users, u)
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"total": len(users),
	})
}

func (h *AdminHandler) ForceLogout(c *gin.Context) {
	targetUserID := strings.TrimSpace(c.Param("id"))
	if !uuidRegex.MatchString(targetUserID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format ID pengguna tidak valid"})
		return
	}

	var username string
	err := h.db.QueryRowContext(c.Request.Context(), "SELECT username FROM users WHERE id = $1", targetUserID).Scan(&username)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pengguna tidak ditemukan"})
			return
		}
		log.Printf("check target user error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memverifikasi pengguna"})
		return
	}

	_, _ = h.db.ExecContext(c.Request.Context(),
		"INSERT INTO revoked_tokens (token, reason, revoked_at) SELECT token, 'admin_force_logout', CURRENT_TIMESTAMP FROM sessions WHERE user_id = $1 ON CONFLICT (token) DO UPDATE SET reason = EXCLUDED.reason",
		targetUserID,
	)

	query := "DELETE FROM sessions WHERE user_id = $1"
	res, err := h.db.ExecContext(c.Request.Context(), query, targetUserID)
	if err != nil {
		log.Printf("force logout error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memutus sesi pengguna"})
		return
	}

	rowsAffected, _ := res.RowsAffected()

	c.JSON(http.StatusOK, gin.H{
		"message":          "Seluruh sesi aktif pengguna berhasil diputus secara real-time.",
		"user_id":          targetUserID,
		"username":         username,
		"sessions_revoked": rowsAffected,
	})
}
