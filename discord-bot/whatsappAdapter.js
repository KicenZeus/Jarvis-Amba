const fs = require('fs');
const channelService = require('./channelService');
const db = require('./db');
const { getRelevantMemories } = require('./memoryService');
const { transcribeAudio, analyzeImage, generateTTS, cleanupAudio } = require('./voiceService');

/**
 * ==============================================================================
 * Jarvis V2.1 Phase 5: WhatsApp Channel Adapter (Official Meta Cloud API)
 * Menghubungkan WhatsApp ke Jarvis Core: Teks, Voice Note (STT/TTS), & Gambar
 * ==============================================================================
 */

/**
 * 1. Verifikasi Webhook Meta (GET /webhook/whatsapp)
 * Meta mengirimkan: hub.mode, hub.verify_token, hub.challenge
 */
function handleWebhookVerification(req, res, urlObj) {
    const verifyToken = process.env.WA_VERIFY_TOKEN || 'jarvis_amba_wa_secret_2026';
    const mode = urlObj.searchParams.get('hub.mode');
    const token = urlObj.searchParams.get('hub.verify_token');
    const challenge = urlObj.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ [WhatsApp] Webhook Meta berhasil diverifikasi!');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end(challenge);
    } else {
        console.warn(`⚠️ [WhatsApp] Verifikasi webhook ditolak. Mode: ${mode}, Token diterima: ${token}`);
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Verification token mismatch');
    }
}

/**
 * 2. Mengunduh Media (Audio, Gambar, Dokumen) dari Meta Cloud API
 * @param {string} mediaId - ID media yang diberikan oleh Meta
 * @returns {Promise<{ buffer: Buffer, mimeType: string, fileSize: number }>}
 */
async function downloadMetaMedia(mediaId) {
    const accessToken = process.env.WA_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error('WA_ACCESS_TOKEN belum diset di .env');
    }

    // 1. Dapatkan direct URL dari Meta Graph API
    const metaRes = await fetch(`https://graph.facebook.com/v25.0/${mediaId}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!metaRes.ok) {
        const errJson = await metaRes.json().catch(() => null);
        throw new Error(`Gagal fetch media metadata (${mediaId}): HTTP ${metaRes.status} ${JSON.stringify(errJson)}`);
    }

    const metaData = await metaRes.json();
    const mediaUrl = metaData.url;
    const mimeType = metaData.mime_type || 'application/octet-stream';

    if (!mediaUrl) {
        throw new Error(`Media URL kosong dari Meta untuk media ID ${mediaId}`);
    }

    // 2. Unduh konten biner file
    const fileRes = await fetch(mediaUrl, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'Jarvis-Amba/2.1',
        },
    });

    if (!fileRes.ok) {
        throw new Error(`Gagal mengunduh biner media: HTTP ${fileRes.status}`);
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    return {
        buffer: Buffer.from(arrayBuffer),
        mimeType: mimeType,
        fileSize: metaData.file_size || arrayBuffer.byteLength,
    };
}

/**
 * 3. Mengunggah File Media ke Meta Cloud API untuk dikirimkan ke Pengguna
 * @param {Buffer} buffer - Buffer file biner
 * @param {string} mimeType - MIME type file (misal: 'audio/mpeg', 'image/jpeg')
 * @param {string} filename - Nama file
 * @returns {Promise<string>} Media ID dari Meta
 */
async function uploadMetaMedia(buffer, mimeType, filename = 'audio.mp3') {
    const accessToken = process.env.WA_ACCESS_TOKEN;
    const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
        throw new Error('WA_ACCESS_TOKEN atau WA_PHONE_NUMBER_ID belum diset di .env');
    }

    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, filename);
    formData.append('type', mimeType);
    formData.append('messaging_product', 'whatsapp');

    const res = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/media`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(`Gagal upload media ke Meta: HTTP ${res.status} ${JSON.stringify(err)}`);
    }

    const data = await res.json();
    return data.id;
}

/**
 * 4. Mengirim Pesan Teks ke WhatsApp Pengguna melalui Meta Cloud API
 * @param {string} to - Nomor telepon tujuan dengan kode negara (contoh: '6288991185737')
 * @param {string} text - Teks balasan dari Jarvis
 */
async function sendWhatsAppTextMessage(to, text) {
    const accessToken = process.env.WA_ACCESS_TOKEN;
    const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;

    if (!accessToken) {
        console.error('❌ [WhatsApp] Gagal mengirim pesan: WA_ACCESS_TOKEN belum diset di .env!');
        return { success: false, error: 'NO_ACCESS_TOKEN' };
    }

    const formattedText = channelService.formatForWhatsApp(text);
    const cleanTo = String(to).replace(/\D/g, '');
    const apiUrl = `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: {
            preview_url: false,
            body: formattedText,
        },
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('❌ [WhatsApp] Error dari Meta Cloud API:', data);
            return { success: false, error: data };
        }

        const outMsgId = data.messages?.[0]?.id || `out_${Date.now()}`;
        console.log(`📤 [WhatsApp] Balasan terkirim ke ${cleanTo} (Meta Message ID: ${outMsgId})`);

        // Catat pesan outbound ke database untuk audit trail
        try {
            await db.query(
                `INSERT INTO channel_messages (
                    channel_type, external_message_id, direction, message_type, status, content, created_at, processed_at
                 ) VALUES ('WHATSAPP', $1, 'OUTBOUND', 'TEXT', 'DELIVERED', $2, NOW(), NOW())
                 ON CONFLICT (channel_type, external_message_id) DO NOTHING;`,
                [outMsgId, formattedText]
            );
        } catch (_) {}

        return { success: true, data };
    } catch (err) {
        console.error('❌ [WhatsApp] Network error saat mengirim pesan ke Meta:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * 5. Mengirim Pesan Audio / Voice Note ke WhatsApp Pengguna
 * @param {string} to - Nomor telepon tujuan
 * @param {Buffer} audioBuffer - Buffer file MP3
 */
async function sendWhatsAppAudioMessage(to, audioBuffer) {
    const accessToken = process.env.WA_ACCESS_TOKEN;
    const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
    const cleanTo = String(to).replace(/\D/g, '');

    if (!accessToken || !phoneNumberId) {
        return { success: false, error: 'NO_CREDENTIALS' };
    }

    try {
        const mediaId = await uploadMetaMedia(audioBuffer, 'audio/mpeg', 'response.mp3');
        const apiUrl = `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanTo,
            type: 'audio',
            audio: {
                id: mediaId,
            },
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('❌ [WhatsApp] Error kirim pesan audio ke Meta:', data);
            return { success: false, error: data };
        }

        const outMsgId = data.messages?.[0]?.id || `out_audio_${Date.now()}`;
        console.log(`🎙️ [WhatsApp] Audio VN terkirim ke ${cleanTo} (Meta Message ID: ${outMsgId})`);

        try {
            await db.query(
                `INSERT INTO channel_messages (
                    channel_type, external_message_id, direction, message_type, status, created_at, processed_at
                 ) VALUES ('WHATSAPP', $1, 'OUTBOUND', 'AUDIO', 'DELIVERED', NOW(), NOW())
                 ON CONFLICT (channel_type, external_message_id) DO NOTHING;`,
                [outMsgId]
            );
        } catch (_) {}

        return { success: true, mediaId, outMsgId };
    } catch (err) {
        console.error('❌ [WhatsApp] Gagal mengirim pesan audio:', err.message);
        return { success: false, error: err.message };
    }
}

// In-Memory Rate Limiter per User Phone Number (Phase 7: Security & Rate Limit)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 menit
const MAX_REQUESTS_PER_WINDOW = 20; // 20 request per menit

function checkRateLimit(phone, text) {
    const now = Date.now();
    let record = rateLimitMap.get(phone);
    if (!record) {
        record = { timestamps: [], lastText: '', lastTime: 0 };
        rateLimitMap.set(phone, record);
    }

    // Bersihkan timestamp di luar jendela 1 menit
    record.timestamps = record.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

    // Deteksi spam pesan teks identik beruntun dalam 2 detik
    if (text && record.lastText === text && now - record.lastTime < 2000) {
        return { allowed: false, reason: 'DUPLICATE_SPAM' };
    }

    // Deteksi batas kuota per menit
    if (record.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
        return { allowed: false, reason: 'RATE_LIMIT_EXCEEDED' };
    }

    record.timestamps.push(now);
    record.lastText = text;
    record.lastTime = now;
    return { allowed: true };
}

/**
 * 6. Menangani Event Webhook dari Meta (POST /webhook/whatsapp)
 * Memproses pesan teks, rekaman suara (Voice Note STT), dan gambar masuk
 */
async function handleWebhookEvent(req, res, rawBody) {
    // Segera beri response HTTP 200 ke Meta agar tidak timeout / ditandai gagal
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'EVENT_RECEIVED' }));

    let body;
    try {
        body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch (e) {
        console.warn('⚠️ [WhatsApp] Payload bukan format JSON valid');
        return;
    }

    if (body.object !== 'whatsapp_business_account') {
        return;
    }

    const entries = body.entry || [];
    for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
            const value = change.value || {};
            const messages = value.messages || [];
            const contacts = value.contacts || [];

            // Abaikan status receipt (delivered/read/sent)
            if (value.statuses && (!messages || messages.length === 0)) {
                continue;
            }

            for (const msg of messages) {
                const fromNumber = msg.from;
                const messageId = msg.id;
                const contact = contacts.find((c) => c.wa_id === fromNumber) || {};
                const senderName = contact.profile?.name || fromNumber;

                // 1. Whitelist / Allowlist Check (Phase 7: Security Policy)
                const rawAllowed = process.env.WA_ALLOWED_NUMBERS || process.env.ALLOWED_USER_IDS || '';
                const allowedNumbers = rawAllowed.split(',').map((s) => s.trim().replace(/\D/g, '')).filter(Boolean);

                if (allowedNumbers.length > 0 && !allowedNumbers.includes(String(fromNumber).replace(/\D/g, ''))) {
                    console.warn(`⛔ [WhatsApp Security] Akses ditolak untuk nomor tidak terdaftar: ${fromNumber}`);
                    await sendWhatsAppTextMessage(
                        fromNumber,
                        `Maaf ${senderName}, nomor WhatsApp Anda (${fromNumber}) belum terdaftar dalam izin akses privat Jarvis Amba. Silakan hubungi admin / owner untuk mendapatkan izin.`
                    );
                    continue;
                }

                let textContent = '';
                let messageType = 'TEXT';
                let isVoiceInput = false;

                // --- A. Penanganan Pesan Berdasarkan Tipe (Phase 5) ---
                if (msg.type === 'text') {
                    textContent = msg.text?.body || '';
                    messageType = 'TEXT';
                } else if (msg.type === 'audio') {
                    messageType = 'AUDIO';
                    isVoiceInput = true;
                    console.log(`🎙️ [WhatsApp] Mengunduh Voice Note dari ${senderName} (${fromNumber})...`);

                    try {
                        const media = await downloadMetaMedia(msg.audio?.id);
                        const transcript = await transcribeAudio(
                            media.buffer,
                            media.mimeType,
                            process.env.GEMINI_API_KEY
                        );

                        if (!transcript || !transcript.trim()) {
                            console.log(`⚠️ [WhatsApp] Audio dari ${fromNumber} tidak terdeteksi kata jelas / hening.`);
                            await sendWhatsAppTextMessage(
                                fromNumber,
                                `Halo ${senderName}! Rekaman suaranya kurang jelas atau hening nih. Boleh coba kirim ulang suara yang lebih jelas ya! 🎙️`
                            );
                            continue;
                        }

                        textContent = transcript.trim();
                        console.log(`🎙️ [WhatsApp] Hasil Transkripsi Voice Note (${fromNumber}): "${textContent}"`);
                    } catch (audioErr) {
                        console.error('❌ [WhatsApp] Gagal memproses Voice Note:', audioErr.message);
                        await sendWhatsAppTextMessage(
                            fromNumber,
                            `Maaf ${senderName}, Amba mengalami kendala saat mendengarkan rekaman suaramu. Boleh coba kirim lagi atau gunakan teks ya!`
                        );
                        continue;
                    }
                } else if (msg.type === 'image') {
                    messageType = 'IMAGE';
                    const caption = msg.image?.caption || '';
                    console.log(`📸 [WhatsApp] Mengunduh Gambar dari ${senderName} (${fromNumber})...`);

                    try {
                        const media = await downloadMetaMedia(msg.image?.id);
                        const imageAnalysis = await analyzeImage(
                            media.buffer,
                            media.mimeType,
                            caption,
                            process.env.GEMINI_API_KEY
                        );

                        if (caption) {
                            textContent = `[Pertanyaan Pengguna tentang Gambar: "${caption}"]\n\n[Hasil Analisis Visual Gambar oleh AI:\n${imageAnalysis}\n]\n(Jawablah pertanyaan pengguna berdasarkan gambar di atas secara ramah, ringkas, dan solutif)`;
                        } else {
                            textContent = `Tolong jelaskan gambar yang baru saja saya kirimkan ini.\n\n[Hasil Analisis Visual Gambar oleh AI:\n${imageAnalysis}\n]\n(Rangkum intisari gambar di atas secara informatif dan enak dibaca)`;
                        }

                        console.log(`📸 [WhatsApp] Analisis Gambar Selesai (${fromNumber}). Intisari: "${imageAnalysis.substring(0, 80)}..."`);
                    } catch (imgErr) {
                        console.error('❌ [WhatsApp] Gagal menganalisis gambar:', imgErr.message);
                        await sendWhatsAppTextMessage(
                            fromNumber,
                            `Maaf ${senderName}, Amba belum berhasil menganalisis gambar tersebut. Boleh coba kirim ulang gambar dengan pencahayaan yang lebih jelas ya!`
                        );
                        continue;
                    }
                } else {
                    messageType = (msg.type || 'DOCUMENT').toUpperCase();
                    console.log(`ℹ️ [WhatsApp] Pesan non-teks (${msg.type}) dari ${fromNumber}`);
                    await sendWhatsAppTextMessage(
                        fromNumber,
                        `Halo ${senderName}! Amba menerima pesan tipe "${msg.type}". Saat ini Amba sudah mendukung Pesan Teks, Gambar / Foto, dan Rekaman Suara (Voice Note) ya! 🔥`
                    );
                    continue;
                }

                if (!textContent.trim()) continue;

                console.log(`📥 [WhatsApp] Pesan [${messageType}] dari ${senderName} (${fromNumber}): "${textContent.substring(0, 100)}"`);

                // 2. Rate Limit & Anti-Spam Check (Phase 7: Security & Rate Limiting)
                const rateCheck = checkRateLimit(fromNumber, textContent);
                if (!rateCheck.allowed) {
                    if (rateCheck.reason === 'DUPLICATE_SPAM') {
                        console.warn(`🛡️ [WhatsApp Spam] Pesan spam identik cepat diabaikan dari ${fromNumber}`);
                        continue;
                    }
                    if (rateCheck.reason === 'RATE_LIMIT_EXCEEDED') {
                        console.warn(`⚠️ [WhatsApp RateLimit] Batas request terlampaui untuk ${fromNumber}`);
                        await sendWhatsAppTextMessage(
                            fromNumber,
                            `⚠️ Santai sejenak, ${senderName}! Pesan masuk terlalu cepat (melebihi batas ${MAX_REQUESTS_PER_WINDOW} pesan per menit). Tunggu beberapa detik ya!`
                        );
                        continue;
                    }
                }

                // 3. Idempotency Check (Cegah pesan diproses ganda jika Meta kirim retry)
                const idempotency = await channelService.checkAndRecordInboundMessage('WHATSAPP', messageId, null, msg, messageType, textContent);
                if (idempotency.isDuplicate) {
                    console.log(`⏩ [WhatsApp] Pesan ${messageId} diabaikan (duplikat terdeteksi)`);
                    continue;
                }

                // 2. Resolve Identitas Pengguna (Tabel users & user_channels)
                let resolved = await channelService.resolveUserByChannel('WHATSAPP', fromNumber);
                let internalUserId = resolved.userId;

                if (!resolved.isLinked) {
                    try {
                        const newUserId = `wa_${fromNumber}`;
                        const newUser = await db.query(
                            `INSERT INTO users (id, discord_user_id, display_name, role, status, created_at, updated_at)
                             VALUES ($1, $2, $3, 'USER', 'ACTIVE', NOW(), NOW())
                             ON CONFLICT (id) DO NOTHING
                             RETURNING id, display_name;`,
                            [newUserId, newUserId, senderName]
                        );
                        internalUserId = newUser.rows[0]?.id || newUserId;
                        await channelService.linkUserChannel(internalUserId, 'WHATSAPP', fromNumber, {
                            displayName: senderName,
                            phoneNumber: fromNumber,
                            isPrimary: true,
                        });
                        console.log(`👤 [WhatsApp] Profil pengguna baru terdaftar: ${senderName} (ID: ${internalUserId})`);
                    } catch (userErr) {
                        console.error('⚠️ [WhatsApp] Gagal membuat user baru:', userErr.message);
                    }
                }

                // Ambil memori aktif pengguna untuk konteks AI personal
                const userMemories = await getRelevantMemories(internalUserId || fromNumber, 6).catch(() => []);

                // --- Fitur Broadcast Massal (Khusus Owner / Admin) ---
                const broadcastMatch = textContent.match(/^!(?:broadcast|pengumuman|siarkan)(?:\s+(all|wa|whatsapp|discord))?\s+([\s\S]+)$/i)
                    || textContent.match(/^(?:amba\s+)?broadcast(?:\s+(all|wa|whatsapp|discord))?[:\s]+([\s\S]+)$/i);

                if (broadcastMatch) {
                    const userRole = resolved.user?.role || 'USER';
                    const isAuth = fromNumber === '6288991185737' || userRole === 'OWNER' || userRole === 'ADMIN';
                    if (!isAuth) {
                        await sendWhatsAppTextMessage(
                            fromNumber,
                            `⛔ Maaf ${senderName}, fitur broadcast hanya dapat digunakan oleh Owner atau Admin Jarvis.`
                        );
                        continue;
                    }

                    let target = (broadcastMatch[1] || 'ALL').toUpperCase();
                    if (target === 'WA') target = 'WHATSAPP';
                    const bMessage = broadcastMatch[2].trim();

                    await sendWhatsAppTextMessage(fromNumber, `📢 Sedang menyiarkan pesan ke seluruh pengguna (${target})...`);

                    const { broadcastMessage } = require('./broadcastService');
                    const bRes = await broadcastMessage({
                        message: bMessage,
                        targetChannel: target,
                        senderUserId: internalUserId,
                    });

                    if (bRes.success) {
                        await sendWhatsAppTextMessage(
                            fromNumber,
                            `✅ *Broadcast Berhasil Disiarkan!*\n• Target Channel: *${target}*\n• Terkirim: *${bRes.delivered}* pengguna\n• Gagal: *${bRes.failed}* pengguna\n• Total Terdaftar: *${bRes.total}* akun`
                        );
                    } else {
                        await sendWhatsAppTextMessage(fromNumber, `❌ Gagal broadcast: ${bRes.error}`);
                    }
                    continue;
                }

                // Konteks Panggilan & Etiket Sapaan Pengguna
                let greetingPrompt = '';
                const userDisplayName = resolved.user?.displayName || senderName;
                const callsign = resolved.user?.callsign;
                if (callsign) {
                    greetingPrompt = `\n\n[Konteks Panggilan Pengguna:\n- Nama: "${userDisplayName}"\n- Panggilan Khusus yang Disepakati: "${callsign}"\n- Instruksi AI: Pengguna ini sudah memiliki panggilan khusus ("${callsign}"). Panggil pengguna ini secara konsisten dengan panggilan "${callsign}".]`;
                } else {
                    greetingPrompt = `\n\n[Konteks Panggilan Pengguna:\n- Nama: "${userDisplayName}"\n- Status: Pengguna baru / belum mengatur panggilan khusus.\n- PENTING: Panggil pengguna dengan nama aslinya ("${userDisplayName}"). JANGAN memanggil "Bos" kecuali pengguna sendiri yang memintanya!]`;
                }

                // Deteksi sapaan ramah
                const isGreeting = /^(halo|hai|hey|yo|pagi|siang|sore|malam|permisi|assalamu|oy|oi|tes|test|halo amba|hai amba|amba)\b/i.test(textContent.trim());
                if (isGreeting) {
                    greetingPrompt += `\n\n[Instruksi Sapaan Khusus:\nPengguna sedang menyapa. Balas sapaan dengan ramah, santai, variatif, dan alami selayaknya asisten pintar WhatsApp yang asyik. JANGAN gunakan template kaku atau mengulang balasan yang sama!]`;
                }

                // Deteksi apakah pengguna menginginkan balasan dalam bentuk Suara / Voice Note
                const voiceKeywordsRegex = /\b(balas|bales|jawab|jawabin|kirim|kirimkan|ngomong|bicara|minta|pake|pakai|dengan|lewat|via)\b.*\b(suara|voice|vn|audio)\b/i;
                const standaloneVoiceRegex = /\b(suara|voice\s*note|vn|audio)\s*(aja|saja|dong|ya|bro|mba|bos)?\b/i;
                const speakDirectRegex = /\b(ngomong|bicara)\s+(langsung|aja|dong)\b/i;
                const wantsVoice = isVoiceInput || voiceKeywordsRegex.test(textContent) || standaloneVoiceRegex.test(textContent) || speakDirectRegex.test(textContent);

                // Jika pengguna meminta respon suara atau input berupa rekaman suara, berikan instruksi mode suara
                if (wantsVoice) {
                    greetingPrompt += `\n\n[Instruksi Wajib - Mode Suara WhatsApp (Voice Note TTS):
Pengguna meminta respon dalam bentuk SUARA / VOICE NOTE (atau sedang berbicara melalui Voice Note). Jawabanmu ini akan otomatis di-generate menjadi rekaman suara WhatsApp (Voice Note TTS) menggunakan sintesis suara Bahasa Indonesia yang natural.
ATURAN WAJIB MODE SUARA:
1. JANGAN PERNAH mengatakan "Karena Amba bentuknya teks di Discord", "bayangin aja suara Amba", "Amba cuma bot teks", atau sejenisnya! Kamu BISA berbicara dan saat ini sedang aktif melayani pengguna di WhatsApp.
2. Berikan respon yang langsung to-the-point dan enak diucapkan secara lisan (contoh: jika diminta gombalan/pantun/cerita, langsung ucapkan dengan nada santai, hangat, dan ekspresif).
3. HINDARI format visual rumit seperti markdown tebal-miring bertumpuk, tanda kutip berlebihan, simbol visual, tabel, atau rentetan emotikon yang aneh bila dibacakan oleh mesin suara.]`;
                }

                // 3. Forward ke Jarvis Core (n8n Webhook)
                try {
                    const n8nUrl = process.env.N8N_WEBHOOK_URL || 'http://n8n:5678/webhook/jarvis-discord';
                    const n8nPayload = {
                        schemaVersion: 1,
                        source: 'whatsapp',
                        user: {
                            id: internalUserId || fromNumber,
                            username: userDisplayName,
                            displayName: userDisplayName,
                            callsign: callsign || null,
                            preferredGreetingName: callsign || userDisplayName,
                            hasCustomCallsign: Boolean(callsign),
                        },
                        userMemories: userMemories,
                        message: {
                            id: messageId,
                            content: textContent + greetingPrompt,
                            channelId: `wa_${fromNumber}`,
                            channelName: `WhatsApp ${userDisplayName}`,
                            isVoiceInput: isVoiceInput,
                            wantsVoice: wantsVoice,
                        },
                        timestamp: new Date().toISOString(),
                    };

                    const n8nRes = await fetch(n8nUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(n8nPayload),
                    });

                    if (n8nRes.ok) {
                        const n8nData = await n8nRes.json();
                        const replyText = n8nData.replyText || n8nData.text || n8nData.response?.text || '';

                        if (replyText) {
                            if (wantsVoice) {
                                let voiceSent = false;
                                try {
                                    console.log(`🎙️ [WhatsApp] Memproses Text-to-Speech untuk ${fromNumber}...`);
                                    const ttsFilePath = await generateTTS(replyText, 'id-ID-ArdiNeural');
                                    if (ttsFilePath && fs.existsSync(ttsFilePath)) {
                                        const audioBuf = fs.readFileSync(ttsFilePath);
                                        const sendRes = await sendWhatsAppAudioMessage(fromNumber, audioBuf);
                                        cleanupAudio(ttsFilePath);
                                        if (sendRes.success) {
                                            voiceSent = true;
                                            console.log(`🎙️ [WhatsApp] Voice Note berhasil dikirim ke ${fromNumber} (HANYA SUARA, tanpa teks redundan)`);
                                        }
                                    }
                                } catch (ttsErr) {
                                    console.warn('⚠️ [WhatsApp] Gagal generate audio TTS balasan:', ttsErr.message);
                                }

                                // Fallback darurat: Jika generate suara gagal, kirim teks agar user tetap dapat balasan
                                if (!voiceSent) {
                                    console.log(`⚠️ [WhatsApp] Fallback ke pesan teks karena pengiriman audio gagal.`);
                                    await sendWhatsAppTextMessage(fromNumber, replyText);
                                }
                            } else {
                                // Balasan teks standar jika pengguna tidak meminta suara
                                await sendWhatsAppTextMessage(fromNumber, replyText);
                            }

                            await channelService.updateMessageStatus('WHATSAPP', messageId, 'COMPLETED', replyText);
                        }
                    } else {
                        console.error(`⚠️ [WhatsApp] n8n merespon status ${n8nRes.status}`);
                        await sendWhatsAppTextMessage(
                            fromNumber,
                            'Maaf, Amba sedang mengalami sedikit kendala sistem. Coba lagi sebentar ya!'
                        );
                        await channelService.updateMessageStatus('WHATSAPP', messageId, 'FAILED');
                    }
                } catch (coreErr) {
                    console.error('❌ [WhatsApp] Gagal meneruskan ke n8n Core:', coreErr.message);
                    await sendWhatsAppTextMessage(
                        fromNumber,
                        'Maaf, koneksi Amba ke Core sedang terganggu. Silakan coba lagi.'
                    );
                    await channelService.updateMessageStatus('WHATSAPP', messageId, 'ERROR');
                }
            }
        }
    }
}

module.exports = {
    handleWebhookVerification,
    handleWebhookEvent,
    sendWhatsAppTextMessage,
    sendWhatsAppAudioMessage,
    downloadMetaMedia,
    uploadMetaMedia,
};
