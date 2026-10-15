const db = require('./db');

const AVAILABLE_VOICES = {
    ardi: {
        id: 'id-ID-ArdiNeural',
        name: 'Ardi',
        gender: 'Pria',
        language: 'Bahasa Indonesia',
        desc: 'Suara pria santai, hangat, dan natural (Default Jarvis)',
    },
    gadis: {
        id: 'id-ID-GadisNeural',
        name: 'Gadis',
        gender: 'Wanita',
        language: 'Bahasa Indonesia',
        desc: 'Suara wanita lembut, ramah, dan bersahabat',
    },
    guy: {
        id: 'en-US-GuyNeural',
        name: 'Guy',
        gender: 'Male',
        language: 'English (US)',
        desc: 'English male voice, casual and confident',
    },
    jenny: {
        id: 'en-US-JennyNeural',
        name: 'Jenny',
        gender: 'Female',
        language: 'English (US)',
        desc: 'English female voice, clear and professional',
    },
};

const DEFAULT_PREFERENCE = {
    voice_id: 'id-ID-ArdiNeural',
    language: 'id-ID',
    speed: '+0%',
    style: 'CASUAL',
    enabled: true,
};

/**
 * Memastikan user terdaftar sebelum menyimpan preferensi
 */
async function ensureUserExists(userId) {
    const sql = `
        INSERT INTO users (id, discord_user_id, display_name, status, role, updated_at)
        VALUES ($1, $1, $2, 'ACTIVE', 'USER', NOW())
        ON CONFLICT (id) DO NOTHING;
    `;
    await db.query(sql, [userId, `User_${userId}`]);
}

/**
 * Mengambil preferensi suara pengguna
 */
async function getUserVoicePreference(userId) {
    if (!userId) return { ...DEFAULT_PREFERENCE };

    try {
        const sql = `
            SELECT voice_id, language, speed, style, enabled 
            FROM user_voice_preferences 
            WHERE user_id = $1;
        `;
        const res = await db.query(sql, [userId]);
        if (res.rowCount > 0) {
            return res.rows[0];
        }
        return { ...DEFAULT_PREFERENCE };
    } catch (err) {
        console.warn('⚠️ Gagal mengambil user_voice_preferences, menggunakan default:', err.message);
        return { ...DEFAULT_PREFERENCE };
    }
}

/**
 * Menyimpan / memperbarui preferensi suara pengguna (UPSERT)
 */
async function setUserVoicePreference(userId, options = {}) {
    if (!userId) throw new Error('userId wajib diisi.');

    await ensureUserExists(userId);

    const voiceId = options.voice_id || DEFAULT_PREFERENCE.voice_id;
    const language = options.language || DEFAULT_PREFERENCE.language;
    const speed = options.speed || DEFAULT_PREFERENCE.speed;
    const style = (options.style || DEFAULT_PREFERENCE.style).toUpperCase();
    const enabled = options.enabled !== undefined ? options.enabled : true;

    const sql = `
        INSERT INTO user_voice_preferences (user_id, voice_id, language, speed, style, enabled, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            voice_id = EXCLUDED.voice_id,
            language = EXCLUDED.language,
            speed = EXCLUDED.speed,
            style = EXCLUDED.style,
            enabled = EXCLUDED.enabled,
            updated_at = NOW()
        RETURNING *;
    `;
    const res = await db.query(sql, [userId, voiceId, language, speed, style, enabled]);
    return res.rows[0];
}

module.exports = {
    AVAILABLE_VOICES,
    DEFAULT_PREFERENCE,
    getUserVoicePreference,
    setUserVoicePreference,
};
