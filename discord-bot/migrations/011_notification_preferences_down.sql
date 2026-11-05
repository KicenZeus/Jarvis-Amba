-- Phase 6 Rollback: Proactive Messaging & Notification Preferences
DROP INDEX IF EXISTS idx_notif_pref_user_event;
DROP TABLE IF EXISTS notification_preferences CASCADE;
