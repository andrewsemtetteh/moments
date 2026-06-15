ALTER TABLE public.watch_sessions
  ADD COLUMN IF NOT EXISTS platform_id TEXT;
