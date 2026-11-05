-- ==============================================================================
-- Migration: 001_foundation_v2.sql
-- Phase 0: Foundation & Database Migration for Jarvis V2
-- Description: Standardize columns, add proactivity & conversation structures, add missing indices
-- Safe & Non-destructive: Existing V1 data is 100% preserved
-- ==============================================================================

-- 1. Table Migration Tracker
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update Table: users
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'USER';

-- 3. Update Table: tasks (Soft delete support)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- 4. Update Table: reminders (Proactive follow-up, snoozing & chaining)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS repeat_rule VARCHAR(100) NULL;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS next_trigger_at TIMESTAMPTZ NULL;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ NULL;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS snooze_until TIMESTAMPTZ NULL;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS parent_reminder_id INT NULL REFERENCES reminders(id) ON DELETE SET NULL;

-- 5. Update Table: notes (Soft delete support)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- 6. Update Table: financial_transactions (Payment method & Soft delete support)
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100) NULL;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- 7. New Table: conversations (Interaction history for Short-Term Memory V2)
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id VARCHAR NOT NULL,
    input_type VARCHAR(50) NOT NULL DEFAULT 'TEXT',     -- 'TEXT', 'VOICE_NOTE', 'VOICE_CHANNEL', 'SYSTEM'
    output_type VARCHAR(50) NOT NULL DEFAULT 'TEXT',    -- 'TEXT', 'VOICE_NOTE', 'VOICE_CHANNEL'
    user_raw_input TEXT NOT NULL,
    agent_raw_output TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Indices for High Performance & Query Optimization
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_parent_id ON reminders(parent_reminder_id);
CREATE INDEX IF NOT EXISTS idx_finance_user_id ON financial_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
