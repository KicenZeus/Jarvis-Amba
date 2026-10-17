const db = require('./db');

/**
 * ==============================================================================
 * Phase 7: Security & Permissions Service (RBAC, Audit Logs, Credential Guard)
 * ==============================================================================
 */

// Tingkatan Role (Hierarchy)
const ROLES = {
    BLOCKED: {
        name: 'BLOCKED',
        level: 0,
        badge: '🚫 BLOCKED',
        color: 0xEF4444, // Red
        description: 'Akses diblokir sepenuhnya dari Jarvis.',
    },
    GUEST: {
        name: 'GUEST',
        level: 1,
        badge: '👤 GUEST',
        color: 0x9CA3AF, // Gray
        description: 'Tamu - Read-only chat, pencarian web umum, tanpa akses data persisten.',
    },
    USER: {
        name: 'USER',
        level: 2,
        badge: '⭐ USER',
        color: 0x3B82F6, // Blue
        description: 'Pengguna Reguler - Akses asisten pribadi (task, reminder, keuangan, memori, analitik).',
    },
    ADMIN: {
        name: 'ADMIN',
        level: 3,
        badge: '🛡️ ADMIN',
        color: 0x10B981, // Emerald
        description: 'Administrator - Pengecekan role, inspeksi audit log keamanan, status sistem.',
    },
    OWNER: {
        name: 'OWNER',
        level: 4,
        badge: '👑 OWNER',
        color: 0xF59E0B, // Amber / Gold
        description: 'Pemilik Sistem - Kontrol penuh (ubah role, shutdown/maintenance, reset data, audit lengkap).',
    },
};

// Matriks Izin Tool / Aksi
const TOOL_PERMISSIONS = {
    // OWNER Only
    'system.shutdown': 'OWNER',
    'system.reboot': 'OWNER',
    'system.clean_cache': 'OWNER',
    'role.assign': 'OWNER',
    'role.revoke': 'OWNER',
    'data.wipe_all': 'OWNER',
    'finance.delete_all': 'OWNER',
    'tasks.delete_all': 'OWNER',
    'memories.delete_all': 'OWNER',

    // ADMIN & OWNER
    'audit.view': 'ADMIN',
    'role.list': 'ADMIN',
    'role.check': 'ADMIN',
    'system.stats': 'ADMIN',

    // USER, ADMIN & OWNER
    'task.create': 'USER',
    'task.list': 'USER',
    'task.complete': 'USER',
    'task.update': 'USER',
    'task.delete': 'USER',
    'reminder.create': 'USER',
    'reminder.list': 'USER',
    'reminder.snooze': 'USER',
    'reminder.cancel': 'USER',
    'finance.add': 'USER',
    'finance.list': 'USER',
    'finance.summary': 'USER',
    'memory.save': 'USER',
    'memory.search': 'USER',
    'memory.forget': 'USER',
    'notes.create': 'USER',
    'notes.search': 'USER',
    'analytics.dashboard': 'USER',
    'voice.speak': 'USER',
    'music.play': 'USER',

    // GUEST and above
    'chat.talk': 'GUEST',
    'web.search': 'GUEST',
    'weather.get': 'GUEST',
    'help.view': 'GUEST',
};

// In-memory cache untuk performa cepat (TTL: 10 detik agar perubahan DB cepat terdeteksi)
// Key: userId -> { role: 'OWNER', expiresAt: timestamp }
const roleCache = new Map();
const CACHE_TTL_MS = 10 * 1000;

/**
 * Membersihkan token, kredensial, API key, dan password dari teks / objek secara rekursif
 */
function sanitizeSensitiveData(input) {
    if (input === null || input === undefined) return input;

    if (typeof input === 'string') {
        let sanitized = input;
        // 1. Redact Discord Bot Token format (approx 24.6.27-38 chars)
        sanitized = sanitized.replace(/([a-zA-Z0-9_\-]{24}\.[a-zA-Z0-9_\-]{6}\.[a-zA-Z0-9_\-]{27,})/g, '[DISCORD_TOKEN_REDACTED]');
        // 2. Redact Bot authorization header
        sanitized = sanitized.replace(/Bot\s+([a-zA-Z0-9._\-]{30,})/gi, 'Bot [REDACTED]');
        // 3. Redact Bearer token
        sanitized = sanitized.replace(/Bearer\s+([a-zA-Z0-9._\-]{15,})/gi, 'Bearer [REDACTED]');
        // 4. Redact OpenAI / Gemini / Groq API Keys
        sanitized = sanitized.replace(/sk-[a-zA-Z0-9]{20,}/g, '[OPENAI_KEY_REDACTED]');
        sanitized = sanitized.replace(/gsk_[a-zA-Z0-9]{20,}/g, '[GROQ_KEY_REDACTED]');
        sanitized = sanitized.replace(/AIza[a-zA-Z0-9_\-]{35}/g, '[GEMINI_KEY_REDACTED]');
        // 5. Redact PostgreSQL connection strings
        sanitized = sanitized.replace(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@/gi, 'postgres://$1:[PASS_REDACTED]@');
        // 6. Redact password/secret key-values in JSON or raw config
        sanitized = sanitized.replace(/(["']?(?:password|passwd|secret|bot_token|api_key|token)["']?\s*[:=]\s*["']?)([^"',\s\n}]+)/gi, '$1[REDACTED]');
        return sanitized;
    }

    if (Array.isArray(input)) {
        return input.map((item) => sanitizeSensitiveData(item));
    }

    if (typeof input === 'object') {
        const result = {};
        for (const [key, val] of Object.entries(input)) {
            // Jika nama key mengandung kata rahasia, redact langsung
            if (/password|secret|token|api_key|credential/i.test(key) && typeof val === 'string') {
                result[key] = '[REDACTED]';
            } else {
                result[key] = sanitizeSensitiveData(val);
            }
        }
        return result;
    }

    return input;
}

/**
 * Mencatat peristiwa ke tabel audit_logs
 */
async function logAudit({
    userId,
    action,
    resourceType = null,
    resourceId = null,
    riskLevel = 'LOW',
    status = 'SUCCESS',
    metadata = {},
    ipAddress = null,
}) {
    if (!userId || !action) return;

    try {
        const cleanMetadata = sanitizeSensitiveData(metadata);
        const sql = `
            INSERT INTO audit_logs (
                user_id, action, resource_type, resource_id, risk_level, status, metadata, ip_address, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING id;
        `;
        const res = await db.query(sql, [
            userId,
            action,
            resourceType,
            resourceId ? String(resourceId) : null,
            riskLevel,
            status,
            JSON.stringify(cleanMetadata || {}),
            ipAddress,
        ]);

        if (status === 'BLOCKED' || riskLevel === 'CRITICAL') {
            console.warn(`🚨 [AUDIT ${riskLevel}] User ${userId} action "${action}": ${status}`);
        }
        return res.rows[0]?.id || null;
    } catch (err) {
        console.error('⚠️ Gagal mencatat audit log:', err.message);
        return null;
    }
}

/**
 * Mengambil role seorang user berdasarkan ID
 * @param {string} userId - Discord User ID
 * @param {boolean} forceFresh - Jika true, lewati cache dan baca langsung dari database
 */
async function getUserRole(userId, forceFresh = false) {
    if (!userId) return ROLES.GUEST;

    // 1. Cek memory cache jika tidak dipaksa fresh
    if (!forceFresh) {
        const cached = roleCache.get(userId);
        if (cached && Date.now() < cached.expiresAt) {
            return ROLES[cached.role] || ROLES.USER;
        }
    }

    try {
        // 2. Cek developer/creator ID bawaan (kicenzeus)
        const isKnownDeveloper =
            userId === '713137141072396370' ||
            userId === '344840856006459392' ||
            userId === '6288991185737';

        // 3. Query role secara paralel dari user_roles, users, dan user_channels
        const [rRes, uRes, cRes] = await Promise.all([
            db.query('SELECT role FROM user_roles WHERE discord_user_id = $1 LIMIT 1;', [userId]),
            db.query('SELECT role, display_name FROM users WHERE discord_user_id = $1 OR id = $1 LIMIT 1;', [userId]),
            db.query('SELECT u.role, u.display_name FROM user_channels uc JOIN users u ON uc.user_id = u.id WHERE uc.external_user_id = $1 OR uc.phone_number = $1 LIMIT 1;', [userId]),
        ]);

        const rRole = (rRes.rows[0]?.role || '').toUpperCase();
        const uRole = (uRes.rows[0]?.role || '').toUpperCase();
        const cRole = (cRes.rows[0]?.role || '').toUpperCase();
        const displayName = uRes.rows[0]?.display_name || cRes.rows[0]?.display_name || '';

        // Tentukan kandidat role dengan prioritas hierarki
        let resolvedRoleName = null;

        if (isKnownDeveloper || /kicenzeus/i.test(displayName)) {
            resolvedRoleName = 'OWNER';
        } else if (rRole === 'OWNER' || uRole === 'OWNER' || cRole === 'OWNER') {
            resolvedRoleName = 'OWNER';
        } else if (rRole === 'ADMIN' || uRole === 'ADMIN' || cRole === 'ADMIN') {
            resolvedRoleName = 'ADMIN';
        } else if (rRole === 'BLOCKED' || uRole === 'BLOCKED' || cRole === 'BLOCKED') {
            resolvedRoleName = 'BLOCKED';
        } else if (rRole === 'USER' || uRole === 'USER' || cRole === 'USER') {
            resolvedRoleName = 'USER';
        } else if (rRole === 'GUEST' || uRole === 'GUEST' || cRole === 'GUEST') {
            resolvedRoleName = 'GUEST';
        }

        // Jika ditemukan role yang valid di database
        if (resolvedRoleName && ROLES[resolvedRoleName]) {
            const matchedRole = ROLES[resolvedRoleName];
            roleCache.set(userId, { role: matchedRole.name, expiresAt: Date.now() + CACHE_TTL_MS });
            return matchedRole;
        }

        // 4. Fallback jika belum terdaftar di DB:
        // Cek environment OWNER_DISCORD_ID / OWNER_USER_ID
        const envOwner = process.env.OWNER_DISCORD_ID || process.env.OWNER_USER_ID;
        if (envOwner && envOwner.trim() === userId) {
            await setUserRole(userId, 'OWNER', 'SYSTEM_ENV', 'Configured as OWNER via ENV');
            return ROLES.OWNER;
        }

        // User belum terdaftar di database -> DEFAULT KE GUEST (Level 1)
        // PENTING: Jangan otomatis insert sebagai USER ke DB agar tidak menuhin database & kuota
        roleCache.set(userId, { role: ROLES.GUEST.name, expiresAt: Date.now() + CACHE_TTL_MS });
        return ROLES.GUEST;
    } catch (err) {
        console.error('⚠️ Gagal mengambil user role dari DB:', err.message);
        return ROLES.GUEST;
    }
}

/**
 * Memeriksa apakah user memiliki hak akses OWNER utama
 * @param {string} userId - ID internal, snowflake discord, atau nomor phone
 * @returns {Promise<boolean>}
 */
async function isAuthorizedOwner(userId) {
    if (!userId) return false;
    const cleanId = String(userId).trim().replace(/\D/g, '');
    const OWNER_IDS = ['713137141072396370', '344840856006459392', '6288991185737'];
    if (OWNER_IDS.includes(String(userId).trim()) || OWNER_IDS.includes(cleanId)) {
        return true;
    }
    const roleObj = await getUserRole(userId);
    return roleObj.name === 'OWNER';
}

/**
 * Mengecek apakah user memiliki role setara atau lebih tinggi dari requiredRoleName
 */
async function hasMinimumRole(userId, requiredRoleName) {
    const userRole = await getUserRole(userId);
    const requiredRole = ROLES[requiredRoleName?.toUpperCase()] || ROLES.USER;
    if (userRole.name === 'BLOCKED') return false;
    return userRole.level >= requiredRole.level;
}

/**
 * Memperbarui role user (Hanya boleh dipanggil oleh OWNER atau Sistem)
 */
async function setUserRole(targetUserId, newRoleName, assignedByUserId = 'SYSTEM', notes = '') {
    if (assignedByUserId !== 'SYSTEM') {
        const isOwner = await isAuthorizedOwner(assignedByUserId);
        if (!isOwner) {
            return {
                success: false,
                message: '⛔ Hanya **OWNER** yang memiliki hak untuk mengubah role atau mendaftarkan pengguna baru!',
            };
        }
    }

    const upperRole = newRoleName?.toUpperCase();
    if (!ROLES[upperRole]) {
        return { success: false, message: `Role "${newRoleName}" tidak valid. Pilihan: OWNER, ADMIN, USER, GUEST, BLOCKED.` };
    }

    try {
        const cleanTarget = String(targetUserId).trim();
        const cleanPhone = cleanTarget.replace(/\D/g, '');

        // 1. Simpan ke tabel user_roles
        const sql = `
            INSERT INTO user_roles (discord_user_id, role, assigned_by, notes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (discord_user_id) DO UPDATE SET
                role = EXCLUDED.role,
                assigned_by = EXCLUDED.assigned_by,
                notes = EXCLUDED.notes,
                updated_at = NOW();
        `;
        await db.query(sql, [cleanTarget, upperRole, assignedByUserId, notes]);

        // 2. Update juga kolom role di tabel users jika ada
        await db.query(
            `UPDATE users SET role = $2, updated_at = NOW() 
             WHERE id = $1 OR discord_user_id = $1 
                OR id IN (SELECT user_id FROM user_channels WHERE external_user_id = $1 OR phone_number = $1 OR phone_number = $3)`,
            [cleanTarget, upperRole, cleanPhone]
        );

        // Invalidate cache
        roleCache.delete(cleanTarget);
        if (cleanPhone) roleCache.delete(cleanPhone);

        // Catat Audit Log
        await logAudit({
            userId: assignedByUserId,
            action: 'ROLE_UPDATE',
            resourceType: 'USER_ROLE',
            resourceId: cleanTarget,
            riskLevel: upperRole === 'OWNER' || upperRole === 'BLOCKED' ? 'HIGH' : 'MEDIUM',
            status: 'SUCCESS',
            metadata: { targetUserId: cleanTarget, newRole: upperRole, notes },
        });

        return {
            success: true,
            message: `✅ Role untuk user **${cleanTarget}** berhasil diubah menjadi **${upperRole}**.`,
        };
    } catch (err) {
        console.error('⚠️ Gagal menetapkan user role:', err.message);
        return { success: false, message: `Gagal memperbarui role: ${err.message}` };
    }
}

/**
 * Mendaftarkan pengguna baru secara resmi ke database oleh Owner
 */
async function registerNewUser({
    identifier,
    displayName,
    role = 'USER',
    assignedBy = 'SYSTEM',
    notes = '',
}) {
    if (assignedBy !== 'SYSTEM') {
        const isOwner = await isAuthorizedOwner(assignedBy);
        if (!isOwner) {
            return {
                success: false,
                message: '⛔ Hanya **OWNER** yang memiliki hak untuk mendaftarkan pengguna baru!',
            };
        }
    }

    const upperRole = String(role || 'USER').toUpperCase();
    if (!ROLES[upperRole]) {
        return { success: false, message: `Role "${role}" tidak valid. Pilihan: OWNER, ADMIN, USER.` };
    }

    const cleanId = String(identifier).trim();
    const isPhone = /^\+?[0-9]{8,16}$/.test(cleanId);
    const cleanPhone = isPhone ? cleanId.replace(/\D/g, '') : null;
    const internalUserId = isPhone ? `wa_${cleanPhone}` : cleanId;
    const finalName = displayName ? displayName.trim() : (isPhone ? `WA User ${cleanPhone}` : `User ${cleanId}`);

    try {
        // 1. Masukkan ke tabel users (internalUserId digunakan sebagai discord_user_id untuk WhatsApp guna memenuhi NOT NULL constraint)
        await db.query(
            `INSERT INTO users (id, discord_user_id, display_name, role, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET
                 display_name = COALESCE(EXCLUDED.display_name, users.display_name),
                 role = EXCLUDED.role,
                 status = 'ACTIVE',
                 updated_at = NOW();`,
            [internalUserId, internalUserId, finalName, upperRole]
        );

        // 2. Masukkan ke tabel user_channels
        if (isPhone) {
            await db.query(
                `INSERT INTO user_channels (user_id, channel_type, external_user_id, phone_number, display_name, status, is_primary, created_at, updated_at)
                 VALUES ($1, 'WHATSAPP', $2, $2, $3, 'ACTIVE', true, NOW(), NOW())
                 ON CONFLICT (channel_type, external_user_id) DO UPDATE SET
                     user_id = EXCLUDED.user_id,
                     status = 'ACTIVE',
                     display_name = EXCLUDED.display_name,
                     phone_number = EXCLUDED.phone_number,
                     updated_at = NOW();`,
                [internalUserId, cleanPhone, finalName]
            );
        } else {
            await db.query(
                `INSERT INTO user_channels (user_id, channel_type, external_user_id, display_name, status, is_primary, created_at, updated_at)
                 VALUES ($1, 'DISCORD', $2, $3, 'ACTIVE', true, NOW(), NOW())
                 ON CONFLICT (channel_type, external_user_id) DO UPDATE SET
                     user_id = EXCLUDED.user_id,
                     status = 'ACTIVE',
                     display_name = EXCLUDED.display_name,
                     updated_at = NOW();`,
                [internalUserId, cleanId, finalName]
            );
        }

        // 3. Masukkan ke tabel user_roles
        await db.query(
            `INSERT INTO user_roles (discord_user_id, role, assigned_by, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT (discord_user_id) DO UPDATE SET
                 role = EXCLUDED.role,
                 assigned_by = EXCLUDED.assigned_by,
                 notes = EXCLUDED.notes,
                 updated_at = NOW();`,
            [internalUserId, upperRole, assignedBy, notes || 'Registered by Owner']
        );

        roleCache.delete(cleanId);
        if (cleanPhone) roleCache.delete(cleanPhone);

        return {
            success: true,
            message: `🎉 Berhasil mendaftarkan pengguna baru:\n• Nama: **${finalName}**\n• ID/Nomor: \`${cleanId}\`\n• Platform: **${isPhone ? 'WHATSAPP' : 'DISCORD'}**\n• Role: **${upperRole}**`,
        };
    } catch (err) {
        console.error('⚠️ Gagal register new user:', err.message);
        return { success: false, message: `Gagal mendaftarkan user: ${err.message}` };
    }
}

/**
 * Mengambil daftar seluruh pengguna terdaftar beserta rolenya
 */
async function listAllUsersWithRoles() {
    try {
        const res = await db.query(`
            SELECT 
                u.id,
                u.display_name,
                u.callsign,
                u.role,
                u.status,
                uc.channel_type,
                uc.external_user_id,
                uc.phone_number,
                uc.last_seen_at
            FROM users u
            LEFT JOIN user_channels uc ON uc.user_id = u.id
            WHERE u.status = 'ACTIVE' AND uc.status = 'ACTIVE'
              AND uc.external_user_id NOT IN ('12345', 'test_user_kicen')
            ORDER BY 
                CASE u.role WHEN 'OWNER' THEN 1 WHEN 'ADMIN' THEN 2 WHEN 'USER' THEN 3 ELSE 4 END,
                u.created_at ASC;
        `);
        return res.rows;
    } catch (err) {
        console.error('⚠️ Gagal mengambil daftar user:', err.message);
        return [];
    }
}

/**
 * Menghapus/mengeluarkan pengguna dari database (Khusus OWNER)
 * Mencabut seluruh akses peran dan menghapus data pengguna agar tidak bisa mengakses bot lagi
 * @param {object} params
 * @param {string} params.identifier - Nomor WhatsApp, Discord ID, atau mention
 * @param {string} params.requestedBy - ID pemohon (Wajib OWNER)
 * @param {string} params.reason - Alasan penghapusan (opsional)
 * @returns {Promise<{ success: boolean, message: string, removedUser?: object }>}
 */
async function removeUser({ identifier, requestedBy, reason = 'Removed by Owner' }) {
    if (!identifier) {
        return { success: false, message: 'ID atau nomor kontak pengguna yang akan dihapus wajib diisi.' };
    }

    // 1. Validasi Pemohon: Hanya OWNER yang berhak menghapus pengguna
    const isOwner = await isAuthorizedOwner(requestedBy);
    if (!isOwner) {
        return { success: false, message: '⛔ Akses ditolak! Hanya **OWNER** yang memiliki wewenang untuk mengeluarkan/menghapus pengguna dari sistem.' };
    }

    // Bersihkan ID / mention
    const cleanId = String(identifier).trim().replace(/[<@!>]/g, '');
    const cleanDigits = cleanId.replace(/\D/g, '');
    const isPhone = /^\+?[0-9]{8,16}$/.test(cleanId) || (cleanDigits.length >= 8 && cleanDigits.length <= 16 && !cleanId.startsWith('wa_'));
    const phoneNum = isPhone ? cleanDigits : null;
    const internalWaId = phoneNum ? `wa_${phoneNum}` : (cleanId.startsWith('wa_') ? cleanId : null);

    // 2. Proteksi Mutlak Akun Owner (Jangan sampai owner terhapus sendiri)
    const isTargetOwner = await isAuthorizedOwner(cleanId) || (phoneNum && await isAuthorizedOwner(phoneNum)) || (internalWaId && await isAuthorizedOwner(internalWaId));
    if (isTargetOwner) {
        return { success: false, message: '⛔ Ditolak! Akun **OWNER** utama dilindungi sistem dan tidak dapat dihapus.' };
    }

    try {
        // 3. Cari user terlebih dahulu untuk konfirmasi data
        const findRes = await db.query(
            `SELECT u.id, u.display_name, u.role, uc.channel_type, uc.external_user_id, uc.phone_number
             FROM users u
             LEFT JOIN user_channels uc ON uc.user_id = u.id
             WHERE u.id = $1 
                OR u.discord_user_id = $1 
                OR uc.external_user_id = $1 
                OR uc.phone_number = $1
                OR ( $2::varchar IS NOT NULL AND (uc.phone_number = $2 OR uc.external_user_id = $2 OR u.id = $3) )
             LIMIT 1;`,
            [cleanId, phoneNum, internalWaId]
        );

        if (findRes.rowCount === 0) {
            return { success: false, message: `Pengguna dengan ID/Nomor \`${cleanId}\` tidak ditemukan dalam database.` };
        }

        const targetUser = findRes.rows[0];
        const targetUserId = targetUser.id;
        const targetName = targetUser.display_name || 'Pengguna';
        const targetRole = targetUser.role || 'USER';
        const targetContact = targetUser.phone_number || targetUser.external_user_id || cleanId;
        const channelType = targetUser.channel_type || (phoneNum ? 'WHATSAPP' : 'DISCORD');

        // 4. Hapus dari tabel pendukung
        await db.query(
            `DELETE FROM user_roles 
             WHERE discord_user_id = $1 OR discord_user_id = $2 OR discord_user_id = $3;`, 
            [targetUserId, cleanId, phoneNum || targetUserId]
        );

        await Promise.allSettled([
            db.query(`DELETE FROM tasks WHERE user_id = $1 OR user_id = $2;`, [targetUserId, cleanId]),
            db.query(`DELETE FROM reminders WHERE user_id = $1 OR user_id = $2;`, [targetUserId, cleanId]),
            db.query(`DELETE FROM finances WHERE user_id = $1 OR user_id = $2;`, [targetUserId, cleanId]),
        ]);

        // 5. Hapus dari tabel users (otomatis CASCADE ke user_channels, memories, conversations, dll.)
        await db.query(`DELETE FROM users WHERE id = $1;`, [targetUserId]);

        // 6. Invalidate Cache
        roleCache.delete(targetUserId);
        roleCache.delete(cleanId);
        if (phoneNum) roleCache.delete(phoneNum);
        if (internalWaId) roleCache.delete(internalWaId);

        // 7. Catat ke Audit Log
        await logAudit({
            userId: requestedBy,
            action: 'USER_KICKED_DELETED',
            resourceType: 'users',
            resourceId: targetUserId,
            riskLevel: 'HIGH',
            status: 'SUCCESS',
            metadata: {
                removedUser: targetName,
                removedContact: targetContact,
                role: targetRole,
                reason,
            },
        });

        console.log(`🗑️ [User Kicked] Pengguna ${targetName} (${targetContact}) role ${targetRole} berhasil dihapus dari sistem oleh Owner ${requestedBy}`);

        return {
            success: true,
            message: `🗑️ **Pengguna Berhasil Dikeluarkan & Dihapus!**\n• Nama: **${targetName}**\n• Kontak/ID: \`${targetContact}\`\n• Platform: **${channelType}**\n• Role Sebelumnya: **${targetRole}**\n• Status: *Akses bot telah dicabut permanen (kembali menjadi GUEST).*`,
            removedUser: targetUser,
        };
    } catch (err) {
        console.error('⚠️ Gagal menghapus user:', err.message);
        return { success: false, message: `Gagal menghapus pengguna: ${err.message}` };
    }
}

/**
 * Validasi hak akses terhadap tool tertentu
 */
async function checkToolPermission(userId, toolName) {
    const userRole = await getUserRole(userId);

    if (userRole.name === 'BLOCKED') {
        await logAudit({
            userId,
            action: toolName,
            riskLevel: 'HIGH',
            status: 'BLOCKED',
            metadata: { reason: 'User is blocked' },
        });
        return {
            allowed: false,
            reason: '🚫 Akses akun Bos saat ini sedang dinonaktifkan/diblokir oleh Administrator.',
            riskLevel: 'HIGH',
        };
    }

    const requiredRoleName = TOOL_PERMISSIONS[toolName] || 'USER';
    const requiredRole = ROLES[requiredRoleName];

    if (userRole.level < requiredRole.level) {
        await logAudit({
            userId,
            action: toolName,
            riskLevel: 'MEDIUM',
            status: 'BLOCKED',
            metadata: { userRole: userRole.name, requiredRole: requiredRoleName },
        });
        return {
            allowed: false,
            reason: `Izin tidak memadai. Perintah/tool \`${toolName}\` membutuhkan level **${requiredRole.name}**, sedangkan role Bos saat ini adalah **${userRole.name}**.`,
            riskLevel: 'MEDIUM',
        };
    }

    return { allowed: true, role: userRole };
}

/**
 * Mengambil daftar user khusus (OWNER, ADMIN, BLOCKED)
 */
async function listPrivilegedUsers() {
    try {
        const sql = `
            SELECT r.discord_user_id, r.role, r.assigned_by, r.notes, r.updated_at,
                   u.display_name
            FROM user_roles r
            LEFT JOIN users u ON u.discord_user_id = r.discord_user_id
            WHERE r.role IN ('OWNER', 'ADMIN', 'BLOCKED')
            ORDER BY 
                CASE r.role 
                    WHEN 'OWNER' THEN 1 
                    WHEN 'ADMIN' THEN 2 
                    WHEN 'BLOCKED' THEN 3 
                    ELSE 4 
                END,
                r.updated_at DESC;
        `;
        const res = await db.query(sql);
        return res.rows;
    } catch (err) {
        console.error('⚠️ Gagal mengambil daftar privileged users:', err.message);
        return [];
    }
}

/**
 * Mengambil audit log terakhir untuk inspeksi (ADMIN/OWNER)
 */
async function getRecentAuditLogs(limit = 10, filterRisk = null) {
    try {
        let sql = `
            SELECT id, user_id, action, resource_type, resource_id, risk_level, status, metadata, created_at
            FROM audit_logs
        `;
        const params = [];
        if (filterRisk) {
            sql += ' WHERE risk_level = $1';
            params.push(filterRisk.toUpperCase());
        }
        sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
        params.push(Math.min(limit, 25));

        const res = await db.query(sql, params);
        return res.rows;
    } catch (err) {
        console.error('⚠️ Gagal mengambil audit logs:', err.message);
        return [];
    }
}

/**
 * Invalidate cache untuk user tertentu
 */
function invalidateUserRole(userId) {
    if (userId) roleCache.delete(userId);
}

module.exports = {
    ROLES,
    TOOL_PERMISSIONS,
    sanitizeSensitiveData,
    logAudit,
    getUserRole,
    isAuthorizedOwner,
    hasMinimumRole,
    setUserRole,
    registerNewUser,
    removeUser,
    listAllUsersWithRoles,
    checkToolPermission,
    listPrivilegedUsers,
    getRecentAuditLogs,
    invalidateUserRole,
};
