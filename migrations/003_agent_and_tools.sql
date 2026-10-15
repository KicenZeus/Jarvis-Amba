-- ==============================================================================
-- Migration: 003_agent_and_tools.sql
-- Phase 2: Tool & Agent System
-- Description: Create agent_runs and tool_calls tables for multi-step agent tracking & auditing
-- ==============================================================================

-- 1. Table: agent_runs
CREATE TABLE IF NOT EXISTS agent_runs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INT NULL REFERENCES conversations(id) ON DELETE SET NULL,
    intent TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'RUNNING', -- 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL,
    error TEXT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Table: tool_calls
CREATE TABLE IF NOT EXISTS tool_calls (
    id SERIAL PRIMARY KEY,
    agent_run_id INT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    tool_name VARCHAR(100) NOT NULL,
    arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'RUNNING', -- 'RUNNING', 'COMPLETED', 'FAILED'
    error TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL
);

-- 3. Indices for Fast Audit & Execution Analytics
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_status ON agent_runs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_calls_run ON tool_calls(agent_run_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_name ON tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_calls_created ON tool_calls(created_at DESC);
