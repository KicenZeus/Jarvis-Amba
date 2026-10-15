# Model Data Awal (ERD Konseptual)

Ini rancangan awal untuk fitur jangka menengah. **Belum tentu sudah dibuat di proyek saat ini.** Agent harus menyesuaikan rancangan ini setelah memilih database serta memeriksa implementasi aktual. Jangan membuat database/schema baru secara membabi buta jika proyek ternyata sudah punya penyimpanan.

## ERD

```mermaid
erDiagram
    USERS ||--o{ CONVERSATIONS : owns
    USERS ||--o{ NOTES : owns
    USERS ||--o{ TASKS : owns
    USERS ||--o{ REMINDERS : owns
    USERS ||--o{ SCHEDULE_EVENTS : owns
    USERS ||--o{ FINANCIAL_TRANSACTIONS : owns
    CONVERSATIONS ||--o{ MESSAGES : contains
    TASKS ||--o{ REMINDERS : may_trigger

    USERS {
      string id PK
      string discord_user_id UK
      string display_name
      string timezone
      boolean is_allowed
      datetime created_at
      datetime updated_at
    }
    CONVERSATIONS {
      string id PK
      string user_id FK
      string platform
      string discord_channel_id
      datetime created_at
      datetime updated_at
    }
    MESSAGES {
      string id PK
      string conversation_id FK
      string platform_message_id
      string direction
      string input_mode
      string output_mode
      text content
      string status
      datetime created_at
    }
    NOTES {
      string id PK
      string user_id FK
      string title
      text content
      string status
      datetime created_at
      datetime updated_at
    }
    TASKS {
      string id PK
      string user_id FK
      string title
      text description
      string status
      string priority
      datetime due_at
      datetime completed_at
      datetime created_at
      datetime updated_at
    }
    REMINDERS {
      string id PK
      string user_id FK
      string task_id FK
      string title
      datetime remind_at
      string status
      datetime sent_at
      datetime created_at
      datetime updated_at
    }
    SCHEDULE_EVENTS {
      string id PK
      string user_id FK
      string title
      text description
      datetime starts_at
      datetime ends_at
      string location
      string status
      datetime created_at
      datetime updated_at
    }
    FINANCIAL_TRANSACTIONS {
      string id PK
      string user_id FK
      string kind
      decimal amount
      string currency
      string category
      text description
      datetime occurred_at
      datetime created_at
      datetime updated_at
    }
```

## Entitas dan aturan

- `USERS`: pengguna Discord yang diizinkan. `discord_user_id` unik; jangan menggunakan username sebagai kunci karena dapat berubah.
- `CONVERSATIONS`: konteks percakapan per user/channel, hanya simpan data minimum yang dibutuhkan.
- `MESSAGES`: metadata untuk konteks dan troubleshooting. Tetapkan kebijakan retensi; tidak wajib menyimpan seluruh pesan mentah.
- `NOTES`: catatan milik user.
- `TASKS`: pekerjaan dengan status, prioritas, serta batas waktu opsional.
- `REMINDERS`: pengingat satu kali atau berulang pada iterasi berikutnya; status minimal `pending`, `sent`, `cancelled`, `failed`.
- `SCHEDULE_EVENTS`: jadwal dan rentang waktu. Validasi `ends_at >= starts_at`.
- `FINANCIAL_TRANSACTIONS`: `kind` minimal `income` atau `expense`, `amount > 0`, `currency` default `IDR`. Rekap harus menghitung dari data tersimpan, bukan perkiraan AI.

## Indeks/constraint yang disarankan

- Unique: `USERS.discord_user_id`.
- Indeks: `(REMINDERS.status, REMINDERS.remind_at)` untuk mencari reminder jatuh tempo.
- Indeks: `(TASKS.user_id, TASKS.status, TASKS.due_at)`.
- Indeks: `(FINANCIAL_TRANSACTIONS.user_id, occurred_at, kind)`.
- Idempotensi event Discord berdasarkan `platform_message_id` jika data pesan/event disimpan.
- Semua record pengguna memiliki FK pemilik supaya data user tidak tercampur.

## Catatan implementasi

1. Konfirmasi pilihan database dan lokasi runtime sebelum membuat migrasi. Untuk local-first gunakan database persisten yang didukung deployment, bukan hanya variabel di memori.
2. Simpan waktu dalam format yang konsisten (umumnya UTC) lalu tampilkan berdasarkan timezone user, default `Asia/Jakarta`.
3. Gunakan transaksi DB untuk operasi pencatatan keuangan/task bila beberapa perubahan harus atomik.
4. Jangan menyimpan token, kata sandi, atau audio berisi data pribadi ke tabel pesan.
5. Model ini bisa diperkecil untuk MVP, tetapi lakukan migrasi yang eksplisit agar tidak kehilangan data saat berkembang.
