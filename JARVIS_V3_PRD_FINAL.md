# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# JARVIS / AMBA — VERSION 3.1 (DEFINITIVE EDITION)

**Project:** Jarvis / Amba  
**Version:** V3.1 (Supabase & Railway Unified Architecture — Definitive Edition)  
**Product Type:** Personal AI Assistant Ecosystem  
**Base:** Jarvis V2 + V2.1 Stable  
**Primary Channels:** Discord Bot, WhatsApp Cloud API  
**New Platforms:** Web Dashboard (React + Vite on Railway), Mobile App (React Native / Expo — Android Sideload First)  
**Automation & AI Layer:** Direct Gemini AI Sole Core Brain (20 Function Calling Tools) + Optional n8n External Worker  
**Database:** Supabase PostgreSQL Pooler (Tokyo ap-northeast-1) + Supabase Auth & Realtime  
**Cloud Hosting:** Railway Cloud (`jarvis-amba-production.up.railway.app`)  
**Storage Timezone:** UTC (Stored as TIMESTAMPTZ in Database)  
**Display & Schedule Timezone:** Asia/Jakarta (WIB UTC+7)  
**Primary Language:** Bahasa Indonesia  
**Status:** Approved Architecture Specification  

---

# 1. EXECUTIVE SUMMARY

Jarvis V3 adalah evolusi menyeluruh dari Jarvis V2/V2.1 menjadi sebuah **Personal Assistant Ecosystem**.

Pada V2/V2.1, Jarvis telah memiliki kapabilitas operasional yang teruji:
- Discord Bot & WhatsApp Cloud API Webhook
- AI conversation (Direct Gemini 20 Function Calling Tools; n8n difungsikan sebagai worker otomasi eksternal sekunder di luar chat loop)
- long-term memory (Supabase `memories`)
- tasks & checklist (`tasks`)
- schedules & agenda (`schedules`)
- reminders & alarms (`reminders` sinkron WIB dengan bypass Jam Tenang untuk reminder user)
- finance tracking (`financial_transactions`)
- proactive assistant (Daily Briefing, Daily Recap, Due Reminders)
- voice note support (Whisper STT & Edge TTS)
- web intelligence cache
- analytics & health monitoring
- RBAC (Owner & User access)
- audit log
- scheduled broadcasts (`scheduled_broadcasts`)
- task chains (`task_chains`)
- approval flow

V3 menambahkan dua platform klien utama:
1. **Web Dashboard** (React 19 + Vite + Tailwind CSS, di-host langsung via Railway Express server di domain yang sama)
2. **Mobile App** (React Native / Expo Prebuild — Android Sideload First dengan penjadwalan alarm lokal)

Keduanya terhubung langsung ke **Jarvis Core** dan **Supabase Database**:

Target V3:
> **One Jarvis Core, multiple channels, multiple devices, one shared state.**

Semua antarmuka mengakses sumber data dan business logic yang sama:

```text
Discord (Bot)      WhatsApp (Meta)      Web Dashboard (React)      Mobile App (Android)
     │                   │                       │                           │
     └───────────────────┴───────────────┬───────┴───────────────────────────┘
                                         ▼
                               CLIENT & CHANNEL LAYER
                                         │
                                         ▼
                                    JARVIS CORE
                          (Railway Cloud Express Server)
                  ├── Direct Gemini AI Core Brain (20 Function Tools)
                  ├── Optional n8n Worker (External Integrations Only)
                  ├── Memory & Context Service
                  ├── Tasks & Schedules Service
                  ├── Reminders & Proactive Scheduler
                  ├── Unified Finance Engine
                  ├── Notification Router & FCM Push
                  └── Express REST API (/api/v1/*) + Web Static Host
                                         │
                                         ▼
                            SUPABASE CLOUD ECOSYSTEM
                  ├── PostgreSQL (23 Existing Tables + 5 New Tables)
                  ├── Supabase Auth (GoTrue JWT Verification)
                  └── Supabase Realtime (Instant Read-Only CDC Sync)
```

---

# 2. V3 VISION

V3 mengubah Jarvis dari:
> "Bot yang bisa diajak chat"

menjadi:
> **"Satu personal assistant yang dapat digunakan dari chat, web, dan HP, memiliki dashboard, reminder/alarm, otomatisasi keuangan, memory, personality, dan sinkronisasi lintas platform."**

---

# 3. CORE PRODUCT PRINCIPLES

## 3.1 One Brain
Discord, WhatsApp, Web, dan Android tidak memiliki AI logic masing-masing.
Semua menggunakan:
- Core prompt yang sama
- Tool definitions yang sama (20 Function Calling Tools via Direct Gemini)
- Logic yang sama
- Personality settings yang sama

## 3.2 One Source of Truth
- Tidak ada database lokal terpisah yang menyimpan data permanen secara mandiri.
- Semua data hidup di PostgreSQL Supabase yang sama.
- Client hanya menyimpan cache lokal dan antrean offline sementara.

## 3.3 Channel-Neutral Business Logic
Business logic tidak boleh peduli dari mana request berasal.

Flow standard:
```text
Input (Chat / Form / Notification)
↓
Normalize Input
↓
Core Engine (Task / Finance / Reminder / etc.)
↓
Persist to PostgreSQL
↓
Emit Event / Notification (if needed)
↓
Selected Channel
```

---

# 4. TARGET ARCHITECTURE

```text
                           JARVIS V3 ECOSYSTEM
                                   │
              ┌────────────────────┴────────────────────┐
              │          RAILWAY CLOUD BACKEND          │
              │  (jarvis-amba-production.up.railway.app) │
              └────────────────────┬────────────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │                           │                           │
       ▼                           ▼                           ▼
  CORE ENGINES                 ROUTING LAYER               EVENT ENGINE
       │                           │                           │
       ├── Direct Gemini (Sole)    ├── Express REST API        ├── 30s Due Reminders
       ├── Memory & Context        │    (/api/v1/* endpoints)  ├── Proactive Scheduler
       ├── Unified Finance Engine  ├── Web Static Server       │    (Briefing & Recap)
       ├── Task & Schedule Chains  │    (React Vite Build)     ├── FCM Push Notifier
       └── WhatsApp & Discord Bot  └── Meta Webhook Adapter    └── Realtime Sync Listener
                                   │
                                   ▼
                       SUPABASE CLOUD INFRASTRUCTURE
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
   POSTGRESQL                SUPABASE AUTH             SUPABASE REALTIME
  (Tokyo Pooler)            (JWT Verification)           (Read-Only Push)
       │                           │                           │
       ├── users & channels        ├── Single Sign-On          ├── Instant Task Sync
       ├── financial_transactions  ├── Token Validation        ├── Instant Reminder Sync
       ├── reminders & schedules   └── Role Claims             └── Instant Finance Sync
       ├── tasks & task_chains         (OWNER/USER)
       └── memories & preferences
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │                           │                           │
       ▼                           ▼                           ▼
   DISCORD BOT             WHATSAPP CLOUD API            CLIENT APPS
 (Gateway Ping)             (Meta Webhook)                     │
                                               ┌───────────────┴───────────────┐
                                               ▼                               ▼
                                         WEB DASHBOARD                    MOBILE APP
                                     (React + Vite + Tailwind)      (React Native / Expo)
                                     - Single Domain di Railway     - Android Sideload First
                                     - Control Center Lengkap       - Local Exact Alarm
                                     - Responsive Desktop/Tablet    - FCM Silent Data Push
                                                                    - Finance Capture (Android)
```

---

# 5. V3 ROADMAP

Roadmap V3 disusun berbasis graf dependensi teknis. Label "Critical" hanya disematkan pada fase fondasi yang memblokir fungsionalitas MVP.

| Phase | Nama | Priority | Dependency | Deskripsi Penyesuaian V3 |
|---|---|---:|---|---|
| **Phase 0-A** | Security Hotfix V2 | Critical | V2 Stable | HMAC Meta Webhook, Shared Secret Endpoint Lama, Fix Regex Owner, Flag USE_N8N |
| **Phase 0** | Architecture & API Foundation | Critical | Phase 0-A | Express 5 modular router, RLS Default-Deny, Scoping user_id di backend |
| **Phase 1** | Unified Identity, Device & Session | Critical | Phase 0 | Supabase Auth JWT, `auth_user_id`, DDL `user_devices`, alur WhatsApp !link |
| **Phase 2** | Web Dashboard & Realtime Activation | High | Phase 0-1 | React 19 + Vite SPA, Supabase Realtime Read-Only, Express static serving |
| **Phase 3** | Cross-Platform Mobile App Foundation | Critical | Phase 0-1 | React Native Expo Prebuild (Android Sideload First, izin native alarm) |
| **Phase 4** | Unified Reminder & Alarm Engine | Critical | Phase 1-3 | AlarmManager Android lokal + FCM sync, DDL `reminder_deliveries`, poller atomik |
| **Phase 5** | Notification Delivery Router | High | Phase 4 | Integrasi `notification_preferences` multi-channel (`target_channels TEXT[]`) |
| **Phase 6** | Android Notification Finance Capture | High | Phase 3 | Android listener allowlist + masking device -> server-side regex & LLM parser |
| **Phase 7** | Unified Finance Input & Assistant Chat | High | Phase 6 | Pencatatan transaksi natural language chat -> `financial_transactions` |
| **Phase 8** | Personality & Preference Center | Medium | Phase 2-3 | Taksonomi gaya bahasa terpisah (`response_style` & `response_length`) |
| **Phase 9** | Cross-Channel Smart Routing & Presence | Medium | Phase 4-8 | Smart presence & per-device delivery routing (Realtime sudah aktif di Phase 2) |
| **Phase 10** | Personal Dashboard & Analytics 2.0 | Medium | Phase 2, 7 | Visualisasi keuangan terpadu, metrik produktivitas harian |
| **Phase 11** | Security, Privacy & Approval Center | High | Semua phase | Pengujian kepatuhan RLS, penanganan approval transaksi auto-capture |
| **Phase 12** | Offline Sync, Reliability & Recovery | Medium | Semua phase | `client_operations` idempotency, optimistic locking `version INT`, antrean expo-sqlite |
| **Phase 13** | Testing, Production & Release | Critical | Semua phase | End-to-end verification, build release APK sideload & Web SPA live |

### Batasan MVP (MVP Cut Line)
*Usulan Arsitek (dikonfirmasi owner: <OWNER_ID>):*
- **Termasuk dalam MVP V3.0:** Phase 0-A, Phase 0, Phase 1, Phase 2, Phase 3 (Android Basic), Phase 4, Phase 5, Phase 6, Phase 7, dan Phase 13.
- **Ditunda ke V3.1+:** Phase 8 (Custom personality override per-channel), Phase 9 (Presence routing kompleks), Phase 10 (Advanced Analytics visual), Phase 12 (Full offline multi-device sync).

---

# PHASE 0 — ARCHITECTURE, SECURITY HOTFIX & API FOUNDATION

## Phase 0-A: Hotfix Keamanan V2 (Dikerjakan Paling Awal)
Sebelum mengekspos endpoint baru untuk Web dan Mobile, celah keamanan aktif pada sistem V2 wajib ditutup melalui hotfix:
1. **Verifikasi Signature Webhook WhatsApp (`x-hub-signature-256`):**
   - Server memvalidasi payload masuk dari Meta menggunakan HMAC-SHA256 terhadap `process.env.WA_APP_SECRET`.
   - Menggunakan perbandingan string konstan `crypto.timingSafeEqual` untuk mencegah *timing attack*.
   - Menyediakan flag transisi `WA_SIGNATURE_ENFORCE=false` (mode log-only saat verifikasi setup Meta), lalu diubah menjadi `true` (enforce 401/403 jika signature invalid).
2. **Proteksi Endpoint HTTP Legacy Port 5001:**
   - Route lama `/api/notify`, `/api/broadcast`, dan `/api/users` pada `bot.js` wajib dilindungi dengan shared secret header `x-internal-key: <INTERNAL_API_KEY>` (menggunakan `crypto.timingSafeEqual`).
   - Runner CLI `scripts/broadcast.js` diperbarui untuk mengirimkan header ini. Endpoint tidak lagi terbuka bebas tanpa autentikasi di domain publik.
3. **Penghapusan Kerentanan Regex Role Owner:**
   - Menghapus pencocokan regex `/kicenzeus/i` pada `display_name` di `securityService.js`.
   - Hak akses `OWNER` **HANYA** diberikan jika user ID yang telah terverifikasi cocok dengan daftar `OWNER_USER_IDS` di environment variable atau kolom `users.role = 'OWNER'` di database. Nama tampilan tidak boleh menentukan role.
4. **Flag Pengendali n8n (`USE_N8N`):**
   - Menambahkan environment variable `USE_N8N=false` (default: false).
   - Core loop chat langsung mengeksekusi `generateDirectGeminiReply()` tanpa menunggu n8n.
   - Jika `USE_N8N=true`, batas timeout diturunkan menjadi `N8N_TIMEOUT_MS=8000` (8 detik) dan `maxRetries = 0` (tanpa retry berulang) agar Discord dan WhatsApp tidak mengalami hang >60 detik.

## 6. Tujuan & Unified Hosting di Railway
Sebelum membuat Web dan Mobile, Jarvis harus memiliki backend/API boundary yang stabil dan modular di Railway. Klien dilarang mengakses database PostgreSQL secara langsung menggunakan service role atau raw query tak terproteksi.

### Hosting Terpadu di Railway (Unified Hosting)
* **Catatan Status Aktual:** Express BELUM terpasang pada V2 codebase (`discord-bot/package.json` menggunakan modul bawaan Node.js `http.createServer()`). Express 5 adalah dependensi baru yang ditambahkan pada Phase 0.
* Web Dashboard (React 19 + Vite) di-compile menjadi static assets (`/web/dist`) pada build step Railway.
* Express 5 dikonfigurasi untuk menyajikan static file dan menangani webhook:
  ```javascript
  // Tangkap buffer mentah HANYA pada webhook Meta untuk verifikasi signature HMAC
  app.use('/webhook/whatsapp', express.raw({ type: 'application/json' }), (req, res, next) => {
      req.rawBody = req.body;
      try { req.body = JSON.parse(req.body.toString('utf8')); } catch (_) { req.body = {}; }
      next();
  });
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Sajikan aset statis Web SPA
  app.use(express.static(path.join(__dirname, '../web/dist')));

  // Express 5 melarang unnamed wildcard '*' (path-to-regexp v8). Gunakan named parameter '{*splat}'.
  // Tolak aset statis yang hilang agar tidak salah menyajikan index.html.
  app.get('/{*splat}', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) return next();
      if (/\.[a-zA-Z0-9]+$/.test(req.path)) return res.status(404).send('Asset Not Found');
      res.sendFile(path.join(__dirname, '../web/dist/index.html'));
  });
  ```
* **Keuntungan:** Web Dashboard dan API berada dalam satu domain yang sama (`https://jarvis-amba-production.up.railway.app`), bebas isu CORS, dan tidak memerlukan biaya hosting terpisah.

## 7. Modular API Layer & Aturan Scoping Phase 0
Pecah endpoint backend menjadi Express Router modular di `discord-bot/routes/api/v1/`:
```text
/api/v1/auth            -> Info user aktif berdasarkan JWT Supabase (tanpa duplikasi registrasi device)
/api/v1/profile         -> Profil user, callsign, role (read-only untuk role)
/api/v1/personality     -> Pengaturan tone, gaya respons, dan persona
/api/v1/tasks           -> Mutasi tugas & to-do list (INSERT/UPDATE/DELETE)
/api/v1/schedules       -> Mutasi agenda & jadwal kegiatan
/api/v1/reminders       -> Mutasi pengingat, snooze, dismiss alarm, & ack (/reminders/:id/ack)
/api/v1/finance         -> Mutasi transaksi, ingest notifikasi bank (/finance/events), & summary
/api/v1/memories        -> Manajemen ingatan permanen pengguna
/api/v1/conversations   -> Riwayat chat lintas saluran & streaming chat (/conversations/chat)
/api/v1/notifications   -> Riwayat notifikasi & pengaturan preferensi jam tenang
/api/v1/devices         -> Registrasi perangkat, update push_token, & revoke sesi perangkat
/api/v1/approvals       -> Approval Center transaksi dan task chain bertingkat
/api/v1/sync            -> Endpoint batch sync offline (idempotent dengan client_operation_id)
/api/v1/media           -> Upload rekaman suara (Voice Note STT) untuk chat mobile
/api/v1/system          -> Health check sistem & minimum app version check
```

* **Aturan Keamanan Backend Phase 0 (Mandatori Developer):**
  Karena koneksi backend Railway menggunakan role `postgres` yang memiliki `rolbypassrls = true`, **SEMUA handler Express API V3 WAJIB melakukan query scoping eksplisit berdasarkan `req.user.id` yang diekstrak dari Supabase JWT (`WHERE user_id = req.user.id`)**. Backend dilarang mempercayai `user_id` yang dikirim dari payload/body request client.
* **Header Aplikasi:** Request dari Mobile App wajib menyertakan header `X-Min-App-Version` untuk validasi kompatibilitas.
* **Status Fitur CSV Import:** Ditandai sebagai *Out of Scope* untuk rilis MVP V3.

## 8. Response Contract
Format response standar untuk semua endpoint:

Success Response:
```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-11-08T08:00:00.000Z",
    "requestId": "req_123456"
  }
}
```

Error Response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Deskripsi error yang jelas dan mudah dipahami",
    "details": []
  },
  "meta": {
    "timestamp": "2026-11-08T08:00:00.000Z",
    "requestId": "req_123456"
  }
}
```

HTTP Status Code Standar:
- `200 OK` — Request sukses
- `201 Created` — Resource baru berhasil dibuat
- `400 Bad Request` — Validasi input gagal
- `401 Unauthorized` — Token JWT tidak ada atau expired
- `403 Forbidden` — Hak akses tidak mencukupi
- `404 Not Found` — Resource tidak ditemukan
- `409 Conflict` — Konflik konkurensi versi data
- `426 Upgrade Required` — Versi mobile app di bawah `X-Min-App-Version`
- `429 Too Many Requests` — Rate limit terlampaui
- `500 Internal Server Error` — Kesalahan server internal

## 9. API SECURITY
- Bearer token authentication menggunakan Supabase Auth JWT.
- Rate limiting per endpoint menggunakan sliding window di memory:
  - Auth/Login: 10 request/menit
  - General API: 60 request/menit
  - Finance Ingestion: 30 request/menit
- Sanitasi input dan pencegahan SQL Injection (semua query via parameterized query `db.query`).
- Proteksi CORS ketat: hanya mengizinkan origin domain Railway sendiri dan skema mobile app `jarvis://`.

## 10. Acceptance Criteria
- [ ] Hotfix Phase 0-A terpasang: signature webhook Meta diverifikasi, route legacy terlindungi secret, regex owner dibersihkan, flag `USE_N8N` aktif.
- [ ] Express 5 terpasang dan router modular `/api/v1/*` berfungsi di Railway.
- [ ] Web static build berhasil disajikan pada root URL dan rute SPA tidak menghasilkan 404 saat refresh.
- [ ] Request tanpa Bearer JWT valid ditolak dengan status 401.
- [ ] Semua response mengikuti response contract standar.


# PHASE 1 — UNIFIED IDENTITY, DEVICE & SESSION

## 11. Tujuan
V3 membutuhkan identity model yang tidak lagi bergantung pada satu saluran chat saja. Satu orang fisik memiliki satu identitas kanonik di Supabase.

Contoh Arsitektur Identitas Terpadu:
```text
CANONICAL USER (public.users)
 ├── Auth Account (Supabase auth.users via auth_user_id)
 ├── Discord Identity (user_channels: DISCORD)
 ├── WhatsApp Identity (user_channels: WHATSAPP)
 ├── Web Session (Supabase JWT Bearer Auth)
 └── Mobile Devices (user_devices: ANDROID)
```

## 12. Users & Supabase Auth Mapping
Existing table `users` di Supabase tetap menjadi source of truth profil aplikasi dengan mempertahankan `users.id` (VARCHAR(64)) yang berisi ID snowflake Discord, ID WhatsApp (`wa_<nomor>`), atau string custom V2.

Integrasi Otentikasi:
* Menggunakan **Supabase Auth (GoTrue)** bawaan untuk Web Dashboard & Mobile App.
* Tabel `users` diperluas dengan kolom jembatan:
  ```sql
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE;
  ```
* User melakukan login (email/password, Magic Link, atau Discord OAuth) via Supabase Client SDK.
* Frontend mengirimkan `access_token` (Supabase JWT) pada header `Authorization: Bearer <token>` ke endpoint Express API Railway.
* Middleware API (`authenticateSupabaseUser`) memvalidasi token via Supabase JWT Secret / JWKS, mencocokkan `auth.uid()` ke `users.auth_user_id`, lalu menempelkan data profil internal `req.user` (`id`, `role`, `callsign`).
* **Mekanisme Revokasi Sesi Hibrida (Keputusan Final D3):**
  - Claim `session_id` (UUID) diekstrak di server dari JWT yang telah diverifikasi saat registrasi device, dan disimpan di kolom `user_devices.session_id`.
  - Middleware Express API menolak request jika `session_id` milik device berstatus `REVOKED`.
  - Revokasi satu device: server mengubah baris perangkat menjadi `status = 'REVOKED'` dan memanggil helper internal `revokeAuthSession(sessionId)` untuk menghapus baris sesi di `auth.sessions` agar refresh token dibatalkan.
  - Revokasi semua perangkat lain: memanggil method resmi Supabase JS SDK `supabase.auth.admin.signOut(jwt, 'others')` dengan JWT sesi yang sedang aktif.
  - Masa aktif JWT access token disetel seragam ke **15 menit** di Supabase Auth Settings.
  - *Jendela Risiko Terbuka:* Setelah refresh token dicabut, access token JWT yang lama masih dapat membaca data langsung via RLS/Realtime sampai masa berlakunya habis (maksimal 15 menit).

## 13. User Channels (Pemisahan Boundary Komunikasi vs Perangkat)
Tabel `user_channels` **HANYA** digunakan untuk saluran percakapan pesan (messaging platforms). Hardware/perangkat mobile dialihkan seutuhnya ke `user_devices`.

Mendukung channel_type:
```text
DISCORD
WHATSAPP
```
*(Catatan: Nilai WEB, ANDROID, dan IOS dihapus dari tabel ini demi mencegah redundansi).*

Field:
```text
id                  SERIAL PRIMARY KEY
user_id             VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE
channel_type        VARCHAR(32) NOT NULL CHECK (channel_type IN ('DISCORD', 'WHATSAPP'))
external_user_id    VARCHAR(128) NOT NULL
display_name        VARCHAR(128)
phone_number        VARCHAR(64)
username            VARCHAR(128)
is_primary          BOOLEAN DEFAULT FALSE
status              VARCHAR(16) DEFAULT 'ACTIVE'
metadata            JSONB DEFAULT '{}'::jsonb
created_at          TIMESTAMPTZ DEFAULT NOW()
updated_at          TIMESTAMPTZ DEFAULT NOW()
last_seen_at        TIMESTAMPTZ
```

Unique constraint:
```text
UNIQUE(channel_type, external_user_id)
```

## 14. New Table — `user_devices`
Menyimpan perangkat mobile Android dan browser session yang terdaftar untuk menerima Push Notifications (FCM) dan sinkronisasi alarm.

```sql
CREATE TABLE IF NOT EXISTS public.user_devices (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    platform VARCHAR(16) NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    device_name VARCHAR(128),
    app_version VARCHAR(32),
    device_identifier VARCHAR(128) NOT NULL, -- UUID instalasi unik yang dibuat aplikasi
    session_id UUID, -- Sesuai claim session_id pada JWT Supabase Auth
    push_token TEXT, -- Token registrasi FCM mentah (Android)
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
    push_status VARCHAR(16) NOT NULL DEFAULT 'OK' CHECK (push_status IN ('OK', 'INVALID')),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_device_identifier UNIQUE(user_id, device_identifier)
);

CREATE INDEX idx_user_devices_user ON public.user_devices(user_id, status);
CREATE INDEX idx_user_devices_session ON public.user_devices(session_id);
CREATE UNIQUE INDEX idx_user_devices_active_push ON public.user_devices(push_token) WHERE status = 'ACTIVE' AND push_token IS NOT NULL;
```

* **Definisi Identifier:** `device_identifier` adalah UUID acak yang di-generate aplikasi mobile saat instalasi pertama dan disimpan di storage aman (bukan nomor seri perangkat keras).
* **Transfer Kepemilikan:** Jika akun lain login pada perangkat yang sama, baris device lama diperbarui atau ditransfer ke user baru. Logout aplikasi menonaktifkan baris (`status = 'REVOKED'`).
* **Pemisahan Status:** Kolom `status` (`ACTIVE`/`REVOKED`) memuat keputusan sesi user. Kolom `push_status` (`OK`/`INVALID`) memuat keabsahan token FCM. Jika worker FCM menerima error `UNREGISTERED`, sistem mengubah `push_status = 'INVALID'` dan mengosongkan `push_token`, **tanpa mencabut sesi user (`status` tetap `ACTIVE`)**.

## 15. Acceptance Criteria
- [ ] Satu akun pengguna dapat terhubung dengan Discord, WhatsApp, Web, dan HP Android secara simultan.
- [ ] Login Web & Mobile diverifikasi menggunakan Supabase Auth JWT.
- [ ] Device Android dapat diregistrasikan beserta FCM push token ke `user_devices`.
- [ ] Sesi device dapat dicabut (revoke) oleh user melalui dashboard, memicu pemutusan akses API seketika.
- [ ] Seluruh data user V2 existing tetap kompatibel 100%.

## 16. Identity & Account Linking Flow (Section Lengkap)
Menangani penautan identitas multi-channel dan konsolidasi identitas kanonik (Keputusan Final D2):

### 1. Strategi Identitas Kanonik (Opsi K)
- Setiap orang fisik memiliki tepat satu baris kanonik di tabel `users`.
- Jika pengguna memiliki akun Discord, baris dengan snowflake Discord dipilih sebagai ID kanonik. Jika tidak, menggunakan baris `wa_<nomor>`.
- Tabel `user_channels` bertindak sebagai registry alias: `(channel_type, external_user_id) -> canonical users.id`.
- Semua gateway (Discord bot, WhatsApp adapter, Express API) memanggil resolver tunggal: `resolveCanonicalUserId(channelType, externalId)` sebelum melakukan pembacaan atau penulisan data.
- Kolom legacy `users.discord_user_id` (NOT NULL) tetap dipertahankan; bagi user non-Discord, nilainya diisi sama dengan `id`.

### 2. Alur Penautan Discord OAuth
- Pengguna login via Supabase Discord OAuth di Web Dashboard.
- Supabase Auth menerbitkan JWT dengan provider ID (Discord snowflake).
- Backend mencocokkan ID tersebut ke tabel `user_channels` (`channel_type = 'DISCORD'`). Jika cocok, kolom `users.auth_user_id` diupdate dengan `auth.uid()`.

### 3. Alur Penautan WhatsApp Inbound (`!link`)
- Pengguna membuka Web Dashboard / Mobile App, lalu menekan tombol "Tautkan WhatsApp".
- Server men-generate kode OTP numerik acak 6-digit (misal: `839102`), membuat hash SHA-256 dari kode tersebut, dan menyimpannya di tabel `account_link_codes`:
  ```sql
  CREATE TABLE IF NOT EXISTS public.account_link_codes (
      id BIGSERIAL PRIMARY KEY,
      auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      code_hash VARCHAR(64) NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 3,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX idx_account_link_codes_lookup ON public.account_link_codes(code_hash, expires_at);
  ```
- Kode memiliki masa aktif 5 menit dan rate limit maksimal 3 percobaan salah.
- Pengguna mengirim chat `!link 839102` ke nomor bot WhatsApp Jarvis.
- Webhook Meta menerima pesan, memverifikasi `x-hub-signature-256`, mengambil nomor pengirim yang valid, lalu memverifikasi hash kode.
- Jika valid, server mendaftarkan nomor tersebut ke `user_channels` milik `auth_user_id` penaut, dan membalas konfirmasi di WhatsApp: *"Akun WhatsApp Anda berhasil ditautkan ke akun Jarvis!"*.

### 4. Resolusi Role Server-Side
- Hak akses `OWNER` diverifikasi di sisi server via `securityService.getUserRole(user.id)`.
- Server membaca environment variable `OWNER_USER_IDS` (daftar ID snowflake Discord dan nomor HP owner yang sah).
- Client `user_metadata` dilarang menjadi penentu role demi mencegah privilege escalation.

### 5. Rencana Migrasi Data Kanonik Satu Kali
- Dijalankan sebelum account linking dibuka ke publik via skrip `scripts/migrate-canonical-users.js`.
- Skrip dijalankan dalam satu transaksi database atomik:
  1. Dry-run mode: mencetak laporan baris yang akan digabung dan akun test yang teridentifikasi.
  2. Backup snapshot tabel terkait ke tabel cadangan `_backup_migration_v3`.
  3. Memindahkan `user_id` lama pada 17 tabel yang memiliki `user_id` menuju `user_id` kanonik.
  4. Akun test didaftar untuk peninjauan owner (tidak dihapus otomatis).
  5. Rollback otomatis jika terjadi error constraint foreign key.

---

# PHASE 2 — WEB DASHBOARD & REALTIME ACTIVATION

## 17. Tujuan & Tech Stack
Membangun web dashboard yang cepat, responsif, dan terpadu untuk monitoring dan kontrol Jarvis secara visual.

### Teknologi Frontend Web:
* **Framework:** React 19 + Vite (Single Page Application)
* **Styling:** Tailwind CSS + Lucide React Icons
* **State Management & Data Fetching:** TanStack Query + Supabase JS Client (Realtime Subscriptions)
* **Routing:** React Router v7

## 18. Dashboard Modules & Arsitektur Akses Data
Prinsip Arsitektur: Client Web membaca tabel operasional harian secara langsung via RLS dan Supabase Realtime (Read-Only). Semua aksi tulis (Create/Update/Delete) dan pembacaan data analitik teragregasi dilakukan melalui Express API (`/api/v1/*`).

### Home
* **Jalur Data:** Express API (`GET /api/v1/dashboard/summary`).
* Menampilkan metrik terhitung: Total Pengeluaran Bulan Ini, Sisa Tugas, Pengingat Terdekat, dan Status Health Bot.

### Tasks
* **Jalur Data:** Supabase Realtime + RLS (`SELECT * FROM tasks`). Tulis via `/api/v1/tasks`.
* To-do list interaktif. Update real-time otomatis saat bot mencatat tugas dari WhatsApp/Discord.

### Schedules
* **Jalur Data:** Supabase Realtime + RLS (`SELECT * FROM schedules`). Tulis via `/api/v1/schedules`.
* Kalender dan timeline agenda kegiatan terikat waktu.

### Reminders
* **Jalur Data:** Supabase Realtime + RLS (`SELECT * FROM reminders`). Tulis via `/api/v1/reminders`.
* Pengingat & alarm aktif. Tombol Snooze & Dismiss memanggil Express API `/api/v1/reminders/:id/snooze` dan `/dismiss`.

### Finance
* **Jalur Data:** Supabase Realtime + RLS (`SELECT * FROM financial_transactions`). Tulis via `/api/v1/finance`.
* Tabel mutasi keuangan. Indikator sumber transaksi dipetakan dari kolom `source_type`:
  - `CHAT` -> Badge Chat
  - `MANUAL` -> Badge Input Web/App
  - `BANK_NOTIFICATION` -> Badge Notifikasi Bank (Phase 6)
  - `IMPORT` -> Badge Unggahan CSV (Future)
  - `SYSTEM` -> Badge Otomasi Sistem
* Instrumen bank/e-wallet dibaca dari kolom `payment_method` (BCA, Mandiri, Cash, GoPay).

### Memory
* **Jalur Data:** RLS Read-Only (`SELECT * FROM memories`). Modifikasi/hapus via Express API `/api/v1/memories`.

### Personality & Preference
* **Jalur Data:** Express API (`GET /api/v1/personality`). Update via `PATCH /api/v1/personality`.
* Pengaturan taksonomi persona (`response_style` & `response_length`) dan preferensi Jam Tenang.

### Conversations & Audit
* **Jalur Data:** Express API (`GET /api/v1/conversations` & `GET /api/v1/audit`).
* **Bukan jalur RLS Realtime** demi keamanan data audit internal dan paginasi log bervolume besar.

## 19. Acceptance Criteria
- [ ] Web Dashboard dapat diakses di domain Railway tunggal via auth Supabase JWT.
- [ ] Modul Tasks, Schedules, Reminders, dan Finance tersinkronisasi instan via Supabase Realtime read-only.
- [ ] Seluruh aksi mutasi data (tulis/ubah/hapus) dari Web berhasil dijalankan lewat Express API terproteksi.
- [ ] UI responsif pada resolusi desktop, tablet, dan browser mobile.

---

# PHASE 3 — CROSS-PLATFORM MOBILE APP FOUNDATION

## 20. Tujuan & Arsitektur Mobile (Android Sideload First)
Membangun aplikasi mobile resmi pendamping Jarvis yang berjalan di **Android** hari ini, dengan basis kode cross-platform terstruktur yang siap diekspansi ke **iOS** di masa mendatang.

### Kebijakan Distribusi & Batasan Platform:
* **Distribusi Android:** Menggunakan **Direct Sideload APK** (internal distribution via GitHub Releases / Download Web Dashboard). Tidak menggunakan Google Play Store untuk menghindari penolakan kebijakan izin `BIND_NOTIFICATION_LISTENER_SERVICE` dan deklarasi ketat SMS/Financial Notification.
* **Klarifikasi Kesiapan iOS (iOS Reality Check):**
  - Kode UI layar (Home, Tasks, Schedules, Finance, Settings) bersifat cross-platform 100%.
  - Namun, build dan distribusi iOS **MEMBUTUHKAN Apple Developer Program Account berbayar ($99/thn)** dan perangkat macOS.
  - Secara historis, iOS tidak memiliki API untuk alarm persisten yang setara dengan Android `AlarmManager.setAlarmClock()`. Meskipun pada iOS 26+ Apple memperkenalkan framework **AlarmKit**, penggunaannya membutuhkan entitlement khusus dari Apple (`developer.apple.com/contact/request/alarmkit`) dan deklarasi `NSAlarmKitUsageDescription`.
  - Fitur Bank Notification Capture (Phase 6) **TIDAK TERSEDIA di iOS** karena sandbox privasi Apple melarang pembacaan notifikasi aplikasi lain.
  - Oleh karena itu, platform iOS dinyatakan **Out of Scope untuk rilis V3.0** dan difokuskan pada Android.

### Protokol Alarm Lokal & Sinkronisasi Android:
1. **Penjadwalan Lokal:** Mode ALARM dijadwalkan secara lokal di perangkat Android menggunakan `AlarmManager.setAlarmClock()` untuk menjamin bunyi tepat waktu bahkan saat HP dalam kondisi Doze Mode.
2. **FCM Silent Data-Push:** Server Railway mengirimkan silent data push (`{ type: 'ALARM_SYNC', reminder_id, action: 'SCHEDULE' | 'CANCEL' | 'UPDATE' }`) setiap kali ada perubahan data reminder dari saluran lain (Discord, WA, Web).
3. **Sinkronisasi Periodik:** Saat aplikasi dibuka atau menerima push, aplikasi menarik N reminder mendatang (`WHERE remind_at >= NOW() ORDER BY remind_at ASC LIMIT 20`) untuk menyelaraskan alarm lokal.
4. **Reboot Recovery:** Menggunakan broadcast receiver `RECEIVE_BOOT_COMPLETED` untuk menjadwalkan ulang seluruh alarm lokal setelah perangkat reboot.
5. **Izin Sistem:** Memerlukan izin eksklusif Android sideload: `USE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, `POST_NOTIFICATIONS`, dan `BIND_NOTIFICATION_LISTENER_SERVICE`.

## 21. Mobile Architecture
```text
Mobile App (React Native / Expo Prebuild)
      ├── UI Layer: Shared Screens (Home, Chat, Tasks, Finance, Settings)
      ├── Service Layer: Supabase JS (Auth & Read-Only Realtime) + Axios API Client (/api/v1/*)
      ├── Sync & Push Layer: Silent FCM Data-Push Handler (FCM Admin SDK Native)
      └── Native Android Modules:
            ├── Alarm Module: AlarmManager.setAlarmClock() + FullScreen Intent Wakeup
            └── Finance Module: NotificationListenerService (Local Allowlist Filter Only)
                  │
                  ▼
        Railway Backend API (/api/v1/*) ──► Supabase PostgreSQL
```

## 22. Main Screens Mobile
```text
Home          -> Ringkasan harian, agenda hari ini, status saldo keuangan
Chat          -> Antarmuka chat AI interaktif dengan Jarvis (Streaming Text & Voice Note)
Tasks         -> Manajemen to-do list & checklist pekerjaan
Schedules     -> Kalender agenda kegiatan
Finance       -> Catatan mutasi keuangan & approval transaksi otomatis
Settings      -> Konfigurasi perangkat, izin alarm, allowlist bank, persona
```

## 23. Chat Interface Mobile
Antarmuka percakapan interaktif di ponsel:
- Pesan teks dikirimkan ke `/api/v1/conversations/chat` dengan respons streaming.
- Dukungan Voice Note: merekam audio AAC/MP3 di HP, mengunggah ke `/api/v1/media/voice-note`, server melakukan transkripsi via Whisper STT, lalu meneruskan teks ke Direct Gemini.
- Desain antarmuka memprioritaskan keterbacaan tinggi dan kenyamanan mengetik.

## 24. Acceptance Criteria
- [ ] APK Android dapat di-install via direct sideload tanpa error signature.
- [ ] Pengguna dapat login menggunakan Supabase Auth dan sesi tersimpan di secure storage.
- [ ] Chat AI berjalan lancar dan streaming respons responsif.
- [ ] Alarm lokal dapat disetel dan berbunyi tepat waktu saat pengujian.

## 25. Android Native Permissions & Hardware Capabilities (Section Lengkap)
Menjabarkan matriks perizinan, kapabilitas native, dan mitigasi batasan sistem operasi Android:

### 1. Matriks Izin Android Manifest:
| Nama Izin | Kategori | Keperluan Fungsional |
|---|---|---|
| `android.permission.POST_NOTIFICATIONS` | Runtime (API 33+) | Menampilkan notifikasi push dan banner reminder |
| `android.permission.USE_EXACT_ALARM` | Normal (Sideload) | Menjadwalkan alarm presisi tanpa izin manual sistem |
| `android.permission.SCHEDULE_EXACT_ALARM` | Special App Access | Fallback untuk Android 12 jika USE_EXACT_ALARM belum tersedia |
| `android.permission.USE_FULL_SCREEN_INTENT` | Normal | Membuka antarmuka alarm layar penuh saat ponsel terkunci |
| `android.permission.RECEIVE_BOOT_COMPLETED` | Normal | Memulihkan jadwal alarm lokal setelah ponsel restart |
| `android.permission.FOREGROUND_SERVICE` | Normal | Menjaga stabilitas service audio alarm dan listener notifikasi |
| `android.permission.BIND_NOTIFICATION_LISTENER_SERVICE` | Special Access | Membaca notifikasi aplikasi perbankan (Phase 6) |
| `android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Normal | Meminta pengecualian penghemat baterai agresif |

### 2. Batasan Sistem Operasi & Strategi Mitigasi:
1. **Force-Stop State:** Jika pengguna melakukan *Force Stop* aplikasi secara manual dari App Info Android, FCM data-push tidak akan dikirimkan oleh OS ke aplikasi sampai aplikasi dibuka kembali secara manual.
   - *Mitigasi:* Saat aplikasi dibuka kembali, aplikasi otomatis menjalankan sinkronisasi penuh (tarik data pengingat aktif dari server).
2. **OEM Battery Killers (DontKillMyApp):** Produsen ponsel tertentu (Xiaomi MIUI/HyperOS, Samsung OneUI, Huawei) mematikan background service secara agresif.
   - *Mitigasi:* Aplikasi menyediakan panduan visual langkah demi langkah di menu Pengaturan untuk mengaktifkan "Autostart" dan memilih "No Restrictions" pada Battery Saver.
3. **Background Sync Fallback:** Menggunakan Android `WorkManager` yang berjalan periodik (interval minimum 15 menit) untuk memeriksa status alarm di background jika push FCM mengalami delay.


# PHASE 4 — UNIFIED REMINDER & ALARM ENGINE

## 26. Tujuan
Menggabungkan sistem reminder Jarvis menjadi satu engine terpadu yang dapat mengirimkan pengingat dalam bentuk pesan chat atau memicu alarm fisik di HP.

## 27. Reminder Modes
1. **`CHAT`**: Mengirim pesan chat pengingat ke saluran teks (WhatsApp, Discord DM/Channel).
2. **`ALARM`**: Mengirim push sinkronisasi ke HP Android untuk membunyikan alarm layar penuh dan nada dering persisten.
3. **`CHAT_AND_ALARM`**: Mengirim pesan chat sekaligus membunyikan alarm fisik di ponsel.

## 28. Reminder Channels
Daftar target saluran pengiriman:
- `DISCORD`
- `WHATSAPP`
- `ANDROID`
- `IOS` (Out of Scope V3.0)
- `WEB`

## 29. Reminder Example
- "Ingatkan aku rapat jam 2 siang di WhatsApp" -> Mode: `CHAT`, Target: `['WHATSAPP']`.
- "Pasang alarm bangun tidur jam 5 pagi di HP" -> Mode: `ALARM`, Target: `['ANDROID']`.
- "Ingatkan bayar tagihan besok jam 9 pagi" -> Mode: `CHAT`, Target: Implisit (`NULL`, di-resolve dari preferensi).

## 30. Chat Reminder
Pesan chat teks yang dikirimkan ke Discord atau WhatsApp memuat judul pengingat, badge prioritas, dan tombol aksi interaktif (Snooze 10m / Selesaikan).

## 31. Alarm Reminder
Alarm di Android yang menjadwalkan intent layar penuh (`FullScreenIntent`) dengan nada dering kustom dan tombol fisik tunda/matikan di layar kunci.

## 32. Alarm Configuration
User dapat mengonfigurasi:
- `delivery_mode`: `CHAT`, `ALARM`, `CHAT_AND_ALARM`
- `snooze_minutes`: durasi tunda (default 10 menit)
- `alarm_sound`: nada dering alarm (default: 'default')
- `target_channels`: daftar saluran tujuan eksplisit

## 33. Reminder Delivery Policy & Aturan Jam Tenang (Keputusan Final D1)
1. **Perilaku Jam Tenang (Quiet Hours):**
   - Mengikuti formula V2 persis: `bypassQuietHours || eventType === 'REMINDER' || priority IN ('URGENT', 'HIGH')`.
   - **SEMUA reminder buatan user (baik mode CHAT maupun ALARM) SELALU BYPASS jam tenang** karena merupakan instruksi eksplisit dari pengguna.
   - Poller reminder tidak memerlukan cabang penundaan jam tenang untuk event REMINDER. (Status `DEFERRED` disiapkan untuk event proaktif non-reminder di masa depan).
2. **Aturan Presedensi Saluran Pengiriman:**
   - Kolom `target_channels` bertipe `TEXT[]`. Jika terisi (misal `ARRAY['WHATSAPP']`), instruksi eksplisit user **MENANG** atas konfigurasi disable di `notification_preferences`.
   - Jika `target_channels` bernilai `NULL` (implisit), sistem me-resolve saluran target saat jatuh tempo (*trigger time*) dengan urutan:
     1. Memeriksa baris `notification_preferences` untuk event `REMINDER` yang berstatus `enabled = true`.
     2. Jika tidak ada preferensi spesifik, fallback ke channel percakapan aktif user (prioritaskan `is_primary = true`).
     3. Jika mode memuat `ALARM`, otomatis menambahkan device Android aktif milik user dari `user_devices`.
   - Saluran legacy `'BOTH'` pada preferensi V2 diekspansi saat resolusi menjadi `['DISCORD', 'WHATSAPP']` tanpa memerlukan migrasi data skema.
   - Jika saat jatuh tempo tidak ada satupun channel/device yang tersedia:
     - Jika channel eksplisit `ANDROID` diminta tetapi user tidak memiliki device aktif, delivery ditandai `FAILED` dengan `error_code = 'NO_DEVICE'`.
     - Jika nol channel berhasil di-resolve, baris reminder diupdate menjadi `status = 'failed'` dan dicatat ke `audit_logs` agar tidak hilang diam-diam.
3. **Semantik Pengiriman:**
   - Pengiriman menerapkan semantik **At-Least-Once Delivery**.
   - Pengiriman mode ALARM ke Android dipenuhi saat silent push sinkronisasi berhasil terkirim ke FCM; bunyi alarm dieksekusi secara lokal oleh OS Android.

## 34. Database Change — `reminders`
Field V2 existing yang dipertahankan:
- Pemicu waktu utama: **`remind_at`** (TIMESTAMPTZ, disimpan UTC, sinkron tampilan WIB).
- Waktu tunda aktif: **`snooze_until`** (TIMESTAMPTZ).
- Status pengingat: `status` (VARCHAR, mendukung: `'pending'`, `'sent'`, `'cancelled'`, `'failed'`).

Penambahan Kolom V3:
```sql
ALTER TABLE public.reminders 
  ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(16) NOT NULL DEFAULT 'CHAT' CHECK (delivery_mode IN ('CHAT', 'ALARM', 'CHAT_AND_ALARM')),
  ADD COLUMN IF NOT EXISTS target_channels TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS alarm_sound VARCHAR(64) DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS snooze_minutes INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE public.reminders
  ADD CONSTRAINT chk_target_channels CHECK (target_channels IS NULL OR target_channels <@ ARRAY['DISCORD','WHATSAPP','ANDROID','IOS','WEB']::TEXT[]);
```

## 35. New Table — `reminder_deliveries` & Algoritma Poller (Koreksi F2)
Menyimpan riwayat dan status pengiriman atomik per-target channel untuk mencegah kirim ganda saat redeploy dan menjamin pelacakan audit.

```sql
CREATE TABLE IF NOT EXISTS public.reminder_deliveries (
    id BIGSERIAL PRIMARY KEY,
    reminder_id BIGINT NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    channel_type VARCHAR(32) NOT NULL CHECK (channel_type IN ('DISCORD', 'WHATSAPP', 'ANDROID', 'IOS', 'WEB')),
    delivery_mode VARCHAR(16) NOT NULL DEFAULT 'CHAT' CHECK (delivery_mode IN ('CHAT', 'ALARM')),
    device_id BIGINT REFERENCES public.user_devices(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL, -- Didefinisikan = COALESCE(snooze_until, remind_at) saat slot dibuat
    claimed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DEFERRED', 'SENT', 'DELIVERED', 'FAILED', 'DISMISSED', 'SNOOZED', 'CANCELLED')),
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_code VARCHAR(64),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reminder_delivery_slot UNIQUE(reminder_id, channel_type, delivery_mode, scheduled_at)
);

CREATE INDEX idx_reminder_deliveries_poll ON public.reminder_deliveries(status, next_attempt_at) WHERE status IN ('PENDING', 'DEFERRED');
CREATE INDEX idx_reminder_deliveries_reminder ON public.reminder_deliveries(reminder_id);
```

### Algoritma Poller Scheduler (Step-by-Step dengan Transaksi Eksplisit):
1. **Transaksi Claim Reminder Jatuh Tempo:**
   ```sql
   BEGIN;
   SELECT id, user_id, title, priority, repeat_rule, delivery_mode, target_channels, remind_at, snooze_until, version
   FROM public.reminders 
   WHERE status = 'pending' AND (
       (snooze_until IS NOT NULL AND snooze_until <= NOW()) OR 
       (snooze_until IS NULL AND remind_at <= NOW())
   )
   FOR UPDATE SKIP LOCKED LIMIT 20;
   ```
2. **Resolusi Target Channels & Pembentukan Slot:**
   - Server menentukan `slot_time = COALESCE(snooze_until, remind_at)`.
   - Me-resolve daftar channel target. Jika 0 channel terdeteksi: update `reminders.status = 'failed'` dan catat ke `audit_logs`.
   - Untuk setiap channel target, lakukan insert slot atomik:
     ```sql
     INSERT INTO public.reminder_deliveries (
         reminder_id, user_id, channel_type, delivery_mode, device_id, scheduled_at, status, next_attempt_at
     ) VALUES ($1, $2, $3, $4, $5, slot_time, 'PENDING', NOW())
     ON CONFLICT (reminder_id, channel_type, delivery_mode, scheduled_at) DO NOTHING;
     ```
3. **Claim Delivery Item:**
   - Server mengunci baris delivery yang siap kirim:
     ```sql
     UPDATE public.reminder_deliveries 
     SET claimed_at = NOW(), attempt_count = attempt_count + 1
     WHERE reminder_id = $1 AND scheduled_at = slot_time AND status IN ('PENDING', 'DEFERRED') AND next_attempt_at <= NOW()
     RETURNING id, channel_type, delivery_mode, device_id;
     COMMIT;
     ```
4. **Dispatching Pengiriman (Di Luar Transaksi Database Utama):**
   - Discord / WhatsApp API / FCM dispatch dijalankan secara asinkron dengan timeout ketat (10 detik).
   - Mode ALARM mengirimkan payload FCM silent push (`ALARM_SYNC`).
5. **Pembaruan Status Delivery & Penutupan Reminder:**
   - Jika dispatch sukses: `UPDATE reminder_deliveries SET status = 'SENT', sent_at = NOW() WHERE id = $delivery_id;`.
   - Jika dispatch gagal: jika `attempt_count < max_attempts`, set `status = 'PENDING', next_attempt_at = NOW() + (POWER(2, attempt_count) * INTERVAL '30 seconds')`; jika mencapai batas attempt, set `status = 'FAILED'`.
   - **Evaluasi Penutupan Slot Reminder:**
     Ketika tidak ada lagi delivery berstatus `PENDING`, `DEFERRED`, atau `claimed` yang tersisa untuk slot waktu tersebut:
     - Jika minimal 1 delivery berstatus `SENT` atau `DELIVERED`:
       `UPDATE reminders SET status = 'sent', sent_at = NOW(), last_triggered_at = NOW() WHERE id = $reminder_id;`
     - Jika SELURUH delivery berstatus `FAILED`:
       `UPDATE reminders SET status = 'failed' WHERE id = $reminder_id;`
6. **Penanganan Recurring & Snooze:**
   - Jika reminder memiliki `repeat_rule` dan sukses terkirim, `handleRecurringReminder()` menghitung `remind_at` berikutnya dan mengembalikan `status = 'pending'`, membentuk siklus baru.
   - Jika user menunda: `reminders.snooze_until = NOW() + INTERVAL 'X minutes'`. Slot pengiriman baru terbentuk pada siklus berikutnya.
7. **Penerimaan Acknowledgment dari Perangkat Mobile:**
   - Endpoint: `POST /api/v1/reminders/:id/ack`
   - Payload: `{ action: 'fired' | 'dismissed' | 'snoozed', deviceId: 123 }`.
   - Server mengupdate status baris delivery terkait menjadi `DELIVERED`, `DISMISSED`, atau `SNOOZED`.
8. **Crash Recovery (Pengaman Kegagalan Proses):**
   - Setiap 5 menit, worker menjalankan pemulihan lock:
     ```sql
     UPDATE public.reminder_deliveries 
     SET claimed_at = NULL 
     WHERE status IN ('PENDING', 'DEFERRED') AND claimed_at < NOW() - INTERVAL '5 minutes';
     ```

## 36. Acceptance Criteria
- [ ] Pengingat mode CHAT berhasil dikirim ke WhatsApp dan Discord.
- [ ] Pengingat mode ALARM memicu pendaftaran alarm lokal di HP Android via FCM sync.
- [ ] Semua reminder buatan user tetap berbunyi tepat waktu saat jam tenang (bypass).
- [ ] Tidak terjadi pengiriman ganda saat server Railway mengalami restart/redeploy.
- [ ] Tombol snooze/dismiss dari HP Android mengirimkan ack dan memperbarui status delivery.

---

# PHASE 5 — NOTIFICATION DELIVERY ROUTER

## 37. Tujuan
Mengatur perutean notifikasi proaktif dan peringatan sistem secara cerdas ke saluran yang tepat sesuai preferensi dan jam istirahat pengguna.

## 38. Notification Types
Daftar tipe event notifikasi di Jarvis V3:
1. `REMINDER` — Pengingat tugas/agenda buatan pengguna (Always bypass jam tenang).
2. `DAILY_BRIEFING` — Ringkasan agenda dan cuaca pagi hari (Patuh jam tenang).
3. `DAILY_RECAP` — Rekapitulasi produktivitas dan keuangan malam hari (Patuh jam tenang).
4. `TASK_DUE` — Peringatan batas waktu to-do list (Patuh jam tenang kecuali prioritas URGENT).
5. `FINANCE_ALERT` — Peringatan anggaran menipis atau pengeluaran mencurigakan.
6. `APPROVAL_REQUEST` — Permintaan persetujuan transaksi finansial atau rencana bertingkat.
7. `SYSTEM_ALERT` — Peringatan kegagalan sinkronisasi atau token terputus.

## 39. User Preferences & Aturan Jam Tenang Proaktif
- Notifikasi proaktif (Daily Briefing, Daily Recap, Finance Alert, Task Due) **PATUH PADA JAM TENANG**.
- Jam tenang membaca nilai per-user dari tabel `notification_preferences`. Jika bernilai `NULL`, menggunakan default V2:
  `quiet_hours_start = '22:00'` dan `quiet_hours_end = '06:00'` (WIB).
- Jika pesan proaktif jatuh tempo saat jam tenang aktif:
  - Pesan **DITUNDA** (scheduler V2 tidak mengupdate `last_briefing_date`/`last_recap_date`).
  - Begitu waktu melewati batas akhir jam tenang, pesan otomatis dikirimkan pada siklus polling berikutnya.
  - Pengecualian bypass hanya berlaku jika prioritas adalah `URGENT` atau `HIGH`.

## 40. Table `notification_preferences`
Struktur preferensi notifikasi existing yang dipertahankan:
```sql
-- Tabel existing (Migration 011)
-- id, user_id, event_type, channel_type, enabled, quiet_hours_start, quiet_hours_end
```
- Nilai legacy `channel_type = 'BOTH'` dipetakan saat runtime ke `['DISCORD', 'WHATSAPP']`.
- Mendukung penambahan channel target modern: `ANDROID`, `IOS`, `WEB`.

## 41. Routing Example
- Event: `DAILY_BRIEFING`, Waktu: 05:30 (Masih jam tenang) -> Ditahan, dikirimkan pukul 06:00.
- Event: `REMINDER`, Waktu: 02:00 (Jam tenang) -> Langsung dikirim / alarm berbunyi (Bypass).
- Event: `APPROVAL_REQUEST` bernilai > Rp 1.000.000 (Prioritas HIGH) -> Langsung dikirim ke WhatsApp dan Push Mobile.

## 42. Acceptance Criteria
- [ ] Briefing dan Recap tertahan saat jam tenang dan otomatis terkirim saat jam tenang selesai.
- [ ] Reminder buatan user langsung terkirim tanpa tertahan jam tenang.
- [ ] Pengaturan jam tenang per-user di dashboard tersimpan dan ditaati oleh router.

---

# PHASE 6 — ANDROID NOTIFICATION FINANCE CAPTURE

## 43. Tujuan & Alur Notifikasi Finansial
Memungkinkan ponsel Android menangkap notifikasi mutasi transaksi dari aplikasi perbankan dan e-wallet secara pasif dengan keamanan privasi berlapis.

Alur Finansial (Zero-Parser di Sisi Client Android):
```text
Aplikasi Bank / E-Wallet (BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay)
       │
       ▼
Android NotificationListenerService (Background Service)
       │ [Filter Lokal: Hanya membaca notifikasi jika package_name ada di allowlist aktif]
       ▼
Device-Side Data Masking (Sensor nomor rekening/kartu & strip sisa saldo di HP)
       │
       ▼
Forward Masked Text via HTTPS POST /api/v1/finance/events (Bearer Supabase JWT)
       │
       ▼
Railway Server Core Engine
       ├── 1. Deduplikasi Server-Side (Kunci Hash Deterministik Tunggal)
       ├── 2. Sanitasi Masking Kedua di Server (Pertahanan Berlapis)
       ├── 3. Parsing Regex Deterministik Spesifik Bank
       ├── 4. LLM Parsing Fallback (Direct Gemini) untuk format mutasi yang belum terdaftar
       ├── 5. Evaluasi Confidence Score & Kebijakan Konfirmasi User
       └── 6. Penyimpanan Transaksi Terstruktur di `financial_transactions`
```

## 44. Aturan Privasi & Keamanan Notifikasi Android (Koreksi F5 & D5)
1. **Klarifikasi Scope Listener OS:** Android `NotificationListenerService` secara native menerima SELURUH notifikasi sistem setelah izin diberikan pengguna. Kode aplikasi Android Jarvis **WAJIB** secara langsung memfilter di memori dan segera membuang notifikasi dari aplikasi yang tidak ada di tabel `finance_notification_sources`.
2. **Device-Side Data Masking:** Sebelum payload dikirimkan ke jaringan, device melakukan sanitasi awal menggunakan regex generik:
   - Nomor rekening / nomor kartu disensor (hanya menampilkan 4 digit terakhir: `**** 1234`).
   - Informasi saldo rekening yang tersisa di-strip agar tidak ikut terkirim ke server maupun AI.
3. **Pertahanan Berlapis di Server:** Server menjalankan sanitasi masking kedua sebelum teks diteruskan ke Direct Gemini jika regex lokal server tidak mengenali format.
4. **Zero Persistent Raw Retention di Server (Keputusan Final D5):** Server **TIDAK MENYIMPAN** teks mentah notifikasi secara permanen. Tabel `financial_events` hanya menyimpan data hasil parse terstruktur dan hash deduplikasi `dedupe_key`. Tidak ada staging teks mentah 24 jam.
5. **Offline Queue:** Jika ponsel offline, payload notifikasi yang telah dimasking diantrekan di SQLite lokal (expo-sqlite) dengan TTL 24 jam dan dihapus permanen segera setelah berhasil dikirim ke server.
6. **Headless Token Refresh:** Background service di Android memperbarui Supabase JWT secara otomatis menggunakan refresh token yang tersimpan di secure storage saat token 15 menit kedaluwarsa.

## 45. Notification Source — `finance_notification_sources`
Daftar aplikasi perbankan/e-wallet yang diizinkan oleh pengguna:
```sql
CREATE TABLE IF NOT EXISTS public.finance_notification_sources (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    package_name VARCHAR(128) NOT NULL, -- Contoh: 'com.bca', 'id.co.bri.brimo'
    app_name VARCHAR(128) NOT NULL, -- 'BCA mobile', 'BRImo'
    source_type VARCHAR(32) NOT NULL DEFAULT 'BANK' CHECK (source_type IN ('BANK', 'E_WALLET', 'PAYMENT', 'OTHER')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_source_pkg UNIQUE(user_id, package_name)
);
CREATE INDEX idx_finance_sources_user ON public.finance_notification_sources(user_id, enabled);
```

## 46. New Table — `financial_events` (Staging Terstruktur Tanpa Teks Mentah)
```sql
CREATE TABLE IF NOT EXISTS public.financial_events (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    source_id BIGINT REFERENCES public.finance_notification_sources(id) ON DELETE SET NULL,
    external_event_id VARCHAR(128) NOT NULL, -- Berisi dedupe_key
    event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('INCOME', 'EXPENSE', 'UNKNOWN')),
    parsed_amount NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'IDR',
    description TEXT,
    payment_method VARCHAR(64), -- 'BCA', 'Mandiri', 'GoPay'
    occurred_at TIMESTAMPTZ NOT NULL,
    confidence_score NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    status VARCHAR(20) NOT NULL DEFAULT 'DETECTED' CHECK (status IN ('DETECTED', 'PARSED', 'CONFIRMED', 'IMPORTED', 'REJECTED', 'DUPLICATE', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT uq_user_fin_event_dedupe UNIQUE(user_id, external_event_id)
);
CREATE INDEX idx_financial_events_user_status ON public.financial_events(user_id, status);
```

## 47. Server-Side Finance Parsing
Logic parsing transaksi sepenuhnya dieksekusi di Server Railway:
1. **Tahap 1: Regex Deterministik (Prioritas Pertama):**
   Server mencocokkan teks notifikasi dengan kumpulan regex per-aplikasi bank (misal: format mutasi BCA, Mandiri Livin, GoPay, OVO).
2. **Tahap 2: AI Parsing Fallback (Direct Gemini):**
   Jika regex tidak cocok, teks yang telah dimasking dua kali dikirim ke Direct Gemini dengan schema function calling untuk mengekstrak nominal, tipe (`income`/`expense`), instrumen bank, dan keterangan transaksi.

## 48. Sistem Skor Keyakinan (Configurable Confidence System)
Skor keyakinan bernilai 0.00 hingga 1.00 dengan threshold yang dapat dikonfigurasi:
* `CONFIDENCE_HIGH` (Default: 0.95): Nominal uang, tipe transaksi, dan nama instrumen cocok 100% dengan pola regex baku bank.
* `CONFIDENCE_MEDIUM` (Default: 0.75): Berasal dari Direct Gemini AI dengan entitas nominal yang tervalidasi.
* `CONFIDENCE_LOW` (< 0.75): Pola tidak lengkap atau terdapat keraguan pada kategori.

## 49. Duplicate Detection (Kunci Deduplikasi Tunggal)
Untuk mencegah pencatatan ganda saat sistem Android memancarkan notifikasi ulang:
- Server membentuk SATU kunci deduplikasi deterministik:
  ```text
  dedupe_key = sha256(package_name + notification_key + postTime_device + normalized_amount)
  ```
  *(Catatan: `postTime` berasal dari timestamp notifikasi di perangkat Android, bukan waktu terima server).*
- Nilai `dedupe_key` ini disimpan langsung pada kolom `external_event_id` di `financial_events` dan `financial_transactions`.
- Ditegakkan dengan partial unique index di database:
  ```sql
  CREATE UNIQUE INDEX idx_ft_user_external_event ON public.financial_transactions(user_id, external_event_id) WHERE external_event_id IS NOT NULL;
  ```

## 50. User Confirmation Policy (Enum Standar Terpadu)
Pengguna dapat memilih kebijakan persetujuan transaksi otomatis:
```text
AUTO_IF_CONFIDENT   -> Otomatis menyimpan transaksi jika confidence >= CONFIDENCE_HIGH (0.95); jika di bawahnya masuk Approval Center.
CONFIRM_ALWAYS      -> Semua notifikasi bank yang tertangkap wajib disetujui manual oleh user di Approval Center.
DISABLED            -> Fitur auto-capture notifikasi bank dinonaktifkan sepenuhnya.
```

## 51. Acceptance Criteria
- [ ] NotificationListenerService Android hanya memproses aplikasi yang terdaftar di allowlist.
- [ ] Teks notifikasi disensor di device sebelum dikirim via HTTPS ke server.
- [ ] Server tidak menyimpan teks mentah notifikasi (hanya menyimpan data terstruktur dan dedupe hash).
- [ ] Transaksi berulang dari notifikasi yang sama tidak tercatat ganda.
- [ ] Transaksi dengan keyakinan tinggi otomatis masuk ke `financial_transactions` sesuai policy user.

---

# PHASE 7 — UNIFIED FINANCE INPUT & ASSISTANT CHAT

## 52. Tujuan
Menyatukan seluruh pencatatan keuangan pribadi (chat natural di WhatsApp/Discord, form manual di Web, dan auto-capture Android) ke dalam satu ledger database tunggal: `financial_transactions`.

## 53. Example — Expense
- Chat: *"Beli bensin 50rb pake cash"*
- Core memproses:
  - `kind` = `'expense'` (huruf kecil)
  - `amount` = `50000`
  - `category` = `'transport'`
  - `payment_method` = `'Cash'`
  - `source_type` = `'CHAT'`

## 54. Example — Income
- Chat: *"Dapat transferan gaji 10jt di BCA"*
- Core memproses:
  - `kind` = `'income'` (huruf kecil)
  - `amount` = `10000000`
  - `category` = `'gaji'`
  - `payment_method` = `'BCA'`
  - `source_type` = `'CHAT'`

## 55. Example — Natural Sentence
- Chat: *"Tadi makan siang soto ayam abis 25 ribu bareng temen kantor"*
- Direct Gemini memanggil tool `record_finance`:
  - `kind` = `'expense'`, `amount` = `25000`, `category` = `'makanan'`, `description` = `'Makan siang soto ayam'`

## 56. Finance Assistant
Asisten keuangan yang dapat menjawab pertanyaan:
- *"Berapa total pengeluaranku minggu ini?"*
- *"Sisa budget makan sampai akhir bulan berapa?"*
- *"Tampilkan pengeluaran terbesar bulan ini."*

## 57. Android Chat
Fitur chat di aplikasi mobile memiliki tombol cepat untuk pencatatan keuangan:
- Tombol "Catat Pengeluaran"
- Tombol "Catat Pemasukan"
- Kartu konfirmasi instan di dalam bubble chat saat transaksi baru terdeteksi dari notifikasi bank.

## 58. Acceptance Criteria
- [ ] Chat pencatatan uang di Discord, WhatsApp, dan Mobile tersimpan di tabel yang sama.
- [ ] Saldo dan riwayat transaksi langsung ter-update di Web Dashboard.
- [ ] Pertanyaan analitik keuangan dijawab akurat oleh Direct Gemini.


# PHASE 8 — PERSONALITY & PREFERENCE CENTER

## 59. Tujuan
Memberikan fleksibilitas bagi pengguna untuk mengatur persona, nada bicara, dan gaya komunikasi Jarvis secara terpusat atau per-saluran percakapan.

## 60. Personality Settings & Taksonomi Persona (Koreksi C2 & F12)
Pengaturan gaya persona dipisahkan secara tegas antara gaya bahasa dan panjang respon:
* **`response_style` (Gaya Bahasa):**
  - `CASUAL` (Santai, akrab, menggunakan panggilan khas/callsign)
  - `FORMAL` (Baku, sopan, profesional)
  - `FRIENDLY` (Hangat, suportif, ramah)
  - `TECHNICAL` (Ringkas, to-the-point, analitis)
* **`response_length` (Panjang Respon):**
  - `SHORT` (Jawaban kilat, 1-2 kalimat)
  - `NORMAL` (Standar, informatif)
  - `DETAILED` (Rinci, lengkap dengan penjabaran poin)
* **Parameter Tambahan:**
  - `callsign` (Panggilan akrab user, misal: "Bos", "Kapten")
  - `tone` (Ceria, Tenang, Netral)
  - `humor_level` (NONE, LOW, BALANCED, WITTY)
  - `language` (id-ID, en-US)
  - `default_response_type` (TEXT, VOICE, AUTO)

*(Catatan Arsitektur: Tabel `user_voice_preferences` tetap terpisah dan dinormalisasi untuk konfigurasi suara Edge TTS, tidak dicampur ke tabel persona teks).*

## 61. Response Preference
Pengguna dapat menentukan jenis balasan default:
- `TEXT` — Balasan teks saja
- `VOICE` — Balasan teks disertai rekaman suara Voice Note TTS
- `AUTO` — Menyesuaikan input (jika input berupa Voice Note, dibalas dengan Voice Note)

Permintaan eksplisit pengguna dalam prompt chat selalu mengalahkan preferensi default.

## 62. Channel-Specific Override
Pengguna dapat mengatur preferensi per-channel tanpa merusak nilai global:
```text
Discord  → response_style: CASUAL, response_length: NORMAL
WhatsApp → response_style: FRIENDLY, response_length: SHORT
Android  → response_style: CASUAL, response_length: DETAILED
Web      → response_style: TECHNICAL, response_length: DETAILED
```

## 63. Database — `user_preferences` DDL
```sql
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    channel_type VARCHAR(32) NOT NULL DEFAULT 'GLOBAL' CHECK (channel_type IN ('GLOBAL', 'DISCORD', 'WHATSAPP', 'ANDROID', 'IOS', 'WEB')),
    response_style VARCHAR(32) NOT NULL DEFAULT 'CASUAL' CHECK (response_style IN ('CASUAL', 'FORMAL', 'FRIENDLY', 'TECHNICAL')),
    response_length VARCHAR(32) NOT NULL DEFAULT 'NORMAL' CHECK (response_length IN ('SHORT', 'NORMAL', 'DETAILED')),
    auto_capture_policy VARCHAR(32) NOT NULL DEFAULT 'AUTO_IF_CONFIDENT' CHECK (auto_capture_policy IN ('AUTO_IF_CONFIDENT', 'CONFIRM_ALWAYS', 'DISABLED')),
    tone VARCHAR(32) DEFAULT 'Tenang',
    humor_level VARCHAR(16) DEFAULT 'BALANCED',
    language VARCHAR(16) DEFAULT 'id-ID',
    default_response_type VARCHAR(16) DEFAULT 'TEXT' CHECK (default_response_type IN ('TEXT', 'VOICE', 'AUTO')),
    custom_prompt_instructions TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_pref_channel UNIQUE(user_id, channel_type),
    CONSTRAINT chk_auto_capture_global_only CHECK (channel_type = 'GLOBAL' OR auto_capture_policy = 'AUTO_IF_CONFIDENT')
);

CREATE INDEX idx_user_preferences_user ON public.user_preferences(user_id);
```

## 64. Acceptance Criteria
- [ ] Personality dapat diubah dari Web Dashboard dan langsung mengubah gaya bicara bot.
- [ ] Override channel berfungsi (misal di WA singkat, di Discord santai).
- [ ] Pengaturan voice terisolasi dan tidak merusak konfigurasi persona teks.

---

# PHASE 9 — CROSS-CHANNEL SMART ROUTING & PRESENCE

## 65. Tujuan (Penyelarasan F11)
Membuat interaksi lintas perangkat terasa mulus dan menyatu sebagai satu ekosistem asisten. *(Catatan Penyelarasan: Aliran data Supabase Realtime sudah diaktifkan sejak Phase 2; Phase 9 berfokus pada smart presence antar-device dan perutean pengiriman notifikasi pintar).*

## 66. Shared State Examples
### Task
Task dibuat dari WhatsApp. Web Dashboard dan Mobile App langsung menampilkan task tersebut tanpa perlu refresh browser.

### Reminder
Reminder dibuat dari chat Discord. Notifikasi alarm berbunyi tepat waktu di HP Android sesuai pengaturan saluran.

### Finance
Notifikasi mutasi bank tertangkap di ponsel Android. Transaksi langsung muncul di grafik pengeluaran Web Dashboard secara instan.

### Memory
Fakta baru disimpan via chat web. Bot WhatsApp dan Discord langsung mengetahui fakta tersebut pada interaksi berikutnya.

## 67. Cross-Channel Notification & Smart Presence
- Router memprioritaskan saluran tempat pengguna sedang aktif berinteraksi (*active presence*).
- Jika pengguna sedang membuka Web Dashboard (terdeteksi via heartbeat API / websocket), notifikasi proaktif diprioritaskan muncul sebagai toast di Web, meminimalkan spam notifikasi di WhatsApp.
- Jika pengguna tidak aktif di Web, pesan disalurkan ke WhatsApp atau Push Notification mobile.

## 68. Acceptance Criteria
- [ ] Pembuatan data di satu channel langsung tercermin di seluruh channel lain dalam hitungan detik.
- [ ] Kehadiran aktif di satu platform menghindari pengiriman notifikasi ganda yang mengganggu.

---

# PHASE 10 — PERSONAL DASHBOARD & ANALYTICS 2.0

## 69. Tujuan
Menyediakan visibilitas analitik tingkat lanjut mengenai pola pengeluaran keuangan, produktivitas tugas, dan kebiasaan harian pengguna.

## 70. Dashboard Sections
### Today
Menampilkan kartu ringkasan cepat: tugas hari ini, jadwal berikutnya, pengingat aktif terdekat, dan ringkasan pengeluaran harian.

### Finance
Visualisasi keuangan lengkap:
- Grafik tren cashflow (pemasukan vs pengeluaran)
- Pie chart proporsi kategori pengeluaran (makanan, transport, tagihan, dll.)
- Breakdown instrumen pembayaran (BCA, Mandiri, Cash, GoPay)

### Productivity
Metrik penyelesaian tugas: persentase tugas selesai tepat waktu, rata-rata tugas per hari, dan rasio reminder yang di-snooze.

### Jarvis
Metrik kesehatan ekosistem: uptime server, latensi rata-rata AI Direct Gemini, status koneksi Supabase pooler, dan kuota API.

## 71. Finance Source Visualization
Setiap transaksi di visualisasi tabel dan grafik ditandai dengan jelas berdasarkan sumbernya:
- `payment_method` menunjukkan akun perbankan / instrumen kas.
- `source_type` menunjukkan metode pencatatan (`CHAT`, `MANUAL`, `BANK_NOTIFICATION`).

## 72. Automated Insights
Direct Gemini menganalisis ringkasan mingguan dan bulanan untuk menghasilkan rekomendasi finansial:
- *"Pengeluaran kategori makanan minggu ini naik 35% dibandingkan minggu lalu."*
- *"Kamu telah menyelesaikan 18 tugas minggu ini, produktivitasmu meningkat!"*

## 73. Acceptance Criteria
- [ ] Seluruh grafik analitik memuat data akurat yang bersumber dari tabel `financial_transactions` dan `daily_metrics`.
- [ ] Filter rentang waktu (7 hari, 30 hari, bulan ini) berfungsi cepat via query teragregasi server.

---

# PHASE 11 — SECURITY, PRIVACY & APPROVAL

## 74. Tujuan
Menjamin keamanan data pribadi tingkat tinggi, kepatuhan Row Level Security (RLS), dan mekanisme persetujuan (*approval*) untuk aksi berisiko tinggi.

## 75. Sensitive Data
Kategori data sensitif yang dilindungi ketat:
- Kredensial dan token akses (Discord token, Meta secret, FCM keys, Supabase service key)
- Informasi finansial dan nomor rekening perbankan
- Log percakapan privat dan memori personal pengguna

## 76. Rules
- Klien Web dan Mobile **TIDAK PERNAH** memegang service role key database.
- Teks mentah notifikasi perbankan tidak disimpan secara permanen di server.
- Semua aksi berisiko tinggi (penghapusan data massal, transaksi finansial auto-capture bernilai besar) wajib melalui alur persetujuan.

## 77. Finance Auto-Capture Approval (Koreksi B8, B12 & F5)
User dapat memilih kebijakan persetujuan transaksi otomatis:
```text
AUTO_IF_CONFIDENT   -> Transaksi dengan confidence >= 0.95 otomatis disimpan; jika meragukan masuk Approval Center.
CONFIRM_ALWAYS      -> Semua transaksi auto-capture wajib dikonfirmasi manual di Approval Center.
DISABLED            -> Fitur auto-capture dimatikan.
```

## 78. Approval Center
Layar Approval Center di Web dan Mobile mengelola antrean konfirmasi:
- Konfirmasi transaksi perbankan yang baru terdeteksi
- Konfirmasi proposal rencana tugas bertingkat (`task_chains`)
- Tombol aksi: "Setujui" (Commit ke database) atau "Tolak" (Abaikan)

## 79. Acceptance Criteria
- [ ] Pengujian RLS membuktikan user tidak dapat mengakses data pengguna lain.
- [ ] Transaksi di bawah ambang batas keyakinan tertahan di antrean approval dan tidak langsung masuk ke saldo keuangan.
- [ ] Tombol persetujuan di Web dan Mobile langsung mengeksekusi komitmen data secara atomik.

---

# PHASE 12 — OFFLINE SYNC, RELIABILITY & RECOVERY

## 80. Tujuan
Menjamin keandalan aplikasi saat perangkat mobile kehilangan koneksi internet dan mencegah duplikasi aksi saat koneksi pulih.

## 81. Android Offline Support (Koreksi F10)
- Aplikasi Android menggunakan database lokal ringan **`expo-sqlite`** (bukan WatermelonDB yang berat).
- Pengguna tetap dapat membaca data cache (Tasks, Schedules, Reminders, Finance) saat luring.
- Aksi pembuatan data baru saat offline (misal mencatat pengeluaran atau membuat tugas) disimpan di antrean lokal dengan `client_operation_id` (UUID).
- Antrean notifikasi finansial lokal memiliki TTL 24 jam; jika ponsel tidak online dalam 24 jam, antrean kedaluwarsa demi keamanan.

## 82. Sync Rules & Idempotency (`client_operations`)
Tabel ledger operasi client di server untuk menjamin pemrosesan mutasi yang idempotent:
```sql
CREATE TABLE IF NOT EXISTS public.client_operations (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    client_operation_id UUID NOT NULL,
    endpoint VARCHAR(128) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    response_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_client_op UNIQUE(user_id, client_operation_id)
);
CREATE INDEX idx_client_operations_lookup ON public.client_operations(user_id, client_operation_id);
```

### Aturan Penanganan Konflik Konkurensi:
- **Tabel Multi-Writer (`reminders`, `tasks`, `schedules`):**
  - Menerapkan **Optimistic Concurrency Control** via kolom `version INT`.
  - Client mengirimkan `base_version` saat melakukan pembaruan data.
  - Jika `base_version` tidak cocok dengan versi di database (terjadi pembaruan bersamaan dari platform lain), server mengembalikan status `409 Conflict` beserta data terkini agar client me-resolve konflik.
- **Tabel Transaksi Keuangan (`financial_transactions`):**
  - Menerapkan prinsip **Append-Only** berbasis `external_event_id` / `client_operation_id`. Mutasi baru selalu disisipkan, bukan menimpa data lama.

## 83. Recovery
- Mekanisme rekonsiliasi otomatis saat aplikasi mobile kembali daring (online).
- Client memanggil `POST /api/v1/sync` dengan membawa antrean operasi lokal.
- Server mengeksekusi operasi secara berurutan dan mengembalikan status commit.

## 84. Acceptance Criteria
- [ ] Data yang dicatat saat HP offline otomatis terunggah saat koneksi internet tersambung kembali.
- [ ] Pengiriman request berulang dengan `client_operation_id` yang sama menghasilkan response identik tanpa membuat baris ganda di database.
- [ ] Konflik versi data ditangani dengan respons 409 yang informatif.

---

# PHASE 13 — TESTING, PRODUCTION & RELEASE

## 85. Testing Matrix
Pengujian komprehensif sebelum rilis produksi:

### Web Dashboard
- Autentikasi login Supabase, refresh token, dan penanganan session timeout
- Realtime data sync pada tabel Tasks, Schedules, Reminders, dan Finance
- Responsivitas layout pada resolusi desktop, tablet, dan smartphone

### Android Sideload App
- Instalasi paket APK mandiri tanpa Google Play Service framework dependency
- Penjadwalan alarm presisi menggunakan AlarmManager lokal dan verifikasi bunyi saat ponsel tidur
- Pengujian penangkapan notifikasi bank via NotificationListenerService dan verifikasi sanitasi sensor nomor rekening di HP
- Pengujian siklus hidup background service dan penerimaan silent data-push FCM

### Discord Bot
- Uji respon chat interaktif Direct Gemini dengan 20 Function Calling Tools
- Verifikasi eksekusi reminder dan pembatalan alarm via chat Discord
- Uji ketahanan terhadap downtime kontainer n8n (latensi <2 detik via Direct Gemini)

### WhatsApp Cloud API
- Verifikasi webhook Meta dengan proteksi HMAC `x-hub-signature-256`
- Uji alur penautan akun inbound `!link <code>`
- Uji penerimaan notifikasi teks dan Voice Note TTS

### Cross-Platform Integration
- Pembuatan reminder dari Discord, alarm berbunyi di HP Android, dan status di-dismiss via Web Dashboard
- Pencatatan keuangan otomatis dari Android muncul seketika di Web Dashboard


# 86. DATABASE MODEL V3

Arsitektur database V3 dibangun di atas PostgreSQL Supabase Tokyo (`ap-northeast-1`) yang menghubungkan 23 tabel existing V2 dengan 5 tabel operasional baru V3:

Daftar 23 Tabel Existing V2:
1. `users` — Profil aplikasi pengguna (diperluas dengan kolom `auth_user_id UUID`).
2. `user_channels` — Peta pemetaan akun komunikasi eksternal (Discord, WhatsApp).
3. `user_roles` — Definisi level RBAC Discord (Owner Level 4, Admin, User, Guest).
4. `tasks` — To-do list dan manajemen tugas harian.
5. `schedules` — Agenda kalender dan jadwal kegiatan terikat waktu.
6. `reminders` — Pengingat waktu, alarm fisik, dan status dispatch pengiriman.
7. `financial_transactions` — Buku besar transaksi keuangan (pemasukan & pengeluaran).
8. `memories` — Memori jangka panjang profil dan preferensi pengguna untuk AI.
9. `notes` — Catatan teks bebas pengguna.
10. `notification_preferences` — Preferensi jam tenang (Quiet Hours) dan saluran notifikasi.
11. `user_voice_preferences` — Pengaturan suara Edge TTS pengguna (ID suara, pitch, speed).
12. `daily_metrics` — Agregasi metrik analitik produktivitas dan keuangan harian.
13. `conversations` — Log histori percakapan chat lintas platform & short-term memory.
14. `channel_conversations` — Sesi percakapan channel eksternal.
15. `channel_messages` — Log pesan masuk dan keluar webhook.
16. `task_chains` — Rencana tugas bertingkat berbasis aksi AI.
17. `proactive_logs` — Riwayat pengiriman Daily Briefing dan Daily Recap.
18. `audit_logs` — Catatan transparansi aksi sistem dan keamanan.
19. `agent_runs` — Trace eksekusi alur AI Direct Gemini.
20. `tool_calls` — Riwayat pemanggilan 20 tools function calling AI.
21. `scheduled_broadcasts` — Jadwal siaran pesan massal multi-channel.
22. `external_cache` — Cache global hasil pencarian web dan cuaca.
23. `schema_migrations` — Ledger versi migrasi database internal.

Daftar 5 Tabel Baru V3:
1. `user_devices` — Pendaftaran perangkat mobile Android dan browser session (FCM tokens & session tracking).
2. `reminder_deliveries` — Ledger pengiriman multi-channel, claim atomik, dan recovery crash.
3. `finance_notification_sources` — Allowlist paket aplikasi perbankan/e-wallet yang diizinkan di Android.
4. `financial_events` — Staging parsing transaksi notifikasi bank di server (tanpa retensi teks mentah).
5. `user_preferences` — Pengaturan persona Jarvis terpusat dan override gaya bahasa per-saluran.

Tabel Pendukung Infrastruktur Tambahan:
- `client_operations` — Ledger idempotensi operasi mutasi offline dari perangkat mobile.
- `account_link_codes` — Penyimpanan kode OTP sementara untuk penautan nomor WhatsApp.

---

# 87. ERD OVERVIEW

```text
users (id VARCHAR PK, auth_user_id UUID UNIQUE, role, callsign)
  ├── user_channels (user_id FK, channel_type, external_user_id) [1:N]
  ├── user_devices (user_id FK, platform, device_identifier, session_id, push_token) [1:N]
  ├── user_preferences (user_id FK, channel_type, response_style, response_length) [1:N]
  ├── tasks (user_id FK, title, status, due_at, version) [1:N]
  ├── schedules (user_id FK, title, start_time, end_time, version) [1:N]
  ├── reminders (user_id FK, title, remind_at, delivery_mode, target_channels, version) [1:N]
  │     └── reminder_deliveries (reminder_id FK, user_id FK, channel_type, scheduled_at, status) [1:N]
  ├── financial_transactions (user_id FK, kind, amount, payment_method, source_type, external_event_id) [1:N]
  ├── financial_events (user_id FK, source_id FK, external_event_id, status) [1:N]
  ├── finance_notification_sources (user_id FK, package_name, enabled) [1:N]
  ├── memories (user_id FK, key, value, importance) [1:N]
  ├── notes (user_id FK, title, content) [1:N]
  ├── notification_preferences (user_id FK, event_type, quiet_hours_start, quiet_hours_end) [1:N]
  └── client_operations (user_id FK, client_operation_id UUID, endpoint, status) [1:N]
```

---

# 88. DATABASE CHANGES SUMMARY & ARSITEKTUR RLS

### 1. Kebijakan Keamanan Default-Deny & Helper Bebas Rekursi
- Seluruh 23 tabel existing dan 5 tabel baru dilindungi Row Level Security (RLS).
- Role `anon` dan `authenticated` dicabut izin mutasi langsungnya (`REVOKE ALL`).
- Klien hanya diberikan hak `SELECT` pada tabel whitelist tertentu; seluruh penulisan (INSERT, UPDATE, DELETE) dieksekusi via Express API yang berjalan menggunakan role `postgres` (pooler) dengan proteksi scoping `WHERE user_id = req.user.id`.
- Helper function `public.current_app_user_id()` dibuat bertipe `SECURITY DEFINER`, `STABLE`, dengan `SET search_path = public` untuk mencegah bug rekursi RLS pada subquery.

### 2. Urutan Migrasi Database Terstruktur:
Rangkaian migrasi melanjutkan ledger `schema_migrations` (migrasi terakhir: `014`):
1. `015_rls_default_deny_and_hardening.sql` — Hardening default-deny, pencabutan hak anon/authenticated, enable RLS 23 tabel.
2. `016_auth_user_id_and_rls_policies.sql` — Tambah kolom `auth_user_id`, buat fungsi `current_app_user_id()`, pasang policy SELECT dan whitelist grant.
3. `017_user_devices_and_deliveries.sql` — Buat tabel `user_devices`, `reminder_deliveries`, dan kolom V3 pada `reminders`.
4. `018_finance_capture_and_staging.sql` — Buat tabel `finance_notification_sources`, `financial_events`, dan ekstensi kolom V3 `financial_transactions`.
5. `019_personality_preferences.sql` — Buat tabel `user_preferences`.
6. `020_supabase_realtime_publication.sql` — Daftarkan tabel sinkronisasi ke publikasi `supabase_realtime` dengan replica identity yang aman.

---

# 89. FINANCE TRANSACTION MODEL V3

Semua transaksi bermuara ke satu tabel tunggal: **`financial_transactions`**.

Struktur Kolom Final:
```text
financial_transactions
│
├── id (BIGSERIAL PK)
├── user_id (VARCHAR(64) NOT NULL FK users)
├── kind ('income' | 'expense' - huruf kecil)
├── amount (numeric(14,2) NOT NULL)
├── currency ('IDR' NOT NULL)
├── category (text)
├── description (text)
├── payment_method (VARCHAR(64) - Instrumen: 'BCA', 'Mandiri', 'Cash', 'GoPay')
├── occurred_at (timestamptz NOT NULL - Disimpan UTC, sinkron WIB)
├── source_type ('CHAT' | 'MANUAL' | 'BANK_NOTIFICATION' | 'IMPORT' | 'SYSTEM' NOT NULL)
├── external_event_id (VARCHAR(128) - UNIQUE per user)
├── confidence_score (numeric(4,2) NOT NULL DEFAULT 1.00)
└── deleted_at (timestamptz - Soft delete untuk Realtime)
```

Constraint & Index:
```sql
CREATE UNIQUE INDEX idx_ft_user_external_event ON public.financial_transactions(user_id, external_event_id) WHERE external_event_id IS NOT NULL;
CREATE INDEX idx_ft_user_occurred ON public.financial_transactions(user_id, occurred_at DESC);
```

---

# 90. REMINDER MODEL V3

Core reminder (`reminders`):
```text
Reminder
├── id (BIGSERIAL PK)
├── user_id (VARCHAR(64) NOT NULL FK users)
├── title (text NOT NULL)
├── remind_at (timestamptz NOT NULL - Disimpan UTC, sinkron WIB)
├── repeat_rule ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY')
├── priority ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
├── status ('pending', 'sent', 'cancelled', 'failed')
├── delivery_mode ('CHAT', 'ALARM', 'CHAT_AND_ALARM' NOT NULL)
├── target_channels (TEXT[] - NULL = Implisit, Terisi = Eksplisit)
├── alarm_sound (VARCHAR(64) DEFAULT 'default')
├── snooze_until (timestamptz - Waktu bangun tunda)
├── snooze_minutes (INT DEFAULT 10)
├── version (INT NOT NULL DEFAULT 1)
└── last_triggered_at (timestamptz)
```

Delivery Dispatch Ledger (`reminder_deliveries`):
```text
reminders (Core Event)
   │
   ├── Android App ───────► Silent FCM Push -> Local AlarmManager + FullScreen Alarm Intent
   ├── WhatsApp ──────────► Pesan Teks Interaktif (Meta Cloud API Webhook)
   └── Discord ───────────► Pesan Embed Interaktif / DM (Discord Gateway)
```

---

# 91. NOTIFICATION MODEL V3

Tipe Notifikasi Sistem:
- `REMINDER` (Pengingat tugas/agenda pengguna)
- `DAILY_BRIEFING` (Agenda & cuaca pagi hari)
- `DAILY_RECAP` (Rekapitulasi malam hari)
- `TASK_DUE` (Tugas mendekati batas waktu)
- `FINANCE_ALERT` (Peringatan pengeluaran / mutasi)
- `APPROVAL_REQUEST` (Permintaan persetujuan transaksi/rencana)
- `SYSTEM_ALERT` (Peringatan teknis sistem)

---

# 92. ANDROID FINANCE NOTIFICATION MODEL

Alur Eksekusi Notifikasi:
```text
Android Notification
↓
Local Package Allowlist Filter (Device)
↓
Device-Side Data Masking (Device)
↓
Forward Masked Text via HTTPS JWT (Device -> Server)
↓
Deterministic Deduplication Check (Server)
↓
Server-Side Regex & LLM Parsing (Server)
↓
Confidence Score Evaluation (Server)
↓
Policy Evaluation (Server):
 ├── AUTO_IF_CONFIDENT (Confidence >= 0.95 -> Commit to financial_transactions)
 ├── CONFIRM_ALWAYS (Kirim ke Approval Center untuk konfirmasi user)
 └── DISABLED (Abaikan notifikasi)
↓
Committed Transaction in `financial_transactions`
```

---

# 93. API CONTRACTS — MINIMAL (PREFIX RESMI /api/v1/)

Semua endpoint V3 bernaung di bawah namespace `/api/v1/` dan mewajibkan header `Authorization: Bearer <Supabase_JWT>`.

## Reminders
```http
GET /api/v1/reminders
POST /api/v1/reminders
PATCH /api/v1/reminders/:id
DELETE /api/v1/reminders/:id
POST /api/v1/reminders/:id/snooze
POST /api/v1/reminders/:id/dismiss
POST /api/v1/reminders/:id/ack
```

## Finance
```http
GET /api/v1/finance/transactions
POST /api/v1/finance/transactions
GET /api/v1/finance/summary
POST /api/v1/finance/events
POST /api/v1/finance/parse-text
GET /api/v1/finance/sources
POST /api/v1/finance/sources
```

## Devices & Sessions
```http
GET /api/v1/devices
POST /api/v1/devices
POST /api/v1/devices/:id/revoke
```

## Personality & Preferences
```http
GET /api/v1/personality
PATCH /api/v1/personality
```

## Notifications
```http
GET /api/v1/notifications/preferences
PATCH /api/v1/notifications/preferences
```

## Conversations & Chat Assistant
```http
GET /api/v1/conversations
POST /api/v1/conversations/chat
POST /api/v1/media/voice-note
```

## Offline Sync & Approvals
```http
POST /api/v1/sync
GET /api/v1/approvals
POST /api/v1/approvals/:id/confirm
POST /api/v1/approvals/:id/reject
```

## System
```http
GET /api/v1/system/health
GET /api/v1/system/min-version
```

---

# 94. ANDROID FINANCE CHAT EXAMPLES

## Expense
User: *"Beli kopi 25rb pake QRIS GoPay"*  
Jarvis: *"Siap! Pengeluaran Rp25.000 untuk kopi via GoPay sudah Amba catat ke pembukuan. ☕"*

## Income
User: *"Barusan cair bonus project 2.500.000 masuk Mandiri"*  
Jarvis: *"Mantap! Pemasukan bonus project sebesar Rp2.500.000 via Mandiri berhasil disimpan. Saldo aman! 🚀"*

## Natural Input
User: *"Tadi makan siang bareng tim habis 120 ribu bayar cash"*  
Jarvis: *"Tercatat! Pengeluaran makan siang tim Rp120.000 (Tunai/Cash) sudah masuk daftar transaksi."*

---

# 95. WEB + ANDROID PERSONALITY

Konfigurasi gaya komunikasi Jarvis yang konsisten:
- **Callsign:** Panggilan akrab yang dipilih pengguna ("Bos", "Bro", "Kapten").
- **Tone:** Suasana percakapan ("Ceria", "Tenang", "Fokus").
- **Response Style:** Pilihan gaya bahasa formal, kasual, atau teknis.

---

# 96. USER JOURNEY — REMINDER

## Case 1: Chat Reminder Sederhana
1. Pengguna mengirim chat di WhatsApp: *"Ingatkan beli susu jam 5 sore nanti."*
2. Direct Gemini memanggil tool `create_reminder` dengan `target_channels = NULL` (implisit).
3. Server membentuk pengingat dengan `delivery_mode = 'CHAT'`.
4. Pukul 17:00 WIB, poller mengekstrak reminder, memverifikasi preferensi, dan mengirimkan pesan chat WhatsApp ke pengguna.

## Case 2: Alarm Pagi Android
1. Pengguna mengirim chat di Discord: *"Pasang alarm jam 5 pagi besok di HP."*
2. Direct Gemini mendeteksi frasa "alarm" dan "di HP", lalu memanggil tool dengan `delivery_mode = 'ALARM'` dan `target_channels = ['ANDROID']`.
3. Server mengirim silent data push FCM ke HP Android pengguna.
4. Aplikasi mobile Android menerima push, menjadwalkan intent alarm lokal di `AlarmManager`.
5. Pukul 05:00 WIB, alarm layar penuh berbunyi kencang di HP pengguna meskipun ponsel dalam mode Doze.

## Case 3: Dismiss & Snooze Lintas Saluran
1. Alarm berbunyi di ponsel. Pengguna sedang bekerja di depan laptop membuka Web Dashboard.
2. Web Dashboard menampilkan kartu alarm aktif secara realtime.
3. Pengguna menekan tombol "Snooze 10 Menit" di Web Dashboard.
4. Server memproses penundaan, mengirim push pembatalan alarm aktif ke HP dan menjadwalkan ulang 10 menit ke depan.

---

# 97. USER JOURNEY — FINANCE

## Manual Input
Pengguna membuka form input cepat di Web Dashboard, memasukkan nominal Rp50.000, memilih kategori "Transport", instrumen "BCA", dan menekan simpan. Transaksi langsung tercatat di database.

## Automatic Capture
1. Pengguna berbelanja di minimarket menggunakan QRIS BCA.
2. Aplikasi BCA m-Banking memancarkan notifikasi Android: *"Transaksi QRIS Rp35.000 berhasil"*.
3. Background service Jarvis menangkap notifikasi, melakukan sensor nomor rekening di HP, dan meneruskan masked payload ke server Railway.
4. Server memvalidasi deduplikasi, menjalankan regex BCA, mengekstrak nominal Rp35.000, dan mencocokkan dengan kebijakan user (`AUTO_IF_CONFIDENT`).
5. Transaksi otomatis dicatat ke `financial_transactions`, dan Web Dashboard langsung memperbarui grafik pengeluaran secara realtime.

## Cross-Platform Verification
Pengguna dapat membuka tab Finance di Web Dashboard untuk memeriksa riwayat transaksi yang masuk dari notifikasi bank maupun dari chat WhatsApp, dengan rincian kategori yang rapi.

---

# 98. V3 NON-GOALS (ADITIF MURNI)

V3 does not automatically include:

- direct control of bank accounts
- direct money transfer
- autonomous financial transactions
- bypassing bank/e-wallet security
- scraping private banking applications without user permission
- unrestricted Android device control
- unrestricted PC control
- autonomous deletion of important data
- autonomous sending of sensitive messages
- execution of LLM / AI models directly on client devices (Web & Mobile are pure thin-clients)
- local regex transaction parsers inside the Android application (all parsing logic resides on the server)
- custom manual session store tables in the database (authentication is strictly delegated to Supabase Auth)
- n8n integration within the core AI conversation or reminder scheduling loop (Direct Gemini is the sole brain)

---

# 99. SECURITY & PRIVACY PRINCIPLES

## Financial Notifications
Akses notifikasi finansial bersifat opt-in, dapat dicabut kapan saja, dan hanya memfilter paket aplikasi perbankan yang secara eksplisit disetujui pengguna.

## Device Access
Perangkat Android hanya meminta izin yang mutlak diperlukan untuk alarm lokal presisi dan penerimaan push notification.

## Finance Auto-Capture
Data perbankan mentah tidak pernah disimpan permanen. Hanya informasi ringkasan finansial terstruktur (nominal, tanggal, instrumen) yang disimpan di database.

## Data Retention
Teks notifikasi dibuang seketika setelah diparsing di memori server. Hash deduplikasi disimpan untuk mencegah pencatatan berulang.

---

# 100. DEVELOPMENT ORDER

Urutan implementasi pengembangan V3 berbasis graf dependensi:

```text
PHASE 0-A: Security Hotfix V2 (HMAC Webhook, Shared Secret Legacy, Fix Regex Owner, Flag USE_N8N)
   ↓
PHASE 0: Architecture & RLS Hardening (Migration 015 RLS Default-Deny, Express 5 Modular Router)
   ↓
PHASE 1: Unified Identity & Auth (Migration 016 auth_user_id, DDL user_devices, WhatsApp !link)
   ↓
PHASE 2: Web Dashboard & Realtime (React 19 Vite SPA, Realtime Read-Only, Unified Static Hosting)
   ↓
PHASE 3: Mobile App Foundation (React Native Expo Prebuild, Android Sideload First, Native Permissions)
   ↓
PHASE 4: Unified Reminder Engine (AlarmManager Android, DDL reminder_deliveries, Poller Atomik)
   ↓
PHASE 5: Notification Router (Integrasi notification_preferences, Multi-Channel Target TEXT[])
   ↓
PHASE 6: Finance Capture (Android NotificationListener Allowlist + Server-Side Regex & LLM Parser)
   ↓
PHASE 7: Finance Assistant (Natural Language Finance Chat via Direct Gemini 20 Tools)
   ↓
[BATAS TARGET MVP V3.0 RILIS]
   ↓
PHASE 8: Personality Center (Taksonomi response_style & length, Override per-channel)
   ↓
PHASE 9: Smart Routing & Presence (Smart multi-device notification routing & presence)
   ↓
PHASE 10: Advanced Analytics (Visualisasi analitik mendalam & automated financial insights)
   ↓
PHASE 11: Security & Approval Center (Audit komprehensif & antrean approval interaktif)
   ↓
PHASE 12: Offline Sync & Recovery (Idempotency client_operations, optimistic locking version INT)
   ↓
PHASE 13: Final Production Release (Build release APK Sideload & Web Live di Railway)
```

---

# 101. DEFINITION OF DONE

Sebuah fase dinyatakan selesai jika:
1. Skema database telah dimigrasikan secara bersih dan tercatat di `schema_migrations`.
2. Semua endpoint API mematuhi kontrak response standar dan terproteksi Bearer JWT Supabase.
3. Seluruh unit test dan skenario integrasi lolos pengujian tanpa regresi pada fitur V2 existing.
4. Dokumentasi teknis dan panduan operasional diperbarui.

---

# 102. V3 MASTER ACCEPTANCE CRITERIA

### Dashboard
- [ ] Berjalan mulus di domain tunggal Railway tanpa isu CORS.
- [ ] Menampilkan data secara realtime via Supabase Realtime read-only.
- [ ] Responsif pada layar monitor desktop, tablet, dan smartphone.

### Android
- [ ] Berhasil di-install via direct sideload APK.
- [ ] Alarm berbunyi tepat waktu saat ponsel dalam mode Doze Sleep.
- [ ] Notifikasi bank tertangkap dan tersensor di HP sebelum dikirim ke server.

### Reminder
- [ ] Reminder mode CHAT dan ALARM selalu bypass jam tenang.
- [ ] Pengiriman menerapkan at-least-once tanpa risiko duplikasi berulang saat redeploy.
- [ ] Acknowledgment status dari ponsel mobile terbarui di database.

### Finance
- [ ] Buku besar `financial_transactions` menampung mutasi dari chat, web, dan notifikasi bank.
- [ ] Transaksi berulang dari notifikasi yang sama tidak tercatat ganda.
- [ ] Nol retensi teks mentah perbankan di database server.

### Personality
- [ ] Gaya bahasa bot dapat diubah secara visual dari dashboard.
- [ ] Pembedaan taksonomi gaya bahasa dan panjang respon berfungsi akurat.

### Cross-Channel
- [ ] State data tersinkronisasi instan di Discord, WhatsApp, Web, dan Mobile.
- [ ] Pengguna merasakan satu pengalaman asisten Jarvis yang utuh di seluruh platform.

---

# 103. FUTURE V3+ DIRECTION
- Ekspedisi build resmi untuk iOS menggunakan Apple Developer Program berbayar dan framework AlarmKit.
- Penambahan channel olah pesan baru (Telegram Bot API).
- Integrasi OCR visual mutasi nota fisik dan struk belanja.

---

# 104. FIRST TASK FOR ANTIGRAVITY
## DO NOT CODE IMMEDIATELY.
1. Analisis menyeluruh PRD final ini sebelum mengeksekusi migration database apa pun.
2. Mulai dari Phase 0-A (Hotfix Keamanan V2) dan Migration `015_rls_default_deny_and_hardening.sql`.
3. Verifikasi ketiadaan regresi pada fitur bot Discord dan WhatsApp V2 yang sedang live.

---

# 105. ANTIGRAVITY IMPLEMENTATION RULES
- Pertahankan integritas codebase V2 existing.
- Jangan pernah rewrite backend dari nol.
- Terapkan prinsip pertahanan berlapis pada seluruh data sensitif finansial.
- Selalu gunakan parameterized queries untuk seluruh akses database.

---

# 106. FINAL PRINCIPLE
> **"One Jarvis Core, multiple channels, multiple devices, one shared state."**


# LAMPIRAN A — CHANGELOG V3.0 -> V3.1

Dokumen PRD V3.1 ini menyempurnakan draf PRD V3.0 dengan penyesuaian arsitektural yang didukung verifikasi kode dan database aktual:

1. **Header & Sec 1:** Menghapus framing "Dual Mode n8n / Direct Gemini". Menetapkan Direct Gemini AI (20 Function Calling Tools) sebagai satu-satunya otak percakapan dan pengambil keputusan, sementara n8n diturunkan menjadi worker sekunder untuk otomatisasi eksternal.
2. **Sec 4 & Sec 6:** Mengakui Express 5 sebagai dependensi baru di Railway, mengganti routing wildcard usang `*` dengan named syntax `app.all('/{*splat}')` (path-to-regexp v8), dan menambahkan penanganan raw body untuk verifikasi webhook.
3. **Phase 0-A (Tambahan Baru):** Menambahkan fase hotfix keamanan untuk sistem V2 yang sedang berjalan: verifikasi HMAC webhook Meta, shared secret pada endpoint legacy port 5001, penghapusan celah regex nama owner, dan penambahan flag `USE_N8N=false`.
4. **Sec 12, 13 & 14:** Menjaga `users.id` V2 tetap utuh, menambahkan kolom `auth_user_id UUID` untuk GoTrue, memisahkan boundary `user_channels` khusus messaging dan `user_devices` untuk endpoint hardware, serta menerapkan DDL `user_devices` yang memisahkan status sesi dari status push.
5. **Sec 16 (Section Baru):** Mengisi section identitas dan penautan akun dengan spesifikasi alur Discord OAuth, WhatsApp Inbound `!link <code>` (via tabel `account_link_codes`), resolusi role server-side, dan rencana migrasi data kanonik (Opsi K).
6. **Sec 18 & 19:** Menyelaraskan akses data Web Dashboard: Home metrics via Express API, Tasks/Schedules/Reminders/Finance via Supabase Realtime Read-Only, dan Conversations/Audit via Express API.
7. **Sec 20 & 21:** Mengadopsi distribusi Android Sideload APK mandiri, arsitektur alarm lokal AlarmManager + silent FCM data-push sync, serta klarifikasi status platform iOS (out-of-scope untuk V3.0).
8. **Sec 25 (Section Baru):** Mengisi matriks izin native Android (`USE_EXACT_ALARM`, `BIND_NOTIFICATION_LISTENER_SERVICE`, dll.), batasan Doze/Force-Stop, dan panduan optimasi baterai.
9. **Sec 33 & 34:** Mengintegrasikan keputusan Jam Tenang D1 (semua reminder buatan user bypass jam tenang), mengganti kolom `preferred_channel` dengan `target_channels TEXT[]` (NULL = implisit), dan mempertahankan `remind_at` serta `snooze_until`.
10. **Sec 35:** Menetapkan DDL lengkap `reminder_deliveries` dengan constraint `UNIQUE(reminder_id, channel_type, delivery_mode, scheduled_at)`, status lengkap termasuk `DEFERRED`, algoritma poller `FOR UPDATE SKIP LOCKED` dengan transaksi atomik, penanganan failure nol-channel, dan endpoint ACK mobile.
11. **Sec 38-40:** Mengintegrasikan rumus jam tenang untuk notifikasi proaktif dan peringatan sistem, serta pemetaan runtime nilai legacy `'BOTH'`.
12. **Sec 43, 44, 46, 49, 50:** Merevisi alur penangkapan notifikasi bank: masking di device, zero persistent raw retention di server, DDL `finance_notification_sources` & `financial_events`, satu kunci deduplikasi deterministik `dedupe_key`, dan penyeragaman enum kebijakan persetujuan (`AUTO_IF_CONFIDENT`, `CONFIRM_ALWAYS`, `DISABLED`).
13. **Sec 60 & 63:** Memisahkan taksonomi gaya persona menjadi `response_style` (gaya bahasa) dan `response_length` (panjang jawaban), DDL `user_preferences`, serta mengisolasi tabel `user_voice_preferences`.
14. **Sec 65 (Phase 9):** Menyelaraskan Phase 9 menjadi "Cross-Channel Smart Routing & Presence" karena Realtime data-sync sudah diaktifkan sejak Phase 2.
15. **Sec 88 & 89:** Menetapkan DDL `financial_transactions` (`payment_method` + `source_type` + `external_event_id`, tanpa `source_name`/`entry_method`), arsitektur RLS default-deny dengan helper `current_app_user_id()`, dan urutan migrasi terstruktur mulai dari 015.
16. **Sec 93:** Menyeragamkan seluruh kontrak endpoint API di bawah prefix resmi `/api/v1/` dengan menyertakan endpoint streaming chat, offline sync, media voice note, dan versioning.
17. **Sec 98:** Mempertahankan 9 butir keselamatan asli kata demi kata dan menambahkan 4 butir batas arsitektural non-goals baru.
18. **Sec 100:** Menyelaraskan bagan urutan pengembangan dengan penambahan Phase 0-A dan penegasan garis batas MVP.

---

# LAMPIRAN B — DECISION LOG

Log keputusan arsitektural yang telah final dan disepakati:

| ID Keputusan | Topik Keputusan | Pilihan yang Ditetapkan | Alasan Teknis Singkat |
|---|---|---|---|
| **D1** | Kebijakan Jam Tenang (Quiet Hours) | **Opsi X (Pertahankan V2)** | Formula V2 dipertahankan persis (`bypassQuietHours \|\| eventType === 'REMINDER' \|\| priority IN ('URGENT','HIGH')`). Semua reminder buatan user bypass jam tenang agar tidak terlewat; jam tenang hanya untuk pesan proaktif sistem (Daily Briefing, Daily Recap, Finance Alert). Poller reminder tidak memerlukan cabang jam tenang. |
| **D2** | Strategi Identitas Multi-Baris | **Opsi K (Kanonik)** | Satu baris `users` kanonik per orang fisik (snowflake Discord diprioritaskan). `user_channels` menjadi registry pemetaan alias. Dijalankan skrip migrasi satu kali dalam transaksi database untuk memindahkan `user_id` lama di 17 tabel riwayat. Akun test hanya didaftar untuk peninjauan owner (tidak dihapus otomatis). |
| **D3** | Mekanisme Revokasi Sesi Per-Device | **Hibrida** | `session_id` diambil server dari JWT yang tervalidasi saat registrasi device, disimpan di `user_devices`. Middleware API menolak request jika status device `REVOKED`. Revokasi per-device menghapus baris di `auth.sessions` via helper internal `revokeAuthSession()`. "Revoke semua perangkat lain" memanggil `supabase.auth.admin.signOut(jwt, 'others')`. Masa aktif JWT disetel 15 menit. |
| **D4** | Pengirim Push Notification (Push Sender) | **FCM Admin SDK Native** | Token FCM mentah disimpan di `user_devices.push_token`. Service account Firebase disimpan di env Railway. Push bersifat silent high-priority untuk sinkronisasi alarm (`ALARM_SYNC`). Sideload APK Android didukung penuh. Platform iOS dinyatakan Out of Scope untuk V3.0. |
| **D5** | Retensi Teks Mentah Notifikasi Bank | **Opsi A (Zero Raw Retention)** | Server tidak menyimpan teks mentah notifikasi bank. Tabel `financial_events` hanya menyimpan data terstruktur hasil parse dan satu kunci hash deduplikasi `dedupe_key`. Tidak ada staging teks mentah 24 jam. Server menjalankan masking kedua sebelum teks dikirim ke LLM sebagai pertahanan berlapis. |
| **Final #1** | Implementasi Alarm Android | **Lokal via AlarmManager** | Menggunakan `AlarmManager.setAlarmClock()` lokal untuk menjamin keandalan bunyi tepat waktu saat ponsel tidur; server hanya mengirimkan data-push FCM untuk sinkronisasi/pembatalan. |
| **Final #2** | Enum Kebijakan Persetujuan Finansial | **AUTO_IF_CONFIDENT / CONFIRM_ALWAYS / DISABLED** | Diseragamkan di Sec 50, 77, dan 92 untuk konsistensi seluruh modul finansial. |
| **Final #3** | Skema Kolom Sumber Finansial | **payment_method + source_type + external_event_id** | Menggunakan kolom existing `payment_method` untuk instrumen bank (BCA, Cash, GoPay), menambahkan `source_type` dan `external_event_id`. Kolom `source_name` dan `entry_method` dihapus. |
| **Final #4** | Skema Saluran Target Reminder | **target_channels TEXT[]** | Array saluran target; `NULL` = implisit (di-resolve dari preferensi saat jatuh tempo), terisi = eksplisit user. Nilai legacy `'BOTH'` dipetakan ke `['DISCORD', 'WHATSAPP']`. |
| **Final #5** | Model Distribusi Aplikasi Mobile | **Direct Sideload APK** | Rilis mandiri tanpa melalui Google Play Store guna menghindari hambatan audit kebijakan izin background listener notifikasi finansial. |
| **Final #6** | Alur Penautan Akun WhatsApp | **Inbound `!link <code>`** | Pengguna mengirim kode OTP 6-digit ke bot WA Jarvis. Gratis 100%, tidak memerlukan template persetujuan Meta Cloud API, dan aman via verifikasi HMAC webhook. |
| **Final #7** | Prinsip Akses Basis Data Client | **Read-Only RLS + Tulis via API** | Client Web dan Mobile hanya memiliki izin `SELECT` langsung via RLS dan Supabase Realtime. Seluruh operasi tulis (INSERT, UPDATE, DELETE) mutlak melalui Express API Railway. |

---

# LAMPIRAN C — TABEL KEPUTUSAN AKSES RLS (23 TABEL EXISTING + 5 TABEL BARU)

Prinsip Keamanan: **Client berstatus Read-Only via RLS. Seluruh mutasi tulis WAJIB lewat Express API (`/api/v1/*`).**

| No | Nama Tabel | Status Tabel | Client SELECT Langsung? | Jalur Akses Utama | Masuk Realtime? | Alasan & Batasan Keamanan |
|---|---|---|---|---|---|---|
| 1 | `users` | Existing | **TIDAK** | Express API (`/api/v1/profile`) | Tidak | Menghindari celah eskalasi privilege kolom `role` dan `auth_user_id`. Dibaca via API. |
| 2 | `user_channels` | Existing | **YA** (Own Rows) | RLS Direct | Tidak | Pemetaan akun Discord & WA milik user. Tautan baru via `/api/v1/channels/link`. |
| 3 | `user_roles` | Existing | **TIDAK** | Express API | Tidak | **SENSITIF:** Matriks hak akses Discord RBAC. Hanya untuk internal backend & OWNER. |
| 4 | `tasks` | Existing | **YA** (Own Rows) | RLS + Realtime | **YA** | To-do list harian dinamis. Butuh sinkronisasi cepat lintas device. Tulis via API. |
| 5 | `schedules` | Existing | **YA** (Own Rows) | RLS + Realtime | **YA** | Kalender agenda terikat waktu. Butuh sinkronisasi realtime. Tulis via API. |
| 6 | `reminders` | Existing | **YA** (Own Rows) | RLS + Realtime | **YA** | Pengingat aktif dan alarm. Sinkronisasi status snooze/dismiss instan. Tulis via API. |
| 7 | `financial_transactions` | Existing | **YA** (Own Rows) | RLS + Realtime | **YA** | Mutasi keuangan pribadi. Dashboard web menerima stream transaksi baru. Tulis via API. |
| 8 | `memories` | Existing | **YA** (Own Rows) | RLS Direct | Tidak | Memori fakta jangka panjang AI. Relatif statis; dibaca saat inisialisasi profil. |
| 9 | `notes` | Existing | **YA** (Own Rows) | RLS Direct | Tidak | Catatan teks pengguna. Dibaca langsung oleh web/mobile; mutasi via Express API. |
| 10 | `notification_preferences` | Existing | **YA** (Own Rows) | RLS Direct | Tidak | Preferensi jam tenang user. Dibaca langsung oleh settings UI; mutasi via Express API. |
| 11 | `user_voice_preferences` | Existing | **YA** (Own Rows) | RLS Direct | Tidak | Pengaturan suara Edge TTS. Terisolasi dari tabel persona teks. Mutasi via API. |
| 12 | `daily_metrics` | Existing | **YA** (Own Rows) | RLS Direct | Tidak | Metrik produktivitas harian pengguna. Tulis eksklusif oleh server scheduler. |
| 13 | `conversations` | Existing | **TIDAK** | Express API | Tidak | Log percakapan AI & short-term memory. Dikelola via `/api/v1/conversations`. |
| 14 | `channel_conversations` | Existing | **TIDAK** | Express API | Tidak | Log sesi percakapan channel eksternal. Dikelola internal oleh gateway bot. |
| 15 | `channel_messages` | Existing | **TIDAK** | Express API | Tidak | Log pesan mentah webhook platform eksternal. Internal ingest only. |
| 16 | `task_chains` | Existing | **TIDAK** | Express API | Tidak | Rencana tugas bertingkat AI. Dibaca dan dikonfirmasi via `/api/v1/approvals`. |
| 17 | `proactive_logs` | Existing | **TIDAK** | Express API | Tidak | Log riwayat pengiriman Daily Briefing/Recap oleh worker background. |
| 18 | `audit_logs` | Existing | **TIDAK** | Express API | Tidak | **SENSITIF:** Catatan audit keamanan, IP address, dan jejak aksi. Khusus OWNER. |
| 19 | `agent_runs` | Existing | **TIDAK** | Express API | Tidak | **SENSITIF:** Trace eksekusi LLM & metadata intent. Khusus developer/OWNER. |
| 20 | `tool_calls` | Existing | **TIDAK** | Express API | Tidak | **SENSITIF:** Detail argumen 20 function calling AI. Khusus developer/OWNER. |
| 21 | `scheduled_broadcasts` | Existing | **TIDAK** | Express API | Tidak | **SENSITIF:** Siaran pesan massal multi-channel. Khusus level OWNER. |
| 22 | `external_cache` | Existing | **TIDAK** | Express API | Tidak | Cache global query hash (web & cuaca). Tanpa konteks identitas user. |
| 23 | `schema_migrations` | Existing | **TIDAK** | Express API | Tidak | Ledger migrasi skema database PostgreSQL. Terisolasi dari semua role client. |
| 24 | `user_devices` | **Baru (1)** | **TIDAK** | Express API (`/api/v1/devices`) | Tidak | **SENSITIF:** Memuat FCM token, hardware UUID, dan session ID. Dikelola via API. |
| 25 | `reminder_deliveries` | **Baru (2)** | **TIDAK** | Express API | Tidak | Ledger internal dispatch alarm/chat. Dikelola oleh worker scheduler Railway. |
| 26 | `finance_notification_sources` | **Baru (3)** | **TIDAK** | Express API (`/api/v1/finance/sources`) | Tidak | Allowlist aplikasi bank. Dikelola via endpoint REST terproteksi. |
| 27 | `financial_events` | **Baru (4)** | **TIDAK** | Express API | Tidak | Staging data parsing mutasi bank di server. Ephemeral processing only. |
| 28 | `user_preferences` | **TIDAK** | Express API (`/api/v1/personality`) | Tidak | Pengaturan gaya persona & kebijakan auto-capture. Dikelola via API terpusat. |

---

# LAMPIRAN D — RENCANA TES RLS (RLS TEST PLAN)

Pengujian dijalankan pada lingkungan staging database Supabase menggunakan peran simulasi PostgREST (`SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claims" = '...';`):

1. **Tes 1 — Isolasi Data Antar Pengguna (Multi-Tenant Isolation):**
   - Skenario: User A (auth UID: `uuid-a`, `current_app_user_id() = 'user_a'`) mengeksekusi `SELECT * FROM public.tasks;`.
   - Hasil yang Diharapkan: Hanya baris tugas dengan `user_id = 'user_a'` yang dikembalikan.
   - Skenario Uji Pelanggaran: User A menjalankan `SELECT * FROM public.tasks WHERE user_id = 'user_b';` -> **Hasil: 0 baris kembali (Empty Set)**.
2. **Tes 2 — Penolakan Hak Tulis Langsung (Read-Only Enforcement):**
   - Skenario: User A mencoba `INSERT INTO public.tasks (user_id, title) VALUES ('user_a', 'Tugas Ilegal');`.
   - Hasil yang Diharapkan: Database menolak dengan `ERROR: permission denied for table tasks`.
   - Skenario: User A mencoba `UPDATE public.tasks SET status = 'completed' WHERE id = 1;`.
   - Hasil yang Diharapkan: `ERROR: permission denied for table tasks`.
   - Skenario: User A mencoba `DELETE FROM public.tasks WHERE id = 1;`.
   - Hasil yang Diharapkan: `ERROR: permission denied for table tasks`.
3. **Tes 3 — Proteksi Eskalasi Hak Akses Profil (`users` Table):**
   - Skenario: User A mencoba `UPDATE public.users SET role = 'OWNER' WHERE id = 'user_a';`.
   - Hasil yang Diharapkan: Database menolak dengan `ERROR: permission denied for table users`. Role hanya dapat diubah melalui query server backend.
4. **Tes 4 — Default-Deny pada Seluruh Tabel Sensitif:**
   - Skenario: User A mencoba membaca tabel perangkat atau log audit:
     `SELECT * FROM public.user_devices;`
     `SELECT * FROM public.audit_logs;`
     `SELECT * FROM public.financial_events;`
   - Hasil yang Diharapkan: Seluruh query gagal dengan pesan `ERROR: permission denied for table ...`.
5. **Tes 5 — Akses Normal Server Backend (`postgres` pooler role):**
   - Skenario: Koneksi server Express API backend (role `postgres` pooler) mengeksekusi insert transaksi dan update status reminder.
   - Hasil yang Diharapkan: Operasi sukses 100% tanpa hambatan karena role `postgres` memiliki atribut `rolbypassrls = true`.

---

# LAMPIRAN E — URUTAN MIGRATION & RISIKO REGRESI V2

Penomoran melanjutkan ledger `schema_migrations` aktual (migrasi terakhir yang tercatat: `014_task_chains_and_confirmations`):

### 1. Daftar Migration Terurut:
1. **`015_rls_default_deny_and_hardening.sql` (BERDIRI SENDIRI, PALING PERTAMA):**
   - *Tujuan:* Mencabut semua privilege default publik dari role `anon` dan `authenticated` (`REVOKE ALL`), mengonfigurasi `ALTER DEFAULT PRIVILEGES`, dan mengaktifkan RLS default-deny pada seluruh 23 tabel publik existing. *(Tidak memuat fungsi helper karena kolom auth_user_id belum ada).*
2. **`016_auth_user_id_and_rls_policies.sql`:**
   - *Tujuan:* Menambahkan kolom `auth_user_id` pada tabel `users`, membuat fungsi helper `public.current_app_user_id()`, membuat policy `FOR SELECT` pada tabel whitelist (`tasks`, `schedules`, `reminders`, `financial_transactions`, `notes`, `memories`, `user_channels`, `notification_preferences`, `user_voice_preferences`, `daily_metrics`), dan memberikan `GRANT SELECT` eksklusif pada tabel whitelist tersebut.
3. **`017_supabase_realtime_publication.sql`:**
   - *Tujuan:* Mendaftarkan tabel whitelist sinkronisasi (`tasks`, `schedules`, `reminders`, `financial_transactions`) ke publikasi `supabase_realtime` agar Phase 2 Web Dashboard dapat langsung beroperasi.
4. **`018_user_devices_and_deliveries.sql`:**
   - *Tujuan:* Membuat tabel `user_devices` (dengan `session_id`, `push_status`, constraint unique) dan `reminder_deliveries` (dengan constraint slot unique dan enum status lengkap), serta menambahkan kolom V3 pada `reminders` (`delivery_mode`, `target_channels TEXT[]`, `alarm_sound`, `snooze_minutes`, `version INT`).
5. **`019_finance_capture_and_staging.sql`:**
   - *Tujuan:* Menambahkan kolom V3 pada `financial_transactions` (`source_type`, `external_event_id`, `confidence_score`), backfill 13 baris legacy dengan `source_type = 'CHAT'`, membuat partial unique index deduplikasi, serta membuat tabel allowlist `finance_notification_sources` dan staging `financial_events`.
6. **`020_personality_preferences.sql`:**
   - *Tujuan:* Membuat tabel `user_preferences` dengan dukungan taksonomi `response_style`, `response_length`, dan override channel.
7. **`021_client_operations_and_link_codes.sql`:**
   - *Tujuan:* Membuat tabel infrastruktur `client_operations` untuk idempotensi offline dan `account_link_codes` untuk OTP penautan WhatsApp.

### 2. Analisis Risiko Regresi V2 per Migration & Rencana Pengujian:
| Migration | Potensi Risiko Regresi V2 | Strategi Mitigasi Arsitektur | Rencana Pengujian (Test Plan) |
|---|---|---|---|
| **015 & 016 (RLS Hardening)** | Bot Discord/WA gagal berinteraksi dengan database karena terblokir RLS | Koneksi `db.js` V2 menggunakan role `postgres` yang memiliki `rolbypassrls = true`. RLS hanya berlaku untuk client `anon`/`authenticated`. | Jalankan skrip test bot `check-whatsapp.js` dan bot Discord; pastikan seluruh operasi INSERT/SELECT V2 berjalan normal tanpa error permission. |
| **017 (Realtime Publication)** | Penambahan publication membebani Write-Ahead Log (WAL) Supabase | Hanya mendaftarkan 4 tabel operasional user. Tidak menyetel `REPLICA IDENTITY FULL` pada tabel multi-tenant. | Monitor latensi database pooler pasca publikasi di dashboard Supabase Metrics. |
| **018 (`reminders` & deliveries)** | Poller reminder 30 detik bentrok dengan struktur baru | Kolom existing `remind_at`, `status`, dan `snooze_until` tetap dipertahankan. Status `'failed'` aman karena tidak ada CHECK constraint di DB. | Buat test reminder 1 menit via Discord `!remindme`; verifikasi reminder tetap berbunyi tepat waktu dan tercatat di delivery ledger. |
| **019 (`financial_transactions`)** | Fitur pencatatan keuangan V2 dari chat gagal insert karena kolom baru | Kolom `payment_method` existing dipertahankan; kolom baru (`source_type`) diberi default `'CHAT'` dan `nullable` untuk `external_event_id`. | Uji chat pencatatan uang di WA: *"beli kopi 15rb"*; pastikan transaksi tersimpan sukses di DB. |
| **020 (`user_preferences`)** | Preferensi persona baru bentrok dengan konfigurasi voice existing | Tabel `user_voice_preferences` tetap terpisah dan utuh 100%. | Jalankan perintah suara di voice channel Discord; pastikan TTS Edge tetap menggunakan suara yang sesuai. |

---

# LAMPIRAN F — KATALOG ROUTE LENGKAP (SATU SUMBER KEBENARAN)

Seluruh route baru V3 bernaung di bawah namespace terproteksi `/api/v1/` dan mewajibkan autentikasi Supabase JWT Bearer Token (kecuali route sistem publik yang ditandai khusus).

### 1. Autentikasi & Identitas (`/api/v1/auth`, `/api/v1/profile`, `/api/v1/channels`)
- `GET /api/v1/auth/me` — Mengambil data identitas user aktif, status akun, dan role server-side.
- `GET /api/v1/profile` — Mengambil data profil lengkap pengguna (callsign, timezone, waktu briefing/recap).
- `PATCH /api/v1/profile` — Memperbarui profil pengguna (callsign, timezone, jam briefing/recap). *Catatan: Kolom `role` dan `status` dilarang diubah via endpoint ini.*
- `GET /api/v1/channels` — Mengambil daftar channel komunikasi yang tertaut (Discord, WhatsApp).
- `POST /api/v1/channels/link/code` — Men-generate kode OTP 6-digit untuk alur penautan WhatsApp (`!link <code>`).
- `DELETE /api/v1/channels/:id` — Memutus tautan akun channel komunikasi tertentu.

### 2. Perangkat & Sesi (`/api/v1/devices`)
- `GET /api/v1/devices` — Mengambil daftar perangkat mobile dan browser session aktif milik user.
- `POST /api/v1/devices` — Mendaftarkan perangkat mobile baru atau memperbarui token FCM (`push_token`).
- `POST /api/v1/devices/:id/revoke` — Mencabut sesi perangkat tertentu dan membatalkan refresh token.

### 3. Tugas & Agenda (`/api/v1/tasks`, `/api/v1/schedules`)
- `GET /api/v1/tasks` — Mengambil daftar to-do list aktif dan filter status.
- `POST /api/v1/tasks` — Menambah tugas baru (idempotent via `client_operation_id`).
- `PATCH /api/v1/tasks/:id` — Mengubah status tugas (pending/completed) dengan validasi `version INT`.
- `DELETE /api/v1/tasks/:id` — Menghapus tugas (soft-delete).
- `GET /api/v1/schedules` — Mengambil daftar agenda kegiatan kalender.
- `POST /api/v1/schedules` — Membuat agenda jadwal kegiatan baru.
- `PATCH /api/v1/schedules/:id` — Memperbarui rincian agenda jadwal.
- `DELETE /api/v1/schedules/:id` — Membatalkan jadwal kegiatan.

### 4. Pengingat & Alarm (`/api/v1/reminders`)
- `GET /api/v1/reminders` — Mengambil daftar pengingat aktif dan riwayat delivery.
- `POST /api/v1/reminders` — Membuat pengingat baru (mendukung mode CHAT, ALARM, dan CHAT_AND_ALARM).
- `PATCH /api/v1/reminders/:id` — Memperbarui waktu pemicu atau preferensi alarm.
- `DELETE /api/v1/reminders/:id` — Membatalkan reminder aktif (`status = 'cancelled'`).
- `POST /api/v1/reminders/:id/snooze` — Menunda pengingat selama N menit (`snooze_until`).
- `POST /api/v1/reminders/:id/dismiss` — Menyelesaikan pengingat yang sedang aktif berbunyi.
- `POST /api/v1/reminders/:id/ack` — Menerima sinyal konfirmasi penerimaan/bunyi dari perangkat mobile Android.

### 5. Keuangan Pribadi (`/api/v1/finance`)
- `GET /api/v1/finance/transactions` — Mengambil riwayat mutasi keuangan dengan paginasi dan filter kategori.
- `POST /api/v1/finance/transactions` — Mencatat mutasi transaksi baru secara manual dari form Web/App.
- `GET /api/v1/finance/summary` — Menghitung total pemasukan, pengeluaran, dan saldo bulan berjalan.
- `POST /api/v1/finance/events` — Menerima masked payload notifikasi bank dari service Android.
- `POST /api/v1/finance/parse-text` — Preview parsing kalimat natural language keuangan sebelum disimpan.
- `GET /api/v1/finance/sources` — Mengambil daftar allowlist paket aplikasi perbankan yang aktif.
- `POST /api/v1/finance/sources` — Menambahkan atau memperbarui status allowlist aplikasi perbankan.

### 6. Persona, Preferensi & Voice (`/api/v1/personality`, `/api/v1/voice-preferences`)
- `GET /api/v1/personality` — Mengambil konfigurasi gaya persona global dan override per-channel.
- `PATCH /api/v1/personality` — Memperbarui `response_style`, `response_length`, dan `auto_capture_policy`.
- `GET /api/v1/voice-preferences` — Mengambil konfigurasi suara Edge TTS (ID suara, pitch, speed).
- `PATCH /api/v1/voice-preferences` — Memperbarui preferensi suara Edge TTS.
- `GET /api/v1/memories` — Mengambil daftar memori jangka panjang AI.
- `DELETE /api/v1/memories/:id` — Menghapus rekaman memori AI yang salah atau usang.

### 7. Percakapan, Streaming & Media (`/api/v1/conversations`, `/api/v1/media`)
- `GET /api/v1/conversations` — Mengambil log histori percakapan lintas saluran teragregasi.
- `POST /api/v1/conversations/chat` — Streaming respons percakapan AI Direct Gemini untuk Web dan Mobile.
- `POST /api/v1/media/voice-note` — Mengunggah file audio Voice Note untuk transkripsi Whisper STT.

### 8. Notifikasi, Approvals & Offline Sync (`/api/v1/notifications`, `/api/v1/approvals`, `/api/v1/sync`)
- `GET /api/v1/notifications/preferences` — Mengambil preferensi Jam Tenang dan channel notifikasi.
- `PATCH /api/v1/notifications/preferences` — Memperbarui rentang Jam Tenang (`quiet_hours_start/end`).
- `GET /api/v1/approvals` — Mengambil antrean aksi yang membutuhkan konfirmasi manual user.
- `POST /api/v1/approvals/:id/confirm` — Menyetujui transaksi perbankan atau task chain.
- `POST /api/v1/approvals/:id/reject` — Menolak transaksi atau task chain.
- `POST /api/v1/sync` — Endpoint sinkronisasi batch offline (idempotent dengan `client_operation_id`).
- `GET /api/v1/dashboard/summary` — Menghitung ringkasan cepat kartu Home dashboard.

### 9. Sistem & Health Check (`/api/v1/system`, Endpoint Legacy Root)
- `GET /api/v1/system/health` — Status diagnostik latensi database, memori RAM, dan uptime bot.
- `GET /api/v1/system/min-version` — Memeriksa versi minimum aplikasi mobile yang didukung. *(Jika client mengirim header `X-Min-App-Version` di bawah batas, server membalas `426 Upgrade Required`).*
- `GET /api/v1/system/agent-runs` — Log trace eksekusi LLM (Khusus hak akses OWNER).
- `GET /api/v1/system/tool-calls` — Riwayat pemanggilan function calling AI (Khusus hak akses OWNER).
- `GET /api/v1/audit` — Log transparansi audit keamanan (Khusus hak akses OWNER).
- `POST /api/v1/broadcast` — Mengirim siaran pesan massal (Khusus hak akses OWNER).
- **Route Legacy Root (Diproteksi Header `x-internal-key` via Hotfix 0-A):**
  - `GET /health` / `GET /` — Health check status publik (200 / 503).
  - `POST /api/notify` — Proactive reminder dispatching.
  - `GET /api/broadcast` & `POST /api/broadcast` — CLI runner broadcast messaging.
  - `GET /api/users` — Daftar user untuk runner CLI broadcast.
  - `GET /webhook/whatsapp` & `POST /webhook/whatsapp` — Meta Webhook endpoint (HMAC SHA-256 verified).

---

# LAMPIRAN G — LAMPIRAN VERIFIKASI (KUTIPAN DOCS RESMI & URL)

Seluruh klaim teknis kritis dalam PRD ini diverifikasi langsung terhadap dokumentasi resmi:

### 1. Supabase Auth Admin SignOut Signature
* **Dokumentasi Resmi:** Supabase JavaScript Client Reference — `auth.admin.signOut`
* **URL:** `https://supabase.com/docs/reference/javascript/auth-admin-signout`
* **Kutipan Kunci:**
  > *"supabase.auth.admin.signOut(jwt: string, scope?: 'global' \| 'local' \| 'others')*  
  > *Parameters -> jwt (string, Required): A valid user access token (JWT)."*
* **Keterangan:** Method admin ini menerima string JWT access token, **BUKAN User UUID**. Scope `'others'` mencabut seluruh sesi lain kecuali sesi JWT yang sedang aktif.

### 2. Supabase Auth Session Tracking & `session_id` Claim
* **Dokumentasi Resmi:** Supabase Auth Sessions Guide
* **URL:** `https://supabase.com/docs/guides/auth/sessions`
* **Kutipan Kunci:**
  > *"Supabase generates an access token (a JSON Web Token). This JWT contains standard claims like sub, role, exp, and a session_id (which is a UUID representing that exact login instance). The primary key (id) of the auth.sessions table corresponds directly to the session_id found inside the JWT... Supabase access tokens are stateless JWTs... remaining valid until expiration."*
* **Keterangan:** Penghapusan sesi via database membatalkan refresh token seketika, namun JWT yang sudah terbit tetap valid sampai masa alaminya habis (dimitigasi dengan masa aktif JWT 15 menit).

### 3. Supabase Realtime Postgres Changes & RLS pada Event DELETE
* **Dokumentasi Resmi:** Supabase Realtime Guides — Postgres Changes
* **URL:** `https://supabase.com/docs/guides/realtime/postgres-changes`
* **Kutipan Kunci:**
  > *"Realtime respects PostgreSQL Row Level Security (RLS) policies. For a client to receive a Realtime payload, the user must have permission to SELECT that row... However, RLS policies do not natively restrict DELETE payload broadcasts in the same way they do for SELECT queries because the record is already deleted. If a table has REPLICA IDENTITY FULL enabled, any client subscribed can potentially see the old column data of a deleted row."*
* **Keterangan:** Sesuai arahan F6, `REPLICA IDENTITY FULL` dilarang disetel pada tabel multi-tenant demi mencegah kebocoran data terhapus. Digunakan pendekatan soft-delete (`deleted_at`).

### 4. PostgreSQL Function Validation (`check_function_bodies`)
* **Dokumentasi Resmi:** PostgreSQL 16 Documentation — Client Connection Defaults
* **URL:** `https://www.postgresql.org/docs/current/runtime-config-client.html`
* **Kutipan Kunci:**
  > *"check_function_bodies (boolean): When on (which is the default), validation of the function body string is performed during CREATE FUNCTION... if the function references objects that do not exist yet, PostgreSQL throws an error immediately."*
* **Keterangan:** Membuktikan bahwa helper function `current_app_user_id()` tidak bisa dibuat pada migrasi 015 sebelum kolom `users.auth_user_id` dibuat pada migrasi 016.

### 5. Android Exact Alarm Permissions (`USE_EXACT_ALARM` vs `SCHEDULE_EXACT_ALARM`)
* **Dokumentasi Resmi:** Android Developers — Schedule exact alarms
* **URL:** `https://developer.android.com/about/versions/14/changes/schedule-exact-alarms` & `https://developer.android.com/reference/android/Manifest.permission#USE_EXACT_ALARM`
* **Kutipan Kunci:**
  > *"USE_EXACT_ALARM is a normal permission that is granted automatically at installation time and cannot be revoked by the user... Apps published on Google Play that use USE_EXACT_ALARM without qualifying will be rejected during review."*
* **Keterangan:** Karena Jarvis mobile didistribusikan via sideload APK mandiri (non-Play Store), aplikasi dapat menggunakan `USE_EXACT_ALARM` secara legal untuk memperoleh izin alarm presisi seketika saat instalasi.

### 6. Apple AlarmKit Framework (iOS 26+)
* **Dokumentasi Resmi:** Apple Developer Documentation — AlarmKit
* **URL:** `https://developer.apple.com/documentation/alarmkit`
* **Kutipan Kunci:**
  > *"AlarmKit enables developers to schedule system-level alarms and countdown timers... Entitlement Requirement: Similar to CallKit, AlarmKit requires a special entitlement from Apple for production usage (developer.apple.com/contact/request/alarmkit)."*
* **Keterangan:** Mengoreksi klaim absolut ketiadaan API alarm di iOS; Apple kini menyediakan AlarmKit, namun membutuhkan iOS 26+, akun berbayar $99/thn, dan persetujuan entitlement manual. Platform iOS dinyatakan Out of Scope untuk V3.0.

### 7. Express 5 Wildcard Routing & Path-To-Regexp v8
* **Dokumentasi Resmi:** Express.js 5.0 Migration Guide & path-to-regexp v8 documentation
* **URL:** `https://expressjs.com/en/guide/migrating-5.html` & `https://github.com/pillarjs/path-to-regexp`
* **Kutipan Kunci:**
  > *"Unnamed wildcards (like * or /*) are no longer allowed in Express 5. Trying to use them will cause Express to throw a startup error (TypeError: Missing parameter name). All wildcards must be explicitly named, such as /{*splat}."*
* **Keterangan:** Membuktikan bahwa sintaks `app.get('*')` harus diganti dengan `app.all('/{*splat}')` atau `app.get('/{*splat}')`.

---

# LAMPIRAN H — TABEL TRACEABILITY F1-F19 & D1-D5

Tabel pelacakan pemenuhan seluruh butir persyaratan dan keputusan final:

| ID Butir | Topik Persyaratan / Keputusan | Status | Nomor Section di PRD Final |
|---|---|---|---|
| **D1** | Quiet Hours Opsi X (Bypass untuk semua reminder, jam tenang hanya proaktif) | **DONE** | Sec 33, 35, 38, 39, Lampiran B |
| **D2** | Identitas Opsi K (Kanonik satu baris users per orang, mapping user_channels) | **DONE** | Sec 11, 12, 13, 16, Lampiran B |
| **D3** | Revokasi Sesi Hibrida (session_id JWT, delete auth.sessions, admin.signOut) | **DONE** | Sec 12, 14, Lampiran B, Lampiran G |
| **D4** | Push Sender FCM Admin SDK (Token mentah, silent sync, sideload APK) | **DONE** | Sec 14, 20, 21, Lampiran B |
| **D5** | Retensi Teks Notifikasi Zero Retention (Tanpa staging teks mentah) | **DONE** | Sec 43, 44, 46, 49, Lampiran B |
| **F1** | Pemisahan status device (ACTIVE/REVOKED) dan status push (OK/INVALID) | **DONE** | Sec 14 |
| **F2** | Poller & Lifecycle `reminder_deliveries`, unique slot, poller transaksi, ACK | **DONE** | Sec 33, 34, 35 |
| **F3** | Pembersihan `user_devices`, UUID instalasi, transfer kepemilikan | **DONE** | Sec 14 |
| **F4** | Phase 0-A Hotfix Keamanan V2 (HMAC Meta, shared secret port 5001, fix regex owner) | **DONE** | Phase 0-A, Sec 6, 7 |
| **F5** | Finance capture: single dedupe_key, device masking, DDL events & sources | **DONE** | Sec 43, 44, 45, 46, 49, 89 |
| **F6** | Realtime: Larangan REPLICA IDENTITY FULL pada multi-tenant, prefer soft delete | **DONE** | Sec 88, 89, Lampiran C, Lampiran G |
| **F7** | RLS hardening: REVOKE PUBLIC fungsi, aturan permanen tabel baru, whitelist | **DONE** | Sec 88, Lampiran C, Lampiran D |
| **F8** | Sec 25 diisi: Matriks izin Android sideload, mitigasi Doze/FCM, iOS AlarmKit | **DONE** | Sec 20, 25, Lampiran G |
| **F9** | Spesifikasi tool `create_reminder` di aiDirectService.js (target_channels NULL) | **DONE** | Sec 33, 34, 90 |
| **F10** | Offline sync: DDL `client_operations`, optimistic locking `version INT`, expo-sqlite | **DONE** | Sec 81, 82 |
| **F11** | Roadmap dependensi graf, de-eskalasi label kritis, penyesuaian Phase 9 | **DONE** | Sec 5, 65, 100 |
| **F12** | Personality: pemisahan `response_style` & `response_length`, DDL `user_preferences` | **DONE** | Sec 60, 62, 63 |
| **F13** | Sec 16 diisi: Alur penautan Discord OAuth, WA !link inbound, migrasi kanonik | **DONE** | Sec 16 |
| **F14** | Resolusi preferensi notifikasi, mapping runtime 'BOTH', event_type konsisten | **DONE** | Sec 33, 40, 91 |
| **F15** | Katalog route lengkap satu sumber kebenaran (termasuk X-Min-App-Version 426) | **DONE** | Sec 7, 93, Lampiran F |
| **F16** | Kebersihan teks: zona waktu UTC/WIB, penghapusan istilah usang terlarang | **DONE** | Seluruh dokumen PRD Final |
| **F17** | Konsistensi DDL seluruh dokumen dan urutan migrasi logis | **DONE** | Sec 14, 16, 34, 35, 45, 46, 63, 82, 88, 89, Lampiran E |
| **F18** | Penerapan D1-D5 di seluruh section normatif terkait | **DONE** | Sec 12, 16, 20, 33, 43, 44 |
| **F19** | Spesifikasi Express 5, raw body webhook, SPA catch-all 404, build step | **DONE** | Sec 6, Lampiran G |
