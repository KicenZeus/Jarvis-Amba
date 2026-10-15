-- Rollback Migration 009
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS channel_messages CASCADE;
DROP TABLE IF EXISTS channel_conversations CASCADE;
DROP TABLE IF EXISTS user_channels CASCADE;
