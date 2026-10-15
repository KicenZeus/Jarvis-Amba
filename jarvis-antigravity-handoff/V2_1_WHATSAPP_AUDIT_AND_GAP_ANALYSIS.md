# JARVIS V2.1 — WHATSAPP INTEGRATION
# ARCHITECTURE AUDIT & GAP ANALYSIS

**Project:** Jarvis / Amba  
**Version:** V2.1  
**Target:** Channel Integration & Platform Expansion (WhatsApp Official Cloud API)  
**Base:** Jarvis V2 Stable  
**Date:** 2026-10-15  
**Author:** Antigravity AI  

---

## 1. EXECUTIVE SUMMARY

Jarvis V2 telah mencapai status stabil (*Phase 0 - Phase 8 Complete*) dengan ekosistem Discord yang matang: Voice Channel dua arah, Pemutar Musik berkualitas tinggi, Memori Jangka Panjang, Multi-Step Agent, Asisten Proaktif, Analitik Finansial & Produktivitas, serta RBAC Security.

PRD V2.1 menetapkan tujuan untuk menambahkan **WhatsApp sebagai channel resmi kedua** ke dalam ekosistem Jarvis Core tanpa membuat "Jarvis WhatsApp" yang terpisah. 

Dokumen ini merupakan hasil audit komprehensif terhadap seluruh source code, database PostgreSQL, n8n workflow, dan arsitektur sistem Jarvis untuk memetakan kesiapan, *gap* teknis, serta rencana implementasi yang aman tanpa mengganggu Discord (*Zero Regression*).

---

## 2. CURRENT ARCHITECTURE (V2 STABLE)

```text
┌─────────────────────────────────────────────────────────────────┐
│                          DISCORD CLIENT                         │
│           (Text Channels, Voice Channels, Direct Messages)       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DISCORD BOT / ADAPTER LAYER                  │
│  - bot.js (Listener messageCreate & voiceReceiver)             │
│  - securityService.js (RBAC & Audit Log)                        │
│  - webIntelligenceService.js (Search, Weather, URL Extractor)   │
│  - memoryService.js (Short & Long-Term Memories)                │
│  - agentService.js (Lifecycle Agent Runs & Tool Calls)          │
│  - proactiveService.js (Daily Briefing & Recap Scheduler)       │
│  - musicManager.js & vcManager.js (Music Engine)                │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP POST
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     N8N AI AGENT GATEWAY                        │
│  - Webhook Node (/webhook/jarvis-discord)                       │
│  - AI Agent (Google Gemini Flash Lite + Memory Buffer)          │
│  - Postgres Tool (Direct SQL Execution on Jarvis DB)            │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     POSTGRESQL DATABASE (16 Tables)             │
│  users, tasks, reminders, notes, financial_transactions,        │
│  memories, agent_runs, tool_calls, audit_logs, user_roles,      │
│  user_voice_preferences, external_cache, daily_metrics,         │
│  proactive_logs, conversations, schema_migrations               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. CHANNEL DEPENDENCY AUDIT

Berdasarkan penelusuran terhadap seluruh codebase, ditemukan ketergantungan erat pada atribut spesifik Discord:

| Modul / Komponen | Ketergantungan Spesifik Discord Saat Ini | Dampak untuk Multi-Channel | Solusi Abstraksi (V2.1) |
|---|---|---|---|
| **Tabel `users`** | Kolom `discord_user_id` menjadi identitas tunggal eksternal. Kolom `id` sering kali sama dengan `discord_user_id`. | Pengguna WhatsApp tidak memiliki `discord_user_id` sehingga rawan duplikasi akun atau gagal relasi. | Buat tabel `user_channels` untuk memetakan `users.id` (internal) ke berbagai channel (`DISCORD`, `WHATSAPP`). |
| **Tabel `conversations`** | Kolom `channel_id` menyimpan Discord Channel Snowflake ID. | Tidak ada penanda apakah chat berasal dari Discord atau WhatsApp. | Tambahkan relasi ke `channel_conversations` atau flag `channel_type`. |
| **Tabel `reminders`** | Kolom `channel_id` menyimpan ID channel Discord tempat notifikasi harus dikirim. | Reminder hanya bisa dikirim ke channel Discord. | Tambahkan preferensi channel delivery (`notification_preferences`). |
| **`securityService.js`** | Mengambil role menggunakan query `WHERE discord_user_id = $1 OR id = $1`. | Pengguna WA baru tidak bisa dicek perizinannya dengan benar. | Cek role berbasis `users.id` yang di-resolve dari `user_channels`. |
| **`proactiveService.js`** | `briefing_channel_id` dikirim langsung ke Discord client (`client.channels.fetch`). | Daily Briefing & Recap tidak bisa dikirim ke nomor WhatsApp. | Sediakan router pengiriman multi-channel (Discord Webhook/Bot vs WhatsApp Cloud API). |
| **n8n Workflow Prompt** | System message n8n mengekspos: `Channel ID Discord: {{ $json.body.message.channelId }}`. | AI mengira semua interaksi selalu di Discord. | Gunakan normalized message: `channel: {{ $json.body.channel }}`. |

---

## 4. DATABASE GAP ANALYSIS

### Tabel Eksisting vs Tabel Baru V2.1

Saat ini database memiliki 16 tabel. Untuk mendukung multi-channel WhatsApp, diperlukan 4 tabel baru yang sudah dirancang pada PRD V2.1:

1. **`user_channels` (BARU - CRITICAL)**
   - **Tujuan**: Menghubungkan satu identitas orang (*Person*) ke beberapa platform komunikasi.
   - **Kolom Kunci**: `id`, `user_id`, `channel_type` (`DISCORD`, `WHATSAPP`), `external_user_id` (Discord ID / Nomor WhatsApp), `phone_number`, `display_name`, `is_primary`, `status` (`ACTIVE`, `BLOCKED`, `PENDING`), `metadata`.
   - **Constraint**: `UNIQUE(channel_type, external_user_id)`.

2. **`channel_conversations` (BARU - RECOMMENDED)**
   - **Tujuan**: Mengisolasi percakapan dan sesi per room/nomor/chat.
   - **Kolom Kunci**: `id`, `user_id`, `channel_type`, `external_conversation_id`, `last_message_at`.

3. **`channel_messages` (BARU - CRITICAL IDEMPOTENCY)**
   - **Tujuan**: Mencegah eksekusi ganda akibat retry webhook Meta WhatsApp.
   - **Kolom Kunci**: `id`, `channel_type`, `external_message_id`, `direction` (`INBOUND`/`OUTBOUND`), `status`, `payload_hash`.
   - **Constraint**: `UNIQUE(channel_type, external_message_id)`.

4. **`notification_preferences` (BARU - PHASE 6)**
   - **Tujuan**: Mengatur ke channel mana pengingat atau laporan dikirimkan (`DISCORD`, `WHATSAPP`, `BOTH`).
   - **Kolom Kunci**: `user_id`, `event_type`, `channel_type`, `quiet_hours_start`, `quiet_hours_end`.

---

## 5. IDENTITY GAP ANALYSIS

### Model Identitas Lama (V2):
$$\text{User} = \text{Discord User ID}$$

### Model Identitas Baru (V2.1):
```text
                  ┌────────────────┐
                  │   users (ID)   │
                  └───────┬────────┘
                          │ 1:N
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
┌───────────────┐                   ┌───────────────┐
│ user_channels │                   │ user_channels │
│ channel: DISCORD                  │ channel: WHATSAPP
│ id: 713137141072396370            │ id: 628123456789
└───────────────┘                   └───────────────┘
```

**Mekanisme Resolusi Identitas Inbound**:
1. Pesan masuk dari WhatsApp dengan nomor pengirim `628123456789`.
2. Sistem mencari di `user_channels WHERE channel_type = 'WHATSAPP' AND external_user_id = '628123456789'`.
3. Jika ditemukan, dapatkan `user_id` internal (misalnya milik `KicenZeus`).
4. Seluruh query `memories`, `tasks`, `reminders`, dan `financial_transactions` berjalan menggunakan `user_id` internal tersebut.
5. Jika belum ditemukan:
   - Status menjadi `UNKNOWN_USER`.
   - Jalankan kebijakan keamanan: Balas bahwa nomor belum terdaftar dan instruksikan linking akun atau hubungi Admin. Jangan izinkan akses tool database sensitif!

---

## 6. MESSAGE CONTRACT GAP (NORMALIZATION)

### Inbound Contract (Channel -> Core)
Format seragam yang dikirim ke n8n:
```json
{
  "schemaVersion": 2,
  "channel": "WHATSAPP",
  "internalUserId": "713137141072396370",
  "externalUserId": "628123456789",
  "externalConversationId": "628123456789",
  "externalMessageId": "wamid.HBgLMjY4...",
  "inputType": "TEXT",
  "content": "catat pengeluaran 25rb beli bensin",
  "attachments": [],
  "user": {
    "displayName": "Kicen",
    "preferredGreetingName": "Bos",
    "hasCustomCallsign": true
  },
  "timestamp": "2026-10-15T14:15:00.000Z"
}
```

### Outbound Contract (Core -> Channel)
Format respon yang dikembalikan AI:
```json
{
  "success": true,
  "channel": "WHATSAPP",
  "response": {
    "type": "TEXT",
    "text": "Siap, Bos! Pengeluaran Rp 25.000 untuk kategori Transportasi (beli bensin) sudah Amba catat. ⛽"
  },
  "metadata": {
    "agentRunId": 142
  }
}
```

---

## 7. N8N GAP ANALYSIS

1. **Webhook Endpoint**:
   - Webhook saat ini: `/webhook/jarvis-discord`.
   - Untuk WhatsApp: Kita bisa membuat webhook terpisah `/webhook/jarvis-whatsapp` atau menggunakan **WhatsApp Trigger node** bawaan n8n yang langsung menangani handshake `hub.verify_token` dari Meta.
2. **Text Formatting Filter**:
   - AI Gemini secara default merespons dengan Markdown Discord (`**teks tebal**`).
   - Di WhatsApp, format tebal adalah `*teks tebal*`.
   - Node sebelum mengirim balasan ke WhatsApp perlu konversi otomatis:
     `text.replace(/\*\*(.*?)\*\*/g, '*$1*')`.

---

## 8. WHATSAPP INFRASTRUCTURE GAP (META CLOUD API)

1. **Meta Assets**:
   - Membutuhkan Meta for Developers App (tipe Business).
   - Menyiapkan WhatsApp Business Account (WABA).
   - Menghasilkan **Permanent System User Access Token**.
   - Menyimpan `WHATSAPP_PHONE_NUMBER_ID` dan `WHATSAPP_ACCESS_TOKEN`.
2. **Webhook Verification**:
   - Meta mewajibkan endpoint publik HTTPS yang merespons `hub.challenge` saat pendaftaran webhook.
   - n8n node `WhatsApp Trigger` sudah otomatis menangani verifikasi `hub.challenge` jika diberikan Verify Token yang sesuai.
3. **Public URL / Tunnel**:
   - Jika deployment lokal: Butuh Cloudflare Tunnel / Ngrok untuk meneruskan webhook Meta ke n8n (`localhost:5678`).

---

## 9. SECURITY & RATE LIMIT GAP

1. **Nomor Tak Dikenal (Spam Protection)**:
   - Di Discord, bot dibatasi oleh keanggotaan server atau role.
   - Di WhatsApp, siapa pun yang tahu nomor bot bisa mengirim chat.
   - **Proteksi Wajib**:
     - Mode Whitelist: Bot hanya melayani nomor WhatsApp yang sudah didaftarkan/di-link oleh Owner.
     - Nomor asing diberi respon ramah bahwa akun belum diotorisasi.
2. **Idempotency**:
   - Menyimpan `external_message_id` di `channel_messages` dengan constraint `UNIQUE`.
   - Jika Meta mengirimkan webhook berulang untuk pesan yang sama, sistem langsung mendeteksinya dan tidak memproses ulang.

---

## 10. MIGRATION PLAN (DATABASE)

Migrasi database dibuat modular sesuai konvensi `migrations/` yang ada:
- File migrasi: `migrations/009_channel_abstraction_and_identity.sql`
- File rollback: `migrations/009_channel_abstraction_and_identity_down.sql`
- Eksekusi: Melalui script migrator `migrations/migrate.js`.
- **Data Backfill**: Seluruh data pengguna Discord yang sudah ada di tabel `users` otomatis di-insert ke `user_channels` sebagai `DISCORD` dan `is_primary = TRUE`.
- **Zero Downtime**: Discord tetap berjalan normal tanpa gangguan selama dan sesudah migrasi.

---

## 11. STEP-BY-STEP IMPLEMENTATION ROADMAP

| Phase | Milestone | Fokus Pekerjaan |
|---|---|---|
| **Phase 0** | **Architecture Audit & Abstraction** | - Dokumen Audit (Selesai).<br>- Pembuatan helper Channel Adapter & Message Normalizer contract. |
| **Phase 4 (Diangkat Awal)** | **Unified Identity & Database Migration** | - Migrasi SQL `009_channel_abstraction_and_identity.sql`.<br>- Backfill akun Discord ke `user_channels`. |
| **Phase 1** | **Meta / WhatsApp Foundation** | - Setup credentials & WhatsApp Trigger di n8n.<br>- Konfigurasi Verify Token & webhook Meta. |
| **Phase 2 & 3** | **WhatsApp Text Messaging & Core Integration** | - Menerima chat WA -> n8n Core -> Database Tools -> Balas ke WhatsApp.<br>- Formatting Markdown adapter (Discord `**` vs WA `*`). |
| **Phase 5** | **Media & Voice Note** | - Transkripsi audio PTT WhatsApp via Gemini STT.<br>- Pengiriman audio/image response. |
| **Phase 6** | **Proactive Messaging & Outbound** | - Pengiriman Reminder dan Daily Briefing/Recap langsung ke WhatsApp. |
| **Phase 7 & 8** | **Security & Production Hardening** | - Whitelist nomor, Idempotency test, and comprehensive end-to-end verification. |

---

## 12. RISK MATRIX & MITIGATION

| Risiko | Tingkat | Dampak | Mitigasi |
|---|---|---|---|
| **Discord Terganggu saat Migrasi** | Tinggi | Bot Discord down atau salah baca user | Pertahankan kolom lama `discord_user_id` di `users` (*non-destructive*), lakukan *backfill* ke `user_channels`. |
| **Spam / Nomor Asing di WhatsApp** | Tinggi | Biaya token AI membengkak / kebocoran data | Kunci dengan kebijakan Whitelist di layer `channelAdapter`: tolak pesan jika nomor tidak terdaftar di `user_channels`. |
| **Pesan Ganda akibat Retry Meta** | Sedang | Task atau reminder terbuat 2 kali | Implementasikan tabel `channel_messages` dengan `UNIQUE(channel_type, external_message_id)`. |
| **Meta 24-Hour Messaging Window** | Sedang | Pesan pengingat tertunda di luar 24 jam | Gunakan Template Message Meta untuk reminder proaktif, atau fallback notifikasi ke Discord jika window tertutup. |

---
**Status Audit:** APPROVED & READY FOR PHASE 0 / PHASE 4 EXECUTION.
