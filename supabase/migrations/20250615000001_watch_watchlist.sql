-- Shared couple watchlist: collaborative list of things to watch together.

CREATE TABLE IF NOT EXISTS public.watch_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES public.users(id),
  title TEXT NOT NULL,
  platform_id TEXT,
  note TEXT,
  -- votes: { "<user_id>": "interested" | "not" | "must" }
  votes JSONB NOT NULL DEFAULT '{}',
  watched BOOLEAN NOT NULL DEFAULT false,
  watched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watch_watchlist_relationship
  ON public.watch_watchlist(relationship_id, watched, created_at DESC);

ALTER TABLE public.watch_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY watch_watchlist_all ON public.watch_watchlist FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);

ALTER PUBLICATION supabase_realtime ADD TABLE watch_watchlist;
