# PRD — Jarvis / Amba

**Versi:** 0.1 — draft untuk prototipe  
**Tanggal:** 14 Oktober 2026  
**Bahasa interaksi:** Bahasa Indonesia, gaya santai, bisa mengikuti gaya bahasa pengguna.

## 1. Visi produk

Jarvis (nama bot Discord yang saat ini tampil sebagai Amba) adalah asisten pribadi yang berinteraksi melalui Discord dan memakai n8n sebagai orkestrator workflow. Asisten memahami perintah lintas mode input dan dapat melakukan tugas seperti catatan, task, reminder, rekap, dan percakapan. Jenis input tidak menentukan jenis output: pengguna bisa meminta jawaban teks atau voice note dari pesan teks maupun voice note.

## 2. Tujuan MVP

1. Menerima pesan teks Discord secara stabil.
2. Mengirim payload pesan dari bot Node.js ke webhook n8n.
3. Memproses pesan melalui workflow n8n.
4. Mengembalikan hasil workflow ke bot melalui respons webhook.
5. Bot mengirim balasan ke Discord dengan error handling yang baik.
6. Menambahkan AI chat setelah alur dasar end-to-end teruji.
7. Memisahkan transport Discord (Node.js) dari orkestrasi dan task (n8n), sehingga fitur bisa bertambah tanpa membangun ulang fondasi.

## 3. Prinsip produk

- Input dan output independen: teks masuk bisa menghasilkan teks atau voice note; voice note masuk juga bisa menghasilkan teks atau voice note.
- Mode percakapan live menggunakan Voice Channel adalah jalur terpisah dari voice note.
- Perintah task harus dapat dijalankan dari chat, voice note (setelah transkripsi), dan percakapan live (setelah speech-to-text).
- Jawaban harus singkat dan alami secara default; detail panjang hanya saat diminta atau dibutuhkan.
- Jangan mengarang hasil tool/task. Jika gagal atau belum tersedia, katakan dengan jelas.
- Data hanya boleh diakses oleh pengguna yang diizinkan.
- Semua credential disimpan melalui environment variables atau credential manager, bukan di-hardcode.

## 4. Aktor dan batas akses

### Pengguna yang diizinkan

Pengguna Discord yang tercantum dalam konfigurasi allowlist (misalnya `ALLOWED_USER_IDS`) boleh menggunakan fitur privat Jarvis. Implementasi harus menolak atau mengabaikan permintaan pengguna yang tidak diizinkan, kecuali pemilik sengaja mengatur bot menjadi publik.

### Pemilik/admin

Dapat mengatur konfigurasi, integrasi AI, zona waktu, allowlist, dan kelak melihat atau menghapus data pribadi.

## 5. Fitur dan prioritas

### P0 — wajib sebelum MVP dianggap jadi

- Bot Discord online dan menerima pesan teks.
- Filter pesan dari bot lain agar tidak terjadi loop.
- Mengirim payload ke URL webhook n8n dari environment variable.
- Menangani timeout, webhook tidak aktif, HTTP non-2xx, dan respons tidak valid.
- n8n mengembalikan JSON dengan kontrak yang terdokumentasi, misalnya `success`, `replyText`, dan `replyMode`.
- Bot meneruskan `replyText` ke Discord dan menampilkan log yang aman.
- Beralih dari Test URL ke Production URL saat workflow diaktifkan.
- Menambahkan `.gitignore`, `.env.example`, dan dokumentasi lokal.

### P1 — percakapan AI teks

- Integrasi provider AI yang dikonfigurasi melalui credentials/environment.
- Memahami perintah berbahasa Indonesia dan konteks percakapan yang relevan.
- Jika pengguna meminta “balas pakai chat”, kirim teks.
- Jika pengguna meminta “balas pakai voice note”, hasilkan audio TTS dan kirim sebagai attachment Discord.
- Jika preferensi output tidak disebutkan, default ke teks pada percakapan berbasis teks.
- AI tidak boleh mengaku sudah menyimpan task/reminder sebelum layanan penyimpanan mengonfirmasi keberhasilan.

### P2 — task dan data pribadi

- Catatan: buat, daftar, cari, tandai selesai, hapus.
- Task: buat, lihat, ubah status, edit, hapus.
- Reminder: buat, lihat, ubah, batalkan, kirim notifikasi tepat waktu.
- Jadwal: tambah dan periksa jadwal.
- Keuangan: catat pemasukan/pengeluaran dan rekap per periode/kategori.
- Persistensi data ke database; jangan mengandalkan memori proses atau n8n execution history sebagai satu-satunya penyimpanan.
- Zona waktu default: `Asia/Jakarta`, bisa dikonfigurasi.

### P3 — voice note

- Menerima attachment audio/voice message dari Discord.
- Validasi tipe/ukuran file dan penanganan unduhan yang aman.
- Ubah audio menjadi teks lewat layanan Speech-to-Text.
- Jalankan intent/task yang sama seperti input teks.
- Jika pengguna meminta balasan chat, kirim teks; jika meminta voice note, hasilkan audio lewat TTS dan kirim file audio.
- Bersihkan file sementara dan jangan menyimpan audio lebih lama dari yang dibutuhkan kecuali pengguna mengaktifkan penyimpanan.

### P4 — obrolan langsung di Voice Channel

- Join/leave VC atas perintah yang jelas.
- Mendengarkan ucapan, mentranskripsi, menjalankan intent/task, dan menjawab dengan audio.
- Kontrol push-to-talk/wake word atau mekanisme aktivasi harus dirancang agar bot tidak merekam tanpa batas atau tanpa sepengetahuan pengguna.
- Tangani latensi, interupsi, timeout, kegagalan STT/TTS, dan putusnya koneksi.

### P5 — musik

- Join/leave Voice Channel dan kontrol play/pause/skip/stop/volume/queue.
- Cari musik menggunakan sumber dan metode yang sesuai aturan platform; agent harus memverifikasi kelayakan teknis dan ketentuan layanan terkini sebelum memilih implementasi. Jangan mengasumsikan scraping atau pengunduhan audio YouTube selalu diizinkan.
- Modul musik tidak boleh mengganggu alur voice assistant.

### P6 — deployment

- Jalankan lokal terlebih dahulu.
- Tambahkan health check, restart policy, pencatatan log, dan panduan backup.
- Migrasi ke VPS untuk operasi 24/7 setelah MVP stabil.

## 6. Alur pengguna inti

### A. Chat teks → balasan teks

1. Pengguna mengirim pesan di Discord.
2. Node.js menerima event `messageCreate`.
3. Bot memverifikasi allowlist dan mengirim payload ke n8n.
4. n8n memahami intent dan memanggil AI/service yang relevan.
5. n8n mengembalikan respons terstruktur.
6. Bot mengirim balasan teks ke channel.

### B. Chat teks → balasan voice note

1. Pengguna mengirim perintah teks dan meminta jawaban voice note.
2. n8n menghasilkan teks jawaban.
3. TTS mengubah teks menjadi audio.
4. Bot mengirim audio attachment ke channel Discord.

### C. Voice note → balasan teks atau voice note

1. Bot mendeteksi attachment audio.
2. File audio divalidasi dan dikirim ke STT.
3. Teks hasil transkripsi diproses seperti input teks biasa.
4. Output mengikuti instruksi pengguna, bukan jenis inputnya.

### D. Perintah task/reminder

1. Pesan diproses untuk menentukan intent dan argumen.
2. Validasi data wajib (misalnya waktu reminder) dilakukan.
3. Layanan data menyimpan task/reminder.
4. Bot mengonfirmasi hanya setelah operasi berhasil.
5. Scheduler/worker mengirim notifikasi saat waktunya tiba.

## 7. Kebutuhan nonfungsional

- **Keamanan:** token tidak masuk log, dokumentasi, response error, atau repo.
- **Privasi:** batasi siapa yang dapat mengakses data; minimalkan penyimpanan audio dan percakapan.
- **Keandalan:** error webhook/API ditangani; retry hanya untuk operasi yang aman diulang.
- **Idempotensi:** pesan/event yang sama tidak boleh menciptakan task atau transaksi dobel ketika retry.
- **Observabilitas:** log memuat correlation ID/message ID, bukan secret.
- **Maintainability:** kontrak JSON antar bot dan n8n didokumentasikan.
- **Portabilitas:** lokal dulu; konfigurasi prod dipisahkan dari kode.

## 8. Kriteria penerimaan P0

- [ ] Bot online setelah menjalankan `node bot.js`.
- [ ] Pesan dari pengguna allowlist diterima satu kali.
- [ ] Bot mengirim payload ke Production Webhook tanpa perlu tombol “Listen for test event”.
- [ ] n8n merespons dalam format JSON yang disepakati.
- [ ] Bot benar-benar mengirim balasan ke Discord berdasarkan `replyText`.
- [ ] Pesan dari bot tidak memicu loop.
- [ ] Jika n8n offline, bot memberi log error jelas dan tidak crash.
- [ ] Jika respons n8n kosong/tidak valid, bot tidak mengirim balasan palsu.
- [ ] Token tidak dicetak ke terminal, tidak ditulis hardcoded, dan `.env` diabaikan Git.
- [ ] Panduan setup lokal dapat diikuti dari awal.

## 9. Di luar scope MVP

- Aplikasi mobile native.
- Voice call telepon biasa.
- Menjamin bot aktif 24/7 saat PC lokal mati.
- Fitur otomatisasi yang memerlukan izin akun Discord berlebih.
