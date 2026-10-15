-- ==============================================================================
-- Migration: 002_memory_system.sql
-- Phase 1: Memory System (Short-term & Long-term Persistent Memory)
-- Description: Create memories table and indexing for user knowledge retrieval
-- ==============================================================================

-- 1. Table: memories
CREATE TABLE IF NOT EXISTS memories (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'PREFERENCE', -- 'PROFILE', 'PREFERENCE', 'PROJECT', 'HABIT', 'CONTEXT', 'OTHER'
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    importance INT NOT NULL DEFAULT 3,              -- Skala 1 (rendah) sampai 5 (kritis)
    source VARCHAR(50) NOT NULL DEFAULT 'USER_EXPLICIT', -- 'USER_EXPLICIT', 'AI_INFERRED', 'SYSTEM'
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',   -- 'ACTIVE', 'ARCHIVED', 'DELETED'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_user_memory_key UNIQUE (user_id, key)
);

-- 2. Indices for Fast Search & Filtering
CREATE INDEX IF NOT EXISTS idx_memories_user_status ON memories(user_id, status);
CREATE INDEX IF NOT EXISTS idx_memories_user_type ON memories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_updated_at ON memories(updated_at DESC);
