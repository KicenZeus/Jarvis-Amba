const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const { authLimiter } = require('../../../middleware/rateLimiter');
const db = require('../../../db');

/**
 * GET /api/v1/auth/me
 * Mengambil profil user yang sedang login via JWT
 */
router.get('/me', authLimiter, authenticateJwt, async (req, res) => {
    try {
        const userRes = await db.query(
            `SELECT id, display_name, role, status, callsign, created_at, updated_at 
             FROM users 
             WHERE id = $1 LIMIT 1;`,
            [req.user.id]
        );

        if (userRes.rows.length === 0) {
            return res.apiSuccess({
                user: {
                    id: req.user.id,
                    auth_user_id: req.user.auth_user_id,
                    email: req.user.email,
                    role: req.user.role,
                    display_name: req.user.displayName,
                },
                isRegisteredInDb: false,
            });
        }

        const user = userRes.rows[0];
        return res.apiSuccess({
            user: {
                id: user.id,
                auth_user_id: req.user.auth_user_id,
                email: req.user.email,
                displayName: user.display_name,
                role: user.role,
                status: user.status || 'ACTIVE',
                callsign: user.callsign,
                createdAt: user.created_at,
            },
            isRegisteredInDb: true,
        });
    } catch (err) {
        console.error('❌ [Auth API] Gagal fetch user data:', err.message);
        return res.apiError('INTERNAL_ERROR', 'Gagal mengambil data autentikasi pengguna', [], 500);
    }
});

/**
 * POST /api/v1/auth/link-code/whatsapp
 * Generate kode OTP 6-digit untuk penautan WhatsApp inbound (PRD V3 Sec 16.3)
 */
router.post('/link-code/whatsapp', authLimiter, authenticateJwt, async (req, res) => {
    try {
        const authUserId = req.user.auth_user_id;
        if (!authUserId) {
            return res.apiError('BAD_REQUEST', 'User belum memiliki auth_user_id Supabase', [], 400);
        }

        // Generate 6-digit numeric OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

        // Bersihkan kode lama milik user ini
        await db.query('DELETE FROM account_link_codes WHERE auth_user_id = $1;', [authUserId]);

        // Simpan kode baru
        await db.query(
            `INSERT INTO account_link_codes (auth_user_id, code_hash, expires_at, created_at)
             VALUES ($1, $2, $3, NOW());`,
            [authUserId, codeHash, expiresAt]
        );

        return res.apiSuccess({
            code,
            expiresAt: expiresAt.toISOString(),
            instruction: `Kirim pesan '!link ${code}' ke nomor WhatsApp bot Jarvis`,
        }, {}, 201);
    } catch (err) {
        console.error('❌ [LinkCode API] Gagal generate kode OTP:', err.message);
        return res.apiError('INTERNAL_ERROR', 'Gagal membuat kode penautan WhatsApp', [], 500);
    }
});

module.exports = router;
