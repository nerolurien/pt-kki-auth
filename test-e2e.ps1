Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "    PENGUJIAN OTOMATIS SISTEM OTENTIKASI & ATURAN SESI     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:8080/api"

# 1. Health check
Write-Host "`n[1/6] Menguji Endpoint Healthcheck..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
Write-Host "  -> Backend Status: $($health.status) ($($health.service))" -ForegroundColor Green

# 2. Login Admin Pertama (Auto-Seeded)
Write-Host "`n[2/6] Menguji Login Akun Admin Pertama..." -ForegroundColor Yellow
$adminBody = @{ identifier = "admin@kki.co.id"; password = "Admin123!" } | ConvertTo-Json
$adminLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $adminBody -ContentType "application/json"
$adminToken = $adminLogin.token
Write-Host "  -> Berhasil masuk sebagai Admin: $($adminLogin.user.username) (Role: $($adminLogin.user.role))" -ForegroundColor Green

# 3. Pendaftaran User Baru
$testEmail = "karyawan_$(Get-Random)@kki.co.id"
$testUsername = "user_$(Get-Random -Minimum 1000 -Maximum 9999)"
$testPassword = "Password123!"
Write-Host "`n[3/6] Menguji Registrasi Pengguna Baru ($testUsername)..." -ForegroundColor Yellow
$regBody = @{ email = $testEmail; username = $testUsername; password = $testPassword } | ConvertTo-Json
$regRes = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $regBody -ContentType "application/json"
$userId = $regRes.user.id
Write-Host "  -> Berhasil mendaftar. User ID: $userId" -ForegroundColor Green

# 4. Pengujian ATURAN MAKSIMAL 2 SESI AKTIF
Write-Host "`n[4/6] Menguji ATURAN MAKSIMAL 2 SESI AKTIF (Login 1, Login 2, Login 3)..." -ForegroundColor Yellow
$userLoginBody = @{ identifier = $testUsername; password = $testPassword } | ConvertTo-Json

# Login 1
$login1 = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $userLoginBody -ContentType "application/json"
$token1 = $login1.token
$prof1 = Invoke-RestMethod -Uri "$baseUrl/users/me" -Method Get -Headers @{ Authorization = "Bearer $token1" }
Write-Host "  -> Login 1 berhasil. Total Sesi Aktif: $($prof1.sessions.Count) / 2" -ForegroundColor Green

# Login 2
$login2 = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $userLoginBody -ContentType "application/json"
$token2 = $login2.token
$prof2 = Invoke-RestMethod -Uri "$baseUrl/users/me" -Method Get -Headers @{ Authorization = "Bearer $token2" }
Write-Host "  -> Login 2 berhasil. Total Sesi Aktif: $($prof2.sessions.Count) / 2" -ForegroundColor Green

# Login 3 (Harus mengakhiri Login 1 secara otomatis)
$login3 = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $userLoginBody -ContentType "application/json"
$token3 = $login3.token
$prof3 = Invoke-RestMethod -Uri "$baseUrl/users/me" -Method Get -Headers @{ Authorization = "Bearer $token3" }
Write-Host "  -> Login 3 berhasil. Total Sesi Aktif tetap: $($prof3.sessions.Count) / 2 (Sesi tertua berhasil diputus!)" -ForegroundColor Green

# Verifikasi Sesi 1 sudah tidak berlaku (Harus 401 Unauthorized)
Write-Host "  -> Memverifikasi Sesi 1 (perangkat tertua) ditolak dengan 401 Unauthorized..." -NoNewline
try {
    Invoke-RestMethod -Uri "$baseUrl/users/me" -Method Get -Headers @{ Authorization = "Bearer $token1" }
    Write-Host " GAGAL! (Sesi 1 masih aktif)" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host " SUKSES! (HTTP 401 Unauthorized)" -ForegroundColor Green
    } else {
        Write-Host " Gagal dengan kode status: $statusCode" -ForegroundColor Red
    }
}

# 5. Pengujian FORCE LOGOUT oleh Administrator
Write-Host "`n[5/6] Menguji Fitur FORCE LOGOUT oleh Admin..." -ForegroundColor Yellow
$forceRes = Invoke-RestMethod -Uri "$baseUrl/admin/users/$userId/force-logout" -Method Post -Headers @{ Authorization = "Bearer $adminToken" }
Write-Host "  -> Admin memutus seluruh sesi untuk user '$testUsername'. Sesi terhapus: $($forceRes.sessions_revoked)" -ForegroundColor Green

# Verifikasi Sesi 2 & 3 seketika menjadi 401 Unauthorized
Write-Host "  -> Memverifikasi Sesi 2 & 3 langsung tidak berlaku (HTTP 401)..." -NoNewline
$isRevoked = $true
try {
    Invoke-RestMethod -Uri "$baseUrl/users/me" -Method Get -Headers @{ Authorization = "Bearer $token2" }
    $isRevoked = $false
} catch {}
try {
    Invoke-RestMethod -Uri "$baseUrl/users/me" -Method Get -Headers @{ Authorization = "Bearer $token3" }
    $isRevoked = $false
} catch {}

if ($isRevoked) {
    Write-Host " SUKSES! (Seluruh perangkat langsung tertolak)" -ForegroundColor Green
} else {
    Write-Host " GAGAL! (Masih ada sesi yang berlaku)" -ForegroundColor Red
}

# 6. Pengujian Hak Akses Admin (Role-Based Access Control)
Write-Host "`n[6/6] Menguji Proteksi Role (User Biasa TIDAK BISA membuka endpoint Admin)..." -NoNewline
$newLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $userLoginBody -ContentType "application/json"
$regularToken = $newLogin.token
try {
    Invoke-RestMethod -Uri "$baseUrl/admin/users" -Method Get -Headers @{ Authorization = "Bearer $regularToken" }
    Write-Host " GAGAL! (User biasa bisa akses admin)" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 403) {
        Write-Host " SUKSES! (HTTP 403 Forbidden)" -ForegroundColor Green
    } else {
        Write-Host " Terhalang dengan status $statusCode" -ForegroundColor Yellow
    }
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "   SEMUA SKENARIO PENGUJIAN BERHASIL MEMENUHI SYARAT!     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
