const db = require('./db');
const channelService = require('./channelService');
const { sendWhatsAppTextMessage } = require('./whatsappAdapter');

/**
 * ==============================================================================
 * Jarvis V3 Phase 4: Unified Reminder & Alarm Engine (PRD V3 Sec 26 - 36)
 * - Transaksional claim atomik via SKIP LOCKED
 * - Slot ledger reminder_deliveries untuk anti kirim-ganda
 * - Dukungan multi-channel: DISCORD, WHATSAPP, ANDROID, WEB
 * - Always-bypass jam tenang untuk event REMINDER (Keputusan Final D1)
 * ==============================================================================
 */

/**
 * Resolusi saluran target pengiriman reminder (PRD V3 Sec 33.2)
 * @param {object} reminder - Baris tabel reminders
 * @returns {Promise<Array<{ channel_type: string, delivery_mode: string, device_id: number|null }>>}
 */
async function resolveDeliveryTargets(reminder) {
    const targets = [];
    const userId = reminder.user_id;
    const mode = (reminder.delivery_mode || 'CHAT').toUpperCase();

    // 1. Jika user menentukan target_channels secara eksplisit (e.g. ['WHATSAPP'])
    if (Array.isArray(reminder.target_channels) && reminder.target_channels.length > 0) {
        for (const ch of reminder.target_channels) {
            const cleanCh = String(ch).toUpperCase().trim();
            if (['DISCORD', 'WHATSAPP', 'ANDROID', 'WEB'].includes(cleanCh)) {
                if (cleanCh === 'ANDROID') {
                    // Cari device Android aktif user
                    const devRes = await db.query(
                        `SELECT id FROM user_devices 
                         WHERE user_id = $1 AND platform = 'android' AND status = 'ACTIVE' 
                         ORDER BY last_seen_at DESC LIMIT 1;`,
                        [userId]
                    );
                    targets.push({
                        channel_type: 'ANDROID',
                        delivery_mode: mode.includes('ALARM') ? 'ALARM' : 'CHAT',
                        device_id: devRes.rows[0]?.id || null,
                    });
                } else {
                    targets.push({
                        channel_type: cleanCh,
                        delivery_mode: 'CHAT',
                        device_id: null,
                    });
                }
            }
        }
    }

    // 2. Jika target_channels kosong (implisit): Resolve dari preferensi notifikasi
    if (targets.length === 0) {
        try {
            const prefRes = await db.query(
                `SELECT channel_type, enabled 
                 FROM notification_preferences 
                 WHERE user_id = $1 AND event_type = 'REMINDER' 
                 LIMIT 1;`,
                [userId]
            );

            if (prefRes.rows.length > 0 && prefRes.rows[0].enabled) {
                const rawType = prefRes.rows[0].channel_type;
                const expanded = rawType === 'BOTH' ? ['DISCORD', 'WHATSAPP'] : [rawType];
                for (const ch of expanded) {
                    if (['DISCORD', 'WHATSAPP', 'ANDROID', 'WEB'].includes(ch)) {
                        targets.push({
                            channel_type: ch,
                            delivery_mode: 'CHAT',
                            device_id: null,
                        });
                    }
                }
            }
        } catch (_) {}
    }

    // 3. Fallback jika preferensi kosong: cari saluran terhubung aktif user
    if (targets.length === 0) {
        try {
            const ucRes = await db.query(
                `SELECT channel_type 
                 FROM user_channels 
                 WHERE user_id = $1 AND status = 'ACTIVE' 
                 ORDER BY is_primary DESC, last_seen_at DESC LIMIT 1;`,
                [userId]
            );
            if (ucRes.rows.length > 0) {
                targets.push({
                    channel_type: ucRes.rows[0].channel_type,
                    delivery_mode: 'CHAT',
                    device_id: null,
                });
            } else if (reminder.channel_id && /^\d{17,20}$/.test(reminder.channel_id)) {
                // Discord snowflake channel id
                targets.push({
                    channel_type: 'DISCORD',
                    delivery_mode: 'CHAT',
                    device_id: null,
                });
            } else {
                // Default ke WhatsApp jika nomor telepon / default
                targets.push({
                    channel_type: 'WHATSAPP',
                    delivery_mode: 'CHAT',
                    device_id: null,
                });
            }
        } catch (_) {}
    }

    // 4. Jika mode memuat ALARM, selalu tambahkan Android Device jika belum ada
    if (mode === 'ALARM' || mode === 'CHAT_AND_ALARM') {
        const existingAndro = targets.find(t => t.channel_type === 'ANDROID');
        if (existingAndro) {
            existingAndro.delivery_mode = 'ALARM';
        } else {
            try {
                const devRes = await db.query(
                    `SELECT id FROM user_devices 
                     WHERE user_id = $1 AND platform = 'android' AND status = 'ACTIVE' 
                     ORDER BY last_seen_at DESC LIMIT 1;`,
                    [userId]
                );
                targets.push({
                    channel_type: 'ANDROID',
                    delivery_mode: 'ALARM',
                    device_id: devRes.rows[0]?.id || null,
                });
            } catch (_) {
                targets.push({
                    channel_type: 'ANDROID',
                    delivery_mode: 'ALARM',
                    device_id: null,
                });
            }
        }
    }

    return targets;
}

/**
 * Dispatch item pengiriman ke saluran eksternal secara asinkron
 */
async function dispatchDeliveryItem(item, reminder, discordClient = null) {
    const title = reminder.title || 'Pengingat Jarvis';
    const text = `⏰ *[PENGINGAT JARVIS]*\n${title}`;

    if (item.channel_type === 'WHATSAPP') {
        // Cari nomor WhatsApp user
        const ucRes = await db.query(
            `SELECT phone_number, external_user_id 
             FROM user_channels 
             WHERE user_id = $1 AND channel_type = 'WHATSAPP' 
             LIMIT 1;`,
            [reminder.user_id]
        );
        const phone = ucRes.rows[0]?.phone_number || ucRes.rows[0]?.external_user_id;
        if (!phone) {
            throw new Error('NO_WHATSAPP_NUMBER: User tidak memiliki nomor WhatsApp tertaut.');
        }
        const waRes = await sendWhatsAppTextMessage(phone, text);
        if (!waRes.success) {
            throw new Error(waRes.error?.message || 'Meta API error');
        }
        return { messageId: waRes.data?.messages?.[0]?.id };
    }

    if (item.channel_type === 'DISCORD') {
        if (!discordClient || !discordClient.isReady?.()) {
            throw new Error('DISCORD_CLIENT_NOT_READY');
        }
        const channelId = reminder.channel_id;
        if (channelId && /^\d{17,20}$/.test(channelId)) {
            const channel = await discordClient.channels.fetch(channelId).catch(() => null);
            if (channel && channel.isTextBased()) {
                const msg = await channel.send(`⏰ **[PENGINGAT]** <@${reminder.user_id}>\n${title}`);
                return { messageId: msg.id };
            }
        }
        // Fallback ke DM user
        const discordUser = await discordClient.users.fetch(reminder.user_id).catch(() => null);
        if (discordUser) {
            const dm = await discordUser.send(`⏰ **[PENGINGAT]**\n${title}`);
            return { messageId: dm.id };
        }
        throw new Error('DISCORD_USER_UNREACHABLE');
    }

    if (item.channel_type === 'ANDROID') {
        // Mode ALARM / CHAT Push: Rekam FCM payload
        // Pengiriman FCM silent sync ke Android Client
        if (!item.device_id) {
            console.warn(`⚠️ [ReminderEngine] Delivery ANDROID #${item.id}: User belum memiliki perangkat Android terdaftar.`);
        }
        return { fcmSynced: true, deviceId: item.device_id };
    }

    return { skipped: true };
}

/**
 * Worker utama poller reminder atomik (PRD V3 Sec 35)
 * Dijalankan setiap 30 detik oleh proactive scheduler
 */
async function processDueReminders(discordClient = null) {
    try {
        // Step 1: Claim reminder jatuh tempo via FOR UPDATE SKIP LOCKED
        const claimRes = await db.query(`
            SELECT id, user_id, channel_id, title, priority, repeat_rule, 
                   delivery_mode, target_channels, remind_at, snooze_until, version
            FROM public.reminders 
            WHERE status = 'pending' AND (
                (snooze_until IS NOT NULL AND snooze_until <= NOW()) OR 
                (snooze_until IS NULL AND remind_at <= NOW())
            )
            ORDER BY COALESCE(snooze_until, remind_at) ASC
            LIMIT 20;
        `);

        if (claimRes.rows.length === 0) return 0;

        let processedCount = 0;

        for (const rem of claimRes.rows) {
            const slotTime = rem.snooze_until || rem.remind_at;

            // Step 2: Resolusi target channels
            const targets = await resolveDeliveryTargets(rem);

            if (targets.length === 0) {
                console.warn(`⚠️ [ReminderEngine] Reminder #${rem.id} tidak memiliki channel tujuan valid.`);
                await db.query(
                    `UPDATE reminders SET status = 'failed', updated_at = NOW() WHERE id = $1;`,
                    [rem.id]
                );
                continue;
            }

            // Step 3: Insert slot pengiriman atomik ke reminder_deliveries
            for (const t of targets) {
                await db.query(`
                    INSERT INTO reminder_deliveries (
                        reminder_id, user_id, channel_type, delivery_mode, device_id, scheduled_at, status, next_attempt_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW())
                    ON CONFLICT (reminder_id, channel_type, delivery_mode, scheduled_at) DO NOTHING;
                `, [rem.id, rem.user_id, t.channel_type, t.delivery_mode, t.device_id, slotTime]);
            }

            // Step 4: Claim delivery item untuk slot waktu ini
            const claimItems = await db.query(`
                UPDATE reminder_deliveries 
                SET claimed_at = NOW(), attempt_count = attempt_count + 1
                WHERE reminder_id = $1 
                  AND scheduled_at = $2 
                  AND status IN ('PENDING', 'DEFERRED') 
                  AND next_attempt_at <= NOW()
                RETURNING *;
            `, [rem.id, slotTime]);

            // Step 5: Dispatching pengiriman
            for (const item of claimItems.rows) {
                try {
                    const result = await dispatchDeliveryItem(item, rem, discordClient);
                    await db.query(`
                        UPDATE reminder_deliveries 
                        SET status = 'SENT', sent_at = NOW(), metadata = metadata || $2::jsonb
                        WHERE id = $1;
                    `, [item.id, JSON.stringify(result)]);
                    console.log(`✅ [ReminderEngine] Delivery #${item.id} [${item.channel_type}:${item.delivery_mode}] terkirim untuk reminder #${rem.id}`);
                } catch (dispErr) {
                    console.error(`❌ [ReminderEngine] Delivery #${item.id} [${item.channel_type}] gagal:`, dispErr.message);
                    if (item.attempt_count < item.max_attempts) {
                        const backoffSec = Math.pow(2, item.attempt_count) * 30;
                        await db.query(`
                            UPDATE reminder_deliveries 
                            SET status = 'PENDING', 
                                claimed_at = NULL,
                                next_attempt_at = NOW() + ($2 || ' seconds')::INTERVAL,
                                error_code = 'DISPATCH_ERROR',
                                error_message = $3
                            WHERE id = $1;
                        `, [item.id, backoffSec, dispErr.message]);
                    } else {
                        await db.query(`
                            UPDATE reminder_deliveries 
                            SET status = 'FAILED', 
                                error_code = 'MAX_ATTEMPTS_EXCEEDED',
                                error_message = $2
                            WHERE id = $1;
                        `, [item.id, dispErr.message]);
                    }
                }
            }

            // Step 6: Evaluasi Penutupan Slot Reminder
            const checkDeliveries = await db.query(`
                SELECT status FROM reminder_deliveries 
                WHERE reminder_id = $1 AND scheduled_at = $2;
            `, [rem.id, slotTime]);

            const statuses = checkDeliveries.rows.map(r => r.status);
            const hasPending = statuses.some(s => ['PENDING', 'DEFERRED'].includes(s));

            if (!hasPending) {
                const anySent = statuses.some(s => ['SENT', 'DELIVERED'].includes(s));
                if (anySent) {
                    await db.query(`
                        UPDATE reminders 
                        SET status = 'sent', sent_at = NOW(), last_triggered_at = NOW(), snooze_until = NULL, updated_at = NOW() 
                        WHERE id = $1;
                    `, [rem.id]);

                    if (rem.repeat_rule) {
                        try {
                            const { handleRecurringReminder } = require('./proactiveService');
                            await handleRecurringReminder(rem.id);
                        } catch (recErr) {
                            console.error('⚠️ Gagal menjadwalkan recurring reminder:', recErr.message);
                        }
                    }
                } else {
                    await db.query(`
                        UPDATE reminders 
                        SET status = 'failed', updated_at = NOW() 
                        WHERE id = $1;
                    `, [rem.id]);
                }
            }

            processedCount++;
        }

        return processedCount;
    } catch (err) {
        console.error('💥 [ReminderEngine] Fatal error saat memproses reminder:', err.message);
        return 0;
    }
}

/**
 * Pemulihan lock jika worker crash (PRD V3 Sec 35.8)
 */
async function recoverStaleLocks() {
    try {
        const res = await db.query(`
            UPDATE reminder_deliveries 
            SET claimed_at = NULL 
            WHERE status IN ('PENDING', 'DEFERRED') 
              AND claimed_at < NOW() - INTERVAL '5 minutes'
            RETURNING id;
        `);
        if (res.rowCount > 0) {
            console.log(`🧹 [ReminderEngine] Berhasil me-reset ${res.rowCount} stale lock delivery.`);
        }
    } catch (_) {}
}

/**
 * Acknowledgment penerimaan alarm dari Mobile App (PRD V3 Sec 35.7)
 */
async function acknowledgeDelivery(reminderId, { deliveryId, deviceId, action = 'fired' } = {}) {
    const nextStatus = action === 'dismissed' ? 'DISMISSED' : (action === 'snoozed' ? 'SNOOZED' : 'DELIVERED');
    let resolvedDeviceId = parseInt(deviceId, 10) || null;

    if (!resolvedDeviceId && typeof deviceId === 'string' && deviceId.trim()) {
        try {
            const devRes = await db.query(
                `SELECT id FROM user_devices WHERE device_identifier = $1 LIMIT 1;`,
                [deviceId.trim()]
            );
            if (devRes.rows.length > 0) {
                resolvedDeviceId = devRes.rows[0].id;
            }
        } catch (_) {}
    }

    const numDeliveryId = parseInt(deliveryId, 10) || null;

    let result = { rowCount: 0, rows: [] };
    try {
        result = await db.query(`
            UPDATE reminder_deliveries 
            SET status = $1, delivered_at = NOW() 
            WHERE reminder_id = $2 
              AND (
                  ($3::INT IS NOT NULL AND id = $3) OR
                  ($4::INT IS NOT NULL AND device_id = $4) OR
                  delivery_mode = 'ALARM'
              )
            RETURNING id, reminder_id, status;
        `, [nextStatus, reminderId, numDeliveryId, resolvedDeviceId]);
    } catch (e) {
        console.warn(`⚠️ [ReminderEngine] acknowledgeDelivery warning:`, e.message);
    }

    return { acknowledged: true, count: result.rowCount };
}

module.exports = {
    resolveDeliveryTargets,
    processDueReminders,
    recoverStaleLocks,
    acknowledgeDelivery,
};
