# 🤖 Jarvis / Amba V2 — Personal AI Agent & Discord Assistant

[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-green.svg)](https://nodejs.org/)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2.svg)](https://discord.js.org/)
[![n8n](https://img.shields.io/badge/n8n-Workflow_Automation-EA4B71.svg)](https://n8n.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_Alpine-336791.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-All--in--One_Compose-2496ED.svg)](https://www.docker.com/)
[![Creator](https://img.shields.io/badge/Creator-kicenzeus-orange.svg)](https://github.com/kicenzeus)

**Jarvis / Amba V2** adalah *Autonomous Personal AI Assistant* serba bisa berbasis Discord yang mengintegrasikan alur otomatisasi **n8n**, database relasional **PostgreSQL**, dan orkestrasi bot **Node.js** dalam arsitektur kontainer **Docker All-in-One**.

Dirancang oleh **kicenzeus** untuk mengubah interaksi asisten dari sekadar chatbot biasa menjadi **agen AI proaktif** yang memiliki memori jangka panjang, pemahaman multi-modal (suara & teks), mesin pencarian intelijen web, wawasan analitik personal, serta sistem keamanan *Role-Based Access Control* (RBAC) berstandar enterprise.

---

## ✨ Fitur Utama (Phase 0 — Phase 8)

### 🧠 1. Memori Cerdas Jangka Panjang (Memory System V2)
- **Konteks Percakapan:** Memahami referensi lanjutan dan topik obrolan sebelumnya secara mulus.
- **Memori Eksplisit:** Menyimpan preferensi, profil, alergi, atau catatan penting (*"Amba ingat gue ga suka makanan pedas"*).
- **Inspeksi & Manajemen:** Tinjau dan kelola ingatan tersimpan lewat kartu `!memories` atau `!forget <topik>`.

### 🤖 2. Tool & Autonomous Agent System + High-Risk Guard
- **Pemilihan Tool Otomatis:** Memilih dan mengeksekusi aksi pembuatan tugas, catatan, transaksi keuangan, atau pengingat secara mandiri.
- **Konfirmasi 2 Langkah:** Mencegah kesalahan fatal dengan konfirmasi otomatis untuk aksi destruktif atau reset massal.
- **Transparansi Eksekusi:** Setiap proses terekam dalam lifecycle `agent_runs` dan `tool_calls`.

### ⏰ 3. Asisten Proaktif & Pengingat Berulang
- **Daily Briefing (Pagi):** Sapaan dan rangkuman agenda otomatis sebelum memulai hari (`!briefing`).
- **Daily Recap (Malam):** Evaluasi tugas selesai dan catatan pengeluaran harian (`!recap`).
- **Sistem Snooze:** Tunda pengingat yang berbunyi semudah mengetik `!snooze 15`.
- **Pengingat Berulang:** Mendukung jadwal harian, mingguan, maupun bulanan.

### 🎙️ 4. Advanced Multi-Modal Voice & Personality
- **Voice Notes (Pesan Suara):** Transkripsi otomatis pesan suara Discord dan respons balik berupa teks, suara, atau keduanya.
- **Voice Channel (Ruang Suara):** Panggil Amba ke room suara (`amba join vc`) untuk ngobrol langsung via mikrofon.
- **Interupsi Cepat:** Katakan *"Stop"* atau ketik `!diam` saat bot sedang berbicara untuk menghentikan audio seketika.
- **Kustomisasi Karakter:** Pilihan suara (Pria/Wanita, Indonesia/English) dan kecepatan bicara (`!voice`).

### 🌐 5. Web Intelligence Engine
- **Cuaca Real-Time:** Prakiraan cuaca akurat di berbagai kota tanpa API key berbayar (`!cuaca <kota>` atau tanya alami).
- **Pencarian Web Faktual:** Menggali berita, harga gadget, dan fakta terkini langsung dari internet (`!search <kueri>`).
- **Ekstraksi Artikel Web:** Kirimkan URL link artikel, Amba otomatis membaca dan merangkum intisarinya (`!baca <link>`).

### 📊 6. Personal Analytics & Insights
- **Executive Analytics Dashboard (`!analytics`):** Rangkuman visual arus kas keuangan, rasio penyelesaian tugas, dan keandalan agenda.
- **Skor Produktivitas:** Evaluasi komposit (0–100, Grade A+/A/B/C) lengkap dengan progress bar ASCII (`[████████░░] 80%`).
- **Percakapan Analitis Alami:** Tanyakan performa secara santai (*"Pengeluaran gue bulan ini paling banyak apa ya?"*).

### 🛡️ 7. Keamanan & Perizinan (RBAC 5-Tingkat)
- **Role Hierarchy:** Tingkatan hak akses terstruktur (`OWNER` > `ADMIN` > `USER` > `GUEST` > `BLOCKED`).
- **Credential Sanitizer:** Sensor otomatis untuk token Discord, API key OpenAI/Gemini/Groq, dan string password database dari seluruh chat, log, dan suara TTS.
- **Audit Logging:** Jejak aktivitas keamanan dan pemanggilan tool tersimpan di tabel `audit_logs` (`!audit`).

### 🩺 8. Keandalan, Observabilitas & Auto-Backup
- **Diagnostik Sistem Real-Time (`!ping` / `!health` / `!status`):** Menampilkan latensi Discord WS, PostgreSQL DB (~6ms), n8n Gateway, konsumsi RAM, dan bot uptime.
- **HTTP Health Check:** Endpoint `GET /health` di port 5001 siap integrasi dengan Docker Healthcheck atau monitor eksternal.
- **Bounded Retry:** Perlindungan timeout dan retry otomatis (maks 2x backoff) tanpa risiko *infinite loop*.
- **Graceful Shutdown & Snapshot Backup:** Penutupan koneksi aman saat shutdown dan utilitas backup database instan (`backups/backup-db.bat`).

### 🎵 9. High-Fidelity Music Player
- Memutar audio kualitas tinggi dari YouTube dan SoundCloud (`!play`, `!pause`, `!resume`, `!skip`, `!stop`, `!queue`, `!vol`).

---

## 🚀 Panduan Memulai Cepat (Quick Start)

### 1. Kebutuhan Sistem
- [Docker](https://www.docker.com/) & Docker Compose terpasang di sistem.
- Token Bot Discord dari [Discord Developer Portal](https://discord.com/developers/applications) (aktifkan *Message Content Intent*).

### 2. Kloning Repositori
```bash
git clone https://github.com/kicenzeus/Jarvis.git
cd Jarvis
```

### 3. Konfigurasi Environment (`.env`)
Salin file template konfigurasi:
```bash
# Windows
copy discord-bot\.env.example discord-bot\.env

# Linux / macOS
cp discord-bot/.env.example discord-bot/.env
```
Buka file `discord-bot/.env` dan lengkapi nilai variabel wajib:
```env
DISCORD_TOKEN=your_actual_discord_bot_token_here
OWNER_DISCORD_ID=your_discord_user_id_here
N8N_WEBHOOK_URL=http://n8n:5678/webhook/jarvis-discord
```

### 4. Jalankan Jarvis
Jalankan seluruh layanan (PostgreSQL, n8n, dan Discord Bot) dalam 1 perintah:
```bash
# Jalankan container
docker compose up -d

# Atau gunakan batch file di Windows
start-jarvis.bat
```

Untuk memantau log bot:
```bash
docker compose logs -f bot
```

Untuk mematikan bot:
```bash
docker compose down

# Atau di Windows
stop-jarvis.bat
```

---

## 📁 Struktur Direktori Proyek

```text
Jarvis/
├── backups/                   # Utilitas snapshot cadangan database & restore
│   ├── backup-db.bat          # Script backup instan ke file .sql
│   └── restore-db.bat         # Script pemulihan database
├── discord-bot/               # Source code Discord Bot (Node.js runtime)
│   ├── agentService.js        # Autonomous agent, tool_calls, dan High-Risk Guard
│   ├── analyticsService.js    # Mesin analitik keuangan, tugas, dan produktivitas
│   ├── bot.js                 # Handler utama bot, event router, dan command parser
│   ├── db.js                  # Koneksi PostgreSQL pool
│   ├── healthService.js       # Diagnostik kesehatan sistem & latensi layanan
│   ├── helpEmbeds.js          # Generator UI Rich Embed Discord
│   ├── memoryService.js       # Short-term context & long-term explicit memories
│   ├── metricsService.js      # Penghitung metrik performa & observabilitas
│   ├── musicManager.js        # Audio player, antrean musik, dan stream controller
│   ├── proactiveService.js    # Scheduler briefing pagi, recap malam & snooze
│   ├── securityService.js     # RBAC 5-level, audit logs, dan credential sanitizer
│   ├── vcManager.js           # Discord Voice Channel manager, capture, & interupsi
│   ├── voicePreferenceService # Pengaturan karakter dan gaya bicara audio
│   ├── voiceService.js        # Audio STT, Edge-TTS audio synthesizer
│   ├── webIntelligenceService # Cuaca real-time, web factual search, URL extractor
│   ├── Dockerfile             # Docker packaging untuk node:20 runtime
│   └── .env.example           # Template konfigurasi bot aman
├── migrations/                # Database migrations berurutan (001 s/d 008)
├── docker-compose.yml         # Konfigurasi orkestrasi All-in-One Docker
├── USER_GUIDE.md              # Buku panduan lengkap operasional pengguna
├── start-jarvis.bat           # Shortcut satu klik menyalakan Jarvis di Windows
├── stop-jarvis.bat            # Shortcut mematikan Jarvis di Windows
├── .gitignore                 # Filter keamanan repositori (Anti-leak)
├── .env.example               # Template environment root
└── README.md                  # Dokumentasi proyek
```

---

## 📖 Dokumentasi Lengkap
Pelajari seluruh daftar perintah, contoh percakapan santai, dan tips penggunaan di [USER_GUIDE.md](file:///d:/Dev/project/n8n/Jarvis/USER_GUIDE.md).

---

## 👨‍💻 Creator & Developer
Dikembangkan dengan penuh dedikasi oleh **[kicenzeus](https://github.com/kicenzeus)**.
Distributed under the MIT License.
