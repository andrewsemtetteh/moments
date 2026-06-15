-- Watch Together: shared session room for couples (sync placeholder — countdown + reactions).

CREATE TABLE IF NOT EXISTS public.watch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES public.users(id),
  title TEXT NOT NULL,
  link TEXT,
  platform_id TEXT,
  status TEXT NOT NULL DEFAULT 'setup'
    CHECK (status IN ('setup', 'countdown', 'watching', 'ended')),
  ready_user_ids UUID[] NOT NULL DEFAULT '{}',
  countdown_at TIMESTAMPTZ,
  reactions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watch_sessions_relationship
  ON public.watch_sessions(relationship_id, created_at DESC);

ALTER TABLE public.watch_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY watch_sessions_all ON public.watch_sessions FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);

ALTER PUBLICATION supabase_realtime ADD TABLE watch_sessions;
