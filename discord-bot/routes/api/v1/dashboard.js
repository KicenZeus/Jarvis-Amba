const express = require('express');
const router = express.Router();
const { authenticateJwt } = require('../../../middleware/authMiddleware');
const db = require('../../../db');
const { getDashboardAnalytics } = require('../../../analyticsService');

/**
 * GET /api/v1/dashboard/summary
 * Menghitung ringkasan cepat kartu Home dashboard (PRD V3 Sec 18 & Lampiran F)
 * - Total pengeluaran bulan ini (kind = 'EXPENSE')
 * - Sisa tugas pending
 * - Pengingat aktif terdekat
 * - Status health bot
 */
router.get('/summary', authenticateJwt, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Hitung total pengeluaran dan pemasukan bulan ini
        const financeRes = await db.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN UPPER(kind) = 'EXPENSE' THEN amount ELSE 0 END), 0) AS total_expense,
                COALESCE(SUM(CASE WHEN UPPER(kind) = 'INCOME' THEN amount ELSE 0 END), 0) AS total_income
            FROM financial_transactions
            WHERE user_id = $1 
              AND COALESCE(occurred_at, created_at) >= DATE_TRUNC('month', CURRENT_DATE);
        `, [userId]);

        // 2. Hitung jumlah sisa tugas (pending / in_progress)
        const tasksRes = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled')) AS pending_tasks,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks
            FROM tasks
            WHERE user_id = $1;
        `, [userId]);

        // 3. Ambil pengingat terdekat yang masih pending
        const remindersRes = await db.query(`
            SELECT id, title, title AS reminder_text, remind_at, channel_id, created_at
            FROM reminders
            WHERE user_id = $1 
              AND status = 'pending'
              AND remind_at >= NOW()
            ORDER BY remind_at ASC
            LIMIT 1;
        `, [userId]);

        // 4. Status bot & sistem
        const systemInfo = {
            botStatus: 'ONLINE',
            serverTime: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
            version: '3.1.0',
            environment: process.env.NODE_ENV || 'production',
        };

        return res.apiSuccess({
            summary: {
                monthlyExpense: parseFloat(financeRes.rows[0]?.total_expense || 0),
                monthlyIncome: parseFloat(financeRes.rows[0]?.total_income || 0),
                pendingTasks: parseInt(tasksRes.rows[0]?.pending_tasks || 0, 10),
                completedTasks: parseInt(tasksRes.rows[0]?.completed_tasks || 0, 10),
                nextReminder: remindersRes.rows[0] || null,
                system: systemInfo,
            },
        });
    } catch (err) {
        console.error('❌ [Dashboard API] Gagal memuat ringkasan summary:', err.message);
        return res.apiError('INTERNAL_ERROR', 'Gagal memuat ringkasan dashboard', [], 500);
    }
});

/**
 * GET /api/v1/dashboard/analytics
 * Mengambil analitik komprehensif dashboard V3 (PRD Sec 69 - 73)
 * Query params: ?period=7d | 30d | month (default: 30d)
 */
router.get('/analytics', authenticateJwt, async (req, res) => {
    try {
        const period = req.query.period || '30d';
        const analytics = await getDashboardAnalytics(req.user.id, { period });

        return res.apiSuccess({ analytics });
    } catch (err) {
        console.error('❌ [Dashboard API] Gagal memuat analitik dashboard:', err.message);
        return res.apiError('INTERNAL_ERROR', 'Gagal memuat analitik dashboard', [], 500);
    }
});

module.exports = router;