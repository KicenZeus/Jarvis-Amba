-- ==============================================================================
-- Rollback Script: 001_foundation_v2_down.sql
-- Description: Revert changes made by 001_foundation_v2.sql
-- ==============================================================================

-- 1. Drop Indices
DROP INDEX IF EXISTS idx_conversations_created_at;
DROP INDEX IF EXISTS idx_conversations_user_id;
DROP INDEX IF EXISTS idx_finance_user_id;
DROP INDEX IF EXISTS idx_reminders_parent_id;
DROP INDEX IF EXISTS idx_reminders_remind_at;
DROP INDEX IF EXISTS idx_reminders_user_id;
DROP INDEX IF EXISTS idx_tasks_user_id;
DROP INDEX IF EXISTS idx_tasks_due_at;

-- 2. Drop Table conversations
DROP TABLE IF EXISTS conversations;

-- 3. Revert Table financial_transactions
ALTER TABLE financial_transactions DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE financial_transactions DROP COLUMN IF EXISTS payment_method;

-- 4. Revert Table notes
ALTER TABLE notes DROP COLUMN IF EXISTS deleted_at;

-- 5. Revert Table reminders
ALTER TABLE reminders DROP COLUMN IF EXISTS parent_reminder_id;
ALTER TABLE reminders DROP COLUMN IF EXISTS snooze_until;
ALTER TABLE reminders DROP COLUMN IF EXISTS last_triggered_at;
ALTER TABLE reminders DROP COLUMN IF EXISTS next_trigger_at;
ALTER TABLE reminders DROP COLUMN IF EXISTS repeat_rule;

-- 6. Revert Table tasks
ALTER TABLE tasks DROP COLUMN IF EXISTS deleted_at;

-- 7. Revert Table users
ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS status;

-- 8. Delete migration record
DELETE FROM schema_migrations WHERE version = '001_foundation_v2';
