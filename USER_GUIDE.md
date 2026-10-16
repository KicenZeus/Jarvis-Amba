# 📖 Panduan Penggunaan Jarvis / Amba Bot Discord

> **Dibuat & Dikembangkan oleh:** **kicenzeus** 🔥  
> **Versi:** 1.0.0 (Production Ready)  
> **Nama Bot di Discord:** `Amba#2138` (Codename: *Jarvis*)

Amba adalah bot Discord multifungsi yang menggabungkan dua kekuatan utama:
1. **Pemutar Musik HD di Voice Channel** (Mendukung YouTube, Spotify, SoundCloud, dan Audio Link langsung).
2. **Personal AI Assistant** yang terhubung ke model kecerdasan buatan Google Gemini dan database PostgreSQL persisten untuk produktivitas harian.

---

## 📑 Daftar Isi
- [0. Cara Menyalakan & Menjalankan Bot](#0-cara-menyalakan--menjalankan-bot)
  - [Metode 1: Paling Praktis (Sekali Klik)](#metode-1-paling-praktis-sekali-klik-rekomendasi)
  - [Metode 2: Manual via Terminal / PowerShell](#metode-2-manual-via-terminal--powershell)
  - [Tanda Bot Berhasil Online](#tanda-bot-berhasil-online)
  - [Cara Mematikan Bot](#cara-mematikan-bot)
  - [Troubleshooting & Solusi Kendala](#troubleshooting--solusi-kendala)
- [1. Panduan Khusus Pemutar Musik](#1-panduan-khusus-pemutar-musik)
  - [Daftar Perintah Musik](#daftar-perintah-musik)
  - [Dukungan Tautan / URL Musik](#dukungan-tautan--url-musik)
  - [Harmonisasi Cerdas AI & Musik](#harmonisasi-cerdas-ai--musik)
- [2. Panduan Khusus Personal AI Assistant](#2-panduan-khusus-personal-ai-assistant)
  - [Pengingat Waktu (Reminders)](#a-pengingat-waktu-reminders)
  - [Manajemen Tugas (Todo List)](#b-manajemen-tugas-todo-list)
  - [Pencatatan Keuangan Pribadi](#c-pencatatan-keuangan-pribadi)
  - [Catatan Kilat (Notes)](#d-catatan-kilat-notes)
  - [Obrolan Suara & Voice Note (VN)](#e-obrolan-suara--voice-note-vn)
  - [Personalisasi Panggilan & Format Balasan](#f-personalisasi-panggilan--format-balasan)
  - [Sistem Memori Jangka Panjang](#g-sistem-memori-jangka-panjang-memory-system-v2)
  - [Agen Multi-Langkah & Pengaman Berisiko Tinggi](#h-agen-multi-langkah--pengaman-berisiko-tinggi-phase-2)
  - [Fitur Proaktif Cerdas (Briefing, Recap, Recurring & Snooze)](#i-fitur-proaktif-cerdas-phase-3)
  - [Pengaturan Suara AI & Interupsi Audio](#j-pengaturan-suara-ai--interupsi-audio-phase-4)
  - [Web Intelligence: Pencarian Web, Cuaca & Rangkuman Link](#k-web-intelligence-pencarian-web-cuaca--rangkuman-link-phase-5)
- [3. Perintah Bantuan di Discord (`!help`)](#3-perintah-bantuan-di-discord-help)
- [4. Identitas & Kredit Pembuat](#4-identitas--kredit-pembuat)

---

### K. Web Intelligence: Pencarian Web, Cuaca & Rangkuman Link (Phase 5)

Amba kini terhubung langsung ke internet secara real-time untuk mengambil informasi terkini tanpa batas:

- **1. Pencarian Web (`!search <kata kunci>` atau `!cari <kata kunci>`):**
  - Mengambil 5 informasi dan tautan web paling relevan.
  - Dilengkapi sistem cache otomatis di PostgreSQL (`external_cache`) agar respon kilat.
  - *Contoh:*
    - `!search harga laptop ASUS TUF Gaming terbaru`
    - `!cari jadwal rilis iPhone 17`
    - `amba cari berita transfer pemain bola hari ini`

- **2. Info Cuaca Real-Time (`!cuaca [kota]` atau `!weather [kota]`):**
  - Mengambil data suhu, kelembapan, kecepatan angin, curah hujan, dan kondisi langit terkini dari Open-Meteo.
  - *Contoh:*
    - `!cuaca Bandung`
    - `!cuaca Surabaya`
    - `!cuaca` *(Default kota Jakarta)*
    - Atau dalam obrolan biasa: `"amba gimana cuaca di Yogyakarta hari ini?"`

- **3. Pembaca & Perangkum Halaman Web (`!baca <link>` atau `!rangkum <link>`):**
  - Amba dapat membuka tautan artikel, berita, atau blog apa saja, mengekstrak isi teks utamanya, lalu meminta AI merangkum intisarinya secara padat dan jelas.
  - *Contoh:*
    - `!rangkum https://kompas.com/tekno/read/...`
    - `!baca https://medium.com/@author/artikel-menarik`
    - Atau di chat santai: `"amba tolong rangkum berita di link ini ya https://..."`

---

## 0. Cara Menyalakan & Menjalankan Bot (All-in-One Docker) 🐳

Kini seluruh ekosistem Jarvis telah disatukan ke dalam **Docker Compose**:
1. **`jarvis-postgres`**: Database PostgreSQL persisten untuk tasks, reminders, memories, identity mapping, dan catatan.
2. **`jarvis-n8n`**: Engine automasi AI yang menghubungkan model Gemini dan cron scheduler.
3. **`jarvis-bot`**: Dual-channel bot runtime (Discord Gateway + HTTP Listener & WhatsApp Adapter).
4. **`jarvis-tunnel`**: Cloudflare Tunnel resmi untuk mengamankan dan mengekspos Webhook WhatsApp Meta Cloud API ke publik.

---

### Perbedaan Mekanisme Koneksi: Discord vs WhatsApp
- **Discord:** Bekerja melalui koneksi **outbound WebSocket** langsung dari container bot ke server Discord. Saat Docker dijalankan ulang, bot langsung online otomatis tanpa konfigurasi URL apapun.
- **WhatsApp:** Bekerja melalui **inbound Webhook** dari Meta Cloud API. Meta mengirim request HTTP POST ke server lokal melalui domain publik Cloudflare Tunnel (`jarvis-tunnel`).

---

### Metode 1: Paling Praktis (Sekali Klik) — *Rekomendasi* ⭐

Bos sudah disediakan file launcher otomatis di folder project:
`D:\Dev\project\n8n\Jarvis`

1. **Buka Docker Desktop di Windows** (pastikan ikon paus di taskbar sudah aktif).
2. **Double-click file `start-jarvis.bat`**.
3. Script otomatis:
   - Menyalakan seluruh container (`docker compose up -d`).
   - Memeriksa koneksi Discord Bot (`jarvis-bot`).
   - Membaca URL Webhook WhatsApp aktif dari `jarvis-tunnel` dan menguji statusnya.
4. **Periksa URL Webhook WhatsApp:**
   Jika URL berubah setelah restart Docker, script akan menampilkan URL Callback baru yang perlu dimasukkan ke Meta App Dashboard.
5. **Jendela CMD boleh langsung Anda tutup**! Karena bot dan semua sistem tetap berjalan di latar belakang (*background container*) Docker!

---

### Cara Cek URL Webhook WhatsApp Kapan Saja
Jika ingin mengecek status dan URL Webhook WhatsApp tanpa perlu merestart bot:
- **Sekali Klik:** Double-click file **`check-whatsapp-url.bat`** di folder project.
- **Via Terminal:** Jalankan `node scripts/check-whatsapp.js`.

---

### Metode 2: Sekali Klik dari Aplikasi Docker Desktop 🖥️

1. Buka aplikasi **Docker Desktop**.
2. Masuk ke tab **Containers**.
3. Cari grup **`Jarvis`**.
4. Klik tombol **Play (▶️)** untuk menyalakan semua service sekaligus, atau klik **Stop (⏹️)** untuk mematikan.

---

### Metode 3: Manual via Terminal (PowerShell / CMD)

Cukup buka terminal di folder project (`D:\Dev\project\n8n\Jarvis`):
```bash
# Menyalakan seluruh sistem (Postgres, n8n, Bot, dan WhatsApp Tunnel):
docker compose up -d

# Mengecek status dan URL Webhook WhatsApp:
node scripts/check-whatsapp.js

# Melihat log bot realtime:
docker logs -f jarvis-bot

# Mematikan seluruh sistem:
docker compose stop
```

---

### Tanda Bot Berhasil Online

Jika semua berjalan normal, saat mengecek log bot (`docker logs jarvis-bot`):
```text
🔔 Listener notifikasi internal aktif di port 5001
✅ Jarvis online sebagai Amba#2138
🔗 Target n8n Webhook: http://n8n:5678/webhook/jarvis-discord
🌐 Allowlist kosong: bot merespons semua user.
⏰ Proactive Scheduler (Daily Briefing & Recap) diaktifkan.
```
Dan saat mengecek WhatsApp status (`check-whatsapp-url.bat`):
```text
🔗 URL Callback    : https://<subdomain>.trycloudflare.com/webhook/whatsapp
🔑 Token Verifikasi: jarvis_amba_wa_secret_2026
✅ Webhook Endpoint: ONLINE & VALID! (Respon 200 OK)
```

---

### Cara Mematikan Bot

- **Sekali Klik:** Cukup double-click file **`stop-jarvis.bat`** di folder project.
- **Via Docker Desktop:** Klik tombol **Stop (⏹️)** pada grup container `Jarvis`.
- **Via Terminal:** Jalankan `docker compose stop`.

---

### Troubleshooting & Solusi Kendala

| Kendala | Penyebab | Solusi |
| :--- | :--- | :--- |
| **"Docker Engine belum berjalan"** | Aplikasi Docker Desktop belum dibuka | Buka aplikasi Docker Desktop di Windows terlebih dahulu hingga statusnya *Engine running*, lalu jalankan `start-jarvis.bat`. |
| **Bot online di Discord tapi tidak merespon di WhatsApp** | URL Webhook Cloudflare Tunnel berubah setelah Docker di-restart | Jalankan `check-whatsapp-url.bat` untuk melihat URL aktif baru, lalu perbarui **URL Callback** di Meta Developer Dashboard (*WhatsApp -> Konfigurasi -> Bagian Webhook -> Edit & Simpan*). |
| **Error 190 (Authentication Error) di WhatsApp** | Token Meta kedaluwarsa atau belum dimuat | Pastikan token permanent System User terisi di `.env`, lalu jalankan `docker compose up -d --build bot`. |
| **Bot offline di Discord** | Container `jarvis-bot` belum aktif | Buka Docker Desktop dan klik tombol Play pada `jarvis-bot`, atau jalankan `start-jarvis.bat`. |
| **Ingin melihat log bot** | Bot jalan di background | Jalankan perintah `docker logs -f jarvis-bot` di terminal untuk melihat aktivitas log realtime. |
| **Auto-Start saat PC menyala** | Ingin bot otomatis aktif saat Windows booting | Pastikan di pengaturan Docker Desktop: *Settings -> General -> Start Docker Desktop when you sign in* dicentang. Container Jarvis akan otomatis langsung nyala! |

---

## 1. Panduan Khusus Pemutar Musik

Bot dilengkapi dengan modul audio streaming berbasis FFmpeg PCM stereo 48kHz yang menghasilkan suara jernih tanpa buffering panjang.

### Daftar Perintah Musik

Bos bisa menggunakan perintah awalan tanda seru (`!`) yang ringkas, atau memanggil dengan gaya percakapan santai (`amba <perintah>`):

| Perintah Lengkap | Perintah Ringkas | Contoh Penggunaan | Penjelasan |
| :--- | :--- | :--- | :--- |
| `!play <judul / link>` | `!p <judul / link>` | `!p Sheila on 7 Dan`<br>`!p https://youtu.be/...` | Mencari lagu dan langsung memutarnya di Voice Channel |
| `!pause` | - | `!pause` atau `amba pause` | Menjeda pemutaran lagu sementara |
| `!resume` | `!unpause` | `!resume` atau `!unpause` | Melanjutkan kembali lagu yang sedang dijeda |
| `!skip` | `!s` | `!s` atau `amba skip` | Melewati lagu yang sedang diputar ke lagu berikutnya di antrean |
| `!queue` | `!q` | `!q` atau `amba queue` | Menampilkan 5 antrean lagu berikutnya beserta durasi dan pemohonnya |
| `!volume <1-100>` | `!v <1-100>` | `!v 75` atau `amba vol 50` | Mengatur volume pemutaran lagu (skala 1 - 100%) |
| `!stop` | - | `!stop` atau `amba stop` | Menghentikan musik dan membersihkan seluruh antrean lagu |
| `!join` | - | `!join` atau `amba join vc` | Menyuruh bot bergabung ke Voice Channel Anda |
| `!leave` | `!dc` | `!leave` atau `amba leave vc` | Menyuruh bot pamit keluar dari Voice Channel |

### Dukungan Tautan / URL Musik
Bos tidak perlu repot mengetik judul jika sudah punya tautan lagunya. Cukup paste tautan berikut ke `!p <link>`:
- **YouTube Link:** Mendukung `youtube.com/watch?v=...`, `youtu.be/...`, dan YouTube Shorts.
- **Spotify Link:** Mendukung lagu Spotify `open.spotify.com/track/...`. Metadata judul dan artis akan otomatis diambil dan dicocokkan ke audio stream terbaik.
- **SoundCloud Link:** Mendukung format link `soundcloud.com/...` langsung.
- **Direct Audio Stream:** Mendukung streaming URL langsung berekstensi `.mp3`, `.m4a`, `.aac`, atau web radio.

### Harmonisasi Cerdas AI & Musik
Ketika musik sedang berputar di Voice Channel dan Bos berbicara dengan Amba (misalnya menanyakan jadwal atau tugas):
1. **Musik akan otomatis di-pause sementara (*ducking/auto-pause*)**.
2. Amba akan menjawab pertanyaan Bos dengan suara asisten AI.
3. Setelah Amba selesai berbicara, **musik akan otomatis dilanjutkan kembali (*auto-resume*)**.

---

## 2. Panduan Khusus Personal AI Assistant

Sebagai asisten AI pribadi, Amba ditenagai oleh **Google Gemini** dan terhubung ke database **PostgreSQL** yang persisten (data tidak akan hilang meskipun bot direstart).

> **Tips:** Di channel teks bersama, selalu panggil dengan menyebut nama **amba** atau me-reply pesan dari bot agar Amba tahu pesan tersebut ditujukan untuknya.

### A. Pengingat Waktu (Reminders)
Amba memiliki cron-scheduler atomik yang akan menotifikasi Bos tepat pada waktu yang ditentukan.
- *Contoh Perintah:*
  - `"amba ingetin gw jam 13.00 buat makan siang"`
  - `"amba besok jam 08.30 ingetin absensi kantor ya"`
  - `"amba 15 menit lagi ingetin matiin kompor"`

### B. Manajemen Tugas (Todo List)
Catat dan kelola tugas harian tanpa perlu buka aplikasi lain.
- *Menambah Tugas:*
  - `"amba catat tugas bikin laporan keuangan bulanan prioritas tinggi"`
  - `"amba tambahin todo beli kuota internet"`
- *Melihat Tugas:*
  - `"amba apa aja tugas gue yang belum selesai?"`
  - `"amba tampilkan semua daftar todo list gue"`
- *Menyelesaikan Tugas:*
  - `"amba tandai tugas laporan keuangan sudah selesai"`

### C. Pencatatan Keuangan Pribadi
Amba membantu melacak arus kas pemasukan dan pengeluaran harian.
- *Mencatat Pengeluaran:*
  - `"amba catat pengeluaran 45rb buat makan siang geprek"`
  - `"amba baru aja beli bensin 50 ribu"`
- *Mencatat Pemasukan:*
  - `"amba catat pemasukan 3.500.000 gaji freelance"`
- *Melihat Rekapitulasi:*
  - `"amba berapa total pengeluaran gue hari ini?"`
  - `"amba rekap keuangan gue minggu ini dong"`

### D. Catatan Kilat (Notes)
Simpan memo, password wifi, ukuran baju, atau ide bisnis.
- *Menyimpan Catatan:*
  - `"amba simpan catatan ukuran sepatu gue 42"`
  - `"amba catat ide project: bikin SaaS monitoring server"`
- *Mencari Catatan:*
  - `"amba catatan gue tentang ukuran sepatu apa?"`
  - `"amba cari catatan tentang ide project"`

### E. Obrolan Suara & Voice Note (VN)
- **Kirim Voice Note:** Bos bisa langsung mengirim pesan suara di Discord. Amba akan mentranskripsi suara Bos dan memprosesnya sama seperti teks.
- **Pilihan Mode Balasan:**
  - Ingin balasan teks: `"amba balas lewat chat aja ya"`
  - Ingin balasan pesan suara (VN): `"amba balas pake vn dong"`
  - Ingin keduanya: `"amba balas pake teks dan suara"`
- **Live Talk di Voice Channel:**
  - Ketik `!join` atau `amba join vc`.
  - Masuk ke Voice Channel yang sama, lalu ucapkan *"Halo Amba"*.
  - Amba akan mendengarkan dan menjawab langsung di dalam Voice Channel menggunakan suara natural berbahasa Indonesia.

### F. Personalisasi Panggilan & Format Balasan
- **Atur Nama Panggilan:**
  - `"amba mulai sekarang panggil gue Bos"`
  - `"amba panggil gue Komandan"`
- **Atur Format Pesan Pengingat:**
  - `"amba kalau ngingetin gue pake gaya: Bos waktunya ... jangan sampai telat ya!"`

### G. Sistem Memori Jangka Panjang (Memory System V2)
Amba kini memiliki otak memori jangka panjang persisten (`memories`) yang secara otomatis mengingat preferensi, kebiasaan, pantangan, dan informasi penting tentang Bos tanpa perlu diulang-ulang.

- **Menyimpan Ingatan Baru (Explicit Memory):**
  - `"amba ingat ya gue suka kopi tubruk tanpa gula"`
  - `"amba ingat nomor sepatu gue 42"`
  - `"amba ingat gue punya alergi udang dan kepiting"`
  - `"amba ingat project gue saat ini namanya Jarvis"`
- **Melihat Seluruh Ingatan Amba:**
  - Ketik `!memories` atau `amba memori` atau `amba ingatan`
  - Amba akan menampilkan kartu Embed berisi seluruh catatan hal yang diingat tentang Bos.
- **Melupakan Ingatan Tertentu (Forget Memory):**
  - Ketik `!forget <kunci/topik>` atau `"amba lupakan alergi udang"`
  - Amba akan segera menghapus informasi tersebut dari memori aktifnya.
- **Auto-context Retrieval:**
  - Setiap kali Bos mengobrol dengan Amba, memori ini otomatis menjadi konteks AI tanpa perlu Bos ingatkan kembali!

### H. Agen Multi-Langkah & Pengaman Berisiko Tinggi (Phase 2)
Amba kini bukan sekadar chatbot tanya-jawab sederhana, melainkan sebuah **Autonomous AI Agent** yang mampu memecah instruksi kompleks menjadi beberapa langkah aksi berurutan secara otomatis:

- **Instruksi Multi-Langkah (Multi-Step Tasks):**
  - *"Amba, cari task gue yang belum selesai lalu ingetin gue besok jam 10 pagi."*  
    *(Amba otomatis mengecek database tugas Anda yang pending, lalu menyusun pengingat terjadwal yang terhubung ke tugas tersebut).*
  - *"Catat pengeluaran bensin 50rb tadi siang dan tolong rekap total pengeluaran gue minggu ini."*
- **Sistem Pengaman Aksi Berisiko Tinggi (Confirmation Guard):**
  - Untuk mencegah kehilangan data akibat salah ketik atau kecelakaan, aksi pembersihan massal (*bulk delete/reset*) akan **dicegat** terlebih dahulu oleh Amba:
    - Contoh: *"Amba hapus semua transaksi keuangan gue"* atau *"Amba reset semua tugas"*
    - Amba akan menahan perintah dan memperingatkan:
      > ⚠️ **PERINGATAN AKSI BERISIKO TINGGI!**  
      > Aksi ini akan menghapus seluruh catatan transaksi keuangan Bos.  
      > Ketik **'ya lanjut'** untuk mengeksekusi, atau **'batal'** untuk membatalkan.
  - Data Bos selalu aman terlindungi dari eksekusi yang tidak disengaja!

### I. Fitur Proaktif Cerdas (Phase 3)
Amba tidak hanya pasif menunggu ditanya, melainkan secara proaktif membantu mendampingi produktivitas harian Bos:

- **1. Daily Briefing Pagi Hari (`!briefing`):**
  - Rangkuman pembuka hari yang berisi:
    - Sapaan hangat personal sesuai panggilan favorit Bos (*Bos*, *Komandan*, dll).
    - Daftar tugas prioritas (*High / Medium*) yang harus diselesaikan hari ini.
    - Jadwal pengingat (*reminders*) yang akan berbunyi hari ini dalam zona waktu WIB.
  - Perintah manual: `!briefing` atau `"amba briefing"`.
  - Otomatisasi pagi: `"amba aktifkan briefing pagi"` (Amba otomatis menyapa setiap pagi jam 07:30 WIB di channel tersebut).
- **2. Daily Recap Malam Hari (`!recap`):**
  - Rangkuman penutup hari sebelum tidur:
    - Jumlah tugas yang berhasil diselesaikan hari ini.
    - Tugas yang masih berstatus pending untuk dilanjutkan esok hari.
    - Total pengeluaran uang hari ini dalam format Rupiah rapi.
    - Kesiapan pengingat untuk besok hari.
  - Perintah manual: `!recap` atau `"amba recap"`.
  - Otomatisasi malam: `"amba aktifkan recap malam"` (Amba otomatis merangkum setiap malam jam 21:00 WIB).
- **3. Pengingat Berulang (Recurring Reminders):**
  - Bos bisa membuat pengingat rutin tanpa perlu membuat baru setiap hari:
    - `"amba setiap hari jam 7 pagi ingetin sarapan dan minum vitamin"`
    - `"amba setiap Senin jam 8 ingetin meeting sprint"`
  - Amba otomatis menjadwalkan occurrence berikutnya segera setelah pengingat sebelumnya berbunyi!
- **4. Fitur Tunda Pengingat (Snooze):**
  - Saat pengingat berbunyi dan Bos sedang sibuk atau butuh waktu tambahan:
    - Ketik `!snooze` atau `"amba snooze"`: Menunda pengingat default selama 10 menit.
    - Ketik `!snooze 15` atau `!snooze 30`: Menunda pengingat selama 15 atau 30 menit.
  - Amba akan menahan dan membunyikan kembali reminder tersebut tepat saat waktu tunda habis!

### J. Pengaturan Suara AI & Interupsi Audio (Phase 4)
Bos kini dapat sepenuhnya mempersonalisasi karakter suara, kecepatan bicara, dan gaya respons audio Amba:

- **1. Cek Pengaturan Suara (`!voice`):**
  - Ketik `!voice` atau `"amba voice"`: Menampilkan kartu Rich Embed berisi karakter suara aktif, kecepatan, gaya jawaban, dan daftar suara yang tersedia.
- **2. Mengganti Karakter Suara (`!voice set <nama>`):**
  - `!voice set ardi` — Suara pria Indonesia santai & hangat (*Default Jarvis*).
  - `!voice set gadis` — Suara wanita Indonesia lembut & ramah.
  - `!voice set guy` — Suara pria bahasa Inggris santai & percaya diri.
  - `!voice set jenny` — Suara wanita bahasa Inggris jernih & profesional.
- **3. Mengatur Kecepatan Bicara (`!voice speed <nilai>`):**
  - `!voice speed normal` / `!voice speed +0%` — Kecepatan standar alami.
  - `!voice speed cepat` / `!voice speed +15%` — Bicara lebih lincah dan cepat.
  - `!voice speed lambat` / `!voice speed -15%` — Bicara lebih pelan dan santai.
- **4. Mengatur Gaya Balasan AI (`!voice style <gaya>`):**
  - `!voice style santai` (*CASUAL*) — Respon hangat, ramah, dan bersahabat.
  - `!voice style singkat` (*SHORT*) — Respon to-the-point dan ringkas.
  - `!voice style detail` (*DETAILED*) — Respon lengkap dan terperinci.
- **5. Interupsi Suara (Voice Interruption):**
  - Jika Amba sedang berbicara panjang di Voice Channel dan Bos ingin menyela:
    - **Cukup langsung bicara di Voice Channel**, atau
    - Ketik `!diam` atau `"amba stop voice"` di chat teks.
    - Amba akan **seketika berhenti berbicara** (*interrupted*) dan siap mendengarkan instruksi Bos berikutnya!

### K. Web Intelligence: Pencarian Web, Cuaca & Rangkuman Link (Phase 5)
Amba kini terhubung langsung ke internet real-time melalui mesin **Web Intelligence**. Bos tidak perlu lagi menghafal command kaku, karena Amba otomatis memahami konteks dari **obrolan santai**, baik melalui chat teks maupun saat mengobrol via suara di Voice Channel:

#### 1. Cara Penggunaan Alami (Natural Conversation - Tanpa Command!)
Cukup ajak ngobrol Amba seperti biasa:
- **Tanya Cuaca Real-Time:**
  - *"Amba, gimana cuaca di Surabaya hari ini?"*
  - *"Lagi hujan ga ya di Bandung sekarang?"*
  - *"Suhu Jakarta lagi panas atau adem ya?"*
  - *"Amba cuaca hari ini gimana?"* *(Otomatis cek cuaca kota default / Jakarta).*
  - *Amba otomatis mengambil data suhu, perkiraan hujan, kelembapan, dan angin real-time dari satelit cuaca, lalu menjawabnya dengan ramah dan santai.*
- **Pencarian Web & Fakta Terkini (Live Web Search):**
  - *"Amba, coba cariin info harga iPhone 16 di Indonesia dong"*
  - *"Tolong carikan resep rendang daging sapi empuk"*
  - *"Coba browsing berita gempa bumi hari ini"*
  - *"Siapa juara Liga Champions semalam? Coba cek"*
  - *Amba otomatis menjelajahi internet secara live, merangkum faktanya, dan menjawab pertanyaan Bos secara cerdas dan lengkap beserta sumber terpercaya.*
- **Ekstraksi & Rangkuman Halaman Web (URL Extractor):**
  - Cukup tempel tautan artikel atau berita apa saja ke dalam obrolan:
    - *"Amba coba baca artikel ini dong https://... isinya tentang apa ya?"*
    - *"Tolong rangkum web ini ya: https://..."*
    - Atau bahkan cukup kirimkan link web-nya langsung!
  - *Amba akan membaca konten utama halaman tersebut, membuang iklan/skrip pengganggu, dan menyajikan intisari pentingnya untuk Bos.*
- **Berlaku di Voice Channel (VC):**
  - Bos juga bisa langsung berbicara lewat mikrofon di Voice Channel (misalnya: *"Amba, hari ini di Malang hujan gak?"*), dan Amba akan mencari info terkini lalu menjawabnya secara lisan dengan suara natural!

#### 2. Shortcut Command Cepat Awalan '!' (Opsional)
Jika Bos sedang terburu-buru dan ingin melihat kartu visual Rich Embed instan tanpa narasi AI:
- **`!cuaca <nama kota>`** — Menampilkan kartu embed cuaca lengkap (misal: `!cuaca Bandung`).
- **`!search <kata kunci>`** atau **`!cari <query>`** — Menampilkan kartu embed 5 tautan hasil pencarian web teratas (misal: `!search resep nasi goreng`).
- **`!baca <link web>`** — Membaca dan membuat rangkuman poin-poin penting dari URL yang dilampirkan.

### L. Personal Analytics & Proactive Insights (Phase 6)
Jarvis kini memiliki mesin analisis data personal yang secara otomatis menghitung performa produktivitas tugas, kesehatan anggaran finansial, dan kedisiplinan agenda Bos:

#### 1. Dashboard Eksekutif Visual (`!analytics`)
Ketik **`!analytics`**, **`!analisis`**, atau **`"amba analisis"`** untuk memunculkan kartu **Executive Analytics Dashboard**:
- **🏆 Skor Produktivitas Jarvis (0 - 100):** Nilai komposit yang dievaluasi dari rasio tugas selesai, surplus kas, dan ketepatan waktu pengingat lengkap dengan visual ASCII Progress Bar (`[████████░░] 80%`).
- **📋 Metrik Tugas (Tasks):** Jumlah tugas selesai, pending, sedang dikerjakan, dan peringatan tugas overdue (lewat batas waktu).
- **💰 Kesehatan Finansial (Finance):** Total pemasukan, total pengeluaran, saldo bersih, persentase perubahan dibanding periode sebelumnya, dan rincian pos kategori pengeluaran terbesar.
- **⏰ Ketepatan Agenda (Reminders):** Jumlah pengingat terkirim, frekuensi ditunda (*snoozed*), dan persentase keandalan jadwal.
- **💡 Wawasan Cerdas AI (Proactive Advice):** Evaluasi personal dan rekomendasi actionable dari Amba untuk membantu Bos mengoptimalkan hari.

#### 2. Varian Perintah Analitik
- **Berdasarkan Kategori:**
  - `!analytics finance` / `!analytics keuangan` — Menampilkan rincian mendalam arus kas, kategori pengeluaran, dan transaksi tunggal terbesar.
  - `!analytics task` / `!analytics tugas` — Menampilkan rincian tingkat penyelesaian tugas dan prioritas tinggi.
- **Berdasarkan Periode:**
  - `!analytics week` — Menampilkan analitik khusus untuk minggu berjalan (dibandingkan dengan minggu lalu).
  - `!analytics month` — Menampilkan analitik bulanan (default).

#### 3. Percakapan Alami (Natural Conversation)
Bos juga bisa bertanya santai kapan saja saat mengobrol:
- *"Amba, pengeluaran gue bulan ini paling banyak apa ya?"*
- *"Gimana performa tugas dan produktivitas gue minggu ini?"*
- *"Amba, analisis keuangan gue dong"*
- *"Berapa selisih pengeluaran gue dibanding pemasukan?"*
*Amba akan langsung menghitung data riil dari database dan menjawab pertanyaan Bos secara spesifik, ramah, dan solutif.*

---

### M. Keamanan, Perizinan & Jejak Audit (Phase 7)

Jarvis V2 dilengkapi dengan sistem keamanan berlapis berstandar enterprise untuk memastikan privasi data, kontrol akses terstruktur, dan perlindungan terhadap kebocoran kredensial:

#### 1. Tingkatan Hak Akses (Role-Based Access Control / RBAC)
Sistem membedakan pengguna ke dalam 5 tingkatan perizinan:
- 👑 **OWNER (Level 4):** Pemilik sistem utama (**kicenzeus** / ID yang dikonfigurasi). Memiliki wewenang penuh untuk menetapkan role pengguna lain, mereset data massal, mematikan/restart bot, dan mengakses seluruh audit log.
- 🛡️ **ADMIN (Level 3):** Administrator sistem. Dapat memeriksa role pengguna lain (`!role check`), melihat daftar pemilik/admin (`!role list`), serta menginspeksi log keamanan (`!audit`).
- ⭐ **USER (Level 2):** Pengguna terdaftar. Memiliki akses penuh terhadap asisten pribadi (catatan keuangan, tugas/todo, pengingat proaktif, memori, dashboard analitik, dan pencarian web).
- 👤 **GUEST (Level 1):** Pengguna tamu/publik di server. Hanya diizinkan melakukan percakapan read-only dan pencarian web umum tanpa hak menyimpan data pribadi ke database.
- 🚫 **BLOCKED (Level 0):** Akun yang dinonaktifkan atau diblokir. Seluruh interaksi langsung ditolak dan dicatat di audit log.

#### 2. Perintah Manajemen Role & Keamanan
- **`!myrole`** / **`!role my`** / **`"amba role gue apa?"`**:  
  Menampilkan kartu status akun, level perizinan, dan daftar fitur yang dapat Bos akses.
- **`!role list`** *(Admin/Owner)*:  
  Menampilkan daftar seluruh pengguna yang memiliki hak istimewa (Owner, Admin, atau Blocked).
- **`!role check @user`** *(Admin/Owner)*:  
  Memeriksa tingkatan role dan catatan penugasan akun anggota lain.
- **`!role set @user <ROLE> [catatan]`** *(Owner Only)*:  
  Mengubah role akun pengguna (contoh: `!role set @kicenzeus OWNER`, `!role set @budi ADMIN Partner proyek`).
- **`!audit [limit] [risk]`** *(Admin/Owner)*:  
  Menginspeksi catatan jejak audit aktivitas keamanan dan pemanggilan tool terkini (contoh: `!audit 15 high`).
- **`!security`** / **`!safety`**:  
  Menampilkan ringkasan status operasional sistem keamanan Jarvis V2.

#### 3. Credential Sanitizer & High-Risk Guard Otomatis
- **Pembersihan Otomatis Kredensial:** Setiap token Discord, API key (OpenAI/Gemini/Groq), connection string PostgreSQL, atau password secara otomatis diredaksi menjadi `[REDACTED]` sebelum ditampilkan ke chat Discord, disimpan ke audit log, maupun diucapkan di Voice Channel.
- **Proteksi Tindakan Berisiko Tinggi:** Permintaan destruktif massal (seperti reset seluruh transaksi atau tugas) wajib memiliki hak akses minimal **OWNER** dan memerlukan konfirmasi 2 langkah (*"Ketik 'ya lanjut' untuk mengeksekusi"*).

---

### N. Pemantauan Sistem, Diagnostik & Observabilitas (Phase 8)

Jarvis V2 dilengkapi dengan rangkaian fitur keandalan (*reliability*) dan observabilitas enterprise untuk memastikan operasional 24/7 yang stabil, transparan, dan tangguh:

#### 1. Diagnostik Kesehatan Real-Time (`!ping` / `!health` / `!status`)
Ketik **`!ping`**, **`!health`**, atau **`!status`** untuk memunculkan kartu status diagnostik:
- **🟢 Status Keseluruhan:** Indikator visual (`HEALTHY`, `DEGRADED`, atau `UNHEALTHY`).
- **⚡ Latensi Layanan Real-Time:**
  - **Discord WebSocket:** Latensi koneksi ke server Discord dalam milidetik (ms).
  - **PostgreSQL Database:** Waktu respons query internal dan jumlah koneksi pool aktif/idle.
  - **n8n Automation Gateway:** Waktu respons webhook alur kerja n8n.
- **💻 Resource & Memory RAM:**
  - Penggunaan memori fisik (*RSS Memory*) dan alokasi heap Node.js dalam MB.
  - Arsitektur dan versi runtime bot.
- **⏱️ Uptime & Metrik Operasional:**
  - Durasi bot aktif sejak terakhir kali dinyalakan (contoh: `2h 4j 15m 30d`).
  - Total pesan diproses, tingkat keberhasilan permintaan AI (*Success Rate %*), dan rata-rata waktu respons (*average latency*).
- **🎙️ Status Voice Engine & Disk Temp:**
  - Jumlah file audio sementara dan total kapasitas disk cache yang terpakai di folder `temp_audio/`.

#### 2. HTTP Health Check Endpoint (`GET /health`)
- Bot menyediakan endpoint HTTP internal di port **5001**:
  - `GET http://localhost:5001/health`
  - Mengembalikan payload JSON diagnostik lengkap dengan status kode `200 OK` (atau `503 Service Unavailable` jika database terganggu).
  - Dapat diintegrasikan dengan Docker Healthcheck, Uptime Kuma, atau monitoring eksternal lainnya.

#### 3. Bounded Retry Policy & Circuit Protection
- Setiap permintaan dari bot ke n8n dilindungi oleh kebijakan *bounded retry* (maksimal 2x percobaan ulang dengan *exponential backoff*: 1.5 detik, 3 detik).
- Jika terjadi gangguan jaringan sementara atau lonjakan beban (*transient HTTP 502/503/504*), bot akan mencoba ulang secara otomatis tanpa memicu *infinite loop* atau membebani sistem.

#### 4. Graceful Shutdown & Pemulihan Bersih
- Saat container atau bot dimatikan (`SIGTERM` / `SIGINT`):
  - Server HTTP ditutup secara aman.
  - Seluruh voice channel yang sedang tersambung diputus secara mulus.
  - Seluruh file audio sisa di folder `temp_audio/` otomatis dibersihkan dari disk.
  - Pool koneksi PostgreSQL ditutup tanpa ada transaksi yang menggantung.

#### 5. Utilitas Cadangan Database Otomatis (Backup & Restore)
- Tersedia script praktis di folder `backups/`:
  - **`backups\backup-db.bat`**: Membuat snapshot cadangan instan seluruh database PostgreSQL dengan penamaan timestamp (contoh: `backup_jarvis_20261015_103000.sql`).
  - **`backups\restore-db.bat <file.sql>`**: Memulihkan database dari snapshot cadangan yang dipilih dengan konfirmasi keamanan.

---

### O. Fitur Broadcast & Pengumuman Massal Serentak (WhatsApp & Discord)
Bos (Owner) atau Admin kini bisa menyiarkan pesan pengumuman penting secara serentak ke seluruh pengguna terdaftar:
- **Dari WhatsApp:** Chat ke nomor bot `!broadcast <pesan>` atau `amba broadcast: <pesan>` (atau `!broadcast wa <pesan>` / `!broadcast discord <pesan>`).
- **Dari Discord:** Ketik `!broadcast <pesan>` atau `!broadcast all <pesan>` di channel atau DM bot.
- **Dari PC Sekali Klik:** Double-click file **`broadcast.bat`** di folder project `D:\Dev\project\n8n\Jarvis` untuk mengirim pesan interaktif langsung dari desktop!
- Amba otomatis memformat pesan secara personal ke tiap pengguna:
  `📢 [PENGUMUMAN JARVIS AMBA]`
  `Halo <Nama Pengguna>!`
  `...`

---

## 3. Perintah Bantuan di Discord (`!help`)

Tersedia menu bantuan interaktif langsung di dalam Discord berupa Rich Embed yang estetik dan terstruktur:

- **`!help`** atau **`!h`** atau **`amba help`**:  
  Menampilkan menu panduan lengkap yang merangkum fitur Pemutar Musik dan Personal Assistant sekaligus.
- **`!help music`** atau **`!mhelp`**:  
  Menampilkan panduan khusus fitur Pemutar Musik dan Voice Channel.
- **`!help assistant`** atau **`!ahelp`**:  
  Menampilkan panduan khusus fitur Personal AI Assistant (Reminder, Task, Keuangan, Notes).

---

## 4. Identitas & Kredit Pembuat

- **Creator & Developer:** **kicenzeus** 🔥
- **Pertanyaan Pengguna:**  
  Jika ditanya *"siapa pembuat lu?"*, *"siapa creator kamu?"*, atau *"kamu dibuat siapa?"*, Amba akan selalu menjawab dengan bangga bahwa ia dirancang dan dikembangkan oleh **kicenzeus**.

---
*Selamat menggunakan Jarvis / Amba Bot! Dibuat dengan dedikasi penuh untuk produktivitas dan hiburan Anda.*
