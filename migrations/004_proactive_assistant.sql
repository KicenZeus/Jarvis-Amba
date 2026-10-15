-- ==============================================================================
-- Migration: 004_proactive_assistant.sql
-- Phase 3: Proactive Assistant (Daily Briefing, Daily Recap, Recurring & Snooze)
-- Description: Add proactive briefing/recap preferences to users table & proactive tracking logs
-- ==============================================================================

-- 1. Update Table: users (Preferences for proactive features)
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_briefing_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_briefing_time VARCHAR(10) DEFAULT '07:30';
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_recap_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_recap_time VARCHAR(10) DEFAULT '21:00';
ALTER TABLE users ADD COLUMN IF NOT EXISTS briefing_channel_id VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_briefing_date DATE NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_recap_date DATE NULL;

-- 2. Table: proactive_logs (Audit log for proactive messages)
CREATE TABLE IF NOT EXISTS proactive_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'DAILY_BRIEFING', 'DAILY_RECAP', 'OVERDUE_FOLLOW_UP', 'RECURRING_REMINDER'
    channel_id VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SENT', -- 'SENT', 'FAILED'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indices for Proactive Performance
CREATE INDEX IF NOT EXISTS idx_users_briefing ON users(daily_briefing_enabled, daily_briefing_time);
CREATE INDEX IF NOT EXISTS idx_users_recap ON users(daily_recap_enabled, daily_recap_time);
CREATE INDEX IF NOT EXISTS idx_proactive_logs_user ON proactive_logs(user_id, type);
CREATE INDEX IF NOT EXISTS idx_proactive_logs_created ON proactive_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_snooze ON reminders(snooze_until) WHERE snooze_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_repeat ON reminders(repeat_rule) WHERE repeat_rule IS NOT NULL;
