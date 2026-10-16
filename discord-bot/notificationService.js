const db = require('./db');
const { formatForWhatsApp } = require('./channelService');
const { sendWhatsAppTextMessage } = require('./whatsappAdapter');

/**
 * ==============================================================================
 * Jarvis V2.1 Phase 6: Proactive Messaging & Notification Preferences Service
 * Mengatur Smart Routing Notifikasi ke Discord, WhatsApp, atau Keduanya (BOTH)
 * ==============================================================================
 */

const EVENT_TYPES = {
    REMINDER: 'REMINDER',
    DAILY_BRIEFING: 'DAILY_BRIEFING',
    DAILY_RECAP: 'DAILY_RECAP',
    TASK_DUE: 'TASK_DUE',
};

const CHANNELS = {
    DISCORD: 'DISCORD',
    WHATSAPP: 'WHATSAPP',
    BOTH: 'BOTH',
};

/**
 * Memeriksa apakah waktu saat ini berada di dalam rentang Jam Tenang (Quiet Hours)
 * @param {string|null} startTimeStr - Format "HH:mm" atau "HH:mm:ss"
 * @param {string|null} endTimeStr - Format "HH:mm" atau "HH:mm:ss"
 * @param {string} timeZone - Zona waktu (default: 'Asia/Jakarta')
 * @returns {boolean}
 */
function isQuietHours(startTimeStr, endTimeStr, timeZone = 'Asia/Jakarta') {
    if (!startTimeStr || !endTimeStr) return false;

    try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        const currentTimeStr = formatter.format(now);

        const toMinutes = (t) => {
            const parts = String(t).split(':').map(Number);
            return (parts[0] || 0) * 60 + (parts[1] || 0);
        };

        const currentMin = toMinutes(currentTimeStr);
        const startMin = toMinutes(startTimeStr);
        const endMin = toMinutes(endTimeStr);

        if (startMin <= endMin) {
            // Rentang waktu di hari yang sama (misal 13:00 - 15:00)
            return currentMin >= startMin && currentMin < endMin;
        } else {
            // Rentang waktu melewati tengah malam (misal 22:00 - 07:00)
            return currentMin >= startMin || currentMin < endMin;
        }
    } catch (e) {
        return false;
    }
}

/**
 * Mendapatkan seluruh preferensi notifikasi milik seorang pengguna
 * @param {string} userId - ID internal pengguna (users.id)
 * @returns {Promise<Array>}
 */
async function getUserNotificationPreferences(userId) {
    if (!userId) return [];
    try {
        const res = await db.query(
            `SELECT event_type, channel_type, enabled, quiet_hours_start, quiet_hours_end, updated_at
             FROM notification_preferences
             WHERE user_id = $1
             ORDER BY event_type ASC;`,
            [userId]
        );
        return res.rows;
    } catch (err) {
        console.warn('⚠️ [NotificationService] Gagal fetch preferensi notifikasi:', err.message);
        return [];
    }
}

/**
 * Mengatur atau memperbarui preferensi notifikasi untuk event tertentu
 * @param {string} userId - ID internal pengguna
 * @param {string} eventType - 'REMINDER' | 'DAILY_BRIEFING' | 'DAILY_RECAP' | 'TASK_DUE'
 * @param {string} channelType - 'DISCORD' | 'WHATSAPP' | 'BOTH'
 * @param {boolean} enabled - Aktifkan atau nonaktifkan
 * @param {string|null} quietHoursStart - Contoh "22:00"
 * @param {string|null} quietHoursEnd - Contoh "07:00"
 */
async function setNotificationPreference(
    userId,
    eventType,
    channelType = 'BOTH',
    enabled = true,
    quietHoursStart = null,
    quietHoursEnd = null
) {
    const cleanEvent = String(eventType).toUpperCase();
    const cleanChannel = String(channelType).toUpperCase();

    try {
        const res = await db.query(
            `INSERT INTO notification_preferences (
                user_id, event_type, channel_type, enabled, quiet_hours_start, quiet_hours_end, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (user_id, event_type)
             DO UPDATE SET
                channel_type = EXCLUDED.channel_type,
                enabled = EXCLUDED.enabled,
                quiet_hours_start = COALESCE(EXCLUDED.quiet_hours_start, notification_preferences.quiet_hours_start),
                quiet_hours_end = COALESCE(EXCLUDED.quiet_hours_end, notification_preferences.quiet_hours_end),
                updated_at = NOW()
             RETURNING *;`,
            [userId, cleanEvent, cleanChannel, enabled, quietHoursStart, quietHoursEnd]
        );

        console.log(`🔔 [NotificationService] Preferensi notifikasi diperbarui untuk user ${userId}: [${cleanEvent}] -> ${cleanChannel}`);
        return { success: true, preference: res.rows[0] };
    } catch (err) {
        console.error('❌ [NotificationService] Gagal set preferensi notifikasi:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Smart Routing: Menentukan target channel dan nomor/ID tujuan pengiriman notifikasi
 * @param {string} userId - ID internal pengguna
 * @param {string} eventType - 'REMINDER' | 'DAILY_BRIEFING' | 'DAILY_RECAP' | 'TASK_DUE'
 * @param {object} context - { channelId, preferredChannel }
 * @returns {Promise<{ shouldSend: boolean, reason?: string, targets: Array<{ channel: string, destination: string }> }>}
 */
async function resolveNotificationDestinations(userId, eventType, context = {}) {
    if (!userId) {
        return { shouldSend: false, reason: 'NO_USER_ID', targets: [] };
    }

    try {
        // 1. Ambil preferensi notifikasi dari tabel notification_preferences
        const prefRes = await db.query(
            `SELECT channel_type, enabled, quiet_hours_start, quiet_hours_end
             FROM notification_preferences
             WHERE user_id = $1 AND event_type = $2 LIMIT 1;`,
            [userId, String(eventType).toUpperCase()]
        );

        const pref = prefRes.rows[0];

        // Jika user secara eksplisit mematikan notifikasi untuk event ini
        if (pref && pref.enabled === false) {
            return { shouldSend: false, reason: 'DISABLED_BY_USER', targets: [] };
        }

        // 2. Cek Jam Tenang (Quiet Hours)
        if (pref && isQuietHours(pref.quiet_hours_start, pref.quiet_hours_end)) {
            console.log(`🌙 [NotificationService] Notifikasi ${eventType} diabaikan/ditunda karena Jam Tenang (${pref.quiet_hours_start} - ${pref.quiet_hours_end}) untuk user ${userId}`);
            return { shouldSend: false, reason: 'QUIET_HOURS', targets: [] };
        }

        // Tentukan channelType: Dari preferensi user jika ada, atau default pintar
        let channelType = pref ? pref.channel_type : (context.preferredChannel || 'BOTH');

        // 3. Ambil data channel eksternal yang tertaut dengan user
        const channelsRes = await db.query(
            `SELECT channel_type, external_user_id, phone_number, is_primary
             FROM user_channels
             WHERE user_id = $1 AND status = 'ACTIVE';`,
            [userId]
        );

        const userChannels = channelsRes.rows;
        const discordChannel = userChannels.find((c) => c.channel_type === 'DISCORD');
        const waChannel = userChannels.find((c) => c.channel_type === 'WHATSAPP');

        // Jika user hanya punya akun WhatsApp (misal user mendaftar lewat WA)
        if (!discordChannel && waChannel) {
            channelType = 'WHATSAPP';
        }
        // Jika user hanya punya Discord
        if (discordChannel && !waChannel && channelType === 'BOTH') {
            channelType = 'DISCORD';
        }

        const targets = [];

        // Resolusi Target DISCORD
        if (channelType === 'DISCORD' || channelType === 'BOTH') {
            const discordDest = context.channelId && !String(context.channelId).startsWith('wa_')
                ? context.channelId
                : (discordChannel?.external_user_id || null);

            if (discordDest) {
                targets.push({
                    channel: 'DISCORD',
                    destination: discordDest,
                    isDM: discordDest === discordChannel?.external_user_id,
                });
            }
        }

        // Resolusi Target WHATSAPP
        if (channelType === 'WHATSAPP' || channelType === 'BOTH') {
            let waPhone = waChannel?.phone_number || waChannel?.external_user_id;

            // Jika context membawa channelId WhatsApp (wa_628xxx)
            if (!waPhone && context.channelId && String(context.channelId).startsWith('wa_')) {
                waPhone = String(context.channelId).replace(/^wa_/, '');
            }
            // Jika userId berawalan wa_
            if (!waPhone && String(userId).startsWith('wa_')) {
                waPhone = String(userId).replace(/^wa_/, '');
            }

            if (waPhone) {
                targets.push({
                    channel: 'WHATSAPP',
                    destination: waPhone,
                });
            }
        }

        // Jika channelType adalah BOTH atau spesifik tetapi tidak ada target yang cocok, fallback ke context
        if (targets.length === 0 && context.channelId) {
            if (String(context.channelId).startsWith('wa_')) {
                targets.push({ channel: 'WHATSAPP', destination: String(context.channelId).replace(/^wa_/, '') });
            } else {
                targets.push({ channel: 'DISCORD', destination: context.channelId, isDM: false });
            }
        }

        return {
            shouldSend: targets.length > 0,
            targets,
            channelType,
            quietHours: false,
        };
    } catch (err) {
        console.error('❌ [NotificationService] Error pada smart routing destinations:', err.message);
        return { shouldSend: false, reason: err.message, targets: [] };
    }
}

/**
 * Mengirim notifikasi proaktif ke semua target channel yang telah di-resolve
 * @param {object} params
 * @param {string} params.userId - ID internal pengguna
 * @param {string} params.eventType - 'REMINDER' | 'DAILY_BRIEFING' | 'DAILY_RECAP' | 'TASK_DUE'
 * @param {string} params.text - Pesan notifikasi
 * @param {object} [params.context] - { channelId, reminderId }
 * @param {object} [params.discordClient] - Discord Client instance
 * @returns {Promise<{ success: boolean, results: Array }>}
 */
async function sendSmartNotification({ userId, eventType, text, context = {}, discordClient = null }) {
    const route = await resolveNotificationDestinations(userId, eventType, context);
    if (!route.shouldSend) {
        return { success: false, reason: route.reason, results: [] };
    }

    const results = [];

    for (const target of route.targets) {
        if (target.channel === 'WHATSAPP') {
            try {
                const formatted = formatForWhatsApp(text);
                const waRes = await sendWhatsAppTextMessage(target.destination, formatted);
                results.push({ channel: 'WHATSAPP', success: waRes.success, destination: target.destination, error: waRes.error });
                if (waRes.success) {
                    console.log(`📤 [SmartNotif] Notifikasi [${eventType}] terkirim ke WhatsApp ${target.destination}`);
                }
            } catch (waErr) {
                results.push({ channel: 'WHATSAPP', success: false, error: waErr.message });
            }
        } else if (target.channel === 'DISCORD' && discordClient) {
            try {
                let sent = false;
                // 1. Coba kirim ke channel ID jika ada
                if (target.destination) {
                    const channel = await discordClient.channels.fetch(target.destination).catch(() => null);
                    if (channel) {
                        const mention = userId ? `<@${userId}> ` : '';
                        const msg = text.startsWith('<@') ? text : `${mention}${text}`;
                        await channel.send(msg);
                        sent = true;
                    }
                }
                // 2. Fallback ke Direct Message (DM) jika channel tidak ditemukan
                if (!sent && userId) {
                    const user = await discordClient.users.fetch(userId).catch(() => null);
                    if (user) {
                        const dm = await user.createDM().catch(() => null);
                        if (dm) {
                            await dm.send(text);
                            sent = true;
                        }
                    }
                }

                results.push({ channel: 'DISCORD', success: sent, destination: target.destination });
                if (sent) {
                    console.log(`📤 [SmartNotif] Notifikasi [${eventType}] terkirim ke Discord (${target.destination})`);
                }
            } catch (dcErr) {
                results.push({ channel: 'DISCORD', success: false, error: dcErr.message });
            }
        }
    }

    return {
        success: results.some((r) => r.success),
        results,
    };
}

module.exports = {
    EVENT_TYPES,
    CHANNELS,
    isQuietHours,
    getUserNotificationPreferences,
    setNotificationPreference,
    resolveNotificationDestinations,
    sendSmartNotification,
};
