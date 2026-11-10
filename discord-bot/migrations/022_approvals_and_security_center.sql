-- ==============================================================================
-- Migration: 022_approvals_and_security_center.sql
-- Description: Unified Approval Center & Security Audit Trail (PRD V3 Phase 11 Sec 74 - 79)
-- ==============================================================================

-- 1. Table: approvals
CREATE TABLE IF NOT EXISTS public.approvals (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence_score NUMERIC(4,2) DEFAULT 1.00,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    resolution_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT chk_approval_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
    CONSTRAINT chk_approval_type CHECK (type IN ('FINANCE_TRANSACTION', 'TASK_CHAIN', 'SENSITIVE_ACTION', 'DATA_EXPORT', 'BULK_DELETE'))
);

CREATE INDEX IF NOT EXISTS idx_approvals_user_status ON public.approvals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_created_at ON public.approvals(created_at DESC);

-- 2. Table: security_audit_log
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(64),
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_user_action ON public.security_audit_log(user_id, action);
CREATE INDEX IF NOT EXISTS idx_security_audit_created ON public.security_audit_log(created_at DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- 4. Perluas status financial_events agar mendukung PENDING_APPROVAL
ALTER TABLE public.financial_events DROP CONSTRAINT IF EXISTS financial_events_status_check;
ALTER TABLE public.financial_events ADD CONSTRAINT financial_events_status_check 
    CHECK (status IN ('DETECTED', 'PARSED', 'PENDING_APPROVAL', 'CONFIRMED', 'IMPORTED', 'REJECTED', 'DUPLICATE', 'FAILED'));

DROP POLICY IF EXISTS approvals_user_isolation ON public.approvals;
CREATE POLICY approvals_user_isolation ON public.approvals
    FOR ALL
    USING (user_id = current_app_user_id() OR user_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub'))
    WITH CHECK (user_id = current_app_user_id() OR user_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub'));

DROP POLICY IF EXISTS security_audit_user_isolation ON public.security_audit_log;
CREATE POLICY security_audit_user_isolation ON public.security_audit_log
    FOR ALL
    USING (user_id = current_app_user_id() OR user_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub'))
    WITH CHECK (user_id = current_app_user_id() OR user_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub'));
