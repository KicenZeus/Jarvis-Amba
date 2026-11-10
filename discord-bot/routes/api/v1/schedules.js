const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const db = require('../../../db');

/**
 * GET /api/v1/schedules
 * Mengambil agenda / jadwal kegiatan pengguna
 */
router.get('/', authenticateJwt, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const result = await db.query(
            `SELECT * FROM schedules 
             WHERE user_id = $1 
             ORDER BY start_time ASC 
             LIMIT $2;`,
            [req.user.id, Math.min(parseInt(limit, 10) || 50, 100)]
        );
        return res.apiSuccess({ schedules: result.rows });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/schedules
 * Membuat jadwal baru
 */
router.post('/', authenticateJwt, async (req, res) => {
    const { title, description, start_time, end_time, location } = req.body;
    if (!title || !start_time) {
        return res.apiError('VALIDATION_ERROR', 'title dan start_time wajib diisi', ['title', 'start_time'], 400);
    }

    try {
        const result = await db.query(
            `INSERT INTO schedules (user_id, title, description, start_time, end_time, location, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
             RETURNING *;`,
            [req.user.id, title.trim(), description || '', new Date(start_time), end_time ? new Date(end_time) : null, location || null]
        );
        return res.apiSuccess({ schedule: result.rows[0] }, {}, 201);
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * PATCH /api/v1/schedules/:id
 * Mengupdate jadwal dengan Optimistic Concurrency Control (PRD Sec 82)
 */
router.patch('/:id', authenticateJwt, async (req, res) => {
    const scheduleId = req.params.id;
    const { title, description, start_time, end_time, location, base_version, version } = req.body;

    try {
        const check = await db.query('SELECT * FROM schedules WHERE id = $1 AND user_id = $2;', [scheduleId, req.user.id]);
        if (check.rows.length === 0) {
            return res.apiError('NOT_FOUND', 'Jadwal tidak ditemukan', [], 404);
        }
        const currentSchedule = check.rows[0];

        const expectedVersion = base_version !== undefined ? parseInt(base_version, 10) : (version !== undefined ? parseInt(version, 10) : null);
        if (expectedVersion !== null && currentSchedule.version !== expectedVersion) {
            return res.apiError('VERSION_CONFLICT', 'Data telah diubah oleh perangkat lain', {
                currentVersion: currentSchedule.version,
                expectedVersion,
                currentRecord: currentSchedule,
            }, 409);
        }

        const updates = [];
        const params = [scheduleId, req.user.id];

        if (title !== undefined) { params.push(title.trim()); updates.push(`title = $${params.length}`); }
        if (description !== undefined) { params.push(description); updates.push(`description = $${params.length}`); }
        if (start_time !== undefined) { params.push(new Date(start_time)); updates.push(`start_time = $${params.length}`); }
        if (end_time !== undefined) { params.push(end_time ? new Date(end_time) : null); updates.push(`end_time = $${params.length}`); }
        if (location !== undefined) { params.push(location); updates.push(`location = $${params.length}`); }

        if (updates.length === 0) {
            return res.apiError('VALIDATION_ERROR', 'Tidak ada data yang diubah', [], 400);
        }

        updates.push('version = version + 1');
        updates.push('updated_at = NOW()');
        const q = `UPDATE schedules SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *;`;
        const result = await db.query(q, params);
        return res.apiSuccess({ schedule: result.rows[0] });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * DELETE /api/v1/schedules/:id
 * Menghapus jadwal
 */
router.delete('/:id', authenticateJwt, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM schedules WHERE id = $1 AND user_id = $2 RETURNING id;',
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.apiError('NOT_FOUND', 'Jadwal tidak ditemukan', [], 404);
        }
        return res.apiSuccess({ deletedId: req.params.id });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

module.exports = router;
