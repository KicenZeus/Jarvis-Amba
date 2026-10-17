-- ==============================================================================
-- Migration: 014_task_chains_and_confirmations.sql
-- Description: Table for managing multi-step / continuous task chains with approval gates
-- ==============================================================================

CREATE TABLE IF NOT EXISTS task_chains (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_type VARCHAR(20) NOT NULL DEFAULT 'DISCORD', -- 'DISCORD' or 'WHATSAPP'
    channel_id VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'MULTI_STEP_TASK', -- 'IMAGE_SCHEDULE_REMINDER', 'COLLEGE_TASK', 'WEB_PRD', 'MULTI_STEP_TASK'
    proposed_plan JSONB NOT NULL DEFAULT '{"actions":[]}'::jsonb,
    execution_result JSONB NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL', 'APPROVED', 'EXECUTED', 'REVISED', 'CANCELLED'
    revision_notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_task_chains_user_status ON task_chains(user_id, status);
CREATE INDEX IF NOT EXISTS idx_task_chains_created ON task_chains(created_at DESC);
