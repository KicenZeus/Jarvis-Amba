const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const {
    getUserPreferencesSummary,
    resolveUserPersonality,
    updateGlobalPreferences,
    updateChannelPreferences,
    deleteChannelPreferences,
    VALID_CHANNELS,
} = require('../../../personalityService');

/**
 * GET /api/v1/personality
 * Mengambil ringkasan preferensi persona pengguna (global + channel overrides + callsign)
 * Query params: ?channel=DISCORD (opsional, untuk resolusi spesifik channel)
 */
router.get('/', authenticateJwt, async (req, res) => {
    try {
        const targetChannel = req.query.channel || 'GLOBAL';
        const summary = await getUserPreferencesSummary(req.user.id);
        const resolved = await resolveUserPersonality(req.user.id, targetChannel);

        return res.apiSuccess({
            ...summary,
            resolved,
            personality: resolved, // Backwards-compatibility dengan Phase 0
        });
    } catch (err) {
        console.error('❌ [Personality API] Gagal memuat preferensi:', err.message);
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * PUT /api/v1/personality/global
 * PUT /api/v1/personality
 * Memperbarui preferensi global persona dan callsign pengguna
 */
async function handleUpdateGlobal(req, res) {
    try {
        const body = {
            ...req.body,
            custom_prompt_instructions: req.body.custom_prompt_instructions !== undefined
                ? req.body.custom_prompt_instructions
                : req.body.custom_instructions, // kompatibilitas
        };

        const globalPref = await updateGlobalPreferences(req.user.id, body);
        const resolved = await resolveUserPersonality(req.user.id, 'GLOBAL');

        return res.apiSuccess({
            updated: true,
            global: globalPref,
            resolved,
            personality: resolved,
        });
    } catch (err) {
        console.error('❌ [Personality API] Gagal update preferensi global:', err.message);
        const statusCode = err.message.includes('tidak valid') ? 400 : 500;
        const code = statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
        return res.apiError(code, err.message, [], statusCode);
    }
}

router.put('/global', authenticateJwt, handleUpdateGlobal);
router.put('/', authenticateJwt, handleUpdateGlobal);

/**
 * PATCH /api/v1/personality
 * Kompatibilitas mundur dengan Phase 0
 */
router.patch('/', authenticateJwt, handleUpdateGlobal);

/**
 * PUT /api/v1/personality/channels/:channel
 * Menyimpan / memperbarui override preferensi persona untuk channel tertentu
 */
router.put('/channels/:channel', authenticateJwt, async (req, res) => {
    try {
        const channelType = String(req.params.channel).trim().toUpperCase();
        if (!VALID_CHANNELS.includes(channelType) || channelType === 'GLOBAL') {
            return res.apiError(
                'VALIDATION_ERROR',
                `Channel tidak valid. Pilihan saluran: ${VALID_CHANNELS.filter(c => c !== 'GLOBAL').join(', ')}`,
                ['channel'],
                400
            );
        }

        const channelPref = await updateChannelPreferences(req.user.id, channelType, req.body);
        const resolved = await resolveUserPersonality(req.user.id, channelType);

        return res.apiSuccess({
            updated: true,
            channel_type: channelType,
            channel: channelPref,
            resolved,
            personality: resolved,
        });
    } catch (err) {
        console.error(`❌ [Personality API] Gagal update override channel ${req.params.channel}:`, err.message);
        const statusCode = err.message.includes('tidak valid') ? 400 : 500;
        const code = statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
        return res.apiError(code, err.message, [], statusCode);
    }
});

/**
 * DELETE /api/v1/personality/channels/:channel
 * Menghapus override channel agar kembali mengikuti preferensi global
 */
router.delete('/channels/:channel', authenticateJwt, async (req, res) => {
    try {
        const channelType = String(req.params.channel).trim().toUpperCase();
        const result = await deleteChannelPreferences(req.user.id, channelType);

        return res.apiSuccess({
            deleted: result.deleted,
            channel_type: result.channel_type,
            message: `Preferensi channel ${result.channel_type} dihapus, kini mengikuti aturan GLOBAL.`,
        });
    } catch (err) {
        console.error(`❌ [Personality API] Gagal hapus override channel ${req.params.channel}:`, err.message);
        const statusCode = err.message.includes('tidak dapat dihapus') ? 400 : 500;
        const code = statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
        return res.apiError(code, err.message, [], statusCode);
    }
});

module.exports = router;
