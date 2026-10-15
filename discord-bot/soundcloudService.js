const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');

let cachedClientId = null;
let lastKeyFetchTime = 0;

/**
 * Mengambil client_id SoundCloud dari aset web publik
 */
async function getSoundCloudClientId(forceRefresh = false) {
    const now = Date.now();
    // Cache selama 1 jam kecuali dipaksa refresh
    if (cachedClientId && !forceRefresh && now - lastKeyFetchTime < 3600000) {
        return cachedClientId;
    }

    try {
        const res = await fetch('https://soundcloud.com/discover', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });
        const text = await res.text();
        const scriptMatches = [...text.matchAll(/<script[^>]+src="([^">]+\.js)"/g)].map((m) => m[1]);

        for (const scriptUrl of scriptMatches) {
            if (!scriptUrl.includes('sndcdn.com')) continue;
            try {
                const js = await fetch(scriptUrl).then((r) => r.text());
                const m = js.match(/client_id[:=]"([a-zA-Z0-9]{32})"/);
                if (m && m[1]) {
                    cachedClientId = m[1];
                    lastKeyFetchTime = now;
                    return cachedClientId;
                }
            } catch (_) {}
        }
    } catch (err) {
        console.error('⚠️ Gagal mengambil client_id SoundCloud baru:', err.message);
    }

    // Fallback key default jika scraping gagal
    if (!cachedClientId) {
        cachedClientId = 'kR7dAfT5UXQgmgde1pLjfsRGiaoANLvT';
    }
    return cachedClientId;
}

/**
 * Format durasi milidetik ke MM:SS
 */
function formatDuration(ms) {
    if (!ms || isNaN(ms)) return 'Live / N/A';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

/**
 * Mencari lagu di SoundCloud berdasarkan query
 */
async function searchSoundCloud(query) {
    const clientId = await getSoundCloudClientId();
    const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=10`;

    let res = await fetch(url);
    if (res.status === 401) {
        // Token kadaluarsa, refresh dan coba sekali lagi
        const refreshedKey = await getSoundCloudClientId(true);
        res = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${refreshedKey}&limit=10`);
    }

    if (!res.ok) {
        throw new Error(`Pencarian SoundCloud gagal (HTTP ${res.status})`);
    }

    const data = await res.json();
    if (!data.collection || data.collection.length === 0) {
        return [];
    }

    return data.collection
        .filter((track) => track.media && Array.isArray(track.media.transcodings) && track.media.transcodings.length > 0)
        .map((t) => ({
            id: t.id,
            title: t.title,
            author: (t.user && (t.user.username || t.user.full_name)) || 'Unknown Artist',
            url: t.permalink_url,
            duration: formatDuration(t.duration),
            durationMs: t.duration,
            transcodings: t.media.transcodings,
        }));
}

/**
 * Resolve track dari link langsung SoundCloud
 */
async function resolveSoundCloudUrl(trackUrl) {
    const clientId = await getSoundCloudClientId();
    const url = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(trackUrl)}&client_id=${clientId}`;

    let res = await fetch(url);
    if (res.status === 401) {
        const refreshedKey = await getSoundCloudClientId(true);
        res = await fetch(`https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(trackUrl)}&client_id=${refreshedKey}`);
    }

    if (!res.ok) {
        throw new Error(`Gagal resolve link SoundCloud (HTTP ${res.status})`);
    }

    const t = await res.json();
    if (!t.media || !Array.isArray(t.media.transcodings)) {
        throw new Error('Data media audio tidak ditemukan pada link ini.');
    }

    return {
        id: t.id,
        title: t.title,
        author: (t.user && (t.user.username || t.user.full_name)) || 'Unknown Artist',
        url: t.permalink_url,
        duration: formatDuration(t.duration),
        durationMs: t.duration,
        transcodings: t.media.transcodings,
    };
}

/**
 * Mendapatkan audio stream mentah (PCM s16le 48kHz) via FFmpeg
 */
async function getAudioStreamFromTranscodings(transcodings) {
    const clientId = await getSoundCloudClientId();

    // Prioritaskan format progressive dulu, baru HLS (aac_96k, abr_sq)
    const sorted = [...transcodings].sort((a, b) => {
        const isProgA = a.format?.protocol === 'progressive' ? 0 : 1;
        const isProgB = b.format?.protocol === 'progressive' ? 0 : 1;
        return isProgA - isProgB;
    });

    let playableStreamUrl = null;
    let lastError = null;

    for (const t of sorted) {
        try {
            const reqUrl = `${t.url}?client_id=${clientId}`;
            const r = await fetch(reqUrl);
            if (r.ok) {
                const json = await r.json();
                if (json && json.url) {
                    playableStreamUrl = json.url;
                    break;
                }
            } else {
                lastError = `Transcoding ${t.preset} return status ${r.status}`;
            }
        } catch (e) {
            lastError = e.message;
        }
    }

    if (!playableStreamUrl) {
        throw new Error(lastError || 'Tidak ada stream audio yang valid dari SoundCloud.');
    }

    // Gunakan FFmpeg untuk mengonversi stream (termasuk .m3u8 HLS) ke PCM s16le yang disukai @discordjs/voice
    const ffmpegArgs = [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', playableStreamUrl,
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1',
    ];

    const process = spawn(ffmpeg, ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'ignore'],
    });

    process.on('error', (err) => {
        console.error('❌ FFmpeg audio stream error:', err.message);
    });

    return {
        stream: process.stdout,
        destroy: () => {
            try {
                if (!process.killed) process.kill();
            } catch (_) {}
        },
    };
}

module.exports = {
    getSoundCloudClientId,
    searchSoundCloud,
    resolveSoundCloudUrl,
    getAudioStreamFromTranscodings,
    formatDuration,
};
