const crypto = require('crypto');

/**
 * Middleware untuk standarisasi format response sesuai PRD V3 Sec 8
 */
function responseFormatter(req, res, next) {
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    req.requestId = requestId;

    // Helper untuk response sukses
    res.apiSuccess = function (data = {}, meta = {}, statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                requestId,
                ...meta,
            },
        });
    };

    // Helper untuk response error
    res.apiError = function (code, message, details = [], statusCode = 400, meta = {}) {
        return res.status(statusCode).json({
            success: false,
            error: {
                code,
                message,
                details: Array.isArray(details) ? details : [details],
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId,
                ...meta,
            },
        });
    };

    next();
}

module.exports = responseFormatter;

