-- ==============================================================================
-- Migration 017: User Devices & Account Link Codes
-- Tabel perangkat keras user_devices (FCM push, session revokasi)
-- dan tabel OTP account_link_codes untuk penautan WhatsApp inbound (!link).
-- ==============================================================================

-- 1. Tabel user_devices untuk hardware/endpoint mobile & web
CREATE TABLE IF NOT EXISTS public.user_devices (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    platform VARCHAR(16) NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    device_name VARCHAR(128),
    app_version VARCHAR(32),
    device_identifier VARCHAR(128) NOT NULL,
    session_id UUID,
    push_token TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
    push_status VARCHAR(16) NOT NULL DEFAULT 'OK' CHECK (push_status IN ('OK', 'INVALID')),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_device_identifier UNIQUE(user_id, device_identifier)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user ON public.user_devices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_devices_session ON public.user_devices(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_active_push ON public.user_devices(push_token) WHERE status = 'ACTIVE' AND push_token IS NOT NULL;

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- 2. Tabel account_link_codes untuk OTP penautan WhatsApp Inbound (!link <code>)
CREATE TABLE IF NOT EXISTS public.account_link_codes (
    id BIGSERIAL PRIMARY KEY,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_link_codes_lookup ON public.account_link_codes(code_hash, expires_at);

ALTER TABLE public.account_link_codes ENABLE ROW LEVEL SECURITY;

