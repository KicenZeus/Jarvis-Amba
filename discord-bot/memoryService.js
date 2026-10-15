const db = require('./db');

/**
 * Memastikan user terdaftar di tabel users
 */
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
 * Menyimpan atau memperbarui memori jangka panjang pengguna (UPSERT)
 */
async function saveMemory(userId, type, key, value, importance = 3, source = 'USER_EXPLICIT', displayName = null) {
    if (!userId || !key || !value) {
        throw new Error('userId, key, dan value wajib diisi.');
    }

    await ensureUserExists(userId, displayName);

    const cleanType = (type || 'PREFERENCE').toUpperCase();
    const cleanKey = key.trim().toLowerCase();
    const cleanValue = value.trim();
    const clampedImportance = Math.max(1, Math.min(5, parseInt(importance, 10) || 3));

    const sql = `
        INSERT INTO memories (user_id, type, key, value, importance, source, status, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW())
        ON CONFLICT (user_id, key) DO UPDATE SET
            type = EXCLUDED.type,
            value = EXCLUDED.value,
            importance = EXCLUDED.importance,
            source = EXCLUDED.source,
            status = 'ACTIVE',
            updated_at = NOW()
        RETURNING *;
    `;

    const res = await db.query(sql, [userId, cleanType, cleanKey, cleanValue, clampedImportance, source]);
    return res.rows[0];
}

/**
 * Mengambil daftar memori aktif yang relevan untuk pengguna tertentu
 * Terisolasi ketat per user_id (mencegah memory leakage antar user)
 */
async function getRelevantMemories(userId, limit = 8) {
    if (!userId) return [];

    const sql = `
        SELECT type, key, value, importance
        FROM memories
        WHERE user_id = $1 AND status = 'ACTIVE'
        ORDER BY importance DESC, updated_at DESC
        LIMIT $2;
    `;

    const res = await db.query(sql, [userId, limit]);
    return res.rows;
}

/**
 * Menghapus / melupakan memori tertentu pengguna
 */
async function forgetMemory(userId, key) {
    if (!userId || !key) {
        throw new Error('userId dan key wajib disertakan.');
    }

    const cleanKey = key.trim().toLowerCase();
    const sql = `
        UPDATE memories
        SET status = 'DELETED', updated_at = NOW()
        WHERE user_id = $1 AND (key = $2 OR key ILIKE $3) AND status = 'ACTIVE'
        RETURNING *;
    `;

    const res = await db.query(sql, [userId, cleanKey, `%${cleanKey}%`]);
    return res.rows;
}

/**
 * Menampilkan semua memori aktif pengguna
 */
async function listMemories(userId) {
    if (!userId) return [];

    const sql = `
        SELECT id, type, key, value, importance, source, updated_at
        FROM memories
        WHERE user_id = $1 AND status = 'ACTIVE'
        ORDER BY type ASC, importance DESC, updated_at DESC;
    `;

    const res = await db.query(sql, [userId]);
    return res.rows;
}

/**
 * Mencatat log percakapan aktif ke tabel conversations (Short-Term Memory audit)
 */
async function recordConversation(userId, channelId, inputType, outputType, rawInput, rawOutput, metadata = {}) {
    if (!userId || !channelId) return null;

    try {
        const sql = `
            INSERT INTO conversations (user_id, channel_id, input_type, output_type, user_raw_input, agent_raw_output, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `;
        const res = await db.query(sql, [
            userId,
            channelId,
            inputType || 'TEXT',
            outputType || 'TEXT',
            rawInput || '',
            rawOutput || '',
            JSON.stringify(metadata || {}),
        ]);
        return res.rows[0];
    } catch (err) {
        console.error('⚠️ Gagal mencatat percakapan ke database:', err.message);
        return null;
    }
}

module.exports = {
    saveMemory,
    getRelevantMemories,
    forgetMemory,
    listMemories,
    recordConversation,
};
