-- In-room chat for watch parties (separate from the couple's main thread).

CREATE TABLE IF NOT EXISTS public.watch_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.watch_sessions(id) ON DELETE CASCADE,
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watch_messages_session
  ON public.watch_messages(session_id, created_at);

ALTER TABLE public.watch_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY watch_messages_all ON public.watch_messages FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);

ALTER PUBLICATION supabase_realtime ADD TABLE watch_messages;
