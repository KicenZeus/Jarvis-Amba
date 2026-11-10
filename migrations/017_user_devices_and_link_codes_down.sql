-- ==============================================================================
-- Migration 017 Down: Rollback User Devices & Account Link Codes
-- ==============================================================================

DROP TABLE IF EXISTS public.account_link_codes;
DROP TABLE IF EXISTS public.user_devices;

