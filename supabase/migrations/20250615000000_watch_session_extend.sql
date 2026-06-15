-- Extend watch_sessions for scheduling, host playback sync, and content metadata.

ALTER TABLE public.watch_sessions
  ADD COLUMN IF NOT EXISTS content_id TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS playback_state TEXT NOT NULL DEFAULT 'paused',
  ADD COLUMN IF NOT EXISTS playback_position INTEGER NOT NULL DEFAULT 0;

-- Allow a 'scheduled' status in addition to the live lifecycle states.
ALTER TABLE public.watch_sessions DROP CONSTRAINT IF EXISTS watch_sessions_status_check;
ALTER TABLE public.watch_sessions
  ADD CONSTRAINT watch_sessions_status_check
  CHECK (status IN ('scheduled', 'setup', 'countdown', 'watching', 'ended'));

ALTER TABLE public.watch_sessions DROP CONSTRAINT IF EXISTS watch_sessions_playback_state_check;
ALTER TABLE public.watch_sessions
  ADD CONSTRAINT watch_sessions_playback_state_check
  CHECK (playback_state IN ('playing', 'paused'));
