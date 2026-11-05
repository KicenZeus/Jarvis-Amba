-- ==============================================================================
-- Rollback Migration: 013_schedules_and_priorities_down.sql
-- ==============================================================================

DROP TABLE IF EXISTS schedules CASCADE;
ALTER TABLE reminders DROP COLUMN IF EXISTS priority;
ALTER TABLE reminders DROP COLUMN IF EXISTS schedule_id;
