const db = require('./db');
const { formatForWhatsApp } = require('./channelService');
const { sendWhatsAppTextMessage } = require('./whatsappAdapter');

/**
 * ==============================================================================
 * Jarvis V2.1: Multi-Channel Broadcast Service (WhatsApp & Discord)
 * Mengirim pesan massal/pengumuman serentak ke seluruh pengguna terdaftar
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
 * Memeriksa apakah user memiliki hak akses OWNER atau ADMIN
 * Mendukung pemeriksaan ID internal, Snowflake Discord, maupun Nomor WhatsApp
 * @param {string} userId - ID internal atau snowflake/phone
 * @returns {Promise<boolean>}
 */
async function isAuthorizedAdmin(userId) {
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
        return role === 'OWNER' || role === 'ADMIN';
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
 * Mengirimkan pesan broadcast serentak ke semua pengguna yang pernah terdaftar
 * @param {object} params
 * @param {string} params.message - Pesan yang akan disiarkan
 * @param {string} [params.targetChannel] - 'ALL' | 'WHATSAPP' | 'DISCORD' (default: 'ALL')
 * @param {string} [params.senderUserId] - ID user yang meminta broadcast (opsional untuk verifikasi role)
 * @param {object} [params.discordClient] - Discord Client instance (untuk kirim DM Discord)
 * @param {boolean} [params.includeBotOwner] - Apakah owner ikut menerima pesan broadcast (default: true)
 * @returns {Promise<{ success: boolean, total: number, delivered: number, failed: number, details: Array, error?: string }>}
 */
async function broadcastMessage({
    message,
    targetChannel = 'ALL',
    senderUserId = null,
    discordClient = null,
    includeBotOwner = true,
}) {
    const dClient = discordClient || globalDiscordClient;
    if (!message || !message.trim()) {
        return { success: false, total: 0, delivered: 0, failed: 0, details: [], error: 'Pesan broadcast tidak boleh kosong' };
    }

    // Verifikasi role jika senderUserId disertakan
    if (senderUserId) {
        const isAuth = await isAuthorizedAdmin(senderUserId);
        if (!isAuth) {
            console.warn(`⛔ [Broadcast] Akses ditolak untuk user bukan admin/owner: ${senderUserId}`);
            return {
                success: false,
                total: 0,
                delivered: 0,
                failed: 0,
                details: [],
                error: 'Hanya OWNER atau ADMIN yang diizinkan melakukan broadcast.',
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
               AND uc.external_user_id NOT IN ('12345', 'test_user_kicen')
             ORDER BY uc.created_at ASC;`
        );

        let recipients = res.rows;

        // Filter berdasarkan channel target jika bukan 'ALL'
        if (cleanTarget === 'WHATSAPP') {
            recipients = recipients.filter((r) => r.channel_type === 'WHATSAPP');
        } else if (cleanTarget === 'DISCORD') {
            recipients = recipients.filter((r) => r.channel_type === 'DISCORD');
        }

        console.log(`📢 [Broadcast] Memulai pengiriman broadcast ke ${recipients.length} penerima (Target: ${cleanTarget})...`);

        let delivered = 0;
        let failed = 0;
        const details = [];

        for (const r of recipients) {
            const recipientName = r.callsign || r.display_name || r.user_name || 'Kawan';
            
            // Format pesan broadcast personal & sopan
            const personalizedMsg = `📢 *[PENGUMUMAN JARVIS AMBA]*\nHalo ${recipientName}!\n\n${message.trim()}\n\n_— Salam hangat, Asisten Jarvis Amba_`;

            // 1. Pengiriman ke WHATSAPP
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
                // Rate limit pause 300ms antar nomor WhatsApp
                await sleep(300);
            }

            // 2. Pengiriman ke DISCORD (Direct Message)
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
                // Rate limit pause 300ms antar user Discord
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

module.exports = {
    broadcastMessage,
    isAuthorizedAdmin,
    setDiscordClient,
};
