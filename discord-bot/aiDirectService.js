/**
 * Direct Gemini AI Service with Native Function Calling / Tools
 * Memastikan Jarvis tetap cerdas membalas chat DAN terintegrasi penuh ke database Supabase
 * meskipun n8n mati.
 *
 * Fitur Lengkap Terintegrasi Database:
 * 1. Keuangan / Pengeluaran & Pemasukan (financial_transactions)
 * 2. Pengingat / Alarm (reminders)
 * 3. Jadwal & Agenda Acara (schedules)
 * 4. Tugas & To-Do List (tasks)
 * 5. Memori & Fakta Pengguna (memories)
 * 6. Profil & Panggilan Callsign (users.callsign)
 * 7. Catatan Pribadi (notes)
 */

const db = require('./db');
const { normalizePriority, getPriorityBadge } = require('./scheduleService');

/**
 * Parsing waktu fleksibel (ISO string, HH:mm, atau relatif) ke objek Date (Akurat WIB UTC+7)
 */
function parseDateTimeWIB(timeStr) {
    if (!timeStr) return null;
    const str = String(timeStr).trim();

    // 1. Format ISO lengkap dengan offset timezone (+07:00 atau Z)
    if (/T.*(\+|-|Z)/i.test(str)) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d;
    }

    // 2. Format ISO / date time tanpa timezone (contoh: 2026-11-06T17:00:00 atau 2026-11-06 17:00) -> asumsikan WIB (UTC+7)
    const isoNoTz = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (isoNoTz) {
        const Y = parseInt(isoNoTz[1], 10);
        const M = parseInt(isoNoTz[2], 10);
        const D = parseInt(isoNoTz[3], 10);
        const h = parseInt(isoNoTz[4], 10);
        const m = parseInt(isoNoTz[5], 10);
        const s = parseInt(isoNoTz[6] || '0', 10);
        return new Date(Date.UTC(Y, M - 1, D, h - 7, m, s));
    }

    // 3. Format jam saja (contoh: 17:00 atau 17.00)
    const timeMatch = str.match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?$/);
    if (timeMatch) {
        const h = parseInt(timeMatch[1], 10);
        const m = parseInt(timeMatch[2], 10);
        const s = parseInt(timeMatch[3] || '0', 10);

        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).formatToParts(new Date()).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});

        const Y = parseInt(parts.year, 10);
        const M = parseInt(parts.month, 10);
        const D = parseInt(parts.day, 10);

        let targetUtc = new Date(Date.UTC(Y, M - 1, D, h - 7, m, s));
        const nowUtc = new Date();

        // Jika jam tersebut sudah lewat lebih dari 1 menit hari ini, jadwalkan untuk besok
        if (targetUtc.getTime() <= nowUtc.getTime() - 60000) {
            targetUtc = new Date(Date.UTC(Y, M - 1, D + 1, h - 7, m, s));
        }
        return targetUtc;
    }

    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
}

function formatWIBShort(dateObj) {
    if (!dateObj) return '';
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(dateObj)) + ' WIB';
}

function formatRupiah(amount) {
    const num = Math.round(Number(amount) || 0);
    return 'Rp ' + num.toLocaleString('id-ID');
}

const TOOLS_DECLARATIONS = [
    // --- 1. KEUANGAN (FINANCIAL TRANSACTIONS) ---
    {
        name: 'record_transaction',
        description: 'Mencatat transaksi keuangan (pengeluaran atau pemasukan) pengguna ke database. Gunakan saat pengguna menyebutkan pengeluaran (misal: "beli kopi 25rb", "bayar tagihan listrik 150rb", "pengeluaran 50000 buat makan") atau pemasukan (misal: "dapat gaji 5jt", "terima transfer 200rb").',
        parameters: {
            type: 'OBJECT',
            properties: {
                kind: {
                    type: 'STRING',
                    enum: ['expense', 'income'],
                    description: 'Jenis transaksi: "expense" untuk pengeluaran/belanja/bayar, "income" untuk pemasukan/gaji/transfer masuk.',
                },
                amount: {
                    type: 'NUMBER',
                    description: 'Nominal uang dalam angka murni rupiah (contoh: 25000, 50000, 1500000). Konversikan "rb" -> 000, "jt" -> 000000.',
                },
                description: {
                    type: 'STRING',
                    description: 'Keterangan barang/keperluan transaksi (contoh: "Makan siang bakso", "Beli bensin Pertamax", "Gaji bulanan").',
                },
                category: {
                    type: 'STRING',
                    enum: ['makanan', 'transportasi', 'belanja', 'hiburan', 'tagihan', 'kesehatan', 'pendidikan', 'pendapatan', 'lainnya'],
                    description: 'Kategori transaksi (default: "makanan" jika makanan/minuman, "transportasi" jika bensin/ojek, "tagihan" jika listrik/pulsa, dll.)',
                },
                occurred_at: {
                    type: 'STRING',
                    description: 'Waktu transaksi jika disebutkan secara khusus (format ISO 8601 atau jam). Kosongkan jika transaksi terjadi hari ini/sekarang.',
                },
            },
            required: ['kind', 'amount', 'description'],
        },
    },
    {
        name: 'get_finances',
        description: 'Melihat rangkuman dan riwayat transaksi keuangan (pengeluaran dan/atau pemasukan) pengguna dari database. Gunakan saat pengguna bertanya pengeluarannya ("berapa pengeluaran gw hari ini?", "cek pengeluaran", "rekap keuangan minggu ini", "ada transaksi apa aja?").',
        parameters: {
            type: 'OBJECT',
            properties: {
                period: {
                    type: 'STRING',
                    enum: ['today', 'yesterday', 'this_week', 'this_month', 'all'],
                    description: 'Periode waktu yang ingin dicek: "today" (hari ini), "yesterday" (kemarin), "this_week" (minggu ini), "this_month" (bulan ini), atau "all" (semua). Default: "today".',
                },
                kind: {
                    type: 'STRING',
                    enum: ['all', 'expense', 'income'],
                    description: 'Jenis transaksi yang ingin dicek: "all" (semua), "expense" (hanya pengeluaran), "income" (hanya pemasukan). Default: "all".',
                },
                limit: {
                    type: 'INTEGER',
                    description: 'Jumlah maksimal daftar transaksi terbaru yang ditampilkan (default: 10)',
                },
            },
        },
    },
    {
        name: 'delete_transaction',
        description: 'Menghapus atau membatalkan catatan transaksi keuangan pengguna yang salah catat.',
        parameters: {
            type: 'OBJECT',
            properties: {
                transaction_id: { type: 'INTEGER', description: 'ID transaksi jika diketahui pengguna' },
                query: { type: 'STRING', description: 'Kata kunci keterangan transaksi yang ingin dihapus (contoh: "bakso", "kopi")' },
            },
        },
    },

    // --- 2. PENGINGAT (REMINDERS) ---
    {
        name: 'create_reminder',
        description: 'Membuat alarm pengingat waktu tertentu (reminder) yang akan mencolek/mengirim chat ke user pada jam tersebut. Gunakan HANYA saat pengguna meminta diingatkan pada waktu tertentu.',
        parameters: {
            type: 'OBJECT',
            properties: {
                title: {
                    type: 'STRING',
                    description: 'Kalimat pengingat yang lengkap, hangat, dan natural sesuai gaya sapaan user (contoh: "Bos, udah jam 17:00 nih waktunya beli kopi! ☕")',
                },
                remind_at: {
                    type: 'STRING',
                    description: 'Waktu pengingat dalam format ISO 8601 dengan offset timezone +07:00 (contoh: "2026-11-06T17:00:00+07:00" atau jam "17:00")',
                },
                priority: {
                    type: 'STRING',
                    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
                    description: 'Tingkat kepentingan pengingat (default: MEDIUM)',
                },
            },
            required: ['title', 'remind_at'],
        },
    },
    {
        name: 'get_reminders',
        description: 'Melihat daftar pengingat / alarm aktif milik pengguna yang belum dikirim (pending). Gunakan saat pengguna bertanya apa saja pengingatnya, ada alarm apa, dll.',
        parameters: {
            type: 'OBJECT',
            properties: {
                limit: { type: 'INTEGER', description: 'Jumlah maksimal pengingat (default: 10)' },
            },
        },
    },
    {
        name: 'delete_reminder',
        description: 'Menghapus atau membatalkan pengingat / alarm pengguna. Gunakan saat pengguna meminta membatalkan atau menghapus pengingat tertentu.',
        parameters: {
            type: 'OBJECT',
            properties: {
                reminder_id: { type: 'INTEGER', description: 'ID pengingat (jika diketahui pengguna)' },
                query: { type: 'STRING', description: 'Kata kunci judul pengingat yang ingin dibatalkan (contoh: "kopi", "makan")' },
            },
        },
    },

    // --- 3. JADWAL & AGENDA (SCHEDULES) ---
    {
        name: 'create_schedule',
        description: 'Mencatat jadwal/agenda/acara kegiatan terikat waktu (seperti rapat, apel pagi, kuliah, pertemuan). Berbeda dengan tugas (task) atau pengingat (reminder).',
        parameters: {
            type: 'OBJECT',
            properties: {
                title: { type: 'STRING', description: 'Nama acara / agenda kegiatan' },
                start_time: { type: 'STRING', description: 'Waktu mulai dalam format ISO 8601 (+07:00) atau jam "09:00"' },
                end_time: { type: 'STRING', description: 'Waktu selesai (opsional) dalam format ISO 8601 (+07:00)' },
                location: { type: 'STRING', description: 'Lokasi acara (opsional)' },
                priority: { type: 'STRING', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
            },
            required: ['title', 'start_time'],
        },
    },
    {
        name: 'get_schedules',
        description: 'Melihat daftar jadwal atau agenda kegiatan pengguna. Gunakan saat pengguna bertanya apa agenda hari ini, jadwal besok, jadwal rapat, dll.',
        parameters: {
            type: 'OBJECT',
            properties: {
                limit: { type: 'INTEGER', description: 'Jumlah maksimal jadwal (default: 10)' },
            },
        },
    },
    {
        name: 'cancel_schedule',
        description: 'Membatalkan atau menghapus jadwal agenda kegiatan dari database.',
        parameters: {
            type: 'OBJECT',
            properties: {
                schedule_id: { type: 'INTEGER', description: 'ID jadwal jika diketahui' },
                query: { type: 'STRING', description: 'Kata kunci nama agenda kegiatan yang ingin dibatalkan' },
            },
        },
    },

    // --- 4. TUGAS & TO-DO (TASKS) ---
    {
        name: 'create_task',
        description: 'Mencatat tugas atau to-do list pekerjaan yang harus diselesaikan (checklist pekerjaan). Berbeda dengan jadwal (acara) atau pengingat (alarm).',
        parameters: {
            type: 'OBJECT',
            properties: {
                title: { type: 'STRING', description: 'Nama tugas / hal yang harus dikerjakan' },
                description: { type: 'STRING', description: 'Rincian tugas (opsional)' },
                due_at: { type: 'STRING', description: 'Tenggat waktu pengerjaan (opsional) dalam format ISO 8601 (+07:00)' },
                priority: { type: 'STRING', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
            },
            required: ['title'],
        },
    },
    {
        name: 'get_tasks',
        description: 'Melihat daftar tugas atau to-do list pekerjaan pengguna yang belum selesai. Gunakan saat pengguna bertanya daftar tugas, apa kerjaan saya, checklist to-do, dll.',
        parameters: {
            type: 'OBJECT',
            properties: {
                limit: { type: 'INTEGER', description: 'Jumlah maksimal tugas (default: 15)' },
            },
        },
    },
    {
        name: 'complete_task',
        description: 'Menandai tugas / to-do list sebagai selesai (completed). Gunakan saat pengguna memberitahu bahwa tugas tertentu sudah beres atau selesai.',
        parameters: {
            type: 'OBJECT',
            properties: {
                task_id: { type: 'INTEGER', description: 'ID tugas (jika diketahui pengguna)' },
                query: { type: 'STRING', description: 'Kata kunci nama tugas yang telah diselesaikan' },
            },
        },
    },
    {
        name: 'delete_task',
        description: 'Menghapus to-do list / tugas dari database. Gunakan saat pengguna ingin membatalkan atau menghapus tugas.',
        parameters: {
            type: 'OBJECT',
            properties: {
                task_id: { type: 'INTEGER', description: 'ID tugas jika diketahui' },
                query: { type: 'STRING', description: 'Kata kunci judul tugas yang ingin dihapus' },
            },
        },
    },

    // --- 5. MEMORI & FAKTA PENGGUNA (MEMORIES) ---
    {
        name: 'save_memory',
        description: 'Menyimpan fakta, preferensi, pantangan, atau informasi penting tentang pengguna ke dalam database memori permanen. Gunakan saat pengguna meminta mengingat sesuatu (contoh: "ingat ya amba kalau gue alergi udang", "ukuran sepatu gw 42", "pacar gw namanya Salsa", "gw suka kopi tubruk").',
        parameters: {
            type: 'OBJECT',
            properties: {
                key: {
                    type: 'STRING',
                    description: 'Kata kunci/topik informasi (contoh: "alergi", "ukuran_sepatu", "nama_pacar", "kopi_favorit", "hobi"). Huruf kecil tanpa spasi (gunakan underscore).',
                },
                value: {
                    type: 'STRING',
                    description: 'Fakta atau isi informasi lengkap yang perlu diingat (contoh: "Alergi makanan laut terutama udang").',
                },
                type: {
                    type: 'STRING',
                    enum: ['PREFERENCE', 'PROFILE', 'HABIT', 'PROJECT', 'OTHER'],
                    description: 'Kategori memori (default: PREFERENCE)',
                },
            },
            required: ['key', 'value'],
        },
    },
    {
        name: 'get_memories',
        description: 'Melihat seluruh daftar ingatan / memori yang tersimpan tentang pengguna. Gunakan saat pengguna bertanya apa saja yang kamu ingat tentang dirinya ("apa yang kamu ingat tentang gue?", "ingatan apa aja yang lu tahu?", "apa fakta tentang gw?").',
        parameters: {
            type: 'OBJECT',
            properties: {
                limit: { type: 'INTEGER', description: 'Jumlah maksimal ingatan yang ditampilkan (default: 15)' },
            },
        },
    },
    {
        name: 'forget_memory',
        description: 'Menghapus atau melupakan ingatan tertentu dari database memori pengguna. Gunakan saat pengguna meminta melupakan suatu fakta ("lupakan kalau gw suka bakso", "hapus ingatan tentang X").',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: { type: 'STRING', description: 'Kata kunci memori yang ingin dilupakan (contoh: "alergi", "kopi")' },
            },
            required: ['query'],
        },
    },

    // --- 6. PANGGILAN / CALLSIGN (USERS) ---
    {
        name: 'set_user_callsign',
        description: 'Mengubah nama panggilan khusus (callsign) pengguna di database profil. Gunakan saat pengguna meminta dipanggil dengan nama tertentu (contoh: "panggil gw Bos", "panggil saya Komandan", "ganti panggilan jadi Kicen", "panggil aku Mas").',
        parameters: {
            type: 'OBJECT',
            properties: {
                callsign: {
                    type: 'STRING',
                    description: 'Nama panggilan baru yang diinginkan pengguna (contoh: "Bos", "Komandan", "Kapten", "Kicen").',
                },
            },
            required: ['callsign'],
        },
    },

    // --- 7. CATATAN PRIBADI (NOTES) ---
    {
        name: 'record_note',
        description: 'Menyimpan catatan penting, ide, tulisan, atau rangkuman pengguna ke dalam tabel notes database. Gunakan saat pengguna meminta mencatat ide atau hal panjang (contoh: "catat ini ya...", "bikin catatan: daftar belanja mingguan...", "catat ide bisnis...").',
        parameters: {
            type: 'OBJECT',
            properties: {
                title: { type: 'STRING', description: 'Judul catatan' },
                content: { type: 'STRING', description: 'Isi lengkap catatan' },
                category: { type: 'STRING', description: 'Kategori catatan (default: "general")' },
            },
            required: ['title', 'content'],
        },
    },
    {
        name: 'get_notes',
        description: 'Melihat daftar catatan pribadi pengguna dari database. Gunakan saat pengguna bertanya atau mencari catatannya ("lihat catatan gw", "apa aja catatan gw", "ada catatan apa tentang bisnis?").',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: { type: 'STRING', description: 'Kata kunci pencarian judul atau isi catatan (opsional)' },
                limit: { type: 'INTEGER', description: 'Jumlah maksimal catatan (default: 10)' },
            },
        },
    },
    {
        name: 'delete_note',
        description: 'Menghapus catatan tertentu milik pengguna dari database.',
        parameters: {
            type: 'OBJECT',
            properties: {
                note_id: { type: 'INTEGER', description: 'ID catatan jika diketahui' },
                query: { type: 'STRING', description: 'Kata kunci judul catatan yang ingin dihapus' },
            },
        },
    },
];

async function generateDirectGeminiReply({
    userMessage,
    userId = null,
    channelId = null,
    userName = 'Kawan',
    callsign = null,
    userRole = 'USER',
    memories = [],
    history = [],
    wantsVoice = false,
}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY tidak dikonfigurasi di environment variable.');
    }

    const effectiveUserId = userId || '713137141072396370';
    const phoneTarget = channelId ? String(channelId).replace(/^wa_/, '') : effectiveUserId;

    // Auto-fetch callsign & active memories dari Supabase jika belum terisi
    if (userId) {
        try {
            if (!callsign) {
                const uRes = await db.query(
                    'SELECT callsign, display_name FROM users WHERE id = $1 OR discord_user_id = $1 LIMIT 1',
                    [effectiveUserId]
                );
                if (uRes.rows[0]?.callsign) {
                    callsign = uRes.rows[0].callsign;
                }
            }

            if (!memories || memories.length === 0) {
                const mRes = await db.query(
                    `SELECT type, key, value 
                     FROM memories 
                     WHERE (user_id = $1 OR user_id = $2) AND status = 'ACTIVE' 
                     ORDER BY importance DESC, updated_at DESC LIMIT 8;`,
                    [effectiveUserId, phoneTarget]
                );
                memories = mRes.rows;
            }
        } catch (_) {}
    }

    const preferredGreeting = callsign || userName;
    let memoryBlock = '';
    if (Array.isArray(memories) && memories.length > 0) {
        memoryBlock = '\n\n[Ingatan/Memori Kamu tentang Pengguna Ini]:\n' +
            memories.map((m, i) => `${i + 1}. [${m.type || m.category || 'INFO'}] ${m.key ? `${m.key}: ` : ''}${m.value || m.fact || m.content}`).join('\n');
    }

    const now = new Date();
    const nowWIBStr = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(now) + ' WIB';

    const systemInstruction = `Kamu adalah Jarvis (sering dipanggil Amba), asisten AI pribadi yang cerdas, proaktif, ramah, dan berkarakter santai-asyik dalam Bahasa Indonesia.
Kamu melayani pengguna bernama "${preferredGreeting}" (Role: ${userRole}).
${callsign ? `PENTING: Pengguna ini punya panggilan khusus ("${callsign}"). Panggil dia dengan "${callsign}" secara konsisten.` : `Panggil pengguna dengan namanya ("${preferredGreeting}"). Jangan panggil "Bos" kecuali pengguna yang memintanya.`}
${memoryBlock}

WAKTU ACUAN SAAT INI:
Sekarang adalah: ${nowWIBStr} (Asia/Jakarta, UTC+7).
Gunakan waktu acuan ini untuk menghitung jika pengguna meminta "10 menit lagi", "nanti jam 4 sore", "hari ini", "kemarin", "besok", "lusa", dsb.

ATURAN PENGGUNAAN TOOLS (FUNGSI):
1. KEUANGAN (PENGELUARAN & PEMASUKAN):
   - Jika pengguna menyebutkan pengeluaran (beli ..., bayar ..., keluar uang ...) atau pemasukan (gaji, dapat uang, terima transfer ...):
     Panggil tool \`record_transaction\`! Pastikan 'amount' berupa angka murni Rupiah (contoh: 50rb -> 50000, 1.5jt -> 1500000).
   - Jika pengguna BERTANYA tentang keuangan ("berapa pengeluaran hari ini?", "cek pengeluaran", "rekap keuangan minggu ini", "daftar transaksi"):
     Panggil tool \`get_finances\`!
   - Jika pengguna membatalkan/menghapus transaksi:
     Panggil tool \`delete_transaction\`!

2. PENGINGAT (REMINDERS):
   - Jika pengguna meminta diingatkan pada jam tertentu:
     Panggil tool \`create_reminder\`!
     - Kolom 'title' pada pengingat AKAN DIKIRIM LANGSUNG KE CHAT USER SAAT JAMNYA TIBA!
     - Buatlah 'title' sebagai kalimat sapaan pengingat yang natural dan hangat (contoh: "${callsign || preferredGreeting}, udah jam 16:00 nih waktunya mandi! 🚿").
   - Jika pengguna bertanya daftar pengingat aktif:
     Panggil tool \`get_reminders\`!
   - Jika pengguna membatalkan/menghapus pengingat:
     Panggil tool \`delete_reminder\`!

3. JADWAL & AGENDA (SCHEDULES):
   - Jika pengguna mencatat jadwal/rapat/acara kegiatan terikat waktu:
     Panggil tool \`create_schedule\`! DILARANG memasukkannya ke tasks atau reminders.
   - Jika pengguna bertanya jadwal/agenda kegiatan:
     Panggil tool \`get_schedules\`!
   - Jika pengguna membatalkan jadwal acara:
     Panggil tool \`cancel_schedule\`!

4. TUGAS & TO-DO (TASKS):
   - Jika pengguna mencatat tugas/to-do list pekerjaan:
     Panggil tool \`create_task\`!
   - Jika pengguna bertanya daftar tugas:
     Panggil tool \`get_tasks\`!
   - Jika pengguna menyelesaikan tugas:
     Panggil tool \`complete_task\`!
   - Jika pengguna menghapus tugas:
     Panggil tool \`delete_task\`!

5. MEMORI & FAKTA PENGGUNA (MEMORIES):
   - Jika pengguna meminta mengingat sesuatu ("ingat ya kalau gue suka...", "ukuran sepatu gw 42", "pacar gw namanya Salsa"):
     Panggil tool \`save_memory\`!
   - Jika pengguna bertanya apa yang kamu ingat tentang dia ("apa yang lu ingat tentang gw?"):
     Panggil tool \`get_memories\`!
   - Jika pengguna meminta melupakan fakta tertentu:
     Panggil tool \`forget_memory\`!

6. PANGGILAN / CALLSIGN (USERS):
   - Jika pengguna meminta dipanggil dengan sebutan tertentu ("panggil gw Bos", "panggil aku Komandan"):
     Panggil tool \`set_user_callsign\`!

7. CATATAN PRIBADI (NOTES):
   - Jika pengguna meminta mencatat ide/tulisan ("catat ini ya...", "bikin catatan..."):
     Panggil tool \`record_note\`!
   - Jika pengguna melihat/mencari catatan:
     Panggil tool \`get_notes\`!
   - Jika pengguna menghapus catatan:
     Panggil tool \`delete_note\`!

8. Jika pengguna hanya menyapa, mengobrol, bercanda, atau bertanya hal umum tanpa instruksi data:
   Jawablah secara ramah, santai, dan asyik tanpa memanggil tools.

Gaya Bahasa:
- Bahasa Indonesia santai, akrab, solutif, dan ringkas.
- ${wantsVoice ? 'Pengguna meminta suara (Voice Note). Jangan pakai formatting simbol/tabel berlebihan.' : 'Gunakan formatting markdown secukupnya.'}
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;

    // STEP 1: Panggil Gemini dengan Tool Declarations
    const initialRequestBody = {
        system_instruction: {
            parts: [{ text: systemInstruction }],
        },
        contents: [
            {
                role: 'user',
                parts: [{ text: userMessage }],
            },
        ],
        tools: [{ function_declarations: TOOLS_DECLARATIONS }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
        },
    };

    const res1 = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initialRequestBody),
        signal: AbortSignal.timeout(20000),
    });

    if (!res1.ok) {
        const errJson = await res1.json().catch(() => null);
        throw new Error(errJson?.error?.message || `Gemini API returned HTTP ${res1.status}`);
    }

    const data1 = await res1.json();
    const candidate = data1.candidates?.[0];
    const firstPart = candidate?.content?.parts?.[0];

    // Jika Gemini memilih memanggil fungsi/tool
    if (firstPart && firstPart.functionCall) {
        const call = firstPart.functionCall;
        const fnName = call.name;
        const args = call.args || {};
        let toolResponse = { success: false };

        try {
            // ==========================================
            // 1. KEUANGAN (FINANCIAL TRANSACTIONS)
            // ==========================================
            if (fnName === 'record_transaction') {
                const kind = (args.kind || 'expense').toLowerCase();
                const amount = Math.abs(parseFloat(args.amount) || 0);
                if (amount <= 0) throw new Error('Nominal transaksi harus lebih dari 0.');

                const occurredAt = args.occurred_at ? parseDateTimeWIB(args.occurred_at) : new Date();
                const insertRes = await db.query(
                    `INSERT INTO financial_transactions (user_id, kind, amount, currency, category, description, occurred_at, created_at, updated_at)
                     VALUES ($1, $2, $3, 'IDR', $4, $5, $6, NOW(), NOW())
                     RETURNING *;`,
                    [
                        effectiveUserId,
                        kind,
                        amount,
                        args.category || (kind === 'expense' ? 'makanan' : 'pendapatan'),
                        args.description || (kind === 'expense' ? 'Pengeluaran' : 'Pemasukan'),
                        occurredAt.toISOString(),
                    ]
                );

                const saved = insertRes.rows[0];
                const formattedAmt = formatRupiah(saved.amount);
                console.log(`💰 [Direct Gemini] Berhasil mencatat ${saved.kind} #${saved.id}: ${formattedAmt} ("${saved.description}")`);

                toolResponse = {
                    success: true,
                    transaction_id: saved.id,
                    kind: saved.kind,
                    amount: saved.amount,
                    formatted_amount: formattedAmt,
                    category: saved.category,
                    description: saved.description,
                    occurred_at_wib: formatWIBShort(saved.occurred_at),
                };
            } else if (fnName === 'get_finances') {
                const period = args.period || 'today';
                const kindFilter = (args.kind || 'all').toLowerCase();

                let dateCondition = `TRUE`;
                let periodLabel = 'Hari Ini';
                if (period === 'today') {
                    dateCondition = `(occurred_at AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date`;
                    periodLabel = 'Hari Ini';
                } else if (period === 'yesterday') {
                    dateCondition = `(occurred_at AT TIME ZONE 'Asia/Jakarta')::date = ((NOW() AT TIME ZONE 'Asia/Jakarta') - INTERVAL '1 day')::date`;
                    periodLabel = 'Kemarin';
                } else if (period === 'this_week') {
                    dateCondition = `date_trunc('week', occurred_at AT TIME ZONE 'Asia/Jakarta') = date_trunc('week', NOW() AT TIME ZONE 'Asia/Jakarta')`;
                    periodLabel = 'Minggu Ini';
                } else if (period === 'this_month') {
                    dateCondition = `date_trunc('month', occurred_at AT TIME ZONE 'Asia/Jakarta') = date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta')`;
                    periodLabel = 'Bulan Ini';
                } else if (period === 'all') {
                    dateCondition = `TRUE`;
                    periodLabel = 'Semua Waktu';
                }

                let kindCondition = `TRUE`;
                if (kindFilter === 'expense') kindCondition = `kind = 'expense'`;
                if (kindFilter === 'income') kindCondition = `kind = 'income'`;

                const summaryRes = await db.query(
                    `SELECT 
                        COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
                        COALESCE(SUM(CASE WHEN kind = 'income' THEN amount ELSE 0 END), 0) AS total_income,
                        COUNT(*) AS total_count
                     FROM financial_transactions
                     WHERE (user_id = $1 OR user_id = $2)
                       AND deleted_at IS NULL
                       AND ${dateCondition};`,
                    [effectiveUserId, phoneTarget]
                );

                const listRes = await db.query(
                    `SELECT id, kind, amount, category, description, occurred_at
                     FROM financial_transactions
                     WHERE (user_id = $1 OR user_id = $2)
                       AND deleted_at IS NULL
                       AND ${dateCondition}
                       AND ${kindCondition}
                     ORDER BY occurred_at DESC
                     LIMIT $3;`,
                    [effectiveUserId, phoneTarget, args.limit || 10]
                );

                const totalExpense = parseFloat(summaryRes.rows[0]?.total_expense || 0);
                const totalIncome = parseFloat(summaryRes.rows[0]?.total_income || 0);
                const netBalance = totalIncome - totalExpense;

                const transactions = listRes.rows.map((t) => ({
                    id: t.id,
                    kind: t.kind,
                    amount: t.amount,
                    formatted_amount: formatRupiah(t.amount),
                    category: t.category,
                    description: t.description,
                    occurred_at_wib: formatWIBShort(t.occurred_at),
                }));

                console.log(`📊 [Direct Gemini] Keuangan [${periodLabel}]: Pengeluaran ${formatRupiah(totalExpense)}, Pemasukan ${formatRupiah(totalIncome)}`);

                toolResponse = {
                    success: true,
                    period: periodLabel,
                    total_expense: totalExpense,
                    formatted_expense: formatRupiah(totalExpense),
                    total_income: totalIncome,
                    formatted_income: formatRupiah(totalIncome),
                    net_balance: netBalance,
                    formatted_net_balance: formatRupiah(netBalance),
                    count: listRes.rowCount,
                    transactions,
                };
            } else if (fnName === 'delete_transaction') {
                let delRes;
                if (args.transaction_id) {
                    delRes = await db.query(
                        `UPDATE financial_transactions SET deleted_at = NOW() 
                         WHERE id = $1 AND (user_id = $2 OR user_id = $3) 
                         RETURNING id, description, amount;`,
                        [args.transaction_id, effectiveUserId, phoneTarget]
                    );
                } else if (args.query) {
                    delRes = await db.query(
                        `UPDATE financial_transactions SET deleted_at = NOW() 
                         WHERE id IN (
                             SELECT id FROM financial_transactions 
                             WHERE (user_id = $1 OR user_id = $2) AND deleted_at IS NULL AND description ILIKE $3
                             ORDER BY id DESC LIMIT 1
                         )
                         RETURNING id, description, amount;`,
                        [effectiveUserId, phoneTarget, `%${args.query}%`]
                    );
                }
                if (delRes && delRes.rowCount > 0) {
                    toolResponse = { success: true, deleted_id: delRes.rows[0].id, description: delRes.rows[0].description, amount: formatRupiah(delRes.rows[0].amount) };
                } else {
                    toolResponse = { success: false, error: 'Transaksi tidak ditemukan atau sudah dihapus.' };
                }

            // ==========================================
            // 2. PENGINGAT (REMINDERS)
            // ==========================================
            } else if (fnName === 'create_reminder') {
                const targetDate = parseDateTimeWIB(args.remind_at);
                if (!targetDate) throw new Error(`Format waktu pengingat "${args.remind_at}" tidak valid.`);

                const normPrio = normalizePriority(args.priority);
                const insertRes = await db.query(
                    `INSERT INTO reminders (user_id, channel_id, title, remind_at, priority, status, created_at)
                     VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
                     RETURNING *;`,
                    [
                        effectiveUserId,
                        channelId || (userId ? `wa_${phoneTarget}` : 'DEFAULT'),
                        args.title,
                        targetDate.toISOString(),
                        normPrio,
                    ]
                );

                const saved = insertRes.rows[0];
                const formattedTime = formatWIBShort(saved.remind_at);
                console.log(`⏰ [Direct Gemini] Berhasil membuat reminder #${saved.id}: "${saved.title}" pada ${formattedTime}`);

                toolResponse = {
                    success: true,
                    reminder_id: saved.id,
                    title: saved.title,
                    remind_at_wib: formattedTime,
                    priority: saved.priority,
                };
            } else if (fnName === 'get_reminders') {
                const res = await db.query(
                    `SELECT id, title, priority, remind_at 
                     FROM reminders 
                     WHERE (user_id = $1 OR user_id = $2) AND status = 'pending'
                     ORDER BY remind_at ASC 
                     LIMIT $3;`,
                    [effectiveUserId, phoneTarget, args.limit || 10]
                );
                const list = res.rows.map(r => ({
                    id: r.id,
                    title: r.title,
                    remind_at_wib: formatWIBShort(r.remind_at),
                    priority: r.priority,
                }));
                toolResponse = { success: true, count: list.length, reminders: list };
            } else if (fnName === 'delete_reminder') {
                let delRes;
                if (args.reminder_id) {
                    delRes = await db.query(
                        `UPDATE reminders SET status = 'cancelled' 
                         WHERE id = $1 AND (user_id = $2 OR user_id = $3) 
                         RETURNING id, title;`,
                        [args.reminder_id, effectiveUserId, phoneTarget]
                    );
                } else if (args.query) {
                    delRes = await db.query(
                        `UPDATE reminders SET status = 'cancelled' 
                         WHERE id IN (
                             SELECT id FROM reminders 
                             WHERE (user_id = $1 OR user_id = $2) AND status = 'pending' AND title ILIKE $3
                             ORDER BY id DESC LIMIT 1
                         )
                         RETURNING id, title;`,
                        [effectiveUserId, phoneTarget, `%${args.query}%`]
                    );
                }
                if (delRes && delRes.rowCount > 0) {
                    toolResponse = { success: true, cancelled_id: delRes.rows[0].id, title: delRes.rows[0].title };
                } else {
                    toolResponse = { success: false, error: 'Pengingat yang dimaksud tidak ditemukan atau sudah tidak aktif.' };
                }

            // ==========================================
            // 3. JADWAL & AGENDA (SCHEDULES)
            // ==========================================
            } else if (fnName === 'create_schedule') {
                const startDate = parseDateTimeWIB(args.start_time);
                if (!startDate) throw new Error(`Format waktu mulai jadwal "${args.start_time}" tidak valid.`);

                const endDate = args.end_time ? parseDateTimeWIB(args.end_time) : null;
                const normPrio = normalizePriority(args.priority);

                const insertRes = await db.query(
                    `INSERT INTO schedules (user_id, title, description, start_time, end_time, location, priority, status, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, 'SCHEDULED', NOW(), NOW())
                     RETURNING *;`,
                    [
                        effectiveUserId,
                        args.title,
                        null,
                        startDate.toISOString(),
                        endDate ? endDate.toISOString() : null,
                        args.location || null,
                        normPrio,
                    ]
                );

                const saved = insertRes.rows[0];
                const formattedStart = formatWIBShort(saved.start_time);
                console.log(`📅 [Direct Gemini] Berhasil membuat jadwal #${saved.id}: "${saved.title}" pada ${formattedStart}`);

                toolResponse = {
                    success: true,
                    schedule_id: saved.id,
                    title: saved.title,
                    start_time_wib: formattedStart,
                    location: saved.location,
                    priority: saved.priority,
                };
            } else if (fnName === 'get_schedules') {
                const res = await db.query(
                    `SELECT id, title, start_time, end_time, location, priority 
                     FROM schedules 
                     WHERE (user_id = $1 OR user_id = $2) AND status != 'CANCELLED' 
                       AND start_time >= NOW() - INTERVAL '2 hours'
                     ORDER BY start_time ASC 
                     LIMIT $3;`,
                    [effectiveUserId, phoneTarget, args.limit || 10]
                );
                const list = res.rows.map(s => ({
                    id: s.id,
                    title: s.title,
                    start_time_wib: formatWIBShort(s.start_time),
                    end_time_wib: s.end_time ? formatWIBShort(s.end_time) : null,
                    location: s.location,
                    priority: s.priority,
                }));
                toolResponse = { success: true, count: list.length, schedules: list };
            } else if (fnName === 'cancel_schedule') {
                let cancelRes;
                if (args.schedule_id) {
                    cancelRes = await db.query(
                        `UPDATE schedules SET status = 'CANCELLED', deleted_at = NOW(), updated_at = NOW() 
                         WHERE id = $1 AND (user_id = $2 OR user_id = $3) 
                         RETURNING id, title;`,
                        [args.schedule_id, effectiveUserId, phoneTarget]
                    );
                } else if (args.query) {
                    cancelRes = await db.query(
                        `UPDATE schedules SET status = 'CANCELLED', deleted_at = NOW(), updated_at = NOW() 
                         WHERE id IN (
                             SELECT id FROM schedules 
                             WHERE (user_id = $1 OR user_id = $2) AND status != 'CANCELLED' AND title ILIKE $3
                             ORDER BY id DESC LIMIT 1
                         )
                         RETURNING id, title;`,
                        [effectiveUserId, phoneTarget, `%${args.query}%`]
                    );
                }
                if (cancelRes && cancelRes.rowCount > 0) {
                    toolResponse = { success: true, cancelled_id: cancelRes.rows[0].id, title: cancelRes.rows[0].title };
                } else {
                    toolResponse = { success: false, error: 'Jadwal yang dimaksud tidak ditemukan.' };
                }

            // ==========================================
            // 4. TUGAS & TO-DO (TASKS)
            // ==========================================
            } else if (fnName === 'create_task') {
                const dueDate = args.due_at ? parseDateTimeWIB(args.due_at) : null;
                const normPrio = normalizePriority(args.priority);

                const insertRes = await db.query(
                    `INSERT INTO tasks (user_id, title, description, due_at, priority, status, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
                     RETURNING *;`,
                    [
                        effectiveUserId,
                        args.title,
                        args.description || null,
                        dueDate ? dueDate.toISOString() : null,
                        normPrio,
                    ]
                );

                const saved = insertRes.rows[0];
                console.log(`📋 [Direct Gemini] Berhasil membuat task #${saved.id}: "${saved.title}"`);

                toolResponse = {
                    success: true,
                    task_id: saved.id,
                    title: saved.title,
                    due_at_wib: saved.due_at ? formatWIBShort(saved.due_at) : 'Tanpa tenggat',
                    priority: saved.priority,
                };
            } else if (fnName === 'get_tasks') {
                const res = await db.query(
                    `SELECT id, title, description, priority, status, due_at 
                     FROM tasks 
                     WHERE (user_id = $1 OR user_id = $2) AND deleted_at IS NULL AND status IN ('pending', 'in_progress')
                     ORDER BY 
                        CASE UPPER(priority) WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
                        due_at ASC NULLS LAST
                     LIMIT $3;`,
                    [effectiveUserId, phoneTarget, args.limit || 15]
                );
                const list = res.rows.map(t => ({
                    id: t.id,
                    title: t.title,
                    priority: t.priority,
                    status: t.status,
                    due_at_wib: t.due_at ? formatWIBShort(t.due_at) : null,
                }));
                toolResponse = { success: true, count: list.length, tasks: list };
            } else if (fnName === 'complete_task') {
                let compRes;
                if (args.task_id) {
                    compRes = await db.query(
                        `UPDATE tasks SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
                         WHERE id = $1 AND (user_id = $2 OR user_id = $3) 
                         RETURNING id, title;`,
                        [args.task_id, effectiveUserId, phoneTarget]
                    );
                } else if (args.query) {
                    compRes = await db.query(
                        `UPDATE tasks SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
                         WHERE id IN (
                             SELECT id FROM tasks 
                             WHERE (user_id = $1 OR user_id = $2) AND deleted_at IS NULL AND status IN ('pending', 'in_progress') AND title ILIKE $3
                             ORDER BY id DESC LIMIT 1
                         )
                         RETURNING id, title;`,
                        [effectiveUserId, phoneTarget, `%${args.query}%`]
                    );
                }
                if (compRes && compRes.rowCount > 0) {
                    toolResponse = { success: true, completed_id: compRes.rows[0].id, title: compRes.rows[0].title };
                } else {
                    toolResponse = { success: false, error: 'Tugas yang dimaksud tidak ditemukan atau sudah selesai.' };
                }
            } else if (fnName === 'delete_task') {
                let delRes;
                if (args.task_id) {
                    delRes = await db.query(
                        `UPDATE tasks SET deleted_at = NOW() 
                         WHERE id = $1 AND (user_id = $2 OR user_id = $3) 
                         RETURNING id, title;`,
                        [args.task_id, effectiveUserId, phoneTarget]
                    );
                } else if (args.query) {
                    delRes = await db.query(
                        `UPDATE tasks SET deleted_at = NOW() 
                         WHERE id IN (
                             SELECT id FROM tasks 
                             WHERE (user_id = $1 OR user_id = $2) AND deleted_at IS NULL AND title ILIKE $3
                             ORDER BY id DESC LIMIT 1
                         )
                         RETURNING id, title;`,
                        [effectiveUserId, phoneTarget, `%${args.query}%`]
                    );
                }
                if (delRes && delRes.rowCount > 0) {
                    toolResponse = { success: true, deleted_id: delRes.rows[0].id, title: delRes.rows[0].title };
                } else {
                    toolResponse = { success: false, error: 'Tugas tidak ditemukan.' };
                }

            // ==========================================
            // 5. MEMORI & FAKTA PENGGUNA (MEMORIES)
            // ==========================================
            } else if (fnName === 'save_memory') {
                const memKey = String(args.key).toLowerCase().trim().replace(/\s+/g, '_');
                const memVal = String(args.value).trim();
                const memType = (args.type || 'PREFERENCE').toUpperCase();

                await db.query(
                    `INSERT INTO memories (user_id, type, key, value, importance, source, status, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, 4, 'USER_EXPLICIT', 'ACTIVE', NOW(), NOW())
                     ON CONFLICT (user_id, key) DO UPDATE SET
                        value = EXCLUDED.value,
                        type = EXCLUDED.type,
                        status = 'ACTIVE',
                        updated_at = NOW();`,
                    [effectiveUserId, memType, memKey, memVal]
                );

                console.log(`🧠 [Direct Gemini] Memori tersimpan: [${memKey}] = "${memVal}" untuk user ${effectiveUserId}`);
                toolResponse = { success: true, key: memKey, value: memVal, type: memType };
            } else if (fnName === 'get_memories') {
                const res = await db.query(
                    `SELECT type, key, value, importance, updated_at
                     FROM memories 
                     WHERE (user_id = $1 OR user_id = $2) AND status = 'ACTIVE'
                     ORDER BY importance DESC, updated_at DESC 
                     LIMIT $3;`,
                    [effectiveUserId, phoneTarget, args.limit || 15]
                );
                toolResponse = { success: true, count: res.rowCount, memories: res.rows };
            } else if (fnName === 'forget_memory') {
                const delRes = await db.query(
                    `UPDATE memories 
                     SET status = 'DELETED', updated_at = NOW() 
                     WHERE (user_id = $1 OR user_id = $2) AND (key ILIKE $3 OR value ILIKE $3) AND status = 'ACTIVE'
                     RETURNING key, value;`,
                    [effectiveUserId, phoneTarget, `%${args.query}%`]
                );
                if (delRes && delRes.rowCount > 0) {
                    toolResponse = { success: true, forgotten_key: delRes.rows[0].key };
                } else {
                    toolResponse = { success: false, error: 'Memori yang dimaksud tidak ditemukan dalam ingatan Amba.' };
                }

            // ==========================================
            // 6. PANGGILAN / CALLSIGN (USERS)
            // ==========================================
            } else if (fnName === 'set_user_callsign') {
                const newCallsign = String(args.callsign).trim();
                await db.query(
                    `UPDATE users 
                     SET callsign = $1, updated_at = NOW() 
                     WHERE id = $2 OR discord_user_id = $2;`,
                    [newCallsign, effectiveUserId]
                );
                console.log(`🏷️ [Direct Gemini] Callsign diperbarui untuk user ${effectiveUserId} -> "${newCallsign}"`);
                toolResponse = { success: true, callsign: newCallsign };

            // ==========================================
            // 7. CATATAN PRIBADI (NOTES)
            // ==========================================
            } else if (fnName === 'record_note') {
                const noteRes = await db.query(
                    `INSERT INTO notes (user_id, title, content, category, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, NOW(), NOW())
                     RETURNING *;`,
                    [effectiveUserId, args.title, args.content, args.category || 'general']
                );
                const savedNote = noteRes.rows[0];
                console.log(`📝 [Direct Gemini] Catatan #${savedNote.id} tersimpan: "${savedNote.title}"`);
                toolResponse = { success: true, note_id: savedNote.id, title: savedNote.title };
            } else if (fnName === 'get_notes') {
                let noteSql = `SELECT id, title, content, category, created_at FROM notes WHERE (user_id = $1 OR user_id = $2) `;
                const params = [effectiveUserId, phoneTarget];
                if (args.query) {
                    noteSql += `AND (title ILIKE $3 OR content ILIKE $3) `;
                    params.push(`%${args.query}%`);
                }
                noteSql += `ORDER BY id DESC LIMIT $${params.length + 1};`;
                params.push(args.limit || 10);
                const resNotes = await db.query(noteSql, params);
                toolResponse = { success: true, count: resNotes.rowCount, notes: resNotes.rows };
            } else if (fnName === 'delete_note') {
                let delNoteRes;
                if (args.note_id) {
                    delNoteRes = await db.query(
                        `DELETE FROM notes WHERE id = $1 AND (user_id = $2 OR user_id = $3) RETURNING id, title;`,
                        [args.note_id, effectiveUserId, phoneTarget]
                    );
                } else if (args.query) {
                    delNoteRes = await db.query(
                        `DELETE FROM notes WHERE id IN (
                            SELECT id FROM notes WHERE (user_id = $1 OR user_id = $2) AND title ILIKE $3 ORDER BY id DESC LIMIT 1
                         ) RETURNING id, title;`,
                        [effectiveUserId, phoneTarget, `%${args.query}%`]
                    );
                }
                if (delNoteRes && delNoteRes.rowCount > 0) {
                    toolResponse = { success: true, deleted_id: delNoteRes.rows[0].id, title: delNoteRes.rows[0].title };
                } else {
                    toolResponse = { success: false, error: 'Catatan tidak ditemukan.' };
                }
            }
        } catch (toolErr) {
            console.error(`❌ [Direct Gemini] Gagal eksekusi tool ${fnName}:`, toolErr.message);
            toolResponse = { success: false, error: toolErr.message };
        }

        // STEP 2: Kirim hasil eksekusi kembali ke Gemini untuk merumuskan balasan konfirmasi
        const step2RequestBody = {
            system_instruction: {
                parts: [{ text: systemInstruction }],
            },
            contents: [
                {
                    role: 'user',
                    parts: [{ text: userMessage }],
                },
                {
                    role: 'model',
                    parts: [firstPart],
                },
                {
                    role: 'user',
                    parts: [
                        {
                            functionResponse: {
                                name: fnName,
                                response: toolResponse,
                            },
                        },
                    ],
                },
            ],
            tools: [{ function_declarations: TOOLS_DECLARATIONS }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
            },
        };

        const res2 = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(step2RequestBody),
            signal: AbortSignal.timeout(20000),
        });

        if (res2.ok) {
            const data2 = await res2.json();
            const finalReply = data2.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (finalReply) return finalReply;
        }

        // Fallback jika step 2 gagal / timeout: berikan balasan langsung berdasarkan hasil tool
        if (toolResponse.success) {
            if (fnName === 'record_transaction') {
                const icon = toolResponse.kind === 'expense' ? '💸' : '💰';
                const label = toolResponse.kind === 'expense' ? 'Pengeluaran' : 'Pemasukan';
                return `${icon} Siap ${preferredGreeting}! Catatan ${label} sebesar *${toolResponse.formatted_amount}* untuk *"${toolResponse.description}"* sudah berhasil Amba catat ke database.`;
            }
            if (fnName === 'get_finances') {
                let msg = `💰 *REKAP KEUANGAN [${toolResponse.period.toUpperCase()}]*\n`;
                msg += `• Total Pengeluaran : *${toolResponse.formatted_expense}*\n`;
                msg += `• Total Pemasukan   : *${toolResponse.formatted_income}*\n`;
                msg += `• Saldo Bersih      : *${toolResponse.formatted_net_balance}*\n\n`;
                if (!toolResponse.transactions || toolResponse.transactions.length === 0) {
                    msg += `ℹ️ Belum ada catatan transaksi pada periode ini.`;
                } else {
                    msg += `*Rincian Transaksi:*\n`;
                    toolResponse.transactions.forEach((t, i) => {
                        const ic = t.kind === 'expense' ? '🔴' : '🟢';
                        msg += `${i + 1}. ${ic} *${t.formatted_amount}* — ${t.description} (\`${t.category}\`)\n`;
                    });
                }
                return msg;
            }
            if (fnName === 'delete_transaction') {
                return `🗑️ Transaksi *"${toolResponse.description}"* (${toolResponse.amount}) berhasil dihapus dari catatan keuangan, ${preferredGreeting}!`;
            }
            if (fnName === 'create_reminder') {
                return `⏰ Siap ${preferredGreeting}! Pengingat untuk *"${toolResponse.title}"* sudah Amba pasang pada *${toolResponse.remind_at_wib}*. Nanti tepat pada jamnya Amba chat ya! 🫡`;
            }
            if (fnName === 'get_reminders') {
                if (!toolResponse.reminders || toolResponse.reminders.length === 0) {
                    return `ℹ️ Belum ada pengingat aktif yang terjadwal untukmu saat ini, ${preferredGreeting}.`;
                }
                const items = toolResponse.reminders.map((r, i) => `${i + 1}. \`${r.remind_at_wib}\` — *${r.title}*`).join('\n');
                return `⏰ *Daftar Pengingat Aktif [${preferredGreeting}]:*\n\n${items}`;
            }
            if (fnName === 'delete_reminder') {
                return `🗑️ Pengingat *"${toolResponse.title}"* berhasil Amba batalkan, ${preferredGreeting}!`;
            }
            if (fnName === 'create_schedule') {
                return `📅 Siap ${preferredGreeting}! Jadwal *"${toolResponse.title}"* sudah Amba catat untuk *${toolResponse.start_time_wib}*${toolResponse.location ? ` di ${toolResponse.location}` : ''}.`;
            }
            if (fnName === 'get_schedules') {
                if (!toolResponse.schedules || toolResponse.schedules.length === 0) {
                    return `ℹ️ Belum ada agenda atau jadwal terdekat untukmu, ${preferredGreeting}.`;
                }
                const items = toolResponse.schedules.map((s, i) => `${i + 1}. \`${s.start_time_wib}\` — *${s.title}*${s.location ? ` (@ ${s.location})` : ''}`).join('\n');
                return `📅 *Daftar Jadwal & Agenda [${preferredGreeting}]:*\n\n${items}`;
            }
            if (fnName === 'cancel_schedule') {
                return `🗑️ Jadwal agenda *"${toolResponse.title}"* berhasil dibatalkan, ${preferredGreeting}!`;
            }
            if (fnName === 'create_task') {
                return `📋 Siap ${preferredGreeting}! Tugas *"${toolResponse.title}"* sudah Amba masukkan ke to-do list kamu. Semangat! 💪`;
            }
            if (fnName === 'get_tasks') {
                if (!toolResponse.tasks || toolResponse.tasks.length === 0) {
                    return `✨ Tidak ada tugas tertunda saat ini, ${preferredGreeting}! Santai sejenak ya ☕`;
                }
                const items = toolResponse.tasks.map((t, i) => `${i + 1}. *${t.title}*${t.due_at_wib ? ` (Tenggat: \`${t.due_at_wib}\`)` : ''}`).join('\n');
                return `📋 *Daftar Tugas & To-Do [${preferredGreeting}]:*\n\n${items}`;
            }
            if (fnName === 'complete_task') {
                return `✅ Mantap ${preferredGreeting}! Tugas *"${toolResponse.title}"* sudah ditandai selesai. Kerja bagus! 🎉`;
            }
            if (fnName === 'delete_task') {
                return `🗑️ Tugas *"${toolResponse.title}"* berhasil dihapus dari to-do list, ${preferredGreeting}!`;
            }
            if (fnName === 'save_memory') {
                return `🧠 Siap ${preferredGreeting}! Amba sudah mencatat informasi baru tentangmu di ingatan permanen: *${toolResponse.key}* = *"${toolResponse.value}"*.`;
            }
            if (fnName === 'get_memories') {
                if (!toolResponse.memories || toolResponse.memories.length === 0) {
                    return `ℹ️ Belum ada ingatan khusus yang tersimpan tentangmu, ${preferredGreeting}. Kamu bisa kasih tahu hal baru kapan saja!`;
                }
                const items = toolResponse.memories.map((m, i) => `${i + 1}. • *${m.key}*: ${m.value}`).join('\n');
                return `🧠 *Hal-Hal yang Amba Ingat Tentang [${preferredGreeting}]:*\n\n${items}`;
            }
            if (fnName === 'forget_memory') {
                return `🗑️ Sudah Amba lupakan memori tentang *${toolResponse.forgotten_key}*, ${preferredGreeting}!`;
            }
            if (fnName === 'set_user_callsign') {
                return `🫡 Siap! Mulai sekarang Amba akan memanggilmu dengan sebutan *"${toolResponse.callsign}"*. Ada yang bisa dibantu, ${toolResponse.callsign}?`;
            }
            if (fnName === 'record_note') {
                return `📝 Siap ${preferredGreeting}! Catatan *"${toolResponse.title}"* sudah berhasil Amba simpan ke database.`;
            }
            if (fnName === 'get_notes') {
                if (!toolResponse.notes || toolResponse.notes.length === 0) {
                    return `ℹ️ Belum ada catatan yang tersimpan, ${preferredGreeting}.`;
                }
                const items = toolResponse.notes.map((n, i) => `${i + 1}. *${n.title}*\n   ${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}`).join('\n\n');
                return `📝 *Daftar Catatan Pribadi [${preferredGreeting}]:*\n\n${items}`;
            }
            if (fnName === 'delete_note') {
                return `🗑️ Catatan *"${toolResponse.title}"* berhasil dihapus, ${preferredGreeting}!`;
            }
        } else {
            return `Aduh ${preferredGreeting}, Amba mengalami sedikit kendala: ${toolResponse.error || 'Gagal memproses data'}. Boleh coba lagi ya!`;
        }
    }

    // Jika tidak ada tool call, kembalikan teks balasan langsung
    const reply = firstPart?.text?.trim();
    if (!reply) {
        throw new Error('Gemini API merespons dengan konten kosong.');
    }

    return reply;
}

module.exports = { generateDirectGeminiReply };
