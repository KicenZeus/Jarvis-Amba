# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# JARVIS / AMBA — VERSION 2.0

**Project Name:** Jarvis / Amba  
**Product Type:** Personal AI Assistant / AI Agent  
**Current Version:** V1 Stable  
**Target Version:** V2  
**Primary Interface:** Discord  
**Automation Layer:** n8n  
**Bot Runtime:** Node.js + discord.js  
**Language:** Bahasa Indonesia  
**Timezone Default:** Asia/Jakarta  
**Status:** Planned

---

# 1. OVERVIEW

Jarvis V2 adalah pengembangan lanjutan dari Jarvis V1 yang sudah memiliki fungsi dasar sebagai personal assistant.

V1 berfokus pada:

- Discord integration
- AI conversation
- task
- reminder
- notes
- finance
- voice note
- voice channel
- music

V2 mengubah Jarvis dari sekadar chatbot menjadi **Personal AI Agent**.

Jarvis V2 harus mampu:

- mengingat informasi penting user
- memahami konteks percakapan
- memilih dan menjalankan tools
- menjalankan task multi-step
- bekerja secara proaktif
- memahami voice secara lebih natural
- mengambil informasi dari web
- memberikan analitik personal
- memiliki sistem permission dan audit
- tetap mempertahankan seluruh fitur V1

---

# 2. VISION

Target akhir V2:

> User cukup berbicara atau mengirim pesan secara natural, lalu Jarvis memahami maksud, mengambil konteks yang relevan, memilih tindakan yang diperlukan, menjalankan task, menyimpan hasil jika diperlukan, dan memberikan response dalam format yang diminta user.

Contoh:

> "Amba, besok pagi jam 8 ingetin gue bayar listrik. Terus kalau gue belum menyelesaikannya sampai jam 10, ingetin lagi."

Jarvis harus mampu:

1. Memahami intent.
2. Membuat reminder pertama.
3. Membuat follow-up reminder.
4. Menyimpan relasi antar reminder.
5. Memberikan konfirmasi.
6. Mengeksekusi secara otomatis.

---

# 3. CORE PRINCIPLES

## 3.1 V1 Harus Tetap Stabil

V2 tidak boleh merusak:

- Discord messaging
- AI conversation
- task
- reminder
- notes
- finance
- voice note
- voice channel
- music

## 3.2 Incremental Development

V2 wajib dikembangkan berdasarkan phase.

Phase berikutnya hanya boleh dimulai setelah phase sebelumnya:

- selesai
- test
- verified
- tidak merusak V1

## 3.3 Database Migration Aman

Tidak boleh:

- drop database
- drop table existing
- rename field secara langsung tanpa migration
- menghapus historical data

Migration harus:

```text
Backup
→ Migration
→ Validation
→ Compatibility Test
→ Deploy
```

## 3.4 AI Tidak Boleh Mengakses Database Secara Langsung

Arsitektur wajib:

```text
User
↓
AI
↓
Tool / Service
↓
Database
```

Bukan:

```text
User
↓
AI
↓
Raw Database
```

---

# 4. TARGET ARCHITECTURE V2

```text
                    DISCORD
                       │
         ┌─────────────┼─────────────┐
         │             │             │
       CHAT        VOICE NOTE    VOICE CHANNEL
         │             │             │
         └─────────────┼─────────────┘
                       ↓
                DISCORD BOT
                Node.js
                       ↓
                  n8n Gateway
                       ↓
               AI / Agent Layer
                       ↓
              Intent + Context
                       ↓
                 Tool Router
                       ↓
       ┌───────────────┼────────────────┐
       │               │                │
     Tasks         Reminders         Finance
       │               │                │
     Notes          Memory          Calendar
       │               │                │
       └───────────────┼────────────────┘
                       ↓
                    Database
                       ↓
                Response Builder
                       ↓
                 Output Router
             ┌─────────┼─────────┐
             ↓         ↓         ↓
           CHAT      VOICE      FILE
```

---

# 5. V2 PHASE ROADMAP

| Phase | Nama | Priority | Dependency |
|---|---|---:|---|
| Phase 0 | Foundation & Migration | Critical | V1 |
| Phase 1 | Memory System | Critical | Phase 0 |
| Phase 2 | Tool & Agent System | Critical | Phase 1 |
| Phase 3 | Proactive Assistant | High | Phase 2 |
| Phase 4 | Advanced Voice | High | Phase 2 |
| Phase 5 | Web Intelligence | Medium | Phase 2 |
| Phase 6 | Personal Analytics | Medium | Phase 3 |
| Phase 7 | Security & Permission | Critical | Phase 2 |
| Phase 8 | Reliability & Observability | High | Semua phase |

---

# PHASE 0 — FOUNDATION & DATABASE MIGRATION

## 6. Tujuan

Mempersiapkan fondasi V2 tanpa mengubah behavior V1.

Fokus:

- audit database
- audit service
- standard response
- migration strategy
- logging
- ID consistency
- timestamps
- indexing
- backup

## 7. Database Standardization

Semua tabel minimal memiliki:

```text
id
created_at
updated_at
```

Untuk entity tertentu:

```text
deleted_at
```

jika membutuhkan soft delete.

Timestamp harus disimpan secara konsisten.

Default timezone:

```text
Asia/Jakarta
```

## 8. Database Indexing

Index minimal:

```text
users.discord_user_id
tasks.user_id
tasks.status
tasks.due_at
reminders.user_id
reminders.remind_at
transactions.user_id
transactions.transaction_at
conversations.user_id
```

## 9. Migration Requirement

Sebelum Phase 1:

- [ ] schema backup
- [ ] migration system tersedia
- [ ] rollback strategy tersedia
- [ ] migration versioning tersedia
- [ ] test migration pada copy database
- [ ] existing V1 data tetap terbaca

## 10. Acceptance Criteria

- V1 tetap bekerja.
- Migration dapat dijalankan dengan aman.
- Data lama tidak hilang.
- Database memiliki index penting.
- Backup dapat dibuat.
- Rollback terdokumentasi.

---

# PHASE 1 — MEMORY SYSTEM

## 11. Tujuan

Membuat Jarvis memiliki memory jangka pendek dan jangka panjang.

## 12. Short-Term Memory

Digunakan untuk context percakapan aktif.

Contoh:

> "Besok gue ada meeting."

Kemudian:

> "Jam berapa?"

Jarvis memahami referensi ke meeting sebelumnya.

## 13. Long-Term Memory

Memory yang layak disimpan:

- preference
- profile
- project
- habit
- important context
- user-requested memory

Contoh:

> "Ingat, gue lebih suka jawaban singkat."

## 14. Explicit Memory

User dapat mengatakan:

> "Ingat ini."

System wajib menyimpan.

## 15. Memory Delete

User dapat meminta:

> "Lupakan informasi itu."

Memory harus dihapus atau dinonaktifkan sesuai policy.

## 16. DATABASE CHANGE — `memories`

Tambahkan tabel:

```text
id
user_id
type
key
value
importance
source
status
created_at
updated_at
expires_at
```

### type

```text
PROFILE
PREFERENCE
PROJECT
HABIT
CONTEXT
OTHER
```

### source

```text
USER_EXPLICIT
AI_INFERRED
SYSTEM
```

### status

```text
ACTIVE
ARCHIVED
DELETED
```

## 17. Memory Relation

```text
users
  │
  ├────< memories
  │
  └────< conversations
```

Relationship:

```text
users 1:N memories
users 1:N conversations
```

## 18. Memory Retrieval

AI tidak boleh menerima seluruh memory user setiap request.

Flow:

```text
User Input
↓
Generate Search Context
↓
Memory Retrieval
↓
Relevant Memory
↓
AI
```

## 19. Memory Rules

`AI_INFERRED` memory tidak boleh otomatis dianggap permanent tanpa aturan.

Contoh:

> "Sepertinya lo biasanya aktif malam hari. Mau gue simpan sebagai kebiasaan?"

## 20. Acceptance Criteria

- [ ] save memory
- [ ] search memory
- [ ] update memory
- [ ] delete memory
- [ ] memory scoped per user
- [ ] memory dapat digunakan AI
- [ ] memory tidak bocor antar user
- [ ] V1 tetap berjalan

---

# PHASE 2 — TOOL & AGENT SYSTEM

## 21. Tujuan

Membuat Jarvis mampu melakukan tindakan menggunakan tools.

Target flow:

```text
Input
↓
Understand
↓
Select Tool
↓
Execute
↓
Verify
↓
Response
```

## 22. Core Tools

### Task

```text
task.create
task.list
task.get
task.update
task.complete
task.delete
```

### Reminder

```text
reminder.create
reminder.list
reminder.update
reminder.cancel
reminder.snooze
```

### Notes

```text
note.create
note.search
note.update
note.delete
```

### Finance

```text
finance.add
finance.list
finance.summary
finance.delete
```

### Memory

```text
memory.save
memory.search
memory.update
memory.delete
```

## 23. Tool Contract

Setiap tool harus memiliki contract.

Contoh:

```json
{
  "name": "reminder.create",
  "description": "Create a reminder",
  "arguments": {
    "title": "string",
    "remind_at": "datetime",
    "repeat_rule": "optional"
  }
}
```

Response standard:

```json
{
  "success": true,
  "data": {},
  "message": "Reminder created"
}
```

Error:

```json
{
  "success": false,
  "data": null,
  "message": "Invalid reminder time",
  "code": "INVALID_TIME"
}
```

## 24. Multi-Step Agent

Contoh:

> "Cari task gue yang belum selesai lalu ingetin gue besok pagi."

Flow:

```text
AI
↓
task.list
↓
Analyze result
↓
reminder.create
↓
Verify
↓
Response
```

## 25. Database Change — `agent_runs`

Tambahkan:

```text
id
user_id
conversation_id
intent
status
started_at
completed_at
error
metadata
```

Status:

```text
RUNNING
COMPLETED
FAILED
CANCELLED
```

## 26. Database Change — `tool_calls`

Tambahkan:

```text
id
agent_run_id
tool_name
arguments
result
status
error
created_at
completed_at
```

Relationship:

```text
agent_runs 1:N tool_calls
```

## 27. Confirmation System

Action tertentu wajib confirmation.

Contoh:

> "Hapus semua transaksi bulan ini."

Jarvis:

> "Ada 41 transaksi. Yakin?"

User:

> "Iya."

Baru execute.

## 28. High Risk Actions

Minimal:

- delete bulk data
- destructive actions
- external actions
- system commands
- sending messages to third parties
- financial actions

## 29. Acceptance Criteria

- [ ] AI dapat memilih tool
- [ ] tool validation berjalan
- [ ] multi-step task berjalan
- [ ] tool failure ditangani
- [ ] tool call tercatat
- [ ] high-risk action meminta confirmation
- [ ] existing V1 tools tetap kompatibel

---

# PHASE 3 — PROACTIVE ASSISTANT

## 30. Tujuan

Jarvis dapat membantu tanpa harus selalu ditanya.

## 31. Daily Briefing

User dapat mengaktifkan:

> "Aktifkan briefing pagi."

Contoh:

```text
☀️ Selamat pagi.

Hari ini:
• 3 task
• 2 reminder
• 1 jadwal

Task terdekat:
Revisi laporan — 09:00
```

## 32. Daily Recap

Contoh:

```text
📊 Daily Recap

Task selesai: 4
Task tertunda: 1

Pengeluaran hari ini:
Rp85.000

Reminder besok:
2
```

## 33. Recurring Reminder

Support:

```text
ONCE
DAILY
WEEKLY
MONTHLY
CUSTOM
```

Contoh:

> "Setiap Senin jam 8 ingetin gue olahraga."

## 34. Snooze

Support:

```text
10 minutes
30 minutes
1 hour
custom
```

## 35. DATABASE CHANGE — `reminders`

Evaluasi tabel reminder V1.

Jika field berikut belum ada, tambahkan:

```text
repeat_rule
next_trigger_at
last_triggered_at
snooze_until
parent_reminder_id
```

`parent_reminder_id` digunakan jika terdapat follow-up reminder chain.

## 36. Scheduler

Gunakan centralized scheduler.

Konsep:

```text
Scheduler
↓
Find due reminders
↓
Execute
↓
Mark triggered
↓
Create next occurrence
```

## 37. Acceptance Criteria

- [ ] daily briefing
- [ ] daily recap
- [ ] recurring reminder
- [ ] snooze
- [ ] overdue detection
- [ ] follow-up reminder
- [ ] reminder tidak duplicate
- [ ] scheduler tahan restart

---

# PHASE 4 — ADVANCED VOICE

## 38. Tujuan

Membuat Voice Mode terasa seperti percakapan nyata.

## 39. Voice Pipeline

```text
Discord Voice
↓
Audio Capture
↓
Speech-to-Text
↓
Context + Memory
↓
AI Agent
↓
Tool
↓
Text-to-Speech
↓
Discord Voice
```

## 40. Voice Note Pipeline

```text
Voice Note
↓
Audio Download
↓
Speech-to-Text
↓
AI
↓
Intent
↓
Tool
↓
Response
```

Output dapat:

```text
TEXT
VOICE_NOTE
```

sesuai permintaan user.

## 41. Voice Channel

Jarvis harus mampu:

- join
- leave
- listen
- respond
- interrupt
- mute
- unmute

## 42. Interruption

Jika Jarvis sedang bicara:

> "Stop."

Jarvis menghentikan audio.

## 43. Voice Personality

Konfigurasi minimal:

```text
voice_id
speech_speed
response_style
language
```

Style:

```text
NORMAL
SHORT
CASUAL
DETAILED
```

## 44. DATABASE CHANGE — `user_voice_preferences`

Jika belum ada:

```text
id
user_id
voice_id
language
speed
style
enabled
created_at
updated_at
```

Relationship:

```text
users 1:1 user_voice_preferences
```

## 45. Acceptance Criteria

- [ ] voice note masuk diproses
- [ ] voice note dapat menghasilkan text
- [ ] voice note dapat menghasilkan voice
- [ ] voice channel conversation berjalan
- [ ] Jarvis dapat menjalankan task dari voice
- [ ] interruption berfungsi
- [ ] voice preference tersimpan

---

# PHASE 5 — WEB INTELLIGENCE

## 46. Tujuan

Memberikan kemampuan mengambil informasi eksternal.

## 47. Web Tools

Minimal:

```text
web.search
web.open
web.extract
```

Optional:

```text
weather.get
news.search
price.search
```

## 48. Web Search Rules

AI harus:

1. menentukan apakah web diperlukan
2. melakukan search
3. memilih source
4. membaca source
5. merangkum
6. memberikan sumber jika relevan

## 49. Contoh

> "Cari harga laptop ASUS TUF terbaru."

Flow:

```text
AI
↓
web.search
↓
source analysis
↓
response
```

## 50. Optional Database — `external_cache`

Jika dibutuhkan:

```text
id
source
query_hash
data
expires_at
created_at
```

Gunakan TTL.

## 51. Acceptance Criteria

- [ ] web search
- [ ] source extraction
- [ ] result summarization
- [ ] timeout handling
- [ ] source attribution
- [ ] cache optional
- [ ] external failure handling

---

# PHASE 6 — PERSONAL ANALYTICS

## 52. Tujuan

Mengubah data Jarvis menjadi insight.

## 53. Finance Analytics

Contoh:

> "Pengeluaran gue bulan ini paling banyak apa?"

Output:

```text
Makan       Rp1.200.000
Transport   Rp750.000
Hiburan     Rp500.000
```

## 54. Task Analytics

Metric:

- completed
- overdue
- pending
- completion rate

## 55. Reminder Analytics

Metric:

- total reminder
- completed
- overdue
- snoozed
- cancelled

## 56. Database

Tidak wajib membuat table analytics baru.

Gunakan existing data + query aggregation.

## 57. Optional Database — `daily_metrics`

Jika performance membutuhkan:

```text
id
user_id
metric_date
tasks_completed
tasks_created
reminders_completed
reminders_missed
income_total
expense_total
created_at
```

## 58. Acceptance Criteria

- [ ] finance summary
- [ ] task summary
- [ ] reminder summary
- [ ] weekly recap
- [ ] monthly recap
- [ ] trend comparison
- [ ] data tidak duplicate

---

# PHASE 7 — SECURITY & PERMISSION

## 59. Tujuan

Melindungi Jarvis karena V2 memiliki capability yang lebih besar.

## 60. User Identity

Gunakan:

```text
discord_user_id
```

Jangan hanya menggunakan username.

## 61. Permission Level

Minimal:

```text
OWNER
ADMIN
USER
GUEST
```

Untuk single-user deployment, OWNER adalah user utama.

## 62. Tool Permission

Contoh:

```text
task.create → USER
finance.summary → USER
web.search → USER
system.shutdown → OWNER
bulk.delete → OWNER
```

## 63. Confirmation Policy

Risk level:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

High/critical wajib confirmation.

## 64. Database Change — `audit_logs`

Tambahkan:

```text
id
user_id
action
resource_type
resource_id
risk_level
status
metadata
created_at
```

## 65. Security Acceptance Criteria

- [ ] unauthorized user ditolak
- [ ] owner permission berjalan
- [ ] tool permission berjalan
- [ ] destructive action confirmation
- [ ] credential tidak masuk database log
- [ ] token tidak masuk output AI
- [ ] audit log aktif
- [ ] Discord user ID digunakan sebagai identity

---

# PHASE 8 — RELIABILITY & OBSERVABILITY

## 66. Tujuan

Membuat Jarvis stabil untuk penggunaan jangka panjang.

## 67. Logging

Log minimal:

```text
request_id
user_id
event
service
status
duration
error_code
timestamp
```

Jangan log:

- Discord token
- API key
- password
- private audio
- sensitive personal data

## 68. Error Handling

Semua integration harus memiliki:

```text
timeout
retry
fallback
error classification
```

## 69. Retry Policy

Gunakan retry terbatas:

```text
Attempt 1
↓
Failure
↓
Wait
↓
Attempt 2
↓
Failure
↓
Attempt 3
↓
Fallback
```

Jangan retry infinite.

## 70. Health Check

Minimal:

```text
Node.js Bot
n8n
Database
AI Provider
Voice Service
```

## 71. Monitoring

Metric:

```text
messages_processed
ai_requests
tool_calls
tool_failures
reminders_sent
voice_requests
average_response_time
```

## 72. Acceptance Criteria

- [ ] error log
- [ ] retry
- [ ] timeout
- [ ] health check
- [ ] service status
- [ ] performance monitoring
- [ ] graceful restart
- [ ] no infinite workflow loop

---

# 73. FINAL V2 DATABASE MODEL

Target entity:

```text
users
 │
 ├────< conversations
 │
 ├────< memories
 │
 ├────< tasks
 │
 ├────< reminders
 │             │
 │             └────< reminders
 │                   parent_reminder_id
 │
 ├────< notes
 │
 ├────< transactions
 │
 ├────1 user_voice_preferences
 │
 ├────< agent_runs
 │          │
 │          └────< tool_calls
 │
 └────< audit_logs
```

---

# 74. ERD OVERVIEW

```text
┌─────────────┐
│    users    │
└──────┬──────┘
       │
       ├──────────────< conversations
       │
       ├──────────────< memories
       │
       ├──────────────< tasks
       │
       ├──────────────< reminders
       │                     │
       │                     └────< reminders
       │                           parent_reminder_id
       │
       ├──────────────< notes
       │
       ├──────────────< transactions
       │
       ├──────────────1 user_voice_preferences
       │
       ├──────────────< agent_runs
       │                     │
       │                     └────< tool_calls
       │
       └──────────────< audit_logs

conversations
       │
       └──────────────< agent_runs
```

---

# 75. TABLE CHANGES SUMMARY

## Existing table yang kemungkinan perlu modification

### `users`

Tambahkan bila belum tersedia:

```text
timezone
status
role
```

### `conversations`

Tambahkan bila belum ada:

```text
input_type
output_type
metadata
```

Contoh input/output:

```text
TEXT
VOICE_NOTE
VOICE_CHANNEL
SYSTEM
```

### `reminders`

Tambahkan jika belum tersedia:

```text
repeat_rule
next_trigger_at
last_triggered_at
snooze_until
parent_reminder_id
```

## New Tables

Phase 1:

```text
memories
```

Phase 2:

```text
agent_runs
tool_calls
```

Phase 4:

```text
user_voice_preferences
```

Phase 7:

```text
audit_logs
```

Phase 6 optional:

```text
daily_metrics
```

Phase 5 optional:

```text
external_cache
```

---

# 76. DATABASE MIGRATION ORDER

Migration wajib dilakukan dengan urutan:

```text
V1 Database
     ↓
Migration 001
Foundation
     ↓
Migration 002
Memory
     ↓
Migration 003
Agent
     ↓
Migration 004
Proactive Reminder
     ↓
Migration 005
Voice Preference
     ↓
Migration 006
Security / Audit
     ↓
Optional Migration
Analytics / Cache
```

Setiap migration wajib memiliki:

- up
- down / rollback strategy
- validation
- test

---

# 77. GLOBAL DATA RULES

Semua entity user-owned wajib memiliki relasi ke user.

Contoh:

```text
user_id
```

Tidak boleh ada data personal yang bisa diambil hanya berdasarkan global ID tanpa authorization check.

---

# 78. API / SERVICE RULE

Service layer harus menjadi boundary.

Contoh:

```text
AI
 ↓
Agent Service
 ↓
Task Service
 ↓
Database
```

Bukan:

```text
AI
 ↓
Database query langsung
```

---

# 79. RESPONSE CONTRACT

Semua service menggunakan pola:

```json
{
  "success": true,
  "data": {},
  "message": "",
  "code": ""
}
```

Failure:

```json
{
  "success": false,
  "data": null,
  "message": "Something went wrong",
  "code": "ERROR_CODE"
}
```

---

# 80. V2 NON-FUNCTIONAL REQUIREMENTS

## Performance

Response chat normal harus cepat.

Tool execution tidak boleh membuat Discord connection blocking.

## Reliability

Restart Node.js tidak boleh menghilangkan database state.

Restart n8n tidak boleh menghilangkan reminder yang sudah tersimpan.

## Security

Credential disimpan menggunakan environment variables / secret manager.

## Scalability

Arsitektur harus memungkinkan:

```text
Local PC
↓
VPS
↓
Cloud
```

tanpa rewrite besar.

---

# 81. DEVELOPMENT ORDER

Urutan implementasi yang direkomendasikan:

```text
PHASE 0
Foundation
   ↓
PHASE 1
Memory
   ↓
PHASE 2
Tool / Agent
   ↓
PHASE 3
Proactive Assistant
   ↓
PHASE 7
Security
   ↓
PHASE 8
Reliability
   ↓
PHASE 4
Advanced Voice
   ↓
PHASE 5
Web Intelligence
   ↓
PHASE 6
Analytics
```

Security dan reliability boleh dimajukan sebelum feature tertentu karena semakin banyak capability berarti semakin besar risk.

---

# 82. DEFINITION OF DONE

Sebuah phase dianggap selesai hanya jika:

- feature implemented
- service implemented
- database migration selesai jika diperlukan
- existing feature regression test
- error handling tersedia
- logging tersedia
- security check dilakukan
- documentation diperbarui
- test berhasil
- no unresolved critical bugs

---

# 83. V2 MASTER ACCEPTANCE CRITERIA

Jarvis V2 dianggap berhasil jika user dapat melakukan:

### Conversation

> "Amba, lagi ngapain?"

### Memory

> "Ingat gue lebih suka jawaban singkat."

### Task

> "Catat gue harus revisi laporan."

### Reminder

> "Ingatkan gue jam 8 malam."

### Multi-step

> "Cari task gue yang belum selesai dan kasih reminder untuk besok."

### Finance

> "Berapa pengeluaran gue bulan ini?"

### Voice

> "Amba, besok jam 8 ingetin gue bayar listrik."

### Web

> "Cari informasi terbaru tentang laptop ASUS TUF."

### Proactive

Jarvis otomatis memberikan daily briefing.

### Security

Perintah berbahaya meminta confirmation.

---

# 84. V2 NON-GOALS

V2 belum wajib mencakup:

- smart home penuh
- mobile application native
- autonomous browsing tanpa permission
- autonomous financial transaction
- unrestricted PC control
- fully autonomous agent tanpa confirmation
- multi-user SaaS platform

Fitur tersebut dapat dipertimbangkan untuk V3.

---

# 85. V3 DIRECTION

Setelah V2 stabil, kemungkinan V3:

```text
Jarvis
 ↓
Personal Operating System
```

Dengan:

- PC automation
- smart home
- calendar integration
- Gmail
- WhatsApp / other messaging integrations
- multi-device
- mobile app
- advanced long-term memory
- personalized behavior
- autonomous workflows
- local AI
- hybrid cloud/local AI

---

# 86. INSTRUCTION FOR DEVELOPMENT AGENT

Saat dokumen PRD V2 ini diberikan kepada coding agent:

1. Baca seluruh project existing.
2. Baca PRD V1.
3. Baca seluruh dokumentasi.
4. Bandingkan schema database actual dengan PRD ini.
5. Buat gap analysis.
6. Jangan langsung coding.
7. Tentukan phase yang sedang dikerjakan.
8. Jangan mengerjakan phase berikutnya sebelum current phase selesai.
9. Jangan merusak fitur V1.
10. Semua database change harus memiliki migration.
11. Semua feature harus memiliki test.
12. Jangan memasukkan credential ke source code.
13. Jangan melakukan large-scale rewrite tanpa alasan teknis.

---

# 87. FIRST TASK FOR V2

Sebelum implementasi V2:

## DO NOT CODE.

Lakukan:

```text
1. Audit V1
2. Audit Database
3. Audit Existing Services
4. Audit n8n
5. Audit Discord Bot
6. Audit Voice System
7. Audit Finance / Task / Reminder
8. Compare dengan PRD V2
9. Buat Gap Analysis
10. Tentukan migration yang benar-benar diperlukan
11. Tentukan Phase pertama
```

Output wajib:

```text
CURRENT STATE
DATABASE GAP
ARCHITECTURE GAP
FEATURE GAP
SECURITY GAP
MIGRATION PLAN
PHASE 1 IMPLEMENTATION PLAN
RISKS
```

Setelah laporan selesai, baru implementasi Phase 0 dan Phase 1.

---

# 88. FINAL PRINCIPLE

Jarvis V2 bukan sekadar menambahkan banyak fitur.

Target utama:

> **Make Jarvis smarter, more contextual, more capable, more proactive, and safer without sacrificing the stability of V1.**

Prioritas:

```text
STABILITY
   ↓
MEMORY
   ↓
TOOLS
   ↓
AGENT
   ↓
PROACTIVE
   ↓
VOICE
   ↓
WEB
   ↓
ANALYTICS
```
