/**
 * Middleware untuk validasi versi client mobile (PRD V3 Sec 7 & Sec 8)
 * Mengembalikan HTTP 426 Upgrade Required jika versi aplikasi di bawah batas minimum
 */
function compareSemver(v1, v2) {
    const parts1 = String(v1).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = String(v2).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

function checkAppVersion(req, res, next) {
    const minVersion = process.env.MIN_MOBILE_VERSION || '3.0.0';
    const clientVersion = req.headers['x-min-app-version'] || req.headers['x-app-version'];

    if (clientVersion) {
        if (compareSemver(clientVersion, minVersion) < 0) {
            return res.apiError(
                'UPGRADE_REQUIRED',
                `Versi aplikasi Anda (${clientVersion}) sudah tidak didukung. Versi minimum: ${minVersion}.`,
                { currentVersion: clientVersion, minVersion },
                426
            );
        }
    }

    next();
}

module.exports = checkAppVersion;

