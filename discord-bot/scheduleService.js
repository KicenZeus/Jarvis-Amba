const db = require('./db');

/**
 * ==============================================================================
 * Service: scheduleService.js
 * Phase: Manajemen Jadwal / Agenda Kegiatan & Acara (Schedules)
 * Membedakan secara tegas antara:
 * - Tugas (Tasks): Hal yang harus dikerjakan / diselesaikan (checklist/todo)
 * - Jadwal (Schedules): Acara / kegiatan terikat waktu (agenda/timeline)
 * - Pengingat (Reminders): Alarm notifikasi yang mencolek user pada jam tertentu
 * ==============================================================================
 */

/**
 * Normalisasi nilai prioritas ke salah satu dari: 'LOW', 'MEDIUM', 'HIGH', 'URGENT'
 */
function normalizePriority(prio) {
    if (!prio) return 'MEDIUM';
    const clean = String(prio).trim().toUpperCase();
    if (['URGENT', 'DARURAT', 'PENTING BANGET', 'CRITICAL'].includes(clean)) return 'URGENT';
    if (['HIGH', 'TINGGI', 'PENTING'].includes(clean)) return 'HIGH';
    if (['LOW', 'RENDAH', 'SANTAI'].includes(clean)) return 'LOW';
    return 'MEDIUM';
}

/**
 * Mendapatkan ikon badge untuk prioritas
 */
function getPriorityBadge(priority) {
    const norm = normalizePriority(priority);
    switch (norm) {
        case 'URGENT':
            return '🔴 [URGENT]';
        case 'HIGH':
            return '🟠 [HIGH]';
        case 'MEDIUM':
            return '🟡 [MED]';
        case 'LOW':
            return '🟢 [LOW]';
        default:
            return '⚪ [MED]';
    }
}

/**
 * 1. Membuat Jadwal Baru
 */
async function createSchedule(userId, { title, description = null, startTime, endTime = null, location = null, priority = 'MEDIUM' }) {
    if (!userId || !title || !startTime) {
        throw new Error('userId, title, dan startTime wajib diisi untuk membuat jadwal.');
    }

    const normPriority = normalizePriority(priority);
    const sql = `
        INSERT INTO schedules (user_id, title, description, start_time, end_time, location, priority, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'SCHEDULED', NOW(), NOW())
        RETURNING *;
    `;
    const res = await db.query(sql, [
        userId,
        title.trim(),
        description ? description.trim() : null,
        startTime,
        endTime || null,
        location ? location.trim() : null,
        normPriority,
    ]);
    return res.rows[0];
}

/**
 * 2. Mengambil Daftar Jadwal Pengguna
 * @param {string} userId
 * @param {object} options - { date, status, limit, upcomingOnly }
 */
async function getUserSchedules(userId, options = {}) {
    if (!userId) return [];

    const { date, status, limit = 20, upcomingOnly = false } = options;
    const params = [userId];
    let whereClauses = ['user_id = $1', 'deleted_at IS NULL'];

    if (status) {
        params.push(status.toUpperCase());
        whereClauses.push(`status = $${params.length}`);
    }

    if (date) {
        params.push(date);
        whereClauses.push(`(start_time AT TIME ZONE 'Asia/Jakarta')::date = ($${params.length})::date`);
    } else if (upcomingOnly) {
        whereClauses.push(`start_time >= NOW()`);
    }

    params.push(limit);
    const sql = `
        SELECT *
        FROM schedules
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY start_time ASC
        LIMIT $${params.length};
    `;

    const res = await db.query(sql, params);
    return res.rows;
}

/**
 * 3. Mengambil Jadwal Hari Ini (WIB)
 */
async function getTodaySchedules(userId) {
    if (!userId) return [];
    const sql = `
        SELECT *
        FROM schedules
        WHERE user_id = $1 
          AND deleted_at IS NULL 
          AND status IN ('SCHEDULED', 'ONGOING')
          AND (start_time AT TIME ZONE 'Asia/Jakarta')::date = (NOW() AT TIME ZONE 'Asia/Jakarta')::date
        ORDER BY 
            CASE priority 
                WHEN 'URGENT' THEN 1 
                WHEN 'HIGH' THEN 2 
                WHEN 'MEDIUM' THEN 3 
                ELSE 4 
            END,
            start_time ASC;
    `;
    const res = await db.query(sql, [userId]);
    return res.rows;
}

/**
 * 4. Mengambil Jadwal Besok (WIB)
 */
async function getTomorrowSchedules(userId) {
    if (!userId) return [];
    const sql = `
        SELECT *
        FROM schedules
        WHERE user_id = $1 
          AND deleted_at IS NULL 
          AND status = 'SCHEDULED'
          AND (start_time AT TIME ZONE 'Asia/Jakarta')::date = ((NOW() AT TIME ZONE 'Asia/Jakarta') + INTERVAL '1 day')::date
        ORDER BY start_time ASC;
    `;
    const res = await db.query(sql, [userId]);
    return res.rows;
}

/**
 * 5. Update Jadwal
 */
async function updateSchedule(scheduleId, userId, fields = {}) {
    if (!scheduleId || !userId) return null;

    const setClauses = ['updated_at = NOW()'];
    const params = [scheduleId, userId];

    if (fields.title) {
        params.push(fields.title.trim());
        setClauses.push(`title = $${params.length}`);
    }
    if (fields.description !== undefined) {
        params.push(fields.description ? fields.description.trim() : null);
        setClauses.push(`description = $${params.length}`);
    }
    if (fields.startTime) {
        params.push(fields.startTime);
        setClauses.push(`start_time = $${params.length}`);
    }
    if (fields.endTime !== undefined) {
        params.push(fields.endTime || null);
        setClauses.push(`end_time = $${params.length}`);
    }
    if (fields.location !== undefined) {
        params.push(fields.location ? fields.location.trim() : null);
        setClauses.push(`location = $${params.length}`);
    }
    if (fields.priority) {
        params.push(normalizePriority(fields.priority));
        setClauses.push(`priority = $${params.length}`);
    }
    if (fields.status) {
        params.push(fields.status.toUpperCase());
        setClauses.push(`status = $${params.length}`);
    }

    const sql = `
        UPDATE schedules
        SET ${setClauses.join(', ')}
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING *;
    `;

    const res = await db.query(sql, params);
    return res.rows[0] || null;
}

/**
 * 6. Soft Delete Jadwal
 */
async function deleteSchedule(scheduleId, userId) {
    if (!scheduleId || !userId) return false;
    const sql = `
        UPDATE schedules
        SET deleted_at = NOW(), status = 'CANCELLED', updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING id;
    `;
    const res = await db.query(sql, [scheduleId, userId]);
    return res.rowCount > 0;
}

/**
 * 7. Format Teks Daftar Jadwal (Bisa untuk WhatsApp maupun Discord)
 */
function formatSchedulesListText(schedules, titleHeader = '📅 DAFTAR JADWAL & AGENDA') {
    if (!schedules || schedules.length === 0) {
        return `📅 Belum ada jadwal atau agenda kegiatan yang tercatat.`;
    }

    let out = `**${titleHeader}** (Total: ${schedules.length})\n\n`;
    schedules.forEach((s, idx) => {
        const badge = getPriorityBadge(s.priority);
        const startDate = new Date(s.start_time);
        
        const dateStr = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            weekday: 'short',
            day: 'numeric',
            month: 'short',
        }).format(startDate);

        const startTimeStr = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(startDate);

        let timeSpan = `${dateStr}, ${startTimeStr} WIB`;
        if (s.end_time) {
            const endTimeStr = new Intl.DateTimeFormat('id-ID', {
                timeZone: 'Asia/Jakarta',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(new Date(s.end_time));
            timeSpan += ` - ${endTimeStr} WIB`;
        }

        const locStr = s.location ? ` | 📍 *${s.location}*` : '';
        const descStr = s.description ? `\n   └ 💬 _${s.description}_` : '';

        out += `${idx + 1}. ${badge} **${s.title}**\n   └ ⏰ \`${timeSpan}\`${locStr}${descStr}\n`;
    });

    return out;
}

module.exports = {
    normalizePriority,
    getPriorityBadge,
    createSchedule,
    getUserSchedules,
    getTodaySchedules,
    getTomorrowSchedules,
    updateSchedule,
    deleteSchedule,
    formatSchedulesListText,
};
