const db = require('./db');

/**
 * Format angka ke format Rupiah standar
 * @param {number|string} amount
 * @returns {string}
 */
function formatRupiah(amount) {
    const num = Math.round(Number(amount) || 0);
    return 'Rp ' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Membuat visual ASCII progress bar
 * @param {number} percentage Nilai 0 - 100
 * @param {number} length Panjang karakter bar (default: 10)
 * @returns {string} Contoh: [████████░░] 80%
 */
function generateProgressBar(percentage, length = 10) {
    const clamped = Math.max(0, Math.min(100, Math.round(percentage || 0)));
    const filledCount = Math.round((clamped / 100) * length);
    const emptyCount = length - filledCount;
    return `[${'█'.repeat(filledCount)}${'░'.repeat(emptyCount)}] ${clamped}%`;
}

/**
 * Menghitung batas waktu tanggal awal dan akhir berdasarkan rentang waktu
 * @param {string} rangeType 'this_month' | 'this_week' | 'today' | 'all'
 * @returns {{ current: { start: Date, end: Date }, prev: { start: Date, end: Date }, label: string }}
 */
function getDateRange(rangeType = 'this_month') {
    const now = new Date();
    let curStart, curEnd, prevStart, prevEnd, label;

    if (rangeType === 'this_week' || rangeType === 'week' || rangeType === 'minggu') {
        label = 'Minggu Ini';
        const day = now.getDay();
        const diffToMonday = (day === 0 ? -6 : 1) - day;
        curStart = new Date(now);
        curStart.setDate(now.getDate() + diffToMonday);
        curStart.setHours(0, 0, 0, 0);
        curEnd = new Date(now);

        prevStart = new Date(curStart);
        prevStart.setDate(curStart.getDate() - 7);
        prevEnd = new Date(curStart);
        prevEnd.setMilliseconds(-1);
    } else if (rangeType === 'today' || rangeType === 'hari_ini') {
        label = 'Hari Ini';
        curStart = new Date(now);
        curStart.setHours(0, 0, 0, 0);
        curEnd = new Date(now);

        prevStart = new Date(curStart);
        prevStart.setDate(curStart.getDate() - 1);
        prevEnd = new Date(curStart);
        prevEnd.setMilliseconds(-1);
    } else if (rangeType === 'all' || rangeType === 'semua') {
        label = 'Semua Waktu';
        curStart = new Date(0);
        curEnd = new Date(now);
        prevStart = new Date(0);
        prevEnd = new Date(0);
    } else {
        // Default: this_month
        label = 'Bulan Ini';
        curStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        curEnd = new Date(now);

        prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        prevEnd = new Date(curStart);
        prevEnd.setMilliseconds(-1);
    }

    return {
        current: { start: curStart, end: curEnd },
        prev: { start: prevStart, end: prevEnd },
        label,
    };
}

/**
 * Mengambil analitik keuangan pengguna beserta perbandingan periode sebelumnya
 */
async function getFinanceAnalytics(userId, rangeType = 'this_month') {
    const { current, prev, label } = getDateRange(rangeType);

    // 1. Total Pemasukan & Pengeluaran Periode Berjalan
    const currentTotalsQuery = `
        SELECT
            COALESCE(SUM(CASE WHEN kind = 'income' THEN amount ELSE 0 END), 0) AS total_income,
            COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
            COUNT(CASE WHEN kind = 'income' THEN 1 END) AS count_income,
            COUNT(CASE WHEN kind = 'expense' THEN 1 END) AS count_expense
        FROM financial_transactions
        WHERE user_id = $1 AND deleted_at IS NULL AND occurred_at >= $2 AND occurred_at <= $3;
    `;
    const curRes = await db.query(currentTotalsQuery, [userId, current.start, current.end]);
    const totalIncome = Number(curRes.rows[0]?.total_income || 0);
    const totalExpense = Number(curRes.rows[0]?.total_expense || 0);
    const netBalance = totalIncome - totalExpense;

    // 2. Total Periode Sebelumnya (Untuk Menghitung Tren / Persentase Perubahan)
    let prevExpense = 0;
    let prevIncome = 0;
    let expenseChangePercent = null;
    let incomeChangePercent = null;

    if (rangeType !== 'all') {
        const prevRes = await db.query(currentTotalsQuery, [userId, prev.start, prev.end]);
        prevIncome = Number(prevRes.rows[0]?.total_income || 0);
        prevExpense = Number(prevRes.rows[0]?.total_expense || 0);

        if (prevExpense > 0) {
            expenseChangePercent = Math.round(((totalExpense - prevExpense) / prevExpense) * 100);
        }
        if (prevIncome > 0) {
            incomeChangePercent = Math.round(((totalIncome - prevIncome) / prevIncome) * 100);
        }
    }

    // 3. Breakdown Kategori Pengeluaran
    const categoryQuery = `
        SELECT
            COALESCE(category, 'Lainnya') AS category,
            SUM(amount) AS total,
            COUNT(*) AS count
        FROM financial_transactions
        WHERE user_id = $1 AND kind = 'expense' AND deleted_at IS NULL AND occurred_at >= $2 AND occurred_at <= $3
        GROUP BY COALESCE(category, 'Lainnya')
        ORDER BY total DESC;
    `;
    const catRes = await db.query(categoryQuery, [userId, current.start, current.end]);
    const categories = catRes.rows.map((r) => {
        const catTotal = Number(r.total || 0);
        const percent = totalExpense > 0 ? Math.round((catTotal / totalExpense) * 100) : 0;
        return {
            category: r.category,
            total: catTotal,
            formattedTotal: formatRupiah(catTotal),
            count: Number(r.count || 0),
            percentage: percent,
        };
    });

    // 4. Pengeluaran Terbesar Periode Ini
    const largestQuery = `
        SELECT description, amount, category, occurred_at
        FROM financial_transactions
        WHERE user_id = $1 AND kind = 'expense' AND deleted_at IS NULL AND occurred_at >= $2 AND occurred_at <= $3
        ORDER BY amount DESC
        LIMIT 1;
    `;
    const largestRes = await db.query(largestQuery, [userId, current.start, current.end]);
    const largestExpense = largestRes.rows[0]
        ? {
              description: largestRes.rows[0].description || 'Tanpa keterangan',
              amount: Number(largestRes.rows[0].amount || 0),
              formattedAmount: formatRupiah(largestRes.rows[0].amount),
              category: largestRes.rows[0].category || 'Lainnya',
              date: largestRes.rows[0].occurred_at,
          }
        : null;

    return {
        label,
        totalIncome,
        formattedIncome: formatRupiah(totalIncome),
        totalExpense,
        formattedExpense: formatRupiah(totalExpense),
        netBalance,
        formattedNetBalance: formatRupiah(netBalance),
        prevExpense,
        prevIncome,
        expenseChangePercent,
        incomeChangePercent,
        categories,
        largestExpense,
        transactionCount: Number(curRes.rows[0]?.count_income || 0) + Number(curRes.rows[0]?.count_expense || 0),
    };
}

/**
 * Mengambil analitik produktivitas dan penyelesaian tugas
 */
async function getTaskAnalytics(userId, rangeType = 'this_month') {
    const { current, prev, label } = getDateRange(rangeType);

    // 1. Metrik Status Tugas
    const taskQuery = `
        SELECT
            COUNT(*) AS total_created,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE status != 'completed' AND status != 'cancelled' AND due_at < NOW()) AS overdue,
            COUNT(*) FILTER (WHERE priority = 'high' AND status = 'completed') AS high_priority_completed,
            COUNT(*) FILTER (WHERE priority = 'high') AS total_high_priority
        FROM tasks
        WHERE user_id = $1 AND deleted_at IS NULL AND created_at >= $2 AND created_at <= $3;
    `;
    const curRes = await db.query(taskQuery, [userId, current.start, current.end]);
    const row = curRes.rows[0] || {};

    const totalCreated = Number(row.total_created || 0);
    const completed = Number(row.completed || 0);
    const inProgress = Number(row.in_progress || 0);
    const pending = Number(row.pending || 0);
    const overdue = Number(row.overdue || 0);
    const highPriorityCompleted = Number(row.high_priority_completed || 0);
    const totalHighPriority = Number(row.total_high_priority || 0);

    const completionRate = totalCreated > 0 ? Math.round((completed / totalCreated) * 100) : 0;

    // 2. Perbandingan Tugas Periode Sebelumnya
    let prevCompleted = 0;
    let completionTrendPercent = null;
    if (rangeType !== 'all') {
        const prevRes = await db.query(taskQuery, [userId, prev.start, prev.end]);
        prevCompleted = Number(prevRes.rows[0]?.completed || 0);
        if (prevCompleted > 0) {
            completionTrendPercent = Math.round(((completed - prevCompleted) / prevCompleted) * 100);
        }
    }

    return {
        label,
        totalCreated,
        completed,
        inProgress,
        pending,
        overdue,
        completionRate,
        progressBar: generateProgressBar(completionRate, 10),
        highPriorityCompleted,
        totalHighPriority,
        prevCompleted,
        completionTrendPercent,
    };
}

/**
 * Mengambil analitik aktivitas pengingat (reminders)
 */
async function getReminderAnalytics(userId, rangeType = 'this_month') {
    const { current, label } = getDateRange(rangeType);

    const reminderQuery = `
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'sent') AS sent,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
            COUNT(*) FILTER (WHERE snooze_until IS NOT NULL) AS snoozed,
            COUNT(*) FILTER (WHERE repeat_rule IS NOT NULL) AS recurring
        FROM reminders
        WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3;
    `;
    const res = await db.query(reminderQuery, [userId, current.start, current.end]);
    const r = res.rows[0] || {};

    const total = Number(r.total || 0);
    const sent = Number(r.sent || 0);
    const pending = Number(r.pending || 0);
    const cancelled = Number(r.cancelled || 0);
    const snoozed = Number(r.snoozed || 0);
    const recurring = Number(r.recurring || 0);

    const reliabilityRate = total > 0 ? Math.round((sent / Math.max(1, sent + pending)) * 100) : 100;

    return {
        label,
        total,
        sent,
        pending,
        cancelled,
        snoozed,
        recurring,
        reliabilityRate,
    };
}

/**
 * Menghitung skor produktivitas komprehensif (0 - 100) dan insight cerdas
 */
function calculateProductivityScore(taskData, financeData, reminderData) {
    let score = 70; // baseline

    // 1. Kontribusi Tugas (Maks +20 / -20)
    if (taskData.totalCreated > 0) {
        if (taskData.completionRate >= 80) score += 15;
        else if (taskData.completionRate >= 50) score += 5;
        else score -= 10;
    }
    // Penalti Overdue Tugas (-5 per task, maks -15)
    score -= Math.min(15, taskData.overdue * 5);

    // 2. Kontribusi Keuangan (Maks +10 / -10)
    if (financeData.transactionCount > 0) {
        if (financeData.netBalance >= 0) {
            score += 10; // Saldo positif (surplus/tabungan)
        } else {
            score -= 10; // Defisit pengeluaran
        }
    }

    // 3. Kontribusi Reminder (Maks +5 / -5)
    if (reminderData.snoozed > 5) {
        score -= 5; // Terlalu sering menunda reminder
    } else if (reminderData.sent > 0) {
        score += 5;
    }

    const finalScore = Math.max(10, Math.min(100, score));
    let grade = 'B';
    if (finalScore >= 90) grade = 'A+';
    else if (finalScore >= 80) grade = 'A';
    else if (finalScore >= 70) grade = 'B';
    else if (finalScore >= 55) grade = 'C';
    else grade = 'D';

    // Proactive Insights & Rekomendasi Pintar Jarvis
    const insights = [];

    // Insight Finansial
    if (financeData.totalExpense > 0) {
        const topCat = financeData.categories[0];
        if (topCat && topCat.percentage >= 40) {
            insights.push(
                `💸 **Fokus Pengeluaran:** Kategori **${topCat.category}** menyerap **${topCat.percentage}%** dari total anggaran (${topCat.formattedTotal}). Pertimbangkan evaluasi pos ini.`
            );
        }
        if (financeData.expenseChangePercent !== null) {
            if (financeData.expenseChangePercent > 15) {
                insights.push(
                    `⚠️ **Tren Pengeluaran:** Belanja Bos naik **+${financeData.expenseChangePercent}%** dibanding periode sebelumnya. Jaga arus kas ya Bos!`
                );
            } else if (financeData.expenseChangePercent < -10) {
                insights.push(
                    `📉 **Penghematan Bagus:** Pengeluaran Bos turun **${financeData.expenseChangePercent}%** dibanding periode sebelumnya. Mantap!`
                );
            }
        }
        if (financeData.netBalance < 0) {
            insights.push(`🔴 **Arus Kas Defisit:** Pengeluaran melebihi pemasukan sebesar **${financeData.formattedNetBalance}**.`);
        }
    }

    // Insight Tugas
    if (taskData.overdue > 0) {
        insights.push(
            `⏰ **Tugas Tertunda:** Ada **${taskData.overdue} tugas** yang telah melewati tenggat waktu (overdue). Segera selesaikan agar tidak menumpuk!`
        );
    }
    if (taskData.totalCreated > 0 && taskData.completionRate >= 80) {
        insights.push(
            `🚀 **Performa Tinggi:** Tingkat penyelesaian tugas Bos mencapai **${taskData.completionRate}%**. Sangat disiplin dan produktif!`
        );
    }

    if (insights.length === 0) {
        insights.push('✨ Terus catat tugas, jadwal pengingat, dan transaksi harian Bos agar Jarvis dapat menyajikan wawasan analitik yang semakin tajam!');
    }

    return {
        score: finalScore,
        grade,
        progressBar: generateProgressBar(finalScore, 10),
        insights,
    };
}

/**
 * Mengambil laporan analitik komprehensif (Finansial, Tugas, Reminder, Skor & Wawasan AI)
 */
async function getFullAnalyticsReport(userId, rangeType = 'this_month') {
    const [finance, tasks, reminders] = await Promise.all([
        getFinanceAnalytics(userId, rangeType),
        getTaskAnalytics(userId, rangeType),
        getReminderAnalytics(userId, rangeType),
    ]);

    const performance = calculateProductivityScore(tasks, finance, reminders);

    return {
        rangeType,
        label: finance.label,
        finance,
        tasks,
        reminders,
        performance,
    };
}

/**
 * Sinkronisasi data ke tabel daily_metrics untuk snapshot historis
 */
async function syncDailyMetrics(userId, targetDate = new Date()) {
    if (!userId) return;
    const dateStr = targetDate.toISOString().split('T')[0];

    const sql = `
        INSERT INTO daily_metrics (
            user_id,
            metric_date,
            tasks_created,
            tasks_completed,
            reminders_created,
            reminders_sent,
            reminders_snoozed,
            income_total,
            expense_total,
            updated_at
        )
        VALUES (
            $1::varchar,
            $2::date,
            (SELECT COUNT(*) FROM tasks WHERE user_id = $1::varchar AND DATE(created_at) = $2::date AND deleted_at IS NULL),
            (SELECT COUNT(*) FROM tasks WHERE user_id = $1::varchar AND DATE(completed_at) = $2::date AND status = 'completed' AND deleted_at IS NULL),
            (SELECT COUNT(*) FROM reminders WHERE user_id = $1::varchar AND DATE(created_at) = $2::date),
            (SELECT COUNT(*) FROM reminders WHERE user_id = $1::varchar AND DATE(sent_at) = $2::date AND status = 'sent'),
            (SELECT COUNT(*) FROM reminders WHERE user_id = $1::varchar AND DATE(updated_at) = $2::date AND snooze_until IS NOT NULL),
            COALESCE((SELECT SUM(amount) FROM financial_transactions WHERE user_id = $1::varchar AND kind = 'income' AND DATE(occurred_at) = $2::date AND deleted_at IS NULL), 0),
            COALESCE((SELECT SUM(amount) FROM financial_transactions WHERE user_id = $1::varchar AND kind = 'expense' AND DATE(occurred_at) = $2::date AND deleted_at IS NULL), 0),
            NOW()
        )
        ON CONFLICT (user_id, metric_date) DO UPDATE
        SET
            tasks_created = EXCLUDED.tasks_created,
            tasks_completed = EXCLUDED.tasks_completed,
            reminders_created = EXCLUDED.reminders_created,
            reminders_sent = EXCLUDED.reminders_sent,
            reminders_snoozed = EXCLUDED.reminders_snoozed,
            income_total = EXCLUDED.income_total,
            expense_total = EXCLUDED.expense_total,
            updated_at = NOW();
    `;

    try {
        await db.query(sql, [userId, dateStr]);
    } catch (err) {
        console.warn('⚠️ Gagal sync daily_metrics:', err.message);
    }
}

/**
 * Mengambil analitik komprehensif dashboard untuk personal dashboard V3 (PRD Sec 69 - 73)
 * @param {string} userId
 * @param {object} [options] - { period: '7d' | '30d' | 'month' }
 */
async function getDashboardAnalytics(userId, options = {}) {
    const period = options.period || '30d';
    let intervalSql = "NOW() - INTERVAL '30 days'";
    let daysCount = 30;
    let label = '30 Hari Terakhir';

    if (period === '7d' || period === '7_days') {
        intervalSql = "NOW() - INTERVAL '7 days'";
        daysCount = 7;
        label = '7 Hari Terakhir';
    } else if (period === 'month' || period === 'this_month') {
        intervalSql = "DATE_TRUNC('month', CURRENT_DATE)";
        daysCount = new Date().getDate();
        label = 'Bulan Ini';
    }

    // 1. SECTION: TODAY (PRD Sec 70)
    const todayRes = await db.query(`
        SELECT
            COALESCE(SUM(CASE WHEN LOWER(kind) = 'expense' THEN amount ELSE 0 END), 0) AS today_expense,
            COALESCE(SUM(CASE WHEN LOWER(kind) = 'income' THEN amount ELSE 0 END), 0) AS today_income
        FROM financial_transactions
        WHERE user_id = $1 
          AND deleted_at IS NULL
          AND COALESCE(occurred_at, created_at) >= CURRENT_DATE;
    `, [userId]);

    const nextSchedRes = await db.query(`
        SELECT id, title, start_time, end_time, status
        FROM schedules
        WHERE user_id = $1 
          AND start_time >= NOW()
          AND start_time < CURRENT_DATE + INTERVAL '1 day'
          AND status != 'cancelled'
        ORDER BY start_time ASC
        LIMIT 1;
    `, [userId]);

    const nextRemRes = await db.query(`
        SELECT id, title, remind_at, delivery_mode, status
        FROM reminders
        WHERE user_id = $1
          AND status = 'pending'
          AND remind_at >= NOW()
        ORDER BY remind_at ASC
        LIMIT 1;
    `, [userId]);

    // 2. SECTION: FINANCE (PRD Sec 70 & 71)
    const totalsRes = await db.query(`
        SELECT
            COALESCE(SUM(CASE WHEN LOWER(kind) = 'expense' THEN amount ELSE 0 END), 0) AS period_expense,
            COALESCE(SUM(CASE WHEN LOWER(kind) = 'income' THEN amount ELSE 0 END), 0) AS period_income,
            COUNT(*) AS total_transactions
        FROM financial_transactions
        WHERE user_id = $1 
          AND deleted_at IS NULL
          AND COALESCE(occurred_at, created_at) >= ${intervalSql};
    `, [userId]);

    const totalExpense = parseFloat(totalsRes.rows[0]?.period_expense || 0);
    const totalIncome = parseFloat(totalsRes.rows[0]?.period_income || 0);
    const totalTransactions = parseInt(totalsRes.rows[0]?.total_transactions || 0, 10);

    // Cashflow daily trends
    const cashflowRes = await db.query(`
        SELECT 
            TO_CHAR(COALESCE(occurred_at, created_at)::date, 'YYYY-MM-DD') AS date_str,
            COALESCE(SUM(CASE WHEN LOWER(kind) = 'expense' THEN amount ELSE 0 END), 0) AS expense,
            COALESCE(SUM(CASE WHEN LOWER(kind) = 'income' THEN amount ELSE 0 END), 0) AS income
        FROM financial_transactions
        WHERE user_id = $1 
          AND deleted_at IS NULL
          AND COALESCE(occurred_at, created_at) >= ${intervalSql}
        GROUP BY TO_CHAR(COALESCE(occurred_at, created_at)::date, 'YYYY-MM-DD')
        ORDER BY date_str ASC;
    `, [userId]);

    const cashflow = cashflowRes.rows.map(r => ({
        date: r.date_str,
        expense: parseFloat(r.expense),
        income: parseFloat(r.income),
        net: parseFloat(r.income) - parseFloat(r.expense),
    }));

    // Categories Breakdown
    const catRes = await db.query(`
        SELECT 
            COALESCE(category, 'Lain-lain') AS category,
            SUM(amount) AS total,
            COUNT(*) AS count
        FROM financial_transactions
        WHERE user_id = $1 
          AND deleted_at IS NULL
          AND LOWER(kind) = 'expense'
          AND COALESCE(occurred_at, created_at) >= ${intervalSql}
        GROUP BY COALESCE(category, 'Lain-lain')
        ORDER BY total DESC;
    `, [userId]);

    const categories = catRes.rows.map(r => {
        const total = parseFloat(r.total);
        const percentage = totalExpense > 0 ? Math.round((total / totalExpense) * 100) : 0;
        return {
            category: r.category,
            total,
            count: parseInt(r.count, 10),
            percentage,
        };
    });

    // Payment Methods Breakdown (BCA, Mandiri, Cash, GoPay)
    const methodRes = await db.query(`
        SELECT 
            COALESCE(payment_method, 'Cash') AS method,
            SUM(amount) AS total,
            COUNT(*) AS count
        FROM financial_transactions
        WHERE user_id = $1 
          AND deleted_at IS NULL
          AND COALESCE(occurred_at, created_at) >= ${intervalSql}
        GROUP BY COALESCE(payment_method, 'Cash')
        ORDER BY total DESC;
    `, [userId]);

    const paymentMethods = methodRes.rows.map(r => {
        const total = parseFloat(r.total);
        const overall = totalExpense + totalIncome;
        const percentage = overall > 0 ? Math.round((total / overall) * 100) : 0;
        return {
            method: r.method,
            total,
            count: parseInt(r.count, 10),
            percentage,
        };
    });

    // Source Type Breakdown (CHAT, MANUAL, BANK_NOTIFICATION)
    const sourceRes = await db.query(`
        SELECT 
            COALESCE(source_type, 'CHAT') AS source_type,
            COUNT(*) AS count,
            COALESCE(SUM(amount), 0) AS total
        FROM financial_transactions
        WHERE user_id = $1 
          AND deleted_at IS NULL
          AND COALESCE(occurred_at, created_at) >= ${intervalSql}
        GROUP BY COALESCE(source_type, 'CHAT')
        ORDER BY count DESC;
    `, [userId]);

    const sourceTypes = sourceRes.rows.map(r => ({
        source_type: r.source_type,
        count: parseInt(r.count, 10),
        total: parseFloat(r.total),
    }));

    // Largest Expenses
    const largestRes = await db.query(`
        SELECT id, amount, description, category, payment_method, source_type, occurred_at
        FROM financial_transactions
        WHERE user_id = $1 
          AND deleted_at IS NULL
          AND LOWER(kind) = 'expense'
          AND COALESCE(occurred_at, created_at) >= ${intervalSql}
        ORDER BY amount DESC
        LIMIT 5;
    `, [userId]);

    const largestExpenses = largestRes.rows.map(r => ({
        id: r.id,
        amount: parseFloat(r.amount),
        description: r.description || '-',
        notes: r.description || '-',
        category: r.category || 'Lain-lain',
        payment_method: r.payment_method || 'Cash',
        source_type: r.source_type || 'CHAT',
        occurred_at: r.occurred_at,
    }));

    // 3. SECTION: PRODUCTIVITY (PRD Sec 70)
    const taskRes = await db.query(`
        SELECT
            COUNT(*) FILTER (WHERE status = 'completed') AS tasks_completed,
            COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled')) AS tasks_pending,
            COUNT(*) AS tasks_total
        FROM tasks
        WHERE user_id = $1
          AND deleted_at IS NULL
          AND created_at >= ${intervalSql};
    `, [userId]);

    const tasksCompleted = parseInt(taskRes.rows[0]?.tasks_completed || 0, 10);
    const tasksPending = parseInt(taskRes.rows[0]?.tasks_pending || 0, 10);
    const tasksTotal = parseInt(taskRes.rows[0]?.tasks_total || 0, 10);
    const completionRate = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;
    const avgTasksPerDay = daysCount > 0 ? parseFloat((tasksCompleted / daysCount).toFixed(1)) : 0;

    const remRes = await db.query(`
        SELECT
            COUNT(*) AS reminders_total,
            COUNT(*) FILTER (WHERE snooze_until IS NOT NULL) AS reminders_snoozed
        FROM reminders
        WHERE user_id = $1
          AND created_at >= ${intervalSql};
    `, [userId]);

    const remindersTotal = parseInt(remRes.rows[0]?.reminders_total || 0, 10);
    const remindersSnoozed = parseInt(remRes.rows[0]?.reminders_snoozed || 0, 10);
    const remindersSnoozedRatio = remindersTotal > 0 ? Math.round((remindersSnoozed / remindersTotal) * 100) : 0;

    // 4. SECTION: JARVIS HEALTH (PRD Sec 70)
    const jarvisHealth = {
        serverStatus: 'ONLINE',
        uptimeSeconds: Math.floor(process.uptime()),
        version: '3.1.0',
        environment: process.env.NODE_ENV || 'production',
        dbPool: {
            total: db.pool?.totalCount || 1,
            idle: db.pool?.idleCount || 1,
            waiting: db.pool?.waitingCount || 0,
        },
        geminiDirect: 'CONNECTED',
    };

    // 5. SECTION: AUTOMATED INSIGHTS (PRD Sec 72)
    const insights = [];
    if (categories.length > 0 && totalExpense > 0) {
        insights.push({
            type: 'FINANCE_TOP_CATEGORY',
            title: `Kategori Terbesar: ${categories[0].category}`,
            message: `Pengeluaran terbesar ${label.toLowerCase()} adalah ${categories[0].category} sebesar Rp ${Number(categories[0].total).toLocaleString('id-ID')} (${categories[0].percentage}% dari total).`,
            severity: categories[0].percentage > 40 ? 'warning' : 'info',
        });
    }

    if (paymentMethods.length > 0) {
        insights.push({
            type: 'FINANCE_PAYMENT_METHOD',
            title: `Metode Utama: ${paymentMethods[0].method}`,
            message: `Metode pembayaran terfavorit Anda adalah ${paymentMethods[0].method} (${paymentMethods[0].count} transaksi).`,
            severity: 'info',
        });
    }

    const netBalance = totalIncome - totalExpense;
    if (totalIncome > 0 || totalExpense > 0) {
        insights.push({
            type: netBalance >= 0 ? 'FINANCE_SURPLUS' : 'FINANCE_DEFICIT',
            title: netBalance >= 0 ? 'Arus Kas Surplus' : 'Arus Kas Defisit',
            message: netBalance >= 0 
                ? `Arus kas ${label.toLowerCase()} mencatat surplus Rp ${Number(netBalance).toLocaleString('id-ID')}.`
                : `Pengeluaran melebihi pemasukan sebesar Rp ${Number(Math.abs(netBalance)).toLocaleString('id-ID')}.`,
            severity: netBalance >= 0 ? 'success' : 'warning',
        });
    }

    if (tasksCompleted > 0) {
        insights.push({
            type: 'PRODUCTIVITY_MILESTONE',
            title: 'Penyelesaian Tugas',
            message: `Anda telah menyelesaikan ${tasksCompleted} tugas (${completionRate}% tingkat penyelesaian) pada periode ini.`,
            severity: 'success',
        });
    }

    return {
        period: {
            code: period,
            label,
            daysCount,
        },
        today: {
            expense: parseFloat(todayRes.rows[0]?.today_expense || 0),
            income: parseFloat(todayRes.rows[0]?.today_income || 0),
            nextSchedule: nextSchedRes.rows[0] || null,
            nextReminder: nextRemRes.rows[0] || null,
        },
        finance: {
            totalExpense,
            totalIncome,
            netBalance,
            totalTransactions,
            cashflow,
            categories,
            paymentMethods,
            sourceTypes,
            largestExpenses,
        },
        productivity: {
            tasksCompleted,
            tasksPending,
            tasksTotal,
            completionRate,
            avgTasksPerDay,
            remindersTotal,
            remindersSnoozed,
            remindersSnoozedRatio,
        },
        jarvis: jarvisHealth,
        insights,
    };
}

module.exports = {
    formatRupiah,
    generateProgressBar,
    getDateRange,
    getFinanceAnalytics,
    getTaskAnalytics,
    getReminderAnalytics,
    getFullAnalyticsReport,
    syncDailyMetrics,
    getDashboardAnalytics,
};
