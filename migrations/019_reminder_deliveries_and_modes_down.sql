-- ==============================================================================
-- Rollback Migration 019: Reminder Deliveries & Delivery Modes
-- ==============================================================================

DROP TABLE IF EXISTS public.reminder_deliveries CASCADE;

ALTER TABLE public.reminders 
    DROP CONSTRAINT IF EXISTS chk_target_channels,
    DROP COLUMN IF EXISTS delivery_mode,
    DROP COLUMN IF EXISTS target_channels,
    DROP COLUMN IF EXISTS alarm_sound,
    DROP COLUMN IF EXISTS snooze_minutes,
    DROP COLUMN IF EXISTS version;

