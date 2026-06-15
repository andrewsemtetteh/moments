-- Watch history: completed sessions with couple ratings and post-watch memories.

CREATE TABLE IF NOT EXISTS public.watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  logged_by UUID REFERENCES public.users(id),
  title TEXT NOT NULL,
  platform_id TEXT,
  content_id TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  favorite_moment TEXT,
  prompt_question TEXT,
  prompt_answer TEXT,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watch_history_relationship
  ON public.watch_history(relationship_id, watched_at DESC);

ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY watch_history_all ON public.watch_history FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);
