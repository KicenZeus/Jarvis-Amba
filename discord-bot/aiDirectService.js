/**
 * Direct Gemini AI Service (Standalone Fallback when n8n is offline or unreachable)
 * Memastikan Jarvis tetap cerdas membalas chat di WhatsApp & Discord meskipun n8n mati.
 */

async function generateDirectGeminiReply({
    userMessage,
    userName = 'Kawan',
    callsign = null,
    userRole = 'USER',
    memories = [],
    history = [],
    wantsVoice = false,
}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY tidak dikonfigurasi di environment variable.');
    }

    const preferredGreeting = callsign || userName;
    let memoryBlock = '';
    if (Array.isArray(memories) && memories.length > 0) {
        memoryBlock = '\n\n[Ingatan/Memori Kamu tentang Pengguna Ini]:\n' +
            memories.map((m, i) => `${i + 1}. [${m.category || 'INFO'}] ${m.fact || m.content}`).join('\n');
    }

    const systemInstruction = `Kamu adalah Jarvis (sering dipanggil Amba), asisten AI pribadi yang cerdas, proaktif, ramah, dan berkarakter santai-asyik dalam Bahasa Indonesia.
Kamu melayani pengguna bernama "${preferredGreeting}" (Role: ${userRole}).
${callsign ? `PENTING: Pengguna ini punya panggilan khusus ("${callsign}"). Panggil dia dengan "${callsign}" secara konsisten.` : `Panggil pengguna dengan namanya ("${preferredGreeting}"). Jangan panggil "Bos" kecuali pengguna yang memintanya.`}
${memoryBlock}

Aturan Komunikasi:
1. Jawablah secara lugas, solutif, ramah, dan enak dibaca.
2. Gunakan Bahasa Indonesia yang luwes dan natural (tidak kaku seperti koran, tapi tetap sopan).
3. Jika ditanya hal teknis, coding, jadwal, atau pertanyaan umum, berikan jawaban terbaikmu.
4. ${wantsVoice ? 'Pengguna meminta respon suara. Berikan teks yang enak didengar jika dibacakan, hindari formatting simbol berlebihan.' : 'Gunakan formatting markdown secukupnya agar nyaman dibaca di chat.'}
`;

    const requestBody = {
        system_instruction: {
            parts: [{ text: systemInstruction }],
        },
        contents: [
            {
                role: 'user',
                parts: [{ text: userMessage }],
            },
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
        },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || `Gemini API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!reply) {
        throw new Error('Gemini API merespons dengan konten kosong.');
    }

    return reply;
}

module.exports = { generateDirectGeminiReply };

