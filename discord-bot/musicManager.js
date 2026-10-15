const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    StreamType,
} = require('@discordjs/voice');
const { joinVoice, isInVoice } = require('./vcManager');
const {
    searchSoundCloud,
    resolveSoundCloudUrl,
    getAudioStreamFromTranscodings,
} = require('./soundcloudService');
const { resolveExternalMusicUrl } = require('./urlResolver');

// Map untuk mengelola antrean musik per server:
// guildId -> { player, queue: [], currentTrack, currentStreamDestroy, isPausedByAssistant, textChannel, volume }
const musicQueueMap = new Map();

/**
 * Mendapatkan atau membuat state antrean musik untuk sebuah guild
 */
function getOrCreateQueue(guildId) {
    if (musicQueueMap.has(guildId)) {
        return musicQueueMap.get(guildId);
    }

    const player = createAudioPlayer();
    const state = {
        guildId,
        player,
        queue: [],
        currentTrack: null,
        currentStreamDestroy: null,
        isPausedByAssistant: false,
        textChannel: null,
        volume: 1.0,
    };

    // Event ketika lagu selesai diputar
    player.on(AudioPlayerStatus.Idle, () => {
        if (state.currentStreamDestroy) {
            try { state.currentStreamDestroy(); } catch (_) {}
            state.currentStreamDestroy = null;
        }
        state.currentTrack = null;
        playNextTrack(guildId);
    });

    player.on('error', (err) => {
        console.error(`❌ Music Player error di guild ${guildId}:`, err.message);
        if (state.currentStreamDestroy) {
            try { state.currentStreamDestroy(); } catch (_) {}
            state.currentStreamDestroy = null;
        }
        state.currentTrack = null;
        playNextTrack(guildId);
    });

    musicQueueMap.set(guildId, state);
    return state;
}

/**
 * Memutar lagu berikutnya di antrean
 */
async function playNextTrack(guildId) {
    const state = musicQueueMap.get(guildId);
    if (!state) return;

    if (state.queue.length === 0) {
        state.currentTrack = null;
        if (state.textChannel) {
            state.textChannel.send('🎵 Antrean lagu sudah habis. Amba standby di room suara ya!').catch(() => {});
        }
        return;
    }

    const nextTrack = state.queue.shift();
    state.currentTrack = nextTrack;

    try {
        let resource;

        if (nextTrack.isDirectStream) {
            resource = createAudioResource(nextTrack.streamUrl, {
                inlineVolume: true,
            });
        } else if (nextTrack.transcodings && nextTrack.transcodings.length > 0) {
            const { stream, destroy } = await getAudioStreamFromTranscodings(nextTrack.transcodings);
            state.currentStreamDestroy = destroy;
            resource = createAudioResource(stream, {
                inputType: StreamType.Raw,
                inlineVolume: true,
            });
        } else {
            throw new Error('Informasi format audio tidak ditemukan.');
        }

        if (resource.volume) {
            resource.volume.setVolume(state.volume);
        }

        // Pastikan voice connection subscribe ke music player saat lagu diputar
        const { getVoiceConnection } = require('@discordjs/voice');
        const conn = getVoiceConnection(guildId);
        if (conn) {
            conn.subscribe(state.player);
        }

        state.player.play(resource);

        if (state.textChannel) {
            state.textChannel.send(`🎶 **Sedang Memutar:** [${nextTrack.title}](${nextTrack.url}) \`[${nextTrack.duration}]\` (Diminta oleh: **${nextTrack.requestedBy}**)`).catch(() => {});
        }
    } catch (err) {
        console.error(`❌ Gagal memutar lagu "${nextTrack.title}":`, err.message);
        if (state.currentStreamDestroy) {
            try { state.currentStreamDestroy(); } catch (_) {}
            state.currentStreamDestroy = null;
        }
        if (state.textChannel) {
            state.textChannel.send(`⚠️ Gagal memutar lagu **${nextTrack.title}**: ${err.message}. Memutar lagu berikutnya...`).catch(() => {});
        }
        playNextTrack(guildId);
    }
}

/**
 * Menambahkan lagu ke antrean dan mulai memutar jika idle
 */
async function playMusic(voiceChannel, textChannel, query, user) {
    const guildId = voiceChannel.guild.id;

    // Pastikan bot join ke voice channel jika belum
    if (!isInVoice(guildId)) {
        await joinVoice(voiceChannel);
    }

    const state = getOrCreateQueue(guildId);
    state.textChannel = textChannel;

    let track;

    // 1. Cek apakah query berupa direct URL audio (.mp3, .m4a, radio stream)
    if (/^https?:\/\/.+\.(mp3|m4a|aac|ogg|wav)(\?.*)?$/i.test(query)) {
        track = {
            title: query.split('/').pop().split('?')[0] || 'Direct Audio Stream',
            url: query,
            streamUrl: query,
            isDirectStream: true,
            duration: 'Live Stream',
            requestedBy: user.displayName || user.username || 'Bos',
        };
    } else if (query.includes('soundcloud.com/')) {
        // 2. Link SoundCloud langsung
        const info = await resolveSoundCloudUrl(query);
        track = {
            title: info.title,
            url: info.url,
            duration: info.duration,
            transcodings: info.transcodings,
            requestedBy: user.displayName || user.username || 'Bos',
        };
    } else {
        // 3. Cek apakah link YouTube atau Spotify
        let searchQuery = query;
        let sourceTag = null;
        let displayTitle = null;

        const ext = await resolveExternalMusicUrl(query);
        if (ext) {
            searchQuery = ext.searchQuery;
            sourceTag = ext.source;
            displayTitle = ext.displayTitle;
            if (textChannel) {
                textChannel.send(`🔗 Mendeteksi tautan **${ext.source}**: *${ext.displayTitle}*. Mencari audio terbaik...`).catch(() => {});
            }
        }

        // Cari lagu di engine audio berdasarkan judul/kata kunci
        const searchResults = await searchSoundCloud(searchQuery);
        if (!searchResults || searchResults.length === 0) {
            throw new Error(`Lagu "${displayTitle || query}" tidak ditemukan.`);
        }

        const top = searchResults[0];
        track = {
            title: displayTitle ? `${displayTitle} [${sourceTag}]` : top.title,
            url: (ext && ext.originalUrl) || top.url,
            duration: top.duration,
            transcodings: top.transcodings,
            requestedBy: user.displayName || user.username || 'Bos',
        };
    }

    // Jika sedang memutar lagu, masukkan ke antrean
    if (state.currentTrack || state.player.state.status === AudioPlayerStatus.Playing) {
        state.queue.push(track);
        return {
            status: 'queued',
            track,
            position: state.queue.length,
        };
    }

    // Jika idle, langsung mainkan
    state.queue.push(track);
    playNextTrack(guildId);
    return {
        status: 'playing',
        track,
        position: 1,
    };
}

/**
 * Pause musik
 */
function pauseMusic(guildId) {
    const state = musicQueueMap.get(guildId);
    if (!state || !state.currentTrack) {
        throw new Error('Tidak ada lagu yang sedang diputar.');
    }
    const success = state.player.pause();
    return success;
}

/**
 * Resume musik
 */
function resumeMusic(guildId) {
    const state = musicQueueMap.get(guildId);
    if (!state || !state.currentTrack) {
        throw new Error('Tidak ada lagu yang sedang dijeda.');
    }
    const { getVoiceConnection } = require('@discordjs/voice');
    const conn = getVoiceConnection(guildId);
    if (conn) {
        conn.subscribe(state.player);
    }
    const success = state.player.unpause();
    return success;
}

/**
 * Skip lagu saat ini
 */
function skipMusic(guildId) {
    const state = musicQueueMap.get(guildId);
    if (!state || !state.currentTrack) {
        throw new Error('Tidak ada lagu yang bisa dilewati.');
    }
    const skipped = state.currentTrack;
    if (state.currentStreamDestroy) {
        try { state.currentStreamDestroy(); } catch (_) {}
        state.currentStreamDestroy = null;
    }
    state.player.stop(true);
    return skipped;
}

/**
 * Stop musik dan bersihkan antrean
 */
function stopMusic(guildId) {
    const state = musicQueueMap.get(guildId);
    if (!state) return false;
    state.queue = [];
    state.currentTrack = null;
    if (state.currentStreamDestroy) {
        try { state.currentStreamDestroy(); } catch (_) {}
        state.currentStreamDestroy = null;
    }
    state.player.stop(true);
    return true;
}

/**
 * Mendapatkan daftar antrean lagu
 */
function getQueueList(guildId) {
    const state = musicQueueMap.get(guildId);
    if (!state) return { current: null, queue: [] };
    return {
        current: state.currentTrack,
        queue: [...state.queue],
    };
}

/**
 * Mengatur volume pemutaran musik (0.1 - 2.0)
 */
function setMusicVolume(guildId, volFloat) {
    const state = musicQueueMap.get(guildId);
    if (!state) {
        throw new Error('Player musik belum aktif di server ini.');
    }
    const clamped = Math.max(0.05, Math.min(2.0, volFloat));
    state.volume = clamped;
    if (state.player.state.resource && state.player.state.resource.volume) {
        state.player.state.resource.volume.setVolume(clamped);
    }
    return Math.round(clamped * 100);
}

/**
 * Jeda musik sementara saat asisten AI sedang berbicara di VC (Harmonisasi TTS)
 */
function pauseForAssistant(guildId) {
    const state = musicQueueMap.get(guildId);
    if (state && state.player.state.status === AudioPlayerStatus.Playing) {
        state.player.pause();
        state.isPausedByAssistant = true;
    }
}

/**
 * Lanjutkan musik setelah asisten AI selesai berbicara di VC
 */
function resumeAfterAssistant(guildId) {
    const state = musicQueueMap.get(guildId);
    if (state && state.isPausedByAssistant) {
        const { getVoiceConnection } = require('@discordjs/voice');
        const conn = getVoiceConnection(guildId);
        if (conn) {
            conn.subscribe(state.player);
        }
        state.player.unpause();
        state.isPausedByAssistant = false;
    }
}

module.exports = {
    playMusic,
    pauseMusic,
    resumeMusic,
    skipMusic,
    stopMusic,
    getQueueList,
    setMusicVolume,
    pauseForAssistant,
    resumeAfterAssistant,
};
