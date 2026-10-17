const db = require('./db');
const { sendSmartNotification } = require('./notificationService');

const { getPriorityBadge } = require('./scheduleService');

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

function formatPriorityBadge(prio) {
    return getPriorityBadge(prio);
}

function formatTimeWIB(dateObj) {
    if (!dateObj) return '';
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(dateObj));
}

function formatDateShortWIB(dateObj) {
    if (!dateObj) return '';
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(dateObj));
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

    // 2. Jadwal / Agenda Kegiatan Hari Ini (WIB)
    const schedulesRes = await db.query(
        `SELECT id, title, description, start_time, end_time, location, priority 
         FROM schedules 
         WHERE user_id = $1 AND deleted_at IS NULL AND status IN ('SCHEDULED', 'ONGOING')
           AND (start_time AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date
         ORDER BY 
            CASE UPPER(priority) WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
            start_time ASC;`,
        [userId]
    );

    // 3. Task Pending Hari Ini
    const tasksRes = await db.query(
        `SELECT id, title, priority, due_at 
         FROM tasks 
         WHERE user_id = $1 AND status IN ('pending', 'in_progress') AND deleted_at IS NULL
         ORDER BY 
            CASE UPPER(priority) WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
            due_at ASC NULLS LAST
         LIMIT 5;`,
        [userId]
    );

    // 4. Reminder Aktif Hari Ini (WIB)
    const remindersRes = await db.query(
        `SELECT id, title, priority, remind_at 
         FROM reminders 
         WHERE user_id = $1 AND status = 'pending' 
           AND (remind_at AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date
         ORDER BY 
            CASE UPPER(COALESCE(priority, 'MEDIUM')) WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
            remind_at ASC
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

    // 1. Jadwal / Agenda Section
    if (schedulesRes.rowCount > 0) {
        message += `📅 **Agenda & Jadwal Hari Ini (${schedulesRes.rowCount}):**\n`;
        schedulesRes.rows.forEach((s, i) => {
            const prioBadge = formatPriorityBadge(s.priority);
            const timeStr = formatTimeWIB(s.start_time);
            const endStr = s.end_time ? ` - ${formatTimeWIB(s.end_time)}` : '';
            const locStr = s.location ? ` (📍 ${s.location})` : '';
            message += `${i + 1}. ${prioBadge} **${s.title}** \`[${timeStr}${endStr} WIB]\`${locStr}\n`;
        });
    } else {
        message += `📅 **Jadwal:** Tidak ada agenda acara khusus untuk hari ini.\n`;
    }

    message += '\n';

    // 2. Tasks section
    if (tasksRes.rowCount > 0) {
        message += `📋 **Daftar Tugas Prioritas (${tasksRes.rowCount}):**\n`;
        tasksRes.rows.forEach((t, i) => {
            const prioBadge = formatPriorityBadge(t.priority);
            const dueStr = t.due_at ? ` (Tenggat: \`${formatDateShortWIB(t.due_at)}\`)` : '';
            message += `${i + 1}. ${prioBadge} **${t.title}**${dueStr}\n`;
        });
    } else {
        message += `📋 **Tugas:** Belum ada tugas tertunda untuk hari ini. Waktunya fokus atau santai sejenak! ☕\n`;
    }

    message += '\n';

    // 3. Reminders section
    if (remindersRes.rowCount > 0) {
        message += `⏰ **Pengingat Terjadwal Hari Ini (${remindersRes.rowCount}):**\n`;
        remindersRes.rows.forEach((r, i) => {
            const prioBadge = formatPriorityBadge(r.priority);
            const timeStr = formatTimeWIB(r.remind_at);
            message += `${i + 1}. ${prioBadge} \`${timeStr} WIB\` — ${r.title}\n`;
        });
    } else {
        message += `⏰ **Pengingat:** Tidak ada jadwal alarm pengingat untuk hari ini.\n`;
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

    // 3. Jadwal Kegiatan Besok (Agenda)
    const nextDaySchedules = await db.query(
        `SELECT id, title, start_time, location, priority
         FROM schedules
         WHERE user_id = $1 AND deleted_at IS NULL AND status = 'SCHEDULED'
           AND (start_time AT TIME ZONE 'Asia/Jakarta')::date = ((NOW() AT TIME ZONE 'Asia/Jakarta') + INTERVAL '1 day')::date
         ORDER BY start_time ASC;`,
        [userId]
    );

    // 4. Reminders Besok
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
    message += `📅 **Agenda & Jadwal Besok:** ${nextDaySchedules.rowCount} kegiatan\n`;
    if (nextDaySchedules.rowCount > 0) {
        nextDaySchedules.rows.forEach((s) => {
            const timeStr = formatTimeWIB(s.start_time);
            const prioBadge = formatPriorityBadge(s.priority);
            const locStr = s.location ? ` @ ${s.location}` : '';
            message += `   └ ${prioBadge} \`${timeStr} WIB\` — **${s.title}**${locStr}\n`;
        });
    }
    message += `⏰ **Pengingat Siap Siaga Besok:** ${countTomorrow} alarm\n\n`;

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
            const text = await getBriefingContent(u.id);
            const smartRes = await sendSmartNotification({
                userId: u.id,
                eventType: 'DAILY_BRIEFING',
                text: text,
                context: { channelId: u.briefing_channel_id },
                discordClient: client,
            });

            if (smartRes.success) {
                await db.query('UPDATE users SET last_briefing_date = CURRENT_DATE WHERE id = $1', [u.id]);
                await db.query(
                    'INSERT INTO proactive_logs (user_id, type, channel_id, content, status) VALUES ($1, $2, $3, $4, $5)',
                    [u.id, 'DAILY_BRIEFING', u.briefing_channel_id || 'SMART_ROUTED', text, 'SENT']
                ).catch(() => {});
                const channelsStr = smartRes.results.filter(r => r.success).map(r => r.channel).join(', ');
                console.log(`☀️ Daily Briefing berhasil dikirim ke user ${u.display_name || u.id} via [${channelsStr}]`);
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
            const text = await getRecapContent(u.id);
            const smartRes = await sendSmartNotification({
                userId: u.id,
                eventType: 'DAILY_RECAP',
                text: text,
                context: { channelId: u.briefing_channel_id },
                discordClient: client,
            });

            if (smartRes.success) {
                await db.query('UPDATE users SET last_recap_date = CURRENT_DATE WHERE id = $1', [u.id]);
                await db.query(
                    'INSERT INTO proactive_logs (user_id, type, channel_id, content, status) VALUES ($1, $2, $3, $4, $5)',
                    [u.id, 'DAILY_RECAP', u.briefing_channel_id || 'SMART_ROUTED', text, 'SENT']
                ).catch(() => {});
                const channelsStr = smartRes.results.filter(r => r.success).map(r => r.channel).join(', ');
                console.log(`📊 Daily Recap berhasil dikirim ke user ${u.display_name || u.id} via [${channelsStr}]`);
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
            const text = `⏰ **[Snooze Berakhir]:** ${r.title}`;
            const smartRes = await sendSmartNotification({
                userId: r.user_id,
                eventType: 'REMINDER',
                text: text,
                context: { channelId: r.channel_id, reminderId: r.id },
                discordClient: client,
            });
            if (smartRes.success) {
                console.log(`⏰ Pengingat snooze #${r.id} berhasil terpicu kembali.`);
            }
        }

        // 4. CHECK & PROCESS SCHEDULED BROADCASTS (Phase 9)
        try {
            const { processPendingScheduledBroadcasts } = require('./broadcastService');
            await processPendingScheduledBroadcasts(client);
        } catch (bcErr) {
            console.error('⚠️ Error saat memproses broadcast terjadwal:', bcErr.message);
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
