# PRD — JARVIS V2.1
# WHATSAPP INTEGRATION

**Project:** Jarvis / Amba  
**Version:** V2.1  
**Type:** Channel Integration / Platform Expansion  
**Base:** Jarvis V2 Stable  
**Primary Existing Channel:** Discord  
**New Channel:** WhatsApp  
**Automation Layer:** n8n  
**Bot / Gateway Runtime:** Node.js + discord.js (existing)  
**Default Timezone:** Asia/Jakarta  
**Primary Language:** Bahasa Indonesia  
**Status:** Planned

---

# 1. EXECUTIVE SUMMARY

Jarvis V2.1 menambahkan **WhatsApp sebagai channel resmi kedua** untuk Jarvis.

Tujuan utama V2.1 bukan membuat "Jarvis WhatsApp" yang terpisah, melainkan menambahkan **channel adapter WhatsApp** ke Jarvis Core V2 yang sudah stabil.

Target arsitektur:

```text
Discord ────────┐
                │
WhatsApp ───────┼──→ Channel Layer → Jarvis Core V2
                │                         │
Voice / Future ─┘                         ├── AI
                                          ├── Memory
                                          ├── Tools
                                          ├── Tasks
                                          ├── Reminders
                                          └── Database
```

Prinsip terpenting:

> **WhatsApp hanya menjadi interface/channel baru. Business logic tetap berada di Jarvis Core.**

Dengan demikian:

- logic AI tidak diduplikasi
- memory tetap satu
- task tetap satu
- reminder tetap satu
- finance tetap satu
- database tetap satu
- Discord tetap berfungsi
- WhatsApp hanya menjadi adapter tambahan

---

# 2. TARGET PLATFORM

Integrasi resmi yang menjadi target implementasi adalah **WhatsApp Business Platform / WhatsApp Cloud API** melalui Meta.

n8n menyediakan:

- **WhatsApp Trigger** untuk menerima event WhatsApp
- **WhatsApp Business Cloud** untuk mengirim pesan dan berinteraksi dengan resource WhatsApp

Referensi resmi:

- n8n WhatsApp Trigger:  
  https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.whatsapptrigger/
- n8n WhatsApp Business Cloud credentials:  
  https://docs.n8n.io/integrations/builtin/credentials/whatsapp/
- Meta WhatsApp API:  
  https://developers.facebook.com/docs/whatsapp/cloud-api

Catatan:
Implementasi harus mengikuti dokumentasi Meta/n8n yang berlaku pada saat deployment. Jangan hard-code asumsi terhadap UI Meta karena dashboard dan persyaratan dapat berubah.

---

# 3. V2.1 OBJECTIVES

## 3.1 Primary Objectives

1. Menambahkan WhatsApp sebagai input/output channel.
2. Mempertahankan seluruh fitur Jarvis V2.
3. Membuat channel-neutral message contract.
4. Membuat satu identity model untuk multi-channel.
5. Memisahkan channel adapter dari business logic.
6. Memastikan memory dan tool dapat digunakan dari WhatsApp.
7. Mendukung text message terlebih dahulu.
8. Menyiapkan fondasi untuk media dan voice note.
9. Menambahkan logging, security, retry, dan observability.
10. Menjaga Discord tetap backward compatible.

---

# 4. NON-OBJECTIVES

V2.1 belum wajib mencakup:

- migrasi Discord
- mengganti n8n
- mengganti database utama
- membuat AI engine baru
- membuat memory engine baru
- membuat task engine baru
- WhatsApp calling
- WhatsApp group assistant sebagai fitur utama
- multi-tenant SaaS
- migrasi seluruh V2 menjadi cloud-native
- unofficial WhatsApp Web automation

Fokus V2.1:

> **Menambahkan WhatsApp sebagai channel resmi ke Jarvis Core.**

---

# 5. CHANNEL ARCHITECTURE

## 5.1 Existing V2

```text
Discord
   ↓
Discord Bot / Adapter
   ↓
Jarvis Core
   ↓
AI / Memory / Tools / Database
```

## 5.2 V2.1

```text
Discord
   ↓
Discord Adapter
   │
   ├───────────────┐
                   │
WhatsApp          ↓
   ↓          Channel Gateway
WhatsApp Adapter
   ↓
Jarvis Core
   ↓
AI / Memory / Tools / Database
```

---

# 6. CORE DESIGN RULE

Jangan membuat logic seperti:

```text
if discord:
    logic A

if whatsapp:
    logic B
```

untuk business logic utama.

Yang benar:

```text
Discord ──┐
          ├──→ Normalized Message → Jarvis Core
WhatsApp ─┘
```

Channel hanya bertanggung jawab terhadap:

- menerima event
- normalisasi message
- identity mapping
- attachment/media handling
- mengirim response kembali ke channel

Jarvis Core bertanggung jawab terhadap:

- intent
- memory
- AI
- tools
- task
- reminder
- finance
- response generation

---

# 7. PHASE ROADMAP

| Phase | Nama | Priority | Dependency |
|---|---|---:|---|
| Phase 0 | Architecture Audit & Channel Abstraction | Critical | V2 Stable |
| Phase 1 | Meta / WhatsApp Foundation | Critical | Phase 0 |
| Phase 2 | WhatsApp Text Messaging | Critical | Phase 1 |
| Phase 3 | Jarvis Core Integration | Critical | Phase 2 |
| Phase 4 | Unified Identity & Database Migration | Critical | Phase 3 |
| Phase 5 | Media & Voice Note | High | Phase 3 |
| Phase 6 | Proactive Messaging & Outbound Events | High | Phase 3 |
| Phase 7 | Security, Rate Limit & Policy | Critical | Phase 4 |
| Phase 8 | Reliability, Testing & Production | High | Semua phase |

---

# PHASE 0 — ARCHITECTURE AUDIT & CHANNEL ABSTRACTION

## 8. Tujuan

Memastikan Jarvis V2 dapat menerima lebih dari satu channel tanpa menduplikasi business logic.

## 9. Audit yang wajib dilakukan

Agent harus memeriksa:

- Discord listener
- n8n workflows
- Jarvis Core
- AI service
- tool router
- memory service
- conversation service
- response formatter
- database schema
- authentication / authorization
- logging
- error handling

## 10. Deliverable

Buat abstraction:

```text
Channel Adapter
```

Minimal interface konseptual:

```js
{
  channel: "DISCORD",
  externalUserId: "...",
  externalConversationId: "...",
  messageId: "...",
  inputType: "TEXT",
  content: "...",
  attachments: [],
  metadata: {}
}
```

WhatsApp menghasilkan object dengan contract yang sama.

## 11. Response Contract

Jarvis Core menghasilkan response channel-neutral:

```json
{
  "success": true,
  "conversationId": "...",
  "response": {
    "type": "TEXT",
    "text": "Siap, gue catat."
  },
  "metadata": {}
}
```

Channel adapter menentukan cara mengirimnya.

## 12. Acceptance Criteria

- [ ] Discord tetap bekerja.
- [ ] Core tidak bergantung langsung pada Discord-specific fields.
- [ ] Ada normalized inbound message.
- [ ] Ada normalized outbound response.
- [ ] WhatsApp dapat menggunakan contract yang sama.
- [ ] Tidak ada duplicated AI/tool business logic.

---

# PHASE 1 — META / WHATSAPP FOUNDATION

## 13. Tujuan

Menyiapkan aset Meta dan koneksi resmi WhatsApp Business Platform.

## 14. Prerequisite

Berdasarkan current n8n documentation, setup WhatsApp membutuhkan aset Meta seperti:

- Meta developer account
- Meta business portfolio
- business app yang dikonfigurasi dengan WhatsApp
- WhatsApp Business Account / phone assets sesuai setup Meta
- credentials untuk n8n

n8n mendukung credential WhatsApp Business Cloud dan WhatsApp Trigger.

## 15. Credential Separation

Credential WA tidak boleh berada di source code.

Minimal:

```text
WHATSAPP_ACCESS_TOKEN
WHATSAPP_BUSINESS_ACCOUNT_ID
META_APP_ID
META_APP_SECRET
```

Jika deployment menggunakan n8n credentials, gunakan n8n credential store untuk secret tersebut.

## 16. Webhook

WhatsApp inbound message harus masuk melalui official webhook/trigger.

Target:

```text
WhatsApp
↓
Meta Webhook
↓
n8n WhatsApp Trigger
↓
Channel Adapter
```

## 17. Test Requirement

Harus tersedia:

- test sender / phone
- test recipient
- test workflow
- production workflow strategy

## 18. n8n Webhook Rule

WhatsApp hanya mengizinkan satu registered webhook per app pada satu waktu. Switching antara testing dan production URL dapat mengganti webhook yang terdaftar.

Karena itu:

- jangan mengaktifkan beberapa workflow WhatsApp trigger secara sembarangan
- dokumentasikan workflow yang menjadi webhook owner
- bedakan testing dan production secara jelas

## 19. Acceptance Criteria

- [ ] Meta app siap.
- [ ] WhatsApp product siap.
- [ ] Credentials tersimpan aman.
- [ ] Webhook dapat diverifikasi.
- [ ] Pesan WhatsApp dapat diterima n8n.
- [ ] Test workflow terdokumentasi.
- [ ] Tidak ada credential di repository.

---

# PHASE 2 — WHATSAPP TEXT MESSAGING

## 20. Tujuan

Membuat WhatsApp dapat mengirim dan menerima text melalui Jarvis.

## 21. Inbound Flow

```text
WhatsApp User
↓
Meta / WhatsApp
↓
n8n WhatsApp Trigger
↓
WhatsApp Adapter
↓
Normalized Message
↓
Jarvis Core
```

## 22. Outbound Flow

```text
Jarvis Core
↓
Normalized Response
↓
WhatsApp Adapter
↓
WhatsApp Business Cloud
↓
WhatsApp User
```

## 23. Message Normalization

Contoh inbound:

```json
{
  "channel": "WHATSAPP",
  "externalUserId": "whatsapp-user-id",
  "externalConversationId": "whatsapp-conversation-id",
  "messageId": "message-id",
  "inputType": "TEXT",
  "content": "Amba, ingetin gue jam 8",
  "attachments": [],
  "metadata": {
    "phoneNumberId": "...",
    "timestamp": "..."
  }
}
```

## 24. Output

```json
{
  "success": true,
  "response": {
    "type": "TEXT",
    "text": "Siap. Gue ingetin jam 8 malam."
  }
}
```

## 25. Acceptance Criteria

- [ ] WhatsApp text diterima.
- [ ] Jarvis memahami message.
- [ ] memory dapat digunakan.
- [ ] tools dapat dipanggil.
- [ ] response diterima di WhatsApp.
- [ ] Discord tetap bekerja.
- [ ] message ID tercatat.
- [ ] error handling tersedia.

---

# PHASE 3 — WHATSAPP → JARVIS CORE INTEGRATION

## 26. Tujuan

Semua kemampuan V2 dapat digunakan dari WhatsApp.

## 27. Fitur yang WAJIB bisa diakses dari WhatsApp

### Conversation

> "Amba, lagi ngapain?"

### Memory

> "Ingat gue lebih suka jawaban singkat."

### Task

> "Catat gue harus revisi laporan."

### Reminder

> "Ingetin gue jam 8 bayar listrik."

### Finance

> "Gue keluar 30 ribu buat makan."

### Finance Query

> "Berapa pengeluaran gue minggu ini?"

### Agent

> "Cari task gue yang belum selesai lalu kasih reminder besok."

## 28. Rule

WhatsApp tidak boleh memiliki logic khusus yang berbeda dari Discord kecuali:

- format response
- media capability
- identity
- channel limitation

---

# PHASE 4 — UNIFIED IDENTITY & DATABASE MIGRATION

## 29. Tujuan

Mengubah model identity Jarvis dari:

```text
User = Discord User
```

menjadi:

```text
User = Person / Jarvis Account
```

yang dapat memiliki beberapa channel.

## 30. Masalah V2 yang harus diaudit

Jika V2 saat ini memiliki:

```text
users.discord_user_id
```

sebagai identity utama, jangan langsung menghapus field tersebut.

Buat migration bertahap.

---

# 31. RECOMMENDED DATABASE MODEL

## 31.1 `users`

Pertahankan:

```text
id
timezone
status
role
created_at
updated_at
```

`discord_user_id` tidak lagi menjadi identity utama jika sebelumnya berada langsung di users.

Jika tetap diperlukan untuk backward compatibility, boleh dipertahankan sementara dan ditandai sebagai legacy.

## 31.2 NEW TABLE — `user_channels`

Tambahkan:

```text
id
user_id
channel_type
external_user_id
external_conversation_id
display_name
phone_number
username
is_primary
status
metadata
created_at
updated_at
last_seen_at
```

### channel_type

```text
DISCORD
WHATSAPP
```

future:

```text
TELEGRAM
EMAIL
WEB
```

### status

```text
ACTIVE
INACTIVE
BLOCKED
PENDING
```

## 32. UNIQUE CONSTRAINT

Recommended:

```text
UNIQUE(channel_type, external_user_id)
```

Dengan demikian satu WhatsApp identity tidak dapat terhubung ke dua internal user secara tidak sengaja.

---

# 33. NEW TABLE — `channel_conversations`

Jika sistem V2 masih menganggap conversation hanya milik Discord, gunakan abstraction ini:

```text
id
user_id
channel_id
external_conversation_id
channel_type
created_at
updated_at
last_message_at
metadata
```

Relationship:

```text
users 1:N channel_conversations
user_channels 1:N channel_conversations
```

---

# 34. CONVERSATION MODEL

Existing `conversations` sebaiknya tetap menyimpan logic/core conversation.

Tambahkan:

```text
channel_conversation_id
input_type
output_type
```

jika belum ada.

Target:

```text
users
  ↓
user_channels
  ↓
channel_conversations
  ↓
conversations
```

---

# 35. ERD V2.1

```text
┌─────────────┐
│    users    │
└──────┬──────┘
       │
       ├──────────────< user_channels
       │                       │
       │                       └──── channel_type
       │
       ├──────────────< channel_conversations
       │                       │
       │                       └──── user_channel
       │
       ├──────────────< conversations
       │
       ├──────────────< memories
       ├──────────────< tasks
       ├──────────────< reminders
       ├──────────────< notes
       ├──────────────< transactions
       ├──────────────1 user_voice_preferences
       ├──────────────< agent_runs
       │                     │
       │                     └────< tool_calls
       │
       └──────────────< audit_logs
```

---

# 36. MIGRATION PLAN

Migration tidak boleh dilakukan dengan langsung mengganti identity.

Urutan:

```text
V2 Database
   ↓
Migration 001
Create user_channels
   ↓
Migration 002
Backfill Discord identities
   ↓
Migration 003
Create channel_conversations
   ↓
Migration 004
Backfill / map conversation channel
   ↓
Migration 005
Introduce channel-aware service
   ↓
Migration 006
Add WhatsApp identities
```

## 37. Backfill Discord

Untuk setiap user V2:

```text
users.id
↓
user_channels
channel_type = DISCORD
external_user_id = existing discord_user_id
```

Tidak boleh kehilangan mapping lama.

## 38. Acceptance Criteria

- [ ] Existing Discord users tetap teridentifikasi.
- [ ] WhatsApp user dapat dibuat/di-link.
- [ ] Satu user dapat memiliki Discord + WhatsApp.
- [ ] Memory tetap satu untuk user yang sama.
- [ ] Task tetap satu.
- [ ] Reminder tetap satu.
- [ ] Finance tetap satu.
- [ ] Tidak ada cross-user data leak.

---

# PHASE 5 — MEDIA & VOICE NOTE

## 39. Tujuan

Menambahkan media interaction melalui WhatsApp.

Prioritas:

1. image
2. audio / voice note
3. document

## 40. Media Flow

```text
WhatsApp
↓
Webhook
↓
Media Metadata
↓
Media Download
↓
Temporary Storage
↓
Processing
↓
Jarvis Core
```

## 41. Voice Note

Target:

```text
WhatsApp Voice Note
↓
Audio Download
↓
Speech-to-Text
↓
Jarvis Core
↓
Task / Memory / AI
↓
Response
```

## 42. Output

Support:

```text
TEXT
AUDIO
```

Berdasarkan request user atau default policy.

Contoh:

> "Balas pakai voice."

## 43. Privacy

Audio temporary file harus:

- memiliki TTL
- tidak disimpan permanen tanpa alasan
- tidak masuk log
- tidak dikirim ke provider yang tidak diperlukan

## 44. Acceptance Criteria

- [ ] text tetap bekerja.
- [ ] voice note dapat diterima.
- [ ] STT berjalan.
- [ ] transcript diproses Jarvis.
- [ ] user dapat menerima text response.
- [ ] user dapat menerima audio response jika didukung.
- [ ] temporary audio dibersihkan.

---

# PHASE 6 — PROACTIVE WHATSAPP MESSAGING

## 45. Tujuan

Memungkinkan Jarvis menghubungi user melalui WhatsApp secara proaktif untuk event yang relevan.

Contoh:

> "Reminder lo: bayar listrik sekarang."

## 46. Event Sources

- reminder
- task due
- daily briefing
- daily recap
- recurring schedule
- important system events

## 47. Channel Preference

User dapat menentukan:

```text
DISCORD
WHATSAPP
BOTH
```

atau future:

```text
AUTO
```

## 48. Database Change — `notification_preferences`

Tambahkan jika belum tersedia:

```text
id
user_id
event_type
channel_type
enabled
quiet_hours_start
quiet_hours_end
created_at
updated_at
```

Contoh:

```text
REMINDER → WHATSAPP
DAILY_BRIEFING → DISCORD
DAILY_RECAP → BOTH
```

## 49. Smart Routing

```text
Event
↓
Notification Policy
↓
Preferred Channel
↓
Channel Adapter
↓
Send
```

## 50. Acceptance Criteria

- [ ] reminder dapat dikirim ke WhatsApp.
- [ ] daily briefing dapat dikirim.
- [ ] user dapat memilih channel.
- [ ] quiet hours bekerja.
- [ ] retry bekerja.
- [ ] tidak duplicate message.

---

# PHASE 7 — SECURITY, RATE LIMIT & POLICY

## 51. Identity Security

WhatsApp identity harus diverifikasi dari event resmi platform.

Jangan gunakan hanya:

- display name
- phone display text
- username

Gunakan external identity ID yang diberikan platform.

## 52. Authorization

Sebelum menjalankan tool:

```text
Inbound User
↓
Resolve Internal User
↓
Check Status
↓
Check Permission
↓
Execute
```

## 53. Unknown User

Jika nomor/identity belum terdaftar:

Policy harus jelas:

```text
DENY
```

atau:

```text
PENDING / OWNER APPROVAL
```

Untuk single-user Jarvis, default yang direkomendasikan:

> hanya identity yang sudah di-whitelist yang dapat menjalankan private tools.

## 54. Rate Limit

Buat per-user limits untuk:

- AI request
- tool call
- media processing
- outbound message

## 55. Spam Protection

Detect:

- repeated identical message
- burst request
- workflow loop
- webhook retry duplication

## 56. Idempotency

WhatsApp inbound event dapat diproses lebih dari sekali karena retry/network behavior.

Simpan external message ID.

Target:

```text
UNIQUE(channel_type, external_message_id)
```

Tambahkan tabel jika diperlukan:

## `channel_messages`

```text
id
user_id
channel_type
external_message_id
external_conversation_id
direction
message_type
status
payload_hash
created_at
processed_at
```

### direction

```text
INBOUND
OUTBOUND
```

### status

```text
RECEIVED
PROCESSING
PROCESSED
FAILED
IGNORED
```

## 57. Acceptance Criteria

- [ ] duplicate inbound tidak menggandakan task.
- [ ] unauthorized user ditolak.
- [ ] rate limit tersedia.
- [ ] audit log tersedia.
- [ ] external ID disimpan.
- [ ] credential tidak bocor.

---

# PHASE 8 — RELIABILITY, TESTING & PRODUCTION

## 58. Tujuan

Membuat WhatsApp integration siap digunakan stabil.

## 59. Error Categories

Minimal:

```text
AUTH_ERROR
WEBHOOK_ERROR
INVALID_PAYLOAD
UNKNOWN_USER
RATE_LIMIT
AI_ERROR
TOOL_ERROR
MEDIA_ERROR
SEND_MESSAGE_ERROR
TIMEOUT
```

## 60. Retry Policy

Gunakan retry terbatas untuk error yang recoverable.

Jangan retry:

- invalid payload
- unauthorized user
- invalid credential
- destructive policy denial

## 61. Testing Matrix

### Inbound

- [ ] text
- [ ] duplicate event
- [ ] unknown user
- [ ] blocked user
- [ ] empty message
- [ ] malformed event

### Core

- [ ] chat
- [ ] memory
- [ ] task
- [ ] reminder
- [ ] finance
- [ ] tool call
- [ ] multi-step agent

### Outbound

- [ ] text
- [ ] media
- [ ] error
- [ ] retry
- [ ] duplicate prevention

### Cross-Channel

- [ ] Discord user → WhatsApp linked
- [ ] WhatsApp user → same memory
- [ ] reminder created on Discord → notify WhatsApp
- [ ] task created on WhatsApp → visible on Discord
- [ ] finance added on WhatsApp → appears in shared summary

---

# 62. PRODUCTION CHECKLIST

- [ ] Meta app ready
- [ ] WhatsApp Business assets ready
- [ ] credentials secured
- [ ] webhook production configured
- [ ] n8n workflow published
- [ ] Discord regression test passed
- [ ] database migration tested
- [ ] backup ready
- [ ] logs active
- [ ] alerting/monitoring available
- [ ] rate limit enabled
- [ ] unknown-user policy enabled
- [ ] idempotency tested
- [ ] outbound message tested
- [ ] rollback plan documented

---

# 63. DATABASE CHANGE SUMMARY

## Existing tables to review

### `users`

Potential changes:

```text
timezone
status
role
```

Do not remove existing Discord identifiers immediately.

### `conversations`

Potential additions:

```text
channel_conversation_id
input_type
output_type
metadata
```

### `reminders`

No WhatsApp-specific field should be added here.

Reminder remains channel-neutral.

Notification channel belongs to notification preference / delivery layer.

## New tables

### Required

```text
user_channels
channel_conversations
channel_messages
```

### Recommended

```text
notification_preferences
```

Existing V2 tables remain:

```text
users
conversations
memories
tasks
reminders
notes
transactions
user_voice_preferences
agent_runs
tool_calls
audit_logs
```

---

# 64. WHY `user_channels` IS REQUIRED

Tanpa abstraction ini:

```text
users.discord_user_id
```

akan membuat Jarvis terlalu Discord-centric.

Dengan:

```text
users
  ↓
user_channels
```

satu internal user dapat memiliki:

```text
DISCORD
WHATSAPP
future TELEGRAM
future EMAIL
future WEB
```

tanpa mengubah seluruh Jarvis Core.

---

# 65. MESSAGE MODEL

Semua inbound message harus dinormalisasi.

Recommended contract:

```json
{
  "channel": "WHATSAPP",
  "externalUserId": "...",
  "externalConversationId": "...",
  "externalMessageId": "...",
  "inputType": "TEXT",
  "content": "...",
  "attachments": [],
  "timestamp": "...",
  "metadata": {}
}
```

Discord juga harus dapat menghasilkan contract setara.

---

# 66. RESPONSE MODEL

```json
{
  "success": true,
  "response": {
    "type": "TEXT",
    "text": "Siap, gue catat."
  },
  "metadata": {
    "correlationId": "..."
  }
}
```

Possible response types:

```text
TEXT
IMAGE
AUDIO
DOCUMENT
REACTION
```

V2.1 minimal:

```text
TEXT
AUDIO
```

untuk future media/voice.

---

# 67. CHANNEL ADAPTER RESPONSIBILITY

## Discord Adapter

Bertanggung jawab atas:

- Discord events
- Discord message send
- Discord voice
- Discord-specific metadata

## WhatsApp Adapter

Bertanggung jawab atas:

- WhatsApp webhook
- WhatsApp message normalization
- WhatsApp media
- WhatsApp message send
- WhatsApp-specific metadata

## Tidak boleh

Channel adapter menjalankan:

- AI business logic
- database business rules
- finance calculations
- task rules
- memory reasoning

---

# 68. TARGET FINAL ARCHITECTURE

```text
                    CHANNELS
        ┌─────────────┼─────────────┐
        │             │             │
     Discord       WhatsApp      Future
        │             │           ...
        └─────────────┼─────────────┘
                      ↓
              CHANNEL ADAPTERS
                      ↓
             NORMALIZED MESSAGE
                      ↓
                JARVIS CORE
                      ↓
        ┌─────────────┼──────────────┐
        │             │              │
       AI           Memory          Agent
        │             │              │
        └─────────────┼──────────────┘
                      ↓
                    TOOLS
                      ↓
                  DATABASE
                      ↓
              RESPONSE BUILDER
                      ↓
               OUTPUT ROUTER
                      ↓
             CHANNEL ADAPTER
```

---

# 69. MIGRATION ORDER

Migration disarankan:

```text
V2 Stable
   ↓
Migration 001
Create user_channels
   ↓
Migration 002
Backfill Discord identities
   ↓
Migration 003
Create channel_conversations
   ↓
Migration 004
Create channel_messages
   ↓
Migration 005
Normalize conversation channel relation
   ↓
Migration 006
Notification preferences
   ↓
Migration 007
Enable WhatsApp identity
```

Setiap migration wajib memiliki:

- migration version
- up
- rollback strategy
- validation
- test

---

# 70. BACKWARD COMPATIBILITY STRATEGY

Jangan menghapus:

```text
discord_user_id
```

langsung dari `users`.

Strategy:

```text
Legacy Discord field
        ↓
Backfill user_channels
        ↓
Use channel abstraction
        ↓
Monitor
        ↓
Deprecate legacy field
        ↓
Remove only in future major migration
```

---

# 71. DEFINITION OF DONE

V2.1 dianggap selesai jika:

- WhatsApp resmi dapat menerima message.
- WhatsApp resmi dapat mengirim response.
- WhatsApp terhubung ke Jarvis Core yang sama.
- Memory shared dengan Discord untuk user yang sama.
- Task shared dengan Discord.
- Reminder shared dengan Discord.
- Finance shared dengan Discord.
- Identity abstraction tersedia.
- Duplicate webhook/event aman.
- Unauthorized user ditolak.
- Credentials aman.
- Discord tidak rusak.
- Database migration terdokumentasi.
- Testing matrix lulus.
- Production webhook documented.

---

# 72. V2.1 MASTER ACCEPTANCE SCENARIOS

## Scenario A — Chat dari WhatsApp

User:

> "Amba, halo."

Expected:

```text
WhatsApp
→ n8n
→ Jarvis Core
→ AI
→ WhatsApp response
```

## Scenario B — Task dari WhatsApp

User:

> "Catat besok revisi laporan."

Expected:

```text
WhatsApp
→ Agent
→ task.create
→ Database
→ Response
```

## Scenario C — Reminder dari Discord, Notification WhatsApp

User membuat reminder lewat Discord.

Reminder due.

Expected:

```text
Reminder Scheduler
→ Notification Policy
→ WhatsApp
→ User receives reminder
```

## Scenario D — Finance Cross Channel

User:

> "Gue keluar 50 ribu makan."

melalui WhatsApp.

Kemudian:

> "Rekap pengeluaran gue hari ini."

melalui Discord.

Expected:

> Data yang sama muncul.

## Scenario E — Shared Memory

User berkata di WhatsApp:

> "Ingat gue suka jawaban singkat."

Kemudian di Discord:

> "Amba, jelasin task gue."

Expected:

> Jarvis tetap menggunakan preference yang sama.

## Scenario F — Unknown User

Nomor WhatsApp belum terdaftar.

Expected:

```text
Access denied / pending approval
```

Tidak boleh bisa menjalankan private Jarvis tools.

---

# 73. RISKS

## Risk 1 — Meta Configuration

Meta setup dapat berubah.

Mitigation:

- ikuti current official documentation
- jangan bergantung pada screenshot lama
- simpan konfigurasi di documentation

## Risk 2 — Webhook Conflict

Satu app dapat memiliki keterbatasan pada webhook registration/testing.

Mitigation:

- satu workflow owner untuk production webhook
- testing procedure terdokumentasi
- gunakan environment separation bila diperlukan

## Risk 3 — Duplicate Events

Mitigation:

- external message ID
- idempotency
- unique constraint

## Risk 4 — WhatsApp-specific Logic Sprawl

Mitigation:

- normalized message contract
- channel adapter
- shared Jarvis Core

## Risk 5 — Identity Collision

Mitigation:

```text
channel_type + external_user_id
```

unik.

---

# 74. FIRST TASK FOR ANTIGRAVITY

Sebelum coding:

## DO NOT IMPLEMENT WHATSAPP YET.

Lakukan audit:

```text
1. Baca PRD V1.
2. Baca PRD V2.
3. Baca PRD V2.1 ini.
4. Inspect seluruh source code.
5. Inspect database schema aktual.
6. Inspect Discord adapter.
7. Inspect Jarvis Core.
8. Inspect n8n workflows.
9. Inspect conversation model.
10. Inspect memory.
11. Inspect agent/tool system.
12. Inspect notification system.
```

Kemudian buat:

```text
CURRENT ARCHITECTURE
CHANNEL DEPENDENCY AUDIT
DATABASE GAP ANALYSIS
IDENTITY GAP ANALYSIS
MESSAGE CONTRACT GAP
N8N GAP
WHATSAPP INFRASTRUCTURE GAP
SECURITY GAP
MIGRATION PLAN
IMPLEMENTATION PLAN
RISKS
```

## Setelah audit

JANGAN langsung mengerjakan semua phase.

Kerjakan:

```text
PHASE 0
↓
PHASE 1
↓
PHASE 2
```

satu per satu dan test setiap phase.

---

# 75. PROMPT BRIEF FOR DEVELOPMENT AGENT

Gunakan PRD ini sebagai spesifikasi produk.

Rules:

1. Jangan merusak V1/V2.
2. Jangan rewrite Jarvis Core jika tidak diperlukan.
3. Jangan membuat business logic khusus WhatsApp.
4. Buat channel abstraction.
5. Buat normalized inbound/outbound message contract.
6. Gunakan WhatsApp Business Platform resmi.
7. Credential wajib melalui secure secret storage / n8n credentials / environment variables.
8. Jangan hard-code access token.
9. Database migration harus reversible.
10. Backfill Discord identity sebelum mengubah identity model.
11. Gunakan idempotency untuk inbound message.
12. Tambahkan test untuk cross-channel behavior.
13. Jangan membuat duplicate AI/tool/memory engine untuk WhatsApp.
14. Dokumentasikan setiap architecture change.
15. Jangan lanjut ke phase berikutnya jika current phase belum verified.

---

# 76. OFFICIAL REFERENCES

n8n WhatsApp Trigger:
https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.whatsapptrigger/

n8n WhatsApp Business Cloud Credentials:
https://docs.n8n.io/integrations/builtin/credentials/whatsapp/

Meta WhatsApp Cloud API:
https://developers.facebook.com/docs/whatsapp/cloud-api

---

# 77. FINAL PRINCIPLE

V2.1 bukan proyek baru.

V2.1 adalah:

> **Menambahkan WhatsApp sebagai channel resmi ke Jarvis Core V2 tanpa menduplikasi intelligence, memory, tools, task, reminder, finance, dan database.**

Target arsitektur:

```text
WhatsApp
   ↓
Channel Adapter
   ↓
Normalized Message
   ↓
Jarvis Core V2
   ↓
AI + Memory + Agent + Tools
   ↓
Normalized Response
   ↓
WhatsApp Adapter
   ↓
WhatsApp
```

Discord tetap berjalan berdampingan:

```text
Discord ──→ Channel Adapter ──→ Jarvis Core
WhatsApp ─→ Channel Adapter ──→ Jarvis Core
```

**One Jarvis. Multiple Channels. One Shared Brain.**
