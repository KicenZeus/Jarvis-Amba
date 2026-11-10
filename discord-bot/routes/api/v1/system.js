const express = require('express');
const router = express.Router();
const { getCompleteHealthStatus } = require('../../../healthService');

/**
 * GET /api/v1/system/health
 * Health check sistem terpadu (DB, WS, RAM, Uptime)
 */
router.get('/health', async (req, res) => {
    try {
        const healthData = await getCompleteHealthStatus(null);
        const isHealthy = healthData.overallStatus !== 'UNHEALTHY';
        return res.apiSuccess(healthData, {}, isHealthy ? 200 : 503);
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * GET /api/v1/system/version
 * Informasi versi server backend dan versi minimum mobile client
 */
router.get('/version', (req, res) => {
    return res.apiSuccess({
        serverVersion: '3.1.0',
        minMobileVersion: process.env.MIN_MOBILE_VERSION || '3.0.0',
        environment: process.env.NODE_ENV || 'production',
        timezone: process.env.TZ || 'Asia/Jakarta',
    });
});

/**
 * GET /api/v1/system/time
 * Sinkronisasi waktu server untuk akurasi penjadwalan alarm lokal
 */
router.get('/time', (req, res) => {
    const now = new Date();
    return res.apiSuccess({
        utc: now.toISOString(),
        unix: now.getTime(),
        wib: new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            dateStyle: 'full',
            timeStyle: 'long',
        }).format(now),
    });
});

module.exports = router;
