package middleware

import (
	"database/sql"
	"net/http"
	"strings"

	"backend/internal/models"

	"github.com/gin-gonic/gin"
)

const (
	ContextUserKey    = "current_user"
	ContextSessionKey = "current_session"
	ContextTokenKey   = "current_token"
)

// AuthMiddleware validates active stateful sessions directly against PostgreSQL
func AuthMiddleware(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header is required",
			})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid authorization header format. Expected 'Bearer <token>'",
			})
			return
		}

		token := strings.TrimSpace(parts[1])
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Token is empty",
			})
			return
		}

		query := `
			SELECT 
				s.id, s.user_id, s.token, COALESCE(s.user_agent, ''), COALESCE(s.ip_address, ''), s.created_at, s.expires_at,
				u.id, u.email, u.username, u.role, u.created_at, u.updated_at
			FROM sessions s
			JOIN users u ON s.user_id = u.id
			WHERE s.token = $1 AND s.expires_at > CURRENT_TIMESTAMP
			LIMIT 1
		`

		var session models.Session
		var user models.User

		err := db.QueryRow(query, token).Scan(
			&session.ID,
			&session.UserID,
			&session.Token,
			&session.UserAgent,
			&session.IPAddress,
			&session.CreatedAt,
			&session.ExpiresAt,
			&user.ID,
			&user.Email,
			&user.Username,
			&user.Role,
			&user.CreatedAt,
			&user.UpdatedAt,
		)

		if err != nil {
			if err == sql.ErrNoRows {
				var reason string
				errRev := db.QueryRow("SELECT reason FROM revoked_tokens WHERE token = $1 LIMIT 1", token).Scan(&reason)
				if errRev == nil {
					switch reason {
					case "max_sessions_exceeded":
						c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
							"error":       "Sesi Tergeser (Batas Maksimal 2 Perangkat)",
							"reason_code": "max_sessions_exceeded",
							"reason_text": "Akun Anda baru saja masuk dari perangkat ke-3. Sesi pada perangkat ini diakhiri secara otomatis demi mematuhi batas maksimal 2 sesi aktif.",
						})
						return
					case "admin_force_logout":
						c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
							"error":       "Diputus oleh Administrator",
							"reason_code": "admin_force_logout",
							"reason_text": "Administrator sistem telah memutus seluruh sesi aktif akun Anda secara real-time.",
						})
						return
					case "user_logout_all":
						c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
							"error":       "Keluar dari Semua Perangkat",
							"reason_code": "user_logout_all",
							"reason_text": "Anda telah keluar dari seluruh sesi akun ini pada semua perangkat.",
						})
						return
					case "user_logout":
						c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
							"error":       "Anda Telah Keluar",
							"reason_code": "user_logout",
							"reason_text": "Anda telah keluar dari akun pada perangkat ini.",
						})
						return
					}
				}

				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error":       "Sesi Kedaluwarsa",
					"reason_code": "session_expired",
					"reason_text": "Masa berlaku sesi Anda telah berakhir atau sesi tidak lagi valid. Silakan masuk kembali.",
				})
				return
			}
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "Gagal memverifikasi sesi otentikasi",
			})
			return
		}

		c.Set(ContextUserKey, &user)
		c.Set(ContextSessionKey, &session)
		c.Set(ContextTokenKey, token)

		c.Next()
	}
}

// GetCurrentUser extracts authenticated user from context
func GetCurrentUser(c *gin.Context) (*models.User, bool) {
	val, exists := c.Get(ContextUserKey)
	if !exists {
		return nil, false
	}
	user, ok := val.(*models.User)
	return user, ok
}

// GetCurrentSession extracts active session from context
func GetCurrentSession(c *gin.Context) (*models.Session, bool) {
	val, exists := c.Get(ContextSessionKey)
	if !exists {
		return nil, false
	}
	session, ok := val.(*models.Session)
	return session, ok
}
