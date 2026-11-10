const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const { generateDirectGeminiReply } = require('../../../aiDirectService');
const db = require('../../../db');

/**
 * GET /api/v1/conversations
 * Riwayat interaksi chat lintas saluran
 */
router.get('/', authenticateJwt, async (req, res) => {
    try {
        const { limit = 30 } = req.query;
        const result = await db.query(
            `SELECT id, channel_id, input_type, output_type, 
                    user_raw_input AS user_message, 
                    agent_raw_output AS ai_reply, 
                    metadata, created_at 
             FROM conversations 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT $2;`,
            [req.user.id, Math.min(parseInt(limit, 10) || 30, 100)]
        );
        return res.apiSuccess({ conversations: result.rows });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/conversations/chat
 * Obrolan langsung dengan Direct Gemini AI (Web & Mobile Client)
 */
router.post('/chat', authenticateJwt, async (req, res) => {
    const { message, channel = 'WEB', wantsVoice = false } = req.body;
    if (!message || !message.trim()) {
        return res.apiError('VALIDATION_ERROR', 'message tidak boleh kosong', ['message'], 400);
    }

    try {
        // Ambil memori relevan
        let memories = [];
        try {
            const mRes = await db.query('SELECT memory_text FROM memories WHERE user_id = $1 ORDER BY importance DESC LIMIT 5;', [req.user.id]);
            memories = mRes.rows.map(r => r.memory_text);
        } catch (_) {}

        const replyText = await generateDirectGeminiReply({
            userMessage: message.trim(),
            userId: req.user.id,
            channelId: `mobile_${req.user.id}`,
            userName: req.user.displayName || req.user.email,
            callsign: null,
            userRole: req.user.role,
            memories,
            wantsVoice,
        });

        // Catat percakapan di database
        try {
            await db.query(
                `INSERT INTO conversations (user_id, channel_id, input_type, output_type, user_raw_input, agent_raw_output, metadata, created_at)
                 VALUES ($1, $2, 'TEXT', 'TEXT', $3, $4, $5, NOW());`,
                [req.user.id, channel, message.trim(), replyText, JSON.stringify({ source: channel })]
            );
        } catch (_) {}

        return res.apiSuccess({
            reply: replyText,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error('❌ [Chat API] Gagal memproses obrolan:', err.message);
        return res.apiError('AI_ERROR', 'Gagal memproses respons dari otak AI', [err.message], 500);
    }
});

module.exports = router;
