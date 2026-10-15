const db = require('./db');

// Map untuk menyimpan konfirmasi aksi berisiko tinggi (High Risk Actions)
// userId -> { actionType, payload, expiresAt }
const pendingConfirmations = new Map();

async function ensureUserExists(userId, displayName = null) {
    const name = displayName || `User_${userId}`;
    const sql = `
        INSERT INTO users (id, discord_user_id, display_name, status, role, updated_at)
        VALUES ($1, $1, $2, 'ACTIVE', 'USER', NOW())
        ON CONFLICT (id) DO UPDATE SET
            display_name = COALESCE(EXCLUDED.display_name, users.display_name),
            updated_at = NOW();
    `;
    await db.query(sql, [userId, name]);
}

/**
 * Memulai pencatatan Agent Run baru
 */
async function startAgentRun(userId, conversationId = null, intent = '', metadata = {}, displayName = null) {
    if (!userId) return null;

    try {
        await ensureUserExists(userId, displayName);

        const safeIntent = typeof intent === 'string' ? intent.substring(0, 1000) : '';
        const sql = `
            INSERT INTO agent_runs (user_id, conversation_id, intent, status, metadata, started_at)
            VALUES ($1, $2, $3, 'RUNNING', $4, NOW())
            RETURNING id;
        `;
        const res = await db.query(sql, [userId, conversationId, safeIntent, JSON.stringify(metadata || {})]);
        return res.rows[0]?.id || null;
    } catch (err) {
        console.error('⚠️ Gagal membuat agent_run:', err.message);
        return null;
    }
}

/**
 * Mencatat pemanggilan tool oleh Agent
 */
async function recordToolCall(agentRunId, toolName, args = {}, result = null, status = 'COMPLETED', error = null) {
    if (!agentRunId || !toolName) return null;

    try {
        const sql = `
            INSERT INTO tool_calls (agent_run_id, tool_name, arguments, result, status, error, completed_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id;
        `;
        const res = await db.query(sql, [
            agentRunId,
            toolName,
            JSON.stringify(args || {}),
            result ? JSON.stringify(result) : null,
            status,
            error,
        ]);
        return res.rows[0]?.id || null;
    } catch (err) {
        console.error('⚠️ Gagal mencatat tool_call:', err.message);
        return null;
    }
}

/**
 * Menyelesaikan lifecycle Agent Run
 */
async function finishAgentRun(agentRunId, status = 'COMPLETED', error = null, additionalMetadata = {}) {
    if (!agentRunId) return;

    try {
        const sql = `
            UPDATE agent_runs
            SET status = $2, error = $3, completed_at = NOW(),
                metadata = metadata || $4::jsonb
            WHERE id = $1;
        `;
        await db.query(sql, [agentRunId, status, error, JSON.stringify(additionalMetadata || {})]);
    } catch (err) {
        console.error('⚠️ Gagal memperbarui status agent_run:', err.message);
    }
}

/**
 * Mendeteksi apakah perintah termasuk aksi berisiko tinggi (High Risk Action)
 * Sesuai Section 27 & 28 PRD V2
 */
function isHighRiskAction(text) {
    if (!text) return null;
    const lower = text.toLowerCase();

    // 1. Hapus semua transaksi / keuangan massal
    if (/(\b(hapus|delete|bersihkan|reset)\s+(semua|seluruh|semuanya|total)\s+(transaksi|keuangan|pengeluaran|pemasukan)\b)|^reset\s+(transaksi|keuangan)\b/i.test(lower)) {
        return {
            type: 'DELETE_ALL_FINANCE',
            warning: 'Aksi ini akan menghapus seluruh catatan transaksi keuangan Bos.',
        };
    }

    // 2. Hapus semua tugas / todo massal
    if (/(\b(hapus|delete|bersihkan|reset)\s+(semua|seluruh|semuanya|total)\s+(tugas|todo|tasks)\b)|^reset\s+(tugas|todo|tasks)\b/i.test(lower)) {
        return {
            type: 'DELETE_ALL_TASKS',
            warning: 'Aksi ini akan menghapus seluruh daftar tugas dan todo list Bos.',
        };
    }

    // 3. Hapus semua memori / ingatan massal
    if (/(\b(hapus|delete|lupakan|reset)\s+(semua|seluruh|semuanya|total)\s+(memori|ingatan|memory)\b)|^reset\s+(memori|ingatan|memory)\b/i.test(lower)) {
        return {
            type: 'DELETE_ALL_MEMORIES',
            warning: 'Aksi ini akan menghapus seluruh catatan memori preferensi dan profil Bos.',
        };
    }

    return null;
}

/**
 * Mendaftarkan konfirmasi pending untuk user
 */
function setPendingConfirmation(userId, action) {
    pendingConfirmations.set(userId, {
        ...action,
        expiresAt: Date.now() + 60000, // Berlaku 60 detik
    });
}

/**
 * Mengambil & membersihkan konfirmasi pending jika valid
 */
function getPendingConfirmation(userId) {
    const pending = pendingConfirmations.get(userId);
    if (!pending) return null;

    if (Date.now() > pending.expiresAt) {
        pendingConfirmations.delete(userId);
        return null;
    }
    return pending;
}

function clearPendingConfirmation(userId) {
    pendingConfirmations.delete(userId);
}

module.exports = {
    startAgentRun,
    recordToolCall,
    finishAgentRun,
    isHighRiskAction,
    setPendingConfirmation,
    getPendingConfirmation,
    clearPendingConfirmation,
};
