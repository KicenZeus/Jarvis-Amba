-- ==============================================================================
-- Rollback Migration: 005_user_voice_preferences_down.sql
-- Description: Drop user_voice_preferences table
-- ==============================================================================

DROP TABLE IF EXISTS user_voice_preferences CASCADE;
