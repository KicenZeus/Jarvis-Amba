const db = require('./db');
const { formatForWhatsApp } = require('./channelService');
const { sendWhatsAppTextMessage } = require('./whatsappAdapter');
const { evaluateSmartPresenceRouting } = require('./presenceService');

/**
 * ==============================================================================
 * Jarvis V3 Phase 5: Notification Delivery Router (PRD V3 Sec 37 - 42)
 * Smart Multi-Channel Notification Router (DISCORD, WHATSAPP, ANDROID, IOS, WEB)
 * Aturan Jam Tenang Terintegrasi & Bypass Formula D1
 * ==============================================================================
 */

const EVENT_TYPES = {
    REMINDER: 'REMINDER',
    DAILY_BRIEFING: 'DAILY_BRIEFING',
    DAILY_RECAP: 'DAILY_RECAP',
    TASK_DUE: 'TASK_DUE',
    FINANCE_ALERT: 'FINANCE_ALERT',
    APPROVAL_REQUEST: 'APPROVAL_REQUEST',
    SYSTEM_ALERT: 'SYSTEM_ALERT',
};

const CHANNELS = {
    DISCORD: 'DISCORD',
    WHATSAPP: 'WHATSAPP',
    ANDROID: 'ANDROID',
    IOS: 'IOS',
    WEB: 'WEB',
    BOTH: 'BOTH',
};

/**
 * Memeriksa apakah waktu tertentu berada di dalam rentang Jam Tenang (Quiet Hours)
 * @param {string|null} startTimeStr - Format "HH:mm" atau "HH:mm:ss"
 * @param {string|null} endTimeStr - Format "HH:mm" atau "HH:mm:ss"
 * @param {string} timeZone - Zona waktu (default: 'Asia/Jakarta')
 * @param {Date|null} checkDate - Objek waktu untuk pengujian (opsional, default: sekarang)
 * @returns {boolean}
 */
function isQuietHours(startTimeStr, endTimeStr, timeZone = 'Asia/Jakarta', checkDate = null) {
    if (!startTimeStr || !endTimeStr) return false;

    try {
        const now = checkDate instanceof Date ? checkDate : new Date();
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
            // Rentang waktu melewati tengah malam (misal 22:00 - 06:00)
            return currentMin >= startMin || currentMin < endMin;
        }
    } catch (e) {
        return false;
    }
}

/**
 * Mengambil jam tenang efektif untuk pengguna (dengan fallback default V2: 22:00 - 06:00)
 */
async function getUserQuietHours(userId, eventType = null) {
    if (!userId) return { start: '22:00', end: '06:00' };
    try {
        let res;
        if (eventType) {
            res = await db.query(
                `SELECT quiet_hours_start, quiet_hours_end 
                 FROM notification_preferences 
                 WHERE user_id = $1 AND event_type = $2 LIMIT 1;`,
                [userId, String(eventType).toUpperCase()]
            );
        }
        if (!res || res.rows.length === 0 || (!res.rows[0].quiet_hours_start && !res.rows[0].quiet_hours_end)) {
            res = await db.query(
                `SELECT quiet_hours_start, quiet_hours_end 
                 FROM notification_preferences 
                 WHERE user_id = $1 AND (quiet_hours_start IS NOT NULL OR quiet_hours_end IS NOT NULL)
                 ORDER BY updated_at DESC LIMIT 1;`,
                [userId]
            );
        }
        const row = res?.rows[0];
        const startStr = row?.quiet_hours_start ? String(row.quiet_hours_start).substring(0, 5) : '22:00';
        const endStr = row?.quiet_hours_end ? String(row.quiet_hours_end).substring(0, 5) : '06:00';
        return { start: startStr, end: endStr };
    } catch (_) {
        return { start: '22:00', end: '06:00' };
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
 * @param {string} eventType - Notification Type (REMINDER, DAILY_BRIEFING, DAILY_RECAP, TASK_DUE, FINANCE_ALERT, APPROVAL_REQUEST, SYSTEM_ALERT)
 * @param {object} context - { channelId, preferredChannel, target_channels, priority, bypassQuietHours, now }
 * @returns {Promise<{ shouldSend: boolean, reason?: string, targets: Array<{ channel: string, destination: string, deviceId?: number }>, quietHours?: boolean, quietHoursWindow?: object }>}
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

        // 2. Cek Jam Tenang (Quiet Hours) - PRD Sec 39 & Keputusan Final D1
        // PENGINGAT (REMINDER) yang diminta user secara eksplisit dan notifikasi prioritas tinggi tidak boleh di-drop oleh Jam Tenang
        const isExemptFromQuietHours = 
            Boolean(context.bypassQuietHours) || 
            eventType === 'REMINDER' || 
            ['URGENT', 'HIGH'].includes(String(context.priority || '').toUpperCase());

        const qHours = await getUserQuietHours(userId, eventType);
        const inQuietHours = isQuietHours(qHours.start, qHours.end, 'Asia/Jakarta', context.now || null);

        if (!isExemptFromQuietHours && inQuietHours) {
            console.log(`🌙 [NotificationService] Notifikasi ${eventType} ditunda karena Jam Tenang (${qHours.start} - ${qHours.end}) untuk user ${userId}`);
            return { 
                shouldSend: false, 
                reason: 'QUIET_HOURS', 
                targets: [], 
                quietHours: true,
                quietHoursWindow: qHours 
            };
        }

        // 3. Tentukan saluran target (PRD Sec 40 - Multi-Channel Targets)
        // Eksplisit target_channels menang jika disediakan
        let targetChannelTypes = [];
        if (Array.isArray(context.target_channels) && context.target_channels.length > 0) {
            targetChannelTypes = context.target_channels.map(c => String(c).toUpperCase().trim());
        } else if (pref && pref.channel_type) {
            targetChannelTypes = pref.channel_type === 'BOTH' ? ['DISCORD', 'WHATSAPP'] : [pref.channel_type];
        } else if (context.preferredChannel) {
            targetChannelTypes = context.preferredChannel === 'BOTH' ? ['DISCORD', 'WHATSAPP'] : [context.preferredChannel];
        } else {
            targetChannelTypes = ['DISCORD', 'WHATSAPP'];
        }

        // 4. Ambil data channel eksternal yang tertaut dengan user
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
        if (!discordChannel && waChannel && targetChannelTypes.includes('DISCORD') && !targetChannelTypes.includes('WHATSAPP')) {
            targetChannelTypes.push('WHATSAPP');
        }
        // Jika user hanya punya Discord
        if (discordChannel && !waChannel && targetChannelTypes.includes('WHATSAPP') && !targetChannelTypes.includes('DISCORD')) {
            targetChannelTypes.push('DISCORD');
        }

        // 4.b Evaluasi Smart Presence Routing (Phase 9 - PRD Sec 67 & 68)
        // Hindari spam notifikasi ke WhatsApp / Discord saat pengguna sedang aktif di Web Dashboard
        const presenceEvaluation = await evaluateSmartPresenceRouting(userId, eventType, targetChannelTypes, context);
        targetChannelTypes = presenceEvaluation.finalChannels;

        const targets = [];

        // Resolusi Target DISCORD
        if (targetChannelTypes.includes('DISCORD')) {
            const discordDest = context.channelId && !String(context.channelId).startsWith('wa_') && /^\d{17,20}$/.test(String(context.channelId))
                ? context.channelId
                : (discordChannel?.external_user_id || (/^\d{17,20}$/.test(String(userId)) ? userId : null));

            if (discordDest) {
                targets.push({
                    channel: 'DISCORD',
                    destination: discordDest,
                    isDM: discordDest === discordChannel?.external_user_id,
                });
            }
        }

        // Resolusi Target WHATSAPP
        const isWhatsAppOrigin = context.channelId && String(context.channelId).startsWith('wa_');
        if (targetChannelTypes.includes('WHATSAPP') || isWhatsAppOrigin) {
            let waPhone = waChannel?.phone_number || waChannel?.external_user_id || context.phone || context.destination;

            if (!waPhone && isWhatsAppOrigin) {
                waPhone = String(context.channelId).replace(/^wa_/, '');
            }
            if (!waPhone && String(userId).startsWith('wa_')) {
                waPhone = String(userId).replace(/^wa_/, '');
            }

            if (waPhone && !targets.some((t) => t.channel === 'WHATSAPP' && t.destination === waPhone)) {
                targets.push({
                    channel: 'WHATSAPP',
                    destination: waPhone,
                });
            } else if (!waPhone && targetChannelTypes.includes('WHATSAPP')) {
                // Jika user meminta eksplisit target WHATSAPP tetapi belum ada nomor tertaut
                targets.push({
                    channel: 'WHATSAPP',
                    destination: 'unlinked_whatsapp',
                });
            }
        }

        // Resolusi Target ANDROID (Mobile App Push)
        if (targetChannelTypes.includes('ANDROID')) {
            try {
                const devRes = await db.query(
                    `SELECT id, device_identifier, push_token 
                     FROM user_devices 
                     WHERE user_id = $1 AND platform = 'android' AND status = 'ACTIVE' 
                     ORDER BY last_seen_at DESC LIMIT 1;`,
                    [userId]
                );
                if (devRes.rows.length > 0) {
                    targets.push({
                        channel: 'ANDROID',
                        destination: devRes.rows[0].push_token || 'fcm_silent',
                        deviceId: devRes.rows[0].id,
                    });
                } else {
                    targets.push({
                        channel: 'ANDROID',
                        destination: 'android_generic',
                        deviceId: null,
                    });
                }
            } catch (_) {
                targets.push({ channel: 'ANDROID', destination: 'android_generic', deviceId: null });
            }
        }

        // Resolusi Target WEB (Dashboard Realtime / Alerts)
        if (targetChannelTypes.includes('WEB')) {
            targets.push({
                channel: 'WEB',
                destination: userId,
            });
        }

        // Fallback jika belum ada target cocok tetapi ada context.channelId
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
            channelTypes: targetChannelTypes,
            quietHours: false,
            presenceRouted: Boolean(presenceEvaluation?.presenceRouted),
            suppressedChannels: presenceEvaluation?.suppressedChannels || [],
            activePlatform: presenceEvaluation?.activePlatform || null,
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
 * @param {string} params.eventType - 'REMINDER' | 'DAILY_BRIEFING' | 'DAILY_RECAP' | 'TASK_DUE' | 'FINANCE_ALERT' | 'APPROVAL_REQUEST' | 'SYSTEM_ALERT'
 * @param {string} params.text - Pesan notifikasi
 * @param {object} [params.context] - { channelId, reminderId, target_channels, priority, bypassQuietHours, now }
 * @param {object} [params.discordClient] - Discord Client instance
 * @returns {Promise<{ success: boolean, results: Array }>}
 */
async function sendSmartNotification({ userId, eventType, text, context = {}, discordClient = null }) {
    const route = await resolveNotificationDestinations(userId, eventType, context);
    if (!route.shouldSend) {
        return { success: false, reason: route.reason, results: [], quietHours: Boolean(route.quietHours) };
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
        } else if (target.channel === 'ANDROID') {
            try {
                await db.query(
                    `INSERT INTO proactive_logs (user_id, type, channel_id, content, status) 
                     VALUES ($1, $2, 'ANDROID', $3, 'SENT');`,
                    [userId, eventType, text]
                ).catch(() => {});
                results.push({ channel: 'ANDROID', success: true, destination: target.destination, deviceId: target.deviceId });
                console.log(`📤 [SmartNotif] Notifikasi [${eventType}] terkirim ke Android (${target.destination || 'device'})`);
            } catch (androErr) {
                results.push({ channel: 'ANDROID', success: false, error: androErr.message });
            }
        } else if (target.channel === 'WEB') {
            try {
                await db.query(
                    `INSERT INTO proactive_logs (user_id, type, channel_id, content, status) 
                     VALUES ($1, $2, 'WEB', $3, 'SENT');`,
                    [userId, eventType, text]
                ).catch(() => {});
                results.push({ channel: 'WEB', success: true, destination: target.destination });
                console.log(`📤 [SmartNotif] Notifikasi [${eventType}] terkirim ke Web Dashboard (${userId})`);
            } catch (webErr) {
                results.push({ channel: 'WEB', success: false, error: webErr.message });
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
    getUserQuietHours,
    getUserNotificationPreferences,
    setNotificationPreference,
    resolveNotificationDestinations,
    sendSmartNotification,
};
