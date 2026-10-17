const db = require('./db');
const scheduleService = require('./scheduleService');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Normalisasi prioritas
 */
function normalizePriority(p) {
    if (!p) return 'MEDIUM';
    const up = String(p).toUpperCase().trim();
    if (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(up)) return up;
    if (up.includes('DARURAT') || up.includes('KRITIS') || up.includes('SEGERA')) return 'URGENT';
    if (up.includes('TINGGI') || up.includes('PENTING')) return 'HIGH';
    if (up.includes('RENDAH') || up.includes('SANTAI')) return 'LOW';
    return 'MEDIUM';
}

function getPriorityBadge(priority) {
    const p = normalizePriority(priority);
    switch (p) {
        case 'URGENT': return '🔴 [URGENT]';
        case 'HIGH': return '🟠 [HIGH]';
        case 'MEDIUM': return '🟡 [MED]';
        case 'LOW': return '🟢 [LOW]';
        default: return '🟡 [MED]';
    }
}

/**
 * Membuat Task Chain baru dengan status PENDING_APPROVAL
 */
async function createTaskChain({
    userId,
    channelType = 'DISCORD',
    channelId,
    title,
    description = '',
    category = 'MULTI_STEP_TASK',
    proposedPlan = { actions: [] }
}) {
    // Batalkan task chain sebelumnya yang masih pending untuk user ini agar tidak menumpuk
    await db.query(
        `UPDATE task_chains 
         SET status = 'CANCELLED', updated_at = NOW() 
         WHERE user_id = $1 AND status = 'PENDING_APPROVAL'`,
        [userId]
    );

    const query = `
        INSERT INTO task_chains (
            user_id, channel_type, channel_id, title, description, category, proposed_plan, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_APPROVAL')
        RETURNING *;
    `;
    const res = await db.query(query, [
        userId,
        channelType,
        channelId,
        title,
        description,
        category,
        JSON.stringify(proposedPlan)
    ]);
    return res.rows[0];
}

/**
 * Mengambil task chain aktif yang sedang menunggu verifikasi/persetujuan user
 */
async function getActiveTaskChain(userId) {
    const query = `
        SELECT * FROM task_chains 
        WHERE user_id = $1 AND status = 'PENDING_APPROVAL'
        ORDER BY created_at DESC 
        LIMIT 1;
    `;
    const res = await db.query(query, [userId]);
    return res.rows[0] || null;
}

/**
 * Mengambil task chain berdasarkan ID
 */
async function getTaskChainById(id) {
    const res = await db.query('SELECT * FROM task_chains WHERE id = $1', [id]);
    return res.rows[0] || null;
}

/**
 * Menyetujui dan mengeksekusi seluruh aksi dalam task chain
 */
async function approveAndExecuteTaskChain(chainId, userId) {
    const chain = await getTaskChainById(chainId);
    if (!chain) {
        throw new Error('Task chain tidak ditemukan.');
    }
    if (chain.status !== 'PENDING_APPROVAL') {
        throw new Error(`Task chain berstatus '${chain.status}', tidak dapat dieksekusi ulang.`);
    }

    const plan = typeof chain.proposed_plan === 'string'
        ? JSON.parse(chain.proposed_plan)
        : chain.proposed_plan;

    const actions = Array.isArray(plan?.actions) ? plan.actions : [];
    const executionResults = {
        schedulesCreated: [],
        remindersCreated: [],
        tasksCreated: [],
        deliverables: [],
        errors: []
    };

    // Eksekusi tiap aksi secara berurutan
    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        try {
            if (action.type === 'schedule') {
                const priority = normalizePriority(action.priority);
                const sched = await scheduleService.createSchedule(chain.user_id, {
                    title: action.title,
                    description: action.description || '',
                    startTime: action.start_time,
                    endTime: action.end_time || null,
                    location: action.location || null,
                    priority: priority,
                });
                executionResults.schedulesCreated.push({
                    id: sched.id,
                    title: sched.title,
                    startTime: sched.start_time,
                    priority: sched.priority
                });
            } else if (action.type === 'reminder') {
                const priority = normalizePriority(action.priority);
                const remRes = await db.query(
                    `INSERT INTO reminders (
                        user_id, channel_id, schedule_id, task_id, title, remind_at, priority, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
                    RETURNING *;`,
                    [
                        chain.user_id,
                        chain.channel_id,
                        action.schedule_id || null,
                        action.task_id || null,
                        action.title,
                        new Date(action.remind_at).toISOString(),
                        priority
                    ]
                );
                executionResults.remindersCreated.push({
                    id: remRes.rows[0].id,
                    title: remRes.rows[0].title,
                    remindAt: remRes.rows[0].remind_at,
                    priority: remRes.rows[0].priority
                });
            } else if (action.type === 'task') {
                const priority = normalizePriority(action.priority);
                const taskRes = await db.query(
                    `INSERT INTO tasks (
                        user_id, title, description, due_at, priority, status
                    ) VALUES ($1, $2, $3, $4, $5, 'pending')
                    RETURNING *;`,
                    [
                        chain.user_id,
                        action.title,
                        action.description || '',
                        action.due_at ? new Date(action.due_at).toISOString() : null,
                        priority
                    ]
                );
                executionResults.tasksCreated.push({
                    id: taskRes.rows[0].id,
                    title: taskRes.rows[0].title,
                    dueAt: taskRes.rows[0].due_at,
                    priority: taskRes.rows[0].priority
                });
            } else if (action.type === 'deliverable' || action.type === 'prd' || action.type === 'code') {
                executionResults.deliverables.push({
                    title: action.title || 'Dokumen / PRD / Deliverable',
                    content: action.content || ''
                });
            }
        } catch (actErr) {
            console.error(`❌ Gagal mengeksekusi aksi #${i + 1} (${action.type}):`, actErr.message);
            executionResults.errors.push({
                actionIndex: i,
                type: action.type,
                error: actErr.message
            });
        }
    }

    // Update status di database menjadi EXECUTED
    await db.query(
        `UPDATE task_chains 
         SET status = 'EXECUTED', execution_result = $1, executed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(executionResults), chainId]
    );

    return {
        chain,
        results: executionResults
    };
}

/**
 * Menyimpan catatan revisi dan memperbarui rencana aksi
 */
async function reviseTaskChain(chainId, revisionNotes, newPlan = null) {
    let query = `
        UPDATE task_chains 
        SET status = 'PENDING_APPROVAL', revision_notes = $1, updated_at = NOW()
    `;
    const params = [revisionNotes];

    if (newPlan) {
        query += `, proposed_plan = $2 WHERE id = $3 RETURNING *;`;
        params.push(JSON.stringify(newPlan), chainId);
    } else {
        query += ` WHERE id = $2 RETURNING *;`;
        params.push(chainId);
    }

    const res = await db.query(query, params);
    return res.rows[0] || null;
}

/**
 * Membatalkan task chain
 */
async function cancelTaskChain(chainId) {
    const res = await db.query(
        `UPDATE task_chains 
         SET status = 'CANCELLED', updated_at = NOW() 
         WHERE id = $1 
         RETURNING *;`,
        [chainId]
    );
    return res.rows[0] || null;
}

/**
 * Format teks rencana aksi yang menunggu verifikasi (Cocok untuk Discord dan WhatsApp)
 */
function formatTaskChainProposalText(chain, preferredName = 'Bos') {
    const plan = typeof chain.proposed_plan === 'string'
        ? JSON.parse(chain.proposed_plan)
        : chain.proposed_plan;
    const actions = Array.isArray(plan?.actions) ? plan.actions : [];

    let text = `📋 **VERIFIKASI RENCANA TUGAS BERKELANJUTAN**\n`;
    text += `*Halo ${preferredName}, berikut adalah rancangan langkah kerja yang telah Amba susun berdasarkan analisis permintaan Bos:*\n\n`;
    text += `📌 **Judul:** ${chain.title}\n`;
    if (chain.description) {
        text += `🔍 **Ringkasan / Hasil Analisis:**\n${chain.description}\n\n`;
    }

    text += `⚡ **Daftar Langkah Aksi yang Akan Dieksekusi (${actions.length} Aksi):**\n`;

    if (actions.length === 0) {
        text += `*(Tidak ada langkah otomatis yang terdaftar)*\n`;
    } else {
        actions.forEach((act, idx) => {
            const badge = getPriorityBadge(act.priority);
            if (act.type === 'schedule') {
                const dateStr = act.start_time ? new Date(act.start_time).toLocaleString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
                }) + ' WIB' : 'Waktu menyusul';
                text += `  ${idx + 1}. 📅 **[JADWAL]** ${badge} **${act.title}**\n      🕒 ${dateStr}${act.location ? ` | 📍 ${act.location}` : ''}\n`;
            } else if (act.type === 'reminder') {
                const remindStr = act.remind_at ? new Date(act.remind_at).toLocaleString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
                }) + ' WIB' : 'Waktu pengingat menyusul';
                text += `  ${idx + 1}. ⏰ **[PENGINGAT]** ${badge} **${act.title}**\n      🔔 Alarm aktif pada: ${remindStr}\n`;
            } else if (act.type === 'task') {
                const dueStr = act.due_at ? ` (Batas: ${new Date(act.due_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })})` : '';
                text += `  ${idx + 1}. 📋 **[TUGAS]** ${badge} **${act.title}**${dueStr}\n`;
            } else {
                text += `  ${idx + 1}. 📦 **[DELIVERABLE]** **${act.title}**\n`;
            }
        });
    }

    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `❓ **Apakah rencana di atas sudah disetujui, ${preferredName}?**\n`;
    text += `• Ketik **'Setuju'** atau **'Ya'** untuk mengeksekusi semua aksi di atas.\n`;
    text += `• Berikan instruksi revisi jika ada yang ingin disesuaikan (contoh: *"Ubah jam pengingat jadi jam 20:00"*).\n`;
    text += `• Ketik **'Batal'** untuk membatalkan rencana ini.\n`;

    return text;
}

/**
 * Membuat Discord ActionRow dengan tombol verifikasi interaktif
 */
function createTaskChainActionRow(chainId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`taskchain_approve_${chainId}`)
            .setLabel('Setujui & Eksekusi')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId(`taskchain_revise_${chainId}`)
            .setLabel('Minta Revisi')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),
        new ButtonBuilder()
            .setCustomId(`taskchain_cancel_${chainId}`)
            .setLabel('Batalkan')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
    );
}

/**
 * Format laporan hasil eksekusi setelah user menyetujui
 */
function formatTaskChainExecutionReport(chain, results, preferredName = 'Bos') {
    let text = `🎉 **EKSEKUSI TUGAS BERKELANJUTAN SELESAI!**\n`;
    text += `Semua langkah aksi untuk **"${chain.title}"** telah berhasil dijalankan untuk ${preferredName}:\n\n`;

    if (results.schedulesCreated?.length > 0) {
        text += `📅 **Jadwal Baru Terdaftar (${results.schedulesCreated.length}):**\n`;
        results.schedulesCreated.forEach((s) => {
            const badge = getPriorityBadge(s.priority);
            const dateStr = new Date(s.startTime).toLocaleString('id-ID', {
                weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
            }) + ' WIB';
            text += `  • ${badge} **${s.title}** (${dateStr})\n`;
        });
        text += `\n`;
    }

    if (results.remindersCreated?.length > 0) {
        text += `⏰ **Pengingat Aktif Disetel (${results.remindersCreated.length}):**\n`;
        results.remindersCreated.forEach((r) => {
            const badge = getPriorityBadge(r.priority);
            const dateStr = new Date(r.remindAt).toLocaleString('id-ID', {
                weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
            }) + ' WIB';
            text += `  • ${badge} **${r.title}** (Alarm: ${dateStr})\n`;
        });
        text += `\n`;
    }

    if (results.tasksCreated?.length > 0) {
        text += `📋 **Tugas Baru Dicatat (${results.tasksCreated.length}):**\n`;
        results.tasksCreated.forEach((t) => {
            const badge = getPriorityBadge(t.priority);
            text += `  • ${badge} **${t.title}**\n`;
        });
        text += `\n`;
    }

    if (results.deliverables?.length > 0) {
        text += `📦 **Deliverables / Hasil Kerja:**\n`;
        results.deliverables.forEach((d) => {
            text += `  • **${d.title}**\n`;
        });
        text += `\n`;
    }

    text += `💡 *Ketik \`!jadwal\`, \`!pengingat\`, atau \`!tugas\` untuk mengecek daftar aktif kapan saja.*`;
    return text;
}

/**
 * Ekstraksi blok JSON task_plan dari jawaban AI jika ada
 * Format yang didukung: ```task_plan ... ``` atau ```json { "task_chain": ... } ```
 */
function extractTaskPlanFromAiResponse(aiResponse) {
    if (!aiResponse || typeof aiResponse !== 'string') {
        return { cleanText: aiResponse || '', plan: null };
    }

    // 1. Cek pola ```task_plan ... ```
    const taskPlanRegex = /```task_plan\s*([\s\S]*?)\s*```/i;
    const match = aiResponse.match(taskPlanRegex);

    if (match) {
        try {
            const parsed = JSON.parse(match[1]);
            const cleanText = aiResponse.replace(taskPlanRegex, '').trim();
            return { cleanText, plan: parsed };
        } catch (e) {
            console.warn('⚠️ Gagal parse JSON task_plan dari AI:', e.message);
        }
    }

    // 2. Cek pola JSON ```json { "is_task_chain": true, ... } ```
    const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?"(?:task_chain|is_task_chain|proposed_actions)"[\s\S]*?\})\s*```/i;
    const jsonMatch = aiResponse.match(jsonBlockRegex);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1]);
            const plan = parsed.task_chain || parsed;
            const cleanText = aiResponse.replace(jsonBlockRegex, '').trim();
            return { cleanText, plan };
        } catch (e) {
            console.warn('⚠️ Gagal parse JSON task_chain dari AI:', e.message);
        }
    }

    return { cleanText: aiResponse, plan: null };
}

module.exports = {
    normalizePriority,
    getPriorityBadge,
    createTaskChain,
    getActiveTaskChain,
    getTaskChainById,
    approveAndExecuteTaskChain,
    reviseTaskChain,
    cancelTaskChain,
    formatTaskChainProposalText,
    createTaskChainActionRow,
    formatTaskChainExecutionReport,
    extractTaskPlanFromAiResponse
};
