/**
 * personalityService.js
 * Service Manajemen Kepribadian, Taksonomi Persona, dan Preferensi Kanal
 * Sesuai PRD V3 Phase 8 (Sec 59 - 64)
 */

const db = require('./db');

const VALID_CHANNELS = ['GLOBAL', 'DISCORD', 'WHATSAPP', 'ANDROID', 'IOS', 'WEB'];
const VALID_STYLES = ['CASUAL', 'FORMAL', 'FRIENDLY', 'TECHNICAL'];
const VALID_LENGTHS = ['SHORT', 'NORMAL', 'DETAILED'];
const VALID_AUTO_CAPTURE = ['AUTO_IF_CONFIDENT', 'CONFIRM_ALWAYS', 'DISABLED'];
const VALID_HUMOR = ['NONE', 'LOW', 'BALANCED', 'WITTY'];
const VALID_RESPONSE_TYPES = ['TEXT', 'VOICE', 'AUTO'];

const DEFAULT_PREFERENCES = {
    response_style: 'CASUAL',
    response_length: 'NORMAL',
    auto_capture_policy: 'AUTO_IF_CONFIDENT',
    tone: 'Tenang',
    humor_level: 'BALANCED',
    language: 'id-ID',
    default_response_type: 'TEXT',
    custom_prompt_instructions: null,
    metadata: {},
};

/**
 * Normalisasi channel identifier menjadi channel_type kanonik
 * @param {string|null} channel
 * @returns {string} GLOBAL, DISCORD, WHATSAPP, ANDROID, IOS, atau WEB
 */
function normalizeChannelType(channel) {
    if (!channel) return 'GLOBAL';
    const upper = String(channel).trim().toUpperCase();
    if (VALID_CHANNELS.includes(upper)) return upper;
    if (upper.startsWith('WA_') || upper === 'WA') return 'WHATSAPP';
    if (upper === 'APP' || upper === 'MOBILE') return 'ANDROID';
    return 'GLOBAL';
}

/**
 * Menyelesaikan (resolve) preferensi kepribadian user berdasarkan hierarki:
 * Channel Override > Global Preferences > Defaults
 * Serta mengambil callsign dari tabel users.
 *
 * @param {string} userId ID kanonik pengguna
 * @param {string|null} channelType Jenis saluran (DISCORD, WHATSAPP, ANDROID, WEB, dll)
 * @returns {Promise<Object>} Preferensi persona teresolusi
 */
async function resolveUserPersonality(userId, channelType = 'GLOBAL') {
    const canonicalChannel = normalizeChannelType(channelType);
    let channelRow = null;
    let globalRow = null;
    let userRow = null;

    if (userId) {
        try {
            // Ambil preferensi spesifik channel dan global dalam 1 query
            const prefRes = await db.query(
                `SELECT channel_type, response_style, response_length, auto_capture_policy, 
                        tone, humor_level, language, default_response_type, 
                        custom_prompt_instructions, metadata
                 FROM user_preferences
                 WHERE user_id = $1 AND channel_type IN ($2, 'GLOBAL')
                 ORDER BY (CASE WHEN channel_type = $2 THEN 1 ELSE 2 END) ASC;`,
                [userId, canonicalChannel]
            );

            for (const row of prefRes.rows) {
                if (row.channel_type === canonicalChannel && canonicalChannel !== 'GLOBAL') {
                    channelRow = row;
                } else if (row.channel_type === 'GLOBAL') {
                    globalRow = row;
                }
            }

            // Ambil callsign & display_name dari users
            const uRes = await db.query(
                'SELECT callsign, display_name FROM users WHERE id = $1 LIMIT 1;',
                [userId]
            );
            if (uRes.rows.length > 0) {
                userRow = uRes.rows[0];
            }
        } catch (err) {
            console.warn('[personalityService] Gagal mengambil preferensi:', err.message);
        }
    }

    const baseSource = channelRow || globalRow || {};
    const fallbackSource = globalRow || {};

    const resolved = {
        userId,
        channel_type: canonicalChannel,
        response_style: channelRow?.response_style || fallbackSource.response_style || DEFAULT_PREFERENCES.response_style,
        response_length: channelRow?.response_length || fallbackSource.response_length || DEFAULT_PREFERENCES.response_length,
        tone: channelRow?.tone || fallbackSource.tone || DEFAULT_PREFERENCES.tone,
        humor_level: channelRow?.humor_level || fallbackSource.humor_level || DEFAULT_PREFERENCES.humor_level,
        language: channelRow?.language || fallbackSource.language || DEFAULT_PREFERENCES.language,
        default_response_type: channelRow?.default_response_type || fallbackSource.default_response_type || DEFAULT_PREFERENCES.default_response_type,
        auto_capture_policy: fallbackSource.auto_capture_policy || DEFAULT_PREFERENCES.auto_capture_policy, // auto_capture is global only
        custom_prompt_instructions: channelRow?.custom_prompt_instructions || fallbackSource.custom_prompt_instructions || null,
        callsign: userRow?.callsign || null,
        displayName: userRow?.display_name || null,
        hasChannelOverride: !!channelRow,
    };

    return resolved;
}

/**
 * Menyusun blok instruksi sistem untuk Gemini berdasarkan taksonomi persona V3 (Sec 60)
 * @param {Object} personality Hasil dari resolveUserPersonality
 * @returns {string} Blok teks pedoman persona
 */
function buildPersonalitySystemInstruction(personality) {
    const {
        response_style,
        response_length,
        tone,
        humor_level,
        language,
        callsign,
        displayName,
        custom_prompt_instructions,
        channel_type,
    } = personality;

    // 1. Gaya Bahasa (PRD Sec 60)
    let styleGuideline = '';
    switch (response_style) {
        case 'FORMAL':
            styleGuideline = 'GAYA BAHASA (FORMAL): Baku, sopan, profesional, dan berwibawa. Gunakan tata bahasa rapi dan santun.';
            break;
        case 'FRIENDLY':
            styleGuideline = 'GAYA BAHASA (FRIENDLY): Hangat, suportif, ramah, penuh perhatian dan antusiasme positif.';
            break;
        case 'TECHNICAL':
            styleGuideline = 'GAYA BAHASA (TECHNICAL): Langsung pada inti (to-the-point), analitis, ringkas, minim basa-basi, fokus pada data dan solusi teknis.';
            break;
        case 'CASUAL':
        default:
            styleGuideline = 'GAYA BAHASA (CASUAL): Santai, luwes, akrab, dan bersahabat. Tidak kaku atau terlalu protokoler.';
            break;
    }

    // 2. Panjang Respon (PRD Sec 60)
    let lengthGuideline = '';
    switch (response_length) {
        case 'SHORT':
            lengthGuideline = 'PANJANG JAWABAN (SHORT): Jawaban kilat dan sangat ringkas (1-2 kalimat). Langsung ke intinya tanpa kalimat pengantar panjang.';
            break;
        case 'DETAILED':
            lengthGuideline = 'PANJANG JAWABAN (DETAILED): Rinci, mendalam, dan komprehensif. Uraikan dengan poin-poin penjelasan lengkap dan contoh relevan jika berguna.';
            break;
        case 'NORMAL':
        default:
            lengthGuideline = 'PANJANG JAWABAN (NORMAL): Standar, jelas, informatif, dan proporsional.';
            break;
    }

    // 3. Humor Level (PRD Sec 60)
    let humorGuideline = '';
    switch (humor_level) {
        case 'NONE':
            humorGuideline = 'TINGKAT HUMOR: Tidak ada lelucon. Jawab secara serius dan fokus.';
            break;
        case 'LOW':
            humorGuideline = 'TINGKAT HUMOR: Sangat minimal, hanya jika situasinya benar-benar santai.';
            break;
        case 'WITTY':
            humorGuideline = 'TINGKAT HUMOR: Cerdas, jenaka, dan suka menyelipkan candaan cerdas yang menyenangkan.';
            break;
        case 'BALANCED':
        default:
            humorGuideline = 'TINGKAT HUMOR: Seimbang, sesekali selipkan sentuhan humor ringan yang wajar.';
            break;
    }

    // 4. Bahasa Komunikasi
    const langGuideline = language === 'en-US'
        ? 'BAHASA UTAMA: Gunakan Bahasa Inggris (English) dalam semua jawaban.'
        : 'BAHASA UTAMA: Gunakan Bahasa Indonesia yang natural.';

    // 5. Nada Suasana (Tone)
    const toneGuideline = `NADA BICARA (TONE): ${tone || 'Tenang'}.`;

    // 6. Sapaan & Callsign
    let greetingGuideline = '';
    if (callsign) {
        greetingGuideline = `PANGGILAN KHUSUS: Pengguna meminta dipanggil "${callsign}". Gunakan panggilan "${callsign}" secara konsisten.`;
    } else if (displayName) {
        greetingGuideline = `PANGGILAN PENGGUNA: Sapa pengguna dengan namanya "${displayName}". Jangan gunakan panggilan "Bos" kecuali diminta.`;
    }

    // 7. Custom Instructions
    const customGuideline = custom_prompt_instructions
        ? `\nINSTRUKSI KHUSUS TAMBAHAN PENGGUNA:\n${custom_prompt_instructions}`
        : '';

    return `
[PEDOMAN KEPRIBADIAN & GAYA RESPON (Channel: ${channel_type})]:
- ${styleGuideline}
- ${lengthGuideline}
- ${toneGuideline}
- ${humorGuideline}
- ${langGuideline}
${greetingGuideline ? `- ${greetingGuideline}` : ''}${customGuideline}`.trim();
}

/**
 * Mengambil seluruh data preferensi pengguna: global, override tiap channel, callsign, dan preferensi voice
 * @param {string} userId
 */
async function getUserPreferencesSummary(userId) {
    const prefRes = await db.query(
        `SELECT id, channel_type, response_style, response_length, auto_capture_policy, 
                tone, humor_level, language, default_response_type, 
                custom_prompt_instructions, metadata, updated_at
         FROM user_preferences
         WHERE user_id = $1
         ORDER BY (CASE WHEN channel_type = 'GLOBAL' THEN 0 ELSE 1 END), channel_type;`,
        [userId]
    );

    let global = null;
    const channels = {};

    for (const row of prefRes.rows) {
        if (row.channel_type === 'GLOBAL') {
            global = row;
        } else {
            channels[row.channel_type] = row;
        }
    }

    if (!global) {
        global = {
            channel_type: 'GLOBAL',
            ...DEFAULT_PREFERENCES,
        };
    }

    // Ambil data user
    const uRes = await db.query(
        'SELECT id, display_name, callsign FROM users WHERE id = $1 LIMIT 1;',
        [userId]
    );
    const user = uRes.rows[0] || {};

    // Ambil preferensi suara Edge TTS (terisolasi sesuai PRD Sec 60)
    let voice = null;
    try {
        const vRes = await db.query(
            'SELECT voice_id, language, speed, style, enabled FROM user_voice_preferences WHERE user_id = $1 LIMIT 1;',
            [userId]
        );
        if (vRes.rows.length > 0) {
            voice = vRes.rows[0];
        }
    } catch (_) {}

    return {
        user_id: userId,
        callsign: user.callsign || null,
        display_name: user.display_name || null,
        global,
        channels,
        voice_preferences: voice,
    };
}

/**
 * Menyimpan / memperbarui preferensi global
 * @param {string} userId
 * @param {Object} data
 */
async function updateGlobalPreferences(userId, data = {}) {
    const {
        response_style,
        response_length,
        auto_capture_policy,
        tone,
        humor_level,
        language,
        default_response_type,
        custom_prompt_instructions,
        metadata,
        callsign,
    } = data;

    // Validasi
    if (response_style && !VALID_STYLES.includes(response_style)) {
        throw new Error(`response_style tidak valid. Pilihan: ${VALID_STYLES.join(', ')}`);
    }
    if (response_length && !VALID_LENGTHS.includes(response_length)) {
        throw new Error(`response_length tidak valid. Pilihan: ${VALID_LENGTHS.join(', ')}`);
    }
    if (auto_capture_policy && !VALID_AUTO_CAPTURE.includes(auto_capture_policy)) {
        throw new Error(`auto_capture_policy tidak valid. Pilihan: ${VALID_AUTO_CAPTURE.join(', ')}`);
    }
    if (humor_level && !VALID_HUMOR.includes(humor_level)) {
        throw new Error(`humor_level tidak valid. Pilihan: ${VALID_HUMOR.join(', ')}`);
    }
    if (default_response_type && !VALID_RESPONSE_TYPES.includes(default_response_type)) {
        throw new Error(`default_response_type tidak valid. Pilihan: ${VALID_RESPONSE_TYPES.join(', ')}`);
    }

    const query = `
        INSERT INTO user_preferences (
            user_id, channel_type, response_style, response_length, 
            auto_capture_policy, tone, humor_level, language, 
            default_response_type, custom_prompt_instructions, metadata, updated_at
        )
        VALUES (
            $1, 'GLOBAL',
            COALESCE($2, 'CASUAL'),
            COALESCE($3, 'NORMAL'),
            COALESCE($4, 'AUTO_IF_CONFIDENT'),
            COALESCE($5, 'Tenang'),
            COALESCE($6, 'BALANCED'),
            COALESCE($7, 'id-ID'),
            COALESCE($8, 'TEXT'),
            $9,
            COALESCE($10, '{}'::jsonb),
            NOW()
        )
        ON CONFLICT (user_id, channel_type) DO UPDATE SET
            response_style = COALESCE($2, user_preferences.response_style),
            response_length = COALESCE($3, user_preferences.response_length),
            auto_capture_policy = COALESCE($4, user_preferences.auto_capture_policy),
            tone = COALESCE($5, user_preferences.tone),
            humor_level = COALESCE($6, user_preferences.humor_level),
            language = COALESCE($7, user_preferences.language),
            default_response_type = COALESCE($8, user_preferences.default_response_type),
            custom_prompt_instructions = CASE WHEN $9 IS NOT NULL THEN $9 ELSE user_preferences.custom_prompt_instructions END,
            metadata = CASE WHEN $10 IS NOT NULL THEN $10 ELSE user_preferences.metadata END,
            updated_at = NOW()
        RETURNING *;
    `;

    const res = await db.query(query, [
        userId,
        response_style || null,
        response_length || null,
        auto_capture_policy || null,
        tone || null,
        humor_level || null,
        language || null,
        default_response_type || null,
        custom_prompt_instructions !== undefined ? custom_prompt_instructions : null,
        metadata ? JSON.stringify(metadata) : null,
    ]);

    // Update callsign di users jika disediakan
    if (callsign !== undefined) {
        await db.query(
            'UPDATE users SET callsign = $1, updated_at = NOW() WHERE id = $2;',
            [callsign ? String(callsign).trim() : null, userId]
        );
    }

    return res.rows[0];
}

/**
 * Menyimpan / memperbarui override preferensi spesifik channel
 * @param {string} userId
 * @param {string} channelType
 * @param {Object} data
 */
async function updateChannelPreferences(userId, channelType, data = {}) {
    const canonicalChannel = normalizeChannelType(channelType);
    if (canonicalChannel === 'GLOBAL') {
        return updateGlobalPreferences(userId, data);
    }

    const {
        response_style,
        response_length,
        tone,
        humor_level,
        language,
        default_response_type,
        custom_prompt_instructions,
        metadata,
    } = data;

    if (response_style && !VALID_STYLES.includes(response_style)) {
        throw new Error(`response_style tidak valid. Pilihan: ${VALID_STYLES.join(', ')}`);
    }
    if (response_length && !VALID_LENGTHS.includes(response_length)) {
        throw new Error(`response_length tidak valid. Pilihan: ${VALID_LENGTHS.join(', ')}`);
    }
    if (humor_level && !VALID_HUMOR.includes(humor_level)) {
        throw new Error(`humor_level tidak valid. Pilihan: ${VALID_HUMOR.join(', ')}`);
    }
    if (default_response_type && !VALID_RESPONSE_TYPES.includes(default_response_type)) {
        throw new Error(`default_response_type tidak valid. Pilihan: ${VALID_RESPONSE_TYPES.join(', ')}`);
    }

    // Ambil preferensi global user agar nilai yang tidak di-override mewarisi setting global user
    const gRes = await db.query(
        "SELECT * FROM user_preferences WHERE user_id = $1 AND channel_type = 'GLOBAL';",
        [userId]
    );
    const g = gRes.rows[0] || {};

    const effectiveStyle = response_style || g.response_style || 'CASUAL';
    const effectiveLength = response_length || g.response_length || 'NORMAL';
    const effectiveTone = tone !== undefined ? tone : (g.tone || 'Tenang');
    const effectiveHumor = humor_level || g.humor_level || 'BALANCED';
    const effectiveLang = language || g.language || 'id-ID';
    const effectiveRespType = default_response_type || g.default_response_type || 'TEXT';

    // Pada channel selain GLOBAL, auto_capture_policy dibatasi default 'AUTO_IF_CONFIDENT' oleh check constraint
    const query = `
        INSERT INTO user_preferences (
            user_id, channel_type, response_style, response_length, 
            auto_capture_policy, tone, humor_level, language, 
            default_response_type, custom_prompt_instructions, metadata, updated_at
        )
        VALUES (
            $1, $2,
            $3, $4, 'AUTO_IF_CONFIDENT', $5, $6, $7, $8, $9,
            COALESCE($10, '{}'::jsonb),
            NOW()
        )
        ON CONFLICT (user_id, channel_type) DO UPDATE SET
            response_style = COALESCE($3, user_preferences.response_style),
            response_length = COALESCE($4, user_preferences.response_length),
            tone = COALESCE($5, user_preferences.tone),
            humor_level = COALESCE($6, user_preferences.humor_level),
            language = COALESCE($7, user_preferences.language),
            default_response_type = COALESCE($8, user_preferences.default_response_type),
            custom_prompt_instructions = CASE WHEN $9 IS NOT NULL THEN $9 ELSE user_preferences.custom_prompt_instructions END,
            metadata = CASE WHEN $10 IS NOT NULL THEN $10 ELSE user_preferences.metadata END,
            updated_at = NOW()
        RETURNING *;
    `;

    const res = await db.query(query, [
        userId,
        canonicalChannel,
        effectiveStyle,
        effectiveLength,
        effectiveTone,
        effectiveHumor,
        effectiveLang,
        effectiveRespType,
        custom_prompt_instructions !== undefined ? custom_prompt_instructions : null,
        metadata ? JSON.stringify(metadata) : null,
    ]);

    return res.rows[0];
}

/**
 * Menghapus preferensi channel override agar kembali ke global
 * @param {string} userId
 * @param {string} channelType
 */
async function deleteChannelPreferences(userId, channelType) {
    const canonicalChannel = normalizeChannelType(channelType);
    if (canonicalChannel === 'GLOBAL') {
        throw new Error('Preferensi GLOBAL tidak dapat dihapus, gunakan pembaruan (update).');
    }

    const res = await db.query(
        'DELETE FROM user_preferences WHERE user_id = $1 AND channel_type = $2 RETURNING id;',
        [userId, canonicalChannel]
    );

    return {
        deleted: res.rowCount > 0,
        channel_type: canonicalChannel,
    };
}

module.exports = {
    VALID_CHANNELS,
    VALID_STYLES,
    VALID_LENGTHS,
    VALID_AUTO_CAPTURE,
    VALID_HUMOR,
    VALID_RESPONSE_TYPES,
    DEFAULT_PREFERENCES,
    normalizeChannelType,
    resolveUserPersonality,
    buildPersonalitySystemInstruction,
    getUserPreferencesSummary,
    updateGlobalPreferences,
    updateChannelPreferences,
    deleteChannelPreferences,
};
