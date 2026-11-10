ALTER TABLE public.schedules DROP COLUMN IF EXISTS version;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS version;
DROP TABLE IF EXISTS public.client_operations CASCADE;

