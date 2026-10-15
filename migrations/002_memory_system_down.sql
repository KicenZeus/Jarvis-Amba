-- ==============================================================================
-- Rollback Script: 002_memory_system_down.sql
-- Description: Revert changes made by 002_memory_system.sql
-- ==============================================================================

-- 1. Drop Indices
DROP INDEX IF EXISTS idx_memories_updated_at;
DROP INDEX IF EXISTS idx_memories_importance;
DROP INDEX IF EXISTS idx_memories_user_type;
DROP INDEX IF EXISTS idx_memories_user_status;

-- 2. Drop Table memories
DROP TABLE IF EXISTS memories;

-- 3. Delete migration record
DELETE FROM schema_migrations WHERE version = '002_memory_system';
