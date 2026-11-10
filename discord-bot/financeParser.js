const crypto = require('crypto');
const db = require('./db');

/**
 * ==============================================================================
 * Jarvis V3 Phase 6: Android Notification Finance Capture Engine (PRD Sec 43-51)
 * - Server-Side Deterministic Bank Regex Parser
 * - Multi-Layer Privacy Masking (Zero Raw Retention)
 * - Single Deterministic Deduplication Key (sha256)
 * - AI Fallback Parser (Direct Gemini) & Configurable Confidence Scoring
 * ==============================================================================
 */

const CONFIDENCE_LEVELS = {
    HIGH: 0.95,    // Pola regex baku bank cocok 100%
    MEDIUM: 0.75,  // Berasal dari AI Fallback terverifikasi
    LOW: 0.50,     // Parsial / meragukan
};

/**
 * Menghasilkan kunci deduplikasi deterministik tunggal (PRD Sec 49)
 * dedupe_key = sha256(package_name + notification_key + postTime_device + normalized_amount)
 */
function computeDedupeKey(packageName, notificationKey, postTimeDevice, normalizedAmount) {
    const raw = `${packageName || ''}|${notificationKey || ''}|${postTimeDevice || ''}|${normalizedAmount || ''}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Sanitasi & Masking Lapisan Kedua di Sisi Server (PRD Sec 44.2 & 44.3)
 * Menghapus sisa nomor rekening dan saldo agar tidak pernah disimpan atau bocor
 */
function sanitizeFinanceText(text) {
    if (!text || typeof text !== 'string') return '';
    let sanitized = text;

    // 1. Mask nomor rekening / kartu bank (hanya menyisakan 4 digit terakhir: **** 1234)
    sanitized = sanitized.replace(/\b(\d{6,12})(\d{4})\b/g, '**** $2');

    // 2. Strip sisa saldo rekening (e.g. "Saldo: Rp 1.500.000", "Sisa saldo: 50.000")
    sanitized = sanitized.replace(/(?:sisa\s+)?saldo(?:\s+anda)?\s*(?:saat\s+ini)?\s*[:=]?\s*(?:rp\.?\s*)?[\d.,]+/gi, '');

    // 3. Normalisasi whitespace
    return sanitized.replace(/\s+/g, ' ').trim();
}

/**
 * Normalisasi string nominal rupiah menjadi angka numerik murni
 * Menangani format "Rp 50.000,00", "Rp50.000", "25,000", "1.500.000"
 */
function parseRupiahAmount(str) {
    if (!str) return 0;
    // Bersihkan karakter non-digit kecuali titik dan koma
    let clean = String(str).replace(/[^\d.,]/g, '').trim();

    // Jika format Indonesia dengan sen (e.g. 50.000,00)
    if (/,\d{2}$/.test(clean)) {
        clean = clean.replace(/,\d{2}$/, '').replace(/\./g, '');
    } else if (/\.\d{2}$/.test(clean) && !clean.includes(',')) {
        // e.g. 50000.00
        clean = clean.replace(/\.\d{2}$/, '');
    } else {
        // Hapus semua pemisah ribuan titik atau koma
        clean = clean.replace(/[.,]/g, '');
    }

    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

/**
 * Deterministic Bank Regex Parser (Tahap 1 - PRD Sec 47.1)
 * Mencocokkan notifikasi dengan pola baku perbankan Indonesia
 */
function parseBankNotificationRegex(packageName, title = '', text = '') {
    const pkg = (packageName || '').toLowerCase().trim();
    const content = `${title} ${text}`.trim();
    const cleanContent = sanitizeFinanceText(content);

    let parsed = null;

    // 1. BCA (com.bca)
    if (pkg.includes('bca')) {
        // Transfer Keluar / Debit
        const bcaOut = cleanContent.match(/(?:m-transfer\s*:\s*berhasil|transfer\s+ke|transfer\s+berhasil).*?rp\.?\s*([\d.,]+)(?:\s+ke\s+(.*?)(?:\.|$))?/i);
        if (bcaOut) {
            parsed = {
                type: 'EXPENSE',
                amount: parseRupiahAmount(bcaOut[1]),
                paymentMethod: 'BCA',
                description: bcaOut[2] ? `Transfer ke ${bcaOut[2].trim()}` : 'Transfer keluar BCA',
                category: 'transfer',
            };
        }
        // QRIS BCA
        const bcaQris = cleanContent.match(/(?:pembayaran\s+qris|qris).*?rp\.?\s*([\d.,]+)(?:\s+di\s+(.*?)(?:\.|$))?/i);
        if (!parsed && bcaQris) {
            parsed = {
                type: 'EXPENSE',
                amount: parseRupiahAmount(bcaQris[1]),
                paymentMethod: 'BCA',
                description: bcaQris[2] ? `QRIS di ${bcaQris[2].trim()}` : 'Pembayaran QRIS BCA',
                category: 'makanan',
            };
        }
        // Transfer Masuk / Kredit
        const bcaIn = cleanContent.match(/(?:transfer\s+dr|dana\s+masuk|transfer\s+masuk).*?rp\.?\s*([\d.,]+)/i);
        if (!parsed && bcaIn) {
            parsed = {
                type: 'INCOME',
                amount: parseRupiahAmount(bcaIn[1]),
                paymentMethod: 'BCA',
                description: 'Transfer masuk BCA',
                category: 'pendapatan',
            };
        }
    }

    // 2. Mandiri Livin (id.bmri.livin / com.bankmandiri.livin)
    if (!parsed && (pkg.includes('mandiri') || pkg.includes('bmri'))) {
        const mandiriOut = cleanContent.match(/(?:pembayaran|transfer|transaksi\s+berhasil|qris).*?rp\.?\s*([\d.,]+)/i);
        const isIncome = /(?:dana\s+masuk|transfer\s+masuk|terima\s+dana)/i.test(cleanContent);
        if (mandiriOut) {
            parsed = {
                type: isIncome ? 'INCOME' : 'EXPENSE',
                amount: parseRupiahAmount(mandiriOut[1]),
                paymentMethod: 'Mandiri',
                description: isIncome ? 'Dana masuk Livin Mandiri' : 'Transaksi Livin Mandiri',
                category: isIncome ? 'pendapatan' : 'belanja',
            };
        }
    }

    // 3. BRImo (id.co.bri.brimo)
    if (!parsed && (pkg.includes('bri') || pkg.includes('brimo'))) {
        const briMatch = cleanContent.match(/(?:transaksi\s+berhasil|transfer|dana\s+masuk|pembayaran).*?rp\.?\s*([\d.,]+)/i);
        const isIncome = /(?:dana\s+masuk|transfer\s+masuk|terima)/i.test(cleanContent);
        if (briMatch) {
            parsed = {
                type: isIncome ? 'INCOME' : 'EXPENSE',
                amount: parseRupiahAmount(briMatch[1]),
                paymentMethod: 'BRI',
                description: isIncome ? 'Dana masuk BRImo' : 'Transaksi BRImo',
                category: isIncome ? 'pendapatan' : 'belanja',
            };
        }
    }

    // 4. GoPay (com.gojek.app)
    if (!parsed && (pkg.includes('gojek') || pkg.includes('gopay'))) {
        const gopayOut = cleanContent.match(/(?:kamu\s+telah\s+membayar|pembayaran\s+berhasil|bayar).*?rp\.?\s*([\d.,]+)(?:\s+ke\s+(.*?)(?:\.|$))?/i);
        const gopayIn = cleanContent.match(/(?:top\s*up|isi\s+saldo|dana\s+masuk).*?rp\.?\s*([\d.,]+)/i);
        if (gopayOut) {
            parsed = {
                type: 'EXPENSE',
                amount: parseRupiahAmount(gopayOut[1]),
                paymentMethod: 'GoPay',
                description: gopayOut[2] ? `Pembayaran ke ${gopayOut[2].trim()}` : 'Pembayaran GoPay',
                category: 'makanan',
            };
        } else if (gopayIn) {
            parsed = {
                type: 'INCOME',
                amount: parseRupiahAmount(gopayIn[1]),
                paymentMethod: 'GoPay',
                description: 'Top up saldo GoPay',
                category: 'pendapatan',
            };
        }
    }

    // 5. Jenius BTPN (com.btpn.dc)
    if (!parsed && (pkg.includes('jenius') || pkg.includes('btpn'))) {
        const jeniusMatch = cleanContent.match(/(?:kamu\s+berhasil|uang\s+keluar|uang\s+masuk|pembayaran).*?rp\.?\s*([\d.,]+)/i);
        const isIncome = /(?:uang\s+masuk|terima|in)/i.test(cleanContent);
        if (jeniusMatch) {
            parsed = {
                type: isIncome ? 'INCOME' : 'EXPENSE',
                amount: parseRupiahAmount(jeniusMatch[1]),
                paymentMethod: 'Jenius',
                description: isIncome ? 'Uang masuk Jenius' : 'Transaksi Jenius',
                category: isIncome ? 'pendapatan' : 'belanja',
            };
        }
    }

    // 6. Generic Indonesian Mutation Pattern Fallback
    if (!parsed) {
        const genericMatch = cleanContent.match(/(?:rp\.?\s*|idr\s*)([\d.,]+)/i);
        if (genericMatch) {
            const amount = parseRupiahAmount(genericMatch[1]);
            if (amount > 0) {
                const isIncome = /(?:masuk|kredit|terima|dapat|top\s*up|gaji)/i.test(cleanContent);
                parsed = {
                    type: isIncome ? 'INCOME' : 'EXPENSE',
                    amount: amount,
                    paymentMethod: pkg ? pkg.split('.').pop().toUpperCase() : 'Bank',
                    description: isIncome ? 'Pemasukan transfer' : 'Pengeluaran transaksi',
                    category: isIncome ? 'pendapatan' : 'lainnya',
                };
            }
        }
    }

    if (parsed && parsed.amount > 0) {
        return {
            ...parsed,
            confidence: CONFIDENCE_LEVELS.HIGH,
            parsedBy: 'REGEX',
        };
    }

    return null;
}

/**
 * AI Parsing Fallback via Direct Gemini (Tahap 2 - PRD Sec 47.2)
 * Digunakan jika pola regex tidak mengenali format mutasi baru
 */
async function parseBankNotificationAI(packageName, title = '', text = '') {
    const sanitizedText = sanitizeFinanceText(`${title} ${text}`);
    if (!sanitizedText) return null;

    try {
        const { GoogleGenAI } = require('@google/genai');
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return null;

        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Kamu adalah parser mutasi notifikasi bank Indonesia. Ekstrak informasi transaksi dari teks notifikasi yang sudah disensor berikut:
"${sanitizedText}" (Aplikasi: ${packageName})

Berikan output HANYA dalam JSON valid tanpa markdown fence:
{
  "type": "EXPENSE" | "INCOME" | "UNKNOWN",
  "amount": <angka_murni_nominal_rupiah>,
  "paymentMethod": "<nama_bank_atau_ewallet>",
  "description": "<ringkasan_transaksi_maks_50_karakter>",
  "category": "makanan" | "transportasi" | "belanja" | "tagihan" | "pendapatan" | "lainnya"
}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                temperature: 0.1,
            },
        });

        const jsonStr = response?.text?.trim();
        if (!jsonStr) return null;
        const res = JSON.parse(jsonStr);

        if (res && res.amount > 0 && ['EXPENSE', 'INCOME'].includes(res.type)) {
            return {
                type: res.type,
                amount: parseFloat(res.amount),
                paymentMethod: res.paymentMethod || 'Bank',
                description: res.description || 'Transaksi otomatis bank',
                category: res.category || (res.type === 'INCOME' ? 'pendapatan' : 'lainnya'),
                confidence: CONFIDENCE_LEVELS.MEDIUM,
                parsedBy: 'AI_GEMINI',
            };
        }
    } catch (err) {
        console.warn('⚠️ [FinanceParser] AI Parsing Fallback error:', err.message);
    }

    return null;
}

/**
 * Worker Utama Pemrosesan Event Finansial Notifikasi Android (PRD Sec 43 - 50)
 * Menjalankan deduplikasi deterministik, regex, AI fallback, dan auto-import
 */
async function processIncomingFinanceEvent(userId, payload) {
    const {
        package_name,
        notification_key = 'generic_notif',
        post_time,
        title = '',
        text = '',
        policy = 'AUTO_IF_CONFIDENT',
    } = payload;

    if (!userId || !package_name || (!text && !title)) {
        throw new Error('INVALID_PAYLOAD: user_id, package_name, dan teks notifikasi wajib disertakan.');
    }

    // 1. Parsing awal untuk estimasi amount awal (untuk deterministik key)
    let parsedResult = parseBankNotificationRegex(package_name, title, text);

    // 2. AI Fallback jika regex tidak cocok
    if (!parsedResult) {
        parsedResult = await parseBankNotificationAI(package_name, title, text);
    }

    const normalizedAmount = parsedResult?.amount || 0;
    const postTimeStr = post_time ? new Date(post_time).toISOString() : new Date().toISOString();

    // 3. Deduplikasi Server-Side Tunggal (PRD Sec 49)
    const dedupeKey = computeDedupeKey(package_name, notification_key, postTimeStr, normalizedAmount);

    // Cek apakah kunci deduplikasi sudah pernah tercatat
    const existingEvent = await db.query(
        `SELECT id, status, parsed_amount FROM financial_events WHERE user_id = $1 AND external_event_id = $2 LIMIT 1;`,
        [userId, dedupeKey]
    );

    if (existingEvent.rows.length > 0) {
        console.log(`ℹ️ [FinanceCapture] Event duplikat terdeteksi (dedupe_key: ${dedupeKey.substring(0, 12)}...). Diabaikan secara idempotent.`);
        return {
            success: true,
            isDuplicate: true,
            eventId: existingEvent.rows[0].id,
            status: 'DUPLICATE',
        };
    }

    // Jika parsing gagal sama sekali
    if (!parsedResult || parsedResult.amount <= 0) {
        const failInsert = await db.query(
            `INSERT INTO financial_events (
                user_id, external_event_id, event_type, parsed_amount, currency, description,
                payment_method, occurred_at, confidence_score, status, created_at, processed_at
             ) VALUES ($1, $2, 'UNKNOWN', 0, 'IDR', 'Gagal membedah notifikasi', 'UNKNOWN', $3, 0.00, 'FAILED', NOW(), NOW())
             RETURNING id, status;`,
            [userId, dedupeKey, postTimeStr]
        );
        return {
            success: false,
            eventId: failInsert.rows[0].id,
            reason: 'PARSING_FAILED',
        };
    }

    // 4. Rekam data terstruktur ke financial_events (Zero Persistent Raw Retention)
    const eventType = parsedResult.type;
    const amount = parsedResult.amount;
    const paymentMethod = parsedResult.paymentMethod;
    const description = parsedResult.description;
    const confidence = parsedResult.confidence;
    const category = parsedResult.category || (eventType === 'INCOME' ? 'pendapatan' : 'lainnya');

    // Evaluasi Kebijakan Konfirmasi (PRD Sec 50 & 77)
    let effectivePolicy = policy || 'AUTO_IF_CONFIDENT';
    try {
        const prefRes = await db.query(
            `SELECT auto_capture_policy FROM user_preferences WHERE user_id = $1 AND channel_type IS NULL LIMIT 1;`,
            [userId]
        );
        if (prefRes.rows[0]?.auto_capture_policy && !payload.policy) {
            effectivePolicy = prefRes.rows[0].auto_capture_policy;
        }
    } catch (_) {}

    // Jika kebijakan DISABLED (PRD Sec 77)
    if (effectivePolicy === 'DISABLED') {
        console.log(`ℹ️ [FinanceCapture] Auto-capture dimatikan untuk user ${userId}.`);
        return {
            success: true,
            disabled: true,
            status: 'DISABLED',
            message: 'Auto-capture dinonaktifkan oleh kebijakan pengguna',
        };
    }

    let finalStatus = 'PARSED';
    let importedTransactionId = null;
    let pendingApprovalId = null;

    if (effectivePolicy === 'AUTO_IF_CONFIDENT' && confidence >= CONFIDENCE_LEVELS.HIGH) {
        finalStatus = 'IMPORTED';
    } else {
        // CONFIRM_ALWAYS atau confidence di bawah 0.95 (PRD Sec 77 & 78)
        finalStatus = 'PENDING_APPROVAL';
    }

    const eventInsert = await db.query(
        `INSERT INTO financial_events (
            user_id, external_event_id, event_type, parsed_amount, currency, description,
            payment_method, occurred_at, confidence_score, status, created_at, processed_at
         ) VALUES ($1, $2, $3, $4, 'IDR', $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING *;`,
        [userId, dedupeKey, eventType, amount, description, paymentMethod, postTimeStr, confidence, finalStatus]
    );

    const savedEvent = eventInsert.rows[0];

    // 5a. Jika status IMPORTED: Otomatis masuk ke financial_transactions
    if (finalStatus === 'IMPORTED') {
        const kind = eventType.toLowerCase(); // 'expense' atau 'income'
        const transInsert = await db.query(
            `INSERT INTO financial_transactions (
                user_id, amount, kind, category, description, payment_method, occurred_at, external_event_id, source_type, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AUTO_NOTIFICATION', NOW())
             ON CONFLICT (user_id, external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING
             RETURNING id;`,
            [userId, amount, kind, category, description, paymentMethod, postTimeStr, dedupeKey]
        );

        if (transInsert.rows.length > 0) {
            importedTransactionId = transInsert.rows[0].id;
            console.log(`💰 [FinanceCapture] Transaksi otomatis tersimpan #${importedTransactionId}: [${kind.toUpperCase()}] Rp ${amount.toLocaleString('id-ID')} via ${paymentMethod}`);
        }
    } else if (finalStatus === 'PENDING_APPROVAL') {
        // 5b. Jika PENDING_APPROVAL: Buat entri antrean di tabel approvals (PRD Sec 78)
        try {
            const { createApproval } = require('./approvalService');
            const apprv = await createApproval(userId, {
                type: 'FINANCE_TRANSACTION',
                title: `Konfirmasi Mutasi ${eventType}: Rp ${amount.toLocaleString('id-ID')} via ${paymentMethod}`,
                description: description || `Mutasi terdeteksi dari ${package_name}`,
                payload: {
                    amount,
                    kind: eventType.toLowerCase(),
                    category,
                    description,
                    paymentMethod,
                    external_event_id: dedupeKey,
                    occurred_at: postTimeStr,
                    package_name,
                },
                confidenceScore: confidence,
            });
            pendingApprovalId = apprv.id;
            console.log(`⏳ [FinanceCapture] Transaksi dialihkan ke Approval Center #${pendingApprovalId} (Policy: ${effectivePolicy}, Confidence: ${confidence})`);
        } catch (apprvErr) {
            console.warn('⚠️ Gagal membuat entri approval:', apprvErr.message);
        }
    }

    return {
        success: true,
        isDuplicate: false,
        event: savedEvent,
        importedTransactionId,
        pendingApprovalId,
        parsedBy: parsedResult.parsedBy,
    };
}

module.exports = {
    CONFIDENCE_LEVELS,
    computeDedupeKey,
    sanitizeFinanceText,
    parseRupiahAmount,
    parseBankNotificationRegex,
    parseBankNotificationAI,
    processIncomingFinanceEvent,
};

