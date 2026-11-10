const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const db = require('../../../db');
const {
    recordHeartbeat,
    getUserActivePresence,
    setDeviceOffline,
} = require('../../../presenceService');

/**
 * GET /api/v1/devices
 * Mengambil daftar seluruh perangkat milik pengguna yang sedang aktif (PRD V3 Sec 14)
 */
router.get('/', authenticateJwt, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, platform, device_name, app_version, device_identifier, 
                    session_id, status, push_status, last_seen_at, created_at, updated_at
             FROM user_devices 
             WHERE user_id = $1 
             ORDER BY last_seen_at DESC;`,
            [req.user.id]
        );
        return res.apiSuccess({ devices: result.rows });
    } catch (err) {
        console.error('❌ [Devices API] Gagal list devices:', err.message);
        return res.apiError('INTERNAL_ERROR', 'Gagal memuat daftar perangkat', [], 500);
    }
});

/**
 * POST /api/v1/devices/register
 * Mendaftarkan perangkat mobile/web dan token FCM (PRD V3 Sec 14)
 */
router.post('/register', authenticateJwt, async (req, res) => {
    const { device_identifier, device_name, platform = 'android', app_version, push_token } = req.body;

    if (!device_identifier) {
        return res.apiError('VALIDATION_ERROR', 'device_identifier wajib disertakan', ['device_identifier'], 400);
    }

    const plat = String(platform).toLowerCase();
    if (!['android', 'ios', 'web'].includes(plat)) {
        return res.apiError('VALIDATION_ERROR', 'platform harus android, ios, atau web', ['platform'], 400);
    }

    try {
        const rawSessionId = req.user.sessionId;
        const isValidUuid = rawSessionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawSessionId);
        const sessionId = isValidUuid ? rawSessionId : null;
        const result = await db.query(
            `INSERT INTO user_devices (
                user_id, device_identifier, device_name, platform, 
                app_version, push_token, session_id, status, push_status, last_seen_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', 'OK', NOW(), NOW())
             ON CONFLICT (user_id, device_identifier) 
             DO UPDATE SET 
                device_name = COALESCE(EXCLUDED.device_name, user_devices.device_name),
                platform = EXCLUDED.platform,
                app_version = COALESCE(EXCLUDED.app_version, user_devices.app_version),
                push_token = COALESCE(EXCLUDED.push_token, user_devices.push_token),
                session_id = COALESCE(EXCLUDED.session_id, user_devices.session_id),
                status = 'ACTIVE',
                push_status = 'OK',
                last_seen_at = NOW(),
                updated_at = NOW()
             RETURNING *;`,
            [
                req.user.id,
                device_identifier,
                device_name || 'My Device',
                plat,
                app_version || '3.0.0',
                push_token || null,
                sessionId,
            ]
        );

        return res.apiSuccess({ device: result.rows[0] }, {}, 200);
    } catch (err) {
        console.error('❌ [Devices API] Gagal registrasi perangkat:', err.message);
        return res.apiError('INTERNAL_ERROR', 'Gagal meregistrasi perangkat', [], 500);
    }
});

/**
 * POST /api/v1/devices/:id/revoke
 * Mencabut sesi pada perangkat tertentu (PRD V3 Sec 12 & Sec 14)
 */
router.post('/:id/revoke', authenticateJwt, async (req, res) => {
    const deviceId = req.params.id;

    try {
        const result = await db.query(
            `UPDATE user_devices 
             SET status = 'REVOKED', updated_at = NOW() 
             WHERE id = $1 AND user_id = $2 
             RETURNING id, device_identifier, status, session_id;`,
            [deviceId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.apiError('NOT_FOUND', 'Perangkat tidak ditemukan', [], 404);
        }

        return res.apiSuccess({
            revoked: true,
            device: result.rows[0],
            message: 'Sesi perangkat berhasil dicabut',
        });
    } catch (err) {
        console.error('❌ [Devices API] Gagal mencabut sesi perangkat:', err.message);
        return res.apiError('INTERNAL_ERROR', 'Gagal mencabut sesi perangkat', [], 500);
    }
});

/**
 * POST /api/v1/devices/revoke-others
 * Mencabut sesi semua perangkat lain selain perangkat yang sedang digunakan (PRD V3 Sec 12)
 */
router.post('/revoke-others', authenticateJwt, async (req, res) => {
    const { current_device_identifier } = req.body;

    try {
        let q = `UPDATE user_devices SET status = 'REVOKED', updated_at = NOW() WHERE user_id = $1`;
        const params = [req.user.id];

        if (current_device_identifier) {
            params.push(current_device_identifier);
            q += ` AND device_identifier != $2`;
        }

        q += ` RETURNING id, device_identifier;`;
        const result = await db.query(q, params);

        return res.apiSuccess({
            revokedCount: result.rows.length,
            revokedDevices: result.rows,
            message: `${result.rows.length} perangkat lain berhasil dicabut sesinya`,
        });
    } catch (err) {
        console.error('❌ [Devices API] Gagal revoke others:', err.message);
        return res.apiError('INTERNAL_ERROR', 'Gagal mencabut sesi perangkat lain', [], 500);
    }
});

/**
 * POST /api/v1/devices/heartbeat
 * Mengirimkan sinyal detak jantung berkala (Web / Mobile presence - PRD Sec 67)
 */
router.post('/heartbeat', authenticateJwt, async (req, res) => {
    const { device_identifier, platform = 'web', app_version, device_name } = req.body;

    if (!device_identifier) {
        return res.apiError('VALIDATION_ERROR', 'device_identifier wajib disertakan', ['device_identifier'], 400);
    }

    try {
        const device = await recordHeartbeat(req.user.id, device_identifier, platform, { app_version, device_name });
        const presence = await getUserActivePresence(req.user.id);

        return res.apiSuccess({
            heartbeat: true,
            device,
            presence,
        });
    } catch (err) {
        console.error('❌ [Devices API] Gagal merekam heartbeat:', err.message);
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * GET /api/v1/devices/presence
 * Memeriksa status kehadiran aktif pengguna (Active Presence)
 */
router.get('/presence', authenticateJwt, async (req, res) => {
    try {
        const windowSec = parseInt(req.query.window, 10) || 120;
        const presence = await getUserActivePresence(req.user.id, windowSec);

        return res.apiSuccess({ presence });
    } catch (err) {
        console.error('❌ [Devices API] Gagal memuat presence:', err.message);
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/devices/offline
 * Menandai perangkat sebagai offline (saat tab web ditutup atau app di-background)
 */
router.post('/offline', authenticateJwt, async (req, res) => {
    const { device_identifier } = req.body;
    if (!device_identifier) {
        return res.apiError('VALIDATION_ERROR', 'device_identifier wajib disertakan', ['device_identifier'], 400);
    }

    try {
        const success = await setDeviceOffline(req.user.id, device_identifier);
        return res.apiSuccess({ offline: success, device_identifier });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

module.exports = router;
