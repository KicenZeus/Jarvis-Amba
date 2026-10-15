-- ====================================================================
-- MIGRATION: 006_web_intelligence_cache.sql
-- DESKRIPSI: Menyimpan cache pencarian web, ekstraksi artikel URL, dan cuaca
-- SESUAI: JARVIS_V2_PRD.md Section 50 (Optional Database - external_cache)
-- ====================================================================

CREATE TABLE IF NOT EXISTS external_cache (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL, -- 'web_search', 'web_extract', 'weather'
    query_hash VARCHAR(64) NOT NULL UNIQUE,
    data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_cache_hash ON external_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_external_cache_expires ON external_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_external_cache_source ON external_cache(source);
