const crypto = require('crypto');
const db = require('./db');

/**
 * ==============================================================================
 * Jarvis V3 Phase 12: Offline Sync, Reliability & Recovery Engine (PRD Sec 80-84)
 * - Idempotency ledger client_operations (UUID v4 lookup)
 * - Optimistic Concurrency Control (OCC) via version INT column
 * - Append-only financial mutasi
 * - 24-hour TTL validation for offline transactions
 * - Batch reconciliation via POST /api/v1/sync
 * ==============================================================================
 */

/**
 * Menghitung SHA-256 hash deterministik dari payload operasi
 */
function computePayloadHash(payload) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Mengambil histori operasi client berdasarkan UUID
 */
async function getClientOperation(userId, clientOperationId) {
    if (!clientOperationId) return null;
    const res = await db.query(
        `SELECT id, user_id, client_operation_id, endpoint, payload_hash, status, response_json, created_at
         FROM client_operations
         WHERE user_id = $1 AND client_operation_id = $2
         LIMIT 1;`,
        [userId, clientOperationId]
    );
    return res.rows[0] || null;
}

/**
 * Mencatat operasi client ke ledger idempotensi
 */
async function recordClientOperation(userId, clientOperationId, endpoint, payload, responseJson, status = 'COMPLETED') {
    if (!clientOperationId) return null;
    const payloadHash = computePayloadHash(payload);
    const res = await db.query(
        `INSERT INTO client_operations (
            user_id, client_operation_id, endpoint, payload_hash, status, response_json, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id, client_operation_id) DO NOTHING
         RETURNING *;`,
        [userId, clientOperationId, endpoint, payloadHash, status, JSON.stringify(responseJson || {})]
    );
    return res.rows[0] || null;
}

/**
 * Mengeksekusi satu mutasi operasi secara terisolasi dengan OCC & Append-Only
 */
async function executeSingleOperation(userId, op) {
    const { 
        client_operation_id, 
        endpoint = '', 
        method = 'POST', 
        payload = {}, 
        base_version = null,
        created_at = null 
    } = op;

    const normEndpoint = endpoint.toLowerCase().trim();
    const normMethod = method.toUpperCase().trim();

    // 1. Verifikasi TTL 24 Jam untuk transaksi finansial offline (PRD Sec 81)
    if (normEndpoint.includes('finance') && created_at) {
        const opTime = new Date(created_at).getTime();
        const now = Date.now();
        const ttlMs = 24 * 60 * 60 * 1000; // 24 jam
        if (now - opTime > ttlMs) {
            return {
                client_operation_id,
                status: 'EXPIRED',
                statusCode: 410,
                error: {
                    code: 'OFFLINE_TTL_EXPIRED',
                    message: 'Transaksi offline telah kedaluwarsa (> 24 jam) demi keamanan finansial.',
                },
            };
        }
    }

    // 2. Dispatch Berdasarkan Entitas

    // --- A. TASKS ---
    if (normEndpoint.includes('tasks')) {
        if (normMethod === 'POST') {
            const { title, description, priority = 'MEDIUM', due_at } = payload;
            if (!title) {
                return { client_operation_id, status: 'ERROR', statusCode: 400, error: { message: 'Title wajib diisi' } };
            }
            const res = await db.query(
                `INSERT INTO tasks (user_id, title, description, priority, due_at, status, version, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, 'pending', 1, NOW(), NOW())
                 RETURNING *;`,
                [userId, title.trim(), description || null, priority, due_at || null]
            );
            return { client_operation_id, status: 'SUCCESS', statusCode: 201, data: { task: res.rows[0] } };
        }

        if (normMethod === 'PATCH' || normMethod === 'PUT') {
            const taskId = payload.id || normEndpoint.split('/').filter(Boolean).pop();
            const check = await db.query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2;', [taskId, userId]);
            if (check.rows.length === 0) {
                return { client_operation_id, status: 'NOT_FOUND', statusCode: 404, error: { message: 'Tugas tidak ditemukan' } };
            }

            const current = check.rows[0];
            const expectedVersion = base_version !== null ? parseInt(base_version, 10) : (payload.version ? parseInt(payload.version, 10) : null);

            // Optimistic Concurrency Control Check (PRD Sec 82)
            if (expectedVersion !== null && current.version !== expectedVersion) {
                return {
                    client_operation_id,
                    status: 'CONFLICT',
                    statusCode: 409,
                    error: {
                        code: 'VERSION_CONFLICT',
                        message: 'Data telah diubah oleh perangkat lain',
                        currentVersion: current.version,
                        expectedVersion,
                        currentRecord: current,
                    },
                };
            }

            const updates = [];
            const params = [taskId, userId];
            if (payload.title !== undefined) { params.push(payload.title.trim()); updates.push(`title = $${params.length}`); }
            if (payload.description !== undefined) { params.push(payload.description); updates.push(`description = $${params.length}`); }
            if (payload.status !== undefined) { params.push(payload.status); updates.push(`status = $${params.length}`); }
            if (payload.priority !== undefined) { params.push(payload.priority); updates.push(`priority = $${params.length}`); }
            updates.push('version = version + 1');
            updates.push('updated_at = NOW()');

            const res = await db.query(
                `UPDATE tasks SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *;`,
                params
            );
            return { client_operation_id, status: 'SUCCESS', statusCode: 200, data: { task: res.rows[0] } };
        }

        if (normMethod === 'DELETE') {
            const taskId = payload.id || normEndpoint.split('/').filter(Boolean).pop();
            await db.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2;', [taskId, userId]);
            return { client_operation_id, status: 'SUCCESS', statusCode: 200, data: { deletedId: taskId } };
        }
    }

    // --- B. FINANCIAL TRANSACTIONS (Append-Only Principle - PRD Sec 82) ---
    if (normEndpoint.includes('finance')) {
        if (normMethod === 'POST') {
            const { 
                amount, 
                kind = 'EXPENSE', 
                category = 'Lainnya', 
                description = '', 
                payment_method = 'Cash', 
                source_type = 'MANUAL',
                occurred_at 
            } = payload;

            const numAmount = parseFloat(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
                return { client_operation_id, status: 'ERROR', statusCode: 400, error: { message: 'Nominal transaksi tidak valid' } };
            }

            const res = await db.query(
                `INSERT INTO financial_transactions (
                    user_id, amount, kind, category, description, payment_method, occurred_at, source_type, created_at
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                 RETURNING *;`,
                [
                    userId, 
                    numAmount, 
                    kind.toLowerCase(), 
                    category, 
                    description || null, 
                    payment_method, 
                    occurred_at || new Date().toISOString(),
                    source_type
                ]
            );
            return { client_operation_id, status: 'SUCCESS', statusCode: 201, data: { transaction: res.rows[0] } };
        }
    }

    // --- C. REMINDERS ---
    if (normEndpoint.includes('reminders')) {
        if (normMethod === 'POST') {
            const { 
                title, 
                remind_at, 
                delivery_mode = 'CHAT', 
                alarm_sound = 'default',
                priority = 'MEDIUM'
            } = payload;

            if (!title || !remind_at) {
                return { client_operation_id, status: 'ERROR', statusCode: 400, error: { message: 'Title dan remind_at wajib diisi' } };
            }

            const res = await db.query(
                `INSERT INTO reminders (user_id, channel_id, title, remind_at, priority, status, delivery_mode, alarm_sound, version, created_at)
                 VALUES ($1, 'DEFAULT', $2, $3, $4, 'pending', $5, $6, 1, NOW())
                 RETURNING *, title AS reminder_text;`,
                [userId, title.trim(), new Date(remind_at), priority, delivery_mode, alarm_sound]
            );
            return { client_operation_id, status: 'SUCCESS', statusCode: 201, data: { reminder: res.rows[0] } };
        }

        if (normMethod === 'PATCH' || normMethod === 'PUT') {
            const reminderId = payload.id || normEndpoint.split('/').filter(Boolean).pop();
            const check = await db.query('SELECT * FROM reminders WHERE id = $1 AND user_id = $2;', [reminderId, userId]);
            if (check.rows.length === 0) {
                return { client_operation_id, status: 'NOT_FOUND', statusCode: 404, error: { message: 'Pengingat tidak ditemukan' } };
            }

            const current = check.rows[0];
            const expectedVersion = base_version !== null ? parseInt(base_version, 10) : (payload.version ? parseInt(payload.version, 10) : null);

            if (expectedVersion !== null && current.version !== expectedVersion) {
                return {
                    client_operation_id,
                    status: 'CONFLICT',
                    statusCode: 409,
                    error: {
                        code: 'VERSION_CONFLICT',
                        message: 'Data pengingat telah diubah oleh perangkat lain',
                        currentVersion: current.version,
                        expectedVersion,
                        currentRecord: current,
                    },
                };
            }

            const updates = [];
            const params = [reminderId, userId];
            if (payload.title !== undefined) { params.push(payload.title.trim()); updates.push(`title = $${params.length}`); }
            if (payload.remind_at !== undefined) { params.push(new Date(payload.remind_at)); updates.push(`remind_at = $${params.length}`); }
            if (payload.status !== undefined) { params.push(payload.status); updates.push(`status = $${params.length}`); }
            updates.push('version = version + 1');
            updates.push('updated_at = NOW()');

            const res = await db.query(
                `UPDATE reminders SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *, title AS reminder_text;`,
                params
            );
            return { client_operation_id, status: 'SUCCESS', statusCode: 200, data: { reminder: res.rows[0] } };
        }
    }

    // --- D. SCHEDULES ---
    if (normEndpoint.includes('schedules')) {
        if (normMethod === 'POST') {
            const { title, start_time, end_time, description = '', location = '' } = payload;
            if (!title || !start_time) {
                return { client_operation_id, status: 'ERROR', statusCode: 400, error: { message: 'Title dan start_time wajib diisi' } };
            }
            const res = await db.query(
                `INSERT INTO schedules (user_id, title, description, start_time, end_time, location, version, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW())
                 RETURNING *;`,
                [userId, title.trim(), description, new Date(start_time), end_time ? new Date(end_time) : null, location]
            );
            return { client_operation_id, status: 'SUCCESS', statusCode: 201, data: { schedule: res.rows[0] } };
        }

        if (normMethod === 'PATCH' || normMethod === 'PUT') {
            const scheduleId = payload.id || normEndpoint.split('/').filter(Boolean).pop();
            const check = await db.query('SELECT * FROM schedules WHERE id = $1 AND user_id = $2;', [scheduleId, userId]);
            if (check.rows.length === 0) {
                return { client_operation_id, status: 'NOT_FOUND', statusCode: 404, error: { message: 'Jadwal tidak ditemukan' } };
            }

            const current = check.rows[0];
            const expectedVersion = base_version !== null ? parseInt(base_version, 10) : (payload.version ? parseInt(payload.version, 10) : null);

            if (expectedVersion !== null && current.version !== expectedVersion) {
                return {
                    client_operation_id,
                    status: 'CONFLICT',
                    statusCode: 409,
                    error: {
                        code: 'VERSION_CONFLICT',
                        message: 'Data jadwal telah diubah oleh perangkat lain',
                        currentVersion: current.version,
                        expectedVersion,
                        currentRecord: current,
                    },
                };
            }

            const updates = [];
            const params = [scheduleId, userId];
            if (payload.title !== undefined) { params.push(payload.title.trim()); updates.push(`title = $${params.length}`); }
            if (payload.start_time !== undefined) { params.push(new Date(payload.start_time)); updates.push(`start_time = $${params.length}`); }
            if (payload.end_time !== undefined) { params.push(payload.end_time ? new Date(payload.end_time) : null); updates.push(`end_time = $${params.length}`); }
            updates.push('version = version + 1');
            updates.push('updated_at = NOW()');

            const res = await db.query(
                `UPDATE schedules SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *;`,
                params
            );
            return { client_operation_id, status: 'SUCCESS', statusCode: 200, data: { schedule: res.rows[0] } };
        }
    }

    return {
        client_operation_id,
        status: 'UNSUPPORTED',
        statusCode: 400,
        error: { message: `Operasi ${normMethod} ${endpoint} tidak didukung untuk sinkronisasi offline.` }
    };
}

/**
 * Mengeksekusi antrean batch sinkronisasi offline (PRD Sec 83)
 * @param {string} userId
 * @param {Array<object>} operations
 */
async function executeSyncBatch(userId, operations = []) {
    if (!Array.isArray(operations)) {
        throw new Error('operations wajib berupa array objek');
    }

    const results = [];
    let syncedCount = 0;
    let conflictCount = 0;
    let errorCount = 0;

    for (const op of operations) {
        const clientOpId = op.client_operation_id;
        if (!clientOpId) {
            results.push({
                client_operation_id: null,
                status: 'ERROR',
                statusCode: 400,
                error: { message: 'client_operation_id (UUID) wajib disertakan' }
            });
            errorCount++;
            continue;
        }

        // 1. Cek apakah operasi ini sudah pernah dieksekusi (Idempotent Replay - PRD Sec 82)
        const existing = await getClientOperation(userId, clientOpId);
        if (existing) {
            results.push({
                client_operation_id: clientOpId,
                status: 'SUCCESS',
                isIdempotentReplay: true,
                statusCode: 200,
                data: existing.response_json,
                timestamp: existing.created_at,
            });
            syncedCount++;
            continue;
        }

        // 2. Eksekusi operasi baru
        try {
            const execRes = await executeSingleOperation(userId, op);

            // 3. Catat ke ledger client_operations jika sukses atau konflik
            if (execRes.status === 'SUCCESS' || execRes.status === 'CONFLICT') {
                await recordClientOperation(
                    userId,
                    clientOpId,
                    op.endpoint || 'unknown',
                    op.payload || {},
                    execRes.data || execRes.error,
                    execRes.status === 'SUCCESS' ? 'COMPLETED' : 'CONFLICT'
                );
            }

            if (execRes.status === 'SUCCESS') syncedCount++;
            if (execRes.status === 'CONFLICT') conflictCount++;
            if (execRes.status === 'ERROR' || execRes.status === 'EXPIRED') errorCount++;

            results.push(execRes);
        } catch (err) {
            errorCount++;
            results.push({
                client_operation_id: clientOpId,
                status: 'ERROR',
                statusCode: 500,
                error: { message: err.message },
            });
        }
    }

    return {
        totalOperations: operations.length,
        syncedCount,
        conflictCount,
        errorCount,
        results,
    };
}

module.exports = {
    computePayloadHash,
    getClientOperation,
    recordClientOperation,
    executeSingleOperation,
    executeSyncBatch,
};

