require('dotenv').config();
const http = require('http');
const db = require('./db');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { downloadToBuffer, transcribeAudio, generateTTS, cleanupAudio } = require('./voiceService');
const { joinVoice, leaveVoice, isInVoice, speakInVoice, interruptVoice, isSpeakingInVoice } = require('./vcManager');
const {
    playMusic,
    pauseMusic,
    resumeMusic,
    skipMusic,
    stopMusic,
    getQueueList,
    setMusicVolume,
} = require('./musicManager');
const {
    getMainHelpEmbed,
    getMusicHelpEmbed,
    getAssistantHelpEmbed,
    getMemoriesEmbed,
    getVoiceSettingsEmbed,
    getWebSearchEmbed,
    getWeatherEmbed,
    getAnalyticsDashboardEmbed,
    getFinanceAnalyticsEmbed,
    getTaskAnalyticsEmbed,
    getUserRoleEmbed,
    getRoleListEmbed,
    getAuditLogsEmbed,
    getSecurityStatusEmbed,
    getHealthStatusEmbed,
} = require('./helpEmbeds');
const security = require('./securityService');
const { getCompleteHealthStatus } = require('./healthService');
const {
    createRequestId,
    recordMessageProcessed,
    recordAiRequest,
    recordVoiceRequest,
} = require('./metricsService');
const {
    searchWeb,
    fetchAndExtractUrl,
    getWeather,
} = require('./webIntelligenceService');
const {
    getFullAnalyticsReport,
    getFinanceAnalytics,
    getTaskAnalytics,
    syncDailyMetrics,
} = require('./analyticsService');
const {
    getRelevantMemories,
    listMemories,
    forgetMemory,
    recordConversation,
} = require('./memoryService');
const {
    startAgentRun,
    recordToolCall,
    finishAgentRun,
    isHighRiskAction,
    setPendingConfirmation,
    getPendingConfirmation,
    clearPendingConfirmation,
} = require('./agentService');
const {
    getBriefingContent,
    getRecapContent,
    handleRecurringReminder,
    snoozeReminder,
    startProactiveScheduler,
} = require('./proactiveService');
const {
    AVAILABLE_VOICES,
    getUserVoicePreference,
    setUserVoicePreference,
} = require('./voicePreferenceService');
const {
    handleWebhookVerification,
    handleWebhookEvent,
    sendWhatsAppTextMessage,
    sendWhatsAppAudioMessage,
} = require('./whatsappAdapter');
const {
    sendSmartNotification,
    getUserNotificationPreferences,
    setNotificationPreference,
} = require('./notificationService');
const { broadcastMessage, isAuthorizedAdmin, setDiscordClient } = require('./broadcastService');

const N8N_WEBHOOK_URL =
    process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/jarvis-discord';
const N8N_TIMEOUT_MS = parseInt(process.env.N8N_TIMEOUT_MS, 10) || 60000;
const NOTIFY_PORT = parseInt(process.env.NOTIFY_PORT, 10) || 5001;
const ALLOWED_USER_IDS = process.env.ALLOWED_USER_IDS
    ? process.env.ALLOWED_USER_IDS.split(',').map((id) => id.trim()).filter(Boolean)
    : [];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

client.once(Events.ClientReady, (readyClient) => {
    console.log(`✅ Jarvis online sebagai ${readyClient.user.tag}`);
    console.log(`🔗 Target n8n Webhook: ${N8N_WEBHOOK_URL}`);
    if (ALLOWED_USER_IDS.length > 0) {
        console.log(`🔒 Allowlist aktif untuk ${ALLOWED_USER_IDS.length} user ID.`);
    } else {
        console.log('🌐 Allowlist kosong: bot merespons semua user.');
    }
    // Set global client untuk pengiriman broadcast & proaktif
    setDiscordClient(readyClient);
    // Aktifkan scheduler proaktif (Daily Briefing, Daily Recap, Recurring & Snooze)
    startProactiveScheduler(readyClient);
});

/**
 * Mengecek apakah sebuah teks mengandung pemicu bot (kata "amba", "jarvis", mention, atau command prefix)
 */
function containsBotTrigger(text, botId = null) {
    if (!text) return false;
    if (botId && (text.includes(`<@${botId}>`) || text.includes(`<@!${botId}>`))) {
        return true;
    }
    // Kata "amba", "ambah", "mba", "maba", "hamba", atau "jarvis" di mana saja dalam kalimat, atau prefix !amba, /amba, atau command musik, VC, memori, proaktif, suara, web, analitik, keamanan, diagnostik, broadcast, dan notifikasi
    const regex = /(\b(amba|ambah|mba|maba|hamba|jarvis)\b|^!(amba|jarvis|j|join|leave|vc|dc|play|p|pause|resume|unpause|skip|s|stop|queue|q|vol|v|volume|help|h|panduan|bantuan|mhelp|ahelp|memories|memori|ingatan|forget|lupakan|briefing|recap|snooze|voice|suara|diam|search|cari|cuaca|weather|baca|rangkum|analytics|analisis|stats|insight|role|myrole|audit|auditlog|security|safety|ping|health|status|diagnostik|broadcast|pengumuman|siarkan|notif|notifikasi)\b|^\/(amba|jarvis)\b)/i;
    return regex.test(text);
}

/**
 * Membersihkan mention dan prefix di awal teks
 */
function cleanBotTrigger(text, botId = null) {
    if (!text) return '';
    let cleaned = text.trim();
    if (botId) {
        cleaned = cleaned.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
    }
    cleaned = cleaned.replace(/^(!amba|!jarvis|!j|\/amba|\/jarvis)\s*/i, '').trim();
    cleaned = cleaned.replace(/^(halo\s+)?(amba|ambah|mba|maba|hamba|jarvis)[,:\s]*/i, '').trim();
    cleaned = cleaned.replace(/^(mba\s+)?(amba|jarvis)[,:\s]*/i, '').trim();
    return cleaned;
}

/**
 * Mendapatkan informasi panggilan dan etiket sapaan pengguna:
 * - Pengguna yang sudah punya callsign di database (atau owner) dipanggil dengan callsign tersebut.
 * - Pengguna baru / belum mengatur panggilan dipanggil dengan nama/nickname Discord aslinya.
 */
async function resolveUserGreetingInfo(author, member = null) {
    const rawNickname = member?.displayName || author.displayName || author.globalName || author.username || 'Kawan';
    const cleanNickname = rawNickname.replace(/\[.*?\]|\(.*?\)/g, '').trim() || author.username || 'Kawan';

    const isOwner = author.id === '713137141072396370' || author.id === '344840856006459392';

    let callsign = null;
    try {
        const res = await db.query(
            'SELECT callsign FROM users WHERE discord_user_id = $1 OR id = $1 LIMIT 1;',
            [author.id]
        );
        if (res.rows[0]?.callsign && res.rows[0].callsign.trim()) {
            callsign = res.rows[0].callsign.trim();
        }
    } catch (err) {
        console.warn('⚠️ Gagal mengambil callsign user dari DB:', err.message);
    }

    if (isOwner && !callsign) {
        callsign = 'Bos';
    }

    return {
        cleanNickname,
        callsign,
        preferredName: callsign || cleanNickname,
        hasCustomCallsign: Boolean(callsign),
        isOwner,
    };
}

/**
 * Menentukan mode balasan: 'text', 'voice', atau 'both'
 * - 'text' : Hanya kirim teks chat Discord
 * - 'voice': Hanya kirim file audio voice note (.mp3)
 * - 'both' : Kirim teks chat beserta file audio voice note (.mp3)
 */
function determineReplyMode(content, isVoiceInput, n8nReplyMode) {
    if (n8nReplyMode === 'both') return 'both';
    if (n8nReplyMode === 'voice' || n8nReplyMode === 'audio') return 'voice';
    if (n8nReplyMode === 'text') return 'text';

    const lower = (content || '').toLowerCase();

    // 1. Cek apakah user meminta KEDUANYA (teks + suara/vn)
    const bothRegex = /(\b(keduanya|dua-duanya|teks\s*(dan|sama|beserta|\+)\s*(vn|suara|voice|audio)|(vn|suara|voice|audio)\s*(dan|sama|beserta|\+)\s*(teks|chat|tulisan)|chat\s*(dan|sama|beserta|\+)\s*(vn|suara)|(vn|suara)\s*(dan|sama|beserta|\+)\s*chat)\b)/i;
    if (bothRegex.test(lower)) {
        return 'both';
    }

    // 2. Cek apakah user eksplisit minta TEKS SAJA
    const textOnlyRegex = /(\b(balas\s*(pake|lewat|pakai)?\s*(chat|teks|tulisan)|jawab\s*(pake|lewat|pakai)?\s*(chat|teks|tulisan)|(chat|teks|tulisan)\s*(aja|saja|doang)|jangan\s*(pake|pakai)?\s*(vn|suara|voice|audio)|ketik\s*aja)\b)/i;
    if (textOnlyRegex.test(lower)) {
        return 'text';
    }

    // 3. Cek apakah user meminta VOICE NOTE / SUARA SAJA
    const voiceRegex = /(\b(pake\s*vn|balas\s*(pake\s*)?vn|jawab\s*(pake\s*)?vn|lewat\s*vn|pake\s*suara|balas\s*(pake\s*)?suara|jawab\s*(pake\s*)?suara|lewat\s*suara|voice\s*note)\b)/i;
    if (voiceRegex.test(lower)) {
        return 'voice';
    }

    // 4. Jika input berupa Voice Note (VN) dan tidak ada instruksi minta teks/chat
    if (isVoiceInput) {
        return 'voice';
    }

    // 5. Default percakapan teks biasa -> hanya teks
    return 'text';
}

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    recordMessageProcessed();

    if (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(message.author.id)) {
        return;
    }

    const botId = client.user.id;
    const isDM = !message.guild;

    // Cek apakah user me-reply salah satu pesan dari bot
    let isReplyToBot = false;
    if (message.reference && message.reference.messageId) {
        try {
            const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
            if (refMsg && refMsg.author.id === botId) {
                isReplyToBot = true;
            }
        } catch (_) {}
    }

    // Deteksi jika ada pesan suara (voice message) atau file audio
    const audioAttachment = message.attachments.find(
        (att) =>
            (att.contentType && att.contentType.startsWith('audio/')) ||
            att.name.endsWith('.ogg') ||
            att.name.endsWith('.mp3') ||
            att.name.endsWith('.wav') ||
            att.name.endsWith('.m4a')
    );

    const rawText = (message.content || '').trim();
    const textHasTrigger = containsBotTrigger(rawText, botId) || message.mentions.has(botId);

    // KASUS A: Pesan Teks Murni (tanpa file audio)
    if (!audioAttachment) {
        // Jika di channel publik dan tidak menyebut amba serta bukan reply bot -> ABAIKAN
        if (!isDM && !textHasTrigger && !isReplyToBot) {
            return;
        }

        // Dapatkan informasi panggilan user (nama asli / nickname vs callsign terdaftar)
        const greetingInfo = await resolveUserGreetingInfo(message.author, message.member);
        const preferredName = greetingInfo.preferredName;

        // Cek Keamanan & RBAC (Phase 7: Blokir Akses jika user berstatus BLOCKED)
        const callerRole = await security.getUserRole(message.author.id);
        if (callerRole.name === 'BLOCKED') {
            await security.logAudit({
                userId: message.author.id,
                action: 'INTERACTION_ATTEMPT',
                riskLevel: 'HIGH',
                status: 'BLOCKED',
                metadata: { channel: message.channel.name || 'DM', text: rawText.substring(0, 100) },
            });
            return message.reply(`🚫 Akses akun ${preferredName} saat ini telah dinonaktifkan/diblokir oleh Administrator Jarvis.`).catch(() => {});
        }

        const cleanedContent = cleanBotTrigger(rawText, botId);

        // Perintah Voice Channel: Join VC
        const isJoinVC = /(\b(join\s*vc|masuk\s*vc|gabung\s*vc|join\s*voice|masuk\s*voice)\b|^!(join|vc)\b)/i.test(cleanedContent || rawText);
        if (isJoinVC) {
            if (!message.guild) {
                return message.reply(`Perintah Voice Channel hanya bisa dipakai di dalam Server/Guild ya ${preferredName}!`);
            }
            const voiceChannel = message.member?.voice?.channel;
            if (!voiceChannel) {
                return message.reply(`${preferredName} belum masuk ke Voice Channel nih. Masuk dulu ke salah satu voice channel, baru panggil Amba ya! 🎧`);
            }
            try {
                await joinVoice(voiceChannel, (userId, buffer, gId) => handleVoiceChannelAudio(userId, buffer, gId, message.channel));
                await message.reply(`✅ Siap ${preferredName}! Amba sudah gabung di Voice Channel **${voiceChannel.name}**. Langsung ngomong aja di room suara, Amba dengerin! 🎙️`);
                speakInVoice(message.guild.id, `Halo ${preferredName}! Amba sudah standby di room suara nih. Ada yang bisa Amba bantu?`).catch(() => {});
                return;
            } catch (err) {
                return message.reply(`Aduh ${preferredName}, gagal masuk ke Voice Channel: ${err.message}`);
            }
        }

        // Perintah Voice Channel: Leave VC
        const isLeaveVC = /(\b(leave\s*vc|cabut\s*vc|keluar\s*vc|dc\s*vc|disconnect\s*vc|stop\s*vc)\b|^!(leave|dc|disconnect)\b)/i.test(cleanedContent || rawText);
        if (isLeaveVC) {
            if (!message.guild) {
                return message.reply(`Perintah Voice Channel hanya bisa dipakai di dalam Server/Guild ya ${preferredName}!`);
            }
            if (!isInVoice(message.guild.id)) {
                return message.reply(`Amba lagi gak ada di Voice Channel mana pun kok, ${preferredName}.`);
            }
            await speakInVoice(message.guild.id, `Oke ${preferredName}, Amba pamit undur diri dulu ya!`).catch(() => {});
            leaveVoice(message.guild.id);
            return message.reply(`👋 Amba sudah keluar dari Voice Channel. Kalau butuh lagi tinggal panggil \`amba join vc\` ya ${preferredName}!`);
        }

        // --- PERINTAH MUSIK ---
        // 1. Play Musik (!play / !p / amba play / amba p)
        const playMatch = (cleanedContent || rawText).match(/^(!play|!p|play|p|putar\s*lagu|putar|setel\s*lagu|setel)\s+(.+)$/i);
        if (playMatch) {
            if (!message.guild) {
                return message.reply(`Fitur musik hanya bisa dipakai di dalam Server/Guild ya ${preferredName}!`);
            }
            const voiceChannel = message.member?.voice?.channel;
            if (!voiceChannel) {
                return message.reply(`${preferredName} harus masuk ke salah satu Voice Channel dulu sebelum memutar musik! 🎧`);
            }
            const query = playMatch[2].trim();
            await message.reply(`🔍 Sedang mencari dan menyiapkan lagu **"${query}"**...`).catch(() => {});
            try {
                const res = await playMusic(voiceChannel, message.channel, query, message.author);
                if (res.status === 'queued') {
                    return message.channel.send(`📥 Ditambahkan ke antrean (**#${res.position}**): **${res.track.title}** (${res.track.duration})`).catch(() => {});
                }
                return;
            } catch (err) {
                return message.channel.send(`⚠️ Gagal memutar musik: ${err.message}`).catch(() => {});
            }
        }

        // 2. Pause Musik (!pause / amba pause)
        if (/^(!pause|pause|jeda)$/i.test(cleanedContent || rawText)) {
            if (!message.guild) return;
            try {
                pauseMusic(message.guild.id);
                return message.reply('⏸️ Musik berhasil dijeda. Ketik `!resume` atau `!p` buat lanjutin ya!');
            } catch (err) {
                return message.reply(`⚠️ ${err.message}`);
            }
        }

        // 3. Resume Musik (!resume / !unpause / amba resume)
        if (/^(!resume|!unpause|resume|unpause|lanjut)$/i.test(cleanedContent || rawText)) {
            if (!message.guild) return;
            try {
                resumeMusic(message.guild.id);
                return message.reply('▶️ Musik dilanjutkan kembali!');
            } catch (err) {
                return message.reply(`⚠️ ${err.message}`);
            }
        }

        // 4. Skip Musik (!skip / !s / amba skip)
        if (/^(!skip|!s|skip|s|lewati|next)$/i.test(cleanedContent || rawText)) {
            if (!message.guild) return;
            try {
                const skipped = skipMusic(message.guild.id);
                return message.reply(`⏭️ Lagu **${skipped.title}** dilewati!`);
            } catch (err) {
                return message.reply(`⚠️ ${err.message}`);
            }
        }

        // 5. Stop Musik (!stop / amba stop)
        if (/^(!stop|stop|berhenti|stop\s*(musik|lagu))$/i.test(cleanedContent || rawText)) {
            if (!message.guild) return;
            const stopped = stopMusic(message.guild.id);
            if (stopped) {
                return message.reply('⏹️ Musik dihentikan dan antrean lagu telah dibersihkan!');
            } else {
                return message.reply('Tidak ada musik yang sedang diputar.');
            }
        }

        // 6. Queue Musik (!queue / !q / amba queue)
        if (/^(!queue|!q|queue|q|antrean|daftar\s*lagu)$/i.test(cleanedContent || rawText)) {
            if (!message.guild) return;
            const q = getQueueList(message.guild.id);
            if (!q.current && q.queue.length === 0) {
                return message.reply(`📭 Antrean musik masih kosong nih, ${preferredName}! Putar lagu pakai \`!p <judul/link>\`.`);
            }
            let text = `🎶 **Sedang Berputar:** ${q.current ? `**${q.current.title}** (${q.current.duration})` : 'Tidak ada'}\n`;
            if (q.queue.length > 0) {
                text += `\n📋 **Antrean Berikutnya:**\n` + q.queue.slice(0, 5).map((t, idx) => `${idx + 1}. **${t.title}** (${t.duration}) - *${t.requestedBy}*`).join('\n');
                if (q.queue.length > 5) text += `\n...dan ${q.queue.length - 5} lagu lainnya.`;
            } else {
                text += '\nTidak ada lagu berikutnya di antrean.';
            }
            return message.reply(text);
        }

        // 7. Volume Musik (!vol / !v / amba vol)
        const volMatch = (cleanedContent || rawText).match(/^(!vol|!v|!volume|volume|vol|v)\s+(\d+)$/i);
        if (volMatch) {
            if (!message.guild) return;
            const val = parseInt(volMatch[2], 10);
            try {
                const currentVol = setMusicVolume(message.guild.id, val / 100);
                return message.reply(`🔊 Volume musik diatur ke **${currentVol}%**!`);
            } catch (err) {
                return message.reply(`⚠️ ${err.message}`);
            }
        }

        // --- PERINTAH BANTUAN / PANDUAN (!help / !h / amba help) ---
        const helpMatch = (cleanedContent || rawText).match(/^(!help|!h|!panduan|!bantuan|help|panduan|bantuan)(\s+(music|musik|lagu|assistant|asisten|ai|all))?$/i);
        const isDirectMusicHelp = /^(!mhelp|mhelp)$/i.test(cleanedContent || rawText);
        const isDirectAssistantHelp = /^(!ahelp|ahelp)$/i.test(cleanedContent || rawText);

        if (helpMatch || isDirectMusicHelp || isDirectAssistantHelp) {
            const subCategory = (helpMatch && helpMatch[3] ? helpMatch[3].toLowerCase() : '') || (isDirectMusicHelp ? 'music' : '') || (isDirectAssistantHelp ? 'assistant' : '');

            if (subCategory === 'music' || subCategory === 'musik' || subCategory === 'lagu') {
                return message.reply({ embeds: [getMusicHelpEmbed()] }).catch(() => {});
            }
            if (subCategory === 'assistant' || subCategory === 'asisten' || subCategory === 'ai') {
                return message.reply({ embeds: [getAssistantHelpEmbed()] }).catch(() => {});
            }
            // Default: Tampilkan panduan lengkap dua kategori
            return message.reply({ embeds: [getMainHelpEmbed()] }).catch(() => {});
        }

        // --- IDENTITAS PEMBUAT (kicenzeus) ---
        const creatorRegex = /(\b(siapa\s*(yang\s*)?(buat|bikin|ciptain|develop|program)\s*(lu|kamu|amba|bot)|siapa\s*pembuat(mu|nya)?|siapa\s*creator(mu|nya)?|pembuat\s*(lu|kamu|amba)|who\s*(made|created)\s*you)\b)/i;
        if (creatorRegex.test(cleanedContent || rawText)) {
            return message.reply(`Gua dibuat dan dikembangkan oleh **kicenzeus**, ${preferredName}! 😎🔥 Beliau yang merancang dan ngoding sistem gua biar bisa jadi asisten pribadi pintar sekaligus bot pemutar musik berkualitas tinggi di Discord. Mau dibantu apa nih hari ini?`).catch(() => {});
        }

        // --- FITUR MEMORI (PHASE 1) ---
        // 1. Cek daftar ingatan / memori (!memories / amba memori / amba ingatan)
        if (/^(!memories|!memori|!ingatan|memories|memori|ingatan)$/i.test(cleanedContent || rawText)) {
            try {
                const mems = await listMemories(message.author.id);
                const dispName = message.author.displayName || message.author.username;
                return message.reply({ embeds: [getMemoriesEmbed(dispName, mems)] });
            } catch (err) {
                return message.reply(`⚠️ Gagal mengambil daftar memori: ${err.message}`);
            }
        }

        // 2. Melupakan ingatan tertentu (!forget <key> / amba lupakan <key>)
        const forgetMatch = (cleanedContent || rawText).match(/^(!forget|!lupakan|forget|lupakan)\s+(.+)$/i);
        if (forgetMatch) {
            const targetKey = forgetMatch[2].trim();
            try {
                const forgotten = await forgetMemory(message.author.id, targetKey);
                if (forgotten && forgotten.length > 0) {
                    const keys = forgotten.map(f => `\`${f.key}\``).join(', ');
                    return message.reply(`🗑️ Siap ${preferredName}! Ingatan tentang ${keys} sudah Amba hapus dari memori.`);
                } else {
                    return message.reply(`Amba tidak menemukan ingatan aktif yang cocok dengan kata kunci **"${targetKey}"**, ${preferredName}.`);
                }
            } catch (err) {
                return message.reply(`⚠️ Gagal melupakan memori: ${err.message}`);
            }
        }

        // --- FITUR ASISTEN PROAKTIF (PHASE 3) ---
        // 1. Daily Briefing manual (!briefing / amba briefing)
        if (/^(!briefing|briefing|daily\s*briefing)$/i.test(cleanedContent || rawText)) {
            try {
                const briefingText = await getBriefingContent(message.author.id);
                return message.reply(briefingText);
            } catch (err) {
                return message.reply(`⚠️ Gagal mengambil Daily Briefing: ${err.message}`);
            }
        }

        // 2. Daily Recap manual (!recap / amba recap / amba daily recap)
        if (/^(!recap|recap|daily\s*recap|evaluasi\s*hari\s*ini)$/i.test(cleanedContent || rawText)) {
            try {
                const recapText = await getRecapContent(message.author.id);
                return message.reply(recapText);
            } catch (err) {
                return message.reply(`⚠️ Gagal mengambil Daily Recap: ${err.message}`);
            }
        }

        // 3. Snooze reminder (!snooze [menit] / amba snooze [menit])
        const snoozeMatch = (cleanedContent || rawText).match(/^(!snooze|snooze|tunda)(\s+(\d+))?$/i);
        if (snoozeMatch) {
            const minutes = parseInt(snoozeMatch[3], 10) || 10;
            try {
                const res = await snoozeReminder(message.author.id, minutes);
                if (res && res.reminder) {
                    return message.reply(`⏰ Siap ${preferredName}! Pengingat **"${res.reminder.title}"** sudah Amba tunda (**snooze**) selama **${res.minutes} menit**. Nanti Amba colek lagi! 🫡`);
                } else {
                    return message.reply(`Amba tidak menemukan pengingat yang baru saja berbunyi untuk di-snooze nih, ${preferredName}.`);
                }
            } catch (err) {
                return message.reply(`⚠️ Gagal menunda pengingat: ${err.message}`);
            }
        }

        // 4. Pengaturan Otomatisasi Briefing & Recap
        if (/^(aktifkan|nyalakan|hidupkan)\s+(briefing|daily\s*briefing)(\s*pagi)?$/i.test(cleanedContent || rawText)) {
            try {
                await require('./db').query(
                    'UPDATE users SET daily_briefing_enabled = TRUE, briefing_channel_id = $2 WHERE id = $1',
                    [message.author.id, message.channel.id]
                );
                return message.reply(`☀️ Siap ${preferredName}! Daily Briefing pagi otomatis telah **diaktifkan**. Amba akan menyapa dan merangkum agenda ${preferredName} setiap pagi di channel ini! ☕`);
            } catch (err) {
                return message.reply(`⚠️ Gagal mengatur briefing: ${err.message}`);
            }
        }

        if (/^(matikan|nonaktifkan)\s+(briefing|daily\s*briefing)(\s*pagi)?$/i.test(cleanedContent || rawText)) {
            try {
                await require('./db').query(
                    'UPDATE users SET daily_briefing_enabled = FALSE WHERE id = $1',
                    [message.author.id]
                );
                return message.reply(`Siap ${preferredName}! Daily Briefing pagi otomatis telah **dinonaktifkan**.`);
            } catch (err) {
                return message.reply(`⚠️ Gagal mengatur briefing: ${err.message}`);
            }
        }

        if (/^(aktifkan|nyalakan|hidupkan)\s+(recap|daily\s*recap)(\s*malam)?$/i.test(cleanedContent || rawText)) {
            try {
                await require('./db').query(
                    'UPDATE users SET daily_recap_enabled = TRUE, briefing_channel_id = $2 WHERE id = $1',
                    [message.author.id, message.channel.id]
                );
                return message.reply(`📊 Siap ${preferredName}! Daily Recap malam otomatis telah **diaktifkan**. Amba akan merangkum pencapaian dan pengeluaran ${preferredName} setiap malam di channel ini! 🌙`);
            } catch (err) {
                return message.reply(`⚠️ Gagal mengatur recap: ${err.message}`);
            }
        }

        if (/^(matikan|nonaktifkan)\s+(recap|daily\s*recap)(\s*malam)?$/i.test(cleanedContent || rawText)) {
            try {
                await require('./db').query(
                    'UPDATE users SET daily_recap_enabled = FALSE WHERE id = $1',
                    [message.author.id]
                );
                return message.reply(`Siap ${preferredName}! Daily Recap malam otomatis telah **dinonaktifkan**.`);
            } catch (err) {
                return message.reply(`⚠️ Gagal mengatur recap: ${err.message}`);
            }
        }

        // 5. Pengaturan Notifikasi Proaktif (Phase 6: Discord & WhatsApp)
        if (/^(!notif|!notifikasi|notifikasi|pengaturan\s*notifikasi|cek\s*notifikasi)$/i.test(cleanedContent || rawText)) {
            try {
                const prefs = await getUserNotificationPreferences(message.author.id);
                let text = `🔔 **Pengaturan Notifikasi Proaktif Jarvis (${preferredName}):**\n\n`;

                const getPrefBadge = (type) => {
                    const p = prefs.find((item) => item.event_type === type);
                    if (!p) return '`BOTH` (Discord & WhatsApp - Default)';
                    if (!p.enabled) return '🔴 Nonaktif';
                    return `🟢 \`${p.channel_type}\``;
                };

                text += `• **Pengingat (Reminders):** ${getPrefBadge('REMINDER')}\n`;
                text += `• **Daily Briefing (Pagi):** ${getPrefBadge('DAILY_BRIEFING')}\n`;
                text += `• **Daily Recap (Malam):** ${getPrefBadge('DAILY_RECAP')}\n`;
                text += `• **Task Due (Tugas):** ${getPrefBadge('TASK_DUE')}\n\n`;

                const anyQuiet = prefs.find((p) => p.quiet_hours_start && p.quiet_hours_end);
                if (anyQuiet) {
                    text += `🌙 **Jam Tenang (Quiet Hours):** \`${String(anyQuiet.quiet_hours_start).substring(0, 5)} - ${String(anyQuiet.quiet_hours_end).substring(0, 5)} WIB\`\n\n`;
                } else {
                    text += `🌙 **Jam Tenang (Quiet Hours):** Belum diatur (aktif 24 jam)\n\n`;
                }

                text += `💡 *Cara ubah channel:* \`!notif atur reminder whatsapp\` atau \`!notif atur briefing both\`\n`;
                text += `💡 *Cara atur jam tenang:* \`!notif jam-tenang 22:00 07:00\``;

                return message.reply(text);
            } catch (err) {
                return message.reply(`⚠️ Gagal mengambil preferensi notifikasi: ${err.message}`);
            }
        }

        const aturNotifMatch = (cleanedContent || rawText).match(/^!notif\s+atur\s+(reminder|briefing|recap|task)\s+(discord|whatsapp|wa|both|keduanya)$/i);
        if (aturNotifMatch) {
            try {
                let eventType = aturNotifMatch[1].toUpperCase();
                if (eventType === 'BRIEFING') eventType = 'DAILY_BRIEFING';
                if (eventType === 'RECAP') eventType = 'DAILY_RECAP';
                if (eventType === 'TASK') eventType = 'TASK_DUE';

                let targetChannel = aturNotifMatch[2].toUpperCase();
                if (targetChannel === 'WA') targetChannel = 'WHATSAPP';
                if (targetChannel === 'KEDUANYA') targetChannel = 'BOTH';

                await setNotificationPreference(message.author.id, eventType, targetChannel, true);
                return message.reply(`✅ Siap ${preferredName}! Notifikasi **${eventType}** kini akan dikirimkan ke **${targetChannel}**.`);
            } catch (err) {
                return message.reply(`⚠️ Gagal mengubah preferensi: ${err.message}`);
            }
        }

        const jamTenangMatch = (cleanedContent || rawText).match(/^!notif\s+jam-tenang\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})$/i);
        if (jamTenangMatch) {
            try {
                const startTime = jamTenangMatch[1];
                const endTime = jamTenangMatch[2];
                await setNotificationPreference(message.author.id, 'REMINDER', 'BOTH', true, startTime, endTime);
                await setNotificationPreference(message.author.id, 'DAILY_BRIEFING', 'BOTH', true, startTime, endTime);
                await setNotificationPreference(message.author.id, 'DAILY_RECAP', 'BOTH', true, startTime, endTime);
                return message.reply(`🌙 Siap ${preferredName}! Jam Tenang telah diatur dari pukul **${startTime}** sampai **${endTime} WIB**. Pada jam tersebut, Jarvis tidak akan mengirimkan notifikasi.`);
            } catch (err) {
                return message.reply(`⚠️ Gagal mengatur jam tenang: ${err.message}`);
            }
        }

        // 6. Broadcast Serentak ke Seluruh Pengguna (Khusus Admin / Owner)
        const broadcastMatch = (cleanedContent || rawText).match(/^!(?:broadcast|pengumuman|siarkan)(?:\s+(all|wa|whatsapp|discord))?\s+([\s\S]+)$/i);
        if (broadcastMatch) {
            const isAuth = await isAuthorizedAdmin(message.author.id);
            if (!isAuth) {
                return message.reply(`⛔ Maaf ${preferredName}, fitur broadcast hanya dapat digunakan oleh **Owner** atau **Admin** Jarvis!`);
            }

            let target = (broadcastMatch[1] || 'ALL').toUpperCase();
            if (target === 'WA') target = 'WHATSAPP';
            const bMessage = broadcastMatch[2].trim();

            const statusMsg = await message.reply(`📢 Memulai pengiriman broadcast ke seluruh pengguna terdaftar (Target: **${target}**)...`);
            const bRes = await broadcastMessage({
                message: bMessage,
                targetChannel: target,
                senderUserId: message.author.id,
                discordClient: client,
            });

            if (bRes.success) {
                return statusMsg.edit(`✅ **Broadcast Selesai Terkirim!**\n• Target Channel: \`${target}\`\n• Berhasil: **${bRes.delivered}** pengguna\n• Gagal: **${bRes.failed}** pengguna\n• Total Terdaftar: **${bRes.total}** akun`);
            } else {
                return statusMsg.edit(`❌ Gagal mengirim broadcast: ${bRes.error}`);
            }
        }

        // --- FITUR KEPRIBADIAN SUARA & ADVANCED VOICE (PHASE 4) ---
        // 1. Interupsi Manual di Chat (!stop voice / !diam / amba diam / amba stop voice)
        if (/^(!diam|diam|stop\s*voice|stop\s*ngomong|berhenti\s*ngomong|cukup)$/i.test(cleanedContent || rawText)) {
            if (message.guild && isSpeakingInVoice(message.guild.id)) {
                interruptVoice(message.guild.id);
                return message.reply(`🛑 Siap ${preferredName}! Pembicaraan di Voice Channel langsung Amba hentikan.`);
            }
        }

        // 2. Tampilkan Pengaturan Suara (!voice / amba voice)
        if (/^(!voice|!suara|voice|suara)$/i.test(cleanedContent || rawText)) {
            try {
                const pref = await getUserVoicePreference(message.author.id);
                const dispName = message.author.displayName || message.author.username;
                return message.reply({ embeds: [getVoiceSettingsEmbed(pref, dispName)] });
            } catch (err) {
                return message.reply(`⚠️ Gagal mengambil pengaturan suara: ${err.message}`);
            }
        }

        // 3. Ubah Karakter Suara (!voice set <nama>)
        const voiceSetMatch = (cleanedContent || rawText).match(/^(!voice|voice|suara)\s+set\s+(.+)$/i);
        if (voiceSetMatch) {
            const chosen = voiceSetMatch[2].toLowerCase().trim();
            const voiceKey = Object.keys(AVAILABLE_VOICES).find(
                (k) => k === chosen || AVAILABLE_VOICES[k].name.toLowerCase() === chosen
            );

            if (voiceKey) {
                const target = AVAILABLE_VOICES[voiceKey];
                try {
                    await setUserVoicePreference(message.author.id, {
                        voice_id: target.id,
                        language: target.language.includes('English') ? 'en-US' : 'id-ID',
                    });
                    return message.reply(`🎙️ Karakter suara berhasil diubah ke **${target.name}** (${target.gender})!\n*${target.desc}*`);
                } catch (err) {
                    return message.reply(`⚠️ Gagal mengubah suara: ${err.message}`);
                }
            } else {
                return message.reply(
                    `Pilihan suara **"${chosen}"** tidak ditemukan, Bos.\n` +
                    `Pilihan yang tersedia: **ardi** (Pria Indo), **gadis** (Wanita Indo), **guy** (Pria English), **jenny** (Wanita English).\n` +
                    `Contoh: \`!voice set gadis\``
                );
            }
        }

        // 4. Ubah Kecepatan Suara (!voice speed <nilai>)
        const voiceSpeedMatch = (cleanedContent || rawText).match(/^(!voice|voice|suara)\s+speed\s+(.+)$/i);
        if (voiceSpeedMatch) {
            const rawSpeed = voiceSpeedMatch[2].toLowerCase().trim();
            let finalSpeed = '+0%';
            if (rawSpeed === 'cepat' || rawSpeed === 'fast') finalSpeed = '+15%';
            else if (rawSpeed === 'lambat' || rawSpeed === 'slow') finalSpeed = '-15%';
            else if (rawSpeed === 'sangat cepat') finalSpeed = '+30%';
            else if (rawSpeed === 'normal') finalSpeed = '+0%';
            else if (/^[+-]?\d+%$/.test(rawSpeed)) finalSpeed = rawSpeed.startsWith('+') || rawSpeed.startsWith('-') ? rawSpeed : `+${rawSpeed}`;

            try {
                await setUserVoicePreference(message.author.id, { speed: finalSpeed });
                return message.reply(`⚡ Kecepatan bicara berhasil diatur ke **${finalSpeed}**!`);
            } catch (err) {
                return message.reply(`⚠️ Gagal mengatur kecepatan suara: ${err.message}`);
            }
        }

        // 5. Ubah Gaya Respon AI (!voice style <santai/singkat/detail>)
        const voiceStyleMatch = (cleanedContent || rawText).match(/^(!voice|voice|suara)\s+style\s+(.+)$/i);
        if (voiceStyleMatch) {
            const rawStyle = voiceStyleMatch[2].toLowerCase().trim();
            let finalStyle = 'CASUAL';
            if (rawStyle.includes('singkat') || rawStyle === 'short') finalStyle = 'SHORT';
            else if (rawStyle.includes('detail') || rawStyle === 'detailed') finalStyle = 'DETAILED';
            else finalStyle = 'CASUAL';

            try {
                await setUserVoicePreference(message.author.id, { style: finalStyle });
                return message.reply(`💬 Gaya balasan AI berhasil diatur ke **${finalStyle}**!`);
            } catch (err) {
                return message.reply(`⚠️ Gagal mengatur gaya respons: ${err.message}`);
            }
        }

        // --- FITUR WEB INTELLIGENCE (PHASE 5 - SECTION 46 & 47) ---
        // Shortcut Command Cepat Awalan '!' (Untuk menampilkan Embed Card langsung)
        // 1. Pencarian Web Shortcut (!search <query> / !cari <query>)
        const searchMatch = (cleanedContent || rawText).match(/^(!search|!cari)\s+(.+)$/i);
        if (searchMatch) {
            const query = searchMatch[2].trim();
            const typingInterval = setInterval(() => message.channel.sendTyping().catch(() => {}), 4000);
            try {
                const results = await searchWeb(query, 5);
                clearInterval(typingInterval);
                if (!results || results.length === 0) {
                    return message.reply(`🔍 Maaf Bos, Amba tidak menemukan hasil yang cocok di web untuk: **"${query}"**.`);
                }
                const embed = getWebSearchEmbed(query, results);
                return message.reply({ embeds: [embed] });
            } catch (err) {
                clearInterval(typingInterval);
                return message.reply(`⚠️ Gagal mencari di web: ${err.message}`);
            }
        }

        // 2. Info Cuaca Real-Time Shortcut (!cuaca <kota> / !weather <kota>)
        const weatherMatch = (cleanedContent || rawText).match(/^(!cuaca|!weather)(\s+(.+))?$/i);
        if (weatherMatch) {
            const city = weatherMatch[3] ? weatherMatch[3].trim() : 'Jakarta';
            const typingInterval = setInterval(() => message.channel.sendTyping().catch(() => {}), 4000);
            try {
                const weatherData = await getWeather(city);
                clearInterval(typingInterval);
                const embed = getWeatherEmbed(weatherData);
                return message.reply({ embeds: [embed] });
            } catch (err) {
                clearInterval(typingInterval);
                return message.reply(`⚠️ ${err.message}`);
            }
        }

        // 3. Baca & Rangkum URL Web Shortcut (!baca <url> / !rangkum <url>)
        const extractMatch = (cleanedContent || rawText).match(/^(!baca|!rangkum)\s+(https?:\/\/\S+)$/i);
        if (extractMatch) {
            const targetUrl = extractMatch[2].trim();
            const statusMsg = await message.reply('🌐 Sedang membuka dan membaca isi halaman web, tunggu sebentar ya Bos...').catch(() => null);
            try {
                const extracted = await fetchAndExtractUrl(targetUrl);
                const promptForAi = `Tolong buatkan rangkuman yang padat, jelas, dan informatif dalam bahasa Indonesia dari artikel web berikut:\nJudul: "${extracted.title}"\nSumber: ${extracted.url}\n\nIsi Artikel:\n${extracted.content}\n\nBerikan poin-poin penting dan sertakan link sumber di akhir rangkuman.`;
                if (statusMsg) statusMsg.delete().catch(() => {});
                return processBotRequest(message, promptForAi, false);
            } catch (err) {
                if (statusMsg) statusMsg.delete().catch(() => {});
                return message.reply(`⚠️ ${err.message}`);
            }
        }

        // --- FITUR PERSONAL ANALYTICS & INSIGHTS (PHASE 6) ---
        // Command Shortcut (!analytics [finance|task|week|month] / !analisis / amba analytics)
        const analyticsMatch = (cleanedContent || rawText).match(/^(!analytics|!analisis|!stats|!insight|analytics|analisis|stats|insight)(\s+(finance|keuangan|task|tugas|week|minggu|month|bulan|all|semua))?$/i);
        if (analyticsMatch) {
            const subArg = (analyticsMatch[3] || '').toLowerCase().trim();
            const dispName = message.author.displayName || message.author.username;
            const typingInterval = setInterval(() => message.channel.sendTyping().catch(() => {}), 4000);

            try {
                // Background sync daily metrics
                syncDailyMetrics(message.author.id).catch(() => {});

                if (subArg === 'finance' || subArg === 'keuangan') {
                    const finData = await getFinanceAnalytics(message.author.id, 'this_month');
                    clearInterval(typingInterval);
                    return message.reply({ embeds: [getFinanceAnalyticsEmbed(dispName, finData)] });
                }

                if (subArg === 'task' || subArg === 'tugas') {
                    const taskData = await getTaskAnalytics(message.author.id, 'this_month');
                    clearInterval(typingInterval);
                    return message.reply({ embeds: [getTaskAnalyticsEmbed(dispName, taskData)] });
                }

                const period = (subArg === 'week' || subArg === 'minggu') ? 'this_week' : 'this_month';
                const fullReport = await getFullAnalyticsReport(message.author.id, period);
                clearInterval(typingInterval);
                return message.reply({ embeds: [getAnalyticsDashboardEmbed(dispName, fullReport)] });
            } catch (err) {
                clearInterval(typingInterval);
                return message.reply(`⚠️ Gagal menyusun laporan analitik: ${err.message}`);
            }
        }

        // --- FITUR KEAMANAN, RBAC & AUDIT LOGS (PHASE 7) ---
        // 1. Cek Role Pribadi (!myrole / !role my / !role)
        const myRoleMatch = (cleanedContent || rawText).match(/^(!myrole|!role(\s+my)?|myrole|role\s+my|role\s+gue)$/i);
        if (myRoleMatch) {
            const role = await security.getUserRole(message.author.id, true);
            return message.reply({ embeds: [getUserRoleEmbed(message.author, role)] });
        }

        // 2. Daftar Pengguna Khusus (!role list)
        if (/^(!role\s+list|role\s+list)$/i.test(cleanedContent || rawText)) {
            const hasAdmin = await security.hasMinimumRole(message.author.id, 'ADMIN');
            if (!hasAdmin) {
                return message.reply('⚠️ Akses ditolak. Perintah `!role list` hanya dapat diakses oleh **ADMIN** atau **OWNER**.');
            }
            const privileged = await security.listPrivilegedUsers();
            return message.reply({ embeds: [getRoleListEmbed(privileged)] });
        }

        // 3. Inspeksi Role User Tertentu (!role check @user / !role check <userId>)
        const checkRoleMatch = (cleanedContent || rawText).match(/^!role\s+check\s+(<@!?(\d+)>|(\d+))$/i);
        if (checkRoleMatch) {
            const hasAdmin = await security.hasMinimumRole(message.author.id, 'ADMIN');
            if (!hasAdmin) {
                return message.reply('⚠️ Akses ditolak. Perintah `!role check` hanya dapat diakses oleh **ADMIN** atau **OWNER**.');
            }
            const targetId = checkRoleMatch[2] || checkRoleMatch[3];
            let targetUser = await client.users.fetch(targetId).catch(() => null);
            if (!targetUser) {
                targetUser = { id: targetId, username: `User_${targetId}`, displayName: `User_${targetId}` };
            }
            const targetRole = await security.getUserRole(targetId, true);
            return message.reply({ embeds: [getUserRoleEmbed(targetUser, targetRole)] });
        }

        // 4. Atur Role User (!role set @user <ROLE> [notes]) - OWNER Only
        const setRoleMatch = (cleanedContent || rawText).match(/^!role\s+set\s+(<@!?(\d+)>|(\d+))\s+(OWNER|ADMIN|USER|GUEST|BLOCKED)(?:\s+(.+))?$/i);
        if (setRoleMatch) {
            const isOwner = await security.hasMinimumRole(message.author.id, 'OWNER');
            if (!isOwner) {
                await security.logAudit({
                    userId: message.author.id,
                    action: 'UNAUTHORIZED_ROLE_SET',
                    riskLevel: 'HIGH',
                    status: 'BLOCKED',
                    metadata: { attemptedTarget: setRoleMatch[2] || setRoleMatch[3], attemptedRole: setRoleMatch[4] },
                });
                return message.reply('⛔ Akses ditolak! Hanya **OWNER** yang memiliki wewenang untuk mengatur atau mengubah role pengguna.');
            }
            const targetId = setRoleMatch[2] || setRoleMatch[3];
            const newRole = setRoleMatch[4].toUpperCase();
            const notes = setRoleMatch[5] || `Assigned via Discord command by ${message.author.tag}`;
            const result = await security.setUserRole(targetId, newRole, message.author.id, notes);
            return message.reply(result.message);
        }

        // 5. Inspeksi Jejak Audit Keamanan (!audit [limit] [risk]) - ADMIN/OWNER Only
        const auditMatch = (cleanedContent || rawText).match(/^(!audit|!auditlog)(\s+(\d+))?(\s+(low|medium|high|critical))?$/i);
        if (auditMatch) {
            const hasAdmin = await security.hasMinimumRole(message.author.id, 'ADMIN');
            if (!hasAdmin) {
                return message.reply('⚠️ Akses ditolak. Hanya **ADMIN** atau **OWNER** yang dapat menginspeksi audit log keamanan.');
            }
            const limit = parseInt(auditMatch[3], 10) || 10;
            const filterRisk = auditMatch[5] || null;
            const logs = await security.getRecentAuditLogs(limit, filterRisk);
            return message.reply({ embeds: [getAuditLogsEmbed(logs, filterRisk)] });
        }

        // 6. Ringkasan Status Keamanan Sistem (!security / !safety)
        if (/^(!security|!safety|status\s*keamanan)$/i.test(cleanedContent || rawText)) {
            try {
                const statsRes = await require('./db').query(`
                    SELECT 
                        COUNT(*) as total_logs,
                        COUNT(*) FILTER (WHERE status = 'BLOCKED') as blocked_logs,
                        COUNT(*) FILTER (WHERE risk_level IN ('HIGH', 'CRITICAL')) as high_risk_logs
                    FROM audit_logs
                `);
                const row = statsRes.rows[0] || {};
                return message.reply({
                    embeds: [getSecurityStatusEmbed({
                        totalLogs: parseInt(row.total_logs || '0', 10),
                        blockedLogs: parseInt(row.blocked_logs || '0', 10),
                        highRiskLogs: parseInt(row.high_risk_logs || '0', 10),
                    })]
                });
            } catch (err) {
                return message.reply(`⚠️ Gagal mengambil status keamanan: ${err.message}`);
            }
        }

        // --- FITUR RELIABILITY, OBSERVABILITY & HEALTH CHECK (PHASE 8) ---
        // 1. Health Check & Diagnostik Sistem (!ping / !health / !status / !diagnostik / amba status)
        const healthMatch = (cleanedContent || rawText).match(/^(!ping|!health|!status|!diagnostik|ping|health|status|diagnostik)$/i);
        if (healthMatch) {
            try {
                const wsPing = client.ws.ping;
                const healthData = await getCompleteHealthStatus(wsPing);
                return message.reply({ embeds: [getHealthStatusEmbed(healthData)] });
            } catch (err) {
                return message.reply(`⚠️ Gagal memeriksa kesehatan sistem: ${err.message}`);
            }
        }

        // --- SISTEM KONFIRMASI AKSI BERISIKO TINGGI (PHASE 2 - SECTION 27 & 28) ---
        const pendingConf = getPendingConfirmation(message.author.id);
        const lowerInput = (cleanedContent || rawText).toLowerCase();

        if (pendingConf) {
            if (/^(ya|ya\s*lanjut|lanjut|iya|oke|gas|eksekusi|confirm)$/i.test(lowerInput)) {
                clearPendingConfirmation(message.author.id);
                await message.reply(`⚡ Konfirmasi diterima! Menjalankan aksi: **${pendingConf.type}**...`).catch(() => {});
                return processBotRequest(message, `[CONFIRMED_ACTION] ${pendingConf.originalCommand}`, false);
            } else if (/^(batal|cancel|nggak|enggak|jangan|tidak)$/i.test(lowerInput)) {
                clearPendingConfirmation(message.author.id);
                return message.reply('🛡️ Aksi dibatalkan. Seluruh data Bos tetap aman!');
            }
        }

        const highRisk = isHighRiskAction(cleanedContent || rawText);
        if (highRisk && !cleanedContent.startsWith('[CONFIRMED_ACTION]')) {
            // Verifikasi Perizinan Role: Aksi destruktif massal hanya diizinkan untuk OWNER (Phase 7 RBAC Guard)
            const isOwner = await security.hasMinimumRole(message.author.id, 'OWNER');
            if (!isOwner) {
                await security.logAudit({
                    userId: message.author.id,
                    action: highRisk.type,
                    riskLevel: 'HIGH',
                    status: 'BLOCKED',
                    metadata: { command: cleanedContent || rawText, reason: 'Non-owner attempted high risk action' },
                });
                return message.reply(`⛔ Akses ditolak! Aksi pembersihan atau reset massal (\`${highRisk.type}\`) hanya boleh dijalankan oleh **OWNER**.`);
            }

            setPendingConfirmation(message.author.id, {
                type: highRisk.type,
                originalCommand: cleanedContent || rawText,
            });
            return message.reply(
                `⚠️ **PERINGATAN AKSI BERISIKO TINGGI!**\n` +
                `${highRisk.warning}\n\n` +
                `Apakah ${preferredName} benar-benar yakin ingin melanjutkan?\n` +
                `• Ketik **'ya lanjut'** untuk mengeksekusi.\n` +
                `• Ketik **'batal'** untuk membatalkan.`
            );
        }

        // Jika user cuma mention bot atau cuma ketik sapaan ("halo amba", "amba", "hai amba", @Amba)
        let textToProcess = cleanedContent;
        if (!textToProcess || textToProcess.toLowerCase() === 'amba') {
            textToProcess = rawText.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim() || 'Halo Amba';
        }

        // Jalankan pemrosesan dinamis ke AI n8n
        return processBotRequest(message, textToProcess, false);
    }

    // KASUS B: Ada Pesan Suara (Voice Note / Audio File)
    // Tampilkan log dan mulai proses transkripsi suara
    console.log(`🎤 Menerima file audio/voice message (${audioAttachment.name}) dari ${message.author.tag}`);

    // Indikator typing agar user tahu bot sedang mendengarkan & memproses
    await message.channel.sendTyping().catch(() => {});
    const typingInterval = setInterval(() => {
        message.channel.sendTyping().catch(() => {});
    }, 5000);

    let transcript = '';
    try {
        const audioBuffer = await downloadToBuffer(audioAttachment.url);
        transcript = await transcribeAudio(
            audioBuffer,
            audioAttachment.contentType,
            process.env.GEMINI_API_KEY
        );
    } catch (sttErr) {
        clearInterval(typingInterval);
        console.error('❌ Gagal transkripsi audio:', sttErr.message);
        if (isDM || isReplyToBot || textHasTrigger) {
            const voiceGreeting = await resolveUserGreetingInfo(message.author, message.member);
            await message.reply(`Aduh ${voiceGreeting.preferredName}, rekaman suaranya kurang jelas nih atau gagal diproses. Boleh diulang?`).catch(() => {});
        }
        return;
    }

    console.log(`🗣️ Transkripsi Audio: "${transcript}"`);

    // Periksa apakah pesan suara ini ditujukan untuk bot:
    // 1. Di DM -> selalu proses
    // 2. Me-reply bot -> selalu proses
    // 3. Teks caption ada trigger amba -> proses
    // 4. Di dalam rekaman suara terdengar kata "amba" atau "jarvis" -> PROSES!
    const audioHasTrigger = isDM || isReplyToBot || textHasTrigger || containsBotTrigger(transcript, botId);

    if (!audioHasTrigger) {
        clearInterval(typingInterval);
        console.log('🔇 Voice note diabaikan karena tidak menyebut "amba" atau "jarvis".');
        return;
    }

    const cleanedTranscript = cleanBotTrigger(transcript, botId) || transcript;
    return processBotRequest(message, cleanedTranscript, true, typingInterval);
});

/**
 * Memperkaya pesan percakapan dengan konteks Web Intelligence & Personal Analytics secara otomatis
 */
async function enrichMessageWithWebIntelligence(content, userId = null, greetingInfo = null) {
    if (!content || typeof content !== 'string') return content;
    let enriched = content;

    // 1. URL Extractor (Mendeteksi link artikel/web dalam kalimat obrolan)
    const urlMatch = content.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
        let rawUrl = urlMatch[0].replace(/[.,;:!?)\]>]+$/, '');
        try {
            console.log(`🌐 [Web Intelligence] Membaca URL: ${rawUrl}`);
            const article = await fetchAndExtractUrl(rawUrl);
            enriched += `\n\n[Konteks Artikel dari Web:\nJudul: "${article.title}"\nURL: ${article.url}\nIsi Konten:\n"${article.content.substring(0, 2000)}"\nInstruksi AI: Rangkum atau bahas isi artikel di atas secara alami sesuai pertanyaan pengguna.]`;
        } catch (err) {
            console.warn(`⚠️ [Web Intelligence] Gagal ekstrak URL: ${err.message}`);
        }
    }

    // 2. Cuaca Real-Time (Mendeteksi pertanyaan tentang cuaca/suhu/hujan/mendung/panas/dingin)
    const hasWeatherIntent = /\b(cuaca|suhu|hujan|mendung|panas|dingin|angin|gerimis|prakiraan cuaca)\b/i.test(content);
    if (hasWeatherIntent && !urlMatch) {
        let cityCandidate = null;

        // Pola 1: "cuaca di Bandung", "suhu di Surabaya", "hujan di Jakarta"
        const p1 = content.match(/\b(?:cuaca|suhu|hujan|mendung|panas|dingin|angin)\s+(?:di|daerah|wilayah|kota)?\s*([a-zA-Z\s]{3,25})/i);
        // Pola 2: "di Bandung lagi hujan ga", "di Jakarta cuaca gimana"
        const p2 = content.match(/\b(?:di|daerah|wilayah|kota)\s+([a-zA-Z\s]{3,25})\s+(?:lagi\s+)?(?:cuaca|suhu|hujan|mendung|panas|dingin)/i);

        let rawCandidate = (p1 && p1[1]) || (p2 && p2[1]) || '';

        // Bersihkan kata stop words percakapan
        let cleanCity = rawCandidate
            .replace(/\b(hari ini|sekarang|besok|lusa|malam ini|siang ini|pagi ini|sore ini|gimana|bagaimana|apa|apakah|dong|ya|kah|sih|nih|lagi|gak|nggak|ngga|bisa|tolong|coba|bos|amba)\b/gi, '')
            .trim();

        if (cleanCity.length >= 3) {
            cityCandidate = cleanCity.split(/\s+/).slice(0, 2).join(' ');
        } else {
            // Default jika tanya cuaca tanpa sebut nama kota ("gimana cuaca hari ini?")
            cityCandidate = 'Jakarta';
        }

        try {
            console.log(`☀️ [Web Intelligence] Mengambil cuaca real-time untuk: "${cityCandidate}"`);
            const w = await getWeather(cityCandidate);
            enriched += `\n\n[Data Cuaca Real-Time Web:\nWilayah: ${w.city}, ${w.region || ''} (${w.country})\nSuhu: ${w.temperature}°C (Terasa seperti ${w.feelsLike}°C)\nKondisi: ${w.weatherDescription}\nKelembapan: ${w.humidity}% | Kecepatan Angin: ${w.windSpeed} km/h\nCurah Hujan: ${w.precipitation} mm\nInstruksi AI: Gunakan data cuaca real-time di atas untuk menjawab obrolan pengguna dengan gaya ramah dan santai.]`;
        } catch (err) {
            console.warn(`⚠️ [Web Intelligence] Gagal ambil cuaca: ${err.message}`);
        }
    }

    // 3. Pencarian Web Faktual (Mendeteksi permintaan pencarian info/harga/berita/skor terkini)
    const searchTriggerMatch = content.match(/\b(?:coba\s+)?(?:cariin|carikan|cari|search|browsing|googling)\s+(?:dong\s+)?(?:info|tentang|soal|data|berita|kabar)?\s*(.+)/i) ||
                               content.match(/\b(?:siapa\s+pemenang|siapa\s+juara|skor\s+pertandingan|hasil\s+pertandingan)\s+(.+)/i) ||
                               content.match(/\b(?:berapa\s+harga|kapan\s+rilis|tanggal\s+rilis)\s+(.+)/i) ||
                               content.match(/\b(?:berita|kabar)\s+(?:terbaru|terkini|hari ini)\s+(?:tentang|soal)?\s*(.+)/i);

    if (searchTriggerMatch && !urlMatch && !hasWeatherIntent) {
        let rawQuery = searchTriggerMatch[1] || '';
        let cleanQuery = rawQuery
            .replace(/\b(dong|nih|ya|bos|amba|tolong|coba|di web|di google|di internet|apa|sih)\b/gi, '')
            .replace(/[?!.]+$/, '')
            .trim();

        if (cleanQuery.length >= 3) {
            try {
                console.log(`🔍 [Web Intelligence] Mencari di web: "${cleanQuery}"`);
                const results = await searchWeb(cleanQuery, 4);
                if (results && results.length > 0) {
                    let formattedResults = results.map((r, i) => `${i + 1}. Judul: "${r.title}"\n   Link: ${r.url}\n   Ringkasan: "${r.snippet}"`).join('\n\n');
                    enriched += `\n\n[Hasil Pencarian Web Terkini:\nQuery: "${cleanQuery}"\n${formattedResults}\n\nInstruksi AI: Jawab pertanyaan pengguna berdasarkan hasil pencarian web terkini di atas secara lugas, santai, dan sebutkan sumber link jika relevan.]`;
                }
            } catch (err) {
                console.warn(`⚠️ [Web Intelligence] Gagal search web: ${err.message}`);
            }
        }
    }

    // 4. Analitik Personal Real-Time (Phase 6: Mendeteksi pertanyaan analisis performa, keuangan & produktivitas)
    const hasAnalyticsIntent = /\b(analisis|analitik|analytics|performa|statistik|paling banyak|pos terbesar|efisiensi|produktivitas)\b.*\b(keuangan|pengeluaran|pemasukan|tugas|task|agenda|anggaran|pekerjaan)\b/i.test(content) ||
                               /\b(pengeluaran|belanja|pemasukan)\b.*\b(paling banyak|terbesar|berapa persen|bulan ini|minggu ini|evaluasi)\b/i.test(content);

    if (hasAnalyticsIntent && userId && !urlMatch) {
        try {
            console.log(`📊 [Analytics] Menarik data analitik personal untuk user ID ${userId}`);
            const period = /\b(minggu|week)\b/i.test(content) ? 'this_week' : 'this_month';
            const report = await getFullAnalyticsReport(userId, period);
            syncDailyMetrics(userId).catch(() => {});

            let topCatDesc = report.finance.categories.slice(0, 3).map((c) => `${c.category} (${c.formattedTotal}, ${c.percentage}%)`).join(', ') || 'Belum ada pengeluaran';

            enriched += `\n\n[Data Analitik Personal Real-Time Pengguna:
Periode: ${report.label}
Skor Produktivitas: ${report.performance.score}/100 (Grade ${report.performance.grade})
Finansial:
- Total Pengeluaran: ${report.finance.formattedExpense} ${report.finance.expenseChangePercent !== null ? `(Tren vs periode lalu: ${report.finance.expenseChangePercent >= 0 ? '+' : ''}${report.finance.expenseChangePercent}%)` : ''}
- Total Pemasukan: ${report.finance.formattedIncome}
- Saldo Bersih: ${report.finance.formattedNetBalance}
- Pos Kategori Terbesar: ${topCatDesc}
- Transaksi Terbesar: ${report.finance.largestExpense ? `${report.finance.largestExpense.formattedAmount} (${report.finance.largestExpense.description})` : 'Tidak ada'}
Tugas (Tasks):
- Selesai: ${report.tasks.completed}/${report.tasks.totalCreated} tugas (${report.tasks.completionRate}%)
- Sedang Dikerjakan: ${report.tasks.inProgress} | Menunggu: ${report.tasks.pending}
- Overdue: ${report.tasks.overdue} tugas
Pengingat (Reminders):
- Terkirim: ${report.reminders.sent} | Ditunda (Snoozed): ${report.reminders.snoozed} kali
Instruksi AI: Gunakan data analitik personal pengguna di atas untuk menjawab pertanyaan ${greetingInfo ? greetingInfo.preferredName : 'pengguna'} secara spesifik, akurat, ramah, dan berikan wawasan atau saran proaktif yang membangun.]`;
        } catch (err) {
            console.warn(`⚠️ [Analytics] Gagal menarik analitik: ${err.message}`);
        }
    }

    // 5. Informasi Role & Hak Akses (Phase 7: Keamanan & RBAC)
    const hasRoleIntent = /\b(role|hak akses|perizinan|wewenang|jabatan|izin)\b.*\b(gue|saya|aku|dia|user|akun)\b/i.test(content) ||
                          /\b(siapa\s*(aja\s*)?(owner|admin|pemilik|pengelola)\b)/i.test(content) ||
                          /\b(role\s*gue\s*apa|status\s*akun\s*gue)\b/i.test(content);

    if (hasRoleIntent && userId && !urlMatch) {
        try {
            const role = await security.getUserRole(userId);
            const privileged = await security.listPrivilegedUsers();
            const owners = privileged.filter(p => p.role === 'OWNER').map(p => p.display_name || p.discord_user_id).join(', ') || 'Belum diatur';
            const admins = privileged.filter(p => p.role === 'ADMIN').map(p => p.display_name || p.discord_user_id).join(', ') || 'Tidak ada';

            enriched += `\n\n[Data Keamanan & Hak Akses Pengguna:
User ID: ${userId}
Role Aktif: ${role.name} (${role.badge}, Level ${role.level}/4)
Deskripsi: ${role.description}
Owner Terdaftar: ${owners}
Admin Terdaftar: ${admins}
Instruksi AI: Jelaskan role dan hak akses pengguna secara akurat, percaya diri, dan santai berdasarkan data di atas.]`;
        } catch (err) {
            console.warn(`⚠️ [Security] Gagal menarik data role: ${err.message}`);
        }
    }

    // 6. Konteks Panggilan & Etiket Sapaan Pengguna
    if (greetingInfo) {
        if (greetingInfo.hasCustomCallsign) {
            enriched += `\n\n[Konteks Panggilan Pengguna:\n- Nama Asli/Discord: "${greetingInfo.cleanNickname}"\n- Panggilan Khusus yang Disepakati: "${greetingInfo.callsign}"\n- Instruksi AI: Pengguna ini sudah memiliki panggilan khusus ("${greetingInfo.callsign}"). Panggil pengguna ini secara konsisten dengan panggilan "${greetingInfo.callsign}".]`;
        } else {
            enriched += `\n\n[Konteks Panggilan Pengguna:\n- Nama/Nickname Discord: "${greetingInfo.cleanNickname}"\n- Status: Pengguna baru / belum mengatur panggilan khusus.\n- PENTING: Panggil pengguna dengan nama aslinya/nicknamenya ("${greetingInfo.cleanNickname}"). JANGAN memanggil "Bos" kepada pengguna ini kecuali jika pengguna sendiri yang meminta panggilan tersebut!]`;
        }

        // Jika isi pesan terdeteksi sebagai sapaan santai / greeting
        const isGreeting = /^(halo|hai|hey|yo|pagi|siang|sore|malam|permisi|assalamu|oy|oi|tes|test|halo amba|hai amba|amba)\b/i.test(content.trim()) ||
                           content.trim().length === 0 ||
                           content.trim().toLowerCase() === 'amba';
        if (isGreeting) {
            enriched += `\n\n[Instruksi Sapaan Khusus:\nPengguna sedang menyapa. Balas sapaan dengan ramah, santai, variatif, dan alami selayaknya asisten pintar yang asyik. JANGAN gunakan template kaku atau mengulang balasan yang sama!]`;
        }
    }

    return enriched;
}

/**
 * Mengirim payload ke n8n dan merespons ke Discord (Text / Voice / Both)
 */
async function processBotRequest(message, content, isVoiceInput, existingTypingInterval = null) {
    let typingInterval = existingTypingInterval;
    if (!typingInterval) {
        await message.channel.sendTyping().catch(() => {});
        typingInterval = setInterval(() => {
            message.channel.sendTyping().catch(() => {});
        }, 5000);
    }

    let agentRunId = null;

    // Ambil profil panggilan pengguna (callsign vs nickname asli)
    const greetingInfo = await resolveUserGreetingInfo(message.author, message.member);

    // Web Intelligence & Personal Analytics Context Injection untuk percakapan natural
    const finalContent = await enrichMessageWithWebIntelligence(content, message.author.id, greetingInfo);

    try {
        console.log(`📩 [${message.channel.name || 'DM'}] ${message.author.tag}: ${finalContent}`);

        // Catat lifecycle Agent Run (Phase 2)
        const authorDisplayName = greetingInfo.cleanNickname;
        agentRunId = await startAgentRun(
            message.author.id,
            null,
            finalContent,
            { channel: message.channel.name || 'DM', isVoiceInput },
            authorDisplayName
        ).catch(() => null);

        // Ambil memori aktif pengguna untuk konteks AI
        const userMemories = await getRelevantMemories(message.author.id, 8).catch(() => []);

        const payload = {
            schemaVersion: 1,
            source: 'discord',
            agentRunId: agentRunId,
            user: {
                id: message.author.id,
                username: message.author.username,
                displayName: greetingInfo.cleanNickname,
                callsign: greetingInfo.callsign,
                preferredGreetingName: greetingInfo.preferredName,
                hasCustomCallsign: greetingInfo.hasCustomCallsign,
            },
            userMemories: userMemories,
            guild: message.guild
                ? {
                      id: message.guild.id,
                      name: message.guild.name,
                  }
                : null,
            message: {
                id: message.id,
                content: finalContent,
                channelId: message.channel.id,
                channelName: message.channel.name || 'DM',
                isVoiceInput: isVoiceInput,
            },
            attachments: Array.from(message.attachments.values()).map((att) => ({
                id: att.id,
                name: att.name,
                url: att.url,
                contentType: att.contentType,
                size: att.size,
            })),
            timestamp: new Date().toISOString(),
        };

        // Bounded Retry Policy (Phase 8: Maksimal 2x retry dengan exponential backoff)
        const startAiTime = Date.now();
        let responseData = null;
        let attempt = 0;
        const maxRetries = 2;
        let backoffMs = 1500;

        while (attempt <= maxRetries) {
            attempt++;
            try {
                const res = await fetch(N8N_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(N8N_TIMEOUT_MS),
                });

                if (res.ok) {
                    responseData = await res.json().catch(() => null);
                    const durationMs = Date.now() - startAiTime;
                    recordAiRequest(durationMs, true);
                    break;
                }

                // Transient error 502/503/504
                if ([502, 503, 504].includes(res.status) && attempt <= maxRetries) {
                    console.warn(`⚠️ [Retry] n8n returned HTTP ${res.status}, mencoba ulang (${attempt}/${maxRetries}) dalam ${backoffMs}ms...`);
                    await new Promise((r) => setTimeout(r, backoffMs));
                    backoffMs *= 2;
                    continue;
                }

                throw new Error(`HTTP ${res.status} ${res.statusText}`);
            } catch (netErr) {
                if (attempt <= maxRetries && (netErr.name === 'TimeoutError' || netErr.code === 'ECONNRESET' || netErr.code === 'ECONNREFUSED')) {
                    console.warn(`⚠️ [Retry] n8n koneksi gagal (${netErr.message}), mencoba ulang (${attempt}/${maxRetries}) dalam ${backoffMs}ms...`);
                    await new Promise((r) => setTimeout(r, backoffMs));
                    backoffMs *= 2;
                    continue;
                }
                const durationMs = Date.now() - startAiTime;
                recordAiRequest(durationMs, false, netErr.message);
                throw netErr;
            }
        }

        const data = responseData;
        if (!data) {
            console.warn('⚠️ n8n merespons tanpa JSON body yang valid.');
            return;
        }

        if (data.replyText) {
            // Sanitasi Kredensial & Sensitive Data Guard (Phase 7)
            const cleanReplyText = security.sanitizeSensitiveData(data.replyText);
            const replyMode = determineReplyMode(finalContent, isVoiceInput, data.replyMode);
            const userVoicePref = await getUserVoicePreference(message.author.id);

            if (replyMode === 'voice') {
                // Hanya Voice Note (file audio saja tanpa teks)
                let audioPath = null;
                try {
                    audioPath = await generateTTS(cleanReplyText, userVoicePref.voice_id, userVoicePref.speed);
                    await message.reply({
                        files: [{ attachment: audioPath, name: 'jarvis-voice.mp3' }],
                    });
                    console.log(`🎙️ Balasan suara saja (Voice Only) berhasil dikirim ke #${message.channel.name || 'DM'}`);
                } catch (ttsErr) {
                    console.error('⚠️ Gagal generate TTS, fallback kirim teks:', ttsErr.message);
                    await message.reply(cleanReplyText);
                } finally {
                    if (audioPath) cleanupAudio(audioPath);
                }
            } else if (replyMode === 'both') {
                // Keduanya (Teks + File Audio Voice Note)
                let audioPath = null;
                try {
                    audioPath = await generateTTS(cleanReplyText, userVoicePref.voice_id, userVoicePref.speed);
                    await message.reply({
                        content: cleanReplyText,
                        files: [{ attachment: audioPath, name: 'jarvis-voice.mp3' }],
                    });
                    console.log(`🎙️💬 Balasan keduanya (Teks + Voice) berhasil dikirim ke #${message.channel.name || 'DM'}`);
                } catch (ttsErr) {
                    console.error('⚠️ Gagal generate TTS, fallback kirim teks:', ttsErr.message);
                    await message.reply(cleanReplyText);
                } finally {
                    if (audioPath) cleanupAudio(audioPath);
                }
            } else {
                // Hanya Teks (Chat Only)
                await message.reply(cleanReplyText);
                console.log(`💬 Balasan teks saja (Chat Only) berhasil dikirim ke #${message.channel.name || 'DM'}`);
            }

            // Catat log interaksi ke tabel conversations (Short-Term Memory audit log)
            recordConversation(
                message.author.id,
                message.channel.id,
                isVoiceInput ? 'VOICE_NOTE' : 'TEXT',
                replyMode,
                finalContent,
                data.replyText,
                { channelName: message.channel.name || 'DM' }
            ).catch((err) => console.error('⚠️ Gagal mencatat percakapan:', err.message));

            // Selesaikan status Agent Run (Phase 2)
            if (agentRunId) {
                finishAgentRun(agentRunId, 'COMPLETED', null, { replyMode }).catch(() => {});
            }
        }
    } catch (error) {
        if (agentRunId) {
            finishAgentRun(agentRunId, 'FAILED', error.message).catch(() => {});
        }
        if (error.name === 'TimeoutError') {
            console.error(`⏱️ Request ke n8n timeout setelah ${N8N_TIMEOUT_MS}ms`);
            await message.reply(`Aduh ${greetingInfo.preferredName}, responnya lagi lambat banget nih dari otak AI. Boleh dicoba ketik ulang?`).catch(() => {});
        } else {
            console.error('❌ Gagal memproses pesan:', error.message);
            await message.reply(`Waduh ${greetingInfo.preferredName}, koneksi ke otak AI gue lagi ada kendala nih. Coba lagi bentar ya!`).catch(() => {});
        }
    } finally {
        clearInterval(typingInterval);
    }
}

// Map untuk melacak teks terakhir yang diucapkan bot per guild demi mencegah echo dari mic user
const lastBotSpeechMap = new Map();

/**
 * Menangani rekaman suara saat pengguna berbicara di Voice Channel
 */
async function handleVoiceChannelAudio(userId, wavBuffer, guildId, textChannel = null) {
    console.log(`🎤 [VC] Suara terdeteksi dari user ID ${userId} (${wavBuffer.length} bytes)`);
    let agentRunId = null;
    try {
        const transcript = await transcribeAudio(
            wavBuffer,
            'audio/wav',
            process.env.GEMINI_API_KEY
        );

        if (!transcript || !transcript.trim()) return;

        console.log(`🗣️ [VC Audio] "${transcript}"`);

        const botId = client.user.id;
        const cleanedText = cleanBotTrigger(transcript, botId) || transcript.trim();

        // Abaikan audio jika terlalu pendek atau hanya desahan
        if (!cleanedText || cleanedText.length < 2) {
            return;
        }

        // Interupsi Instan: Jika user bilang "diam", "stop", "cukup", atau "berhenti"
        if (/^(\b(diam|stop|berhenti|cukup|stahp|shut up)\b)/i.test(cleanedText)) {
            console.log(`🛑 [VC Interruption] User memerintahkan bot diam di guild ${guildId}`);
            interruptVoice(guildId);
            return;
        }

        // Anti-Echo Check: Pastikan audio bukan pantulan dari apa yang baru saja diucapkan bot
        const recentBotSpeech = lastBotSpeechMap.get(guildId);
        if (recentBotSpeech && Date.now() - recentBotSpeech.timestamp < 10000) {
            const normInput = cleanedText.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
            if (normInput.length >= 6 && recentBotSpeech.text.includes(normInput)) {
                console.log(`🔇 [VC Echo Ignored] Mendeteksi pantulan suara bot sendiri: "${cleanedText}"`);
                return;
            }
        }

        const guild = client.guilds.cache.get(guildId);
        const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
        const author = member ? member.user : await client.users.fetch(userId).catch(() => null);
        const greetingInfo = await resolveUserGreetingInfo(author || { id: userId, username: 'VoiceUser' }, member);

        // Catat lifecycle Agent Run (Phase 2)
        agentRunId = await startAgentRun(
            userId,
            null,
            cleanedText,
            { channel: textChannel ? textChannel.name : 'VoiceChannel', isVoiceInput: true, mode: 'VOICE_CHANNEL', guildId },
            greetingInfo.cleanNickname
        ).catch(() => null);

        // Web Intelligence & Personal Analytics Context Injection untuk percakapan suara di Voice Channel
        const enrichedVoiceContent = await enrichMessageWithWebIntelligence(cleanedText, userId, greetingInfo);

        // Ambil memori aktif pengguna untuk konteks AI di VC
        const userMemories = await getRelevantMemories(userId, 8).catch(() => []);

        const payload = {
            schemaVersion: 1,
            source: 'discord-voice',
            agentRunId: agentRunId,
            user: {
                id: userId,
                username: author ? author.username : 'VoiceUser',
                displayName: greetingInfo.cleanNickname,
                callsign: greetingInfo.callsign,
                preferredGreetingName: greetingInfo.preferredName,
                hasCustomCallsign: greetingInfo.hasCustomCallsign,
            },
            userMemories: userMemories,
            guild: { id: guildId },
            message: {
                id: Date.now().toString(),
                content: enrichedVoiceContent,
                channelId: textChannel ? textChannel.id : null,
                channelName: textChannel ? textChannel.name : 'VoiceChannel',
                isVoiceInput: true,
            },
            attachments: [],
            timestamp: new Date().toISOString(),
        };

        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(N8N_TIMEOUT_MS),
        });

        if (!response.ok) {
            if (agentRunId) {
                finishAgentRun(agentRunId, 'FAILED', `n8n returned HTTP ${response.status}`).catch(() => {});
            }
            return;
        }

        const data = await response.json().catch(() => null);
        if (data && data.replyText) {
            console.log(`🎙️ [VC Speak] Membalas via suara di VC: "${data.replyText}"`);

            // Simpan riwayat ucapan bot untuk anti-echo detection
            lastBotSpeechMap.set(guildId, {
                text: data.replyText.toLowerCase().replace(/[^a-z0-9]/g, ' '),
                timestamp: Date.now(),
            });

            const userVoicePref = await getUserVoicePreference(userId);
            // Putar balasan suara di Voice Channel dengan preferensi user
            await speakInVoice(guildId, data.replyText, userVoicePref.voice_id, userVoicePref.speed);

            // Catat log interaksi VC ke tabel conversations (tanpa nyepam chat teks ke channel publik)
            recordConversation(
                userId,
                textChannel ? textChannel.id : 'VoiceChannel',
                'VOICE_CHANNEL',
                'VOICE',
                cleanedText,
                data.replyText,
                { guildId }
            ).catch(() => {});

            // Selesaikan Agent Run
            if (agentRunId) {
                finishAgentRun(agentRunId, 'COMPLETED', null, { replyMode: 'voice' }).catch(() => {});
            }
        }
    } catch (err) {
        if (agentRunId) {
            finishAgentRun(agentRunId, 'FAILED', err.message).catch(() => {});
        }
        console.error('❌ Gagal memproses obrolan suara di Voice Channel:', err.message);
    }
}

// Listener HTTP internal untuk notifikasi proaktif & Health Check (Phase 8)
const notifyServer = http.createServer(async (req, res) => {
    // 1. Endpoint Health Check (Phase 8)
    if (req.method === 'GET' && req.url === '/health') {
        try {
            const wsPing = client.ws.ping;
            const healthData = await getCompleteHealthStatus(wsPing);
            const httpCode = healthData.overallStatus === 'UNHEALTHY' ? 503 : 200;
            res.writeHead(httpCode, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(healthData, null, 2));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ERROR', error: err.message }));
        }
    }

    // 2. Endpoint Notifikasi Proaktif (Reminder dari n8n Scheduler)
    if (req.method === 'POST' && req.url === '/api/notify') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                if (!data.channelId || !data.text) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'channelId dan text wajib diisi' }));
                }

                // Smart Multi-Channel Notification Router (Phase 6)
                const notifRes = await sendSmartNotification({
                    userId: data.userId,
                    eventType: 'REMINDER',
                    text: data.text,
                    context: { channelId: data.channelId, reminderId: data.reminderId },
                    discordClient: client,
                });

                if (data.reminderId) {
                    handleRecurringReminder(data.reminderId).catch((err) =>
                        console.error('⚠️ Gagal memproses recurring reminder:', err.message)
                    );
                }

                if (notifRes.success) {
                    const deliveredChannels = notifRes.results.filter(r => r.success).map(r => r.channel);
                    console.log(`⏰ Notifikasi pengingat #${data.reminderId || ''} berhasil dikirim via [${deliveredChannels.join(', ')}]`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: true, channels: deliveredChannels }));
                } else {
                    console.log(`ℹ️ [Notification] Pengingat #${data.reminderId || ''} tidak terkirim: ${notifRes.reason}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, reason: notifRes.reason }));
                }
            } catch (err) {
                console.error('❌ Gagal mengirim notifikasi pengingat:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // 3. Endpoint Broadcast Serentak (Multi-Channel Announcement)
    if (req.method === 'POST' && req.url === '/api/broadcast') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                if (!data.message || !data.message.trim()) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'message wajib diisi' }));
                }

                const result = await broadcastMessage({
                    message: data.message,
                    targetChannel: data.target || data.channel || 'ALL',
                    senderUserId: data.userId || null,
                    discordClient: client,
                });

                res.writeHead(result.success ? 200 : 403, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(result));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // 4. Endpoint Webhook WhatsApp Meta (Phase 1 & Phase 2)
    if (req.url && req.url.startsWith('/webhook/whatsapp')) {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        if (req.method === 'GET') {
            return handleWebhookVerification(req, res, parsedUrl);
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', async () => {
                await handleWebhookEvent(req, res, body);
            });
            return;
        }
    }

    res.writeHead(404);
    res.end();
});

notifyServer.listen(NOTIFY_PORT, '0.0.0.0', () => {
    console.log(`🔔 Listener notifikasi internal aktif di port ${NOTIFY_PORT}`);
});

// Graceful Shutdown & Resource Cleanup (Phase 8: Reliability)
let isShuttingDown = false;
async function handleGracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n🛑 Menerima sinyal ${signal}. Memulai Graceful Shutdown Jarvis...`);

    try {
        if (notifyServer) {
            notifyServer.close();
            console.log('✅ HTTP Listener port 5001 ditutup.');
        }

        const fs = require('fs');
        const path = require('path');
        const tempDir = path.join(__dirname, 'temp_audio');
        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            files.forEach((f) => {
                try { fs.unlinkSync(path.join(tempDir, f)); } catch (_) {}
            });
            console.log(`✅ ${files.length} file temporary audio dibersihkan.`);
        }

        const db = require('./db');
        if (db.pool) {
            await db.pool.end();
            console.log('✅ PostgreSQL Connection Pool ditutup.');
        }

        client.destroy();
        console.log('✅ Discord Bot offline dengan aman. Sampai jumpa, Bos!');
    } catch (err) {
        console.error('⚠️ Error saat shutdown:', err.message);
    } finally {
        process.exit(0);
    }
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

client.login(process.env.DISCORD_TOKEN);
