const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const responseFormatter = require('./middleware/responseFormatter');
const checkAppVersion = require('./middleware/versionCheck');
const { generalLimiter } = require('./middleware/rateLimiter');
const apiV1Router = require('./routes/api/v1');

const app = express();

// 1. Raw body capture HANYA untuk webhook Meta (/webhook/whatsapp)
app.use('/webhook/whatsapp', express.raw({ type: 'application/json' }), (req, res, next) => {
    req.rawBody = req.body;
    try {
        req.body = typeof req.body === 'string' ? JSON.parse(req.body) : JSON.parse(req.body.toString('utf8'));
    } catch (_) {
        req.body = {};
    }
    next();
});

// 2. Standard Body Parsers & CORS
app.use(cors({
    origin: (origin, callback) => {
        // Izinkan request tanpa origin (mobile apps, server-to-server, curl)
        if (!origin) return callback(null, true);
        // Izinkan domain Railway, localhost, dan skema mobile jarvis://
        if (origin.includes('up.railway.app') || origin.includes('localhost') || origin.startsWith('jarvis://')) {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Response Contract & Middleware Global
app.use(responseFormatter);
app.use(checkAppVersion);

// 4. Rate limiting untuk seluruh API
app.use('/api', generalLimiter);

// 5. Mount Modular API V3
app.use('/api/v1', apiV1Router);

// 6. Sajikan Web Static Assets (React 19 + Vite)
const webDistCandidates = [
    path.join(__dirname, '../web/dist'),
    path.join(__dirname, './web/dist'),
    path.join(process.cwd(), 'web/dist'),
];
const webDistPath = webDistCandidates.find(p => fs.existsSync(p)) || webDistCandidates[0];
if (fs.existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
}

// 7. Express 5 SPA Catch-All Route (path-to-regexp v8: '/{*splat}')
app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/webhook') || req.path === '/health') {
        return next();
    }
    if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
        return res.status(404).send('Asset Not Found');
    }
    const spaIndex = path.join(webDistPath, 'index.html');
    if (fs.existsSync(spaIndex)) {
        return res.sendFile(spaIndex);
    }
    res.status(200).send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Jarvis Amba V3 API Gateway</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                .card { background: #1e293b; padding: 2rem 2.5rem; border-radius: 12px; border: 1px solid #334155; max-width: 500px; text-align: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
                h1 { margin-top: 0; color: #38bdf8; font-size: 1.5rem; }
                p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
                .badge { display: inline-block; background: #0369a1; color: #e0f2fe; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; margin-bottom: 1rem; }
            </style>
        </head>
        <body>
            <div class="card">
                <span class="badge">V3.1 ONLINE</span>
                <h1>Jarvis Unified Cloud Gateway</h1>
                <p>Express 5 Modular API & Unified Web Gateway aktif di Railway.</p>
                <p>Web Dashboard (React 19 + Vite) akan otomatis tampil di sini setelah Phase 2 di-build.</p>
            </div>
        </body>
        </html>
    `);
});

// 8. 404 Handler untuk API / Webhook yang tidak terdaftar
app.use((req, res) => {
    if (res.apiError) {
        return res.apiError('NOT_FOUND', `Endpoint '${req.method} ${req.originalUrl}' tidak ditemukan`, [], 404);
    }
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// 9. Express 5 Global Error Handler
app.use((err, req, res, next) => {
    console.error('💥 [Server Error]:', err.stack || err.message);
    if (res.apiError) {
        return res.apiError('INTERNAL_ERROR', err.message || 'Terjadi kesalahan internal pada server', [], 500);
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
});

module.exports = app;

