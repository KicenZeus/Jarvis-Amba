/**
 * presenceService.js
 * Manajemen Status Kehadiran Pengguna (Active Presence) & Cross-Channel Smart Routing
 * Sesuai PRD V3 Phase 9 (Sec 65 - 68)
 */

const db = require('./db');

const DEFAULT_PRESENCE_WINDOW_SECONDS = 120; // 2 menit

/**
 * Mencatat detak jantung (heartbeat) aktifitas dari perangkat pengguna (Web / Mobile)
 * @param {string} userId - ID kanonik pengguna
 * @param {string} deviceIdentifier - Identifier unik perangkat (web_xxx atau android_xxx)
 * @param {string} platform - 'web' | 'android' | 'ios'
 * @param {object} [metadata] - Data tambahan seperti app_version
 * @returns {Promise<object>} Status perangkat yang diperbarui
 */
async function recordHeartbeat(userId, deviceIdentifier, platform = 'web', metadata = {}) {
    if (!userId || !deviceIdentifier) {
        throw new Error('userId dan deviceIdentifier wajib disertakan.');
    }

    const plat = String(platform).toLowerCase();
    const appVersion = metadata.app_version || '3.1.0';
    const deviceName = metadata.device_name || `Device ${deviceIdentifier}`;

    const query = `
        INSERT INTO user_devices (
            user_id, device_identifier, device_name, platform, 
            app_version, status, push_status, last_seen_at, updated_at
        )
        VALUES (
            $1, $2, $3, $4, 
            $5, 'ACTIVE', 'OK', NOW(), NOW()
        )
        ON CONFLICT (user_id, device_identifier) DO UPDATE SET
            last_seen_at = NOW(),
            status = 'ACTIVE',
            platform = EXCLUDED.platform,
            app_version = COALESCE(EXCLUDED.app_version, user_devices.app_version),
            updated_at = NOW()
        RETURNING id, user_id, device_identifier, platform, last_seen_at, status;
    `;

    const res = await db.query(query, [
        userId,
        deviceIdentifier,
        deviceName,
        plat,
        appVersion,
    ]);

    return res.rows[0];
}

/**
 * Mengambil status kehadiran aktif pengguna (Active Presence)
 * User dianggap aktif jika memiliki setidaknya 1 perangkat dengan last_seen_at dalam windowSeconds terakhir.
 *
 * @param {string} userId - ID kanonik pengguna
 * @param {number} [windowSeconds=120] - Ambang batas aktifitas dalam detik (default: 2 menit)
 * @returns {Promise<{ isActive: boolean, activePlatform: string|null, activeDevices: Array, lastSeenAt: Date|null }>}
 */
async function getUserActivePresence(userId, windowSeconds = DEFAULT_PRESENCE_WINDOW_SECONDS) {
    if (!userId) {
        return { isActive: false, activePlatform: null, activeDevices: [], lastSeenAt: null };
    }

    try {
        const res = await db.query(
            `SELECT id, device_identifier, device_name, platform, app_version, last_seen_at, status
             FROM user_devices
             WHERE user_id = $1 
               AND status = 'ACTIVE' 
               AND last_seen_at >= NOW() - ($2 * INTERVAL '1 second')
             ORDER BY last_seen_at DESC;`,
            [userId, windowSeconds]
        );

        const activeDevices = res.rows;
        const isActive = activeDevices.length > 0;
        const activePlatform = isActive ? activeDevices[0].platform.toLowerCase() : null;
        const lastSeenAt = isActive ? activeDevices[0].last_seen_at : null;

        return {
            isActive,
            activePlatform,
            activeDevices,
            lastSeenAt,
        };
    } catch (err) {
        console.warn('⚠️ [PresenceService] Gagal memeriksa presence:', err.message);
        return { isActive: false, activePlatform: null, activeDevices: [], lastSeenAt: null };
    }
}

/**
 * Menandai perangkat sebagai offline (misal saat logout atau tab window ditutup)
 * @param {string} userId
 * @param {string} deviceIdentifier
 */
async function setDeviceOffline(userId, deviceIdentifier) {
    if (!userId || !deviceIdentifier) return false;

    const res = await db.query(
        `UPDATE user_devices 
         SET last_seen_at = NOW() - INTERVAL '1 hour', updated_at = NOW() 
         WHERE user_id = $1 AND device_identifier = $2
         RETURNING id;`,
        [userId, deviceIdentifier]
    );

    return res.rowCount > 0;
}

/**
 * Melakukan perutean notifikasi pintar berdasarkan kehadiran pengguna (PRD Sec 67)
 * Menghindari spam WhatsApp/Discord saat pengguna sedang aktif berinteraksi di Web Dashboard.
 *
 * @param {string} userId - ID kanonik pengguna
 * @param {string} eventType - Tipe notifikasi (SYSTEM_ALERT, TASK_DUE, DAILY_BRIEFING, dll)
 * @param {Array<string>} resolvedChannels - Saluran yang awal mulanya ter-resolve (misal ['DISCORD', 'WHATSAPP'])
 * @param {object} [context] - Konteks tambahan ({ forceExternal, delivery_mode, target_channels })
 * @returns {Promise<{ finalChannels: Array<string>, suppressedChannels: Array<string>, presenceRouted: boolean, activePlatform: string|null }>}
 */
async function evaluateSmartPresenceRouting(userId, eventType, resolvedChannels = [], context = {}) {
    // 1. Jika caller secara eksplisit memaksa pengiriman eksternal, lewati penekanan
    if (context.forceExternal === true) {
        return {
            finalChannels: resolvedChannels,
            suppressedChannels: [],
            presenceRouted: false,
            activePlatform: null,
        };
    }

    // 2. Hardware alarm atau critical approval harus selalu berbunyi/terkirim
    if (context.delivery_mode === 'ALARM' || context.delivery_mode === 'CHAT_AND_ALARM') {
        return {
            finalChannels: resolvedChannels,
            suppressedChannels: [],
            presenceRouted: false,
            activePlatform: null,
        };
    }

    // 3. Cek kehadiran aktif pengguna dalam 120 detik terakhir
    const presence = await getUserActivePresence(userId, DEFAULT_PRESENCE_WINDOW_SECONDS);

    // 4. Jika pengguna SEDANG AKTIF di Web Dashboard (PRD Sec 67)
    // Notifikasi proaktif diprioritaskan muncul sebagai toast di Web, meminimalkan spam WhatsApp / Discord
    if (presence.isActive && presence.activePlatform === 'web') {
        const suppressed = [];
        const filtered = [];

        for (const ch of resolvedChannels) {
            if (ch === 'WHATSAPP' || ch === 'DISCORD') {
                suppressed.push(ch);
            } else {
                filtered.push(ch);
            }
        }

        // Pastikan channel WEB disertakan untuk toast in-app
        if (!filtered.includes('WEB')) {
            filtered.push('WEB');
        }

        return {
            finalChannels: filtered,
            suppressedChannels: suppressed,
            presenceRouted: suppressed.length > 0,
            activePlatform: 'web',
        };
    }

    // 5. Jika pengguna aktif di Android Native (dan bukan di Web), prioritaskan push Android
    if (presence.isActive && presence.activePlatform === 'android') {
        const suppressed = [];
        const filtered = [];

        for (const ch of resolvedChannels) {
            if (ch === 'WHATSAPP' && !context.target_channels) {
                // Tekan spam WA jika pengguna aktif langsung di Android app
                suppressed.push(ch);
            } else {
                filtered.push(ch);
            }
        }

        if (!filtered.includes('ANDROID')) {
            filtered.push('ANDROID');
        }

        return {
            finalChannels: filtered,
            suppressedChannels: suppressed,
            presenceRouted: suppressed.length > 0,
            activePlatform: 'android',
        };
    }

    // 6. Pengguna offline dari Web/Mobile: kirimkan melalui saluran pesan utama seperti biasa
    return {
        finalChannels: resolvedChannels,
        suppressedChannels: [],
        presenceRouted: false,
        activePlatform: null,
    };
}

module.exports = {
    DEFAULT_PRESENCE_WINDOW_SECONDS,
    recordHeartbeat,
    getUserActivePresence,
    setDeviceOffline,
    evaluateSmartPresenceRouting,
};
