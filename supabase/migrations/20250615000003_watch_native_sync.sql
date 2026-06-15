-- Watch Together: support embedded (Model A) playback sync.
-- content_source distinguishes an in-app player (youtube/video) from a
-- companion streaming session. playback_updated_at lets partner devices
-- extrapolate the host's true position for sub-second drift correction.

ALTER TABLE public.watch_sessions
  ADD COLUMN IF NOT EXISTS content_source TEXT NOT NULL DEFAULT 'streaming',
  ADD COLUMN IF NOT EXISTS playback_updated_at TIMESTAMPTZ;

ALTER TABLE public.watch_sessions DROP CONSTRAINT IF EXISTS watch_sessions_content_source_check;
ALTER TABLE public.watch_sessions
  ADD CONSTRAINT watch_sessions_content_source_check
  CHECK (content_source IN ('streaming', 'youtube', 'video', 'podcast', 'music'));
