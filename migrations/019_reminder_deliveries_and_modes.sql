-- ==============================================================================
-- Migration 019: Reminder Deliveries & Delivery Modes (PRD V3 Sec 34 & 35)
-- Menambahkan kolom V3 pada reminders dan membuat tabel reminder_deliveries
-- untuk delivery slot atomik anti kirim-ganda dan pelacakan multi-channel.
-- ==============================================================================

-- 1. Tambah kolom V3 pada public.reminders
ALTER TABLE public.reminders 
    ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(16) NOT NULL DEFAULT 'CHAT' CHECK (delivery_mode IN ('CHAT', 'ALARM', 'CHAT_AND_ALARM')),
    ADD COLUMN IF NOT EXISTS target_channels TEXT[] DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS alarm_sound VARCHAR(64) DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS snooze_minutes INT DEFAULT 10,
    ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_target_channels'
    ) THEN
        ALTER TABLE public.reminders
            ADD CONSTRAINT chk_target_channels 
            CHECK (target_channels IS NULL OR target_channels <@ ARRAY['DISCORD','WHATSAPP','ANDROID','IOS','WEB']::TEXT[]);
    END IF;
END $$;

-- 2. Buat tabel reminder_deliveries
CREATE TABLE IF NOT EXISTS public.reminder_deliveries (
    id BIGSERIAL PRIMARY KEY,
    reminder_id BIGINT NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    channel_type VARCHAR(32) NOT NULL CHECK (channel_type IN ('DISCORD', 'WHATSAPP', 'ANDROID', 'IOS', 'WEB')),
    delivery_mode VARCHAR(16) NOT NULL DEFAULT 'CHAT' CHECK (delivery_mode IN ('CHAT', 'ALARM')),
    device_id BIGINT REFERENCES public.user_devices(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DEFERRED', 'SENT', 'DELIVERED', 'FAILED', 'DISMISSED', 'SNOOZED', 'CANCELLED')),
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_code VARCHAR(64),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reminder_delivery_slot UNIQUE(reminder_id, channel_type, delivery_mode, scheduled_at)
);

CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_poll ON public.reminder_deliveries(status, next_attempt_at) WHERE status IN ('PENDING', 'DEFERRED');
CREATE INDEX IF NOT EXISTS idx_reminder_deliveries_reminder ON public.reminder_deliveries(reminder_id);

-- 3. RLS Hardening untuk reminder_deliveries
ALTER TABLE public.reminder_deliveries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'reminder_deliveries' AND policyname = 'select_own_reminder_deliveries'
    ) THEN
        CREATE POLICY select_own_reminder_deliveries ON public.reminder_deliveries
            FOR SELECT TO authenticated
            USING (user_id = public.current_app_user_id());
    END IF;
END $$;

GRANT SELECT ON public.reminder_deliveries TO authenticated;

