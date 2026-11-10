const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const { 
    getPendingApprovals, 
    getApprovalHistory, 
    resolveApproval, 
    createApproval 
} = require('../../../approvalService');

/**
 * GET /api/v1/approvals
 * Mengambil antrean approval tindakan sensitif yang masih tertunda (PENDING)
 */
router.get('/', authenticateJwt, async (req, res) => {
    try {
        const approvals = await getPendingApprovals(req.user.id, { type: req.query.type });
        return res.apiSuccess({ approvals });
    } catch (err) {
        console.error('❌ [Approvals API] Gagal memuat antrean approval:', err.message);
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * GET /api/v1/approvals/history
 * Mengambil riwayat approval yang sudah disetujui atau ditolak
 */
router.get('/history', authenticateJwt, async (req, res) => {
    try {
        const history = await getApprovalHistory(req.user.id, { limit: req.query.limit });
        return res.apiSuccess({ history });
    } catch (err) {
        console.error('❌ [Approvals API] Gagal memuat riwayat approval:', err.message);
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/approvals
 * Menambahkan aksi baru ke antrean approval (misal: Task Chain proposal atau Sensitive Action)
 */
router.post('/', authenticateJwt, async (req, res) => {
    const { type, title, description, payload, confidenceScore } = req.body;
    if (!type || !title) {
        return res.apiError('VALIDATION_ERROR', 'type dan title wajib diisi', ['type', 'title'], 400);
    }

    try {
        const approval = await createApproval(req.user.id, {
            type,
            title,
            description,
            payload,
            confidenceScore,
        });
        return res.apiSuccess({ approval }, {}, 201);
    } catch (err) {
        return res.apiError('VALIDATION_ERROR', err.message, [], 400);
    }
});

/**
 * POST /api/v1/approvals/:id/action
 * Menyetujui (APPROVE) atau menolak (REJECT) tindakan yang tertunda secara atomik (PRD Sec 78 & 79)
 */
router.post('/:id/action', authenticateJwt, async (req, res) => {
    const { action, reason } = req.body; // 'APPROVE' atau 'REJECT'
    if (!['APPROVE', 'REJECT'].includes(action)) {
        return res.apiError('VALIDATION_ERROR', 'action harus berupa APPROVE atau REJECT', ['action'], 400);
    }

    try {
        const result = await resolveApproval(req.user.id, req.params.id, action, {
            reason,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
        });

        return res.apiSuccess({
            approval: result.approval,
            executionResult: result.executionResult,
            message: action === 'APPROVE' ? 'Tindakan berhasil disetujui dan dieksekusi' : 'Tindakan berhasil ditolak',
        });
    } catch (err) {
        if (err.statusCode === 404) {
            return res.apiError('NOT_FOUND', err.message, ['id'], 404);
        }
        if (err.statusCode === 409) {
            return res.apiError('CONFLICT', err.message, ['status'], 409);
        }
        console.error('❌ [Approvals API] Gagal mengeksekusi resolusi approval:', err.message);
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

module.exports = router;
