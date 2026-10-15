const fs = require('fs');
const path = require('path');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    EndBehaviorType,
    getVoiceConnection,
} = require('@discordjs/voice');
const prism = require('prism-media');
const { generateTTS, cleanupAudio } = require('./voiceService');

// Map untuk menyimpan state per guild: { connection, player, isSpeakingBot, isListening }
const guildVoiceMap = new Map();

/**
 * Bergabung ke Voice Channel
 * @param {import('discord.js').VoiceBasedChannel} channel Voice channel Discord
 * @param {Function} onVoiceCommand Callback saat user berbicara di VC: async (userId, wavBuffer)
 * @returns {Promise<boolean>}
 */
async function joinVoice(channel, onVoiceCommand = null) {
    if (!channel || !channel.guild) {
        throw new Error('Channel suara tidak valid.');
    }

    const guildId = channel.guild.id;

    // Jika sudah ada koneksi di guild ini, leave dulu
    leaveVoice(guildId);

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    const guildState = {
        channelId: channel.id,
        connection,
        player,
        isBotSpeaking: false,
        audioQueue: [],
    };

    guildVoiceMap.set(guildId, guildState);

    // Tangani disconnect
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5000),
            ]);
        } catch {
            leaveVoice(guildId);
        }
    });

    connection.on('error', (err) => {
        console.warn(`⚠️ Voice connection error [guild ${guildId}]:`, err.message);
    });

    // Setup voice listener jika callback disediakan
    if (onVoiceCommand) {
        setupVoiceReceiver(connection, guildId, onVoiceCommand);
    }

    // Tunggu sampai koneksi Ready
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    return true;
}

/**
 * Keluar dari Voice Channel
 * @param {string} guildId
 */
function leaveVoice(guildId) {
    try {
        const { stopMusic } = require('./musicManager');
        stopMusic(guildId);
    } catch (_) {}

    const state = guildVoiceMap.get(guildId);
    if (state) {
        try {
            if (state.player) state.player.stop(true);
            if (state.connection) state.connection.destroy();
        } catch (_) {}
        guildVoiceMap.delete(guildId);
        return true;
    }
    const conn = getVoiceConnection(guildId);
    if (conn) {
        conn.destroy();
        return true;
    }
    return false;
}

/**
 * Mengecek apakah bot sedang berada di Voice Channel pada server ini
 * @param {string} guildId
 * @returns {boolean}
 */
function isInVoice(guildId) {
    return guildVoiceMap.has(guildId);
}

/**
 * Berbicara di Voice Channel (TTS)
 * @param {string} guildId
 * @param {string} text Teks yang akan diucapkan
 * @returns {Promise<void>}
 */
async function speakInVoice(guildId, text, voice = 'id-ID-ArdiNeural', speed = '+0%') {
    const state = guildVoiceMap.get(guildId);
    if (!state || !state.player) {
        throw new Error('Bot tidak sedang berada di Voice Channel server ini.');
    }

    state.isBotSpeaking = true;
    let audioPath = null;

    // Jeda musik sementara jika ada musik yang sedang berputar
    try {
        const { pauseForAssistant, resumeAfterAssistant } = require('./musicManager');
        pauseForAssistant(guildId);
    } catch (_) {}

    try {
        audioPath = await generateTTS(text, voice, speed);
        const resource = createAudioResource(audioPath);

        // Pastikan connection subscribe ke player asisten saat berbicara
        if (state.connection) {
            state.connection.subscribe(state.player);
        }

        state.player.play(resource);

        return new Promise((resolve) => {
            const finish = () => {
                state.isBotSpeaking = false;
                state.lastBotSpokeAt = Date.now();
                cleanupAudio(audioPath);
                try {
                    const { resumeAfterAssistant } = require('./musicManager');
                    resumeAfterAssistant(guildId);
                } catch (_) {}
                resolve();
            };

            const onIdle = () => {
                state.player.off(AudioPlayerStatus.Idle, onIdle);
                state.player.off(AudioPlayerStatus.Error, onError);
                finish();
            };

            const onError = () => {
                state.player.off(AudioPlayerStatus.Idle, onIdle);
                state.player.off(AudioPlayerStatus.Error, onError);
                finish();
            };

            state.player.on(AudioPlayerStatus.Idle, onIdle);
            state.player.on(AudioPlayerStatus.Error, onError);
        });
    } catch (err) {
        state.isBotSpeaking = false;
        state.lastBotSpokeAt = Date.now();
        if (audioPath) cleanupAudio(audioPath);
        try {
            const { resumeAfterAssistant } = require('./musicManager');
            resumeAfterAssistant(guildId);
        } catch (_) {}
        throw err;
    }
}

/**
 * Menghentikan pembicaraan bot di Voice Channel seketika (Interruption)
 * Sesuai Section 41 & 42 PRD V2
 */
function interruptVoice(guildId) {
    const state = guildVoiceMap.get(guildId);
    if (state && state.player && state.isBotSpeaking) {
        console.log(`🛑 [VC Interrupted] Audio player dihentikan seketika di guild ${guildId}`);
        state.player.stop(true);
        state.isBotSpeaking = false;
        state.lastBotSpokeAt = Date.now();
        try {
            const { resumeAfterAssistant } = require('./musicManager');
            resumeAfterAssistant(guildId);
        } catch (_) {}
        return true;
    }
    return false;
}

/**
 * Mengecek apakah bot sedang aktif berbicara di Voice Channel
 */
function isSpeakingInVoice(guildId) {
    const state = guildVoiceMap.get(guildId);
    return state?.isBotSpeaking || false;
}

/**
 * Setup listener untuk menangkap suara pengguna di Voice Channel
 */
function setupVoiceReceiver(connection, guildId, onVoiceCommand) {
    const receiver = connection.receiver;
    const activeUserStreams = new Set();

    receiver.speaking.on('start', (userId) => {
        const state = guildVoiceMap.get(guildId);

        // Jangan mendengarkan saat bot sendiri sedang berbicara agar tidak feedback loop / echo
        if (state && state.isBotSpeaking) {
            return;
        }

        // Anti-echo cooldown: abaikan suara dalam 1.5 detik setelah bot selesai berbicara
        if (state && state.lastBotSpokeAt && Date.now() - state.lastBotSpokeAt < 1500) {
            return;
        }

        // Jangan izinkan duplikasi stream jika user yang sama sedang direkam
        if (activeUserStreams.has(userId)) {
            return;
        }

        activeUserStreams.add(userId);

        // Tangkap audio stream user (selesai jika ada hening selama 1000ms / 1 detik)
        const opusStream = receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: 1000,
            },
        });

        // Tangani error dekripsi (misal DAVE transition) tanpa membuat bot crash
        opusStream.on('error', (err) => {
            activeUserStreams.delete(userId);
            console.warn(`⚠️ Opus stream notice [user ${userId}]:`, err.message);
        });

        // Pipeline: Opus Stream -> Opus Decoder -> PCM -> FFmpeg -> WAV Buffer
        const opusDecoder = new prism.opus.Decoder({
            rate: 48000,
            channels: 2,
            frameSize: 960,
        });

        opusDecoder.on('error', (err) => {
            activeUserStreams.delete(userId);
            console.warn(`⚠️ Opus decoder notice [user ${userId}]:`, err.message);
        });

        const ffmpeg = new prism.FFmpeg({
            args: [
                '-analyzeduration', '0',
                '-loglevel', '0',
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2',
                '-i', '-',
                '-f', 'wav',
                '-ar', '16000',
                '-ac', '1',
            ],
        });

        ffmpeg.on('error', (err) => {
            activeUserStreams.delete(userId);
            console.warn(`⚠️ FFmpeg notice [user ${userId}]:`, err.message);
        });

        const chunks = [];
        const wavStream = opusStream.pipe(opusDecoder).pipe(ffmpeg);

        wavStream.on('data', (chunk) => chunks.push(chunk));
        wavStream.on('end', async () => {
            activeUserStreams.delete(userId);
            const buffer = Buffer.concat(chunks);
            // Hanya proses jika durasi audio memadai (> 20KB / ~0.7 detik)
            if (buffer.length > 20000) {
                try {
                    await onVoiceCommand(userId, buffer, guildId);
                } catch (err) {
                    console.error('❌ Gagal memproses perintah suara VC:', err.message);
                }
            }
        });

        wavStream.on('error', (err) => {
            activeUserStreams.delete(userId);
            console.warn('⚠️ Audio receiver pipeline error:', err.message);
        });
    });
}

module.exports = {
    joinVoice,
    leaveVoice,
    isInVoice,
    speakInVoice,
    interruptVoice,
    isSpeakingInVoice,
};
