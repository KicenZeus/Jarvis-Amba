-- ==============================================================================
-- Migration 018: Supabase Realtime Publication
-- Mendaftarkan tabel whitelist operasional ke publikasi supabase_realtime
-- agar Web Dashboard & Mobile App dapat menerima event perubahan data secara
-- instan & read-only via Supabase JS Client (PRD V3 Sec 18 & Sec 108)
-- ==============================================================================

DO $$
BEGIN
    -- Pastikan publikasi supabase_realtime ada
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Daftarkan 4 tabel operasional ke publikasi supabase_realtime
ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.tasks,
    public.schedules,
    public.reminders,
    public.financial_transactions;

