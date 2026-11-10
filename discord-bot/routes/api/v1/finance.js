const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const { financeLimiter } = require('../../../middleware/rateLimiter');
const db = require('../../../db');

/**
 * GET /api/v1/finance/transactions
 * Mengambil histori transaksi finansial
 */
router.get('/transactions', authenticateJwt, async (req, res) => {
    try {
        const { limit = 50, offset = 0, type } = req.query;
        let query = `
            SELECT id, user_id, kind, kind AS transaction_type, amount, currency, 
                   category, description, payment_method, source_type, occurred_at, 
                   occurred_at AS transaction_date, created_at, updated_at 
            FROM financial_transactions 
            WHERE user_id = $1
              AND deleted_at IS NULL
        `;
        const params = [req.user.id];

        if (type) {
            params.push(type.toUpperCase());
            query += ` AND UPPER(kind) = $${params.length}`;
        }

        params.push(Math.min(parseInt(limit, 10) || 50, 100));
        params.push(parseInt(offset, 10) || 0);
        query += ` ORDER BY COALESCE(occurred_at, created_at) DESC LIMIT $${params.length - 1} OFFSET $${params.length};`;

        const result = await db.query(query, params);
        return res.apiSuccess({ transactions: result.rows });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/finance/transactions
 * Mencatat transaksi finansial baru secara manual
 */
router.post('/transactions', authenticateJwt, async (req, res) => {
    const { amount, transaction_type, kind, category, description, payment_method = 'Cash', source_type = 'MANUAL', transaction_date, occurred_at } = req.body;
    const finalKind = (transaction_type || kind || 'expense').toLowerCase();

    if (!amount || !category) {
        return res.apiError(
            'VALIDATION_ERROR',
            'amount dan category wajib diisi',
            ['amount', 'category'],
            400
        );
    }

    try {
        const tDate = transaction_date || occurred_at ? new Date(transaction_date || occurred_at) : new Date();
        const result = await db.query(
            `INSERT INTO financial_transactions 
             (user_id, amount, kind, category, description, payment_method, source_type, occurred_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             RETURNING *, kind AS transaction_type, occurred_at AS transaction_date;`,
            [
                req.user.id,
                parseFloat(amount),
                finalKind,
                category,
                description || '',
                payment_method,
                source_type,
                tDate,
            ]
        );

        return res.apiSuccess({ transaction: result.rows[0] }, {}, 201);
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * GET /api/v1/finance/summary
 * Ringkasan pemasukan dan pengeluaran bulan berjalan
 */
router.get('/summary', authenticateJwt, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT 
                UPPER(kind) as transaction_type, 
                COUNT(*) as count, 
                COALESCE(SUM(amount), 0) as total
             FROM financial_transactions
             WHERE user_id = $1 
               AND deleted_at IS NULL
               AND COALESCE(occurred_at, created_at) >= date_trunc('month', CURRENT_DATE)
             GROUP BY UPPER(kind);`,
            [req.user.id]
        );

        let income = 0;
        let expense = 0;

        for (const row of result.rows) {
            if (row.transaction_type === 'INCOME') income = parseFloat(row.total);
            if (row.transaction_type === 'EXPENSE') expense = parseFloat(row.total);
        }

        return res.apiSuccess({
            currentMonth: {
                income,
                expense,
                netBalance: income - expense,
            },
        });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/finance/events
 * Ingest notifikasi bank dari mobile client (Phase 6 Auto-Capture & Parsing)
 */
router.post('/events', financeLimiter, authenticateJwt, async (req, res) => {
    const { package_name, notification_key, post_time, title, text, policy = 'AUTO_IF_CONFIDENT' } = req.body;

    if (!package_name || (!text && !title)) {
        return res.apiError('VALIDATION_ERROR', 'package_name dan teks notifikasi (title/text) wajib diisi', ['package_name', 'text'], 400);
    }

    try {
        const { processIncomingFinanceEvent } = require('../../../financeParser');
        const result = await processIncomingFinanceEvent(req.user.id, {
            package_name,
            notification_key,
            post_time,
            title,
            text,
            policy,
        });

        if (result.isDuplicate) {
            return res.apiSuccess({
                status: 'DUPLICATE',
                message: 'Event notifikasi sudah pernah dicatat sebelumnya',
                eventId: result.eventId,
            }, {}, 200);
        }

        if (!result.success) {
            return res.apiError('PARSING_FAILED', 'Gagal membedah informasi mutasi notifikasi', [], 422);
        }

        return res.apiSuccess({
            status: result.event.status,
            event: result.event,
            importedTransactionId: result.importedTransactionId,
            parsedBy: result.parsedBy,
        }, {}, 201);
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * GET /api/v1/finance/events
 * Mengambil histori event notifikasi finansial yang tertangkap (Staging)
 */
router.get('/events', authenticateJwt, async (req, res) => {
    const { limit = 20, status } = req.query;
    try {
        const lim = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));
        let query = `
            SELECT id, user_id, source_id, external_event_id, event_type, 
                   parsed_amount, currency, description, payment_method, 
                   occurred_at, confidence_score, status, created_at, processed_at
            FROM financial_events 
            WHERE user_id = $1
        `;
        const params = [req.user.id];
        if (status) {
            params.push(status.toUpperCase());
            query += ` AND status = $${params.length}`;
        }
        params.push(lim);
        query += ` ORDER BY occurred_at DESC LIMIT $${params.length};`;

        const result = await db.query(query, params);
        return res.apiSuccess({ events: result.rows });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * GET /api/v1/finance/sources
 * Mengambil daftar allowlist aplikasi bank yang diizinkan
 */
router.get('/sources', authenticateJwt, async (req, res) => {
    try {
        let result = await db.query(
            `SELECT id, user_id, package_name, app_name, source_type, enabled, created_at 
             FROM finance_notification_sources 
             WHERE user_id = $1 
             ORDER BY app_name ASC;`,
            [req.user.id]
        );

        // Jika belum ada konfigurasi per-user, inisialisasi default dari allowlist baku
        if (result.rows.length === 0) {
            const defaultSources = [
                ['com.bca', 'BCA mobile', 'BANK'],
                ['id.co.bri.brimo', 'BRImo BRI', 'BANK'],
                ['com.bankmandiri.livin', 'Livin by Mandiri', 'BANK'],
                ['com.gojek.app', 'GoPay', 'E_WALLET'],
                ['com.btpn.dc', 'Jenius BTPN', 'BANK'],
                ['com.shopee.id', 'ShopeePay', 'E_WALLET'],
            ];

            for (const [pkg, name, stype] of defaultSources) {
                await db.query(
                    `INSERT INTO finance_notification_sources (user_id, package_name, app_name, source_type, enabled, created_at)
                     VALUES ($1, $2, $3, $4, true, NOW())
                     ON CONFLICT (user_id, package_name) DO NOTHING;`,
                    [req.user.id, pkg, name, stype]
                );
            }

            result = await db.query(
                `SELECT id, user_id, package_name, app_name, source_type, enabled, created_at 
                 FROM finance_notification_sources 
                 WHERE user_id = $1 
                 ORDER BY app_name ASC;`,
                [req.user.id]
            );
        }

        return res.apiSuccess({ sources: result.rows });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * POST /api/v1/finance/sources
 * Menambahkan atau memperbarui sumber aplikasi perbankan ke allowlist
 */
router.post('/sources', authenticateJwt, async (req, res) => {
    const { package_name, app_name, source_type = 'BANK', enabled = true } = req.body;
    if (!package_name || !app_name) {
        return res.apiError('VALIDATION_ERROR', 'package_name dan app_name wajib diisi', ['package_name', 'app_name'], 400);
    }

    try {
        const result = await db.query(
            `INSERT INTO finance_notification_sources (user_id, package_name, app_name, source_type, enabled, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             ON CONFLICT (user_id, package_name) DO UPDATE
             SET app_name = EXCLUDED.app_name,
                 source_type = EXCLUDED.source_type,
                 enabled = EXCLUDED.enabled,
                 updated_at = NOW()
             RETURNING *;`,
            [req.user.id, package_name.trim().toLowerCase(), app_name.trim(), source_type, enabled]
        );
        return res.apiSuccess({ source: result.rows[0] }, {}, 201);
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

/**
 * PATCH /api/v1/finance/sources/:id
 * Mengaktifkan atau menonaktifkan sumber aplikasi perbankan
 */
router.patch('/sources/:id', authenticateJwt, async (req, res) => {
    const { enabled } = req.body;
    try {
        const result = await db.query(
            `UPDATE finance_notification_sources 
             SET enabled = $1, updated_at = NOW() 
             WHERE id = $2 AND user_id = $3 
             RETURNING *;`,
            [Boolean(enabled), req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.apiError('NOT_FOUND', 'Sumber notifikasi tidak ditemukan', [], 404);
        }
        return res.apiSuccess({ source: result.rows[0] });
    } catch (err) {
        return res.apiError('INTERNAL_ERROR', err.message, [], 500);
    }
});

module.exports = router;
