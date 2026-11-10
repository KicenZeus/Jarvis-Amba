const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const db = require('../../../db');

/**
 * GET /api/v1/memories
 * Mengambil memori aktif yang disimpan oleh Jarvis
 */
router.get('/', authenticateJwt, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const result = await db.query(
            `SELECT id, memory_text, category, importance, created_at, updated_at 
             FROM memories 
             WHERE user_id = $1 
             ORDER BY importance DESC, created_at DESC 
             LIMIT $2;`,
            [req.user.id, Math.min(parseInt(limit, 10) || 20, 50)]
        );
        return res.apiSuccess({ memories: result.rows });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/memories
 * Menambahkan ingatan baru secara manual
 */
router.post('/', authenticateJwt, async (req, res) => {
    const { memory_text, category = 'FACT', importance = 3 } = req.body;
    if (!memory_text || !memory_text.trim()) {
        return res.apiError('VALIDATION_ERROR', 'memory_text wajib diisi', ['memory_text'], 400);
    }

    try {
        const result = await db.query(
            `INSERT INTO memories (user_id, memory_text, category, importance, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING *;`,
            [req.user.id, memory_text.trim(), category, parseInt(importance, 10) || 3]
        );
        return res.apiSuccess({ memory: result.rows[0] }, {}, 201);
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * DELETE /api/v1/memories/:id
 * Menghapus ingatan
 */
router.delete('/:id', authenticateJwt, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM memories WHERE id = $1 AND user_id = $2 RETURNING id;',
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.apiError('NOT_FOUND', 'Memori tidak ditemukan', [], 404);
        }
        return res.apiSuccess({ deletedId: req.params.id });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

module.exports = router;
