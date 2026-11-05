-- ==============================================================================
-- Migration: 007_analytics_daily_metrics.sql
-- Phase 6: Personal Analytics & Proactive Insights
-- Description: Table for historical daily productivity, task, reminder & finance metrics
-- ==============================================================================

CREATE TABLE IF NOT EXISTS daily_metrics (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    tasks_created INT NOT NULL DEFAULT 0,
    tasks_completed INT NOT NULL DEFAULT 0,
    reminders_created INT NOT NULL DEFAULT 0,
    reminders_sent INT NOT NULL DEFAULT 0,
    reminders_snoozed INT NOT NULL DEFAULT 0,
    income_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expense_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_metric_date UNIQUE (user_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_user_date ON daily_metrics(user_id, metric_date DESC);
