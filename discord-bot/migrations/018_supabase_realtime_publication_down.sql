-- ==============================================================================
-- Rollback Migration 018: Supabase Realtime Publication
-- ==============================================================================

ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS 
    public.tasks,
    public.schedules,
    public.reminders,
    public.financial_transactions;

