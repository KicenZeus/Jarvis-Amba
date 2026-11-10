/**
 * In-Memory Sliding Window Rate Limiter (PRD V3 Sec 9)
 * @param {number} maxRequests - Batas maksimum request per window
 * @param {number} windowMs - Durasi window dalam milidetik (default 60000 = 1 menit)
 */
function createRateLimiter(maxRequests = 60, windowMs = 60000) {
    const requestLog = new Map(); // key -> [timestamp, timestamp, ...]

    // Interval pembersihan memori setiap 5 menit
    setInterval(() => {
        const now = Date.now();
        for (const [key, timestamps] of requestLog.entries()) {
            const filtered = timestamps.filter((t) => now - t < windowMs);
            if (filtered.length === 0) {
                requestLog.delete(key);
            } else {
                requestLog.set(key, filtered);
            }
        }
    }, 300000).unref();

    return function rateLimiterMiddleware(req, res, next) {
        // Abaikan rate limit jika flag bypass aktif saat pengujian internal
        if (process.env.NODE_ENV === 'test' && req.headers['x-bypass-ratelimit']) {
            return next();
        }

        const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
        const key = `${clientIp}_${req.baseUrl || req.path}`;
        const now = Date.now();

        const timestamps = requestLog.get(key) || [];
        const validTimestamps = timestamps.filter((t) => now - t < windowMs);

        if (validTimestamps.length >= maxRequests) {
            const oldest = validTimestamps[0];
            const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
            res.setHeader('Retry-After', retryAfterSec);

            if (res.apiError) {
                return res.apiError('TOO_MANY_REQUESTS', `Rate limit terlampaui. Coba lagi dalam ${retryAfterSec} detik.`, [], 429);
            }
            return res.status(429).json({
                success: false,
                error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit terlampaui.' },
            });
        }

        validTimestamps.push(now);
        requestLog.set(key, validTimestamps);
        next();
    };
}

module.exports = {
    authLimiter: createRateLimiter(10, 60000),      // 10 req/menit untuk auth/login
    generalLimiter: createRateLimiter(60, 60000),   // 60 req/menit untuk general API
    financeLimiter: createRateLimiter(30, 60000),   // 30 req/menit untuk finance ingestion
    createRateLimiter,
};

