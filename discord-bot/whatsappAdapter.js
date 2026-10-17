const fs = require('fs');
const channelService = require('./channelService');
const db = require('./db');
const scheduleService = require('./scheduleService');
const taskChainService = require('./taskChainService');
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

// In-Memory Gatekeep Debounce Map (Cegah spam balasan ke nomor yang belum terdaftar)
const unregisteredGatekeepMap = new Map();

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
                const cleanPhone = String(fromNumber).replace(/\D/g, '');

                // 1. Whitelist / Allowlist Check (Phase 7: Security Policy)
                const rawAllowed = process.env.WA_ALLOWED_NUMBERS || process.env.ALLOWED_USER_IDS || '';
                const allowedNumbers = rawAllowed.split(',').map((s) => s.trim().replace(/\D/g, '')).filter(Boolean);

                if (allowedNumbers.length > 0 && !allowedNumbers.includes(cleanPhone)) {
                    console.warn(`⛔ [WhatsApp Security] Akses ditolak untuk nomor tidak terdaftar: ${fromNumber}`);
                    await sendWhatsAppTextMessage(
                        fromNumber,
                        `Maaf ${senderName}, nomor WhatsApp Anda (${fromNumber}) belum terdaftar dalam izin akses privat Jarvis Amba. Silakan hubungi Owner untuk mendapatkan izin.`
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

                // 4. Resolve Identitas Pengguna & Hak Akses (Tabel users & user_channels)
                let resolved = await channelService.resolveUserByChannel('WHATSAPP', fromNumber);
                let internalUserId = resolved.userId;

                const isOwner = cleanPhone === '6288991185737' || resolved.user?.role === 'OWNER';

                // Jika nomor adalah Owner tapi belum ter-link di user_channels
                if (isOwner && !resolved.isLinked) {
                    try {
                        const ownerId = '713137141072396370';
                        internalUserId = ownerId;
                        await channelService.linkUserChannel(ownerId, 'WHATSAPP', fromNumber, {
                            displayName: senderName,
                            phoneNumber: fromNumber,
                            isPrimary: true,
                        });
                        resolved = await channelService.resolveUserByChannel('WHATSAPP', fromNumber);
                    } catch (errLink) {
                        console.warn('⚠️ Gagal linking owner WhatsApp:', errLink.message);
                    }
                }

                // --- GATEKEEPING: USER BELUM TERDAFTAR KE DATABASE ---
                const userRole = resolved.user?.role || 'GUEST';
                const isRegisteredUser = resolved.isLinked && resolved.status === 'ACTIVE' && 
                                         resolved.user?.status === 'ACTIVE' && 
                                         ['OWNER', 'ADMIN', 'USER'].includes(userRole);

                if (!isOwner && !isRegisteredUser) {
                    const lastNotified = unregisteredGatekeepMap.get(cleanPhone) || 0;
                    const now = Date.now();
                    if (now - lastNotified > 12 * 3600 * 1000) {
                        unregisteredGatekeepMap.set(cleanPhone, now);
                        await sendWhatsAppTextMessage(
                            fromNumber,
                            `🔒 *[AKSES TERBATAS - JARVIS AMBA]*\n\nHalo ${senderName}! Nomor WhatsApp Anda (*${fromNumber}*) belum terdaftar dalam akses privat asisten Jarvis Amba.\n\nUntuk mendapatkan izin akses, silakan hubungi Owner kami (*KicenZeus*).\n\nTerima kasih! 🙏`
                        );
                    }
                    console.warn(`🛡️ [WhatsApp Gatekeep] Mengabaikan pesan dari user belum terdaftar: ${senderName} (${fromNumber})`);
                    continue; // Skip processing / Do NOT forward to n8n AI!
                }

                // Ambil memori aktif pengguna untuk konteks AI personal
                const userMemories = await getRelevantMemories(internalUserId || fromNumber, 6).catch(() => []);

                // --- FITUR ROLE MANAGEMENT & BROADCAST (KHUSUS OWNER) ---
                // 1. Cek Role Sendiri (!myrole / amba role)
                if (/^(!myrole|!role|myrole|cek\s*role|status\s*role)$/i.test(textContent.trim())) {
                    const uRole = resolved.user?.role || (isOwner ? 'OWNER' : 'USER');
                    const cSign = resolved.user?.callsign ? ` ("${resolved.user.callsign}")` : '';
                    await sendWhatsAppTextMessage(
                        fromNumber,
                        `⭐ *[STATUS AKUN JARVIS AMBA]*\n• Nama: *${senderName}*${cSign}\n• Nomor: *${fromNumber}*\n• Role: *${uRole}*\n• Status: *ACTIVE*`
                    );
                    continue;
                }

                // --- VERIFIKASI TUGAS BERKELANJUTAN / BERTINGKAT (TASK CHAIN) DI WHATSAPP ---
                const activeChain = await taskChainService.getActiveTaskChain(internalUserId || fromNumber);
                if (activeChain) {
                    const lower = textContent.toLowerCase().trim();
                    if (/^(ya|setuju|oke|gas|eksekusi|lanjut|acc|laksanakan|yes|yep|ok|confirm|siap)$/i.test(lower)) {
                        try {
                            const { chain, results } = await taskChainService.approveAndExecuteTaskChain(activeChain.id, internalUserId || fromNumber);
                            const report = taskChainService.formatTaskChainExecutionReport(chain, results, userDisplayName);
                            await sendWhatsAppTextMessage(fromNumber, report);
                        } catch (execErr) {
                            await sendWhatsAppTextMessage(fromNumber, `⚠️ Gagal mengeksekusi rencana tugas: ${execErr.message}`);
                        }
                        continue;
                    } else if (/^(batal|cancel|nggak|enggak|jangan|tidak)$/i.test(lower)) {
                        await taskChainService.cancelTaskChain(activeChain.id);
                        await sendWhatsAppTextMessage(fromNumber, `🛡️ Rencana tugas berkelanjutan *"${activeChain.title}"* telah dibatalkan. Tidak ada jadwal atau pengingat yang dibuat.`);
                        continue;
                    } else if (/^(revisi|ubah|ganti|tambah|kurang)/i.test(lower) || lower.length > 5) {
                        textContent = `[REVISI_RENCANA_TUGAS_BERKELANJUTAN]\nJudul Rencana: ${activeChain.title}\nRencana Sebelumnya:\n${JSON.stringify(activeChain.proposed_plan, null, 2)}\n\nCatatan Revisi dari Pengguna:\n"${textContent}"\n\nInstruksi AI: Sesuaikan dan perbaiki rencana langkah kerja di atas sesuai revisi pengguna. Hasilkan format \`\`\`task_plan ... \`\`\` yang baru agar dapat diverifikasi ulang sebelum dieksekusi.`;
                    }
                }

                // 1b. Cek Jadwal & Agenda Kegiatan (!jadwal / !agenda)
                if (/^(!jadwal|!agenda|!schedules|!schedule|jadwal|agenda)$/i.test(textContent.trim())) {
                    const schedules = await scheduleService.getUserSchedules(internalUserId || fromNumber, { limit: 10 });
                    const textList = scheduleService.formatSchedulesListText(schedules, `📅 DAFTAR JADWAL & AGENDA [${senderName}]`);
                    await sendWhatsAppTextMessage(fromNumber, textList);
                    continue;
                }

                // 1c. Cek Tugas & To-Do List (!tugas / !tasks / !todo)
                if (/^(!tugas|!tasks|!task|!todo|tugas|todo)$/i.test(textContent.trim())) {
                    const resTasks = await db.query(
                        `SELECT id, title, description, priority, status, due_at 
                         FROM tasks 
                         WHERE user_id = $1 AND deleted_at IS NULL AND status IN ('pending', 'in_progress')
                         ORDER BY 
                            CASE UPPER(priority) WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
                            due_at ASC NULLS LAST
                         LIMIT 15;`,
                        [internalUserId || fromNumber]
                    );
                    let msg = `📋 *DAFTAR TUGAS & TO-DO [${senderName}]* (Total: ${resTasks.rowCount})\n\n`;
                    if (resTasks.rowCount === 0) {
                        msg += `✨ Belum ada tugas tertunda. Kamu bisa catat tugas baru kapan saja! ☕`;
                    } else {
                        resTasks.rows.forEach((t, i) => {
                            const badge = scheduleService.getPriorityBadge(t.priority);
                            const status = t.status === 'in_progress' ? '⏳ In Progress' : '📋 Pending';
                            let dueStr = '';
                            if (t.due_at) {
                                const dStr = new Intl.DateTimeFormat('id-ID', {
                                    timeZone: 'Asia/Jakarta',
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false,
                                }).format(new Date(t.due_at));
                                dueStr = `\n   └ ⏰ Tenggat: \`${dStr} WIB\``;
                            }
                            msg += `${i + 1}. ${badge} *${t.title}* [${status}]${dueStr}\n`;
                        });
                    }
                    await sendWhatsAppTextMessage(fromNumber, msg);
                    continue;
                }

                // 1d. Cek Pengingat & Alarm Aktif (!pengingat / !reminders / !alarm)
                if (/^(!pengingat|!reminders|!reminder|!alarm|pengingat|alarm)$/i.test(textContent.trim())) {
                    const resReminders = await db.query(
                        `SELECT id, title, priority, remind_at 
                         FROM reminders 
                         WHERE user_id = $1 AND status = 'pending'
                         ORDER BY remind_at ASC 
                         LIMIT 15;`,
                        [internalUserId || fromNumber]
                    );
                    let msg = `⏰ *DAFTAR PENGINGAT & ALARM [${senderName}]* (Total: ${resReminders.rowCount})\n\n`;
                    if (resReminders.rowCount === 0) {
                        msg += `ℹ️ Belum ada alarm pengingat aktif yang terjadwal.`;
                    } else {
                        resReminders.rows.forEach((r, i) => {
                            const badge = scheduleService.getPriorityBadge(r.priority);
                            const dStr = new Intl.DateTimeFormat('id-ID', {
                                timeZone: 'Asia/Jakarta',
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                            }).format(new Date(r.remind_at));
                            msg += `${i + 1}. ${badge} \`${dStr} WIB\`\n   └ 💬 _${r.title}_\n`;
                        });
                    }
                    await sendWhatsAppTextMessage(fromNumber, msg);
                    continue;
                }

                // 2. Lihat Daftar User Terdaftar (!role list / !user list - Khusus Owner)
                if (/^!(?:role\s+list|user\s+list|daftar\s+user|list\s+user)$/i.test(textContent.trim())) {
                    if (!isOwner) {
                        await sendWhatsAppTextMessage(fromNumber, '⛔ Hanya OWNER yang memiliki hak untuk melihat daftar seluruh pengguna.');
                        continue;
                    }
                    const { listAllUsersWithRoles } = require('./securityService');
                    const userList = await listAllUsersWithRoles();
                    let msgList = `📋 *[DAFTAR PENGGUNA TERDAFTAR JARVIS]*\nTotal: *${userList.length}* akun aktif\n\n`;
                    userList.forEach((u, i) => {
                        const badge = u.role === 'OWNER' ? '👑' : u.role === 'ADMIN' ? '🛡️' : '⭐';
                        const platform = u.channel_type === 'WHATSAPP' ? '📱 WA' : '💬 DC';
                        msgList += `${i + 1}. ${badge} *${u.display_name}* [${u.role}]\n   ${platform}: \`${u.external_user_id}\`\n`;
                    });
                    msgList += `\n💡 *Ubah role:* \`!role set <nomor/id> <role>\`\n💡 *Daftar user:* \`!daftar <nomor/id> <nama> <role>\`\n💡 *Kick user:* \`!kick <nomor/id>\``;
                    await sendWhatsAppTextMessage(fromNumber, msgList);
                    continue;
                }

                // 3. Set Role Pengguna (!role set <target> <role> - Khusus Owner)
                const roleSetMatch = textContent.match(/^!role\s+set\s+([^\s]+)\s+(OWNER|ADMIN|USER|GUEST|BLOCKED)$/i);
                if (roleSetMatch) {
                    if (!isOwner) {
                        await sendWhatsAppTextMessage(fromNumber, '⛔ Hanya OWNER yang memiliki hak untuk mengubah role pengguna.');
                        continue;
                    }
                    const targetId = roleSetMatch[1].trim();
                    const targetRole = roleSetMatch[2].toUpperCase();
                    const { setUserRole } = require('./securityService');
                    const resSet = await setUserRole(targetId, targetRole, internalUserId || fromNumber, 'Updated via WhatsApp by Owner');
                    await sendWhatsAppTextMessage(fromNumber, resSet.message);
                    continue;
                }

                // 4. Daftarkan Pengguna Baru (!daftar <nomor/id> <nama> <role> - Khusus Owner)
                const daftarMatch = textContent.match(/^!(?:daftar|register|user\s+add)\s+([^\s]+)\s+([^\s]+)(?:\s+(OWNER|ADMIN|USER))?$/i);
                if (daftarMatch) {
                    if (!isOwner) {
                        await sendWhatsAppTextMessage(fromNumber, '⛔ Hanya OWNER yang memiliki hak untuk mendaftarkan pengguna baru.');
                        continue;
                    }
                    const targetId = daftarMatch[1].trim();
                    const targetName = daftarMatch[2].trim();
                    const targetRole = (daftarMatch[3] || 'USER').toUpperCase();
                    const { registerNewUser } = require('./securityService');
                    const resDaftar = await registerNewUser({
                        identifier: targetId,
                        displayName: targetName,
                        role: targetRole,
                        assignedBy: internalUserId || fromNumber,
                    });
                    await sendWhatsAppTextMessage(fromNumber, resDaftar.message);
                    continue;
                }

                // 4b. Hapus / Kick User dari Database (!kick <nomor/id> / !hapus <nomor/id> - Khusus Owner)
                const kickMatch = textContent.match(/^!(?:kick|hapus|user\s+kick|user\s+delete|user\s+remove|role\s+remove|role\s+kick)\s+([^\s]+)(?:\s+([\s\S]+))?$/i);
                if (kickMatch) {
                    if (!isOwner) {
                        await sendWhatsAppTextMessage(fromNumber, '⛔ Hanya OWNER yang memiliki hak untuk mengeluarkan/menghapus pengguna dari sistem.');
                        continue;
                    }
                    const targetId = kickMatch[1].trim();
                    const reason = kickMatch[2] ? kickMatch[2].trim() : 'Dikeluarkan oleh Owner via WhatsApp';
                    const { removeUser } = require('./securityService');
                    const resKick = await removeUser({
                        identifier: targetId,
                        requestedBy: internalUserId || fromNumber,
                        reason,
                    });
                    await sendWhatsAppTextMessage(fromNumber, resKick.message);
                    continue;
                }

                // 5. Antrean Broadcast Terjadwal (!broadcast jadwal list / !broadcast antrean - Khusus Owner)
                if (/^!(?:broadcast|pengumuman)\s+(?:jadwal\s+list|antrean|queue)$/i.test(textContent.trim())) {
                    if (!isOwner) {
                        await sendWhatsAppTextMessage(fromNumber, '⛔ Fitur broadcast eksklusif hanya dapat diakses oleh Owner.');
                        continue;
                    }
                    const { listScheduledBroadcasts, formatWIBDateTime } = require('./broadcastService');
                    const list = await listScheduledBroadcasts({ status: 'PENDING', limit: 10 });
                    if (list.length === 0) {
                        await sendWhatsAppTextMessage(fromNumber, '📭 Tidak ada jadwal broadcast dalam antrean saat ini.');
                    } else {
                        let out = `📅 *[ANTREAN BROADCAST TERJADWAL]*\n\n`;
                        list.forEach((b) => {
                            out += `• *ID #${b.id}* — ⏰ ${formatWIBDateTime(new Date(b.scheduled_at))}\n`;
                            out += `  Saluran: *${b.target_channel}* | Role: *${b.target_role || 'SEMUA'}*\n`;
                            out += `  Pesan: _"${b.message.substring(0, 80)}${b.message.length > 80 ? '...' : ''}"_\n\n`;
                        });
                        out += `💡 *Batalkan jadwal:* \`!broadcast batal <id>\``;
                        await sendWhatsAppTextMessage(fromNumber, out);
                    }
                    continue;
                }

                // 6. Batalkan Broadcast Terjadwal (!broadcast batal <id> - Khusus Owner)
                const cancelBcMatch = textContent.match(/^!(?:broadcast|pengumuman)\s+(?:batal|cancel)\s+(\d+)$/i);
                if (cancelBcMatch) {
                    if (!isOwner) {
                        await sendWhatsAppTextMessage(fromNumber, '⛔ Fitur broadcast eksklusif hanya dapat diakses oleh Owner.');
                        continue;
                    }
                    const schedId = parseInt(cancelBcMatch[1], 10);
                    const { cancelScheduledBroadcast } = require('./broadcastService');
                    const resCancel = await cancelScheduledBroadcast(schedId, internalUserId || fromNumber);
                    await sendWhatsAppTextMessage(fromNumber, resCancel.success ? resCancel.message : `❌ Gagal: ${resCancel.error}`);
                    continue;
                }

                // 7. Pengiriman Broadcast (Instan maupun Terjadwal - Khusus Owner)
                const broadcastMatch = textContent.match(/^!(?:broadcast|pengumuman|siarkan)\s+([\s\S]+)$/i)
                    || textContent.match(/^(?:amba\s+)?broadcast[:\s]+([\s\S]+)$/i);

                if (broadcastMatch) {
                    if (!isOwner) {
                        await sendWhatsAppTextMessage(
                            fromNumber,
                            `⛔ Maaf ${senderName}, fitur broadcast (instan maupun terjadwal) eksklusif hanya dapat digunakan oleh Owner Jarvis.`
                        );
                        continue;
                    }

                    const rawPayload = broadcastMatch[1].trim();
                    const {
                        parseBroadcastInput,
                        parseScheduleTime,
                        createScheduledBroadcast,
                        broadcastMessage,
                    } = require('./broadcastService');

                    const parsed = parseBroadcastInput(rawPayload);

                    if (!parsed.message) {
                        await sendWhatsAppTextMessage(
                            fromNumber,
                            `❌ Pesan broadcast tidak boleh kosong.\n\nContoh:\n• Instan: \`!broadcast wa Halo semuanya!\`\n• Terjadwal: \`!broadcast jadwal 10m wa Pengumuman dalam 10 menit\`\n• Kontak Tertentu: \`!broadcast to:6288991185737 Halo Bos!\``
                        );
                        continue;
                    }

                    // A. Kasus Terjadwal
                    if (parsed.isScheduled) {
                        const timeParsed = parseScheduleTime(parsed.scheduleTimeStr);
                        if (!timeParsed.success) {
                            await sendWhatsAppTextMessage(fromNumber, `❌ Gagal menjadwalkan: ${timeParsed.error}`);
                            continue;
                        }

                        const schedRes = await createScheduledBroadcast({
                            createdBy: internalUserId || fromNumber,
                            message: parsed.message,
                            targetChannel: parsed.targetChannel,
                            targetRole: parsed.targetRole,
                            targetRecipients: parsed.targetRecipients,
                            scheduledAt: timeParsed.date,
                        });

                        if (schedRes.success) {
                            let confirmMsg = `📅 *[BROADCAST BERHASIL DIJADWALKAN]*\n`;
                            confirmMsg += `• ID Jadwal: *#${schedRes.broadcast.id}*\n`;
                            confirmMsg += `• Waktu Kirim: *${schedRes.formattedTime}*\n`;
                            confirmMsg += `• Target Saluran: *${parsed.targetChannel}*\n`;
                            if (parsed.targetRole) confirmMsg += `• Target Role: *${parsed.targetRole}*\n`;
                            if (parsed.targetRecipients) confirmMsg += `• Kontak Khusus: *${parsed.targetRecipients.length}* nomor/ID\n`;
                            confirmMsg += `• Isi Pesan: _"${parsed.message.substring(0, 100)}"_\n\n`;
                            confirmMsg += `_Amba akan otomatis menyiarkan pesan tepat pada waktu tersebut!_ 🫡`;
                            await sendWhatsAppTextMessage(fromNumber, confirmMsg);
                        } else {
                            await sendWhatsAppTextMessage(fromNumber, `❌ Gagal menjadwalkan broadcast: ${schedRes.error}`);
                        }
                        continue;
                    }

                    // B. Kasus Instan
                    await sendWhatsAppTextMessage(fromNumber, `📢 Sedang menyiarkan pesan ke seluruh pengguna (${parsed.targetChannel})...`);

                    const bRes = await broadcastMessage({
                        message: parsed.message,
                        targetChannel: parsed.targetChannel,
                        targetRole: parsed.targetRole,
                        targetRecipients: parsed.targetRecipients,
                        senderUserId: internalUserId || fromNumber,
                    });

                    if (bRes.success) {
                        let rep = `✅ *[BROADCAST SELESAI DISIARKAN]*\n`;
                        rep += `• Target Saluran: *${parsed.targetChannel}*\n`;
                        if (parsed.targetRole) rep += `• Target Role: *${parsed.targetRole}*\n`;
                        rep += `• Terkirim: *${bRes.delivered}* pengguna\n`;
                        rep += `• Gagal: *${bRes.failed}* pengguna\n`;
                        rep += `• Total Terdaftar: *${bRes.total}* akun`;
                        await sendWhatsAppTextMessage(fromNumber, rep);
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
                            role: isOwner ? 'OWNER' : (resolved.user?.role || 'USER'),
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
                            // Cek apakah balasan AI mengandung rancangan task_plan (Task Berkelanjutan / Bertingkat)
                            const { cleanText: textWithoutPlan, plan } = taskChainService.extractTaskPlanFromAiResponse(replyText);
                            if (plan && Array.isArray(plan.actions) && plan.actions.length > 0) {
                                console.log(`📋 [WhatsApp TaskChain] AI mengusulkan ${plan.actions.length} langkah aksi: "${plan.title || 'Rencana Tugas'}"`);
                                const chain = await taskChainService.createTaskChain({
                                    userId: internalUserId || fromNumber,
                                    channelType: 'WHATSAPP',
                                    channelId: `wa_${fromNumber}`,
                                    title: plan.title || 'Rencana Tugas Berkelanjutan',
                                    description: plan.summary || textWithoutPlan,
                                    category: plan.category || 'MULTI_STEP_TASK',
                                    proposedPlan: plan,
                                });

                                const proposalText = taskChainService.formatTaskChainProposalText(chain, userDisplayName);
                                await sendWhatsAppTextMessage(fromNumber, proposalText);
                                continue;
                            }

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
