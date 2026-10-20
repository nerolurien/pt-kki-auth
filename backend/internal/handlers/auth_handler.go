package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"backend/internal/middleware"
	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

var (
	emailRegex    = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_.-]{3,30}$`)
)

type AuthHandler struct {
	db                 *sql.DB
	sessionExpiryHours int
}

func NewAuthHandler(db *sql.DB, sessionExpiryHours int) *AuthHandler {
	return &AuthHandler{
		db:                 db,
		sessionExpiryHours: sessionExpiryHours,
	}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Data registrasi tidak lengkap atau format salah.",
		})
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Username = strings.TrimSpace(req.Username)

	if len(req.Email) > 254 || !emailRegex.MatchString(req.Email) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Format alamat email tidak valid.",
		})
		return
	}

	if !usernameRegex.MatchString(req.Username) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Username hanya boleh berisi huruf, angka, garis bawah (_), titik (.), dan strip (-), panjang 3-30 karakter.",
		})
		return
	}

	if len(req.Password) < 6 || len(req.Password) > 72 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Password harus memiliki panjang 6 hingga 72 karakter.",
		})
		return
	}

	var existingID string
	err := h.db.QueryRow("SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1", req.Email).Scan(&existingID)
	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Email sudah terdaftar. Silakan gunakan email lain atau login.",
		})
		return
	} else if err != sql.ErrNoRows {
		log.Printf("check email error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Terjadi kesalahan saat memeriksa email"})
		return
	}

	err = h.db.QueryRow("SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1", req.Username).Scan(&existingID)
	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Username sudah digunakan. Silakan pilih username lain.",
		})
		return
	} else if err != sql.ErrNoRows {
		log.Printf("check username error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Terjadi kesalahan saat memeriksa username"})
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("hash password error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses password"})
		return
	}

	query := `
		INSERT INTO users (id, email, username, password_hash, role, created_at, updated_at)
		VALUES (uuid_generate_v4(), $1, $2, $3, 'user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, email, username, role, created_at
	`
	var user models.UserResponse
	err = h.db.QueryRow(query, req.Email, req.Username, string(passwordHash)).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&user.Role,
		&user.CreatedAt,
	)
	if err != nil {
		log.Printf("insert user error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data pengguna"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Registrasi berhasil! Silakan login dengan akun Anda.",
		"user":    user,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Identifier (email/username) dan password wajib diisi.",
		})
		return
	}

	identifier := strings.TrimSpace(req.Identifier)
	if identifier == "" || len(identifier) > 254 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Email atau username tidak valid.",
		})
		return
	}

	if len(req.Password) > 72 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Email/Username atau password salah.",
		})
		return
	}

	var user models.User
	query := `
		SELECT id, email, username, password_hash, role, created_at, updated_at
		FROM users
		WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)
		LIMIT 1
	`
	err := h.db.QueryRow(query, identifier).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Email/Username atau password salah.",
			})
			return
		}
		log.Printf("login query user error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Terjadi kesalahan internal pada server"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Email/Username atau password salah.",
		})
		return
	}

	tx, err := h.db.BeginTx(c.Request.Context(), nil)
	if err != nil {
		log.Printf("login begin tx error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memulai transaksi sesi"})
		return
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(c.Request.Context(),
		"DELETE FROM sessions WHERE user_id = $1 AND expires_at <= CURRENT_TIMESTAMP",
		user.ID,
	)
	if err != nil {
		log.Printf("clean expired sessions error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membersihkan sesi kedaluwarsa"})
		return
	}

	// Query active sessions with row-level lock (FOR UPDATE) to prevent race conditions
	rows, err := tx.QueryContext(c.Request.Context(),
		`SELECT id FROM sessions 
		 WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP 
		 ORDER BY created_at ASC 
		 FOR UPDATE`,
		user.ID,
	)
	if err != nil {
		log.Printf("query sessions for update error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memeriksa status sesi aktif"})
		return
	}

	var activeSessionIDs []string
	for rows.Next() {
		var sID string
		if err := rows.Scan(&sID); err != nil {
			rows.Close()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca sesi aktif"})
			return
		}
		activeSessionIDs = append(activeSessionIDs, sID)
	}
	rows.Close()

	// Max 2 active sessions: evict oldest session if limit reached
	if len(activeSessionIDs) >= 2 {
		toDeleteCount := len(activeSessionIDs) - 2 + 1
		for i := 0; i < toDeleteCount; i++ {
			oldestSessionID := activeSessionIDs[i]

			var evictedToken string
			_ = tx.QueryRowContext(c.Request.Context(), "SELECT token FROM sessions WHERE id = $1", oldestSessionID).Scan(&evictedToken)
			if evictedToken != "" {
				_, _ = tx.ExecContext(c.Request.Context(),
					"INSERT INTO revoked_tokens (token, reason, revoked_at) VALUES ($1, 'max_sessions_exceeded', CURRENT_TIMESTAMP) ON CONFLICT (token) DO UPDATE SET reason = EXCLUDED.reason",
					evictedToken,
				)
			}

			_, err = tx.ExecContext(c.Request.Context(), "DELETE FROM sessions WHERE id = $1", oldestSessionID)
			if err != nil {
				log.Printf("evict oldest session error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus sesi terlama"})
				return
			}
		}
	}

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		log.Printf("generate token error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghasilkan token sesi"})
		return
	}
	sessionToken := hex.EncodeToString(tokenBytes)

	userAgent := c.Request.UserAgent()
	ipAddress := c.ClientIP()
	expiresAt := time.Now().Add(time.Duration(h.sessionExpiryHours) * time.Hour)

	insertQuery := `
		INSERT INTO sessions (id, user_id, token, user_agent, ip_address, created_at, expires_at)
		VALUES (uuid_generate_v4(), $1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
	`
	_, err = tx.ExecContext(c.Request.Context(), insertQuery,
		user.ID,
		sessionToken,
		userAgent,
		ipAddress,
		expiresAt,
	)
	if err != nil {
		log.Printf("insert session error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan sesi baru"})
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("commit tx error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyelesaikan transaksi login"})
		return
	}

	c.JSON(http.StatusOK, models.LoginResponse{
		Token: sessionToken,
		User: models.UserResponse{
			ID:        user.ID,
			Email:     user.Email,
			Username:  user.Username,
			Role:      user.Role,
			CreatedAt: user.CreatedAt,
		},
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	tokenVal, exists := c.Get(middleware.ContextTokenKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Sesi tidak ditemukan"})
		return
	}
	token := tokenVal.(string)

	_, _ = h.db.Exec("INSERT INTO revoked_tokens (token, reason, revoked_at) VALUES ($1, 'user_logout', CURRENT_TIMESTAMP) ON CONFLICT (token) DO UPDATE SET reason = EXCLUDED.reason", token)
	query := "DELETE FROM sessions WHERE token = $1"
	_, err := h.db.Exec(query, token)
	if err != nil {
		log.Printf("delete session error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengeluarkan sesi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Logout berhasil. Sesi telah dihapus dari sistem.",
	})
}

func (h *AuthHandler) LogoutAll(c *gin.Context) {
	user, ok := middleware.GetCurrentUser(c)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Pengguna tidak terotentikasi"})
		return
	}

	_, _ = h.db.ExecContext(c.Request.Context(),
		"INSERT INTO revoked_tokens (token, reason, revoked_at) SELECT token, 'user_logout_all', CURRENT_TIMESTAMP FROM sessions WHERE user_id = $1 ON CONFLICT (token) DO UPDATE SET reason = EXCLUDED.reason",
		user.ID,
	)

	query := "DELETE FROM sessions WHERE user_id = $1"
	res, err := h.db.ExecContext(c.Request.Context(), query, user.ID)
	if err != nil {
		log.Printf("delete all sessions error for user %s: %v", user.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengeluarkan seluruh sesi"})
		return
	}

	rows, _ := res.RowsAffected()

	c.JSON(http.StatusOK, gin.H{
		"message":             "Berhasil keluar dari seluruh perangkat.",
		"sessions_terminated": rows,
	})
}
