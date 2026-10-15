-- ==============================================================================
-- Migration 008: Security & Permissions (RBAC, Audit Logs, Risk Guard)
-- Phase 7: Security & Permission System
-- ==============================================================================

-- 1. Table Audit Logs: Pencatatan jejak audit aksi dan keamanan
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    risk_level VARCHAR(20) DEFAULT 'LOW', -- LOW, MEDIUM, HIGH, CRITICAL
    status VARCHAR(20) DEFAULT 'SUCCESS', -- SUCCESS, BLOCKED, FAILED, PENDING_CONFIRMATION
    metadata JSONB DEFAULT '{}',
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_created ON audit_logs(risk_level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 2. Table User Roles: Role-Based Access Control (RBAC)
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    discord_user_id VARCHAR(50) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER', -- OWNER, ADMIN, USER, GUEST, BLOCKED
    assigned_by VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- 3. Sinkronisasi awal dari tabel users ke user_roles jika ada data eksisting
INSERT INTO user_roles (discord_user_id, role, assigned_by, notes, created_at, updated_at)
SELECT 
    id, 
    COALESCE(role, 'USER'), 
    'SYSTEM_MIGRATION', 
    'Initial seed from users table', 
    NOW(), 
    NOW()
FROM users
ON CONFLICT (discord_user_id) DO NOTHING;
