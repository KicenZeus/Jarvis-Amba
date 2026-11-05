-- ==============================================================================
-- Migration 009: Channel Abstraction & Unified Identity
-- Jarvis V2.1: Multi-Channel Architecture (Discord + WhatsApp)
-- ==============================================================================

-- 1. Table user_channels: Memetakan satu identitas pengguna ke berbagai channel
CREATE TABLE IF NOT EXISTS user_channels (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_type VARCHAR(32) NOT NULL, -- 'DISCORD', 'WHATSAPP'
    external_user_id VARCHAR(128) NOT NULL, -- Discord snowflake atau nomor WA / wa_id
    external_conversation_id VARCHAR(128), -- Default channel/DM id jika ada
    display_name VARCHAR(255),
    phone_number VARCHAR(64),
    username VARCHAR(255),
    is_primary BOOLEAN DEFAULT FALSE,
    status VARCHAR(32) DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    CONSTRAINT uq_user_channels_type_ext_id UNIQUE (channel_type, external_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_channels_user_id ON user_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channels_lookup ON user_channels(channel_type, external_user_id);
CREATE INDEX IF NOT EXISTS idx_user_channels_status ON user_channels(status);

-- 2. Table channel_conversations: Isolasi percakapan / thread per channel
CREATE TABLE IF NOT EXISTS channel_conversations (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_type VARCHAR(32) NOT NULL,
    external_conversation_id VARCHAR(128) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_channel_conversations UNIQUE (channel_type, external_conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_conv_lookup ON channel_conversations(channel_type, external_conversation_id);

-- 3. Table channel_messages: Idempotency & Deduplication Guard untuk Webhook Inbound/Outbound
CREATE TABLE IF NOT EXISTS channel_messages (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    channel_type VARCHAR(32) NOT NULL, -- 'DISCORD', 'WHATSAPP'
    external_message_id VARCHAR(255) NOT NULL, -- wamid.xxx atau discord message snowflake
    external_conversation_id VARCHAR(128),
    direction VARCHAR(16) NOT NULL DEFAULT 'INBOUND', -- 'INBOUND', 'OUTBOUND'
    message_type VARCHAR(32) DEFAULT 'TEXT', -- 'TEXT', 'AUDIO', 'IMAGE', 'DOCUMENT'
    status VARCHAR(32) DEFAULT 'RECEIVED', -- 'RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED'
    payload_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT uq_channel_messages UNIQUE (channel_type, external_message_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_messages_lookup ON channel_messages(channel_type, external_message_id);

-- 4. Table notification_preferences: Pengaturan tujuan delivery notifikasi multi-channel
CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL, -- 'REMINDER', 'DAILY_BRIEFING', 'DAILY_RECAP', 'SYSTEM_ALERT'
    channel_type VARCHAR(32) NOT NULL DEFAULT 'DISCORD', -- 'DISCORD', 'WHATSAPP', 'BOTH'
    enabled BOOLEAN DEFAULT TRUE,
    quiet_hours_start VARCHAR(10) DEFAULT '22:00',
    quiet_hours_end VARCHAR(10) DEFAULT '06:00',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_event_pref UNIQUE (user_id, event_type)
);

-- 5. Backfill Data Discord Eksisting ke user_channels (Zero Data Loss)
INSERT INTO user_channels (user_id, channel_type, external_user_id, display_name, username, is_primary, status, created_at, updated_at)
SELECT 
    id, 
    'DISCORD', 
    COALESCE(discord_user_id, id), 
    display_name, 
    display_name, 
    TRUE, 
    CASE WHEN role = 'BLOCKED' THEN 'BLOCKED' ELSE 'ACTIVE' END, 
    created_at, 
    updated_at
FROM users
ON CONFLICT (channel_type, external_user_id) DO NOTHING;

-- 6. Inisialisasi Default Notification Preferences untuk pengguna eksisting
INSERT INTO notification_preferences (user_id, event_type, channel_type, enabled)
SELECT id, 'REMINDER', 'DISCORD', TRUE FROM users
ON CONFLICT (user_id, event_type) DO NOTHING;

INSERT INTO notification_preferences (user_id, event_type, channel_type, enabled)
SELECT id, 'DAILY_BRIEFING', 'DISCORD', COALESCE(daily_briefing_enabled, TRUE) FROM users
ON CONFLICT (user_id, event_type) DO NOTHING;

INSERT INTO notification_preferences (user_id, event_type, channel_type, enabled)
SELECT id, 'DAILY_RECAP', 'DISCORD', COALESCE(daily_recap_enabled, TRUE) FROM users
ON CONFLICT (user_id, event_type) DO NOTHING;
