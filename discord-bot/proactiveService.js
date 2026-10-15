const db = require('./db');

/**
 * Format mata uang Rupiah
 */
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(number);
}

/**
 * Menghasilkan konten Daily Briefing pagi hari
 */
async function getBriefingContent(userId) {
    // 1. Data User
    const userRes = await db.query(
        'SELECT id, display_name, callsign FROM users WHERE id = $1',
        [userId]
    );
    const user = userRes.rows[0] || {};
    const callsign = user.callsign || user.display_name || 'Kawan';

    // 2. Task Pending Hari Ini
    const tasksRes = await db.query(
        `SELECT id, title, priority, due_at 
         FROM tasks 
         WHERE user_id = $1 AND status IN ('pending', 'in_progress') AND deleted_at IS NULL
         ORDER BY 
            CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
            due_at ASC NULLS LAST
         LIMIT 5;`,
        [userId]
    );

    // 3. Reminder Aktif Hari Ini (WIB)
    const remindersRes = await db.query(
        `SELECT id, title, remind_at 
         FROM reminders 
         WHERE user_id = $1 AND status = 'pending' 
           AND (remind_at AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date
         ORDER BY remind_at ASC
         LIMIT 5;`,
        [userId]
    );

    const now = new Date();
    const dateFormatted = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(now);

    let message = `☀️ **Selamat Pagi, ${callsign}!**\n`;
    message += `📅 *${dateFormatted}*\n\n`;

    // Tasks section
    if (tasksRes.rowCount > 0) {
        message += `📋 **Daftar Tugas Prioritas (${tasksRes.rowCount}):**\n`;
        tasksRes.rows.forEach((t, i) => {
            const prioBadge = t.priority === 'high' ? '🔴 [High]' : t.priority === 'medium' ? '🟡 [Med]' : '⚪';
            message += `${i + 1}. ${prioBadge} **${t.title}**\n`;
        });
    } else {
        message += `📋 **Tugas:** Belum ada tugas tertunda untuk hari ini. Waktunya fokus atau santai sejenak! ☕\n`;
    }

    message += '\n';

    // Reminders section
    if (remindersRes.rowCount > 0) {
        message += `⏰ **Pengingat Terjadwal Hari Ini (${remindersRes.rowCount}):**\n`;
        remindersRes.rows.forEach((r) => {
            const timeStr = new Intl.DateTimeFormat('id-ID', {
                timeZone: 'Asia/Jakarta',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(new Date(r.remind_at));
            message += `• \`${timeStr} WIB\` — ${r.title}\n`;
        });
    } else {
        message += `⏰ **Pengingat:** Tidak ada jadwal pengingat untuk hari ini.\n`;
    }

    message += `\nSemoga harimu produktif, ${callsign}! Kalau butuh bantuan apa pun, langsung panggil Amba ya! 🚀`;
    return message;
}

/**
 * Menghasilkan konten Daily Recap malam hari
 */
async function getRecapContent(userId) {
    const userRes = await db.query(
        'SELECT id, display_name, callsign FROM users WHERE id = $1',
        [userId]
    );
    const user = userRes.rows[0] || {};
    const callsign = user.callsign || user.display_name || 'Kawan';

    // 1. Task Selesai vs Pending
    const taskStats = await db.query(
        `SELECT 
            COUNT(*) FILTER (WHERE status = 'completed' AND (updated_at AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date) AS completed_today,
            COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress') AND deleted_at IS NULL) AS pending_total
         FROM tasks
         WHERE user_id = $1;`,
        [userId]
    );
    const completedToday = parseInt(taskStats.rows[0]?.completed_today || 0, 10);
    const pendingTotal = parseInt(taskStats.rows[0]?.pending_total || 0, 10);

    // 2. Pengeluaran Keuangan Hari Ini
    const financeStats = await db.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_expense, COUNT(*) AS count_trx
         FROM financial_transactions
         WHERE user_id = $1 AND kind = 'expense' AND deleted_at IS NULL
           AND (occurred_at AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date;`,
        [userId]
    );
    const totalExpense = parseFloat(financeStats.rows[0]?.total_expense || 0);

    // 3. Reminders Besok
    const nextDayReminders = await db.query(
        `SELECT COUNT(*) AS count_tomorrow
         FROM reminders
         WHERE user_id = $1 AND status = 'pending'
           AND (remind_at AT TIME ZONE 'Asia/Jakarta')::date = ((NOW() AT TIME ZONE 'Asia/Jakarta') + INTERVAL '1 day')::date;`,
        [userId]
    );
    const countTomorrow = parseInt(nextDayReminders.rows[0]?.count_tomorrow || 0, 10);

    let message = `📊 **Daily Recap Malam Ini, ${callsign}!**\n\n`;
    message += `✅ **Tugas Selesai Hari Ini:** ${completedToday} tugas\n`;
    message += `⏳ **Tugas Masih Pending:** ${pendingTotal} tugas\n`;
    message += `💰 **Pengeluaran Hari Ini:** ${formatRupiah(totalExpense)}\n`;
    message += `⏰ **Pengingat Siap Siaga Besok:** ${countTomorrow} jadwal\n\n`;

    if (pendingTotal > 0) {
        message += `Jangan lupa istirahat yang cukup ya, ${callsign}. Tugas yang belum beres bisa kita lanjutkan besok dengan energi baru! 🌙✨`;
    } else {
        message += `Luar biasa! Hari yang sangat produktif, ${callsign}. Selamat beristirahat nyenyak! 🌟`;
    }

    return message;
}

/**
 * Menangani Recurring Reminders ketika sebuah reminder terpicu
 * Menghitung occurrence berikutnya sesuai repeat_rule
 */
async function handleRecurringReminder(reminderId) {
    if (!reminderId) return null;

    try {
        const res = await db.query('SELECT * FROM reminders WHERE id = $1', [reminderId]);
        const r = res.rows[0];
        if (!r || !r.repeat_rule) return null;

        const rule = r.repeat_rule.toUpperCase().trim();
        let intervalSql = null;

        if (rule === 'DAILY' || rule === 'HARIAN') {
            intervalSql = "INTERVAL '1 day'";
        } else if (rule === 'WEEKLY' || rule === 'MINGGUAN') {
            intervalSql = "INTERVAL '7 days'";
        } else if (rule === 'MONTHLY' || rule === 'BULANAN') {
            intervalSql = "INTERVAL '1 month'";
        } else if (rule.startsWith('EVERY_') && rule.endsWith('_DAYS')) {
            const days = parseInt(rule.replace('EVERY_', '').replace('_DAYS', ''), 10) || 1;
            intervalSql = `INTERVAL '${days} days'`;
        }

        if (!intervalSql) return null;

        // Buat reminder baru untuk occurrence berikutnya
        const insertSql = `
            INSERT INTO reminders (
                user_id, channel_id, task_id, title, 
                remind_at, repeat_rule, status, parent_reminder_id, created_at
            )
            VALUES (
                $1, $2, $3, $4, 
                ($5::timestamptz + ${intervalSql}), $6, 'pending', $7, NOW()
            )
            RETURNING *;
        `;
        const newRem = await db.query(insertSql, [
            r.user_id,
            r.channel_id,
            r.task_id,
            r.title,
            r.remind_at,
            r.repeat_rule,
            r.id,
        ]);

        console.log(`🔁 Recurring Reminder terjadwal berikutnya (ID: ${newRem.rows[0]?.id}) pada: ${newRem.rows[0]?.remind_at}`);
        return newRem.rows[0];
    } catch (err) {
        console.error('⚠️ Gagal menjadwalkan recurring reminder:', err.message);
        return null;
    }
}

/**
 * Fitur Snooze: Menunda reminder terakhir pengguna
 */
async function snoozeReminder(userId, durationMinutes = 10) {
    if (!userId) return null;

    try {
        // Cari reminder terakhir milik user yang baru saja dikirim atau yang sedang di-snooze
        const findSql = `
            SELECT id, title, channel_id, remind_at 
            FROM reminders 
            WHERE user_id = $1 AND (status = 'sent' OR (status = 'pending' AND snooze_until IS NOT NULL))
            ORDER BY COALESCE(sent_at, remind_at) DESC 
            LIMIT 1;
        `;
        const res = await db.query(findSql, [userId]);
        const lastRem = res.rows[0];
        if (!lastRem) return null;

        const minutes = Math.max(1, parseInt(durationMinutes, 10) || 10);
        const snoozeSql = `
            UPDATE reminders
            SET status = 'pending',
                snooze_until = NOW() + ($2 || ' minutes')::interval,
                sent_at = NULL
            WHERE id = $1
            RETURNING id, title, channel_id, snooze_until;
        `;
        const updated = await db.query(snoozeSql, [lastRem.id, minutes]);
        return {
            reminder: updated.rows[0],
            minutes: minutes,
        };
    } catch (err) {
        console.error('⚠️ Gagal melakukan snooze reminder:', err.message);
        return null;
    }
}

/**
 * Mencari channel Discord yang cocok untuk mengirim notifikasi proaktif ke user
 */
async function resolveProactiveChannel(client, user) {
    // 1. Jika user memiliki channel khusus briefing yang tersimpan
    if (user.briefing_channel_id) {
        const ch = await client.channels.fetch(user.briefing_channel_id).catch(() => null);
        if (ch) return ch;
    }

    // 2. Cari channel terakhir dari riwayat percakapan pengguna
    const lastConv = await db.query(
        'SELECT channel_id FROM conversations WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
        [user.id]
    );
    if (lastConv.rows[0]?.channel_id) {
        const ch = await client.channels.fetch(lastConv.rows[0].channel_id).catch(() => null);
        if (ch) return ch;
    }

    // 3. Fallback ke Direct Message (DM)
    try {
        const discordUser = await client.users.fetch(user.id).catch(() => null);
        if (discordUser) {
            return await discordUser.createDM().catch(() => null);
        }
    } catch (_) {}

    return null;
}

/**
 * Memeriksa dan mengirimkan Daily Briefing & Daily Recap secara otomatis
 */
async function checkAndSendProactiveMessages(client) {
    if (!client || !client.isReady()) return;

    try {
        // Ambil waktu saat ini di WIB
        const nowWIB = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const currentHours = String(nowWIB.getHours()).padStart(2, '0');
        const currentMinutes = String(nowWIB.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMinutes}`;

        // 1. DAILY BRIEFING
        const briefingUsers = await db.query(
            `SELECT id, display_name, callsign, briefing_channel_id, daily_briefing_time 
             FROM users 
             WHERE daily_briefing_enabled = TRUE 
               AND (last_briefing_date IS NULL OR last_briefing_date < CURRENT_DATE)
               AND daily_briefing_time <= $1;`,
            [currentTimeStr]
        );

        for (const u of briefingUsers.rows) {
            const channel = await resolveProactiveChannel(client, u);
            if (channel) {
                const text = await getBriefingContent(u.id);
                await channel.send(`<@${u.id}>\n${text}`).catch(() => {});
                await db.query('UPDATE users SET last_briefing_date = CURRENT_DATE WHERE id = $1', [u.id]);
                await db.query(
                    'INSERT INTO proactive_logs (user_id, type, channel_id, content, status) VALUES ($1, $2, $3, $4, $5)',
                    [u.id, 'DAILY_BRIEFING', channel.id, text, 'SENT']
                ).catch(() => {});
                console.log(`☀️ Daily Briefing berhasil dikirim ke user ${u.display_name || u.id}`);
            }
        }

        // 2. DAILY RECAP
        const recapUsers = await db.query(
            `SELECT id, display_name, callsign, briefing_channel_id, daily_recap_time 
             FROM users 
             WHERE daily_recap_enabled = TRUE 
               AND (last_recap_date IS NULL OR last_recap_date < CURRENT_DATE)
               AND daily_recap_time <= $1;`,
            [currentTimeStr]
        );

        for (const u of recapUsers.rows) {
            const channel = await resolveProactiveChannel(client, u);
            if (channel) {
                const text = await getRecapContent(u.id);
                await channel.send(`<@${u.id}>\n${text}`).catch(() => {});
                await db.query('UPDATE users SET last_recap_date = CURRENT_DATE WHERE id = $1', [u.id]);
                await db.query(
                    'INSERT INTO proactive_logs (user_id, type, channel_id, content, status) VALUES ($1, $2, $3, $4, $5)',
                    [u.id, 'DAILY_RECAP', channel.id, text, 'SENT']
                ).catch(() => {});
                console.log(`📊 Daily Recap berhasil dikirim ke user ${u.display_name || u.id}`);
            }
        }

        // 3. CHECK SNOOZED REMINDERS YANG JATUH TEMPO
        const snoozed = await db.query(
            `UPDATE reminders 
             SET status = 'sent', sent_at = NOW(), snooze_until = NULL
             WHERE id IN (
                 SELECT id FROM reminders 
                 WHERE status = 'pending' AND snooze_until IS NOT NULL AND snooze_until <= NOW()
                 FOR UPDATE SKIP LOCKED
             )
             RETURNING id, user_id, channel_id, title;`
        );

        for (const r of snoozed.rows) {
            const ch = await client.channels.fetch(r.channel_id).catch(() => null);
            if (ch) {
                await ch.send(`⏰ <@${r.user_id}> **[Snooze Berakhir]:** ${r.title}`).catch(() => {});
                console.log(`⏰ Pengingat snooze #${r.id} berhasil terpicu kembali.`);
            }
        }
    } catch (err) {
        console.error('⚠️ Error pada proactive scheduler:', err.message);
    }
}

/**
 * Menjalankan background timer scheduler setiap 60 detik
 */
function startProactiveScheduler(client) {
    console.log('⏰ Proactive Scheduler (Daily Briefing & Recap) diaktifkan.');
    // Jalankan segera cek pertama kali setelah 5 detik bot booting
    setTimeout(() => {
        checkAndSendProactiveMessages(client).catch(() => {});
    }, 5000);

    // Lalu jalankan interval setiap 60 detik
    const interval = setInterval(() => {
        checkAndSendProactiveMessages(client).catch(() => {});
    }, 60000);

    return interval;
}

module.exports = {
    getBriefingContent,
    getRecapContent,
    handleRecurringReminder,
    snoozeReminder,
    checkAndSendProactiveMessages,
    startProactiveScheduler,
};
