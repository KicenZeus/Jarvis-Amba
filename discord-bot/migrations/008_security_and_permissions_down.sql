-- ==============================================================================
-- Migration 008 Down: Rollback Security & Permissions
-- Phase 7: Security & Permission System
-- ==============================================================================

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
