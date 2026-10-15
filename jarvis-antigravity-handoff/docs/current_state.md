# Kondisi Proyek Saat Ini

**Tanggal catatan:** 14 Oktober 2026  
**Status:** prototipe koneksi Discord → n8n berhasil dites; balasan otomatis end-to-end belum selesai.

## Lokasi dan runtime

- Project root Windows: `D:\Dev\project\n8n\Jarvis`
- n8n berjalan melalui Docker Desktop dan dapat dibuka di `http://localhost:5678`
- Versi n8n yang dilaporkan: `2.43.4`
- Docker Compose stack/container sebelumnya bernama `jarvis` / `jarvis-n8n`
- File Docker Compose di root menggunakan image `docker.n8n.io/n8nio/n8n:latest`, port `5678:5678`, timezone `Asia/Jakarta`, dan volume `n8n_data:/home/node/.n8n`
- Node.js pada Windows: `v24.21.0`
- npm Windows perlu dipanggil sebagai `npm.cmd` karena PowerShell memblokir `npm.ps1`
- `discord.js`: `14.27.0`

## Struktur yang sudah dibuat

```text
Jarvis/
├─ docker-compose.yml
└─ discord-bot/
   ├─ package.json
   ├─ package-lock.json
   ├─ node_modules/
   ├─ bot.js
   └─ .env
```

File `.env` lokal berisi `DISCORD_TOKEN`. Jangan tampilkan, salin ke dokumentasi, atau kirim token tersebut. Pastikan `.env` masuk `.gitignore`.

## Discord bot

- Bot sudah dibuat di Discord Developer Portal dan diundang ke server.
- Nama yang tampil saat tes: `Amba#2138`.
- Message Content Intent sudah diaktifkan.
- Permission yang dipilih saat invite: View Channels, Send Messages, Read Message History, Attach Files, Embed Links, Connect, Speak; scopes `bot` dan `applications.commands`.
- Script `bot.js` pernah berjalan dan menampilkan `Jarvis online sebagai Amba#2138`.
- Peringatan `ready` event adalah deprecation warning, bukan penyebab kegagalan koneksi.

## Kode bot saat ini (perilaku terakhir yang diketahui)

Script menggunakan `discord.js`, mendengarkan `messageCreate`, mengabaikan pesan dari bot, mencatat pesan masuk, lalu mengirim POST ke URL webhook n8n. Payload yang dikirim berbentuk:

```json
{
  "user": {
    "id": "DISCORD_USER_ID",
    "username": "USERNAME",
    "displayName": "DISPLAY_NAME"
  },
  "message": {
    "id": "DISCORD_MESSAGE_ID",
    "content": "ISI_PESAN",
    "channelId": "DISCORD_CHANNEL_ID",
    "channelName": "CHANNEL_NAME"
  },
  "timestamp": "ISO_8601_TIMESTAMP"
}
```

Nilai dalam contoh ini hanya ilustrasi. `bot.js` mengirim bentuk payload tersebut di body POST.

## n8n webhook yang sudah dites

- Webhook method: `POST`
- Path: `jarvis-discord`
- Test URL yang terlihat: `http://localhost:5678/webhook-test/jarvis-discord`
- Saat n8n berada pada mode **Listen for test event**, pesan Discord pernah berhasil dikirim dan terminal menampilkan `Pesan berhasil dikirim ke n8n`.
- Ketika test listener tidak aktif, bot mendapat `404 Not Found`. Ini sesuai dengan penggunaan Test URL yang tidak selalu aktif.
- Workflow harus disimpan/diaktifkan untuk penggunaan normal dan memakai Production URL, biasanya `http://localhost:5678/webhook/jarvis-discord`.

## Masalah terakhir yang belum beres

Node `HTTP Request` di n8n dicoba untuk mengirim pesan balasan langsung ke Discord API:

```text
POST https://discord.com/api/v10/channels/{{$json.message.channelId}}/messages
```

Body yang dicoba:

```json
{
  "content": "Halo! Pesan lo sudah masuk ke n8n 🤖"
}
```

Request menghasilkan `405 Method Not Allowed`. Preview URL di UI terlihat seperti:

```text
https://discord.com/api/v10/channels//messages
```

Ini menunjukkan ekspresi `channelId` tidak ter-resolve dalam konteks node tersebut. Output Webhook n8n umumnya membungkus request yang diterima di `$json.body`, sehingga agent perlu memeriksa **Output JSON nyata** terlebih dahulu. Kemungkinan path yang dibutuhkan adalah `$json.body.message.channelId`, tetapi jangan mengandalkan dugaan—verifikasi dari execution data.

**Rekomendasi desain:** untuk tahap awal, hindari mengirim balasan Discord dengan token yang ditempel langsung di node HTTP Request. Lebih aman dan sederhana bila:
1. Bot Node.js mengirim pesan ke Webhook n8n.
2. Workflow n8n memproses pesan lalu mengembalikan JSON melalui `Respond to Webhook`.
3. `bot.js` membaca JSON respons dan membalas kanal Discord menggunakan `message.reply(...)` atau `message.channel.send(...)`.

Dengan pendekatan itu, Discord token tetap berada di `.env` bot dan tidak perlu dimasukkan ke node HTTP Request n8n. Agent boleh memilih alternatif jika menemukan alasan teknis yang kuat, tetapi harus menjelaskan alasannya dan mengamankan credential.

## Fitur yang belum dibuat

Belum ada implementasi terverifikasi untuk:

- Integrasi model AI (Gemini atau model lain)
- Balasan otomatis yang berasal dari AI
- Database persisten untuk notes, task, reminder, jadwal, pemasukan/pengeluaran
- Voice note masuk/keluar dan transkripsi
- Percakapan langsung di Discord Voice Channel
- Playback musik
- Deployment 24/7 di VPS
- Tes otomatis dan logging terstruktur

Jangan tulis seolah-olah fitur-fitur tersebut sudah berfungsi.
