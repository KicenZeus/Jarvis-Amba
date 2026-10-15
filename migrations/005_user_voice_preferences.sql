-- ==============================================================================
-- Migration: 005_user_voice_preferences.sql
-- Phase 4: Advanced Voice & Personality
-- Description: Create user_voice_preferences table for voice personalization & TTS configuration
-- ==============================================================================

-- 1. Table: user_voice_preferences (1:1 with users)
CREATE TABLE IF NOT EXISTS user_voice_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    voice_id VARCHAR(100) NOT NULL DEFAULT 'id-ID-ArdiNeural',
    language VARCHAR(20) NOT NULL DEFAULT 'id-ID',
    speed VARCHAR(20) NOT NULL DEFAULT '+0%',
    style VARCHAR(50) NOT NULL DEFAULT 'CASUAL', -- 'NORMAL', 'SHORT', 'CASUAL', 'DETAILED'
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indices for Fast Voice Retrieval
CREATE INDEX IF NOT EXISTS idx_voice_prefs_user ON user_voice_preferences(user_id);
