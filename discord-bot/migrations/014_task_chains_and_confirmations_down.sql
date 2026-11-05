-- ==============================================================================
-- Rollback Migration: 014_task_chains_and_confirmations_down.sql
-- ==============================================================================

DROP INDEX IF EXISTS idx_task_chains_created;
DROP INDEX IF EXISTS idx_task_chains_user_status;
DROP TABLE IF EXISTS task_chains;
