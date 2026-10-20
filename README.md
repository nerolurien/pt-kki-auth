# Auth System - PT KKI Assessment

Project ini dibuat untuk tugas technical assessment di PT Kuliner Kreasindo Inovasi. Sistem otentikasi monorepo ini terdiri dari backend Go (Gin), frontend React (Vite + Tailwind), dan PostgreSQL 16. Seluruh service sudah di-containerize menggunakan Docker Compose, sehingga bisa langsung dijalankan tanpa perlu instalasi dependensi lokal maupun database manual.

---

## Cara Menjalankan

Cukup jalankan 4 perintah berikut di terminal:

```bash
git clone <url-repo>
cd "PT KKI"
cp .env.example .env
docker compose up -d --build
```

Setelah proses build selesai:
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:8080/api](http://localhost:8080/api) (Health check: `/api/health`)
- Database: PostgreSQL di port 5432

### Akun Admin Bawaan
Begitu backend menyala, seeder otomatis membuat 1 akun admin default (idempotent via `ON CONFLICT DO NOTHING`, aman di-restart berulang kali):
- Identifier: `admin@kki.co.id` atau `admin`
- Password: `Admin123!`
- Role: `admin`

*(Kredensial ini bisa disesuaikan lewat file `.env`)*

---

## Gambaran Fitur Aplikasi

### 1. Fitur Utama (Sesuai Batas Minimum)
- **Registrasi & Login Multi-Identifier**: Registrasi membuat user baru (role default: `user`). Login mendukung input alamat email maupun username.
- **Aturan Maksimal 2 Sesi Aktif**: Satu akun hanya boleh memiliki maksimal 2 sesi aktif. Jika user login di perangkat ke-3, sesi yang paling lama (`created_at ASC`) otomatis dihapus dari database.
- **Validasi Sesi Stateful**: Setiap request ke route terproteksi divalidasi langsung ke tabel `sessions`. Jika sesi sudah terhapus, request seketika ditolak dengan respon `401 Unauthorized`.
- **Halaman Profil Terproteksi (`/profile`)**: Menampilkan detail akun dan daftar seluruh sesi aktif (informasi perangkat, IP, dan waktu login).
- **Manajemen Pengguna Khusus Admin (`/admin/users`)**: Administrator dapat memantau seluruh pengguna beserta jumlah sesi aktifnya.
- **Force Logout oleh Admin**: Admin dapat memutus seluruh sesi milik user target secara real-time.
- **Auto-Migration & Auto-Seeding**: Skema database dan akun admin pertama otomatis terpasang saat container dijalankan.

### 2. Fitur Tambahan (Di Luar Kebutuhan Minimum)
- **Keluar dari Semua Perangkat (`POST /api/auth/logout-all`)**: Tombol mandiri pada halaman profil agar user bisa membersihkan seluruh sesi miliknya di perangkat lain.
- **Human-Readable Device Parser**: Otomatis menerjemahkan string teknis user-agent menjadi nama browser dan sistem operasi yang mudah dibaca (misal: *"Google Chrome pada Windows 10/11"*).
- **Live Heartbeat Polling 8 Detik**: Halaman profil secara berkala memeriksa keabsahan sesi, sehingga jika sesi diputus admin atau tergeser oleh login ke-3, user langsung ter-redirect otomatis ke halaman login.
- **Pemberitahuan Alasan Logout Kontekstual**: Halaman login menampilkan banner informatif yang membedakan penyebab logout (apakah karena tergeser batas 2 sesi, di-force logout admin, atau sesi kedaluwarsa).
- **Tombol Quick-Fill Akun Admin**: Shortcut 1-klik di form login untuk mempermudah pengujian akun admin bawaan.

---

## Daftar Endpoint API

Semua endpoint backend disajikan di bawah prefix `/api`:

| Method | Path | Auth / Role | Keterangan |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Cek status kesehatan backend |
| `POST` | `/api/auth/register` | Public | Pendaftaran user baru |
| `POST` | `/api/auth/login` | Public | Login via email/username (penegakan aturan 2 sesi) |
| `POST` | `/api/auth/logout` | Bearer Token | Logout dari sesi saat ini |
| `POST` | `/api/auth/logout-all` | Bearer Token | Logout dari semua sesi aktif user |
| `GET` | `/api/users/me` | Bearer Token | Ambil data profil dan daftar sesi aktif |
| `GET` | `/api/admin/users` | Bearer Token (Admin) | Ambil daftar user & jumlah sesi aktif |
| `POST` | `/api/admin/users/:id/force-logout` | Bearer Token (Admin) | Putus seluruh sesi aktif user target |

---

## Keputusan Teknis Penting

1. **Stateful Session vs Stateless JWT**:
   Saya memilih pendekatan stateful session yang dicatat di PostgreSQL dibanding stateless JWT tanpa database. Keputusan ini diambil karena adanya aturan bisnis maksimal 2 sesi aktif dan kebutuhan force-logout real-time. Dengan stateful session, pencabutan hak akses terjadi seketika (*instant revocation*) di level database tanpa perlu mekanisme blacklist token yang rumit.

2. **Pencegahan Race Condition Menggunakan Row-Level Lock (`FOR UPDATE`)**:
   Ketika user login bersamaan dari dua tab atau perangkat berbeda di milidetik yang sama, pengecekan jumlah sesi rentan mengalami race condition. Masalah ini ditangani dengan query `SELECT ... FOR UPDATE` di dalam transaksi Go (`db.BeginTx`), sehingga transaksi concurrent akan diantrekan secara serial dan batas 2 sesi dijamin konsisten.

3. **Auto-Migration Terintegrasi (`go:embed`)**:
   File SQL migrasi disematkan langsung ke dalam binary Go saat build. Hal ini memastikan database selalu sinkron saat container pertama kali menyala tanpa mewajibkan tim penilai menginstal CLI migrasi tambahan di host.

4. **Multi-Stage Build Nginx untuk Frontend SPA**:
   Frontend React dikompilasi secara multi-stage dan disajikan via web server Nginx statis dengan konfigurasi `try_files $uri $uri/ /index.html;`, sehingga ukuran container ringan dan navigasi client-side React Router tidak mengalami 404 saat halaman di-refresh.

---

## Catatan Implementasi

### 1. Bagaimana kata sandi disimpan dalam sistem Anda, dan mengapa Anda memilih cara tersebut?
Password disimpan dalam bentuk hash pada kolom `password_hash` di tabel `users` memakai bcrypt (`bcrypt.DefaultCost`). Logic pemanggilannya ada di fungsi `Register()` pada `backend/internal/handlers/auth_handler.go` dan `SeedAdmin()` di `backend/internal/database/seeder.go`. Saya memilih bcrypt karena sudah ada built-in salt acak 16-byte bawaan, jadi aman dari serangan rainbow table. Selain itu, work factor bcrypt bisa dinaikkan sesuai kemampuan mesin server buat memperlambat upaya brute-force offline, dan password plaintext sama sekali tidak pernah tersimpan di database maupun log.

### 2. Bagaimana sistem Anda mendefinisikan sebuah "sesi", dan pada berkas atau fungsi mana batas 2 sesi ditegakkan?
Sesi di sini didefinisikan sebagai satu record pada tabel `sessions` PostgreSQL, berisi token acak 64-karakter hex (`crypto/rand`), user-agent, IP address, waktu login, dan masa aktif (`expires_at`). Batas maksimal 2 sesi ditegakkan pada fungsi `Login()` di `backend/internal/handlers/auth_handler.go`. Di situ saya memakai transaksi database (`h.db.BeginTx`) dengan query `SELECT id FROM sessions WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at ASC FOR UPDATE`. Kalau sesi aktif user sudah mencapai 2 atau lebih, query `DELETE FROM sessions WHERE id = $1` langsung menghapus baris sesi paling lama sebelum token sesi baru di-insert. Pemakaian lock `FOR UPDATE` ini penting banget biar tidak terjadi race condition saat user login barengan di detik yang sama.

### 3. Apabila token atau sesi seorang pengguna dicuri, apa yang terjadi pada sistem Anda dan apa yang dapat dilakukan admin?
Kalau ada token yang dicuri, penyerang cuma bisa memakainya selama sesi tersebut belum kedaluwarsa dan masih tercatat di tabel `sessions`. Karena sistem ini stateful dan memvalidasi token langsung ke database di setiap request lewat `AuthMiddleware()` (`backend/internal/middleware/auth_middleware.go`), admin bisa langsung memutus akses penyerang kapan saja. Admin tinggal klik tombol Force Logout di dashboard, yang akan memanggil fungsi `ForceLogout()` di `backend/internal/handlers/admin_handler.go` (`POST /api/admin/users/:id/force-logout`). Fungsi ini langsung menghapus seluruh sesi milik user korban di database, sehingga request berikutnya dari token curian akan langsung mental dengan respon 401 Unauthorized.

### 4. Sebutkan dua kekurangan atau celah yang Anda sadari masih terdapat pada hasil kerja Anda.
Pertama, validasi sesi di `AuthMiddleware()` masih mengecek langsung ke database PostgreSQL tanpa lapisan in-memory caching eksternal terdistribusi (seperti Redis cluster), sehingga jika backend di-scale horizontal dalam beban traffic jutaan user simultan, query pembacaan sesi ke database berpotensi menjadi I/O bottleneck. Kedua, sistem ini belum mengimplementasikan verifikasi tautan aktivasi email maupun Two-Factor Authentication (MFA / TOTP), sehingga registrasi akun langsung aktif tanpa validasi kepemilikan kotak masuk email yang sesungguhnya.

### 5. Apabila diminta menambahkan fitur "pengguna dapat keluar dari seluruh perangkat sekaligus", bagian kode mana yang akan Anda ubah?
Fitur ini sudah langsung saya buatkan di codebase. Di backend, saya menambahkan handler `LogoutAll()` pada `backend/internal/handlers/auth_handler.go` yang menghapus semua sesi milik user aktif (`DELETE FROM sessions WHERE user_id = $1`) dan mendaftarkannya ke router `backend/cmd/server/main.go` di route `POST /api/auth/logout-all`. Di frontend, fungsi ini dihubungkan lewat `logoutAll()` di `frontend/src/context/AuthContext.tsx` dan tombol "Keluar Semua Perangkat" di halaman `frontend/src/pages/Profile.tsx`.

---

## Penggunaan AI

Buat pengerjaan tugas ini, saya memakai tools AI Google Antigravity sebatas asisten untuk:
- Referensi setup Dockerfile multi-stage build buat Go binary di Alpine dan React di Nginx.
- Pengecekan syntax query locking `SELECT ... FOR UPDATE` pada transaksi Go `database/sql`.
- Drafting utility classes Tailwind CSS buat layout antarmuka frontend (tema Zinc monokrom).
- Membantu penyusunan skrip test otomatis `test-e2e.ps1` buat verifikasi skenario 2 sesi dan force logout.

Untuk logika bisnis otentikasi, rancangan skema tabel, dan penanganan concurrency-nya tetap saya periksa, sesuaikan, dan uji sendiri agar memenuhi spesifikasi asesmen.
