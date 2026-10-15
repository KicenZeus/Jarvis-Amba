const channelService = require('./channelService');
const db = require('./db');
const { getRelevantMemories } = require('./memoryService');

/**
 * ==============================================================================
 * Jarvis V2.1: WhatsApp Channel Adapter (Official Meta Cloud API)
 * Menghubungkan WhatsApp ke Jarvis Core & Channel Abstraction Layer
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
 * 2. Mengirim Pesan Teks ke WhatsApp Pengguna melalui Meta Cloud API
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
                    channel_type, external_message_id, direction, status, content, created_at, processed_at
                 ) VALUES ('WHATSAPP', $1, 'OUTBOUND', 'DELIVERED', $2, NOW(), NOW())
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
 * 3. Menangani Event Webhook dari Meta (POST /webhook/whatsapp)
 * Memproses pesan teks masuk, menyelesaikan identitas pengguna, dan meneruskannya ke Jarvis Core
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

                let textContent = '';
                if (msg.type === 'text') {
                    textContent = msg.text?.body || '';
                } else {
                    // Graceful fallback untuk media & voice note (Phase 5)
                    console.log(`ℹ️ [WhatsApp] Pesan non-teks (${msg.type}) dari ${fromNumber}`);
                    await sendWhatsAppTextMessage(
                        fromNumber,
                        `Halo ${senderName}! Amba saat ini baru mendukung pesan teks di WhatsApp ya. Fitur audio dan media sedang disiapkan untuk pembaruan berikutnya! 🔥`
                    );
                    continue;
                }

                if (!textContent.trim()) continue;

                console.log(`📥 [WhatsApp] Pesan masuk dari ${senderName} (${fromNumber}): "${textContent}"`);

                // 1. Idempotency Check (Cegah pesan diproses ganda jika Meta kirim retry)
                const idempotency = await channelService.checkAndRecordInboundMessage('WHATSAPP', messageId, null, msg);
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
                            isVoiceInput: false,
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
                            await sendWhatsAppTextMessage(fromNumber, replyText);
                            await channelService.updateMessageStatus('WHATSAPP', messageId, 'COMPLETED');
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
};

