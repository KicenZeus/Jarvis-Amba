-- ==============================================================================
-- Rollback Migration: 004_proactive_assistant_down.sql
-- Description: Drop proactive_logs table and revert preferences columns
-- ==============================================================================

DROP TABLE IF EXISTS proactive_logs CASCADE;

ALTER TABLE users DROP COLUMN IF EXISTS daily_briefing_enabled;
ALTER TABLE users DROP COLUMN IF EXISTS daily_briefing_time;
ALTER TABLE users DROP COLUMN IF EXISTS daily_recap_enabled;
ALTER TABLE users DROP COLUMN IF EXISTS daily_recap_time;
ALTER TABLE users DROP COLUMN IF EXISTS briefing_channel_id;
ALTER TABLE users DROP COLUMN IF EXISTS last_briefing_date;
ALTER TABLE users DROP COLUMN IF EXISTS last_recap_date;
