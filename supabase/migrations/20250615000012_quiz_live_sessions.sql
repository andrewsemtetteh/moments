-- Kahoot-style live quiz sessions for couples (synced via Realtime).

CREATE TABLE IF NOT EXISTS public.quiz_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES public.users(id),
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'generating', 'active', 'finished')),
  round_phase TEXT NOT NULL DEFAULT 'answer'
    CHECK (round_phase IN ('answer', 'reveal')),
  questions JSONB NOT NULL DEFAULT '[]',
  current_index INT NOT NULL DEFAULT 0,
  responses JSONB NOT NULL DEFAULT '{}',
  scores JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_live_sessions_relationship
  ON public.quiz_live_sessions(relationship_id, created_at DESC);

ALTER TABLE public.quiz_live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY quiz_live_sessions_all ON public.quiz_live_sessions FOR ALL USING (
  relationship_id IN (SELECT user_relationship_ids())
);

ALTER PUBLICATION supabase_realtime ADD TABLE quiz_live_sessions;
