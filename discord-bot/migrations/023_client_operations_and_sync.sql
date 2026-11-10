-- ==============================================================================
-- Migration: 023_client_operations_and_sync.sql
-- Description: Client Operations Idempotency Ledger & Optimistic Concurrency Control
-- PRD: Jarvis V3 Phase 12 (Sec 80 - 84)
-- ==============================================================================

-- 1. Table: client_operations
CREATE TABLE IF NOT EXISTS public.client_operations (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    client_operation_id UUID NOT NULL,
    endpoint VARCHAR(128) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    response_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_client_op UNIQUE(user_id, client_operation_id)
);

CREATE INDEX IF NOT EXISTS idx_client_operations_lookup ON public.client_operations(user_id, client_operation_id);
CREATE INDEX IF NOT EXISTS idx_client_operations_created ON public.client_operations(created_at DESC);

-- 2. Add version INT to tasks and schedules for Optimistic Concurrency Control (OCC)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- 3. Row Level Security (RLS)
ALTER TABLE public.client_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_operations_user_isolation ON public.client_operations;
CREATE POLICY client_operations_user_isolation ON public.client_operations
    FOR ALL
    USING (user_id = current_app_user_id() OR user_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub'))
    WITH CHECK (user_id = current_app_user_id() OR user_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub'));

