-- ==============================================================================
-- Migration 016 Down: Rollback Auth User ID & RLS Policies
-- ==============================================================================

DROP POLICY IF EXISTS select_own_tasks ON public.tasks;
REVOKE SELECT ON public.tasks FROM authenticated;

DROP POLICY IF EXISTS select_own_schedules ON public.schedules;
REVOKE SELECT ON public.schedules FROM authenticated;

DROP POLICY IF EXISTS select_own_reminders ON public.reminders;
REVOKE SELECT ON public.reminders FROM authenticated;

DROP POLICY IF EXISTS select_own_finance ON public.financial_transactions;
REVOKE SELECT ON public.financial_transactions FROM authenticated;

DROP POLICY IF EXISTS select_own_notes ON public.notes;
REVOKE SELECT ON public.notes FROM authenticated;

DROP POLICY IF EXISTS select_own_memories ON public.memories;
REVOKE SELECT ON public.memories FROM authenticated;

DROP POLICY IF EXISTS select_own_channels ON public.user_channels;
REVOKE SELECT ON public.user_channels FROM authenticated;

DROP POLICY IF EXISTS select_own_notif_prefs ON public.notification_preferences;
REVOKE SELECT ON public.notification_preferences FROM authenticated;

DROP POLICY IF EXISTS select_own_voice_prefs ON public.user_voice_preferences;
REVOKE SELECT ON public.user_voice_preferences FROM authenticated;

DROP POLICY IF EXISTS select_own_metrics ON public.daily_metrics;
REVOKE SELECT ON public.daily_metrics FROM authenticated;

DROP FUNCTION IF EXISTS public.current_app_user_id();

DROP INDEX IF EXISTS public.idx_users_auth_user_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS auth_user_id;

