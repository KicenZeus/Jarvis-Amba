const db = require('./db');
const crypto = require('crypto');

/**
 * ==============================================================================
 * Jarvis V2.1: Channel Service & Unified Identity Abstraction
 * Mendukung Multi-Channel (Discord & WhatsApp) dengan Otak & Database Terpadu
 * ==============================================================================
 */

const CHANNELS = {
    DISCORD: 'DISCORD',
    WHATSAPP: 'WHATSAPP',
};

/**
 * Mencari atau memetakan pengguna internal berdasarkan channel dan ID eksternal
 * @param {string} channelType - 'DISCORD' | 'WHATSAPP'
 * @param {string} externalUserId - Discord snowflake ID atau WhatsApp phone number/wa_id
 * @returns {Promise<{ userId: string|null, user: object|null, channelRecord: object|null, isLinked: boolean, status: string }>}
 */
async function resolveUserByChannel(channelType, externalUserId) {
    if (!channelType || !externalUserId) {
        return { userId: null, user: null, channelRecord: null, isLinked: false, status: 'UNKNOWN' };
    }

    try {
        // 1. Cari di tabel pemetaan channel
        const channelRes = await db.query(
            `SELECT uc.*, u.display_name AS primary_display_name, u.callsign, u.role, u.timezone, u.status AS user_status
             FROM user_channels uc
             JOIN users u ON uc.user_id = u.id
             WHERE uc.channel_type = $1 AND uc.external_user_id = $2
             LIMIT 1;`,
            [channelType.toUpperCase(), String(externalUserId).trim()]
        );

        if (channelRes.rows.length > 0) {
            const row = channelRes.rows[0];
            // Update last_seen_at secara asynchronous
            db.query('UPDATE user_channels SET last_seen_at = NOW() WHERE id = $1', [row.id]).catch(() => {});

            return {
                userId: row.user_id,
                user: {
                    id: row.user_id,
                    displayName: row.primary_display_name || row.display_name,
                    callsign: row.callsign,
                    role: row.role,
                    timezone: row.timezone,
                    status: row.user_status,
                },
                channelRecord: row,
                isLinked: true,
                status: row.status,
            };
        }

        // 2. Fallback Backward Compatibility untuk Discord: Cek tabel users langsung
        if (channelType.toUpperCase() === 'DISCORD') {
            const userRes = await db.query(
                `SELECT id, display_name, callsign, role, timezone, status
                 FROM users
                 WHERE discord_user_id = $1 OR id = $1
                 LIMIT 1;`,
                [String(externalUserId).trim()]
            );

            if (userRes.rows.length > 0) {
                const u = userRes.rows[0];
                // Buat entri user_channels otomatis agar mapping berikutnya instan
                db.query(
                    `INSERT INTO user_channels (user_id, channel_type, external_user_id, display_name, is_primary, status, created_at, updated_at)
                     VALUES ($1, 'DISCORD', $2, $3, TRUE, 'ACTIVE', NOW(), NOW())
                     ON CONFLICT (channel_type, external_user_id) DO NOTHING;`,
                    [u.id, String(externalUserId).trim(), u.display_name]
                ).catch(() => {});

                return {
                    userId: u.id,
                    user: u,
                    channelRecord: null,
                    isLinked: true,
                    status: u.status || 'ACTIVE',
                };
            }
        }

        return { userId: null, user: null, channelRecord: null, isLinked: false, status: 'NOT_FOUND' };
    } catch (err) {
        console.error('⚠️ [ChannelService] Gagal resolve user by channel:', err.message);
        return { userId: null, user: null, channelRecord: null, isLinked: false, status: 'ERROR' };
    }
}

/**
 * Menghubungkan (link) channel baru ke pengguna internal yang sudah ada
 * Contoh: Menghubungkan nomor WhatsApp ke akun Jarvis Discord KicenZeus
 */
async function linkUserChannel(userId, channelType, externalUserId, details = {}) {
    const { displayName = null, phoneNumber = null, username = null, isPrimary = false, metadata = {} } = details;

    try {
        const res = await db.query(
            `INSERT INTO user_channels (
                user_id, channel_type, external_user_id, display_name, phone_number, username, is_primary, status, metadata, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, NOW(), NOW())
             ON CONFLICT (channel_type, external_user_id) 
             DO UPDATE SET 
                user_id = EXCLUDED.user_id,
                display_name = COALESCE(EXCLUDED.display_name, user_channels.display_name),
                phone_number = COALESCE(EXCLUDED.phone_number, user_channels.phone_number),
                username = COALESCE(EXCLUDED.username, user_channels.username),
                status = 'ACTIVE',
                updated_at = NOW()
             RETURNING *;`,
            [userId, channelType.toUpperCase(), String(externalUserId).trim(), displayName, phoneNumber, username, isPrimary, JSON.stringify(metadata)]
        );

        console.log(`🔗 [ChannelService] Berhasil menautkan channel ${channelType} (${externalUserId}) ke user ${userId}`);
        return { success: true, channel: res.rows[0] };
    } catch (err) {
        console.error('⚠️ [ChannelService] Gagal link channel:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Idempotency Check & Logging
 * Memastikan pesan webhook tidak diproses ganda akibat network retry dari platform Meta/Discord
 */
async function checkAndRecordInboundMessage(channelType, externalMessageId, userId = null, rawPayload = null) {
    if (!channelType || !externalMessageId) {
        return { isDuplicate: false, messageId: null };
    }

    const payloadHash = rawPayload ? crypto.createHash('md5').update(typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload)).digest('hex') : null;

    try {
        const res = await db.query(
            `INSERT INTO channel_messages (
                user_id, channel_type, external_message_id, direction, status, payload_hash, created_at
             ) VALUES ($1, $2, $3, 'INBOUND', 'PROCESSING', $4, NOW())
             ON CONFLICT (channel_type, external_message_id) DO NOTHING
             RETURNING id, status;`,
            [userId, channelType.toUpperCase(), String(externalMessageId).trim(), payloadHash]
        );

        if (res.rows.length === 0) {
            // Sudah pernah ada di database -> Duplicate Event!
            console.warn(`🛡️ [Idempotency] Pesan duplikat terdeteksi dan dicegah: [${channelType}] ${externalMessageId}`);
            return { isDuplicate: true, messageId: null };
        }

        return { isDuplicate: false, messageId: res.rows[0].id };
    } catch (err) {
        console.error('⚠️ [ChannelService] Gagal mencatat channel message:', err.message);
        return { isDuplicate: false, messageId: null };
    }
}

/**
 * Memperbarui status pemrosesan channel message
 */
async function updateMessageStatus(channelType, externalMessageId, status) {
    try {
        await db.query(
            `UPDATE channel_messages 
             SET status = $1, processed_at = NOW() 
             WHERE channel_type = $2 AND external_message_id = $3;`,
            [status, channelType.toUpperCase(), String(externalMessageId).trim()]
        );
    } catch (err) {
        console.warn('⚠️ [ChannelService] Gagal update status pesan:', err.message);
    }
}

/**
 * Membangun Normalized Inbound Contract Message yang seragam untuk Jarvis Core V2
 */
function buildNormalizedInbound({
    channel,
    internalUserId,
    externalUserId,
    externalConversationId,
    externalMessageId,
    inputType = 'TEXT',
    content = '',
    attachments = [],
    userProfile = {},
    metadata = {},
}) {
    return {
        schemaVersion: 2,
        channel: channel.toUpperCase(),
        internalUserId: internalUserId || null,
        externalUserId: String(externalUserId || ''),
        externalConversationId: String(externalConversationId || externalUserId || ''),
        externalMessageId: String(externalMessageId || Date.now()),
        inputType: inputType.toUpperCase(), // 'TEXT', 'AUDIO', 'IMAGE', 'DOCUMENT'
        content: String(content || '').trim(),
        attachments: Array.isArray(attachments) ? attachments : [],
        user: {
            id: internalUserId || externalUserId,
            displayName: userProfile.displayName || userProfile.cleanNickname || 'Teman',
            callsign: userProfile.callsign || null,
            preferredGreetingName: userProfile.preferredName || userProfile.displayName || 'Teman',
            hasCustomCallsign: Boolean(userProfile.hasCustomCallsign),
            role: userProfile.role || 'USER',
        },
        timestamp: new Date().toISOString(),
        metadata: {
            ...metadata,
            sourcePlatform: channel.toLowerCase(),
        },
    };
}

/**
 * Mengonversi teks Markdown umum / Discord agar sesuai dengan WhatsApp Formatting
 * Discord: **teks tebal** -> WhatsApp: *teks tebal*
 * Discord: __garis bawah__ -> WhatsApp: _garis bawah_
 * Menghilangkan tag mention Discord <@12345>
 */
function formatForWhatsApp(text) {
    if (!text || typeof text !== 'string') return '';
    let formatted = text;

    // Bersihkan tag mention Discord <@...>
    formatted = formatted.replace(/<@!?\d+>/g, '');

    // Konversi Bold: **text** -> *text*
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '*$1*');

    // Konversi Headers: # Header -> *Header*
    formatted = formatted.replace(/^#+\s*(.+)$/gm, '*$1*');

    // Rapikan baris kosong berlebih
    formatted = formatted.replace(/\n{3,}/g, '\n\n').trim();

    return formatted;
}

/**
 * Mengonversi teks untuk Discord Formatting
 */
function formatForDiscord(text) {
    if (!text || typeof text !== 'string') return '';
    return text.trim();
}

/**
 * Menentukan preferensi delivery notifikasi untuk suatu event
 */
async function getNotificationDeliveryChannels(userId, eventType = 'REMINDER') {
    try {
        const res = await db.query(
            `SELECT channel_type, enabled, quiet_hours_start, quiet_hours_end 
             FROM notification_preferences 
             WHERE user_id = $1 AND event_type = $2 LIMIT 1;`,
            [userId, eventType]
        );

        if (res.rows.length > 0 && res.rows[0].enabled) {
            return res.rows[0].channel_type; // 'DISCORD', 'WHATSAPP', 'BOTH'
        }
    } catch (err) {
        console.warn('⚠️ [ChannelService] Gagal cek preferensi notifikasi:', err.message);
    }

    return 'DISCORD'; // Default fallback
}

module.exports = {
    CHANNELS,
    resolveUserByChannel,
    linkUserChannel,
    checkAndRecordInboundMessage,
    updateMessageStatus,
    buildNormalizedInbound,
    formatForWhatsApp,
    formatForDiscord,
    getNotificationDeliveryChannels,
};
