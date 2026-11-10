const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const { executeSyncBatch } = require('../../../syncService');

/**
 * POST /api/v1/sync
 * Endpoint batch offline synchronization dengan idempotency key dan Optimistic Concurrency Control (PRD Sec 80 - 84)
 */
router.post('/', authenticateJwt, async (req, res) => {
    const { operations } = req.body;

    if (!Array.isArray(operations)) {
        return res.apiError('VALIDATION_ERROR', 'operations wajib berupa array aksi', ['operations'], 400);
    }

    try {
        const syncResult = await executeSyncBatch(req.user.id, operations);
        return res.apiSuccess({ sync: syncResult }, {}, 200);
    } catch (err) {
        console.error('❌ [Sync API] Gagal memproses batch sync:', err.message);
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

module.exports = router;
