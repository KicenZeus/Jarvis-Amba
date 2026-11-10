const db = require('./db');

/**
 * ==============================================================================
 * Jarvis V3 Phase 11: Security, Privacy & Approval Center (PRD Sec 74 - 79)
 * - Atomic approval state transitions (PENDING -> APPROVED / REJECTED)
 * - Auto-capture confirmation queue for low-confidence or confirm-always mutasi
 * - Task chain approval execution
 * - Security audit logging with strict multi-tenant isolation
 * ==============================================================================
 */

/**
 * Mencatat audit trail keamanan aksi sensitif
 */
async function auditSecurityAction(userId, {
    action,
    resourceType,
    resourceId = null,
    ipAddress = null,
    userAgent = null,
    status = 'SUCCESS',
    metadata = {}
}) {
    try {
        await db.query(`
            INSERT INTO security_audit_log (
                user_id, action, resource_type, resource_id, ip_address, user_agent, status, metadata, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());
        `, [
            userId,
            action,
            resourceType,
            resourceId ? String(resourceId) : null,
            ipAddress,
            userAgent,
            status,
            JSON.stringify(metadata || {})
        ]);
    } catch (err) {
        console.warn('⚠️ Gagal mencatat security audit log:', err.message);
    }
}

/**
 * Membuat item approval baru ke antrean (PENDING)
 */
async function createApproval(userId, {
    type,
    title,
    description = '',
    payload = {},
    confidenceScore = 1.00
}) {
    const validTypes = ['FINANCE_TRANSACTION', 'TASK_CHAIN', 'SENSITIVE_ACTION', 'DATA_EXPORT', 'BULK_DELETE'];
    if (!validTypes.includes(type)) {
        throw new Error(`Tipe approval tidak valid: ${type}`);
    }

    const res = await db.query(`
        INSERT INTO approvals (
            user_id, type, title, description, payload, confidence_score, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW(), NOW())
        RETURNING *;
    `, [
        userId,
        type,
        title,
        description,
        JSON.stringify(payload || {}),
        confidenceScore
    ]);

    const approval = res.rows[0];

    await auditSecurityAction(userId, {
        action: 'CREATE_APPROVAL',
        resourceType: type,
        resourceId: approval.id,
        status: 'SUCCESS',
        metadata: { title, confidenceScore }
    });

    return approval;
}

/**
 * Mengambil antrean approval tertunda (status = 'PENDING')
 */
async function getPendingApprovals(userId, options = {}) {
    let query = `
        SELECT id, user_id, type, title, description, payload, confidence_score, status, created_at, updated_at
        FROM approvals
        WHERE user_id = $1 AND status = 'PENDING'
    `;
    const params = [userId];

    if (options.type) {
        params.push(options.type);
        query += ` AND type = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC;`;

    const res = await db.query(query, params);
    return res.rows.map(r => ({
        ...r,
        confidence_score: parseFloat(r.confidence_score),
    }));
}

/**
 * Mengambil riwayat approval yang sudah di-resolve (APPROVED / REJECTED)
 */
async function getApprovalHistory(userId, options = {}) {
    const limit = Math.max(1, Math.min(parseInt(options.limit, 10) || 20, 100));
    const res = await db.query(`
        SELECT id, user_id, type, title, description, payload, confidence_score, status, 
               rejection_reason, resolution_metadata, created_at, resolved_at
        FROM approvals
        WHERE user_id = $1 AND status != 'PENDING'
        ORDER BY resolved_at DESC NULLS LAST, created_at DESC
        LIMIT $2;
    `, [userId, limit]);

    return res.rows.map(r => ({
        ...r,
        confidence_score: parseFloat(r.confidence_score),
    }));
}

/**
 * Resolusi atomik tindakan approval (APPROVE atau REJECT)
 */
async function resolveApproval(userId, approvalId, action, options = {}) {
    if (!['APPROVE', 'REJECT'].includes(action)) {
        throw new Error('Aksi approval harus berupa APPROVE atau REJECT');
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // 1. Kunci baris approval untuk mencegah race condition (FOR UPDATE)
        const fetchRes = await client.query(`
            SELECT id, user_id, type, title, payload, confidence_score, status
            FROM approvals
            WHERE id = $1 AND user_id = $2
            FOR UPDATE;
        `, [approvalId, userId]);

        if (fetchRes.rows.length === 0) {
            await client.query('ROLLBACK');
            const err = new Error('Item approval tidak ditemukan');
            err.code = 'NOT_FOUND';
            err.statusCode = 404;
            throw err;
        }

        const approval = fetchRes.rows[0];
        if (approval.status !== 'PENDING') {
            await client.query('ROLLBACK');
            const err = new Error(`Item approval sudah diproses sebelumnya dengan status: ${approval.status}`);
            err.code = 'ALREADY_RESOLVED';
            err.statusCode = 409;
            throw err;
        }

        const payload = typeof approval.payload === 'string' ? JSON.parse(approval.payload) : (approval.payload || {});
        let executionResult = null;

        if (action === 'APPROVE') {
            // 2. Eksekusi komitmen atomik sesuai tipe approval
            if (approval.type === 'FINANCE_TRANSACTION') {
                const amount = parseFloat(payload.amount);
                const kind = String(payload.kind || 'expense').toLowerCase();
                const category = payload.category || (kind === 'income' ? 'Gaji' : 'Lainnya');
                const description = payload.description || approval.title;
                const paymentMethod = payload.paymentMethod || 'Cash';
                const occurredAt = payload.occurred_at || new Date().toISOString();
                const externalEventId = payload.external_event_id || null;

                // Masukkan transaksi ke financial_transactions
                const txRes = await client.query(`
                    INSERT INTO financial_transactions (
                        user_id, amount, kind, category, description, payment_method, occurred_at, external_event_id, source_type, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'BANK_NOTIFICATION', NOW())
                    RETURNING id;
                `, [userId, amount, kind, category, description, paymentMethod, occurredAt, externalEventId]);

                const txId = txRes.rows[0]?.id;
                executionResult = { transactionId: txId, amount, kind, category, paymentMethod };

                // Perbarui status event staging jika ada
                if (externalEventId) {
                    await client.query(`
                        UPDATE financial_events
                        SET status = 'IMPORTED', processed_at = NOW()
                        WHERE user_id = $1 AND external_event_id = $2;
                    `, [userId, externalEventId]);
                }
            } else if (approval.type === 'TASK_CHAIN') {
                // Eksekusi rangkaian tugas
                const actions = payload.actions || [];
                const createdTaskIds = [];
                for (const act of actions) {
                    const tRes = await client.query(`
                        INSERT INTO tasks (user_id, title, description, priority, due_at, status, created_at)
                        VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
                        RETURNING id;
                    `, [
                        userId,
                        act.title || 'Tugas Baru',
                        act.description || null,
                        act.priority || 'MEDIUM',
                        act.due_at || null
                    ]);
                    createdTaskIds.push(tRes.rows[0]?.id);
                }

                if (payload.task_chain_id) {
                    await client.query(`
                        UPDATE task_chains
                        SET status = 'APPROVED', executed_at = NOW(), execution_result = $3
                        WHERE id = $1 AND user_id = $2;
                    `, [payload.task_chain_id, userId, JSON.stringify({ createdTaskIds })]);
                }

                executionResult = { createdTaskIds };
            } else {
                executionResult = { acknowledged: true };
            }

            // Perbarui status approval ke APPROVED
            await client.query(`
                UPDATE approvals
                SET status = 'APPROVED',
                    resolution_metadata = $3,
                    resolved_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND user_id = $2;
            `, [approvalId, userId, JSON.stringify(executionResult)]);

        } else {
            // action === 'REJECT'
            const rejectionReason = options.reason || 'Ditolak oleh pengguna';

            if (approval.type === 'FINANCE_TRANSACTION' && payload.external_event_id) {
                await client.query(`
                    UPDATE financial_events
                    SET status = 'REJECTED', processed_at = NOW()
                    WHERE user_id = $1 AND external_event_id = $2;
                `, [userId, payload.external_event_id]);
            } else if (approval.type === 'TASK_CHAIN' && payload.task_chain_id) {
                await client.query(`
                    UPDATE task_chains
                    SET status = 'CANCELLED', revision_notes = $3
                    WHERE id = $1 AND user_id = $2;
                `, [payload.task_chain_id, userId, rejectionReason]);
            }

            await client.query(`
                UPDATE approvals
                SET status = 'REJECTED',
                    rejection_reason = $3,
                    resolved_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND user_id = $2;
            `, [approvalId, userId, rejectionReason]);

            executionResult = { rejected: true, reason: rejectionReason };
        }

        // 3. Catat ke security audit log
        await client.query(`
            INSERT INTO security_audit_log (
                user_id, action, resource_type, resource_id, ip_address, status, metadata, created_at
            ) VALUES ($1, $2, $3, $4, $5, 'SUCCESS', $6, NOW());
        `, [
            userId,
            action === 'APPROVE' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
            approval.type,
            String(approvalId),
            options.ipAddress || null,
            JSON.stringify(executionResult)
        ]);

        await client.query('COMMIT');

        // Ambil data terbaru setelah di-update
        const finalRes = await db.query(`
            SELECT id, user_id, type, title, status, rejection_reason, resolution_metadata, resolved_at
            FROM approvals
            WHERE id = $1 AND user_id = $2;
        `, [approvalId, userId]);

        return {
            approval: finalRes.rows[0],
            executionResult,
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    auditSecurityAction,
    createApproval,
    getPendingApprovals,
    getApprovalHistory,
    resolveApproval,
};

