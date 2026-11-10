const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const db = require('../../../db');

/**
 * GET /api/v1/tasks
 * Mengambil daftar tugas milik user yang sedang aktif
 */
router.get('/', authenticateJwt, async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;
        let query = 'SELECT * FROM tasks WHERE user_id = $1';
        const params = [req.user.id];

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        params.push(Math.min(parseInt(limit, 10) || 50, 100));
        query += ` ORDER BY created_at DESC LIMIT $${params.length};`;

        const result = await db.query(query, params);
        return res.apiSuccess({ tasks: result.rows });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/tasks
 * Membuat tugas baru
 */
router.post('/', authenticateJwt, async (req, res) => {
    const { title, description, priority = 'NORMAL', due_date, due_at } = req.body;
    if (!title || !title.trim()) {
        return res.apiError('VALIDATION_ERROR', 'title tugas wajib diisi', ['title'], 400);
    }

    const effectiveDueAt = due_at || due_date || null;

    try {
        const result = await db.query(
            `INSERT INTO tasks (user_id, title, description, priority, due_at, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
             RETURNING *;`,
            [req.user.id, title.trim(), description || null, priority, effectiveDueAt]
        );
        return res.apiSuccess({ task: result.rows[0] }, {}, 201);
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * PATCH /api/v1/tasks/:id
 * Mengupdate status atau isi tugas
 */
router.patch('/:id', authenticateJwt, async (req, res) => {
    const taskId = req.params.id;
    const { title, description, status, priority, base_version, version } = req.body;

    try {
        const check = await db.query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2;', [taskId, req.user.id]);
        if (check.rows.length === 0) {
            return res.apiError('NOT_FOUND', 'Tugas tidak ditemukan', [], 404);
        }
        const currentTask = check.rows[0];

        // Optimistic Concurrency Control (PRD Sec 82)
        const expectedVersion = base_version !== undefined ? parseInt(base_version, 10) : (version !== undefined ? parseInt(version, 10) : null);
        if (expectedVersion !== null && currentTask.version !== expectedVersion) {
            return res.apiError('VERSION_CONFLICT', 'Data telah diubah oleh perangkat lain', {
                currentVersion: currentTask.version,
                expectedVersion,
                currentRecord: currentTask,
            }, 409);
        }

        const updates = [];
        const params = [taskId, req.user.id];

        if (title !== undefined) { params.push(title.trim()); updates.push(`title = $${params.length}`); }
        if (description !== undefined) { params.push(description); updates.push(`description = $${params.length}`); }
        if (status !== undefined) { params.push(status); updates.push(`status = $${params.length}`); }
        if (priority !== undefined) { params.push(priority); updates.push(`priority = $${params.length}`); }

        if (updates.length === 0) {
            return res.apiError('VALIDATION_ERROR', 'Tidak ada data yang diubah', [], 400);
        }

        updates.push('version = version + 1');
        updates.push('updated_at = NOW()');
        const q = `UPDATE tasks SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *;`;
        const result = await db.query(q, params);
        return res.apiSuccess({ task: result.rows[0] });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * DELETE /api/v1/tasks/:id
 * Menghapus tugas
 */
router.delete('/:id', authenticateJwt, async (req, res) => {
    try {
        const result = await db.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id;', [req.params.id, req.user.id]);
        if (result.rows.length === 0) {
            return res.apiError('NOT_FOUND', 'Tugas tidak ditemukan', [], 404);
        }
        return res.apiSuccess({ deletedId: req.params.id });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

module.exports = router;
