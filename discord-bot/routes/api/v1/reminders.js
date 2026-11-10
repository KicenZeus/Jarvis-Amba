const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const db = require('../../../db');

/**
 * GET /api/v1/reminders
 * Mengambil daftar pengingat aktif milik user
 */
router.get('/', authenticateJwt, async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;
        let query = `
            SELECT id, user_id, channel_id, task_id, title, 
                   title AS reminder_text, remind_at, status, sent_at, 
                   snooze_until, priority, delivery_mode, target_channels, 
                   alarm_sound, snooze_minutes, version, created_at, updated_at 
            FROM reminders 
            WHERE user_id = $1
        `;
        const params = [req.user.id];

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        params.push(Math.min(parseInt(limit, 10) || 50, 100));
        query += ` ORDER BY remind_at ASC LIMIT $${params.length};`;

        const result = await db.query(query, params);
        return res.apiSuccess({ reminders: result.rows });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/reminders
 * Membuat pengingat baru
 */
router.post('/', authenticateJwt, async (req, res) => {
    const { 
        reminder_text, 
        title, 
        remind_at, 
        channel_id, 
        priority = 'MEDIUM',
        delivery_mode = 'CHAT', 
        target_channels,
        alarm_sound = 'default',
        snooze_minutes = 10
    } = req.body;
    const finalTitle = (reminder_text || title || '').trim();

    if (!finalTitle || !remind_at) {
        return res.apiError('VALIDATION_ERROR', 'Teks pengingat (title/reminder_text) dan remind_at wajib diisi', ['reminder_text', 'remind_at'], 400);
    }

    try {
        const parsedTime = new Date(remind_at);
        if (isNaN(parsedTime.getTime())) {
            return res.apiError('VALIDATION_ERROR', 'Format remind_at tidak valid', ['remind_at'], 400);
        }

        const normMode = ['CHAT', 'ALARM', 'CHAT_AND_ALARM'].includes(delivery_mode) ? delivery_mode : 'CHAT';
        const normTargets = Array.isArray(target_channels) && target_channels.length > 0 ? target_channels : null;
        const normSnooze = Math.max(1, Math.min(parseInt(snooze_minutes, 10) || 10, 1440));

        const result = await db.query(
            `INSERT INTO reminders (user_id, channel_id, title, remind_at, priority, status, delivery_mode, target_channels, alarm_sound, snooze_minutes, created_at)
             VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, NOW())
             RETURNING *, title AS reminder_text;`,
            [req.user.id, channel_id || 'DEFAULT', finalTitle, parsedTime, priority, normMode, normTargets, alarm_sound, normSnooze]
        );
        return res.apiSuccess({ reminder: result.rows[0] }, {}, 201);
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/reminders/:id/ack
 * Endpoint ACK penerimaan alarm oleh Android mobile client (PRD V3 Sec 35)
 */
router.post('/:id/ack', authenticateJwt, async (req, res) => {
    const reminderId = req.params.id;
    const { delivery_id, device_id, action = 'fired' } = req.body;

    try {
        // Cek kepemilikan reminder
        const rem = await db.query('SELECT id FROM reminders WHERE id = $1 AND user_id = $2;', [reminderId, req.user.id]);
        if (rem.rows.length === 0) {
            return res.apiError('NOT_FOUND', 'Pengingat tidak ditemukan', [], 404);
        }

        const reminderEngine = require('../../../reminderEngine');
        const ackRes = await reminderEngine.acknowledgeDelivery(reminderId, {
            deliveryId: delivery_id,
            deviceId: device_id,
            action,
        });

        return res.apiSuccess({ acknowledged: true, reminderId, ...ackRes });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * DELETE /api/v1/reminders/:id
 * Membatalkan pengingat
 */
router.delete('/:id', authenticateJwt, async (req, res) => {
    try {
        const result = await db.query(
            `UPDATE reminders SET status = 'cancelled' WHERE id = $1 AND user_id = $2 RETURNING id, status;`,
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.apiError('NOT_FOUND', 'Pengingat tidak ditemukan', [], 404);
        }
        return res.apiSuccess({ cancelledId: req.params.id });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * PATCH /api/v1/reminders/:id
 * Mengupdate pengingat dengan Optimistic Concurrency Control (PRD Sec 82)
 */
router.patch('/:id', authenticateJwt, async (req, res) => {
    const reminderId = req.params.id;
    const { title, reminder_text, remind_at, status, priority, delivery_mode, base_version, version } = req.body;
    const finalTitle = reminder_text || title;

    try {
        const check = await db.query('SELECT * FROM reminders WHERE id = $1 AND user_id = $2;', [reminderId, req.user.id]);
        if (check.rows.length === 0) {
            return res.apiError('NOT_FOUND', 'Pengingat tidak ditemukan', [], 404);
        }
        const currentReminder = check.rows[0];

        const expectedVersion = base_version !== undefined ? parseInt(base_version, 10) : (version !== undefined ? parseInt(version, 10) : null);
        if (expectedVersion !== null && currentReminder.version !== expectedVersion) {
            return res.apiError('VERSION_CONFLICT', 'Data pengingat telah diubah oleh perangkat lain', {
                currentVersion: currentReminder.version,
                expectedVersion,
                currentRecord: currentReminder,
            }, 409);
        }

        const updates = [];
        const params = [reminderId, req.user.id];

        if (finalTitle !== undefined) { params.push(finalTitle.trim()); updates.push(`title = $${params.length}`); }
        if (remind_at !== undefined) { params.push(new Date(remind_at)); updates.push(`remind_at = $${params.length}`); }
        if (status !== undefined) { params.push(status); updates.push(`status = $${params.length}`); }
        if (priority !== undefined) { params.push(priority); updates.push(`priority = $${params.length}`); }
        if (delivery_mode !== undefined) { params.push(delivery_mode); updates.push(`delivery_mode = $${params.length}`); }

        if (updates.length === 0) {
            return res.apiError('VALIDATION_ERROR', 'Tidak ada data yang diubah', [], 400);
        }

        updates.push('version = version + 1');
        updates.push('updated_at = NOW()');
        const q = `UPDATE reminders SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *, title AS reminder_text;`;
        const result = await db.query(q, params);
        return res.apiSuccess({ reminder: result.rows[0] });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/reminders/:id/snooze
 * Menunda pengingat aktif (PRD V3 Sec 18 & Lampiran F)
 */
router.post('/:id/snooze', authenticateJwt, async (req, res) => {
    const reminderId = req.params.id;
    const { minutes = 10 } = req.body;
    const snoozeMinutes = Math.max(1, Math.min(parseInt(minutes, 10) || 10, 1440));

    try {
        const result = await db.query(
            `UPDATE reminders 
             SET remind_at = NOW() + ($1 || ' minutes')::INTERVAL,
                 status = 'pending',
                 updated_at = NOW()
             WHERE id = $2 AND user_id = $3
             RETURNING *;`,
            [snoozeMinutes, reminderId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.apiError('NOT_FOUND', 'Pengingat tidak ditemukan', [], 404);
        }

        return res.apiSuccess({ 
            snoozed: true, 
            reminder: result.rows[0],
            snoozedMinutes: snoozeMinutes,
        });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/reminders/:id/dismiss
 * Mematikan / menyelesaikan pengingat (PRD V3 Sec 18 & Lampiran F)
 */
router.post('/:id/dismiss', authenticateJwt, async (req, res) => {
    const reminderId = req.params.id;

    try {
        const result = await db.query(
            `UPDATE reminders 
             SET status = 'completed',
                 updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING *;`,
            [reminderId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.apiError('NOT_FOUND', 'Pengingat tidak ditemukan', [], 404);
        }

        return res.apiSuccess({ 
            dismissed: true, 
            reminder: result.rows[0],
        });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

module.exports = router;
