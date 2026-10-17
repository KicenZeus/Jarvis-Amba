const db = require('./db');
const { formatForWhatsApp } = require('./channelService');
const { sendWhatsAppTextMessage } = require('./whatsappAdapter');

/**
 * ==============================================================================
 * Jarvis V2.1: Multi-Channel Broadcast Service (WhatsApp & Discord)
 * Mengirim pesan massal serentak ke seluruh pengguna terdaftar
 * Mendukung pengiriman instan & terjadwal, filter per-saluran, per-role, & kontak spesifik
 * Khusus Hak Akses OWNER
 * ==============================================================================
 */

let globalDiscordClient = null;

/**
 * Menyimpan instance Discord Client global agar broadcast dari WhatsApp/API dapat mengirim DM Discord
 * @param {object} client - Discord.js Client instance
 */
function setDiscordClient(client) {
    globalDiscordClient = client;
}

/**
 * Memeriksa apakah user memiliki hak akses OWNER utama
 * @param {string} userId - ID internal, snowflake discord, atau nomor phone
 * @returns {Promise<boolean>}
 */
async function isAuthorizedOwner(userId) {
    if (!userId) return false;
    const cleanId = String(userId).trim().replace(/\D/g, '');

    // Whitelist ID Owner Utama (Discord & WhatsApp)
    const OWNER_IDS = ['713137141072396370', '344840856006459392', '6288991185737'];
    if (OWNER_IDS.includes(String(userId).trim()) || OWNER_IDS.includes(cleanId)) {
        return true;
    }

    try {
        const res = await db.query(
            `SELECT u.role 
             FROM users u
             LEFT JOIN user_channels uc ON uc.user_id = u.id
             WHERE u.id = $1 
                OR u.discord_user_id = $1 
                OR uc.external_user_id = $1 
                OR uc.phone_number = $1
                OR uc.external_user_id = $2
                OR uc.phone_number = $2
             LIMIT 1;`,
            [String(userId).trim(), cleanId]
        );
        const role = res.rows[0]?.role;
        return role === 'OWNER';
    } catch (e) {
        return false;
    }
}

/**
 * Utility pause/sleep untuk rate-limiting antar pengiriman
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parsing teks waktu alami / jam / tanggal menjadi objek Date (WIB / Asia/Jakarta)
 * @param {string} timeStr - Contoh: '10m', '1h', '15:30', '2026-10-17 09:00'
 * @returns {{ success: boolean, date?: Date, formatted?: string, error?: string }}
 */
function parseScheduleTime(timeStr) {
    if (!timeStr || !timeStr.trim()) {
        return { success: false, error: 'Waktu jadwal tidak boleh kosong.' };
    }

    const raw = timeStr.trim().toLowerCase();
    const now = new Date();

    // 1. Format Relatif: '10m', '30m', '1h', '2h', '1d'
    const relMatch = raw.match(/^(\d+)\s*(m|menit|h|jam|d|hari)$/);
    if (relMatch) {
        const amount = parseInt(relMatch[1], 10);
        const unit = relMatch[2];
        let offsetMs = 0;
        if (unit === 'm' || unit === 'menit') offsetMs = amount * 60 * 1000;
        else if (unit === 'h' || unit === 'jam') offsetMs = amount * 3600 * 1000;
        else if (unit === 'd' || unit === 'hari') offsetMs = amount * 86400 * 1000;

        const targetDate = new Date(now.getTime() + offsetMs);
        return {
            success: true,
            date: targetDate,
            formatted: formatWIBDateTime(targetDate),
        };
    }

    // 2. Format Jam WIB Hari Ini / Besok: 'HH:mm' (misal: '14:30', '08:00')
    const clockMatch = raw.match(/^([01]?[0-9]|2[0-3])[:.]([0-5][0-9])$/);
    if (clockMatch) {
        const hours = parseInt(clockMatch[1], 10);
        const minutes = parseInt(clockMatch[2], 10);

        // Buat objek waktu dalam konteks WIB (UTC+7)
        // Ambil komponen tanggal WIB saat ini
        const wibFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
        const parts = wibFormatter.formatToParts(now);
        const p = {};
        parts.forEach(({ type, value }) => (p[type] = value));

        const targetWIBStr = `${p.year}-${p.month}-${p.day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+07:00`;
        let targetDate = new Date(targetWIBStr);

        // Jika jam tersebut sudah lewat hari ini di WIB, jadwalkan untuk besok di jam yang sama
        if (targetDate.getTime() <= now.getTime()) {
            targetDate = new Date(targetDate.getTime() + 86400 * 1000);
        }

        return {
            success: true,
            date: targetDate,
            formatted: formatWIBDateTime(targetDate),
        };
    }

    // 3. Format Tanggal Lengkap: 'YYYY-MM-DD HH:mm' atau 'YYYY-MM-DDTHH:mm'
    const fullMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[t\s](\d{1,2})[:.](\d{2})$/);
    if (fullMatch) {
        const isoWIB = `${fullMatch[1]}-${fullMatch[2]}-${fullMatch[3]}T${fullMatch[4].padStart(2, '0')}:${fullMatch[5]}:00+07:00`;
        const targetDate = new Date(isoWIB);
        if (isNaN(targetDate.getTime())) {
            return { success: false, error: 'Format tanggal tidak valid.' };
        }
        if (targetDate.getTime() <= now.getTime()) {
            return { success: false, error: 'Waktu jadwal harus di masa depan (belum lewat).' };
        }
        return {
            success: true,
            date: targetDate,
            formatted: formatWIBDateTime(targetDate),
        };
    }

    // 4. Format Tanggal Indonesia: 'DD/MM/YYYY HH:mm'
    const idMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[t\s](\d{1,2})[:.](\d{2})$/);
    if (idMatch) {
        const isoWIB = `${idMatch[3]}-${idMatch[2].padStart(2, '0')}-${idMatch[1].padStart(2, '0')}T${idMatch[4].padStart(2, '0')}:${idMatch[5]}:00+07:00`;
        const targetDate = new Date(isoWIB);
        if (isNaN(targetDate.getTime())) {
            return { success: false, error: 'Format tanggal tidak valid.' };
        }
        if (targetDate.getTime() <= now.getTime()) {
            return { success: false, error: 'Waktu jadwal harus di masa depan (belum lewat).' };
        }
        return {
            success: true,
            date: targetDate,
            formatted: formatWIBDateTime(targetDate),
        };
    }

    return {
        success: false,
        error: 'Format waktu tidak dikenali. Gunakan contoh: `10m`, `1h`, `15:30`, atau `2026-10-17 09:00`.',
    };
}

/**
 * Format Date ke string WIB yang rapi dan mudah dibaca
 */
function formatWIBDateTime(date) {
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date) + ' WIB';
}

/**
 * Mengirimkan pesan broadcast instan ke target pengguna
 * @param {object} params
 * @param {string} params.message - Pesan yang akan disiarkan
 * @param {string} [params.targetChannel] - 'ALL' | 'WHATSAPP' | 'DISCORD' (default: 'ALL')
 * @param {string} [params.targetRole] - 'ALL' | 'ADMIN' | 'USER' (default: null)
 * @param {Array<string>} [params.targetRecipients] - Array nomor/ID spesifik (opsional)
 * @param {string} [params.senderUserId] - ID user yang meminta broadcast (harus OWNER)
 * @param {object} [params.discordClient] - Discord Client instance
 * @param {boolean} [params.includeBotOwner] - Apakah owner ikut menerima pesan broadcast (default: true)
 */
async function broadcastMessage({
    message,
    targetChannel = 'ALL',
    targetRole = null,
    targetRecipients = null,
    senderUserId = null,
    discordClient = null,
    includeBotOwner = true,
}) {
    const dClient = discordClient || globalDiscordClient;
    if (!message || !message.trim()) {
        return { success: false, total: 0, delivered: 0, failed: 0, details: [], error: 'Pesan broadcast tidak boleh kosong' };
    }

    // Verifikasi role jika senderUserId disertakan (Eksklusif OWNER)
    if (senderUserId) {
        const isOwner = await isAuthorizedOwner(senderUserId);
        if (!isOwner) {
            console.warn(`⛔ [Broadcast] Akses ditolak untuk user bukan Owner: ${senderUserId}`);
            return {
                success: false,
                total: 0,
                delivered: 0,
                failed: 0,
                details: [],
                error: '⛔ Fitur broadcast (instan maupun terjadwal) eksklusif hanya dapat digunakan oleh OWNER Jarvis!',
            };
        }
    }

    const cleanTarget = String(targetChannel || 'ALL').toUpperCase();

    try {
        // Ambil semua akun pengguna aktif beserta channel mereka
        const res = await db.query(
            `SELECT 
                uc.id AS channel_id,
                uc.user_id,
                uc.channel_type,
                uc.external_user_id,
                uc.display_name,
                uc.phone_number,
                u.display_name AS user_name,
                u.callsign,
                u.role
             FROM user_channels uc
             JOIN users u ON uc.user_id = u.id
             WHERE uc.status = 'ACTIVE' AND u.status = 'ACTIVE'
               AND u.role != 'BLOCKED'
               AND uc.external_user_id NOT IN ('12345', 'test_user_kicen')
             ORDER BY uc.created_at ASC;`
        );

        let recipients = res.rows;

        // 1. Filter Saluran (Channel)
        if (cleanTarget === 'WHATSAPP') {
            recipients = recipients.filter((r) => r.channel_type === 'WHATSAPP');
        } else if (cleanTarget === 'DISCORD') {
            recipients = recipients.filter((r) => r.channel_type === 'DISCORD');
        }

        // 2. Filter Role (jika bukan 'ALL' dan ditentukan)
        if (targetRole && String(targetRole).toUpperCase() !== 'ALL') {
            const cleanRole = String(targetRole).toUpperCase();
            recipients = recipients.filter((r) => String(r.role).toUpperCase() === cleanRole);
        }

        // 3. Filter Penerima Spesifik (Nomor WA / Discord Snowflake ID / User ID)
        if (Array.isArray(targetRecipients) && targetRecipients.length > 0) {
            const cleanTargetSet = targetRecipients.map((t) => String(t).trim().replace(/\D/g, '') || String(t).trim());
            recipients = recipients.filter((r) => {
                const phoneClean = r.phone_number ? r.phone_number.replace(/\D/g, '') : '';
                const extClean = r.external_user_id ? r.external_user_id.replace(/\D/g, '') : '';
                return cleanTargetSet.includes(r.external_user_id) ||
                       cleanTargetSet.includes(r.phone_number) ||
                       (phoneClean && cleanTargetSet.includes(phoneClean)) ||
                       (extClean && cleanTargetSet.includes(extClean)) ||
                       cleanTargetSet.includes(r.user_id);
            });
        }

        console.log(`📢 [Broadcast] Memulai pengiriman broadcast ke ${recipients.length} penerima (Target: ${cleanTarget}, Role: ${targetRole || 'SEMUA'})...`);

        let delivered = 0;
        let failed = 0;
        const details = [];

        for (const r of recipients) {
            const recipientName = r.callsign || r.display_name || r.user_name || 'Kawan';

            // Format pesan broadcast personal & sopan
            const personalizedMsg = `📢 *[PENGUMUMAN JARVIS AMBA]*\nHalo ${recipientName}!\n\n${message.trim()}\n\n_— Salam hangat, Asisten Jarvis Amba_`;

            // A. Pengiriman ke WHATSAPP
            if (r.channel_type === 'WHATSAPP') {
                const phone = r.phone_number || r.external_user_id;
                try {
                    const formatted = formatForWhatsApp(personalizedMsg);
                    const waRes = await sendWhatsAppTextMessage(phone, formatted);
                    if (waRes.success) {
                        delivered++;
                        details.push({ user: recipientName, channel: 'WHATSAPP', target: phone, status: 'SUCCESS' });
                        console.log(`📤 [Broadcast] Terkirim ke WhatsApp ${phone} (${recipientName})`);
                    } else {
                        failed++;
                        details.push({ user: recipientName, channel: 'WHATSAPP', target: phone, status: 'FAILED', error: waRes.error });
                        console.warn(`⚠️ [Broadcast] Gagal kirim ke WhatsApp ${phone}:`, waRes.error);
                    }
                } catch (waErr) {
                    failed++;
                    details.push({ user: recipientName, channel: 'WHATSAPP', target: phone, status: 'FAILED', error: waErr.message });
                }
                await sleep(300);
            }

            // B. Pengiriman ke DISCORD (Direct Message)
            else if (r.channel_type === 'DISCORD' && dClient) {
                const discordId = r.external_user_id;
                try {
                    const discordUser = await dClient.users.fetch(discordId).catch(() => null);
                    if (discordUser && !discordUser.bot) {
                        const dm = await discordUser.createDM().catch(() => null);
                        if (dm) {
                            const dcMsg = `📢 **[PENGUMUMAN JARVIS AMBA]**\nHalo **${recipientName}**!\n\n${message.trim()}\n\n*— Salam hangat, Asisten Jarvis Amba*`;
                            await dm.send(dcMsg);
                            delivered++;
                            details.push({ user: recipientName, channel: 'DISCORD', target: discordId, status: 'SUCCESS' });
                            console.log(`📤 [Broadcast] Terkirim ke Discord DM ${discordUser.tag} (${recipientName})`);
                        } else {
                            failed++;
                            details.push({ user: recipientName, channel: 'DISCORD', target: discordId, status: 'FAILED', error: 'CANNOT_OPEN_DM' });
                        }
                    } else {
                        failed++;
                        details.push({ user: recipientName, channel: 'DISCORD', target: discordId, status: 'FAILED', error: 'USER_NOT_FOUND' });
                    }
                } catch (dcErr) {
                    failed++;
                    details.push({ user: recipientName, channel: 'DISCORD', target: discordId, status: 'FAILED', error: dcErr.message });
                }
                await sleep(300);
            }
        }

        console.log(`🎉 [Broadcast Selesai] Total: ${recipients.length} | Berhasil: ${delivered} | Gagal: ${failed}`);

        return {
            success: true,
            total: recipients.length,
            delivered,
            failed,
            details,
        };
    } catch (err) {
        console.error('❌ [Broadcast] Terjadi kesalahan fatal:', err.message);
        return { success: false, total: 0, delivered: 0, failed: 0, details: [], error: err.message };
    }
}

/**
 * Membuat jadwal broadcast baru di database
 */
async function createScheduledBroadcast({
    createdBy,
    message,
    targetChannel = 'ALL',
    targetRole = null,
    targetRecipients = null,
    scheduledAt,
}) {
    if (!createdBy) {
        return { success: false, error: 'User pembuat tidak valid.' };
    }

    const isOwner = await isAuthorizedOwner(createdBy);
    if (!isOwner) {
        return { success: false, error: '⛔ Hanya OWNER yang diizinkan menjadwalkan broadcast!' };
    }

    if (!message || !message.trim()) {
        return { success: false, error: 'Pesan broadcast tidak boleh kosong.' };
    }

    const targetDate = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
    if (isNaN(targetDate.getTime()) || targetDate.getTime() <= Date.now()) {
        return { success: false, error: 'Waktu jadwal tidak valid atau sudah lewat.' };
    }

    try {
        const cleanRecipients = Array.isArray(targetRecipients) && targetRecipients.length > 0
            ? JSON.stringify(targetRecipients)
            : null;

        const res = await db.query(
            `INSERT INTO scheduled_broadcasts (
                created_by, message, target_channel, target_role, target_recipients, scheduled_at, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW(), NOW())
            RETURNING *;`,
            [
                String(createdBy).trim(),
                message.trim(),
                (targetChannel || 'ALL').toUpperCase(),
                targetRole ? targetRole.toUpperCase() : null,
                cleanRecipients,
                targetDate,
            ]
        );

        const record = res.rows[0];
        console.log(`📅 [Scheduled Broadcast] Berhasil dijadwalkan #${record.id} pada ${formatWIBDateTime(targetDate)}`);

        return {
            success: true,
            broadcast: record,
            formattedTime: formatWIBDateTime(targetDate),
        };
    } catch (err) {
        console.error('⚠️ Gagal membuat scheduled broadcast:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Mengambil daftar antrean broadcast terjadwal
 */
async function listScheduledBroadcasts({ status = 'PENDING', limit = 10 } = {}) {
    try {
        const res = await db.query(
            `SELECT id, created_by, message, target_channel, target_role, target_recipients, scheduled_at, status, created_at
             FROM scheduled_broadcasts
             WHERE status = $1
             ORDER BY scheduled_at ASC
             LIMIT $2;`,
            [status.toUpperCase(), limit]
        );
        return res.rows.map((r) => ({
            ...r,
            formatted_time: formatWIBDateTime(new Date(r.scheduled_at)),
        }));
    } catch (err) {
        console.error('⚠️ Gagal mengambil scheduled broadcasts:', err.message);
        return [];
    }
}

/**
 * Membatalkan jadwal broadcast tertentu
 */
async function cancelScheduledBroadcast(idOrObj, maybeUserId) {
    let id = idOrObj;
    let userId = maybeUserId;
    if (typeof idOrObj === 'object' && idOrObj !== null) {
        id = idOrObj.broadcastId || idOrObj.id;
        userId = idOrObj.cancelledBy || idOrObj.userId;
    }

    const isOwner = await isAuthorizedOwner(userId);
    if (!isOwner) {
        return { success: false, error: '⛔ Hanya OWNER yang diizinkan membatalkan jadwal broadcast!' };
    }

    try {
        const res = await db.query(
            `UPDATE scheduled_broadcasts
             SET status = 'CANCELLED', updated_at = NOW()
             WHERE id = $1 AND status = 'PENDING'
             RETURNING id, scheduled_at;`,
            [id]
        );

        if (res.rowCount === 0) {
            return { success: false, error: `Jadwal broadcast #${id} tidak ditemukan atau sudah dieksekusi.` };
        }

        return { success: true, message: `✅ Jadwal broadcast #${id} berhasil dibatalkan.` };
    } catch (err) {
        console.error('⚠️ Gagal membatalkan scheduled broadcast:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Background Worker: Memeriksa dan mengeksekusi antrean broadcast terjadwal yang jatuh tempo
 */
async function processPendingScheduledBroadcasts(discordClient = null) {
    try {
        // Ambil jadwal yang PENDING dan sudah waktunya dikirim
        const res = await db.query(
            `SELECT * FROM scheduled_broadcasts
             WHERE status = 'PENDING' AND scheduled_at <= NOW()
             ORDER BY scheduled_at ASC
             FOR UPDATE SKIP LOCKED;`
        );

        if (res.rowCount === 0) return;

        console.log(`⏰ [Scheduler Broadcast] Ditemukan ${res.rowCount} broadcast terjadwal yang jatuh tempo!`);

        for (const item of res.rows) {
            // Update ke status PROCESSING agar tidak dieksekusi ganda
            await db.query(`UPDATE scheduled_broadcasts SET status = 'PROCESSING', updated_at = NOW() WHERE id = $1`, [item.id]);

            let parsedRecipients = null;
            if (item.target_recipients) {
                try {
                    parsedRecipients = typeof item.target_recipients === 'string'
                        ? JSON.parse(item.target_recipients)
                        : item.target_recipients;
                } catch (_) {}
            }

            // Eksekusi broadcast
            const result = await broadcastMessage({
                message: item.message,
                targetChannel: item.target_channel,
                targetRole: item.target_role,
                targetRecipients: parsedRecipients,
                discordClient,
            });

            // Update status akhir
            const finalStatus = result.success ? 'COMPLETED' : 'FAILED';
            await db.query(
                `UPDATE scheduled_broadcasts
                 SET status = $1, execution_result = $2, updated_at = NOW()
                 WHERE id = $3`,
                [finalStatus, JSON.stringify(result), item.id]
            );

            console.log(`✅ [Scheduled Broadcast #${item.id}] Selesai diproses dengan status: ${finalStatus} (${result.delivered} terkirim, ${result.failed} gagal)`);

            // Beritahu Owner hasil broadcast terjadwal
            const notifMsg = `📢 *[LAPORAN BROADCAST TERJADWAL SELESAI]*\nJadwal #${item.id} berhasil dieksekusi!\n• Saluran: *${item.target_channel}*\n• Terkirim: *${result.delivered}* pengguna\n• Gagal: *${result.failed}* pengguna`;
            if (item.created_by.startsWith('62') || /^\d{10,15}$/.test(item.created_by)) {
                await sendWhatsAppTextMessage(item.created_by, notifMsg).catch(() => {});
            }
        }
    } catch (err) {
        console.error('⚠️ Gagal memproses pending scheduled broadcasts:', err.message);
    }
}

/**
 * Parsing input teks perintah broadcast (mengekstrak jadwal, saluran, role, recipients, dan pesan)
 * Contoh:
 * - "wa role:admin Pesan rapat"
 * - "jadwal 10m wa Pengumuman dalam 10 menit"
 * - "to:6288991185737,6281359944500 Rapat jam 15:30"
 * - "jadwal 2026-10-17 08:00 to:6288991185737 Besok pagi ya"
 */
function parseBroadcastInput(inputText) {
    let text = (inputText || '').trim();
    let isScheduled = false;
    let scheduleTimeStr = null;
    let targetChannel = 'ALL';
    let targetRole = null;
    let targetRecipients = null;

    // Cek apakah perintah diawali 'jadwal'
    // Format: jadwal <waktu> [target...] <pesan>
    const schedMatch = text.match(/^jadwal\s+([^\s]+)\s+([\s\S]+)$/i);
    if (schedMatch) {
        isScheduled = true;
        scheduleTimeStr = schedMatch[1].trim();
        text = schedMatch[2].trim();
    }

    // Ekstraksi parameter target opsional di awal
    const tokens = text.split(/\s+/);
    const remainingTokens = [];
    let isParsingParams = true;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const lower = token.toLowerCase();

        if (isParsingParams) {
            // Target Saluran
            if (['all', 'semua'].includes(lower)) {
                targetChannel = 'ALL';
                continue;
            } else if (['wa', 'whatsapp'].includes(lower)) {
                targetChannel = 'WHATSAPP';
                continue;
            } else if (['discord', 'dc'].includes(lower)) {
                targetChannel = 'DISCORD';
                continue;
            }
            // Target Role: 'role:admin', 'role:user', 'role:owner'
            else if (lower.startsWith('role:')) {
                targetRole = lower.replace(/^role:/, '').toUpperCase();
                continue;
            }
            // Target Kontak/Recipients: 'to:6288991185737,841158598465159169'
            else if (lower.startsWith('to:')) {
                const rawList = token.replace(/^to:/i, '');
                targetRecipients = rawList.split(',').map((s) => s.trim()).filter(Boolean);
                continue;
            } else {
                isParsingParams = false;
            }
        }
        remainingTokens.push(token);
    }

    const message = remainingTokens.join(' ').trim();

    return {
        isScheduled,
        scheduleTimeStr,
        targetChannel,
        targetRole,
        targetRecipients,
        message,
    };
}

module.exports = {
    broadcastMessage,
    isAuthorizedOwner,
    setDiscordClient,
    parseScheduleTime,
    formatWIBDateTime,
    parseBroadcastInput,
    createScheduledBroadcast,
    listScheduledBroadcasts,
    cancelScheduledBroadcast,
    processPendingScheduledBroadcasts,
};
