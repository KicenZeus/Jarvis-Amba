const crypto = require('crypto');

/**
 * ==============================================================================
 * Phase 8: Metrics & Observability Service
 * ==============================================================================
 */

const botStartTime = Date.now();

const metrics = {
    messagesProcessed: 0,
    aiRequests: 0,
    aiSuccess: 0,
    aiFailures: 0,
    toolCalls: 0,
    toolFailures: 0,
    remindersSent: 0,
    voiceRequests: 0,
    totalAiLatencyMs: 0,
    lastAiLatencyMs: 0,
};

function createRequestId() {
    return 'req_' + crypto.randomBytes(6).toString('hex');
}

function recordMessageProcessed() {
    metrics.messagesProcessed++;
}

function recordAiRequest(durationMs = 0, success = true, errorCode = null) {
    metrics.aiRequests++;
    metrics.lastAiLatencyMs = Math.round(durationMs);
    metrics.totalAiLatencyMs += durationMs;

    if (success) {
        metrics.aiSuccess++;
    } else {
        metrics.aiFailures++;
        if (errorCode) {
            console.warn(`⚠️ [Observability] AI Request Failed (Code: ${errorCode})`);
        }
    }
}

function recordToolCallMetric(toolName, success = true) {
    metrics.toolCalls++;
    if (!success) {
        metrics.toolFailures++;
    }
}

function recordReminderSent() {
    metrics.remindersSent++;
}

function recordVoiceRequest() {
    metrics.voiceRequests++;
}

function getUptimeSeconds() {
    return Math.floor((Date.now() - botStartTime) / 1000);
}

function formatUptime(totalSeconds) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}h`);
    if (hours > 0) parts.push(`${hours}j`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}d`);
    return parts.join(' ');
}

function getMetricsSummary() {
    const uptimeSec = getUptimeSeconds();
    const avgLatency = metrics.aiRequests > 0 
        ? Math.round(metrics.totalAiLatencyMs / metrics.aiRequests) 
        : 0;
    
    const successRate = metrics.aiRequests > 0
        ? ((metrics.aiSuccess / metrics.aiRequests) * 100).toFixed(1)
        : '100.0';

    return {
        uptimeSeconds: uptimeSec,
        uptimeFormatted: formatUptime(uptimeSec),
        startedAt: new Date(botStartTime).toISOString(),
        messagesProcessed: metrics.messagesProcessed,
        aiRequests: metrics.aiRequests,
        aiSuccess: metrics.aiSuccess,
        aiFailures: metrics.aiFailures,
        aiSuccessRatePercent: successRate,
        toolCalls: metrics.toolCalls,
        toolFailures: metrics.toolFailures,
        remindersSent: metrics.remindersSent,
        voiceRequests: metrics.voiceRequests,
        avgLatencyMs: avgLatency,
        lastLatencyMs: metrics.lastAiLatencyMs,
    };
}

module.exports = {
    createRequestId,
    recordMessageProcessed,
    recordAiRequest,
    recordToolCallMetric,
    recordReminderSent,
    recordVoiceRequest,
    getMetricsSummary,
    getUptimeSeconds,
    formatUptime,
};
