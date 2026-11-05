-- ==============================================================================
-- Migration Down: 007_analytics_daily_metrics_down.sql
-- Phase 6 Rollback: Personal Analytics & Proactive Insights
-- ==============================================================================

DROP INDEX IF EXISTS idx_daily_metrics_user_date;
DROP TABLE IF EXISTS daily_metrics;
