-- ==============================================================================
-- Migration 020: Finance Notification Sources & Financial Events (PRD V3 Sec 45-49)
-- Tabel konfigurasi sumber notifikasi finansial dan staging events terstruktur
-- ==============================================================================

-- 1. Tabel finance_notification_sources
CREATE TABLE IF NOT EXISTS public.finance_notification_sources (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    package_name VARCHAR(128) NOT NULL,
    app_name VARCHAR(128) NOT NULL,
    source_type VARCHAR(32) NOT NULL DEFAULT 'BANK' CHECK (source_type IN ('BANK', 'E_WALLET', 'PAYMENT', 'OTHER')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_source_pkg UNIQUE(user_id, package_name)
);
CREATE INDEX IF NOT EXISTS idx_finance_sources_user ON public.finance_notification_sources(user_id, enabled);

-- 2. Tabel financial_events (Staging Terstruktur Tanpa Teks Mentah)
CREATE TABLE IF NOT EXISTS public.financial_events (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    source_id BIGINT REFERENCES public.finance_notification_sources(id) ON DELETE SET NULL,
    external_event_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('INCOME', 'EXPENSE', 'UNKNOWN')),
    parsed_amount NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'IDR',
    description TEXT,
    payment_method VARCHAR(64),
    occurred_at TIMESTAMPTZ NOT NULL,
    confidence_score NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    status VARCHAR(20) NOT NULL DEFAULT 'DETECTED' CHECK (status IN ('DETECTED', 'PARSED', 'CONFIRMED', 'IMPORTED', 'REJECTED', 'DUPLICATE', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT uq_user_fin_event_dedupe UNIQUE(user_id, external_event_id)
);
CREATE INDEX IF NOT EXISTS idx_financial_events_user_status ON public.financial_events(user_id, status);

-- 3. Update financial_transactions untuk kunci deduplikasi & asal sumber
ALTER TABLE public.financial_transactions
    ADD COLUMN IF NOT EXISTS external_event_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(32) DEFAULT 'MANUAL';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_user_external_event 
    ON public.financial_transactions(user_id, external_event_id) 
    WHERE external_event_id IS NOT NULL;

-- 4. RLS Hardening untuk finance_notification_sources & financial_events
ALTER TABLE public.finance_notification_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'finance_notification_sources' AND policyname = 'select_own_finance_sources'
    ) THEN
        CREATE POLICY select_own_finance_sources ON public.finance_notification_sources
            FOR SELECT TO authenticated
            USING (user_id = public.current_app_user_id());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'financial_events' AND policyname = 'select_own_financial_events'
    ) THEN
        CREATE POLICY select_own_financial_events ON public.financial_events
            FOR SELECT TO authenticated
            USING (user_id = public.current_app_user_id());
    END IF;
END $$;

GRANT SELECT ON public.finance_notification_sources TO authenticated;
GRANT SELECT ON public.financial_events TO authenticated;

