# 🚀 Panduan Operasional & Dokumentasi Menjalankan Jarvis V2.1 (Dual-Channel: Discord & WhatsApp)

> **Pengembang & Arsitek:** **kicenzeus** 🔥  
> **Versi:** 2.1.0 (Dual-Channel Architecture — Discord + Meta WhatsApp Cloud API)  
> **Target Bot:** Discord (`Amba#2138`) & WhatsApp Resmi (`+62 822-2926-8677`)  
> **Tanggal Pembaruan:** Oktober 2026  

---

## 📑 Daftar Isi
1. [Arsitektur Sistem & Perbedaan Koneksi (Discord vs WhatsApp)](#1-arsitektur-sistem--perbedaan-koneksi)
2. [Kenapa Discord Tetap Nyaut tapi WhatsApp Tidak Saat Docker Restart?](#2-kenapa-discord-tetap-nyaut-tapi-whatsapp-tidak-saat-docker-restart)
3. [Cara Menjalankan Jarvis (Langkah Cepat)](#3-cara-menjalankan-jarvis-langkah-cepat)
4. [Cara Mengecek & Memperbarui URL Webhook WhatsApp](#4-cara-mengecek--memperbarui-url-webhook-whatsapp)
5. [Konfigurasi di Meta Developer Dashboard](#5-konfigurasi-di-meta-developer-dashboard)
6. [Cara Mengubah Profil, Nickname, Foto & Biodata](#6-cara-mengubah-profil-nickname-foto--biodata)
7. [Solusi Domain Statis Permanen (Opsional - Bebas Ganti URL)](#7-solusi-domain-statis-permanen-opsional)
8. [Checklist Uji Coba End-to-End](#8-checklist-uji-coba-end-to-end)
9. [Sistem Hak Akses Multi-Role (RBAC) & Gatekeeping Anti-Spam](#9-sistem-hak-akses-multi-role-rbac--gatekeeping-anti-spam)
10. [Fitur Broadcast & Pengumuman Massal (Instan & Terjadwal)](#10-fitur-broadcast--pengumuman-massal-instan--terjadwal)
11. [Perintah Penting Pemeliharaan & Debugging](#11-perintah-penting-pemeliharaan--debugging)

---

## 1. Arsitektur Sistem & Perbedaan Koneksi

Jarvis V2.1 mengoperasikan 4 container Docker yang saling terhubung dalam satu jaringan tertutup:

```
+-----------------------------------------------------------------------------------+
|                                 JARVIS ECOSYSTEM                                  |
|                                                                                   |
|  [ Discord Client ] <======== (Outbound WebSocket) ========> [ jarvis-bot ]       |
|                                                                     ^             |
|                                                                     |             |
|  [ Meta Cloud API ] === (Inbound Webhook) ===> [ jarvis-tunnel ] ---+ (port 5001) |
|                                                       |                           |
|                                                       v                           |
|                                              [ jarvis-n8n ] (AI Brain)            |
|                                                       |                           |
|                                                       v                           |
|                                            [ jarvis-postgres ] (Data & Memory)    |
+-----------------------------------------------------------------------------------+
```

### Komponen Container:
1. **`jarvis-postgres` (Port 5433 -> 5432):** Database PostgreSQL untuk memori jangka panjang, data task, reminder, log chat, dan pemetaan multi-channel user.
2. **`jarvis-n8n` (Port 5678):** Engine AI Workflow LangChain & Gemini Flash Lite + PostgreSQL Tool.
3. **`jarvis-bot` (Port 5001):** Node.js runtime untuk Discord Gateway, Voice Engine, Channel Abstraction Layer, dan WhatsApp Adapter.
4. **`jarvis-tunnel`:** Cloudflare Tunnel (`cloudflared`) resmi yang mengekspos endpoint internal bot (`http://bot:5001/webhook/whatsapp`) ke internet secara aman melalui HTTPS.

---

## 2. Kenapa Discord Tetap Nyaut tapi WhatsApp Tidak Saat Docker Restart?

| Aspek | Discord Bot | WhatsApp Meta Cloud API |
| :--- | :--- | :--- |
| **Arah Koneksi** | **Outbound (Keluar)** | **Inbound (Masuk)** |
| **Mekanisme** | Bot lokal menghubungi server Discord lewat WebSocket Gateway. | Server Meta di internet mengirim HTTP POST ke URL server lokal. |
| **Ketergantungan IP/URL** | **TIDAK BUTUH URL PUBLIK.** Bot otomatis terkoneksi ulang saat Docker menyala. | **WAJIB URL PUBLIK VALID.** Meta hanya bisa mengirim pesan jika URL Callback-nya benar. |
| **Dampak Restart Docker** | Langsung online dan nyaut normal. | **Cloudflare Quick Tunnel (`trycloudflare.com`) memberikan subdomain acak baru setiap kali container di-restart.** Jika URL di Meta Dashboard belum diubah ke URL baru, pesan WhatsApp tidak akan pernah sampai ke bot lokal! |

---

## 3. Cara Menjalankan Jarvis (Langkah Cepat)

### Metode 1: Sekali Klik (Rekomendasi Utama) ⭐
1. Pastikan **Docker Desktop** sudah menyala (ikon paus di taskbar Windows aktif).
2. Masuk ke folder project: `D:\Dev\project\n8n\Jarvis`.
3. Double-click file **`start-jarvis.bat`**.
4. Script akan otomatis:
   - Menjalankan ke-4 container (`docker compose up -d`).
   - Memastikan koneksi Discord Bot online.
   - Mengambil URL Webhook WhatsApp aktif dari Cloudflare Tunnel dan langsung mengetes responnya.
   - Menampilkan URL Callback yang perlu dicocokkan ke Meta Dashboard.

### Metode 2: Manual via Terminal (PowerShell / CMD)
```bash
# 1. Masuk ke direktori project
cd D:\Dev\project\n8n\Jarvis

# 2. Jalankan seluruh container
docker compose up -d

# 3. Cek URL WhatsApp Webhook aktif
node scripts/check-whatsapp.js

# 4. Cek log bot Discord & WhatsApp
docker logs -f jarvis-bot
```

### Cara Mematikan Sistem:
- Double-click file **`stop-jarvis.bat`**, ATAU
- Jalankan perintah: `docker compose stop`.

---

## 4. Cara Mengecek & Memperbarui URL Webhook WhatsApp

Kapan saja Anda merestart Docker atau merasa WhatsApp tidak merespon:
1. Double-click file **`check-whatsapp-url.bat`** di folder project.
2. Script akan menampilkan informasi seperti ini:
   ```text
   ===================================================================
          JARVIS V2.1 - STATUS WHATSAPP META WEBHOOK & TUNNEL         
   ===================================================================

   📌 INFORMASI UNTUK META DEVELOPER DASHBOARD:
   -------------------------------------------------------------------
   🔗 URL Callback    : https://layout-quebec-competing-sur.trycloudflare.com/webhook/whatsapp
   🔑 Token Verifikasi: jarvis_amba_wa_secret_2026
   -------------------------------------------------------------------

   🔍 Menguji respon webhook lokal melalui tunnel...
   ✅ Webhook Endpoint: ONLINE & VALID! (Respon 200 OK)
   ```
3. Copy **URL Callback** tersebut dan ikuti langkah di Bagian 5 di bawah ini.

---

## 5. Konfigurasi di Meta Developer Dashboard

1. Buka browser dan login ke **[Meta App Dashboard](https://developers.facebook.com/apps/)**.
2. Pilih aplikasi: **`Jarvis Amba`**.
3. Di bilah menu sebelah kiri, buka **WhatsApp** ➡️ **Konfigurasi**.
4. Di kartu **Webhook**, klik tombol **Edit**:
   - **URL Callback:** Tempel URL hasil dari `check-whatsapp-url.bat`  
     *(Contoh: `https://layout-quebec-competing-sur.trycloudflare.com/webhook/whatsapp`)*
   - **Token Verifikasi:** `jarvis_amba_wa_secret_2026`
5. Klik **Verifikasi dan Simpan**.
6. Klik **Kelola Bidang Webhook** (*Manage Webhook Fields*), pastikan baris **`messages`** berstatus **Berlangganan (*Subscribed*)**.

---

## 6. Cara Mengubah Profil, Nickname, Foto & Biodata

Di Jarvis V2.1, terdapat dua jenis profil yang dapat Anda ubah:
1. **Profil Bisnis Bot WhatsApp (Nama Bot, Foto Profil / Avatar, Deskripsi Bisnis / Bio)**.
2. **Profil & Panggilan Pengguna (Nickname/Callsign "Bos", Biodata, & Memori AI)**.

---

### A. Mengubah Profil Bot WhatsApp (Foto Profil, Nama Tampilan, & Bio)

Profil WhatsApp bot dikelola langsung melalui **WhatsApp Manager di Meta Business Suite**:

1. **Buka WhatsApp Manager:**
   - Akses tautan langsung: **[WhatsApp Manager - Nomor Telepon](https://business.facebook.com/wa/manage/phone-numbers/)**
   - Atau dari [Meta App Dashboard](https://developers.facebook.com/apps/) ➡️ Pilih **`Jarvis Amba`** ➡️ Menu bilah kiri **WhatsApp** ➡️ **Memulai** ➡️ Pada tabel nomor telepon, klik tautan akun bisnis.
2. **Pilih Nomor Bot:**
   - Klik pada nomor telepon bot: **`+62 822-2926-8677`** (atau klik ikon profil/roda gigi di samping nomor).
3. **Ubah Informasi Profil Bot:**
   - **Foto Profil WhatsApp:** Klik tombol **Unggah Gambar** (*Upload Image*) untuk memasang avatar bot (disarankan gambar persegi, minimal 640x640 px).
   - **Deskripsi Profil (Bio/About):** Tuliskan bio bot (contoh: *"Personal AI Assistant cerdas & solutif dikembangkan oleh kicenzeus"*).
   - **Kategori Bisnis:** Pilih kategori yang sesuai (contoh: *Layanan Profesional* atau *Teknologi Informasi*).
   - **Email & Situs Web:** Masukkan alamat email kontak Anda dan link repositori GitHub project ini.
4. **Mengubah Nama Tampilan (Display Name / Nickname Bot):**
   - Nama tampilan bot saat ini adalah **`Jarvis Amba`**.
   - Jika ingin mengubah nama tampilan ini, di halaman nomor telepon yang sama klik **Edit Nama Tampilan** (*Edit Display Name*), masukkan nama baru, lalu kirim untuk ditinjau oleh Meta.
5. Klik **Simpan** di bagian bawah. Avatar dan bio profil baru akan langsung tampak di aplikasi WhatsApp seluruh pengguna yang menyimpan nomor bot!

---

### B. Mengubah Panggilan (Callsign) & Biodata Pengguna (User Identity & Memory)

Jarvis Core V2.1 dilengkapi sistem memori personal persisten. Anda bisa mengatur panggilan khusus dan biodata Anda secara langsung lewat percakapan alami tanpa perlu menyentuh kode:

#### 1. Mengubah Panggilan / Callsign ("Bos", "Komandan", dll.)
- **Cukup chat ke bot di WhatsApp atau Discord:**
  - *"amba mulai sekarang panggil gue Bos"*
  - *"amba ubah panggilan gue jadi Komandan"*
  - *"panggil gue Bro"*
- **Cara Kerja Sistem:**
  - AI secara otomatis mengeksekusi query `UPSERT` ke tabel database `users` (kolom `callsign`).
  - Amba akan langsung merespon konfirmasi, dan mulai saat itu akan memanggil Anda secara konsisten dengan panggilan tersebut baik di WhatsApp maupun Discord.

#### 2. Menyimpan & Mengelola Biodata Diri (Long-Term Memory)
- **Simpan data/fakta penting Anda:**
  - *"amba catat biodata gue: nama asli Kicen, umur 22 tahun, mahasiswa, hobi ngoding & musik"*
  - *"amba ingat ya gue alergi udang dan gak suka makanan pedas"*
  - *"ingat nomor rekening BCA gue: 1234567890"*
- **Melihat ingatan yang tersimpan:**
  - Chat: *"amba apa aja yang lu ingat tentang gue?"* atau *"tampilkan biodata gue"*
- **Menghapus atau melupakan ingatan:**
  - Chat: *"amba lupakan tentang alergi udang"*
- **Cara Kerja Sistem:**
  - Informasi tersimpan di tabel `memories` dengan tipe `PROFILE` atau `PREFERENCE`. Setiap Anda mengirim chat baru, memori aktif ini disuntikkan ke otak AI n8n sehingga Jarvis selalu memahami konteks pribadi Anda.

#### 3. Mengubah Langsung via Database PostgreSQL (Opsional)
Jika ingin mengubah langsung melalui terminal/SQL:
```sql
-- Mengubah nama dan panggilan di tabel users:
UPDATE users 
SET display_name = 'KicenZeus', callsign = 'Bos', reminder_style = 'santai'
WHERE discord_user_id = '713137141072396370';

-- Melihat daftar memori aktif:
SELECT key, value, type, importance FROM memories 
WHERE user_id = '713137141072396370' AND status = 'ACTIVE';
```

---

## 7. Solusi Domain Statis Permanen (Opsional)

Jika Anda **tidak ingin repot meng-copy URL baru** setiap kali Docker di-restart, gunakan **Cloudflare Named Tunnel** (Gratis 100%):

1. Daftar akun gratis di [Cloudflare Zero Trust](https://one.dash.cloudflare.com/).
2. Buka **Networks** ➡️ **Tunnels** ➡️ Klik **Create a Tunnel**.
3. Pilih opsi **Cloudflared** dan beri nama misalnya `jarvis-tunnel`.
4. Anda akan mendapatkan **Tunnel Token** (kode panjang berawalan `ey...`).
5. Pada tab **Public Hostname**:
   - Tambahkan Public Hostname (misal: `jarvis-wa.domainanda.com`).
   - Service: `HTTP` ke `bot:5001`.
6. Di file `docker-compose.yml`, cukup ganti baris service tunnel menjadi:
   ```yaml
   tunnel:
     image: cloudflare/cloudflared:latest
     container_name: jarvis-tunnel
     restart: unless-stopped
     command: tunnel run --token <MASUKKAN_TUNNEL_TOKEN_DI_SINI>
   ```
7. Masukkan domain tetap Anda (`https://jarvis-wa.domainanda.com/webhook/whatsapp`) ke Meta Dashboard sekali saja untuk selamanya!

---

## 8. Checklist Uji Coba End-to-End

Setelah URL tersambung di Meta Dashboard, lakukan uji coba langsung dari WhatsApp ke nomor bot (`+62 822-2926-8677`):

1. **Tes Sapaan Personal (Teks):**
   - Chat: *"halo amba"* atau *"amba halo"*
   - **Ekspektasi:** Amba membalas ramah dan otomatis memanggil *"Bos"* sesuai preferensi callsign tersimpan.
2. **Tes Database & Task:**
   - Chat: *"catat task: cek laporan magang besok jam 10"*
   - **Ekspektasi:** Amba menyimpan task ke tabel `tasks` dan memberikan konfirmasi rapi.
3. **Tes Reminder Real-Time:**
   - Chat: *"ingetin gue minum air putih 2 menit lagi"*
   - **Ekspektasi:** Setelah 2 menit, n8n scheduler memicu bot dan notifikasi otomatis masuk langsung ke WhatsApp Anda!
4. **Tes Voice Note (Rekaman Suara STT - Phase 5):**
   - Tahan tombol mic WhatsApp di HP Anda, bicaralah santai (misal: *"Amba, lagi ngapain?"* atau *"Amba, catat pengeluaran 25 ribu buat makan bakso"*).
   - **Ekspektasi:** Bot mengunduh audio, mentranskripsi suara secara akurat menggunakan Gemini Speech-to-Text, memproses perintah, dan membalas secara personal!
5. **Tes Analisis Gambar / Foto (Vision AI - Phase 5):**
   - Kirim foto apa saja (jadwal, tabel, struk belanja, barang, atau pemandangan) dengan atau tanpa caption.
   - **Ekspektasi:** Amba membaca dan memahami isi gambar menggunakan Gemini Vision, lalu menjelaskan informasinya secara cerdas.
6. **Tes Balasan Suara (Voice Response TTS - Phase 5):**
   - Chat: *"amba buatin gombalan bales pake suara"* atau *"cerita lucu suara aja"*
   - **Ekspektasi:** Amba membalas langsung menggunakan **pesan audio Voice Note resmi** (tanpa teks berulang bila diminta suara saja).
7. **Tes Pengaturan Notifikasi Multi-Channel & Proaktif (Phase 6):**
   - Chat di Discord atau WhatsApp:
     - *"atur notif reminder both"* atau *"kirim reminder ke whatsapp"*
     - *"atur briefing pagi ke whatsapp"*
     - *"atur jam tenang 22:00 07:00"*
     - *"cek notifikasi"*
   - **Ekspektasi:** Sistem smart-routing otomatis menentukan apakah pengingat dan briefing dikirimkan ke Discord, WhatsApp, atau keduanya, serta menghormati jam tenang (*Quiet Hours*).
8. **Tes Proteksi Anti-Spam & Rate Limit (Phase 7):**
   - Jika pengguna mengirim pesan beruntun identik dalam < 2 detik atau melebihi 20 pesan/menit, sistem otomatis meredam spam demi menjaga stabilitas dan kuota API.
9. **Tes Endpoint Kesehatan Sistem (Phase 8):**
   - Akses: `http://localhost:5001/health`
   - **Ekspektasi:** Menampilkan status `HEALTHY` komprehensif mencakup Database, n8n, WhatsApp Meta Cloud API, System Memory, dan Voice Audio.
10. **Tes Paritas Discord:**
    - Ketik `!help` atau `cek` di Discord `#general`.
    - **Ekspektasi:** Bot Discord dan WhatsApp aktif bersamaan secara mulus tanpa saling mengganggu.

---

---

## 9. Sistem Hak Akses Multi-Role (RBAC) & Gatekeeping Anti-Spam

Untuk menjaga keamanan kuota LLM (Google Gemini Flash), kestabilan memori database, dan privasi asisten, Jarvis V2.1 menerapkan sistem otorisasi Role-Based Access Control (RBAC) lintas WhatsApp dan Discord.

### 🛡️ Matriks Hak Akses Per Role:

| Role | Level | Hak Akses Fitur WhatsApp & Discord | Siapa yang Dapat Mendaftarkan? |
| :--- | :---: | :--- | :--- |
| **👑 OWNER** | Level 4 | **Akses Total (Superuser):**<br>• Manajemen role (`!role set`, `!role list`)<br>• Pendaftaran user baru (`!daftar`)<br>• Broadcast instan & terjadwal (`!broadcast`)<br>• Seluruh tool AI, task, reminder, finance, memory, dan system | Ditetapkan mutlak untuk Owner (`kicenzeus`, Discord Snowflake `713137141072396370` / `344840856006459392`, WhatsApp `6288991185737`). |
| **🛡️ ADMIN** | Level 3 | **Operasional & Pengawasan:**<br>• Cek role pengguna lain (`!role check`)<br>• Akses audit log & kesehatan sistem<br>• Seluruh fitur AI pribadi (Task, Reminder, Finance, Vision, Web Search, Audio/TTS) | **Hanya OWNER** |
| **👥 USER** | Level 2 | **Asisten AI Pribadi Lengkap:**<br>• Chat AI percakapan cerdas (n8n LangChain)<br>• Pencatatan tugas & jadwal pengingat (Reminder)<br>• Catatan keuangan & memori pribadi<br>• Voice note & sintesis audio TTS | **Hanya OWNER** |
| **👤 GUEST / Belum Terdaftar** | Level 1 | **Tamu & Pengguna Baru:**<br>• **WhatsApp:** Dihentikan di gerbang adapter (tidak diteruskan ke n8n). Menerima 1x pesan singkat untuk mendaftar ke Owner.<br>• **Discord Server:** **BEBAS menggunakan bot musik di voice channel** (`!play`, `!skip`, `!queue`, `!pause`, dll.) dan `!help`. Namun chat AI privat dibatasi.<br>• Anti-Spam Debounce: 12 jam (tidak akan membanjiri chat jika spam chat). | Tamu umum / nomor atau ID Discord yang belum didaftarkan oleh Owner. |

---

### 🚪 Mekanisme Gatekeeping (Hemat Kuota & Anti-Banjir Token)
Sebelumnya, setiap pesan masuk dari WhatsApp otomatis didaftarkan sebagai `USER`, yang berisiko menghabiskan token Gemini jika ada nomor asing/iseng yang mengirim pesan berulang kali.

**Di V2.1:**
1. **WhatsApp Adapter:** Nomor asing yang belum ada di database akan **langsung ditolak di batas adapter** tanpa memicu eksekusi AI di n8n.
2. Bot hanya membalas **1 kali pesan sopan**:
   > *"Halo! Nomor Anda belum terdaftar dalam sistem akses Jarvis Amba. Untuk pendaftaran atau izin akses, silakan hubungi Owner (KicenZeus). Terima kasih! 🙏"*
3. Sistem mengaktifkan **debounce 12 jam**: Jika nomor tersebut terus mengirim pesan, bot tidak akan merespon lagi agar kuota Meta Cloud API dan log tidak dipenuhi spam.
4. **Discord Channel Guild (Server Publik):**
   - Perintah musik (`!play`, `!skip`, `!queue`, `!pause`, `!resume`, `!stop`, `!help`) **dapat dipakai oleh SIAPAPUN** di dalam channel server.
   - Panggilan AI pribadi oleh akun non-terdaftar akan dibalas 1x pesan singkat bahwa musik tetap bebas dipakai, namun akses AI privat memerlukan izin Owner.

---

### 📝 Perintah Manajemen Role & Pendaftaran Pengguna (Khusus Owner)

Perintah ini dapat diketikkan langsung di **Discord** (DM atau Channel) maupun di **WhatsApp**:

#### 1. Mendaftarkan Pengguna Baru
```text
!daftar <nomor_wa_atau_id_discord> <nama_panggilan> [ROLE]
```
*Contoh:*
- WhatsApp: `!daftar 628123456789 Budi USER`
- Discord: `!daftar 841158598465159169 Andi ADMIN`
*(Jika role tidak ditulis, otomatis menjadi `USER`)*

#### 2. Mengubah Role Pengguna yang Sudah Ada
```text
!role set <nomor_atau_id_atau_@mention> <ROLE> [catatan]
```
*Contoh:*
- `!role set 628123456789 ADMIN Promosi tim inti`
- `!role set @Budi USER`

#### 3. Melihat Daftar Pengguna Terdaftar
```text
!role list
```
Menampilkan seluruh pengguna terdaftar, nomor WhatsApp/Discord ID, role aktif, dan waktu interaksi terakhir.

#### 4. Menghapus / Mengeluarkan Pengguna dari Database (Kick User)
```text
!kick <nomor_wa_atau_id_discord_atau_@mention> [alasan]
```
*Alias perintah:* `!hapus <target>`, `!user kick <target>`, `!role remove <target>`  
*Contoh:*
- Hapus user WhatsApp: `!kick 628123456789 Melanggar aturan`
- Hapus user Discord: `!kick 841158598465159169` atau `!kick @Andi`
- Akun yang di-kick akan **dihapus permanen dari database** dan hak perannya dicabut (kembali menjadi GUEST). Pesan mereka selanjutnya di WhatsApp maupun Discord akan **ditolak oleh gerbang anti-spam** sehingga tidak dapat mengakses bot AI lagi.
- *Catatan Keamanan:* Akun Owner utama (`kicenzeus`) dilindungi secara mutlak dan tidak dapat dihapus oleh siapa pun.

#### 5. Mengecek Role Diri Sendiri
```text
!myrole
```
Dapat dijalankan oleh **siapa saja** untuk melihat role akun saat ini.

---

## 10. Fitur Broadcast & Pengumuman Massal (Instan & Terjadwal)

Jarvis Amba memiliki kemampuan menyiarkan pengumuman atau pesan penting **secara serentak** maupun **terjadwal (reminder broadcast)** ke pengguna terdaftar di WhatsApp dan Discord.

> [!IMPORTANT]
> Fitur Broadcast (instan maupun terjadwal) **100% eksklusif hanya untuk OWNER** demi mencegah penyalahgunaan.

### Format Pesan Broadcast Otomatis:
```text
📢 *[PENGUMUMAN JARVIS AMBA]*
Halo <Nama Pengguna>!

<Isi pesan pengumuman Anda>

— Salam hangat, Asisten Jarvis Amba
```

---

### ⏰ Opsi Penjadwalan Waktu (Scheduler):
Sistem mendukung 3 format waktu jadwal yang fleksibel (Zona WIB):
- **Format Relatif:** `10m` (10 menit lagi), `1h` (1 jam lagi), `2d` (2 hari lagi).
- **Format Jam WIB:** `15:30` atau `08:00` (dieksekusi pada jam tersebut hari ini, atau besok jika jam sudah terlewat).
- **Format Tanggal Lengkap:** `2026-10-17 09:30` (tahun-bulan-tanggal jam:menit).

---

### 🎯 Opsi Filter Target Pengiriman:
- **Saluran:** `ALL` (WhatsApp & Discord), `wa` (hanya WhatsApp), `discord` (hanya Discord).
- **Role Pengguna:** `role:admin`, `role:user`, `role:owner`.
- **Kontak Tertentu:** `to:6288991185737,841158598465159169` (pisahkan koma).

---

### 📱 Cara Eksekusi Broadcast via Chat (WhatsApp / Discord):

#### A. Broadcast Instan (Kirim Detik Ini Juga)
- Ke semua pengguna:
  ```text
  !broadcast Halo semuanya, bot online kembali!
  ```
- Ke WhatsApp saja:
  ```text
  !broadcast wa Info pembaruan fitur WhatsApp!
  ```
- Ke kontak tertentu saja:
  ```text
  !broadcast to:6288991185737,628123456789 Halo Bos dan Tim!
  ```
- Ke role tertentu saja:
  ```text
  !broadcast role:admin Rapat tim admin malam ini jam 20.00 WIB
  ```

#### B. Broadcast Terjadwal (Scheduled Reminder)
- Kirim 15 menit lagi ke semua:
  ```text
  !broadcast jadwal 15m Jangan lupa submit laporan harian ya!
  ```
- Kirim pada jam 21:00 WIB ke pengguna WhatsApp:
  ```text
  !broadcast jadwal 21:00 wa Selamat istirahat semuanya!
  ```
- Kirim pada tanggal spesifik ke kontak tertentu:
  ```text
  !broadcast jadwal 2026-10-17 08:00 to:6288991185737 Selamat pagi Bos, jadwal audit sistem hari ini.
  ```

#### C. Memantau & Membatalkan Antrean Jadwal
- **Melihat antrean jadwal:**
  ```text
  !broadcast jadwal list
  ```
- **Membatalkan jadwal:**
  ```text
  !broadcast batal <ID_JADWAL>
  ```
  *Contoh:* `!broadcast batal 3`

---

### 💻 Cara Eksekusi via PC Windows (`broadcast.bat`) ⭐

1. Double-click file **`broadcast.bat`** di folder project (`D:\Dev\project\n8n\Jarvis`).
2. Muncul menu interaktif 5 pilihan:
   ```text
   ======================================================
   📢  JARVIS AMBA - BROADCAST & PENGUMUMAN MASSAL
   ======================================================
   Pilih Menu:
     1. 📢 Kirim Broadcast Instan (Kirim Sekarang)
     2. ⏰ Jadwalkan Broadcast (Terjadwal / Reminder)
     3. 📋 Lihat Daftar Jadwal Broadcast
     4. ❌ Batalkan Jadwal Broadcast
     5. 👥 Kelola Pengguna (Lihat Daftar & Hapus/Kick User)
     6. 🚪 Keluar
   ```
3. **Pemilihan Penerima Tanpa Perlu Mengetik Nomor Manual:**
   - Setelah memilih saluran tujuan (ALL / WhatsApp / Discord), sistem otomatis mengambil data pengguna aktif dan menampilkan pilihannya:
     - **Mode 1: SEMUA USER** — Menampilkan seluruh kontak lengkap dengan nomor urut, platform, nomor WA / Discord ID, nama, dan role:
       ```text
       📋 DAFTAR KONTAK TERDAFTAR (Saluran: ALL)
         (1) [WHATSAPP] 6288991185737    KicenZeus          👑 OWNER
         (2) [DISCORD ] 713137141072396370 KicenZeus          👑 OWNER
         (3) [DISCORD ] 1327340161675300949 𝚟𝚎𝚌𝚔𝚊𝚊       🛡️ ADMIN
         (4) [DISCORD ] 841158598465159169 boomer             🛡️ ADMIN
         (5) [WHATSAPP] 6281359944500    Firstyan Ferdi     👥 USER
       ```
       *Kirim ke semua:* Tekan **ENTER** atau ketik `SEMUA`.  
       *Pilih kontak tertentu:* Cukup ketik nomor urutnya (misal: `1, 5` atau `3, 4`). Tidak perlu memasukkan nomor HP atau Snowflake ID secara manual!
     - **Mode 2: Filter per ROLE** — Menampilkan hanya kontak dengan role yang dipilih (misal: `ADMIN`), dengan nomor urut `(1)`, `(2)`, dst. yang bisa dipilih nomornya atau langsung dikirimkan ke seluruh admin.

#### Atau via Terminal CLI Langsung:
```bash
# Lihat antrean jadwal aktif
node scripts/broadcast.js --list

# Jadwalkan broadcast 30 menit lagi
node scripts/broadcast.js --message "Tes reminder" --schedule "30m" --target ALL

# Batalkan jadwal nomor 3
node scripts/broadcast.js --cancel 3
```

---

## 11. Fitur Bantuan Chat Natural Amba (Conversational Command Help) & RBAC Privacy Guard ⭐

Pengguna dapat bertanya langsung kepada Amba di chat WhatsApp maupun Discord mengenai cara kerja atau perintah seputar bot. Amba akan menjawab dengan gaya obrolan natural yang santai dan ramah, **dengan proteksi privasi mutlak berdasarkan Role pengguna (RBAC Privacy Guard)**:

### 🛡️ Kebijakan Privasi Perintah Berdasarkan Role:
1. **👑 Khusus OWNER (Developer kicenzeus):**
   - Mendapatkan panduan lengkap dan terbuka untuk seluruh perintah administrasi (`!kick`, `!daftar`, `!role set`, `!role list`, `!broadcast`, menu PC `broadcast.bat`, dll).
2. **🛡️ Khusus ADMIN:**
   - **HANYA** diberikan informasi perintah yang merupakan hak akses role Admin (`!audit`, `!security`, `!myrole`, musik Discord, dan fitur operasional asisten).
   - Jika Admin bertanya tentang perintah `!kick`, `!daftar`, `!role set`, atau `!broadcast`: Amba **TIDAK AKAN** membocorkan perintah tersebut dan secara sopan menegaskan bahwa wewenang tersebut privat untuk Owner/Developer demi keamanan sistem.
3. **👥 Pengguna Biasa (USER / GUEST):**
   - **HANYA** diberikan informasi fitur pengguna biasa (chat AI, reminder pribadi, task pribadi, catatan, keuangan, suara/VN, `!myrole`, dan musik Discord).
   - Jika User biasa bertanya cara kick, cara daftar, cara ubah role, atau broadcast: Amba **DILARANG KERAS** memberikan format perintahnya (`!kick`, `!daftar`, dll.), melainkan menjelaskan secara santai dan sopan bahwa fitur tersebut merupakan privasi developer/owner dan mengarahkan mereka untuk menghubungi Owner.

### Contoh Tanggapan Amba Sesuai Role:
- **Jika USER Biasa Tanya Kick/Role:**
  > **User (USER):** *"amba gimana cara kick orang?"*  
  > **Amba:** *"Halo! Fitur manajemen pengguna, pengaturan role, dan broadcast pesan merupakan fitur privat yang dikhususkan khusus untuk **Developer / Owner** bot (kicenzeus), jadi pengguna biasa nggak punya akses ke perintah tersebut. Kalau ada laporan penting atau teman yang mau didaftarkan, langsung hubungi Owner ya!"*

- **Jika ADMIN Tanya Kick/Role:**
  > **Admin (ADMIN):** *"amba gimana cara kick orang?"*  
  > **Amba:** *"Halo! Perintah buat kick atau hapus pengguna dari sistem itu merupakan wewenang privat khusus **Owner / Developer** bot. Sebagai Admin, kamu punya akses ke perintah operasional seperti `!audit`, `!security`, `!myrole`, serta manajemen task & reminder. Kalau ada user yang perlu dikeluarkan, silakan koordinasikan ke Owner ya!"*

- **Jika OWNER Tanya Kick/Role:**
  > **Owner (OWNER):** *"amba gimana cara kick orang?"*  
  > **Amba:** Menjelaskan secara lengkap: format `!kick <target> [alasan]`, contoh Discord & WA, alias `!hapus`, dan opsi menu 5 di terminal `broadcast.bat` PC.

---

## 12. Perintah Penting Pemeliharaan & Debugging

Semua perintah dijalankan di terminal folder project (`D:\Dev\project\n8n\Jarvis`):

```bash
# 1. Melihat status seluruh container:
docker compose ps

# 2. Melihat log WhatsApp & Discord bot secara real-time:
docker logs --tail 30 -f jarvis-bot

# 3. Melihat log tunnel Cloudflare:
docker logs --tail 25 jarvis-tunnel

# 4. Melihat log AI workflow n8n:
docker logs --tail 25 jarvis-n8n

# 5. Rebuild bot setelah ada perubahan kode lokal:
docker compose up -d --build bot

# 6. Memeriksa daftar jadwal broadcast pending di database:
docker compose exec bot node -e "const db=require('./db'); db.query('SELECT id, scheduled_at, target_channel, status, message FROM scheduled_broadcasts WHERE status=\'PENDING\'').then(r=>console.table(r.rows)).then(()=>process.exit(0));"

# 7. Memeriksa seluruh pengguna terdaftar dan rolenya:
docker compose exec bot node -e "const security=require('./securityService'); security.listAllUsersWithRoles().then(r=>console.table(r)).then(()=>process.exit(0));"
```

---

*Dokumentasi ini adalah bagian resmi dari repositori Jarvis Amba V2.1. Pertahankan dokumentasi ini tetap mutakhir setiap kali ada perubahan arsitektur.*

