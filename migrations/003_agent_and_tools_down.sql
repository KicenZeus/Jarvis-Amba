-- ==============================================================================
-- Rollback Script: 003_agent_and_tools_down.sql
-- Description: Revert changes made by 003_agent_and_tools.sql
-- ==============================================================================

-- 1. Drop Indices
DROP INDEX IF EXISTS idx_tool_calls_created;
DROP INDEX IF EXISTS idx_tool_calls_name;
DROP INDEX IF EXISTS idx_tool_calls_run;
DROP INDEX IF EXISTS idx_agent_runs_created;
DROP INDEX IF EXISTS idx_agent_runs_user_status;

-- 2. Drop Tables
DROP TABLE IF EXISTS tool_calls;
DROP TABLE IF EXISTS agent_runs;

-- 3. Delete migration record
DELETE FROM schema_migrations WHERE version = '003_agent_and_tools';
