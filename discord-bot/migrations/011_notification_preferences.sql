-- Phase 6: Proactive Messaging & Notification Preferences (WhatsApp & Discord)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(32) NOT NULL, -- 'REMINDER', 'DAILY_BRIEFING', 'DAILY_RECAP', 'TASK_DUE'
    channel_type VARCHAR(32) NOT NULL DEFAULT 'BOTH', -- 'DISCORD', 'WHATSAPP', 'BOTH'
    enabled BOOLEAN NOT NULL DEFAULT true,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_event_pref UNIQUE (user_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_pref_user_event ON notification_preferences(user_id, event_type);
