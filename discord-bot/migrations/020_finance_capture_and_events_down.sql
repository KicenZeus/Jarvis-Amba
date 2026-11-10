-- ==============================================================================
-- Migration 020 Down: Finance Notification Sources & Financial Events
-- ==============================================================================

DROP INDEX IF EXISTS idx_ft_user_external_event;
ALTER TABLE public.financial_transactions DROP COLUMN IF EXISTS external_event_id;
ALTER TABLE public.financial_transactions DROP COLUMN IF EXISTS source_type;
DROP TABLE IF EXISTS public.financial_events CASCADE;
DROP TABLE IF EXISTS public.finance_notification_sources CASCADE;

