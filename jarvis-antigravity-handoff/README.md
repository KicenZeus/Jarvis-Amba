# Jarvis / Amba — Paket Handoff untuk Antigravity

Dokumentasi ini dibuat dari kondisi proyek yang sudah dikerjakan sampai 14 Oktober 2026. Gunakan paket ini sebagai konteks awal saat melanjutkan proyek di Antigravity IDE.

## Isi paket

- `CURRENT_STATE.md` — kondisi nyata yang sudah dibuat dan masalah terakhir.
- `PRD.md` — kebutuhan produk dan prioritas fitur.
- `ARCHITECTURE.md` — rancangan komponen dan aliran pesan.
- `DATA_MODEL.md` — model data awal dan ERD konseptual.
- `IMPLEMENTATION_PLAN.md` — tahapan implementasi dan kriteria selesai.
- `ANTIGRAVITY_PROMPT.md` — prompt siap salin ke Antigravity.
- `docs/` — salinan dokumentasi inti agar mudah dipindahkan ke folder `docs` proyek.
- `.env.example` — contoh variabel konfigurasi tanpa token rahasia.

## Cara menggunakan

1. Ekstrak ZIP ini.
2. Salin dokumen yang dibutuhkan ke `D:\Dev\project\n8n\Jarvis\docs\` (jangan menimpa file dokumentasi proyek yang sudah ada; gabungkan jika namanya sama).
3. Buka folder proyek `D:\Dev\project\n8n\Jarvis` di Antigravity.
4. Buka `ANTIGRAVITY_PROMPT.md`, lalu salin prompt-nya ke agent.
5. Minta agent memeriksa kode dan workflow yang benar-benar ada sebelum melakukan perubahan.

## Peringatan penting

- Jangan memasukkan token bot Discord atau API key ke file dokumentasi, prompt, Git, atau chat.
- File `.env` adalah rahasia dan jangan pernah ditimpa otomatis oleh agent.
- URL `webhook-test` hanya aktif saat workflow sedang menunggu test event. Untuk penggunaan normal, aktifkan workflow dan gunakan Production URL.
- Integrasi balasan Discord belum dianggap selesai. Error `405 Method Not Allowed` pada HTTP Request masih perlu diselesaikan; lihat `CURRENT_STATE.md`.
