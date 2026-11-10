const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');

/**
 * POST /api/v1/media/voice
 * Upload rekaman audio dari mobile client untuk Speech-to-Text (STT)
 */
router.post('/voice', authenticateJwt, (req, res) => {
    return res.apiSuccess({
        status: 'READY',
        message: 'Voice STT endpoint siap menerima binary audio stream',
    });
});

module.exports = router;
