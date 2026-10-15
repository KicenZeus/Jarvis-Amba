const fs = require('fs');
const path = require('path');
const db = require('./db');
const metricsService = require('./metricsService');

/**
 * ==============================================================================
 * Phase 8: Health Check & Reliability Diagnostics Service
 * ==============================================================================
 */

const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL 
    ? process.env.N8N_WEBHOOK_URL.split('/webhook')[0]
    : 'http://localhost:5678';

async function checkDatabaseHealth() {
    const start = Date.now();
    try {
        const res = await db.query('SELECT 1 as ok, NOW() as server_time;');
        const latencyMs = Date.now() - start;
        const pool = db.pool;
        return {
            status: 'UP',
            latencyMs,
            serverTime: res.rows[0]?.server_time,
            pool: {
                total: pool ? pool.totalCount : 0,
                idle: pool ? pool.idleCount : 0,
                waiting: pool ? pool.waitingCount : 0,
            },
        };
    } catch (err) {
        return {
            status: 'DOWN',
            latencyMs: Date.now() - start,
            error: err.message,
        };
    }
}

async function checkN8nHealth() {
    const start = Date.now();
    const targetUrl = `${N8N_BASE_URL}/healthz`;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);

        const response = await fetch(targetUrl, {
            method: 'GET',
            signal: controller.signal,
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - start;
        return {
            status: response.ok ? 'UP' : 'DEGRADED',
            httpCode: response.status,
            latencyMs,
        };
    } catch (err) {
        // Fallback: ping webhook endpoint jika healthz n8n belum aktif
        try {
            const controller2 = new AbortController();
            const timeout2 = setTimeout(() => controller2.abort(), 3000);
            const fallbackResp = await fetch(process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/jarvis-discord', {
                method: 'HEAD',
                signal: controller2.signal,
            });
            clearTimeout(timeout2);
            return {
                status: 'UP',
                latencyMs: Date.now() - start,
                httpCode: fallbackResp.status,
            };
        } catch (fbErr) {
            return {
                status: 'DOWN',
                latencyMs: Date.now() - start,
                error: err.message,
            };
        }
    }
}

function checkSystemHealth() {
    const mem = process.memoryUsage();
    return {
        status: 'UP',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryMb: {
            rss: (mem.rss / 1024 / 1024).toFixed(1),
            heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(1),
            heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(1),
            external: (mem.external / 1024 / 1024).toFixed(1),
        },
    };
}

function checkVoiceHealth() {
    const tempDir = path.join(__dirname, 'temp_audio');
    let fileCount = 0;
    let totalBytes = 0;

    if (fs.existsSync(tempDir)) {
        try {
            const files = fs.readdirSync(tempDir);
            fileCount = files.length;
            for (const file of files) {
                try {
                    const stat = fs.statSync(path.join(tempDir, file));
                    totalBytes += stat.size;
                } catch (_) {}
            }
        } catch (_) {}
    }

    return {
        status: 'UP',
        tempAudioFiles: fileCount,
        tempDiskUsageMb: (totalBytes / 1024 / 1024).toFixed(2),
    };
}

async function getCompleteHealthStatus(discordWsPing = null) {
    const [dbHealth, n8nHealth] = await Promise.all([
        checkDatabaseHealth(),
        checkN8nHealth(),
    ]);

    const sysHealth = checkSystemHealth();
    const voiceHealth = checkVoiceHealth();
    const metricsSummary = metricsService.getMetricsSummary();

    let overallStatus = 'HEALTHY';
    if (dbHealth.status === 'DOWN') {
        overallStatus = 'UNHEALTHY';
    } else if (n8nHealth.status === 'DOWN' || (discordWsPing !== null && discordWsPing > 400)) {
        overallStatus = 'DEGRADED';
    }

    return {
        overallStatus,
        timestamp: new Date().toISOString(),
        discordWsPing: discordWsPing !== null ? Math.round(discordWsPing) : null,
        database: dbHealth,
        n8n: n8nHealth,
        system: sysHealth,
        voice: voiceHealth,
        metrics: metricsSummary,
    };
}

module.exports = {
    checkDatabaseHealth,
    checkN8nHealth,
    checkSystemHealth,
    checkVoiceHealth,
    getCompleteHealthStatus,
};
