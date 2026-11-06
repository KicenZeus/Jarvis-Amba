/**
 * Direct Gemini AI Service with Native Function Calling / Tools
 * Memastikan Jarvis tetap cerdas membalas chat DAN bisa membuat Pengingat,
 * Jadwal, serta Tugas secara otomatis ke database Supabase meskipun n8n mati.
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

const TOOLS_DECLARATIONS = [
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

    const preferredGreeting = callsign || userName;
    let memoryBlock = '';
    if (Array.isArray(memories) && memories.length > 0) {
        memoryBlock = '\n\n[Ingatan/Memori Kamu tentang Pengguna Ini]:\n' +
            memories.map((m, i) => `${i + 1}. [${m.category || 'INFO'}] ${m.fact || m.content}`).join('\n');
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
Gunakan waktu acuan ini untuk menghitung jika pengguna meminta "10 menit lagi", "nanti jam 4 sore", "besok", "lusa", dsb.

ATURAN PENGGUNAAN TOOLS (FUNGSI):
1. Jika pengguna meminta PENGINGAT / ALARM / DIINGATKAN PADA JAM TERTENTU:
   Panggil tool \`create_reminder\`!
   - Kolom 'title' pada pengingat AKAN DIKIRIM LANGSUNG KE CHAT USER SAAT JAMNYA TIBA!
   - Buatlah 'title' sebagai kalimat sapaan pengingat yang natural dan hangat (contoh: "${callsign || preferredGreeting}, udah jam 16:00 nih waktunya mandi! 🚿").
2. Jika pengguna meminta MENCATAT JADWAL / AGENDA / ACARA (rapat, apel, kuliah):
   Panggil tool \`create_schedule\`! DILARANG memasukkannya ke tasks atau reminders.
3. Jika pengguna meminta MENCATAT TUGAS / PEKERJAAN / TO-DO:
   Panggil tool \`create_task\`!
4. Jika pengguna hanya mengobrol, bertanya, atau menyapa, jawablah langsung tanpa memanggil tools.

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
            if (fnName === 'create_reminder') {
                const targetDate = parseDateTimeWIB(args.remind_at);
                if (!targetDate) throw new Error(`Format waktu pengingat "${args.remind_at}" tidak valid.`);

                const normPrio = normalizePriority(args.priority);
                const insertRes = await db.query(
                    `INSERT INTO reminders (user_id, channel_id, title, remind_at, priority, status, created_at)
                     VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
                     RETURNING *;`,
                    [
                        userId || '713137141072396370',
                        channelId || (userId ? `wa_${userId}` : 'DEFAULT'),
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
                        userId || '713137141072396370',
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
            } else if (fnName === 'create_task') {
                const dueDate = args.due_at ? parseDateTimeWIB(args.due_at) : null;
                const normPrio = normalizePriority(args.priority);

                const insertRes = await db.query(
                    `INSERT INTO tasks (user_id, title, description, due_at, priority, status, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
                     RETURNING *;`,
                    [
                        userId || '713137141072396370',
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
            if (fnName === 'create_reminder') {
                return `⏰ Siap ${preferredGreeting}! Pengingat untuk *"${toolResponse.title}"* sudah Amba pasang pada *${toolResponse.remind_at_wib}*. Nanti tepat pada jamnya Amba chat ya! 🫡`;
            }
            if (fnName === 'create_schedule') {
                return `📅 Siap ${preferredGreeting}! Jadwal *"${toolResponse.title}"* sudah Amba catat untuk *${toolResponse.start_time_wib}*${toolResponse.location ? ` di ${toolResponse.location}` : ''}.`;
            }
            if (fnName === 'create_task') {
                return `📋 Siap ${preferredGreeting}! Tugas *"${toolResponse.title}"* sudah Amba masukkan ke to-do list kamu. Semangat! 💪`;
            }
        } else {
            return `Aduh ${preferredGreeting}, Amba mengalami sedikit kendala saat menyimpan data: ${toolResponse.error || 'Gagal menyimpan ke database'}. Boleh coba lagi ya!`;
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
