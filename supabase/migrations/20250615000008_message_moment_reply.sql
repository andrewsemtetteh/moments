-- Link chat messages to a moment when replying from the moment viewer.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS moment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_moment_id ON public.messages(moment_id)
  WHERE moment_id IS NOT NULL;
