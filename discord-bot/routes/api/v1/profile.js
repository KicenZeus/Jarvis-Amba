const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const db = require('../../../db');

/**
 * GET /api/v1/profile
 * Mengambil profil lengkap user termasuk saluran tertaut (user_channels)
 */
router.get('/', authenticateJwt, async (req, res) => {
    try {
        const [uRes, cRes, vRes] = await Promise.all([
            db.query('SELECT id, display_name, callsign, role, created_at FROM users WHERE id = $1 LIMIT 1;', [req.user.id]),
            db.query('SELECT id, channel_type, external_user_id, phone_number, is_active FROM user_channels WHERE user_id = $1;', [req.user.id]),
            db.query('SELECT voice_gender, voice_style, speed, pitch FROM user_voice_preferences WHERE user_id = $1 LIMIT 1;', [req.user.id]),
        ]);

        const profile = uRes.rows[0] || { id: req.user.id, role: req.user.role, display_name: req.user.displayName };
        return res.apiSuccess({
            profile: {
                id: profile.id,
                displayName: profile.display_name,
                callsign: profile.callsign,
                role: profile.role,
                createdAt: profile.created_at,
            },
            channels: cRes.rows,
            voicePreferences: vRes.rows[0] || null,
        });
    } catch (err) {
        console.error('❌ [Profile API] Gagal mengambil profil:', err.message);
        return res.apiError('INTERNAL_ERROR', 'Gagal memuat profil', [], 500);
    }
});

/**
 * PATCH /api/v1/profile
 * Memperbarui nama tampilan atau preferensi umum profil
 */
router.patch('/', authenticateJwt, async (req, res) => {
    const { displayName } = req.body;
    if (!displayName || !displayName.trim()) {
        return res.apiError('VALIDATION_ERROR', 'displayName wajib diisi', ['displayName'], 400);
    }

    try {
        const updRes = await db.query(
            `UPDATE users 
             SET display_name = $1, updated_at = NOW() 
             WHERE id = $2 
             RETURNING id, username, display_name, role, updated_at;`,
            [displayName.trim(), req.user.id]
        );

        return res.apiSuccess({ user: updRes.rows[0] });
    } catch (err) {
        console.error('❌ [Profile API] Gagal update profil:', err.message);
        return res.apiError('INTERNAL_ERROR', 'Gagal memperbarui profil', [], 500);
    }
});

module.exports = router;
