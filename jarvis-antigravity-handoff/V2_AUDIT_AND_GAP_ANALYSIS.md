# 📊 AUDIT & GAP ANALYSIS — JARVIS V1 KE JARVIS V2
**Tanggal:** 15 Oktober 2026  
**Dokumen Referensi:** `JARVIS_V2_PRD.md` (Section 86 & 87: First Task for V2)  
**Status:** Mandatory Pre-Implementation Report (DO NOT CODE YET)  
**Author / Lead:** kicenzeus & Antigravity  

---

## 1. CURRENT STATE (Kondisi Nyata V1 Saat Ini)

Sistem Jarvis V1 telah selesai 100% dan beroperasi secara stabil di lingkungan lokal dengan rincian arsitektur:

### A. Infrastruktur & Runtime
- **Docker Compose:**
  - `jarvis-n8n`: port `5678:5678` (Workflow Automation & AI Orchestrator).
  - `jarvis-postgres`: PostgreSQL 16 Alpine, port host `5433` (internal `5432`), volume `jarvis_pgdata`.
- **Bot Daemon:** Node.js v24.21.0 (`discord-bot/bot.js`) login sebagai `Amba#2138`.
- **Komunikasi Internal:**
  - Ingress: Discord Message -> `bot.js` -> n8n Webhook (`POST /webhook/jarvis-discord`).
  - Egress Notification: n8n Cron Scheduler -> `POST http://host.docker.internal:5001/api/notify` -> `bot.js` (Pengiriman Reminder otomatis).

### B. Database Eksisting (Data Riil Tersimpan)
Telah diaudit langsung pada container PostgreSQL `jarvis-postgres`:
1. `users`: 2 data pengguna aktif (menyimpan `discord_user_id`, `callsign`, `reminder_style`, `timezone`).
2. `tasks`: 7 tugas aktif (`title`, `status`, `priority`, `due_at`).
3. `reminders`: 22 riwayat reminder (`title`, `remind_at`, `status`, `sent_at`).
4. `notes`: 2 catatan tersimpan (`title`, `content`, `category`).
5. `financial_transactions`: 4 transaksi keuangan (`kind`, `amount`, `category`, `occurred_at`).
*Catatan:* Seluruh 5 tabel sudah memiliki index dasar (`users_pkey`, `idx_tasks_user_status`, `idx_reminders_status_time`, `idx_notes_user_category`, `idx_finance_user_date`).

### C. Voice & Audio Pipeline
- **Voice Note STT:** Google Gemini 3 Flash multimodal audio buffer analysis.
- **Voice Note TTS:** MsEdgeTTS Indonesian Neural Voice (`id-ID-ArdiNeural`).
- **Live Voice Channel Assistant:** Menggunakan `@discordjs/voice`, Opus -> PCM -> FFmpeg -> WAV, debounced receiver stream, deteksi kata panggil "amba".
- **Pemutar Musik HD:** Engine mandiri `soundcloudService.js` (HLS m3u8 playlist decoding via FFmpeg PCM stereo 48kHz), auto-resolver link YouTube & Spotify via oEmbed, antrean (`!q`), kontrol playback (`!p`, `!s`, `!pause`, `!resume`, `!stop`, `!v`), dan auto-ducking/pause saat AI berbicara di VC.

---

## 2. DATABASE GAP (V1 Actual vs V2 Target)

Perbandingan antara skema aktual PostgreSQL saat ini dengan `# 73. FINAL V2 DATABASE MODEL`:

| Tabel V2 Target | Status di V1 | Gap / Perubahan yang Diperlukan |
| :--- | :--- | :--- |
| `users` | **Ada (Eksisting)** | Perlu penambahan kolom: `status` (ACTIVE/SUSPENDED), `role` (ADMIN/USER), dan default timezone validation. |
| `tasks` | **Ada (Eksisting)** | Struktur sudah memadai (`status`, `priority`, `due_at`), perlu penambahan `deleted_at` untuk soft-delete. |
| `reminders` | **Ada (Eksisting)** | Perlu penambahan kolom untuk proaktif V2: `repeat_rule` (CRON/DAILY/WEEKLY), `next_trigger_at`, `last_triggered_at`, `snooze_until`, `parent_reminder_id` (untuk follow-up chaining). |
| `notes` | **Ada (Eksisting)** | Struktur sudah memadai, perlu `deleted_at` jika soft-delete diaktifkan. |
| `transactions` / `financial_transactions` | **Ada (Eksisting)** | Di V1 bernama `financial_transactions`. Perlu alias/standardisasi atau penambahan field `payment_method` & `metadata`. |
| `conversations` | **BELUM ADA** | **Wajib dibuat di Phase 0/1:** Menyimpan riwayat dialog (`user_id`, `input_type`, `output_type`, `user_raw_input`, `agent_raw_output`, `metadata`, `created_at`). |
| `memories` | **BELUM ADA** | **Wajib dibuat di Phase 1:** Menyimpan memori jangka panjang (`user_id`, `type`, `key`, `value`, `importance`, `source`, `status`, `expires_at`). |
| `agent_runs` | **BELUM ADA** | **Wajib dibuat di Phase 2:** Log eksekusi agent otonom (`id`, `user_id`, `conversation_id`, `intent`, `plan`, `status`, `duration_ms`). |
| `tool_calls` | **BELUM ADA** | **Wajib dibuat di Phase 2:** Log pemanggilan tool (`id`, `agent_run_id`, `tool_name`, `input_payload`, `output_payload`, `status`). |
| `user_voice_preferences` | **BELUM ADA** | **Dibuat di Phase 4:** Menyimpan voice pitch, speed, voice model preferensi pengguna. |
| `audit_logs` | **BELUM ADA** | **Dibuat di Phase 7:** Audit keamanan dan eksekusi instruksi kritis. |

---

## 3. ARCHITECTURE GAP

### A. Pola Eksekusi AI (Direct SQL vs Tool Service Boundary)
- **Kondisi V1:** n8n AI Agent mengeksekusi query SQL mentah (*raw SQL execution*) langsung ke PostgreSQL melalui single tool `Postgres`.
- **Kebutuhan V2 (Section 78):**
  - AI tidak boleh langsung menjalankan query SQL bebas tanpa batasan.
  - Harus ada **Service Boundary Layer**:
    ```text
    AI Agent -> Tool Definition (Task Tool, Memory Tool, Finance Tool) -> Validated Service -> Database Query
    ```
  - Mencegah SQL injection tidak sengaja atau halusinasi query yang merusak struktur data.

### B. Single Intent vs Multi-Step Intent
- **Kondisi V1:** Satu pesan hanya memproses satu aksi dominan (misal: hanya catat reminder atau hanya catat task).
- **Kebutuhan V2:** Mampu menangani multi-intent dalam satu kalimat (misal: *"Amba, catat pengeluaran 50rb buat makan siang, terus ingetin jam 3 sore gue ada meeting sama klien"*).

### C. Context Memory
- **Kondisi V1:** Menggunakan `Window Buffer Memory` (hanya mengingat 10 chat terakhir di sesi berjalan, hilang saat server restart).
- **Kebutuhan V2:** Hybrid Memory:
  - Short-Term: Buffer percakapan aktif dari tabel `conversations`.
  - Long-Term: Semantic & preference memory dari tabel `memories`.

---

## 4. FEATURE GAP

1. **Explicit & Implicit Memory:** Di V1 belum bisa *"Ingat kalau gue alergi udang"* dan kemudian otomatis diingat di percakapan seminggu kemudian.
2. **Proactive Reminders & Follow-Up Chaining:** Di V1 pengingat hanya satu kali tembak (`sent`). Di V2 ada kemampuan: jika belum dikonfirmasi selesai, ingatkan kembali 1 jam kemudian (`parent_reminder_id` & `snooze_until`).
3. **Web Intelligence:** Di V1 bot belum bisa mencari info real-time di web (cuaca, berita terkini, kurs).
4. **Personal Analytics:** Di V1 belum ada generator laporan mingguan otomatis (rekap produktivitas dan keuangan).

---

## 5. SECURITY GAP

1. **Authorization Boundary:**
   - Di V1 baru menggunakan `ALLOWED_USER_IDS` di Discord Bot level.
   - Di V2 wajib dipastikan setiap baris database memiliki row-level context user (`user_id = auth_user_id`).
2. **Audit Logging:**
   - Di V1 belum ada pencatatan siapa mengubah apa dan kapan pada level sistem. Di V2 diperlukan tabel `audit_logs`.
3. **Safe Credentials:**
   - Semua token sudah berada di `.env` dan diabaikan git (sudah aman). Perlu dipertahankan.

---

## 6. MIGRATION PLAN (Strategi Migrasi Aman & Berurutan)

Sesuai aturan ketat Section 76 PRD V2: **Data V1 TIDAK BOLEH HILANG**.

### Mekanisme Migrasi:
1. **Direktori Migrasi:** Dibuat folder `migrations/` di root proyek:
   - `001_foundation_v2.sql` (Phase 0: penambahan kolom users, reminders, index baru, tabel `conversations`).
   - `002_memory_system.sql` (Phase 1: tabel `memories`).
   - `003_agent_and_tools.sql` (Phase 2: tabel `agent_runs`, `tool_calls`).
   - `004_proactive_system.sql` (Phase 3: repeat rules, parent reminders).
   - `005_voice_preferences.sql` (Phase 4).
   - `006_audit_security.sql` (Phase 7).
2. **Snapshot & Backup Mandatori:**
   - Sebelum menjalankan migrasi apa pun, jalankan perintah backup otomatis:
     `pg_dump -U jarvis jarvis > backups/backup_v1_pre_migration.sql`
3. **Rollback Script:**
   - Setiap file migrasi wajib memiliki script rollback berpasangan (misal: `001_foundation_v2_down.sql`).

---

## 7. PHASE 0 IMPLEMENTATION PLAN (Fondasi V2)

Fokus Phase 0 adalah **mempersiapkan pondasi tanpa merubah fungsionalitas V1**:

1. **Langkah 1 (Backup):** Buat direktori `backups/` dan backup database V1 aktif saat ini.
2. **Langkah 2 (Migrations Setup):** Buat direktori `migrations/` dengan runner script yang idempoten (`IF NOT EXISTS`).
3. **Langkah 3 (Migration 001 — Foundation):**
   - Tambahkan kolom `status` (DEFAULT 'ACTIVE') dan `role` (DEFAULT 'USER') ke tabel `users`.
   - Tambahkan kolom `repeat_rule`, `next_trigger_at`, `last_triggered_at`, `snooze_until`, `parent_reminder_id` ke tabel `reminders`.
   - Buat tabel `conversations` untuk menyimpan riwayat input/output interaksi (Discord/Voice/System).
   - Tambahkan missing index penting: `idx_tasks_due_at`, `idx_reminders_user_time`, `idx_conversations_user_created`.
4. **Langkah 4 (Verification & V1 Test):**
   - Jalankan uji verifikasi: pastikan chat V1, reminder V1, musik V1, dan voice channel V1 tetap bekerja normal 100% tanpa gangguan.

---

## 8. RISKS & MITIGATION

| Risiko | Dampak | Strategi Mitigasi |
| :--- | :--- | :--- |
| **Data Loss pada Migrasi DB** | Kritis | Wajib snapshot `pg_dump` sebelum eksekusi SQL; gunakan `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. |
| **Downtime pada Bot Discord** | Sedang | Migrasi schema tidak mengunci tabel (*non-blocking* DDL di PostgreSQL 16). |
| **Breaking Change pada n8n Workflow** | Tinggi | Kolom-kolom lama V1 tidak diubah namanya. Workflow V1 tetap membaca kolom `users.callsign` dan `reminders.remind_at` seperti biasa. |
| **Memory / CPU Spikes saat Agent Runs** | Sedang | Batasi konkurensi dan gunakan memory cleanup yang sudah terbukti di Phase 4 & 5. |

---

### KESIMPULAN AUDIT:
Fondasi sistem V1 sangat sehat, bersih, dan siap untuk dinaikkan ke arsitektur V2.
Setelah laporan ini disetujui, kita siap melangkah ke **Phase 0 (Foundation & Database Migration)**.
