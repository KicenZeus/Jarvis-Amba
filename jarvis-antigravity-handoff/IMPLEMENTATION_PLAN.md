# Rencana Implementasi Bertahap

## Tahap 0 — audit existing project

- Baca seluruh file `.md` di project root dan folder mana pun yang relevan.
- Periksa `docker-compose.yml`, `discord-bot/package.json`, `discord-bot/bot.js`, `.gitignore`, workflow n8n yang dapat diakses, dan file konfigurasi lainnya.
- Jangan membaca/menyalin nilai `.env` ke output, log, atau dokumentasi. Cukup cek apakah variabel wajib tersedia.
- Buat ringkasan kondisi aktual dan temukan perbedaan terhadap dokumen ini.

**Selesai jika:** agent dapat menyebutkan file yang ada, flow yang berjalan, masalah terakhir dan cara menguji semuanya tanpa mengubah kode.

## Tahap 1 — stabilkan Discord ↔ n8n

- Pindahkan URL webhook ke `N8N_WEBHOOK_URL`.
- Perbaiki Webhook n8n agar menggunakan Production URL saat workflow aktif.
- Tetapkan kontrak JSON response melalui Respond to Webhook.
- Ubah bot agar membaca respons JSON dan membalas Discord menggunakan discord.js.
- Jangan pakai HTTP Request Discord API untuk MVP kecuali memang ada alasan yang dijelaskan.
- Tambahkan timeouts, pemeriksaan HTTP status, respons JSON invalid, dan error handling.
- Terapkan allowlist untuk user/server; jika konfigurasi belum ada, default aman adalah menolak penggunaan umum sampai pemilik mengatur ID yang diizinkan.
- Pertahankan kompatibilitas dan jangan mengubah struktur project tanpa kebutuhan.

**Tes penerimaan:** pesan Discord → webhook aktif → n8n response JSON → balasan Discord yang benar.

## Tahap 2 — AI chat teks

- Bandingkan provider yang tersedia dan dokumentasikan kebutuhan API key, limit, privasi, dan cara konfigurasi.
- Jangan menaruh API key di source code.
- Tambahkan fallback saat provider gagal.
- Pastikan output dapat dikembalikan dalam kontrak response yang sama.

**Tes penerimaan:** pertanyaan umum, perintah tidak jelas (bot bertanya klarifikasi singkat), error provider, dan perintah yang tidak diizinkan.

## Tahap 3 — penyimpanan dan task

- Pilih DB persisten dan buat migrasi/schema berdasarkan `DATA_MODEL.md` yang telah disetujui agent dari hasil audit.
- Implementasikan notes, tasks, reminders, schedules, dan financial transactions satu per satu.
- Jalankan scheduler reminder; cegah reminder terkirim dua kali.
- Pastikan hasil rekap bersumber dari query data nyata.

**Tes penerimaan:** data tetap ada setelah restart; data user terisolasi; reminder jatuh tempo terkirim satu kali.

## Tahap 4 — voice note

- Deteksi attachment audio, validasi tipe/ukuran, transkripsi, pemrosesan intent, TTS untuk respons audio, kirim sebagai attachment.
- Tambahkan pembersihan file sementara dan pengendalian retensi.
- Pertahankan kebebasan mode output: input voice note boleh menghasilkan teks.

## Tahap 5 — voice channel dan musik

- Buat modul terpisah untuk Discord voice (join/leave, capture audio, STT, TTS, interupsi, reconnect).
- Buat modul musik terpisah dengan kontrol queue dan validasi platform/source yang boleh digunakan.
- Jangan menghambat workflow chat jika voice atau musik gagal.
- Verifikasi library, dependensi native, dukungan Windows/Docker, dan ketentuan platform terkini sebelum implementasi.

## Tahap 6 — deploy

- Dokumentasikan Docker setup end-to-end, environment variables, health checks, backup, dan restore.
- Uji semua fitur dalam kondisi restart.
- Baru kemudian siapkan deployment VPS untuk layanan 24/7.

## Aturan kerja agent

- Perubahan kecil, mudah ditinjau, hindari rewrite seluruh proyek.
- Sebelum mengedit file, jelaskan file mana yang akan diubah dan kenapa.
- Setelah mengedit, jalankan lint/syntax/test yang tersedia.
- Jangan bilang berhasil jika belum menjalankan tes yang relevan.
- Jika workflow n8n tidak dapat dibaca langsung dari disk, minta pengguna export workflow JSON atau gunakan execution data/screenshot yang tersedia; jangan mengarang konfigurasi yang tak terlihat.
