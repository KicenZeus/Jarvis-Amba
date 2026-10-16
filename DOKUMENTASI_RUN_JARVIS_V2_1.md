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
9. [Fitur Broadcast & Pengumuman Massal (WhatsApp & Discord)](#9-fitur-broadcast--pengumuman-massal-whatsapp--discord)
10. [Perintah Penting Pemeliharaan & Debugging](#10-perintah-penting-pemeliharaan--debugging)

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

## 9. Fitur Broadcast & Pengumuman Massal (WhatsApp & Discord)

Jarvis Amba memiliki kemampuan menyiarkan pengumuman atau pesan penting **secara serentak** ke seluruh pengguna yang sudah pernah berinteraksi/terdaftar di WhatsApp maupun Discord.

Pesan yang dikirimkan diformat secara personal dan sopan:
```text
📢 *[PENGUMUMAN JARVIS AMBA]*
Halo <Nama/Callsign Pengguna>!

<Isi pesan pengumuman Anda>

— Salam hangat, Asisten Jarvis Amba
```

> [!NOTE]
> Fitur ini **diproteksi secara ketat**. Hanya akun dengan role **OWNER** atau **ADMIN** (seperti `kicenzeus` / nomor `6288991185737`) yang diizinkan memicu pengiriman broadcast.

### Pilihan Cara Mengirim Broadcast:

#### Cara 1: Langsung dari WhatsApp (Paling Praktis) 📱
Kirim chat ke nomor bot Jarvis dari nomor WhatsApp Owner (`6288991185737`):
- Ke SEMUA pengguna (WhatsApp & Discord):
  ```text
  !broadcast Besok malam bot akan maintenance pembaruan fitur ya!
  ```
  atau
  ```text
  amba broadcast: Besok malam bot akan maintenance pembaruan fitur ya!
  ```
- Khusus pengguna WhatsApp saja:
  ```text
  !broadcast wa Info kuota WhatsApp bot sudah diperbarui!
  ```
- Khusus pengguna Discord saja:
  ```text
  !broadcast discord Ayo kumpul di Voice Channel malam ini!
  ```
Amba akan otomatis membalas laporan pengiriman real-time: jumlah terkirim, gagal, dan total akun terdaftar.

---

#### Cara 2: Langsung dari Discord Server / DM 💬
Di channel server Discord atau DM bot Amba (oleh Owner / Admin):
- Ke SEMUA pengguna:
  ```text
  !broadcast Halo kawan-kawan, ada fitur suara baru di Amba nih!
  ```
- Ke WhatsApp saja:
  ```text
  !broadcast wa Pengingat jadwal untuk tim WhatsApp
  ```
- Ke Discord saja:
  ```text
  !broadcast discord Pengumuman khusus member Discord
  ```

---

#### Cara 3: Sekali Klik dari PC Windows (`broadcast.bat`) 💻 ⭐
Jika Anda sedang di depan PC dan ingin mengirim pengumuman tanpa membuka chat:
1. Double-click file **`broadcast.bat`** di folder project (`D:\Dev\project\n8n\Jarvis`).
2. Masukkan pesan pengumuman yang ingin disiarkan.
3. Pilih saluran tujuan:
   - `1` = SEMUA SALURAN (WhatsApp & Discord)
   - `2` = Hanya WhatsApp
   - `3` = Hanya Discord
4. Tekan `y` untuk konfirmasi. Laporan detail pengiriman per user akan langsung muncul di layar terminal CMD!

---

#### Cara 4: Via Terminal CLI
```bash
# Kirim ke semua saluran
node scripts/broadcast.js "Halo semuanya, server online kembali!"

# Kirim ke saluran tertentu
node scripts/broadcast.js --target=wa "Khusus pengguna WhatsApp"
node scripts/broadcast.js --target=discord "Khusus pengguna Discord"
```

---

## 10. Perintah Penting Pemeliharaan & Debugging

Semua perintah dijalankan di terminal folder project (`D:\Dev\project\n8n\Jarvis`):

```bash
# 1. Melihat status seluruh container:
docker compose ps

# 2. Melihat log WhatsApp & Discord bot:
docker logs --tail 25 -f jarvis-bot

# 3. Melihat log tunnel Cloudflare:
docker logs --tail 25 jarvis-tunnel

# 4. Melihat log AI workflow n8n:
docker logs --tail 25 jarvis-n8n

# 5. Rebuild bot setelah ada perubahan kode lokal:
docker compose up -d --build bot

# 6. Memeriksa daftar user terdaftar di database:
docker compose exec bot node -e "const db=require('./db'); db.query('SELECT u.id, u.display_name, uc.channel_type, uc.external_user_id FROM users u JOIN user_channels uc ON uc.user_id = u.id').then(r=>console.table(r.rows)).then(()=>process.exit(0));"
```

---

*Dokumentasi ini adalah bagian resmi dari repositori Jarvis Amba V2.1. Pertahankan dokumentasi ini tetap mutakhir setiap kali ada perubahan arsitektur.*
