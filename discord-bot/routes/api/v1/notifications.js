const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const db = require('../../../db');
const { 
    getUserQuietHours, 
    getUserNotificationPreferences, 
    setNotificationPreference, 
    sendSmartNotification, 
    EVENT_TYPES, 
    CHANNELS 
} = require('../../../notificationService');

/**
 * GET /api/v1/notifications/preferences
 * Mengambil preferensi notifikasi dan jam tenang pengguna (PRD V3 Sec 39-40)
 */
router.get('/preferences', authenticateJwt, async (req, res) => {
    try {
        const preferences = await getUserNotificationPreferences(req.user.id);
        const quietHours = await getUserQuietHours(req.user.id);
        return res.apiSuccess({ 
            preferences, 
            quiet_hours: quietHours,
            supported_events: Object.values(EVENT_TYPES),
            supported_channels: Object.values(CHANNELS)
        });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * PUT /api/v1/notifications/preferences
 * Mengatur atau memperbarui preferensi notifikasi per event
 */
router.put('/preferences', authenticateJwt, async (req, res) => {
    const { event_type, channel_type = 'BOTH', enabled = true, quiet_hours_start, quiet_hours_end } = req.body;
    if (!event_type) {
        return res.apiError('VALIDATION_ERROR', 'event_type wajib diisi', ['event_type'], 400);
    }

    try {
        const result = await setNotificationPreference(
            req.user.id,
            event_type,
            channel_type,
            enabled,
            quiet_hours_start,
            quiet_hours_end
        );
        if (!result.success) {
            return res.apiError('DATABASE_ERROR', result.error, [], 500);
        }
        return res.apiSuccess({ preference: result.preference });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * PATCH /api/v1/notifications/preferences
 * Mengupdate jam tenang global pengguna
 */
router.patch('/preferences', authenticateJwt, async (req, res) => {
    const { quiet_hours_start, quiet_hours_end } = req.body;

    if (!quiet_hours_start && !quiet_hours_end) {
        return res.apiError('VALIDATION_ERROR', 'quiet_hours_start atau quiet_hours_end harus diisi', ['quiet_hours_start', 'quiet_hours_end'], 400);
    }

    try {
        // Cek apakah user sudah punya baris di notification_preferences
        const existing = await db.query(
            `SELECT id FROM notification_preferences WHERE user_id = $1 LIMIT 1;`,
            [req.user.id]
        );

        if (existing.rows.length === 0) {
            // Inisialisasi baris default untuk DAILY_BRIEFING dan DAILY_RECAP dengan jam tenang baru
            await db.query(
                `INSERT INTO notification_preferences (user_id, event_type, channel_type, enabled, quiet_hours_start, quiet_hours_end, updated_at)
                 VALUES 
                    ($1, 'DAILY_BRIEFING', 'BOTH', true, $2, $3, NOW()),
                    ($1, 'DAILY_RECAP', 'BOTH', true, $2, $3, NOW())
                 ON CONFLICT (user_id, event_type) DO UPDATE
                 SET quiet_hours_start = EXCLUDED.quiet_hours_start,
                     quiet_hours_end = EXCLUDED.quiet_hours_end,
                     updated_at = NOW();`,
                [req.user.id, quiet_hours_start || '22:00', quiet_hours_end || '06:00']
            );
        } else {
            await db.query(
                `UPDATE notification_preferences 
                 SET quiet_hours_start = COALESCE($1, quiet_hours_start),
                     quiet_hours_end = COALESCE($2, quiet_hours_end),
                     updated_at = NOW()
                 WHERE user_id = $3;`,
                [quiet_hours_start || null, quiet_hours_end || null, req.user.id]
            );
        }

        const quietHours = await getUserQuietHours(req.user.id);
        return res.apiSuccess({ 
            updated: true, 
            quiet_hours: quietHours 
        });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * GET /api/v1/notifications/history
 * Mengambil riwayat log notifikasi proaktif
 */
router.get('/history', authenticateJwt, async (req, res) => {
    const { limit = 20 } = req.query;
    try {
        const lim = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));
        const result = await db.query(
            `SELECT id, user_id, type, channel_id, content, status, created_at 
             FROM proactive_logs 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT $2;`,
            [req.user.id, lim]
        );
        return res.apiSuccess({ logs: result.rows });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/notifications/test
 * Mengirim notifikasi uji coba ke kanal terdaftar
 */
router.post('/test', authenticateJwt, async (req, res) => {
    const { event_type = 'SYSTEM_ALERT', message = 'Uji coba notifikasi Jarvis V3' } = req.body;
    try {
        const notifRes = await sendSmartNotification({
            userId: req.user.id,
            eventType: event_type,
            text: message,
            context: { bypassQuietHours: true },
        });
        return res.apiSuccess({ testResult: notifRes });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

module.exports = router;
