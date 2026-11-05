-- ==============================================================================
-- Migration 010: WhatsApp Media & Content Support
-- Jarvis V2.1 Phase 5: Voice Notes, Images, & Media Messages
-- ==============================================================================

-- 1. Tambahkan kolom content, media_url, dan media_mime_type pada tabel channel_messages
ALTER TABLE channel_messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE channel_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE channel_messages ADD COLUMN IF NOT EXISTS media_mime_type VARCHAR(128);

-- 2. Index untuk pencarian pesan berdasarkan tipe
CREATE INDEX IF NOT EXISTS idx_channel_messages_type ON channel_messages(channel_type, message_type);
