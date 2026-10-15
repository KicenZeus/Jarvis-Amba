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
            userId === '344840856006459392';

        // 3. Query role secara paralel dari user_roles dan users
        const [rRes, uRes] = await Promise.all([
            db.query('SELECT role FROM user_roles WHERE discord_user_id = $1 LIMIT 1;', [userId]),
            db.query('SELECT role, display_name FROM users WHERE discord_user_id = $1 OR id = $1 LIMIT 1;', [userId]),
        ]);

        const rRole = (rRes.rows[0]?.role || '').toUpperCase();
        const uRole = (uRes.rows[0]?.role || '').toUpperCase();
        const displayName = uRes.rows[0]?.display_name || '';

        // Tentukan kandidat role dengan prioritas hierarki
        let resolvedRoleName = null;

        if (isKnownDeveloper || /kicenzeus/i.test(displayName)) {
            resolvedRoleName = 'OWNER';
        } else if (rRole === 'OWNER' || uRole === 'OWNER') {
            resolvedRoleName = 'OWNER';
        } else if (rRole === 'ADMIN' || uRole === 'ADMIN') {
            resolvedRoleName = 'ADMIN';
        } else if (rRole === 'BLOCKED' || uRole === 'BLOCKED') {
            resolvedRoleName = 'BLOCKED';
        } else if (rRole === 'USER' || uRole === 'USER') {
            resolvedRoleName = 'USER';
        } else if (rRole === 'GUEST' || uRole === 'GUEST') {
            resolvedRoleName = 'GUEST';
        }

        // Jika ditemukan role yang valid
        if (resolvedRoleName && ROLES[resolvedRoleName]) {
            const matchedRole = ROLES[resolvedRoleName];
            roleCache.set(userId, { role: matchedRole.name, expiresAt: Date.now() + CACHE_TTL_MS });

            // Jika ada perbedaan antar tabel atau tabel user_roles belum punya data, sinkronkan di background
            if (rRole !== resolvedRoleName || uRole !== resolvedRoleName) {
                db.query(`
                    INSERT INTO user_roles (discord_user_id, role, assigned_by, notes, updated_at)
                    VALUES ($1, $2, 'AUTO_SYNC', 'Synchronized from detected highest role', NOW())
                    ON CONFLICT (discord_user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW();
                    UPDATE users SET role = $2, updated_at = NOW() WHERE discord_user_id = $1 OR id = $1;
                `, [userId, resolvedRoleName]).catch(() => {});
            }

            return matchedRole;
        }

        // 4. Fallback jika belum terdaftar di DB:
        // Cek environment OWNER_DISCORD_ID / OWNER_USER_ID
        const envOwner = process.env.OWNER_DISCORD_ID || process.env.OWNER_USER_ID;
        if (envOwner && envOwner.trim() === userId) {
            await setUserRole(userId, 'OWNER', 'SYSTEM_ENV', 'Configured as OWNER via ENV');
            return ROLES.OWNER;
        }

        // Cek apakah tabel user_roles masih kosong sama sekali (user pertama jadi OWNER)
        const totalRolesRes = await db.query('SELECT COUNT(*) as count FROM user_roles');
        const count = parseInt(totalRolesRes.rows[0]?.count || '0', 10);
        if (count === 0) {
            console.log(`👑 User pertama (${userId}) otomatis dijadikan OWNER sistem.`);
            await setUserRole(userId, 'OWNER', 'AUTO_BOOTSTRAP', 'First user auto-promoted to OWNER');
            return ROLES.OWNER;
        }

        // Cek allowlist jika diatur
        const allowedIds = process.env.ALLOWED_USER_IDS
            ? process.env.ALLOWED_USER_IDS.split(',').map((id) => id.trim()).filter(Boolean)
            : [];

        let defaultRoleName = 'USER';
        if (allowedIds.length > 0 && !allowedIds.includes(userId)) {
            defaultRoleName = 'GUEST';
        }

        // Simpan default ke DB
        await db.query(
            `INSERT INTO user_roles (discord_user_id, role, assigned_by, notes, created_at, updated_at)
             VALUES ($1, $2, 'AUTO_DEFAULT', 'Initial default assignment', NOW(), NOW())
             ON CONFLICT (discord_user_id) DO NOTHING`,
            [userId, defaultRoleName]
        );

        const assignedRole = ROLES[defaultRoleName] || ROLES.USER;
        roleCache.set(userId, { role: assignedRole.name, expiresAt: Date.now() + CACHE_TTL_MS });
        return assignedRole;
    } catch (err) {
        console.error('⚠️ Gagal mengambil user role dari DB:', err.message);
        return ROLES.USER;
    }
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
    const upperRole = newRoleName?.toUpperCase();
    if (!ROLES[upperRole]) {
        return { success: false, message: `Role "${newRoleName}" tidak valid. Pilihan: OWNER, ADMIN, USER, GUEST, BLOCKED.` };
    }

    try {
        const sql = `
            INSERT INTO user_roles (discord_user_id, role, assigned_by, notes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (discord_user_id) DO UPDATE SET
                role = EXCLUDED.role,
                assigned_by = EXCLUDED.assigned_by,
                notes = EXCLUDED.notes,
                updated_at = NOW();
        `;
        await db.query(sql, [targetUserId, upperRole, assignedByUserId, notes]);

        // Update juga kolom role di tabel users jika ada
        await db.query('UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1 OR discord_user_id = $1', [targetUserId, upperRole]);

        // Invalidate cache
        roleCache.delete(targetUserId);

        // Catat Audit Log
        await logAudit({
            userId: assignedByUserId,
            action: 'ROLE_UPDATE',
            resourceType: 'USER_ROLE',
            resourceId: targetUserId,
            riskLevel: upperRole === 'OWNER' || upperRole === 'BLOCKED' ? 'HIGH' : 'MEDIUM',
            status: 'SUCCESS',
            metadata: { targetUserId, newRole: upperRole, notes },
        });

        return {
            success: true,
            message: `Role untuk user <@${targetUserId}> berhasil diubah menjadi **${upperRole}**.`,
        };
    } catch (err) {
        console.error('⚠️ Gagal menetapkan user role:', err.message);
        return { success: false, message: `Gagal memperbarui role: ${err.message}` };
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
    hasMinimumRole,
    setUserRole,
    checkToolPermission,
    listPrivilegedUsers,
    getRecentAuditLogs,
    invalidateUserRole,
};
