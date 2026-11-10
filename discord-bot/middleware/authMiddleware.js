const crypto = require('crypto');
const db = require('../db');

/**
 * Helper untuk decode JWT token payload tanpa library pihak ketiga
 */
function parseJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const decodedJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
        return JSON.parse(decodedJson);
    } catch (_) {
        return null;
    }
}

/**
 * Verifikasi signature JWT jika SUPABASE_JWT_SECRET tersedia
 */
function verifyJwtSignature(token, secret) {
    if (!secret) return true; // Bypass signature check jika secret belum diset di development
    try {
        const [headerB64, payloadB64, signatureB64] = token.split('.');
        const expectedSig = crypto
            .createHmac('sha256', secret)
            .update(`${headerB64}.${payloadB64}`)
            .digest('base64url');
        return expectedSig === signatureB64;
    } catch (_) {
        return false;
    }
}

/**
 * Middleware Autentikasi Bearer JWT Supabase (PRD V3 Sec 7 & 9)
 * Memastikan req.user terisi secara aman dan melakukan query scoping mandatori
 */
async function authenticateJwt(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.apiError('UNAUTHORIZED', 'Header Authorization Bearer token wajib disertakan', [], 401);
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
        return res.apiError('UNAUTHORIZED', 'Token JWT tidak boleh kosong', [], 401);
    }

    const secret = process.env.SUPABASE_JWT_SECRET;
    if (secret && !verifyJwtSignature(token, secret)) {
        return res.apiError('UNAUTHORIZED', 'Signature token JWT tidak valid', [], 401);
    }

    const payload = parseJwtPayload(token);
    if (!payload || !payload.sub) {
        return res.apiError('UNAUTHORIZED', 'Format payload token JWT tidak valid', [], 401);
    }

    // Periksa masa berlaku token
    if (payload.exp && Date.now() >= payload.exp * 1000) {
        return res.apiError('UNAUTHORIZED', 'Token JWT telah kedaluwarsa', [], 401);
    }

    try {
        const authUserId = payload.sub; // UUID dari Supabase Auth
        // Resolusi user_id kanonik dari database
        // Cek baris users berdasarkan auth_user_id (atau ID langsung jika match)
        const userRes = await db.query(
            'SELECT id, role, display_name, status FROM users WHERE auth_user_id::text = $1 OR id = $1 OR discord_user_id = $1 LIMIT 1;',
            [authUserId]
        );

        let canonicalUserId = authUserId;
        let role = 'USER';
        let displayName = payload.email || 'User';

        if (userRes.rows.length > 0) {
            const userRow = userRes.rows[0];
            if (userRow.status === 'BLOCKED' || userRow.role === 'BLOCKED') {
                return res.apiError('FORBIDDEN', 'Akun Anda telah dinonaktifkan', [], 403);
            }
            canonicalUserId = userRow.id;
            role = userRow.role || 'USER';
            displayName = userRow.display_name || displayName;
        }

        // Simpan objek user terverifikasi ke dalam request context
        req.user = {
            id: canonicalUserId,
            auth_user_id: authUserId,
            email: payload.email,
            role,
            displayName,
            rawToken: token,
            sessionId: payload.session_id || null,
        };

        next();
    } catch (err) {
        console.error('❌ [AuthMiddleware] Gagal verifikasi identitas user:', err.message);
        return res.apiError('INTERNAL_ERROR', 'Gagal memproses autentikasi pengguna', [], 500);
    }
}

/**
 * Middleware Autentikasi Opsional (untuk endpoint publik yang dapat membaca info user jika login)
 */
async function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authenticateJwt(req, res, next);
    }
    req.user = null;
    next();
}

/**
 * Guard Role: Membatasi endpoint hanya untuk role tertentu (misal: OWNER, ADMIN)
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.apiError('UNAUTHORIZED', 'Autentikasi diperlukan', [], 401);
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.apiError('FORBIDDEN', `Akses ditolak: role '${req.user.role}' tidak memiliki izin`, [], 403);
        }
        next();
    };
}

module.exports = {
    authenticateJwt,
    optionalAuth,
    requireRole,
    parseJwtPayload,
};
