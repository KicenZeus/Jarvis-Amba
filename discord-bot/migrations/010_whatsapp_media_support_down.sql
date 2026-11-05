ALTER TABLE channel_messages DROP COLUMN IF EXISTS media_mime_type;
ALTER TABLE channel_messages DROP COLUMN IF EXISTS media_url;
ALTER TABLE channel_messages DROP COLUMN IF EXISTS content;
DROP INDEX IF EXISTS idx_channel_messages_type;
