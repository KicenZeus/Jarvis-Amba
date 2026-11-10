-- ==============================================================================
-- Migration 016: Auth User ID, Non-Recursive RLS Helper & Whitelist Policies
-- Menghubungkan users kanonik dengan Supabase Auth (GoTrue),
-- membuat helper current_app_user_id(), dan mengaktifkan izin SELECT RLS
-- untuk 10 tabel whitelist client (Web & Mobile).
-- ==============================================================================

-- 1. Tambah kolom auth_user_id sebagai jembatan ke Supabase Auth
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

-- 2. Buat fungsi helper bebas rekursi untuk identifikasi user di RLS
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS VARCHAR(64)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, anon;

-- 3. Pasang RLS Policy SELECT dan GRANT SELECT pada 10 tabel whitelist

-- 3.1 tasks
DROP POLICY IF EXISTS select_own_tasks ON public.tasks;
CREATE POLICY select_own_tasks ON public.tasks
FOR SELECT TO authenticated
USING (user_id = public.current_app_user_id());
GRANT SELECT ON public.tasks TO authenticated;

-- 3.2 schedules
DROP POLICY IF EXISTS select_own_schedules ON public.schedules;
CREATE POLICY select_own_schedules ON public.schedules
FOR SELECT TO authenticated
USING (user_id = public.current_app_user_id());
GRANT SELECT ON public.schedules TO authenticated;

-- 3.3 reminders
DROP POLICY IF EXISTS select_own_reminders ON public.reminders;
CREATE POLICY select_own_reminders ON public.reminders
FOR SELECT TO authenticated
USING (user_id = public.current_app_user_id());
GRANT SELECT ON public.reminders TO authenticated;

-- 3.4 financial_transactions
DROP POLICY IF EXISTS select_own_finance ON public.financial_transactions;
CREATE POLICY select_own_finance ON public.financial_transactions
FOR SELECT TO authenticated
USING (user_id = public.current_app_user_id());
GRANT SELECT ON public.financial_transactions TO authenticated;

-- 3.5 notes
DROP POLICY IF EXISTS select_own_notes ON public.notes;
CREATE POLICY select_own_notes ON public.notes
FOR SELECT TO authenticated
USING (user_id = public.current_app_user_id());
GRANT SELECT ON public.notes TO authenticated;

-- 3.6 memories
DROP POLICY IF EXISTS select_own_memories ON public.memories;
CREATE POLICY select_own_memories ON public.memories
FOR SELECT TO authenticated
USING (user_id = public.current_app_user_id());
GRANT SELECT ON public.memories TO authenticated;

-- 3.7 user_channels
DROP POLICY IF EXISTS select_own_channels ON public.user_channels;
CREATE POLICY select_own_channels ON public.user_channels
FOR SELECT TO authenticated
USING (user_id = public.current_app_user_id());
GRANT SELECT ON public.user_channels TO authenticated;

-- 3.8 notification_preferences
DROP POLICY IF EXISTS select_own_notif_prefs ON public.notification_preferences;
CREATE POLICY select_own_notif_prefs ON public.notification_preferences
FOR SELECT TO authenticated
USING (user_id = public.current_app_user_id());
GRANT SELECT ON public.notification_preferences TO authenticated;

-- 3.9 user_voice_preferences
DROP POLICY IF EXISTS select_own_voice_prefs ON public.user_voice_preferences;
CREATE POLICY select_own_voice_prefs ON public.user_voice_preferences
FOR SELECT TO authenticated
USING (user_id = public.current_app_user_id());
GRANT SELECT ON public.user_voice_preferences TO authenticated;

-- 3.10 daily_metrics
DROP POLICY IF EXISTS select_own_metrics ON public.daily_metrics;
CREATE POLICY select_own_metrics ON public.daily_metrics
FOR SELECT TO authenticated
USING (user_id = public.current_app_user_id());
GRANT SELECT ON public.daily_metrics TO authenticated;

