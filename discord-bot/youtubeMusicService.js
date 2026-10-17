const { spawn, execSync } = require('child_process');

// Deteksi binary ffmpeg (utamakan system ffmpeg di /usr/bin/ffmpeg, fallback ke ffmpeg-static)
let ffmpegBinary = 'ffmpeg';
try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
} catch (_) {
    try {
        ffmpegBinary = require('ffmpeg-static') || 'ffmpeg';
    } catch (_) {
        ffmpegBinary = 'ffmpeg';
    }
}

/**
 * Format durasi detik ke format MM:SS atau HH:MM:SS
 */
function formatDuration(sec) {
    if (!sec || isNaN(sec)) return 'Live / N/A';
    const totalSec = Math.floor(sec);
    const hours = Math.floor(totalSec / 3600);
    const min = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    if (hours > 0) {
        return `${hours}:${min < 10 ? '0' : ''}${min}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${min}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Mencari lagu di YouTube dengan algoritma Originality & Quality Scoring
 * Secara otomatis memprioritaskan lagu ORIGINAL / RESMI dari artist asli,
 * dan mendemosi lagu cover, remix, atau bootleg (kecuali diminta eksplisit oleh user).
 */
async function searchYouTubeMusic(query, limit = 8) {
    return new Promise((resolve, reject) => {
        const cleanQuery = query.trim();
        const wantsCoverOrRemix = /(\b(cover|remix|bootleg|karaoke|instrumental|parodi|parody|tribute)\b)/i.test(cleanQuery);

        const args = [
            '--dump-json',
            '--flat-playlist',
            '--default-search', 'ytsearch',
            `ytsearch${limit}:${cleanQuery}`
        ];

        const proc = spawn('yt-dlp', args);
        let out = '';
        let err = '';

        proc.stdout.on('data', (d) => (out += d.toString()));
        proc.stderr.on('data', (d) => (err += d.toString()));

        proc.on('close', (code) => {
            if (code !== 0 && !out) {
                return reject(new Error(err || `yt-dlp search exited with code ${code}`));
            }

            const rawTracks = out
                .trim()
                .split('\n')
                .filter(Boolean)
                .map((line) => {
                    try {
                        return JSON.parse(line);
                    } catch (_) {
                        return null;
                    }
                })
                .filter(Boolean);

            if (rawTracks.length === 0) {
                return resolve([]);
            }

            // Algoritma Scoring Cerdas: Prioritaskan Karya Asli / Original
            const scored = rawTracks.map((t, idx) => {
                let score = 100 - idx * 2;
                const titleLower = (t.title || '').toLowerCase();
                const uploaderLower = (t.uploader || '').toLowerCase();
                const duration = t.duration || 0;

                // Jangan prioritaskan video terlalu pendek (< 45 detik) seperti shorts/snippet
                if (duration > 0 && duration < 45) {
                    score -= 150;
                }

                if (!wantsCoverOrRemix) {
                    // 1. Penalti berat (-200) untuk lagu cover, remix, karaoke, bootleg
                    if (/(\b(cover|covered\s+by|cover\s+lagu|remix|bootleg|nightcore|slowed|sped\s+up|reverb|karaoke|instrumental|parodi|parody|tribute)\b)/i.test(titleLower)) {
                        score -= 200;
                    }
                    if (/(\b(cover|remix)\b)/i.test(uploaderLower)) {
                        score -= 100;
                    }

                    // 2. Bonus besar (+60) untuk rilisan resmi (Official Audio, MV, Lyric Video, Visualizer)
                    if (/(\b(official\s*(audio|music\s*video|lyric|video|visualizer)|original)\b)/i.test(titleLower)) {
                        score += 60;
                    }

                    // 3. Bonus channel resmi / verified publisher (+30)
                    if (/(\b(music|records|vevo|topic|official)\b)/i.test(uploaderLower)) {
                        score += 30;
                    }

                    // 4. Bonus kesesuaian nama artis dengan uploader (+40)
                    const queryWords = cleanQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
                    for (const w of queryWords) {
                        if (uploaderLower.includes(w)) {
                            score += 40;
                        }
                    }
                }

                return {
                    id: t.id,
                    title: t.title,
                    author: t.uploader || 'Unknown Artist',
                    url: t.url || `https://www.youtube.com/watch?v=${t.id}`,
                    duration: formatDuration(duration),
                    durationSec: duration,
                    score,
                };
            });

            // Urutkan berdasarkan skor tertinggi
            scored.sort((a, b) => b.score - a.score);
            resolve(scored);
        });

        proc.on('error', reject);
    });
}

/**
 * Mendapatkan audio stream kualitas tinggi (OggOpus 192kbps) via yt-dlp & FFmpeg
 * Dilengkapi acoustic tuning untuk kejernihan vokal dan perlindungan clipping di HP/mobile
 */
async function getAudioStreamFromYouTube(videoUrl, volume = 1.0) {
    const ytdlpArgs = [
        '-f', 'ba[acodec=opus]/ba[ext=m4a]/ba/b',
        '--no-playlist',
        '--no-check-certificates',
        '-o', '-',
        videoUrl
    ];

    const filterParts = [];
    if (typeof volume === 'number' && volume > 0 && volume !== 1.0) {
        filterParts.push(`volume=${volume.toFixed(2)}`);
    }
    // Filter Suite Optimasi Kejernihan & Akustik Mobile:
    // 1. highpass: potong rumble liar di bawah 32Hz yang bikin speaker HP pecah/distorsi
    filterParts.push('highpass=f=32');
    // 2. equalizer: penajaman frekuensi 3.8kHz agar vokal & artikulasi instrumen terdengar open & jernih
    filterParts.push('equalizer=f=3800:t=q:w=1.0:g=1.2');
    // 3. alimiter: limiter True Peak -1.0 dBFS agar tidak terjadi digital clipping saat volume HP maksimal
    filterParts.push('alimiter=limit=-1.0dB:level=false');
    // 4. aresample soxr: resampler studio 48kHz dengan presisi 28-bit anti-aliasing
    filterParts.push('aresample=48000:resampler=soxr:precision=28:cutoff=1.0');

    const ffmpegArgs = [
        '-i', 'pipe:0',
        '-filter:a', filterParts.join(','),
        '-c:a', 'libopus',
        '-b:a', '192k',
        '-vbr', 'on',
        '-compression_level', '10',
        '-application', 'audio',
        '-f', 'opus',
        'pipe:1'
    ];

    const ytdlpProc = spawn('yt-dlp', ytdlpArgs, {
        stdio: ['ignore', 'pipe', 'ignore'],
    });

    const ffmpegProc = spawn(ffmpegBinary, ffmpegArgs, {
        stdio: ['pipe', 'pipe', 'ignore'],
    });

    // Cegah unhandled EPIPE / ERR_STREAM_DESTROYED saat stream selesai atau diputus
    ffmpegProc.stdin.on('error', () => {});
    ytdlpProc.stdout.on('error', () => {});
    ffmpegProc.stdout.on('error', () => {});

    // Hubungkan stdout yt-dlp ke stdin ffmpeg
    ytdlpProc.stdout.pipe(ffmpegProc.stdin);

    ytdlpProc.on('error', (err) => {
        console.error('❌ yt-dlp process error:', err.message);
    });

    ffmpegProc.on('error', (err) => {
        console.error('❌ FFmpeg process error:', err.message);
    });

    return {
        stream: ffmpegProc.stdout,
        destroy: () => {
            try {
                if (!ytdlpProc.killed) ytdlpProc.kill('SIGTERM');
            } catch (_) {}
            try {
                if (!ffmpegProc.killed) ffmpegProc.kill('SIGTERM');
            } catch (_) {}
        },
    };
}

/**
 * Resolve informasi video YouTube secara langsung dari URL
 */
async function resolveYouTubeUrl(url) {
    return new Promise((resolve, reject) => {
        const proc = spawn('yt-dlp', ['--dump-json', '--no-playlist', url.trim()]);
        let out = '';
        let err = '';
        proc.stdout.on('data', (d) => (out += d.toString()));
        proc.stderr.on('data', (d) => (err += d.toString()));
        proc.on('close', (code) => {
            if (code !== 0 || !out) {
                return reject(new Error(err || `Gagal membaca informasi YouTube (${code})`));
            }
            try {
                const info = JSON.parse(out);
                resolve({
                    id: info.id,
                    title: info.title,
                    author: info.uploader || 'Unknown Artist',
                    url: info.webpage_url || url,
                    duration: formatDuration(info.duration),
                    durationSec: info.duration,
                });
            } catch (e) {
                reject(e);
            }
        });
        proc.on('error', reject);
    });
}

module.exports = {
    searchYouTubeMusic,
    resolveYouTubeUrl,
    getAudioStreamFromYouTube,
    formatDuration,
};
