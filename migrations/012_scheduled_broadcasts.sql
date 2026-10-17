-- Phase 9: Scheduled Broadcasts & Target Audiences
CREATE TABLE IF NOT EXISTS scheduled_broadcasts (
    id SERIAL PRIMARY KEY,
    created_by VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    target_channel VARCHAR(32) NOT NULL DEFAULT 'ALL', -- 'ALL', 'WHATSAPP', 'DISCORD'
    target_role VARCHAR(32) DEFAULT NULL, -- 'ALL', 'ADMIN', 'USER', NULL
    target_recipients JSONB DEFAULT NULL, -- specific IDs/phones array e.g. ["6288991185737"]
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
    execution_result JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sched_bc_status_time ON scheduled_broadcasts(status, scheduled_at);
