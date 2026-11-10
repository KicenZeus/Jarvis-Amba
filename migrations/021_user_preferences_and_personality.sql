-- ==============================================================================
-- Migration 021: User Preferences and Personality Settings (PRD V3 Sec 59 - 64)
-- Centralized and Channel-Specific Personality Settings & Response Preferences
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    channel_type VARCHAR(32) NOT NULL DEFAULT 'GLOBAL' CHECK (channel_type IN ('GLOBAL', 'DISCORD', 'WHATSAPP', 'ANDROID', 'IOS', 'WEB')),
    response_style VARCHAR(32) NOT NULL DEFAULT 'CASUAL' CHECK (response_style IN ('CASUAL', 'FORMAL', 'FRIENDLY', 'TECHNICAL')),
    response_length VARCHAR(32) NOT NULL DEFAULT 'NORMAL' CHECK (response_length IN ('SHORT', 'NORMAL', 'DETAILED')),
    auto_capture_policy VARCHAR(32) NOT NULL DEFAULT 'AUTO_IF_CONFIDENT' CHECK (auto_capture_policy IN ('AUTO_IF_CONFIDENT', 'CONFIRM_ALWAYS', 'DISABLED')),
    tone VARCHAR(32) DEFAULT 'Tenang',
    humor_level VARCHAR(16) DEFAULT 'BALANCED' CHECK (humor_level IN ('NONE', 'LOW', 'BALANCED', 'WITTY')),
    language VARCHAR(16) DEFAULT 'id-ID',
    default_response_type VARCHAR(16) DEFAULT 'TEXT' CHECK (default_response_type IN ('TEXT', 'VOICE', 'AUTO')),
    custom_prompt_instructions TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_pref_channel UNIQUE(user_id, channel_type),
    CONSTRAINT chk_auto_capture_global_only CHECK (channel_type = 'GLOBAL' OR auto_capture_policy = 'AUTO_IF_CONFIDENT')
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON public.user_preferences(user_id);

-- RLS Hardening untuk user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
    CREATE POLICY "Users can view own preferences" ON public.user_preferences
        FOR SELECT
        USING (
            user_id = public.current_app_user_id()
            OR user_id = (SELECT auth_user_id::text FROM public.users WHERE id = public.current_app_user_id())
        );

    DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
    CREATE POLICY "Users can insert own preferences" ON public.user_preferences
        FOR INSERT
        WITH CHECK (
            user_id = public.current_app_user_id()
            OR user_id = (SELECT auth_user_id::text FROM public.users WHERE id = public.current_app_user_id())
        );

    DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
    CREATE POLICY "Users can update own preferences" ON public.user_preferences
        FOR UPDATE
        USING (
            user_id = public.current_app_user_id()
            OR user_id = (SELECT auth_user_id::text FROM public.users WHERE id = public.current_app_user_id())
        )
        WITH CHECK (
            user_id = public.current_app_user_id()
            OR user_id = (SELECT auth_user_id::text FROM public.users WHERE id = public.current_app_user_id())
        );

    DROP POLICY IF EXISTS "Users can delete own preferences" ON public.user_preferences;
    CREATE POLICY "Users can delete own preferences" ON public.user_preferences
        FOR DELETE
        USING (
            user_id = public.current_app_user_id()
            OR user_id = (SELECT auth_user_id::text FROM public.users WHERE id = public.current_app_user_id())
        );
END $$;

