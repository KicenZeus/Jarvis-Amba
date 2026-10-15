const fs = require('fs');
const path = require('path');
const https = require('https');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const TEMP_AUDIO_DIR = path.join(__dirname, 'temp_audio');
if (!fs.existsSync(TEMP_AUDIO_DIR)) {
    fs.mkdirSync(TEMP_AUDIO_DIR, { recursive: true });
}

/**
 * Download file dari URL ke Buffer
 */
async function downloadToBuffer(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            // Tangani redirect jika ada
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(downloadToBuffer(res.headers.location));
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to download audio: HTTP ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Speech-to-Text menggunakan Google Gemini API (gemini-flash-lite-latest)
 * @param {Buffer} audioBuffer Buffer audio (mp3, ogg, wav, m4a)
 * @param {string} mimeType Mime type audio (contoh: 'audio/ogg', 'audio/mp3')
 * @param {string} apiKey Gemini API Key
 * @returns {Promise<string>} Teks hasil transkripsi
 */
async function transcribeAudio(audioBuffer, mimeType, apiKey, retries = 2) {
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY tidak ditemukan di environment variable.');
    }

    let cleanMime = mimeType ? mimeType.split(';')[0].trim().toLowerCase() : 'audio/ogg';
    if (!cleanMime.startsWith('audio/')) {
        cleanMime = 'audio/ogg';
    }

    const base64Audio = audioBuffer.toString('base64');
    const requestData = JSON.stringify({
        contents: [
            {
                parts: [
                    {
                        inline_data: {
                            mime_type: cleanMime,
                            data: base64Audio,
                        },
                    },
                    {
                        text: 'Transkripsikan isi rekaman suara ini ke teks bahasa Indonesia secara akurat kata demi kata. PENTING: Jika rekaman HANYA berisi kesunyian, hening, desis microphone, nafas, batuk, gumaman tidak jelas, atau tidak ada suara manusia yang berbicara dengan kata yang jelas, KEMBALIKAN STRING KOSONG (tanpa teks apa pun). Jangan pernah berhalusinasi atau menebak kata seperti "00" atau "sunyi".',
                    },
                ],
            },
        ],
    });

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: requestData,
                    signal: AbortSignal.timeout(15000),
                }
            );

            if (!res.ok) {
                const errJson = await res.json().catch(() => null);
                throw new Error(errJson?.error?.message || `HTTP ${res.status}`);
            }

            const parsed = await res.json();
            let rawText = parsed.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

            // Bersihkan format timestamp subtitle (contoh: "00:01: live chat" -> "live chat")
            rawText = rawText.replace(/^(\[?\d{1,2}:\d{2}(?::\d{2})?\]?[:\-\s]+)+/i, '').trim();

            // Filter halusinasi audio hening (misal: "00", "sunyi", "...", dll)
            if (isNoiseOrHallucination(rawText)) {
                return '';
            }

            return rawText;
        } catch (err) {
            if (attempt === retries) {
                throw err;
            }
            console.warn(`⚠️ Percobaan ke-${attempt} STT gagal (${err.message}), mencoba ulang...`);
            await new Promise((r) => setTimeout(r, 1000));
        }
    }
}

/**
 * Mendeteksi apakah teks hasil transkripsi merupakan noise atau halusinasi pada audio hening
 */
function isNoiseOrHallucination(text) {
    if (!text || !text.trim()) return true;
    const clean = text.trim().toLowerCase();

    // 1. Teks terlalu pendek atau hanya tanda baca/simbol
    if (clean.length < 2 || /^[^a-zA-Z0-9]+$/.test(clean)) return true;

    // 2. Pola halusinasi umum model pada kesunyian / background noise
    if (/^[0:\.\s]+$/.test(clean)) return true; // "00", "000", "0", "00:00", "00.00"
    if (/^\(.*\)$/.test(clean)) return true; // "(suara hening)", "(tertawa)"
    if (/^(\b(sunyi|kesunyian|suara\s*hening|suara\s*napas|terima\s*kasih|uh|um|oh|he|you|audio|music|video|subtitles|caption)\b)/i.test(clean)) return true;

    return false;
}

/**
 * Text-to-Speech menggunakan MsEdgeTTS (Indonesia Neural Voice)
 * @param {string} text Teks yang akan dibacakan
 * @param {string} voice Nama suara ('id-ID-ArdiNeural' atau 'id-ID-GadisNeural')
 * @returns {Promise<string>} Path file audio hasil generate (.mp3)
 */
async function generateTTS(text, voice = 'id-ID-ArdiNeural', speed = '+0%', retries = 3) {
    // Bersihkan teks dari markdown formatting berat agar enak didengar
    const cleanText = text
        .replace(/[*_#`~>]/g, '')
        .replace(/https?:\/\/\S+/g, 'tautan link')
        .trim();

    if (!cleanText) {
        throw new Error('Teks untuk TTS kosong.');
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        const sessionId = Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const sessionDir = path.join(TEMP_AUDIO_DIR, sessionId);
        fs.mkdirSync(sessionDir, { recursive: true });

        try {
            const tts = new MsEdgeTTS();
            await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
            await tts.toFile(sessionDir, cleanText, { rate: speed || '+0%' });
            const generatedFile = path.join(sessionDir, 'audio.mp3');

            if (fs.existsSync(generatedFile)) {
                return generatedFile;
            }
            throw new Error('Gagal membuat file audio TTS.');
        } catch (err) {
            try {
                if (fs.existsSync(sessionDir)) {
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                }
            } catch (_) {}

            if (attempt === retries) {
                console.error(`❌ Gagal generateTTS setelah ${retries} percobaan:`, err.message);
                throw err;
            }
            console.warn(`⚠️ Percobaan ke-${attempt} TTS gagal (${err.message}), mencoba ulang...`);
            await new Promise((r) => setTimeout(r, 600));
        }
    }
}

/**
 * Hapus file dan folder sementara
 * @param {string} filePath
 */
function cleanupAudio(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            const dir = path.dirname(filePath);
            fs.unlinkSync(filePath);
            if (fs.existsSync(dir) && dir !== TEMP_AUDIO_DIR) {
                fs.rmdirSync(dir);
            }
        }
    } catch (e) {
        console.warn('⚠️ Gagal membersihkan audio sementara:', e.message);
    }
}

module.exports = {
    downloadToBuffer,
    transcribeAudio,
    generateTTS,
    cleanupAudio,
};
