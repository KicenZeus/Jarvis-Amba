# Kondisi Proyek Terkini (Jarvis / Amba V1 — Final State)

**Tanggal pembaruan:** 15 Oktober 2026  
**Status V1:** 100% SELESAI & STABIL (Production Ready)  
**Target Berikutnya:** Jarvis V2 (Personal AI Agent)

---

## 1. Lokasi dan Runtime

- **Project Root:** `D:\Dev\project\n8n\Jarvis`
- **Docker Containers Running:**
  - `jarvis-n8n`: port `5678:5678`, workflow automation & agent brain.
  - `jarvis-postgres`: PostgreSQL 16 Alpine, port host `5433:5432`, volume `jarvis_pgdata`.
- **Node.js Environment:** `v24.21.0`
- **Discord Bot:** Login aktif sebagai `Amba#2138` (Daemon background).
- **Creator / Developer:** `kicenzeus`

---

## 2. Struktur Direktori Proyek

```text
Jarvis/
├─ docker-compose.yml                     # Services n8n & postgres (5433:5432)
├─ init-db.sql                            # Skema database awal (users, tasks, reminders, notes, finance)
├─ USER_GUIDE.md                          # Panduan lengkap pengguna (Musik & Personal Assistant)
├─ .gitignore                             # Proteksi kredensial .env
├─ discord-bot/
│  ├─ package.json                        # Dependencies discord.js, voice, soundcloud, edge-tts
│  ├─ bot.js                              # Gateway Discord, event handler, shorthand commands & help
│  ├─ helpEmbeds.js                       # Generator Rich Embed cantik untuk panduan !help
│  ├─ musicManager.js                     # State antrean musik, audio player, harmonisasi auto-ducking
│  ├─ soundcloudService.js                # Engine audio stream SoundCloud HLS m3u8 + FFmpeg PCM
│  ├─ urlResolver.js                      # Auto-resolver tautan YouTube & Spotify via oEmbed
│  ├─ vcManager.js                        # Manajer koneksi Voice Channel & live speech pipeline
│  └─ voiceService.js                     # Gemini multimodal audio STT & MsEdgeTTS Indonesian
└─ jarvis-antigravity-handoff/
   ├─ PRD.md                              # Spesifikasi MVP V1 (Semua phase P0 - P5 selesai)
   ├─ JARVIS_V2_PRD.md                    # Blueprint & arsitektur Jarvis V2 (Target berikutnya)
   ├─ V2_AUDIT_AND_GAP_ANALYSIS.md        # Laporan Audit & Gap Analysis resmi V1 vs V2
   ├─ CURRENT_STATE.md                    # Dokumen status terkini
   ├─ workflow-jarvis-gateway.json        # Workflow n8n AI Agent (Gemini Flash Lite + Postgres Tool)
   └─ workflow-jarvis-scheduler.json      # Workflow n8n Reminder Cron Scheduler
```

---

## 3. Rekap Fitur Selesai V1

1. **P0 (Gateway & Chat):** Komunikasi dua arah Discord ↔ n8n via Webhook handal, zero false reply.
2. **P1 (Database Persisten):** Database PostgreSQL aman dengan 5 entitas data (users, tasks, reminders, notes, finance).
3. **P2 (Pengingat Otomatis):** Worker reminder scheduler atomik via port 5001, pesan notifikasi akurat tanpa duplikasi.
4. **P3 (Voice Note Ingestion):** Input suara di-transkripsi via Google Gemini multimodal, output suara via MsEdgeTTS `id-ID-ArdiNeural`.
5. **P4 (Live Voice Channel Talk):** Obrolan suara dua arah langsung di Voice Channel dengan deteksi silence & trigger "amba".
6. **P5 (Pemutar Musik HD):** Pemutaran musik jernih via FFmpeg PCM pipeline (SoundCloud HLS, YouTube/Spotify link resolver, antrean, volume, dan auto-pause saat AI berbicara di VC).
7. **Panduan & Identitas:** Menu `!help` (Rich Embed), perintah ringkas (`!p`, `!s`, `!q`, `!v`), dan pengakuan pencipta oleh **kicenzeus**.
